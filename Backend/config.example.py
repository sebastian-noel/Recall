# Copy this file to config.py and fill in your values:
#   cp config.example.py config.py

# ==================== Hardware ====================
ESP32_S3_IP = "172.20.10.3"          # Camera ESP32 — check Serial Monitor after flashing
ESP32_S3_STREAM_URL = f"http://{ESP32_S3_IP}/stream"
ESP32_S3_FRAME_URL  = f"http://{ESP32_S3_IP}/frame"
ESP32_WROOM_IP = "172.20.10.12"      # Audio ESP32 — check Serial Monitor after flashing
ESP32_WROOM_AUDIO_PORT = 5001
ESP32_WROOM_TRANSCRIPT_URL = f"http://{ESP32_WROOM_IP}/transcript"
USE_WEBCAM_FALLBACK = True           # Fall back to laptop webcam if ESP32 unreachable

# ==================== API Keys ====================
GEMINI_API_KEY = ""       # https://aistudio.google.com/app/apikey
ELEVENLABS_API_KEY = ""   # https://elevenlabs.io/app/settings/api-keys
ELEVENLABS_VOICE_ID = ""  # From ElevenLabs voice dashboard

# ==================== Pipeline ====================
FRAME_BATCH_SIZE = 15
AUDIO_CHUNK_SECONDS = 30
SAMPLE_RATE = 16000
YOLO_MODEL = "yolov8n.pt"
YOLO_CONFIDENCE = 0.4

# ==================== Memory ====================
DB_PATH = "memory.db"
MEMORY_RETENTION_HOURS = 24

# ==================== Server ====================
API_PORT = 8000
