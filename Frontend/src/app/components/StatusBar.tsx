"use client";

import Link from "next/link";
import { useState, useEffect } from "react";

interface Status {
  camera_connected: boolean;
  mic_connected: boolean;
  memory_count: number;
  pipeline_active: boolean;
}

function Indicator({ active, label }: { active: boolean; label: string }) {
  return (
    <div className="flex items-center gap-2">
      <div className="relative flex items-center justify-center w-4 h-4">
        <span
          className={`block w-2 h-2 rounded-full ${
            active ? "bg-recall-400" : "bg-slate-600"
          }`}
        />
        {active && (
          <span className="absolute inset-0 rounded-full bg-recall-400 animate-ping opacity-40" />
        )}
      </div>
      <span className={`text-xs font-mono tracking-wider uppercase ${active ? "text-slate-300" : "text-slate-600"}`}>
        {label}
      </span>
    </div>
  );
}

export default function StatusBar() {
  const [status, setStatus] = useState<Status | null>(null);

  useEffect(() => {
    const fetch_ = async () => {
      try {
        const res = await fetch("/api/status");
        setStatus(await res.json());
      } catch {
        setStatus(null);
      }
    };
    fetch_();
    const id = setInterval(fetch_, 5000);
    return () => clearInterval(id);
  }, []);

  const now = new Date();
  const timeStr = now.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false });

  return (
    <div className="relative flex items-center gap-6 px-6 py-2.5 border-b border-white/[0.06] bg-navy-950/80 backdrop-blur-md z-10">
      {/* Logo */}
      <Link href="/" className="flex items-center gap-2 mr-4 hover:opacity-80 transition-opacity">
        <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
          <circle cx="9" cy="9" r="8" stroke="#00c4f0" strokeWidth="1.2" />
          <circle cx="9" cy="9" r="4" fill="#00c4f0" fillOpacity="0.2" stroke="#00c4f0" strokeWidth="1" />
          <circle cx="9" cy="9" r="1.5" fill="#00c4f0" />
        </svg>
        <span className="text-xs font-mono font-medium tracking-[0.2em] text-recall-400 text-glow uppercase">Recall</span>
      </Link>

      <div className="w-px h-4 bg-white/10" />

      {/* Status indicators */}
      {status ? (
        <>
          <Indicator active={status.camera_connected} label="Camera" />
          <Indicator active={status.mic_connected} label="Mic" />
          <Indicator active={status.pipeline_active} label="Pipeline" />
        </>
      ) : (
        <span className="text-xs font-mono text-slate-600 tracking-wider uppercase">backend offline</span>
      )}

      {/* Right side */}
      <div className="ml-auto flex items-center gap-4">
        {status && (
          <span className="text-xs font-mono text-slate-500">
            <span className="text-recall-500">{status.memory_count}</span> memories
          </span>
        )}
        <span className="text-xs font-mono text-slate-600 tabular-nums">{timeStr}</span>
      </div>
    </div>
  );
}
