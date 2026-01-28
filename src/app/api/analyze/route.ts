import { NextRequest, NextResponse } from 'next/server';
import { YoutubeTranscript } from 'youtube-transcript-plus';

const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY;
const AI_MODEL = process.env.AI_MODEL || 'anthropic/claude-3.5-sonnet';

export const maxDuration = 300; // 5 minutes for long transcriptions

function decodeHtmlEntities(text: string): string {
  let decoded = text;
  for (let i = 0; i < 2; i++) {
    const prev = decoded;
    decoded = decoded
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .replace(/&apos;/g, "'")
      .replace(/&#39;/g, "'")
      .replace(/&#(\d+);/g, (_, dec) => String.fromCodePoint(Number(dec)))
      .replace(/&#x([0-9a-fA-F]+);/g, (_, hex) => String.fromCodePoint(parseInt(hex, 16)));
    if (decoded === prev) break;
  }
  return decoded;
}

export async function POST(request: NextRequest) {
  try {
    const { videoUrl } = await request.json();
    
    if (!videoUrl) {
      return NextResponse.json({ error: 'Video URL is required' }, { status: 400 });
    }

    // Extract video ID from URL
    const videoId = extractVideoId(videoUrl);
    if (!videoId) {
      return NextResponse.json({ error: 'Invalid YouTube URL' }, { status: 400 });
    }

    // Fetch transcript with fallback chain
    let transcript: string;
    let transcriptSource: string = 'captions';
    
    // Method 1: youtube-transcript-plus (fast, free, works for official captions)
    try {
      console.log('Method 1: youtube-transcript-plus for', videoId);
      const transcriptItems = await YoutubeTranscript.fetchTranscript(videoId);
      
      transcript = transcriptItems
        .map(item => decodeHtmlEntities(item.text))
        .join(' ')
        .replace(/\[.*?\]/g, '')
        .replace(/♪/g, '')
        .replace(/\s+/g, ' ')
        .trim();
      
      if (!transcript || transcript.length === 0) {
        throw new Error('Empty transcript');
      }
      console.log(`Success via youtube-transcript-plus: ${transcriptItems.length} segments, ${transcript.length} chars`);
    } catch (directError) {
      console.log('Method 1 failed:', directError);
      
      // Method 2: n8n webhook with RapidAPI (handles cloud IP blocks)
      try {
        console.log('Method 2: n8n webhook fallback for', videoId);
        const n8nResponse = await fetch('https://rmichak.app.n8n.cloud/webhook/youtube-transcript', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ url: `https://www.youtube.com/watch?v=${videoId}` }),
          signal: AbortSignal.timeout(30000),
        });
        
        const n8nData = await n8nResponse.json();
        
        if (!n8nData.success || !n8nData.transcript) {
          throw new Error(n8nData.error || 'n8n webhook returned no transcript');
        }
        
        transcript = n8nData.transcript;
        transcriptSource = 'n8n-rapidapi';
        console.log(`Success via n8n fallback: ${transcript.length} chars`);
      } catch (n8nError) {
        console.log('Method 2 failed:', n8nError);
        return NextResponse.json({ 
          error: 'Could not fetch captions for this video. The video may not have captions available.',
          suggestion: 'Try uploading the audio file instead using the Upload Audio tab.',
          details: directError instanceof Error ? directError.message : 'Unknown error'
        }, { status: 400 });
      }
    }

    // Truncate transcript if too long (keep first ~15000 chars to stay within context limits)
    const maxLength = 15000;
    const truncatedTranscript = transcript.length > maxLength 
      ? transcript.substring(0, maxLength) + '... [truncated]'
      : transcript;

    // Analyze with OpenRouter
    const analysis = await analyzeWithAI(truncatedTranscript);

    return NextResponse.json({
      videoId,
      transcriptLength: transcript.length,
      transcriptSource,
      analysis
    });

  } catch (error) {
    console.error('Error:', error);
    return NextResponse.json({ error: 'An error occurred processing the video' }, { status: 500 });
  }
}

function extractVideoId(url: string): string | null {
  const patterns = [
    /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([^&\n?#]+)/,
    /^([a-zA-Z0-9_-]{11})$/
  ];
  
  for (const pattern of patterns) {
    const match = url.match(pattern);
    if (match) return match[1];
  }
  return null;
}

async function analyzeWithAI(transcript: string): Promise<string> {
  const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${OPENROUTER_API_KEY}`,
      'Content-Type': 'application/json',
      'HTTP-Referer': 'https://youtube-analyzer.vercel.app',
      'X-Title': 'YouTube Video Analyzer'
    },
    body: JSON.stringify({
      model: AI_MODEL,
      messages: [
        {
          role: 'system',
          content: `You are an expert video content analyst. Analyze the provided YouTube video transcript and provide a comprehensive breakdown.

Your analysis should include:
1. **Executive Summary** (2-3 sentences capturing the main message)
2. **Key Points** (bullet list of the most important takeaways)
3. **Main Topics Covered** (organized by theme)
4. **Notable Quotes or Insights** (if any stand out)
5. **Target Audience** (who would benefit from this video)
6. **Content Quality Assessment** (brief evaluation of depth, accuracy, presentation)
7. **Action Items** (if applicable - what viewers should do after watching)

Format your response in clean markdown.`
        },
        {
          role: 'user',
          content: `Please analyze this video transcript:\n\n${transcript}`
        }
      ],
      max_tokens: 2000,
      temperature: 0.3
    })
  });

  if (!response.ok) {
    const error = await response.text();
    console.error('OpenRouter error:', error);
    throw new Error('Failed to analyze with AI');
  }

  const data = await response.json();
  return data.choices[0].message.content;
}
