import signal
import sys
import threading
import time
import json
import urllib.request

from config import API_PORT, ESP32_WROOM_TRANSCRIPT_URL
from video_capture import VideoCapture
from audio_capture import AudioCapture
from transcriber import Transcriber
from yolo_tagger import YOLOTagger
from memory_logger import MemoryLogger
from query_agent import QueryAgent
from voice_output import VoiceOutput
import api_server


def fetch_esp32_transcript() -> str:
    """Fetch the latest transcript text from the ESP32 audio device."""
    try:
        with urllib.request.urlopen(ESP32_WROOM_TRANSCRIPT_URL, timeout=2) as resp:
            return json.loads(resp.read().decode()).get("text", "")
    except Exception:
        return ""


def select_best_frames(tagged_frames, n=3):
    """Pick the N frames with the most detected objects (no API call)."""
    scored = [(i, len(f["tags"])) for i, f in enumerate(tagged_frames)]
    scored.sort(key=lambda x: x[1], reverse=True)
    return [i for i, _ in scored[:n]]


def main():
    print("=" * 50)
    print("  RECALL — AI Memory Assistant")
    print("=" * 50)

    # Initialize components
    voice_output = VoiceOutput()
    memory_logger = MemoryLogger()
    transcriber = Transcriber()
    yolo_tagger = YOLOTagger()
    query_agent = QueryAgent(memory_logger, voice_output, transcriber)

    _last_log_time = [0.0]
    LOG_INTERVAL = 15  # seconds between memory logs

    # Pipeline callback: video batch → YOLO tag → select top frames → memory log
    def on_video_batch(batch):
        now = time.time()
        if now - _last_log_time[0] < LOG_INTERVAL:
            return
        _last_log_time[0] = now
        transcript = fetch_esp32_transcript()
        tagged = yolo_tagger.tag_batch(batch)
        selected = select_best_frames(tagged, n=3)
        memory_logger.log_selected_frames(tagged, selected, transcript)
        memory_logger.prune_old_memories()

    # Pipeline callback: audio chunk → transcribe
    def on_audio_chunk(audio_chunk):
        transcriber.transcribe(audio_chunk)

    # Create capture instances with callbacks
    video_capture = VideoCapture(on_batch_ready=on_video_batch)
    audio_capture = AudioCapture(on_chunk_ready=on_audio_chunk)

    # Wire up the API server
    api_server.init_app(query_agent, memory_logger, video_capture, audio_capture, transcriber, voice_output)

    # Start all components
    print("[Main] Starting video capture...")
    video_capture.start()

    print("[Main] Starting audio capture...")
    audio_capture.start()

    print(f"[Main] Starting API server on port {API_PORT}...")
    server_thread = threading.Thread(
        target=api_server.run_server,
        args=(API_PORT,),
        daemon=True
    )
    server_thread.start()

    print("[Main] All systems running. Press Ctrl+C to stop.")

    # Graceful shutdown
    def shutdown(sig, frame):
        print("\n[Main] Shutting down...")
        video_capture.stop()
        audio_capture.stop()
        sys.exit(0)

    signal.signal(signal.SIGINT, shutdown)
    signal.signal(signal.SIGTERM, shutdown)

    # Keep main thread alive
    while True:
        time.sleep(1)


if __name__ == "__main__":
    main()
