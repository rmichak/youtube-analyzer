import { NextRequest, NextResponse } from 'next/server';
import { YoutubeTranscript } from 'youtube-transcript';
import { AssemblyAI } from 'assemblyai';

const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY;
const ASSEMBLYAI_API_KEY = process.env.ASSEMBLYAI_API_KEY;

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

    // Try to fetch transcript - first with youtube-transcript, then with AssemblyAI
    let transcript: string;
    let transcriptSource: string = 'captions';
    
    try {
      // Try youtube-transcript first (fastest, free)
      const transcriptItems = await YoutubeTranscript.fetchTranscript(videoId);
      transcript = transcriptItems.map(item => item.text).join(' ');
      
      if (!transcript || transcript.trim().length === 0) {
        throw new Error('Empty transcript');
      }
    } catch (captionError) {
      console.log('Caption fetch failed, trying AssemblyAI...', captionError);
      
      // Fallback to AssemblyAI transcription
      if (!ASSEMBLYAI_API_KEY) {
        return NextResponse.json({ 
          error: 'This video has no captions available. Audio transcription requires an AssemblyAI API key to be configured.',
          suggestion: 'Try a video with captions enabled, or configure ASSEMBLYAI_API_KEY for audio transcription.'
        }, { status: 400 });
      }
      
      try {
        transcript = await transcribeWithAssemblyAI(videoUrl);
        transcriptSource = 'audio-transcription';
      } catch (transcribeError) {
        console.error('AssemblyAI transcription failed:', transcribeError);
        return NextResponse.json({ 
          error: 'Could not fetch captions or transcribe audio. The video may be restricted or too long.',
          details: transcribeError instanceof Error ? transcribeError.message : 'Unknown error'
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

async function transcribeWithAssemblyAI(videoUrl: string): Promise<string> {
  const client = new AssemblyAI({ apiKey: ASSEMBLYAI_API_KEY! });
  
  // AssemblyAI can transcribe directly from YouTube URLs
  const transcript = await client.transcripts.transcribe({
    audio_url: videoUrl,
  });
  
  if (transcript.status === 'error') {
    throw new Error(transcript.error || 'Transcription failed');
  }
  
  if (!transcript.text) {
    throw new Error('No transcript text returned');
  }
  
  return transcript.text;
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
      model: 'anthropic/claude-3.5-sonnet',
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
