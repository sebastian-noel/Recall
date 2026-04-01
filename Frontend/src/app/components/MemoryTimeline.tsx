"use client";

import { useState, useEffect, useRef } from "react";

interface Memory {
  id: number;
  timestamp: number;
  summary: string;
  objects: string | null;
}

interface MoodEntry {
  memory_id: number;
  mood: string;
  timestamp: number;
}

const MOODS = ["😊", "😐", "😔", "😤", "😰"] as const;

const MOOD_LABELS: Record<string, string> = {
  "😊": "Good",
  "😐": "Neutral",
  "😔": "Down",
  "😤": "Frustrated",
  "😰": "Anxious",
};

// Mood picker

function MoodPicker({
  memoryId,
  current,
  onSelect,
}: {
  memoryId: number;
  current: string | null;
  onSelect: (mood: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen((o) => !o)}
        title="Tag mood"
        className={`text-xs transition-all rounded px-1 py-0.5 hover:bg-white/5 ${
          current ? "opacity-100" : "opacity-30 hover:opacity-60"
        }`}
      >
        {current ?? "🙂"}
      </button>

      {open && (
        <div
          className="absolute bottom-full right-0 mb-1 fade-in glass rounded-xl border p-2 flex gap-1 z-50"
          style={{ borderColor: "rgba(255,255,255,0.1)" }}
        >
          {MOODS.map((m) => (
            <button
              key={m}
              title={MOOD_LABELS[m]}
              onClick={() => { onSelect(m); setOpen(false); }}
              className={`text-base w-8 h-8 rounded-lg transition-all hover:bg-white/10 ${
                current === m ? "bg-recall-500/20 ring-1 ring-recall-500/40" : ""
              }`}
            >
              {m}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// Memory card

function MemoryCard({
  memory,
  mood,
  onMood,
}: {
  memory: Memory;
  mood: string | null;
  onMood: (memoryId: number, mood: string) => void;
}) {
  const time = new Date(memory.timestamp * 1000);
  const timeStr = time.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", hour12: false });
  const objects = memory.objects ? memory.objects.split(", ").filter(Boolean) : [];

  return (
    <div className="fade-in relative flex gap-3 pb-4">
      {/* Timeline stem */}
      <div className="flex flex-col items-center flex-shrink-0 w-8">
        <div className="w-2 h-2 rounded-full bg-recall-400 glow-cyan-sm mt-1 relative z-10" />
        <div className="w-px flex-1 bg-gradient-to-b from-recall-500/40 to-transparent mt-1" />
      </div>

      {/* Card */}
      <div className="flex-1 glass rounded-lg p-3 mb-1 hover:bg-white/[0.06] transition-colors">
        {/* Card header */}
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <span className="font-mono text-[10px] text-recall-400 tracking-widest">{timeStr}</span>
            <span className="text-slate-700 text-[10px]">·</span>
            <span className="font-mono text-[10px] text-slate-600 tracking-wider">
              MEM-{String(memory.id).padStart(4, "0")}
            </span>
          </div>
          <MoodPicker
            memoryId={memory.id}
            current={mood}
            onSelect={(m) => onMood(memory.id, m)}
          />
        </div>

        <p className="text-xs text-slate-300 leading-relaxed">{memory.summary}</p>

        {/* Object tags + mood label */}
        <div className="flex flex-wrap gap-1 mt-2 items-center">
          {objects.slice(0, 4).map((obj, i) => (
            <span
              key={i}
              className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-recall-500/10 text-recall-400 border border-recall-500/20"
            >
              {obj}
            </span>
          ))}
          {objects.length > 4 && (
            <span className="text-[10px] font-mono text-slate-600">+{objects.length - 4}</span>
          )}
          {mood && (
            <span className="ml-auto text-[10px] font-mono text-slate-600">
              {mood} {MOOD_LABELS[mood]}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

// Main component

export default function MemoryTimeline() {
  const [memories, setMemories] = useState<Memory[]>([]);
  const [moodMap, setMoodMap] = useState<Record<number, string>>({});
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);

  // Load moods from sessionStorage
  useEffect(() => {
    try {
      const stored = sessionStorage.getItem("recall_moods");
      if (stored) {
        const entries: MoodEntry[] = JSON.parse(stored);
        const map: Record<number, string> = {};
        entries.forEach((e) => { map[e.memory_id] = e.mood; });
        setMoodMap(map);
      }
    } catch { /* ignore */ }
  }, []);

  // Fetch memories on mount and every 10s
  useEffect(() => {
    const fetchMemories = async () => {
      try {
        const res = await fetch("/api/memories");
        const data = await res.json();
        setMemories(data.memories || []);
        setLastUpdate(new Date());
      } catch { /* backend offline */ }
    };
    fetchMemories();
    const id = setInterval(fetchMemories, 10000);
    return () => clearInterval(id);
  }, []);

  const handleMood = (memoryId: number, mood: string) => {
    const updated = { ...moodMap, [memoryId]: mood };
    setMoodMap(updated);

    // Persist to sessionStorage
    const entries: MoodEntry[] = Object.entries(updated).map(([id, m]) => ({
      memory_id: Number(id),
      mood: m,
      timestamp: Date.now() / 1000,
    }));
    try { sessionStorage.setItem("recall_moods", JSON.stringify(entries)); } catch { /* ignore */ }

    // Fire-and-forget to backend (graceful fail if endpoint not implemented yet)
    fetch("/api/mood", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ memory_id: memoryId, mood }),
    }).catch(() => { /* backend endpoint optional */ });
  };

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b" style={{ borderColor: "rgba(255,255,255,0.06)" }}>
        <div>
          <h2 className="text-xs font-mono font-medium tracking-[0.15em] text-slate-400 uppercase">Memory Log</h2>
          {lastUpdate && (
            <p className="text-[10px] font-mono text-slate-700 mt-0.5">
              {lastUpdate.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false })}
            </p>
          )}
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-1.5 h-1.5 rounded-full bg-recall-400 animate-pulse" />
          <span className="text-[10px] font-mono text-recall-500">LIVE</span>
        </div>
      </div>

      {/* Memory cards */}
      <div className="flex-1 overflow-y-auto px-4 pt-4">
        {memories.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-48 text-center">
            <div className="w-10 h-10 rounded-full border border-white/10 flex items-center justify-center mb-3">
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                <circle cx="8" cy="8" r="6" stroke="#334155" strokeWidth="1" />
                <path d="M8 5v3l2 2" stroke="#334155" strokeWidth="1" strokeLinecap="round" />
              </svg>
            </div>
            <p className="text-xs text-slate-700 font-mono">No memories yet</p>
            <p className="text-[10px] text-slate-800 mt-1">Waiting for input stream...</p>
          </div>
        ) : (
          memories.map((m) => (
            <MemoryCard
              key={m.id}
              memory={m}
              mood={moodMap[m.id] ?? null}
              onMood={handleMood}
            />
          ))
        )}
      </div>
    </div>
  );
}
