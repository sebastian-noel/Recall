from ultralytics import YOLO
from config import YOLO_MODEL, YOLO_CONFIDENCE


class YOLOTagger:
    def __init__(self):
        self.model = YOLO(YOLO_MODEL)
        print(f"[YOLOTagger] Loaded {YOLO_MODEL}")

    def tag_frame(self, frame):
        """Run YOLO on a single frame, return deduplicated class names."""
        results = self.model(frame, conf=YOLO_CONFIDENCE, verbose=False)
        names = set()
        for r in results:
            for box in r.boxes:
                cls_id = int(box.cls[0])
                names.add(self.model.names[cls_id])
        return sorted(names)

    def tag_batch(self, frames):
        """Tag all frames in a batch using a single inference pass.

        Args:
            frames: list of {"frame": np.array, "timestamp": float}

        Returns:
            list of {"frame": np.array, "timestamp": float, "tags": list[str]}
        """
        images = [item["frame"] for item in frames]
        results = self.model(images, conf=YOLO_CONFIDENCE, verbose=False)
        tagged = []
        for item, r in zip(frames, results):
            tags = sorted({self.model.names[int(box.cls[0])] for box in r.boxes})
            tagged.append({
                "frame": item["frame"],
                "timestamp": item["timestamp"],
                "tags": tags,
            })
        return tagged
