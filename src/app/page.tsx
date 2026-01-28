'use client';

import { useState } from 'react';

export default function Home() {
  const [videoUrl, setVideoUrl] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState<{
    videoId: string;
    transcriptLength: number;
    analysis: string;
  } | null>(null);

  const handleAnalyze = async (e: React.FormEvent) => {
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

  return (
    <main className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900">
      <div className="container mx-auto px-4 py-12 max-w-4xl">
        {/* Header */}
        <div className="text-center mb-12">
          <h1 className="text-4xl md:text-5xl font-bold text-white mb-4">
            🎬 YouTube Video Analyzer
          </h1>
          <p className="text-lg text-purple-200">
            Extract insights from any YouTube video using AI
          </p>
        </div>

        {/* Input Form */}
        <form onSubmit={handleAnalyze} className="mb-8">
          <div className="flex flex-col md:flex-row gap-4">
            <input
              type="text"
              value={videoUrl}
              onChange={(e) => setVideoUrl(e.target.value)}
              placeholder="Paste YouTube URL here..."
              className="flex-1 px-6 py-4 rounded-xl bg-white/10 border border-purple-500/30 text-white placeholder-purple-300/50 focus:outline-none focus:border-purple-400 focus:ring-2 focus:ring-purple-500/20 text-lg"
              disabled={loading}
            />
            <button
              type="submit"
              disabled={loading || !videoUrl.trim()}
              className="px-8 py-4 bg-purple-600 hover:bg-purple-500 disabled:bg-purple-800 disabled:cursor-not-allowed text-white font-semibold rounded-xl transition-all duration-200 shadow-lg hover:shadow-purple-500/25"
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

        {/* Error Message */}
        {error && (
          <div className="mb-8 p-4 bg-red-500/20 border border-red-500/50 rounded-xl text-red-200">
            ⚠️ {error}
          </div>
        )}

        {/* Loading State */}
        {loading && (
          <div className="text-center py-12">
            <div className="inline-block animate-pulse">
              <div className="text-6xl mb-4">🤖</div>
              <p className="text-purple-200 text-lg">Fetching transcript and analyzing with AI...</p>
              <p className="text-purple-300/50 text-sm mt-2">This may take 15-30 seconds</p>
            </div>
          </div>
        )}

        {/* Results */}
        {result && (
          <div className="space-y-6">
            {/* Video Preview */}
            <div className="bg-white/5 rounded-xl p-6 border border-purple-500/20">
              <div className="aspect-video mb-4">
                <iframe
                  src={`https://www.youtube.com/embed/${result.videoId}`}
                  className="w-full h-full rounded-lg"
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                  allowFullScreen
                />
              </div>
              <p className="text-purple-300 text-sm">
                📝 Transcript length: {result.transcriptLength.toLocaleString()} characters
              </p>
            </div>

            {/* Analysis */}
            <div className="bg-white/5 rounded-xl p-6 border border-purple-500/20">
              <h2 className="text-2xl font-bold text-white mb-4">📊 AI Analysis</h2>
              <div 
                className="prose prose-invert prose-purple max-w-none
                  prose-headings:text-purple-200 
                  prose-p:text-gray-300 
                  prose-li:text-gray-300
                  prose-strong:text-purple-300
                  prose-ul:list-disc
                  prose-ol:list-decimal"
                dangerouslySetInnerHTML={{ 
                  __html: formatMarkdown(result.analysis) 
                }}
              />
            </div>
          </div>
        )}

        {/* Footer */}
        <footer className="mt-12 text-center text-purple-300/50 text-sm">
          Powered by Claude 3.5 Sonnet via OpenRouter
        </footer>
      </div>
    </main>
  );
}

function formatMarkdown(text: string): string {
  // Basic markdown to HTML conversion
  return text
    // Headers
    .replace(/^### (.*$)/gm, '<h3 class="text-lg font-semibold mt-4 mb-2">$1</h3>')
    .replace(/^## (.*$)/gm, '<h2 class="text-xl font-bold mt-6 mb-3">$1</h2>')
    .replace(/^\*\*(.*?)\*\*/gm, '<strong>$1</strong>')
    // Bold
    .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
    // Bullet points
    .replace(/^- (.*$)/gm, '<li class="ml-4">$1</li>')
    .replace(/^(\d+)\. (.*$)/gm, '<li class="ml-4"><span class="font-semibold">$1.</span> $2</li>')
    // Wrap consecutive li items in ul
    .replace(/(<li.*<\/li>\n?)+/g, '<ul class="list-disc space-y-1 my-2">$&</ul>')
    // Paragraphs
    .replace(/\n\n/g, '</p><p class="my-3">')
    .replace(/^([^<].*)$/gm, '<p class="my-3">$1</p>')
    // Clean up
    .replace(/<p class="my-3"><\/p>/g, '')
    .replace(/<p class="my-3">(<h[23])/g, '$1')
    .replace(/(<\/h[23]>)<\/p>/g, '$1');
}
