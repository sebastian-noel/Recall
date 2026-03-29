import cv2
import json
import socket
import threading
import time
import urllib.request
import numpy as np
from ultralytics import YOLO
from config import (
    ESP32_S3_IP, ESP32_S3_FRAME_URL, ESP32_WROOM_TRANSCRIPT_URL,
    YOLO_MODEL, YOLO_CONFIDENCE,
)

TRANSCRIPT_URL      = ESP32_WROOM_TRANSCRIPT_URL
LOG_FILE            = "recall_log.json"
CONFIDENCE          = YOLO_CONFIDENCE
FRAME_INTERVAL      = 1   # seconds between frame grabs
TRANSCRIPT_INTERVAL = 60  # seconds between transcript windows
TRANSCRIPT_WAIT_MAX = 10  # max seconds to wait for new transcript


def esp32_reachable():
    try:
        s = socket.create_connection((ESP32_S3_IP, 80), timeout=1)
        s.close()
        return True
    except OSError:
        return False


def fetch_frame():
    try:
        with urllib.request.urlopen(ESP32_S3_FRAME_URL, timeout=3) as resp:
            jpg_bytes = resp.read()
        arr = np.frombuffer(jpg_bytes, dtype=np.uint8)
        return cv2.imdecode(arr, cv2.IMREAD_COLOR)
    except Exception as e:
        print(f"[fetch_frame] Error: {e}")
        return None


def fetch_transcript():
    """Fetch transcript JSON from audio ESP. Returns dict or None."""
    try:
        with urllib.request.urlopen(TRANSCRIPT_URL, timeout=3) as resp:
            return json.loads(resp.read().decode())
    except Exception as e:
        print(f"[fetch_transcript] Error: {e}")
        return None


def run_yolo(model, frame):
    """Run YOLO, return list of 'N label' strings."""
    results = model(frame, conf=CONFIDENCE, verbose=False)
    counts = {}
    for r in results:
        for box in r.boxes:
            name = model.names[int(box.cls[0])]
            counts[name] = counts.get(name, 0) + 1
    return [f"{count} {name}" for name, count in sorted(counts.items())]


def wait_for_new_transcript(last_index):
      """Poll until index increments or TRANSCRIPT_WAIT_MAX exceeded."""
      deadline = time.time() + TRANSCRIPT_WAIT_MAX                                                                                                                                                         
      data = None                                                                                                                                                                                          
      while time.time() < deadline:                                                                                                                                                                        
          data = fetch_transcript()                                                                                                                                                                        
          if data and data.get("index", -1) > last_index:
              print(f"[Transcript] New transcript received (index {data['index']})")                                                                                                                       
              return data                                                                                                                                                                                  
          time.sleep(1)  
      print(f"[Transcript] Timed out waiting — using latest available")                                                                                                                                    
      return data if data else {"text": "", "index": last_index, "timestamp": None}


def write_log(timestamp_str, transcript_text, frame_results):
    """Append one log entry to recall_log.json."""
    entry = {
        "time": timestamp_str,
        "transcript": transcript_text,
        "frames": {f"Frame {i+1}": tags for i, tags in enumerate(frame_results)}
    }
    with open(LOG_FILE, "a") as f:
        f.write(json.dumps(entry) + "\n")
    print(f"[Log] Written: {timestamp_str} | {len(frame_results)} frames | transcript: {transcript_text[:60]}...")


if __name__ == "__main__":
    if not esp32_reachable():
        print("ESP32 unreachable — check IP and WiFi")
        exit(1)

    print(f"Loading {YOLO_MODEL}...")
    model = YOLO(YOLO_MODEL)
    print("Model loaded. Press Q in the window to quit.\n")

    cv2.namedWindow("Recall — Live Frame", cv2.WINDOW_NORMAL)

    frame_results = []
    last_index = -1
    window_start = time.time()

    while True:
        frame = fetch_frame()
        if frame is None:
            print("Failed to fetch frame, retrying...")
            time.sleep(FRAME_INTERVAL)
            continue

        cv2.imshow("Recall — Live Frame", frame)

        def yolo_and_store(f):
            tags = run_yolo(model, f)
            frame_results.append(tags)
            if tags:
                print(f"[YOLO] {', '.join(tags)}")
            else:
                print("[YOLO] Detected: nothing")

        threading.Thread(target=yolo_and_store, args=(frame.copy(),), daemon=True).start()

        if time.time() - window_start >= TRANSCRIPT_INTERVAL:
            print(f"[Sync] {TRANSCRIPT_INTERVAL}s window done — waiting for transcript...")
            timestamp_str = time.strftime("%I:%M:%S %p")

            result = wait_for_new_transcript(last_index)                                                                                                                                                             
            transcript_text = result.get("text", "") if result else ""                                                                                                                                               
            last_index = result.get("index", last_index) if result else last_index 
            print(f"[Transcript] Full text: '{transcript_text}'")

            write_log(timestamp_str, transcript_text, list(frame_results))

            frame_results.clear()
            window_start = time.time()

        if cv2.waitKey(FRAME_INTERVAL * 1000) & 0xFF == ord('q'):
            print("Closed by user.")
            break

    cv2.destroyAllWindows()