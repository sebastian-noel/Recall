import cv2
import socket
import time
import threading
import numpy as np
import urllib.request
from collections import deque
from config import ESP32_S3_IP, ESP32_S3_FRAME_URL, ESP32_S3_STREAM_URL, FRAME_BATCH_SIZE, USE_WEBCAM_FALLBACK


class VideoCapture:
    def __init__(self, on_batch_ready=None):
        self.on_batch_ready = on_batch_ready
        self.buffer = deque(maxlen=FRAME_BATCH_SIZE)
        self.latest_frame = None
        self.running = False
        self._thread = None
        self._frame_count = 0
        self._source = None  # "esp32"

    def start(self):
        self.running = True
        self._thread = threading.Thread(target=self._capture_loop, daemon=True)
        self._thread.start()

    def stop(self):
        self.running = False

    def get_latest_frame(self):
        return self.latest_frame

    def _esp32_reachable(self):
        try:
            s = socket.create_connection((ESP32_S3_IP, 80), timeout=2)
            s.close()
            return True
        except OSError:
            return False

    def _fetch_frame_http(self):
        """Fetch a single JPEG frame via the /frame endpoint."""
        try:
            with urllib.request.urlopen(ESP32_S3_FRAME_URL, timeout=3) as resp:
                jpg_bytes = resp.read()
            arr = np.frombuffer(jpg_bytes, dtype=np.uint8)
            return cv2.imdecode(arr, cv2.IMREAD_COLOR)
        except Exception:
            return None

    def _capture_loop(self):
        while self.running:
            if self._esp32_reachable():
                self._source = "esp32"
                print(f"[VideoCapture] ESP32 reachable, connecting to stream...")
                self._run_stream(ESP32_S3_STREAM_URL)
            elif USE_WEBCAM_FALLBACK:
                self._source = "webcam"
                print("[VideoCapture] ESP32 unreachable, falling back to webcam...")
                self._run_stream(0)
            else:
                self._source = None
                print(f"[VideoCapture] ESP32 unreachable, retrying in 3s...")
                time.sleep(3)

    def _run_stream(self, source):
        cap = cv2.VideoCapture(source)
        if not cap.isOpened():
            print(f"[VideoCapture] Cannot open source: {source}")
            time.sleep(3)
            return

        print(f"[VideoCapture] Connected to {source}")

        while self.running and cap.isOpened():
            # If on ESP32, periodically check it's still reachable
            if self._source == "webcam" and self._frame_count % 50 == 0 and self._esp32_reachable():
                print("[VideoCapture] ESP32 back online, switching...")
                cap.release()
                return  # Will reconnect to ESP32 on next loop

            ret, frame = cap.read()
            if not ret:
                print("[VideoCapture] Frame read failed, reconnecting...")
                break

            timestamp = time.time()
            self.latest_frame = frame
            self.buffer.append({"frame": frame, "timestamp": timestamp})
            self._frame_count += 1

            if len(self.buffer) == FRAME_BATCH_SIZE:
                batch = list(self.buffer)
                self.buffer.clear()
                if self.on_batch_ready:
                    threading.Thread(
                        target=self.on_batch_ready,
                        args=(batch,),
                        daemon=True
                    ).start()

        cap.release()
        time.sleep(1)

    @property
    def is_connected(self):
        return self.latest_frame is not None and self.running

    @property
    def source_name(self):
        return self._source or "disconnected"
