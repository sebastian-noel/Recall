import socket
import time
import threading
import numpy as np
from collections import deque
from config import ESP32_WROOM_AUDIO_PORT, SAMPLE_RATE, AUDIO_CHUNK_SECONDS


class AudioCapture:
    def __init__(self, on_chunk_ready=None):
        self.port = ESP32_WROOM_AUDIO_PORT
        self.on_chunk_ready = on_chunk_ready
        self.running = False
        self._thread = None
        self._connected = False

        max_samples = SAMPLE_RATE * AUDIO_CHUNK_SECONDS
        self.buffer = deque(maxlen=max_samples)
        self._samples_since_callback = 0

    def start(self):
        self.running = True
        self._thread = threading.Thread(target=self._listen_loop, daemon=True)
        self._thread.start()

    def stop(self):
        self.running = False

    def get_recent_audio(self, seconds):
        num_samples = min(SAMPLE_RATE * seconds, len(self.buffer))
        samples = list(self.buffer)[-num_samples:]
        return np.array(samples, dtype=np.int16)

    def _listen_loop(self):
        server = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
        server.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
        server.bind(("0.0.0.0", self.port))
        server.listen(1)
        server.settimeout(2.0)
        print(f"[AudioCapture] Listening on port {self.port}")

        while self.running:
            try:
                conn, addr = server.accept()
                print(f"[AudioCapture] ESP32 connected from {addr}")
                self._connected = True
                self._handle_connection(conn)
            except socket.timeout:
                continue
            except Exception as e:
                print(f"[AudioCapture] Error: {e}")
                time.sleep(1)

        server.close()

    def _handle_connection(self, conn):
        chunk_threshold = SAMPLE_RATE * AUDIO_CHUNK_SECONDS

        try:
            while self.running:
                data = conn.recv(4096)
                if not data:
                    break

                samples = np.frombuffer(data, dtype=np.int16)
                self.buffer.extend(samples)
                self._samples_since_callback += len(samples)

                if self._samples_since_callback >= chunk_threshold:
                    self._samples_since_callback = 0
                    audio_chunk = self.get_recent_audio(AUDIO_CHUNK_SECONDS)
                    if self.on_chunk_ready:
                        threading.Thread(
                            target=self.on_chunk_ready,
                            args=(audio_chunk,),
                            daemon=True
                        ).start()
        except Exception as e:
            print(f"[AudioCapture] Connection error: {e}")
        finally:
            conn.close()
            self._connected = False
            print("[AudioCapture] ESP32 disconnected")

    @property
    def is_connected(self):
        return self._connected
