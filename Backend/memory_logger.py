import cv2
import io
import time
import sqlite3
import threading
from google import genai
from google.genai import types
from PIL import Image
import numpy as np
from config import GEMINI_API_KEY, DB_PATH, MEMORY_RETENTION_HOURS

client = genai.Client(api_key=GEMINI_API_KEY)
MODEL = "gemini-2.5-flash"


class MemoryLogger:
    def __init__(self):
        self._lock = threading.Lock()
        self._init_db()

    def _init_db(self):
        with self._lock:
            conn = sqlite3.connect(DB_PATH)
            conn.execute("""
                CREATE TABLE IF NOT EXISTS memories (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    timestamp REAL NOT NULL,
                    summary TEXT NOT NULL,
                    objects TEXT,
                    transcript TEXT,
                    created_at REAL DEFAULT (strftime('%s','now'))
                )
            """)
            conn.execute("CREATE INDEX IF NOT EXISTS idx_timestamp ON memories(timestamp)")
            conn.commit()
            conn.close()

    def log_frame(self, frame, timestamp, tags, transcript=""):
        """Send frame to Gemini Vision for description, store in SQLite."""
        try:
            # Convert OpenCV BGR to JPEG bytes
            _, jpeg_buf = cv2.imencode(".jpg", frame)
            image_bytes = jpeg_buf.tobytes()

            prompt = (
                "You are a memory assistant for someone with cognitive impairment. "
                "Describe this scene in 2-3 factual sentences. Focus on: "
                "object locations, actions being performed, spatial context. "
                "Be specific about WHERE things are (e.g., 'keys on the kitchen counter next to the toaster')."
            )

            response = client.models.generate_content(
                model=MODEL,
                contents=[
                    types.Part.from_bytes(data=image_bytes, mime_type="image/jpeg"),
                    prompt,
                ],
            )
            summary = response.text.strip()

            time.sleep(0.5)  # Rate limiting

            self._insert_memory(timestamp, summary, tags, transcript)
            print(f"[MemoryLogger] Logged: {summary[:80]}...")
            return summary

        except Exception as e:
            print(f"[MemoryLogger] Error: {e}")
            return None

    def log_selected_frames(self, tagged_frames, selected_indices, transcript=""):
        """Log the selected frames from a batch."""
        for idx in selected_indices:
            if idx < len(tagged_frames):
                item = tagged_frames[idx]
                self.log_frame(
                    item["frame"],
                    item["timestamp"],
                    item["tags"],
                    transcript
                )

    def _insert_memory(self, timestamp, summary, tags, transcript):
        objects_str = ", ".join(tags) if tags else None
        with self._lock:
            conn = sqlite3.connect(DB_PATH)
            conn.execute(
                "INSERT INTO memories (timestamp, summary, objects, transcript) VALUES (?, ?, ?, ?)",
                (timestamp, summary, objects_str, transcript or None)
            )
            conn.commit()
            conn.close()

    def get_recent_memories(self, hours=None):
        """Retrieve recent memories."""
        if hours is None:
            hours = MEMORY_RETENTION_HOURS
        cutoff = time.time() - (hours * 3600)
        with self._lock:
            conn = sqlite3.connect(DB_PATH)
            conn.row_factory = sqlite3.Row
            rows = conn.execute(
                "SELECT * FROM memories WHERE timestamp >= ? ORDER BY timestamp DESC",
                (cutoff,)
            ).fetchall()
            conn.close()
        return [dict(row) for row in rows]

    def prune_old_memories(self):
        """Remove memories older than retention period."""
        cutoff = time.time() - (MEMORY_RETENTION_HOURS * 3600)
        with self._lock:
            conn = sqlite3.connect(DB_PATH)
            conn.execute("DELETE FROM memories WHERE timestamp < ?", (cutoff,))
            conn.commit()
            conn.close()

    def get_memory_count(self):
        with self._lock:
            conn = sqlite3.connect(DB_PATH)
            count = conn.execute("SELECT COUNT(*) FROM memories").fetchone()[0]
            conn.close()
        return count
