import { NextRequest, NextResponse } from 'next/server';
import { YoutubeTranscript } from 'youtube-transcript';
import { exec } from 'child_process';
import { promisify } from 'util';
import { readFile, unlink } from 'fs/promises';
import { tmpdir } from 'os';
import { join } from 'path';

const execAsync = promisify(exec);

const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY;

export const maxDuration = 300; // 5 minutes for long transcriptions

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

    // Try to fetch transcript with multiple fallbacks
    let transcript: string;
    let transcriptSource: string = 'captions';
    
    // Method 1: Try youtube-transcript npm (fastest)
    try {
      console.log('Trying youtube-transcript npm...');
      const transcriptItems = await YoutubeTranscript.fetchTranscript(videoId);
      transcript = transcriptItems.map(item => item.text).join(' ');
      
      if (!transcript || transcript.trim().length === 0) {
        throw new Error('Empty transcript');
      }
      console.log('Success with youtube-transcript npm');
    } catch (npmError) {
      console.log('youtube-transcript npm failed:', npmError);
      
      // Method 2: Try yt-dlp subtitle extraction
      try {
        console.log('Trying yt-dlp subtitle extraction...');
        transcript = await fetchWithYtDlp(videoId);
        transcriptSource = 'yt-dlp-captions';
        console.log('Success with yt-dlp');
      } catch (ytdlpError) {
        console.log('yt-dlp failed:', ytdlpError);
        
        // All methods failed
        return NextResponse.json({ 
          error: 'Could not fetch captions for this video. Try uploading the audio file instead.',
          suggestion: 'Use the "Upload Audio" tab - download the audio locally with yt-dlp, then upload it here.',
          details: ytdlpError instanceof Error ? ytdlpError.message : 'Unknown error'
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

async function fetchWithYtDlp(videoId: string): Promise<string> {
  const tempFile = join(tmpdir(), `yt-${videoId}-${Date.now()}`);
  const srtFile = `${tempFile}.en.srt`;
  
  try {
    // Download subtitles using yt-dlp
    const command = `yt-dlp --skip-download --write-auto-sub --sub-lang en --sub-format srt -o "${tempFile}" "https://www.youtube.com/watch?v=${videoId}" 2>&1`;
    
    await execAsync(command, { timeout: 60000 });
    
    // Read the SRT file
    let srtContent: string;
    try {
      srtContent = await readFile(srtFile, 'utf-8');
    } catch {
      // Try without language suffix
      const altFile = `${tempFile}.srt`;
      srtContent = await readFile(altFile, 'utf-8');
    }
    
    // Parse SRT to plain text
    const transcript = parseSrtToText(srtContent);
    
    if (!transcript || transcript.trim().length === 0) {
      throw new Error('Empty transcript from yt-dlp');
    }
    
    return transcript;
  } finally {
    // Cleanup temp files
    try {
      await unlink(srtFile);
    } catch {
      // Ignore cleanup errors
    }
  }
}

function parseSrtToText(srt: string): string {
  // Remove SRT formatting: timestamps, sequence numbers, and blank lines
  const lines = srt.split('\n');
  const textLines: string[] = [];
  
  for (const line of lines) {
    const trimmed = line.trim();
    
    // Skip empty lines
    if (!trimmed) continue;
    
    // Skip sequence numbers (just digits)
    if (/^\d+$/.test(trimmed)) continue;
    
    // Skip timestamp lines (00:00:00,000 --> 00:00:00,000)
    if (/^\d{2}:\d{2}:\d{2}[,\.]\d{3}\s*-->\s*\d{2}:\d{2}:\d{2}[,\.]\d{3}$/.test(trimmed)) continue;
    
    // This is actual text content
    textLines.push(trimmed);
  }
  
  // Join and clean up
  return textLines.join(' ')
    .replace(/\s+/g, ' ')  // Normalize whitespace
    .replace(/\[.*?\]/g, '') // Remove [Music], [Applause], etc.
    .trim();
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
