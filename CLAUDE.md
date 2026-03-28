# Recall — AI Memory Wearable

> **Hackathon:** HackUSF | **Deadline:** Sunday March 29, 12:30 PM EST

## What Is This?

Recall is an AI memory assistant built into glasses. ESP32 cameras and microphones stream video/audio to a Python backend on a laptop, which uses YOLO + Gemini + ElevenLabs to intelligently log moments and answer natural language queries about the user's day. Target users: people with early-stage cognitive impairment, TBI survivors, elderly users.

## Architecture

**Single-process Python backend** — all logic in one process, threads for concurrency. No multi-agent frameworks.

```
ESP32-S3 (camera, MJPEG) ──WiFi──► Python Backend ──► SQLite (memory.db)
ESP32-WROOM (mic, PCM)   ──WiFi──►      │                    │
                                         ▼                    ▼
                                   YOLO → Gemini        Next.js Chat UI
                                   Select → Log         + ElevenLabs TTS
```

### Pipeline Flow

1. ESP32-S3 streams MJPEG frames → `video_capture.py` buffers 15 frames
2. ESP32-WROOM streams PCM audio → `audio_capture.py` buffers 30s chunks
3. `transcriber.py` sends audio to ElevenLabs Scribe v2
4. Every 15 frames: `yolo_tagger.py` runs object detection (YOLOv8 nano)
5. `gemini_selector.py` picks 2-3 important frames (text-only prompt, no images)
6. `memory_logger.py` sends selected frames to Gemini Vision → SQLite insert
7. `query_agent.py` answers user questions from memory log
8. `alert_agent.py` checks for proactive reminders every 2 min
9. `voice_output.py` speaks answers via ElevenLabs TTS

## Key Decisions

- **SQLite** for storage — single-writer, timestamped inserts, zero-config
- **Gemini 1.5 Flash** for all LLM calls (selection, vision logging, queries)
- **ElevenLabs** dual use: Scribe v2 (STT) + eleven_turbo_v2 (TTS)
- **YOLOv8 nano** for speed — `yolov8n.pt`
- **Flask** for the API server (port 8000)
- **Next.js 14+ App Router** with TypeScript + Tailwind for frontend

## Project Structure

```
Recall/
├── CLAUDE.md
├── Arduino/
│   ├── camera_stream/camera_stream.ino   # ESP32-S3 MJPEG server
│   └── audio_stream/audio_stream.ino     # ESP32-WROOM I2S mic → TCP
├── Backend/
│   ├── main.py              # Entry point — init, wire callbacks, start threads
│   ├── config.py            # All constants, API keys, IPs, ports (gitignored)
│   ├── config.example.py    # Template — copy to config.py and fill in keys
│   ├── video_capture.py     # MJPEG stream reader, 15-frame buffer
│   ├── audio_capture.py     # TCP server for PCM audio, 30s chunks
│   ├── transcriber.py       # ElevenLabs Scribe v2 STT
│   ├── yolo_tagger.py       # YOLOv8 nano object detection
│   ├── gemini_selector.py   # Pick 2-3 important frames per batch
│   ├── memory_logger.py     # Gemini Vision descriptions → SQLite
│   ├── query_agent.py       # Answer questions from memory log
│   ├── alert_agent.py       # Proactive reminders (2 min loop)
│   ├── voice_output.py      # ElevenLabs TTS wrapper
│   ├── api_server.py        # Flask/FastAPI: /query, /memories, /status
│   └── requirements.txt
└── Frontend/
    ├── package.json
    ├── next.config.js
    ├── tsconfig.json
    ├── tailwind.config.ts
    ├── postcss.config.js
    ├── public/
    └── src/app/
        ├── layout.tsx
        ├── page.tsx          # Main chat interface
        ├── globals.css
        └── components/
            ├── ChatWindow.tsx
            ├── MemoryTimeline.tsx
            └── StatusBar.tsx
```

## Hardware

| Device | Role | Connection |
|--------|------|------------|
| ESP32-S3-N16R8 | Camera (OV2640), MJPEG stream | WiFi, port 80 `/stream` |
| ESP32-WROOM-32E | Mic (INMP441), PCM stream | WiFi, TCP port 5001 |

### INMP441 Wiring (to WROOM-32E)

```
VDD→3.3V  GND→GND  SCK→GPIO14  WS→GPIO15  SD→GPIO32  L/R→GND
```

## Build & Run

### Backend

```bash
cd Backend
cp config.example.py config.py   # then fill in your API keys
pip install -r requirements.txt
python main.py
```

### Frontend

```bash
cd Frontend
npm install
npm run dev
```

### Arduino

- ESP32-S3 board: "ESP32S3 Dev Module" — flash `Arduino/camera_stream/camera_stream.ino`
- ESP32-WROOM board: "ESP32 Dev Module" — flash `Arduino/audio_stream/audio_stream.ino`
- Both connect to same WiFi as laptop

## API Endpoints

- `POST /query` — `{"question": "..."}` → `{"answer": "..."}`
- `GET /memories` — recent memories as JSON
- `GET /status` — pipeline health (camera, mic, memory count)

## SQLite Schema

```sql
CREATE TABLE memories (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    timestamp REAL NOT NULL,
    summary TEXT NOT NULL,
    objects TEXT,
    transcript TEXT,
    created_at REAL DEFAULT (strftime('%s','now'))
);
CREATE INDEX idx_timestamp ON memories(timestamp);
```

## Config Constants (Backend/config.py)

- `FRAME_BATCH_SIZE = 15` — frames per selector call
- `AUDIO_CHUNK_SECONDS = 30` — seconds per transcription
- `SAMPLE_RATE = 16000` — 16kHz mono
- `YOLO_CONFIDENCE = 0.4`
- `MEMORY_RETENTION_HOURS = 24`

## Troubleshooting

| Problem | Fix |
|---------|-----|
| ESP32-S3 won't flash | Hold BOOT during Upload |
| No video stream | Check Serial for IP, same WiFi |
| YOLO slow | Use yolov8n.pt, reduce to QVGA |
| Gemini rate limit | Add sleep(1) between calls, use Flash |
| SQLite locked | Use threading.Lock for writes |
