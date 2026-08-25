# Transcriber Live

A real-time meeting transcription app. Capture microphone and system audio simultaneously, with transcripts saved per session for later review.

## Tech Stack

- **Frontend** — React + TypeScript (Vite)
- **Backend** — Node.js + Fastify
- **Real-time** — Socket.IO
- **Database** — SQLite
- **Transcription** — Deepgram API

## Features

- 🎙️ **Mic transcription** — live transcript from your microphone
- 🔊 **System audio transcription** — captures what's playing on your screen (e.g. calls, videos)
- 💬 **Speaker labels** — "You" for mic, "Others" for system audio
- 📁 **Sessions** — each meeting is its own session; create, rename, or delete sessions
- 🔍 **Search** — filter transcript by keyword in real time
- ⏱️ **Recording timer** — shows how long you've been recording
- 💾 **Export** — download the transcript as a `.txt` file
- 🗑️ **Clear** — wipe the transcript of the current session

## Setup

### 1. Install dependencies

```bash
cd backend && npm install
cd ../frontend && npm install
```

### 2. Add your Deepgram API key

Create a `.env` file inside the `backend/` folder:

```
DEEPGRAM_API_KEY=your_key_here
```

### 3. Run the app

Open two terminals:

```bash
# Terminal 1 — backend
cd backend && node server.js

# Terminal 2 — frontend
cd frontend && npm run dev
```

Then open `http://localhost:5173` in your browser.

## How to Use

1. Click **Start Transcribing** — mic starts immediately; a screen share prompt follows for system audio (optional)
2. Speak or play audio — transcript appears live with speaker labels
3. Use **Search** to filter by keyword
4. Click **Stop** when done — transcript is saved automatically
5. Use **Export** to download as `.txt` or **Clear** to wipe the session
