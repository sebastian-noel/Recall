import time
from google import genai
from config import GEMINI_API_KEY
from memory_logger import MemoryLogger

client = genai.Client(api_key=GEMINI_API_KEY)
MODEL = "gemini-2.5-flash"


class QueryAgent:
    def __init__(self, memory_logger: MemoryLogger, voice_output=None):
        self.memory_logger = memory_logger
        self.voice_output = voice_output

    def answer(self, question: str) -> str:
        """Answer a user's question using semantic search over the memory log."""
        # Semantic search for the most relevant memories
        relevant = self.memory_logger.search_memories(question, n_results=15)

        # Also get recent memories for time context
        recent = self.memory_logger.get_recent_memories(hours=1)

        if not relevant and not recent:
            reply = "I don't have any memories recorded yet. Give me a few minutes to start logging what I see."
            self._speak(reply)
            return reply

        prompt = self._build_prompt(question, relevant, recent)

        try:
            response = client.models.generate_content(model=MODEL, contents=prompt)
            answer = response.text.strip()
            print(f"[QueryAgent] Q: {question} → A: {answer[:80]}...")
            self._speak(answer)
            return answer
        except Exception as e:
            print(f"[QueryAgent] Error: {e}")
            reply = "I'm having trouble thinking right now. Please try again in a moment."
            self._speak(reply)
            return reply

    def _build_prompt(self, question, relevant, recent):
        lines = [
            "You are Recall, a kind and helpful memory assistant for someone who may have cognitive impairment.",
            "You have access to a log of what the user has seen and done recently.",
            "Answer their question using ONLY the information in the memories below.",
            "Be specific about locations and times. Keep your answer to 2-3 sentences.",
            "If you're not sure, say so honestly — don't make things up.",
        ]

        if relevant:
            lines.append("\n=== MOST RELEVANT MEMORIES ===")
            for m in relevant:
                lines.append(f"[{m['time_str']}] {m['summary']}")
                if m.get("objects"):
                    lines.append(f"  Objects: {m['objects']}")

        if recent:
            lines.append("\n=== RECENT MEMORIES (last hour) ===")
            seen = {m["summary"] for m in relevant} if relevant else set()
            for m in recent[:10]:
                if m["summary"] in seen:
                    continue
                t = time.strftime("%I:%M %p", time.localtime(m["timestamp"]))
                lines.append(f"[{t}] {m['summary']}")
                if m.get("objects"):
                    lines.append(f"  Objects: {m['objects']}")
                if m.get("transcript"):
                    lines.append(f"  Speech: \"{m['transcript']}\"")

        lines.append(f"\n=== QUESTION ===\n{question}")
        return "\n".join(lines)

    def _speak(self, text):
        if self.voice_output:
            self.voice_output.speak(text)
