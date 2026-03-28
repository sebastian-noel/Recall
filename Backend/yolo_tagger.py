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
        """Tag all frames in a batch.

        Args:
            frames: list of {"frame": np.array, "timestamp": float}

        Returns:
            list of {"frame": np.array, "timestamp": float, "tags": list[str]}
        """
        tagged = []
        for item in frames:
            tags = self.tag_frame(item["frame"])
            tagged.append({
                "frame": item["frame"],
                "timestamp": item["timestamp"],
                "tags": tags,
            })
        return tagged
