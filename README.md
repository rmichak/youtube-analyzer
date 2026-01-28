# 🎬 YouTube Video Analyzer

AI-powered YouTube video analyzer that extracts transcripts and provides comprehensive summaries using Claude 3.5 Sonnet.

## Features

- 📝 Automatic transcript extraction from YouTube videos
- 🤖 AI-powered analysis using Claude 3.5 Sonnet via OpenRouter
- 📊 Comprehensive breakdown including:
  - Executive Summary
  - Key Points
  - Main Topics Covered
  - Notable Quotes
  - Target Audience
  - Content Quality Assessment
  - Action Items

## Live Demo

🚀 **[Try it now](https://youtube-analyzer-iota.vercel.app)**

## Tech Stack

- **Framework:** Next.js 16 (App Router)
- **Language:** TypeScript
- **Styling:** Tailwind CSS
- **AI:** Claude 3.5 Sonnet via OpenRouter
- **Transcript:** youtube-transcript-plus library
- **Deployment:** Vercel

## Getting Started

### Prerequisites

- Node.js 18+
- OpenRouter API key

### Installation

1. Clone the repository:
```bash
git clone https://github.com/rmichak/youtube-analyzer.git
cd youtube-analyzer
```

2. Install dependencies:
```bash
npm install
```

3. Create a `.env.local` file:
```bash
cp .env.example .env.local
```

4. Add your OpenRouter API key to `.env.local`:
```
OPENROUTER_API_KEY=your_api_key_here
```

5. Run the development server:
```bash
npm run dev
```

6. Open [http://localhost:3000](http://localhost:3000)

## Deployment

### Vercel (Recommended)

1. Push to GitHub
2. Import project in Vercel
3. Add `OPENROUTER_API_KEY` environment variable
4. Deploy!

## Usage

1. Paste a YouTube video URL
2. Click "Analyze Video"
3. Wait 15-30 seconds for the AI analysis
4. Review the comprehensive breakdown

## Limitations

- Video must have captions/subtitles available
- Very long videos (>2 hours) may be truncated
- Rate limits apply based on OpenRouter tier

## License

MIT

## Author

Built by Randy Michak
