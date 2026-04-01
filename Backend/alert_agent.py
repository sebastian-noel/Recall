import time
import threading
from google import genai
from config import GEMINI_API_KEY
from memory_logger import MemoryLogger

client = genai.Client(api_key=GEMINI_API_KEY)
MODEL = "gemini-2.5-flash"

ALERT_INTERVAL = 120      # Check every 2 minutes
ALERT_COOLDOWN = 300      # 5 minutes between alerts


class AlertAgent:
    def __init__(self, memory_logger: MemoryLogger, voice_output=None):
        self.memory_logger = memory_logger
        self.voice_output = voice_output
        self.running = False
        self._thread = None
        self._last_alert_time = 0

    def start(self):
        self.running = True
        self._thread = threading.Thread(target=self._loop, daemon=True)
        self._thread.start()

    def stop(self):
        self.running = False

    def _loop(self):
        print("[AlertAgent] Started")
        while self.running:
            time.sleep(ALERT_INTERVAL)
            if time.time() - self._last_alert_time < ALERT_COOLDOWN:
                continue
            self._check_for_alerts()

    def _check_for_alerts(self):
        memories = self.memory_logger.get_recent_memories(hours=1)
        if not memories:
            return

        prompt = self._build_prompt(memories)

        try:
            response = client.models.generate_content(model=MODEL, contents=prompt)
            text = response.text.strip()

            if text.upper().startswith("NONE"):
                return

            print(f"[AlertAgent] Alert: {text[:80]}...")
            self._last_alert_time = time.time()
            if self.voice_output:
                self.voice_output.speak(text)

        except Exception as e:
            print(f"[AlertAgent] Error: {e}")

    def _build_prompt(self, memories):
        lines = [
            "You are a proactive memory assistant for someone with cognitive impairment.",
            "Review the recent memory log and determine if there's anything important to remind the user about.",
            "",
            "Alert-worthy situations:",
            "- Objects left in unusual or hard-to-find places",
            "- Tasks that were started but not completed",
            "- Safety concerns (stove left on, door unlocked)",
            "- Items the user seemed to be looking for",
            "",
            "If nothing needs an alert, respond with exactly: NONE",
            "Otherwise, give a brief, gentle reminder (1-2 sentences).",
            "",
            "=== RECENT MEMORIES (last hour) ===",
        ]

        for m in memories:
            t = time.strftime("%I:%M %p", time.localtime(m["timestamp"]))
            lines.append(f"[{t}] {m['summary']}")

        return "\n".join(lines)
