import signal
import sys
import threading

from config import API_PORT
from video_capture import VideoCapture
from audio_capture import AudioCapture
from transcriber import Transcriber
from yolo_tagger import YOLOTagger
from gemini_selector import GeminiSelector
from memory_logger import MemoryLogger
from query_agent import QueryAgent
from alert_agent import AlertAgent
from voice_output import VoiceOutput
import api_server


def main():
    print("=" * 50)
    print("  RECALL — AI Memory Assistant")
    print("=" * 50)

    # Initialize components
    voice_output = VoiceOutput()
    memory_logger = MemoryLogger()
    transcriber = Transcriber()
    yolo_tagger = YOLOTagger()
    gemini_selector = GeminiSelector()
    query_agent = QueryAgent(memory_logger, voice_output)
    alert_agent = AlertAgent(memory_logger, voice_output)

    # Pipeline callback: video batch → YOLO tag → Gemini select → memory log
    def on_video_batch(batch):
        transcript = transcriber.get_recent_transcript(seconds=60)
        tagged = yolo_tagger.tag_batch(batch)
        selected = gemini_selector.select_frames(tagged, transcript)
        memory_logger.log_selected_frames(tagged, selected, transcript)
        memory_logger.prune_old_memories()

    # Pipeline callback: audio chunk → transcribe
    def on_audio_chunk(audio_chunk):
        transcriber.transcribe(audio_chunk)

    # Create capture instances with callbacks
    video_capture = VideoCapture(on_batch_ready=on_video_batch)
    audio_capture = AudioCapture(on_chunk_ready=on_audio_chunk)

    # Wire up the API server
    api_server.init_app(query_agent, memory_logger, video_capture, audio_capture)

    # Start all components
    print("[Main] Starting video capture...")
    video_capture.start()

    print("[Main] Starting audio capture...")
    audio_capture.start()

    print("[Main] Starting alert agent...")
    alert_agent.start()

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
        alert_agent.stop()
        sys.exit(0)

    signal.signal(signal.SIGINT, shutdown)
    signal.signal(signal.SIGTERM, shutdown)

    # Keep main thread alive (signal.pause() is Unix-only)
    while True:
        time.sleep(1)


if __name__ == "__main__":
    main()
