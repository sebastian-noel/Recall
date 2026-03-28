import cv2
import time
import threading
from collections import deque
from config import ESP32_S3_STREAM_URL, FRAME_BATCH_SIZE


class VideoCapture:
    def __init__(self, on_batch_ready=None):
        self.stream_url = ESP32_S3_STREAM_URL
        self.buffer = deque(maxlen=FRAME_BATCH_SIZE)
        self.on_batch_ready = on_batch_ready
        self.latest_frame = None
        self.running = False
        self._thread = None
        self._frame_count = 0

    def start(self):
        self.running = True
        self._thread = threading.Thread(target=self._capture_loop, daemon=True)
        self._thread.start()

    def stop(self):
        self.running = False

    def get_latest_frame(self):
        return self.latest_frame

    def _capture_loop(self):
        while self.running:
            cap = cv2.VideoCapture(self.stream_url)
            if not cap.isOpened():
                print(f"[VideoCapture] Cannot connect to {self.stream_url}, retrying in 3s...")
                time.sleep(3)
                continue

            print(f"[VideoCapture] Connected to {self.stream_url}")

            while self.running and cap.isOpened():
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
