import time
import google.generativeai as genai
from config import GEMINI_API_KEY

genai.configure(api_key=GEMINI_API_KEY)


class GeminiSelector:
    def __init__(self):
        self.model = genai.GenerativeModel("gemini-1.5-flash")

    def select_frames(self, tagged_frames, transcript=""):
        """Select 2-3 most important frame indices from a batch of tagged frames.

        Args:
            tagged_frames: list of {"frame", "timestamp", "tags"} dicts
            transcript: recent transcript text for context

        Returns:
            list of int indices into tagged_frames
        """
        prompt = self._build_prompt(tagged_frames, transcript)

        try:
            response = self.model.generate_content(prompt)
            indices = self._parse_response(response.text, len(tagged_frames))
            print(f"[GeminiSelector] Selected frames: {indices}")
            return indices
        except Exception as e:
            print(f"[GeminiSelector] Error: {e}, using fallback")
            return self._fallback_indices(len(tagged_frames))

    def _build_prompt(self, tagged_frames, transcript):
        lines = [
            "You are selecting which video frames are worth logging for a memory assistant.",
            "The user wears smart glasses that capture frames continuously.",
            "Pick 2-3 frame indices (0-based) that are most worth remembering.",
            "",
            "Prioritize:",
            "- User interacting with objects (picking up, putting down, opening, closing)",
            "- Location changes or new environments",
            "- Task completions or important actions",
            "- Moments relevant to what the user is saying",
            "",
            "Frames:",
        ]

        for i, f in enumerate(tagged_frames):
            tags_str = ", ".join(f["tags"]) if f["tags"] else "nothing detected"
            lines.append(f"  Frame {i}: [{tags_str}]")

        if transcript:
            lines.append(f"\nRecent speech: \"{transcript}\"")

        lines.append("\nRespond with ONLY comma-separated frame indices (e.g., '2, 7, 13'). Nothing else.")
        return "\n".join(lines)

    def _parse_response(self, text, num_frames):
        indices = []
        for part in text.strip().split(","):
            part = part.strip()
            try:
                idx = int(part)
                if 0 <= idx < num_frames:
                    indices.append(idx)
            except ValueError:
                continue

        if not indices:
            return self._fallback_indices(num_frames)
        return indices[:3]

    def _fallback_indices(self, num_frames):
        if num_frames <= 3:
            return list(range(num_frames))
        mid = num_frames // 2
        return [0, mid, num_frames - 1]
