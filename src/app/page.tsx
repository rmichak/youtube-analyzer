'use client';

import { useState, useRef } from 'react';

type InputMode = 'url' | 'upload';

type AnalysisResult = {
  videoId?: string;
  fileName?: string;
  transcriptLength: number;
  transcriptSource?: string;
  analysis: string;
};

export default function Home() {
  const [mode, setMode] = useState<InputMode>('url');
  const [videoUrl, setVideoUrl] = useState('');
  const [audioFile, setAudioFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState<AnalysisResult | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleAnalyzeUrl = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setResult(null);

    try {
      const response = await fetch('/api/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ videoUrl }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to analyze video');
      }

      setResult(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setLoading(false);
    }
  };

  const handleAnalyzeAudio = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!audioFile) return;

    setLoading(true);
    setError('');
    setResult(null);

    try {
      const formData = new FormData();
      formData.append('audio', audioFile);

      const response = await fetch('/api/transcribe-audio', {
        method: 'POST',
        body: formData,
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to transcribe audio');
      }

      setResult(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setLoading(false);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setAudioFile(file);
      setError('');
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files?.[0];
    if (file) {
      setAudioFile(file);
      setError('');
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const formatFileSize = (bytes: number): string => {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  };

  return (
    <main className="min-h-screen" style={{ background: '#0a0f1a' }}>
      <div className="container mx-auto px-4 py-12 max-w-4xl">
        {/* Header */}
        <div className="text-center mb-12">
          <h1 className="text-4xl md:text-5xl font-extrabold mb-4" style={{ color: '#e2e8f0' }}>
            <span style={{ color: '#00d4ff' }}>🎬</span> YouTube Video Analyzer
          </h1>
          <p className="text-lg" style={{ color: '#94a3b8' }}>
            Extract insights from any YouTube video using AI
          </p>
          <div className="mt-3 mx-auto w-24 h-1 rounded-full" style={{ background: 'linear-gradient(to right, #00d4ff, #0a0f1a)' }} />
        </div>

        {/* Mode Tabs */}
        <div className="flex justify-center mb-8">
          <div className="rounded-xl p-1 inline-flex" style={{ background: '#141d2b', border: '1px solid #1e2a3a' }}>
            <button
              onClick={() => setMode('url')}
              className="px-6 py-3 rounded-lg font-semibold transition-all"
              style={{
                background: mode === 'url' ? '#00d4ff' : 'transparent',
                color: mode === 'url' ? '#0a0f1a' : '#94a3b8',
              }}
            >
              🔗 YouTube URL
            </button>
            <button
              onClick={() => setMode('upload')}
              className="px-6 py-3 rounded-lg font-semibold transition-all"
              style={{
                background: mode === 'upload' ? '#00d4ff' : 'transparent',
                color: mode === 'upload' ? '#0a0f1a' : '#94a3b8',
              }}
            >
              📤 Upload Audio
            </button>
          </div>
        </div>

        {/* URL Input Form */}
        {mode === 'url' && (
          <form onSubmit={handleAnalyzeUrl} className="mb-8">
            <div className="flex flex-col md:flex-row gap-4">
              <input
                type="text"
                value={videoUrl}
                onChange={(e) => setVideoUrl(e.target.value)}
                placeholder="Paste YouTube URL here..."
                className="flex-1 px-6 py-4 rounded-xl text-lg focus:outline-none transition-all"
                style={{
                  background: '#141d2b',
                  border: '1px solid #1e2a3a',
                  color: '#e2e8f0',
                }}
                onFocus={(e) => e.target.style.borderColor = '#00d4ff'}
                onBlur={(e) => e.target.style.borderColor = '#1e2a3a'}
                disabled={loading}
              />
              <button
                type="submit"
                disabled={loading || !videoUrl.trim()}
                className="px-8 py-4 font-semibold rounded-xl transition-all duration-200"
                style={{
                  background: loading || !videoUrl.trim() ? '#1e2a3a' : '#00d4ff',
                  color: loading || !videoUrl.trim() ? '#94a3b8' : '#0a0f1a',
                  cursor: loading || !videoUrl.trim() ? 'not-allowed' : 'pointer',
                }}
              >
                {loading ? (
                  <span className="flex items-center gap-2">
                    <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                    </svg>
                    Analyzing...
                  </span>
                ) : (
                  'Analyze Video'
                )}
              </button>
            </div>
          </form>
        )}

        {/* Audio Upload Form */}
        {mode === 'upload' && (
          <form onSubmit={handleAnalyzeAudio} className="mb-8">
            <div className="space-y-4">
              {/* Info Box */}
              <div className="p-4 rounded-xl text-sm" style={{ background: '#141d2b', border: '1px solid #1e2a3a', borderLeft: '4px solid #00d4ff' }}>
                <p className="font-semibold mb-2" style={{ color: '#00d4ff' }}>💡 How to get YouTube audio:</p>
                <ol className="list-decimal ml-5 space-y-1" style={{ color: '#94a3b8' }}>
                  <li>Install <a href="https://github.com/yt-dlp/yt-dlp" target="_blank" rel="noopener noreferrer" className="underline" style={{ color: '#00d4ff' }}>yt-dlp</a> on your computer</li>
                  <li>Run: <code className="px-2 py-0.5 rounded" style={{ background: '#0a0f1a' }}>yt-dlp -x --audio-format mp3 [VIDEO_URL]</code></li>
                  <li>Upload the downloaded audio file below</li>
                </ol>
              </div>

              {/* Drop Zone */}
              <div
                onClick={() => fileInputRef.current?.click()}
                onDrop={handleDrop}
                onDragOver={handleDragOver}
                className="border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-all"
                style={{
                  borderColor: audioFile ? '#10b981' : '#1e2a3a',
                  background: audioFile ? 'rgba(16, 185, 129, 0.05)' : '#141d2b',
                }}
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  onChange={handleFileChange}
                  accept="audio/*,video/mp4,video/webm,.mp3,.wav,.m4a,.mp4,.webm,.ogg,.flac"
                  className="hidden"
                  disabled={loading}
                />
                
                {audioFile ? (
                  <div className="space-y-2">
                    <div className="text-4xl">✅</div>
                    <p className="font-medium" style={{ color: '#10b981' }}>{audioFile.name}</p>
                    <p className="text-sm" style={{ color: 'rgba(16, 185, 129, 0.7)' }}>{formatFileSize(audioFile.size)}</p>
                    <p className="text-sm" style={{ color: '#94a3b8' }}>Click to choose a different file</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    <div className="text-4xl">📁</div>
                    <p style={{ color: '#e2e8f0' }}>Drop your audio file here</p>
                    <p className="text-sm" style={{ color: '#94a3b8' }}>or click to browse</p>
                    <p className="text-xs mt-4" style={{ color: '#64748b' }}>
                      Supports: MP3, WAV, M4A, MP4, WebM, OGG, FLAC (max 500MB)
                    </p>
                  </div>
                )}
              </div>

              {/* Submit Button */}
              <button
                type="submit"
                disabled={loading || !audioFile}
                className="w-full px-8 py-4 font-semibold rounded-xl transition-all duration-200"
                style={{
                  background: loading || !audioFile ? '#1e2a3a' : '#00d4ff',
                  color: loading || !audioFile ? '#94a3b8' : '#0a0f1a',
                  cursor: loading || !audioFile ? 'not-allowed' : 'pointer',
                }}
              >
                {loading ? (
                  <span className="flex items-center justify-center gap-2">
                    <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                    </svg>
                    Transcribing & Analyzing...
                  </span>
                ) : (
                  'Transcribe & Analyze'
                )}
              </button>
            </div>
          </form>
        )}

        {/* Error Message */}
        {error && (
          <div className="mb-8 p-4 rounded-xl" style={{ background: 'rgba(239, 68, 68, 0.1)', border: '1px solid rgba(239, 68, 68, 0.3)' }}>
            <span style={{ color: '#fca5a5' }}>⚠️ {error}</span>
          </div>
        )}

        {/* Loading State */}
        {loading && (
          <div className="text-center py-12">
            <div className="inline-block animate-pulse">
              <div className="text-6xl mb-4">🤖</div>
              <p className="text-lg" style={{ color: '#e2e8f0' }}>
                {mode === 'upload' 
                  ? 'Uploading and transcribing audio...' 
                  : 'Fetching transcript and analyzing with AI...'}
              </p>
              <p className="text-sm mt-2" style={{ color: '#94a3b8' }}>
                {mode === 'upload'
                  ? 'This may take 1-3 minutes depending on audio length'
                  : 'This may take 15-30 seconds'}
              </p>
            </div>
          </div>
        )}

        {/* Results */}
        {result && (
          <div className="space-y-6">
            {/* Video Preview (only for URL mode) */}
            {result.videoId && (
              <div className="rounded-xl p-6" style={{ background: '#141d2b', border: '1px solid #1e2a3a' }}>
                <div className="aspect-video mb-4">
                  <iframe
                    src={`https://www.youtube.com/embed/${result.videoId}`}
                    className="w-full h-full rounded-lg"
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                    allowFullScreen
                  />
                </div>
                <p className="text-sm" style={{ color: '#94a3b8' }}>
                  📝 Transcript length: {result.transcriptLength.toLocaleString()} characters
                  {result.transcriptSource === 'n8n-rapidapi' && (
                    <span className="ml-2" style={{ color: '#f59e0b' }}>(fetched via API fallback)</span>
                  )}
                  {result.transcriptSource === 'audio-transcription' && (
                    <span className="ml-2" style={{ color: '#f59e0b' }}>(transcribed from audio)</span>
                  )}
                </p>
              </div>
            )}

            {/* File Info (only for upload mode) */}
            {result.fileName && (
              <div className="rounded-xl p-6" style={{ background: '#141d2b', border: '1px solid #1e2a3a' }}>
                <div className="flex items-center gap-4">
                  <div className="text-4xl">🎵</div>
                  <div>
                    <p className="font-medium" style={{ color: '#e2e8f0' }}>{result.fileName}</p>
                    <p className="text-sm" style={{ color: '#94a3b8' }}>
                      📝 Transcript length: {result.transcriptLength.toLocaleString()} characters
                      <span className="ml-2" style={{ color: '#10b981' }}>(transcribed from uploaded audio)</span>
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* Analysis */}
            <div className="rounded-xl p-6" style={{ background: '#141d2b', border: '1px solid #1e2a3a' }}>
              <h2 className="text-2xl font-bold mb-1" style={{ color: '#00d4ff' }}>📊 AI Analysis</h2>
              <div className="mb-4 w-16 h-0.5 rounded-full" style={{ background: '#00d4ff' }} />
              <div 
                className="analysis-content"
                dangerouslySetInnerHTML={{ 
                  __html: formatMarkdown(result.analysis) 
                }}
              />
            </div>
          </div>
        )}

        {/* Footer */}
        <footer className="mt-12 text-center text-sm" style={{ color: '#64748b' }}>
          Powered by Claude 3.5 Sonnet via OpenRouter
        </footer>
      </div>

      <style jsx global>{`
        .analysis-content h2 {
          font-size: 1.25rem;
          font-weight: 700;
          color: #00d4ff;
          margin-top: 1.5rem;
          margin-bottom: 0.5rem;
          padding-bottom: 0.25rem;
          border-bottom: 1px solid #1e2a3a;
        }
        .analysis-content h3 {
          font-size: 1rem;
          font-weight: 600;
          color: #e2e8f0;
          margin-top: 1rem;
          margin-bottom: 0.375rem;
        }
        .analysis-content p {
          color: #94a3b8;
          margin: 0.75rem 0;
          line-height: 1.7;
        }
        .analysis-content ul, .analysis-content ol {
          margin: 0.5rem 0;
          padding-left: 1.5rem;
        }
        .analysis-content li {
          color: #94a3b8;
          margin: 0.375rem 0;
          line-height: 1.6;
        }
        .analysis-content strong {
          color: #e2e8f0;
          font-weight: 600;
        }
        .analysis-content code {
          background: #0a0f1a;
          padding: 0.125rem 0.375rem;
          border-radius: 0.25rem;
          font-size: 0.875rem;
          color: #00d4ff;
        }
      `}</style>
    </main>
  );
}

function formatMarkdown(text: string): string {
  return text
    .replace(/^### (.*$)/gm, '<h3>$1</h3>')
    .replace(/^## (.*$)/gm, '<h2>$1</h2>')
    .replace(/^\*\*(.*?)\*\*/gm, '<strong>$1</strong>')
    .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
    .replace(/^- (.*$)/gm, '<li>$1</li>')
    .replace(/^(\d+)\. (.*$)/gm, '<li><strong>$1.</strong> $2</li>')
    .replace(/(<li>.*<\/li>\n?)+/g, '<ul>$&</ul>')
    .replace(/\n\n/g, '</p><p>')
    .replace(/^([^<].*)$/gm, '<p>$1</p>')
    .replace(/<p><\/p>/g, '')
    .replace(/<p>(<h[23])/g, '$1')
    .replace(/(<\/h[23]>)<\/p>/g, '$1');
}
