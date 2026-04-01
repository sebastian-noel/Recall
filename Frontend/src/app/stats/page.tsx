"use client";

import { useState, useEffect } from "react";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell,
} from "recharts";

interface Memory {
  id: number;
  timestamp: number;
  summary: string;
  objects: string | null;
}

// Helpers

function buildHourlyData(memories: Memory[]) {
  const counts = Array.from({ length: 24 }, (_, h) => ({ hour: h, count: 0 }));
  memories.forEach((m) => {
    const h = new Date(m.timestamp * 1000).getHours();
    counts[h].count++;
  });
  return counts;
}

function buildObjectData(memories: Memory[]) {
  const freq: Record<string, number> = {};
  memories.forEach((m) => {
    if (!m.objects) return;
    m.objects.split(", ").forEach((o) => {
      const key = o.trim().toLowerCase();
      if (key) freq[key] = (freq[key] ?? 0) + 1;
    });
  });
  return Object.entries(freq)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([name, count]) => ({ name, count }));
}

function buildMoodData(moods: MoodEntry[]) {
  const map: Record<string, number> = { "😊": 0, "😐": 0, "😔": 0, "😤": 0, "😰": 0 };
  moods.forEach((m) => { if (m.mood in map) map[m.mood]++; });
  return Object.entries(map).map(([mood, count]) => ({ mood, count }));
}

function activeHours(data: { hour: number; count: number }[]) {
  return data.filter((d) => d.count > 0).length;
}

function peakHour(data: { hour: number; count: number }[]) {
  const max = data.reduce((a, b) => (a.count >= b.count ? a : b));
  if (max.count === 0) return "—";
  return `${String(max.hour).padStart(2, "0")}:00`;
}

function fmtHour(h: number) {
  if (h === 0) return "12a";
  if (h === 12) return "12p";
  return h < 12 ? `${h}a` : `${h - 12}p`;
}

// Types

interface MoodEntry {
  memory_id: number;
  mood: string;
  timestamp: number;
}

// Stat card

function StatCard({ label, value, sub }: { label: string; value: string | number; sub?: string }) {
  return (
    <div className="glass rounded-xl p-4 border" style={{ borderColor: "rgba(255,255,255,0.07)" }}>
      <p className="text-[10px] font-mono text-slate-600 tracking-widest uppercase mb-1">{label}</p>
      <p className="text-2xl font-semibold text-slate-100 tabular-nums">{value}</p>
      {sub && <p className="text-[11px] text-slate-600 mt-0.5 font-mono">{sub}</p>}
    </div>
  );
}

// Custom tooltip

function ChartTooltip({ active, payload, label }: { active?: boolean; payload?: { value: number }[]; label?: string }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="glass rounded-lg px-3 py-2 text-xs font-mono border" style={{ borderColor: "rgba(0,196,240,0.2)" }}>
      <p className="text-recall-400">{label}</p>
      <p className="text-slate-300">{payload[0].value} memories</p>
    </div>
  );
}

function ObjectTooltip({ active, payload }: { active?: boolean; payload?: { value: number }[]; label?: string }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="glass rounded-lg px-3 py-2 text-xs font-mono border" style={{ borderColor: "rgba(0,196,240,0.2)" }}>
      <p className="text-slate-300">{payload[0].value} detections</p>
    </div>
  );
}

// Mood bar (manual, no recharts needed)

function MoodBar({ mood, count, max }: { mood: string; count: number; max: number }) {
  const pct = max === 0 ? 0 : (count / max) * 100;
  return (
    <div className="flex items-center gap-3">
      <span className="text-lg w-6 text-center">{mood}</span>
      <div className="flex-1 h-2 rounded-full bg-white/5 overflow-hidden">
        <div
          className="h-full rounded-full bg-recall-500/60 transition-all duration-700"
          style={{ width: `${pct}%` }}
        />
      </div>
      <span className="text-xs font-mono text-slate-600 w-4 text-right">{count}</span>
    </div>
  );
}

// Main page

export default function StatsPage() {
  const [memories, setMemories] = useState<Memory[]>([]);
  const [moods, setMoods] = useState<MoodEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      try {
        const res = await fetch("/api/memories");
        const data = await res.json();
        setMemories(data.memories || []);
      } catch { /* offline */ }

      // Load moods from sessionStorage (local-first, no backend req)
      try {
        const stored = sessionStorage.getItem("recall_moods");
        if (stored) setMoods(JSON.parse(stored));
      } catch { /* ignore */ }

      setLoading(false);
    };
    load();
  }, []);

  const hourlyData = buildHourlyData(memories);
  const objectData = buildObjectData(memories);
  const moodData = buildMoodData(moods);
  const maxMood = Math.max(...moodData.map((d) => d.count), 1);
  const topObject = objectData[0]?.name ?? "—";
  const totalMoods = moods.length;

  const today = new Date().toLocaleDateString([], { weekday: "long", month: "long", day: "numeric" });

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="flex items-center gap-3 text-sm font-mono text-slate-600">
          <div className="w-4 h-4 border border-recall-500/40 rounded-full animate-spin border-t-recall-500" />
          Loading analytics...
        </div>
      </div>
    );
  }

  return (
    <div className="h-full overflow-y-auto px-8 py-6">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-lg font-semibold text-slate-200 tracking-tight">Memory Analytics</h1>
        <p className="text-xs font-mono text-slate-600 mt-0.5">{today}</p>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-4 gap-3 mb-8">
        <StatCard label="Total Memories" value={memories.length} sub="logged today" />
        <StatCard label="Active Hours" value={activeHours(hourlyData)} sub="of 24" />
        <StatCard label="Top Object" value={topObject} sub={`${objectData[0]?.count ?? 0} detections`} />
        <StatCard label="Mood Logs" value={totalMoods} sub="emotional tags" />
      </div>

      <div className="grid grid-cols-5 gap-6">
        {/* Activity chart — takes 3 cols */}
        <div className="col-span-3 glass rounded-xl p-5 border" style={{ borderColor: "rgba(255,255,255,0.07)" }}>
          <p className="text-[10px] font-mono text-slate-600 tracking-widest uppercase mb-4">Activity by Hour</p>
          {memories.length === 0 ? (
            <div className="flex items-center justify-center h-40 text-xs font-mono text-slate-700">No data yet</div>
          ) : (
            <ResponsiveContainer width="100%" height={180}>
              <BarChart data={hourlyData} margin={{ top: 0, right: 0, left: -28, bottom: 0 }}>
                <XAxis
                  dataKey="hour"
                  tickFormatter={fmtHour}
                  tick={{ fill: "#475569", fontSize: 10, fontFamily: "monospace" }}
                  tickLine={false}
                  axisLine={false}
                  interval={3}
                />
                <YAxis
                  tick={{ fill: "#475569", fontSize: 10, fontFamily: "monospace" }}
                  tickLine={false}
                  axisLine={false}
                  allowDecimals={false}
                />
                <Tooltip content={<ChartTooltip />} cursor={{ fill: "rgba(0,196,240,0.04)" }} />
                <Bar dataKey="count" radius={[3, 3, 0, 0]}>
                  {hourlyData.map((entry, i) => (
                    <Cell
                      key={i}
                      fill={entry.count > 0 ? "rgba(0,196,240,0.5)" : "rgba(255,255,255,0.04)"}
                    />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          )}
          <p className="text-[10px] font-mono text-slate-700 mt-3">
            Peak hour: <span className="text-recall-500">{peakHour(hourlyData)}</span>
          </p>
        </div>

        {/* Right column: objects + moods */}
        <div className="col-span-2 flex flex-col gap-4">
          {/* Top detected objects */}
          <div className="glass rounded-xl p-5 border flex-1" style={{ borderColor: "rgba(255,255,255,0.07)" }}>
            <p className="text-[10px] font-mono text-slate-600 tracking-widest uppercase mb-3">Top Detected Objects</p>
            {objectData.length === 0 ? (
              <p className="text-xs font-mono text-slate-700">No objects detected yet</p>
            ) : (
              <div className="space-y-2">
                {objectData.slice(0, 6).map((obj, i) => (
                  <div key={obj.name} className="flex items-center gap-2">
                    <span className="text-[10px] font-mono text-slate-700 w-3">{i + 1}</span>
                    <div className="flex-1 h-1.5 rounded-full bg-white/5 overflow-hidden">
                      <div
                        className="h-full rounded-full transition-all duration-700"
                        style={{
                          width: `${(obj.count / objectData[0].count) * 100}%`,
                          background: `rgba(0,196,240,${0.3 + (0.4 * (objectData[0].count - obj.count + 1)) / objectData[0].count})`,
                        }}
                      />
                    </div>
                    <span className="text-[11px] font-mono text-slate-400 w-20 truncate">{obj.name}</span>
                    <span className="text-[10px] font-mono text-slate-600 w-4 text-right">{obj.count}</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Mood distribution */}
          <div className="glass rounded-xl p-5 border" style={{ borderColor: "rgba(255,255,255,0.07)" }}>
            <p className="text-[10px] font-mono text-slate-600 tracking-widest uppercase mb-3">Mood Log</p>
            {totalMoods === 0 ? (
              <p className="text-xs font-mono text-slate-700">No moods tagged yet — use the timeline</p>
            ) : (
              <div className="space-y-2">
                {moodData.map((d) => (
                  <MoodBar key={d.mood} mood={d.mood} count={d.count} max={maxMood} />
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
