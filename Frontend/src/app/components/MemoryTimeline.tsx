"use client";

import { useState, useEffect } from "react";

interface Memory {
  id: number;
  timestamp: number;
  summary: string;
  objects: string | null;
}

export default function MemoryTimeline() {
  const [memories, setMemories] = useState<Memory[]>([]);

  const fetchMemories = async () => {
    try {
      const res = await fetch("/api/memories");
      const data = await res.json();
      setMemories(data.memories || []);
    } catch {
      // Backend not running yet
    }
  };

  useEffect(() => {
    fetchMemories();
    const interval = setInterval(fetchMemories, 10000);
    return () => clearInterval(interval);
  }, []);

  const formatTime = (ts: number) =>
    new Date(ts * 1000).toLocaleTimeString([], {
      hour: "numeric",
      minute: "2-digit",
    });

  return (
    <div className="p-4">
      <h2 className="text-lg font-semibold text-recall-800 mb-4">Memory Timeline</h2>

      {memories.length === 0 ? (
        <p className="text-gray-400 text-sm">No memories recorded yet.</p>
      ) : (
        <div className="space-y-3">
          {memories.map((m) => (
            <div
              key={m.id}
              className="border-l-4 border-recall-300 pl-3 py-2"
            >
              <p className="text-xs text-gray-400 mb-1">{formatTime(m.timestamp)}</p>
              <p className="text-sm text-gray-700 leading-relaxed">{m.summary}</p>
              {m.objects && (
                <div className="flex flex-wrap gap-1 mt-1">
                  {m.objects.split(", ").map((obj, i) => (
                    <span
                      key={i}
                      className="text-xs px-2 py-0.5 bg-recall-100 text-recall-700 rounded-full"
                    >
                      {obj}
                    </span>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
