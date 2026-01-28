import { NextRequest, NextResponse } from 'next/server';
import { AssemblyAI } from 'assemblyai';

const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY;
const ASSEMBLYAI_API_KEY = process.env.ASSEMBLYAI_API_KEY;

export const maxDuration = 300; // 5 minutes for long transcriptions

export async function POST(request: NextRequest) {
  try {
    if (!ASSEMBLYAI_API_KEY) {
      return NextResponse.json({ 
        error: 'AssemblyAI API key is not configured.' 
      }, { status: 500 });
    }

    const formData = await request.formData();
    const audioFile = formData.get('audio') as File | null;
    
    if (!audioFile) {
      return NextResponse.json({ error: 'Audio file is required' }, { status: 400 });
    }

    // Validate file type
    const validTypes = [
      'audio/mpeg', 'audio/mp3', 'audio/wav', 'audio/x-wav', 
      'audio/mp4', 'audio/m4a', 'audio/x-m4a', 'audio/webm',
      'audio/ogg', 'audio/flac', 'video/mp4', 'video/webm'
    ];
    
    if (!validTypes.includes(audioFile.type) && !audioFile.name.match(/\.(mp3|wav|m4a|mp4|webm|ogg|flac)$/i)) {
      return NextResponse.json({ 
        error: 'Invalid file type. Supported: MP3, WAV, M4A, MP4, WebM, OGG, FLAC' 
      }, { status: 400 });
    }

    // Check file size (AssemblyAI limit is ~5GB, but let's be reasonable)
    const maxSize = 500 * 1024 * 1024; // 500MB
    if (audioFile.size > maxSize) {
      return NextResponse.json({ 
        error: 'File too large. Maximum size is 500MB.' 
      }, { status: 400 });
    }

    // Convert file to buffer for upload
    const arrayBuffer = await audioFile.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // Initialize AssemblyAI client
    const client = new AssemblyAI({ apiKey: ASSEMBLYAI_API_KEY });

    // Upload audio file to AssemblyAI
    console.log(`Uploading ${audioFile.name} (${(audioFile.size / 1024 / 1024).toFixed(2)}MB)...`);
    const uploadUrl = await client.files.upload(buffer);
    
    // Transcribe the uploaded audio
    console.log('Starting transcription...');
    const transcriptResult = await client.transcripts.transcribe({
      audio_url: uploadUrl,
    });

    if (transcriptResult.status === 'error') {
      throw new Error(transcriptResult.error || 'Transcription failed');
    }

    if (!transcriptResult.text) {
      throw new Error('No transcript text returned');
    }

    const transcript = transcriptResult.text;

    // Truncate transcript if too long
    const maxLength = 15000;
    const truncatedTranscript = transcript.length > maxLength 
      ? transcript.substring(0, maxLength) + '... [truncated]'
      : transcript;

    // Analyze with OpenRouter
    const analysis = await analyzeWithAI(truncatedTranscript);

    return NextResponse.json({
      fileName: audioFile.name,
      transcriptLength: transcript.length,
      transcriptSource: 'audio-upload',
      analysis
    });

  } catch (error) {
    console.error('Error:', error);
    const message = error instanceof Error ? error.message : 'An error occurred processing the audio';
    return NextResponse.json({ error: message }, { status: 500 });
  }
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
          content: `You are an expert video content analyst. Analyze the provided transcript and provide a comprehensive breakdown.

Your analysis should include:
1. **Executive Summary** (2-3 sentences capturing the main message)
2. **Key Points** (bullet list of the most important takeaways)
3. **Main Topics Covered** (organized by theme)
4. **Notable Quotes or Insights** (if any stand out)
5. **Target Audience** (who would benefit from this content)
6. **Content Quality Assessment** (brief evaluation of depth, accuracy, presentation)
7. **Action Items** (if applicable - what listeners should do after watching)

Format your response in clean markdown.`
        },
        {
          role: 'user',
          content: `Please analyze this transcript:\n\n${transcript}`
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
