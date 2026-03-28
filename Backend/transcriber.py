import io
import time
import wave
import numpy as np
from collections import deque
from elevenlabs import ElevenLabs
from config import ELEVENLABS_API_KEY, SAMPLE_RATE


class Transcriber:
    def __init__(self):
        self.client = ElevenLabs(api_key=ELEVENLABS_API_KEY)
        self.transcripts = deque(maxlen=100)

    def transcribe(self, audio_chunk: np.ndarray):
        """Transcribe an audio chunk (int16 numpy array) using ElevenLabs Scribe v2."""
        try:
            wav_bytes = self._to_wav(audio_chunk)
            result = self.client.speech_to_text.convert(
                file=wav_bytes,
                model_id="scribe_v2",
                tag_audio_events=False,
            )
            text = result.text.strip()
            if text:
                self.transcripts.append({
                    "text": text,
                    "timestamp": time.time()
                })
                print(f"[Transcriber] '{text[:80]}...'")
            return text
        except Exception as e:
            print(f"[Transcriber] Error: {e}")
            return ""

    def get_recent_transcript(self, seconds=60):
        """Return concatenated transcript text from the last N seconds."""
        cutoff = time.time() - seconds
        texts = [t["text"] for t in self.transcripts if t["timestamp"] >= cutoff]
        return " ".join(texts)

    def _to_wav(self, audio: np.ndarray) -> bytes:
        """Convert int16 numpy array to WAV bytes."""
        buf = io.BytesIO()
        with wave.open(buf, "wb") as wf:
            wf.setnchannels(1)
            wf.setsampwidth(2)  # 16-bit
            wf.setframerate(SAMPLE_RATE)
            wf.writeframes(audio.tobytes())
        buf.seek(0)
        return buf.read()
