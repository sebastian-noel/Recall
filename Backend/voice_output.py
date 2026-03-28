import threading
from elevenlabs import ElevenLabs
from elevenlabs import play
from config import ELEVENLABS_API_KEY, ELEVENLABS_VOICE_ID


class VoiceOutput:
    def __init__(self):
        self.client = ElevenLabs(api_key=ELEVENLABS_API_KEY)
        self._lock = threading.Lock()

    def speak(self, text: str):
        """Speak text via ElevenLabs TTS in a background thread."""
        threading.Thread(target=self._speak, args=(text,), daemon=True).start()

    def _speak(self, text: str):
        with self._lock:
            try:
                audio = self.client.text_to_speech.convert(
                    voice_id=ELEVENLABS_VOICE_ID,
                    text=text,
                    model_id="eleven_turbo_v2",
                )
                play(audio)
            except Exception as e:
                print(f"[VoiceOutput] Error: {e}")
