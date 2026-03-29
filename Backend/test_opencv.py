import cv2

ESP32_STREAM_URL = "http://172.20.10.3/stream"  # update if IP changes


def test_esp32():
    print("Testing ESP32 stream...")
    cap = cv2.VideoCapture(ESP32_STREAM_URL)
    if not cap.isOpened():
        print("FAILED: Could not connect to ESP32 stream")
        return False

    ret, frame = cap.read()
    if not ret or frame is None:
        print("FAILED: Connected but could not read a frame")
        cap.release()
        return False

    print(f"OK: Got frame from ESP32 — shape {frame.shape}")
    cv2.imwrite("test_esp32_frame.jpg", frame)
    print("Saved frame to test_esp32_frame.jpg")
    cap.release()
    return True


def test_webcam():
    print("Testing laptop webcam...")
    cap = cv2.VideoCapture(0)
    if not cap.isOpened():
        print("FAILED: Could not open webcam")
        return False

    ret, frame = cap.read()
    if not ret or frame is None:
        print("FAILED: Webcam opened but could not read a frame")
        cap.release()
        return False

    print(f"OK: Got frame from webcam — shape {frame.shape}")
    cv2.imwrite("test_webcam_frame.jpg", frame)
    print("Saved frame to test_webcam_frame.jpg")
    cap.release()
    return True


if __name__ == "__main__":
    esp32_ok = test_esp32()
    if not esp32_ok:
        print("\nESP32 failed, falling back to webcam...")
        test_webcam()
