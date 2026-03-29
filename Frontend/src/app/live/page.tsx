"use client";

import { useState, useCallback } from "react";

export default function LivePage() {
  const [src, setSrc] = useState<string | null>(null);
  const [fetchedAt, setFetchedAt] = useState<Date | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);

  const fetchFrame = useCallback(async () => {
    setLoading(true);
    setError(false);
    try {
      const res = await fetch(`/api/frame?t=${Date.now()}`);
      if (!res.ok) throw new Error();
      const blob = await res.blob();
      if (src) URL.revokeObjectURL(src);
      setSrc(URL.createObjectURL(blob));
      setFetchedAt(new Date());
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  }, [src]);

  const fmt = (d: Date) =>
    d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false });

  return (
    <div className="h-full flex flex-col items-center justify-center px-8 py-8 gap-6">

      {/* Frame viewer */}
      <div className="relative w-full max-w-2xl">
        {/* Corner accents */}
        <div className="absolute -top-px -left-px w-4 h-4 border-t border-l border-recall-500/50 rounded-tl-sm" />
        <div className="absolute -top-px -right-px w-4 h-4 border-t border-r border-recall-500/50 rounded-tr-sm" />
        <div className="absolute -bottom-px -left-px w-4 h-4 border-b border-l border-recall-500/50 rounded-bl-sm" />
        <div className="absolute -bottom-px -right-px w-4 h-4 border-b border-r border-recall-500/50 rounded-br-sm" />

        <div
          className="glass rounded-xl overflow-hidden border"
          style={{ borderColor: "rgba(0,196,240,0.12)", aspectRatio: "4/3" }}
        >
          {src && !error ? (
            <img src={src} alt="ESP32 frame" className="w-full h-full object-contain" />
          ) : (
            <div className="w-full h-full flex flex-col items-center justify-center gap-3">
              {error ? (
                <>
                  <svg width="32" height="32" viewBox="0 0 32 32" fill="none" className="text-slate-700">
                    <rect x="3" y="8" width="26" height="18" rx="2" stroke="currentColor" strokeWidth="1.5" />
                    <path d="M13 14l6 6M19 14l-6 6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                  </svg>
                  <p className="text-xs font-mono text-slate-700">Camera unreachable</p>
                </>
              ) : (
                <>
                  <svg width="32" height="32" viewBox="0 0 32 32" fill="none" className="text-slate-800">
                    <rect x="3" y="8" width="26" height="18" rx="2" stroke="currentColor" strokeWidth="1.5" />
                    <circle cx="16" cy="17" r="5" stroke="currentColor" strokeWidth="1.5" />
                    <circle cx="16" cy="17" r="2" fill="currentColor" fillOpacity="0.4" />
                    <rect x="12" y="5" width="8" height="4" rx="1" stroke="currentColor" strokeWidth="1.2" />
                  </svg>
                  <p className="text-xs font-mono text-slate-700">Press the button to grab a frame</p>
                </>
              )}
            </div>
          )}

          {/* Loading overlay */}
          {loading && (
            <div className="absolute inset-0 flex items-center justify-center bg-navy-950/60 backdrop-blur-sm rounded-xl">
              <div className="w-6 h-6 border border-recall-500/40 rounded-full animate-spin border-t-recall-500" />
            </div>
          )}
        </div>
      </div>

      {/* Metadata row */}
      <div className="flex items-center gap-6 text-[11px] font-mono text-slate-700">
        <span className="flex items-center gap-1.5">
          <span className={`w-1.5 h-1.5 rounded-full ${src && !error ? "bg-recall-400" : "bg-slate-700"}`} />
          {src && !error ? "frame loaded" : "no frame"}
        </span>
        {fetchedAt && (
          <span>captured {fmt(fetchedAt)}</span>
        )}
        <span className="text-slate-800">ESP32-S3 · MJPEG · VGA</span>
      </div>

      {/* Refresh button */}
      <button
        onClick={fetchFrame}
        disabled={loading}
        className="flex items-center gap-2.5 px-6 py-2.5 rounded-xl text-sm font-mono border border-recall-500/30 bg-recall-500/10 text-recall-400 hover:bg-recall-500/20 hover:border-recall-500/50 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
      >
        <svg
          width="14" height="14" viewBox="0 0 14 14" fill="none"
          className={loading ? "animate-spin" : ""}
        >
          <path
            d="M13 7A6 6 0 1 1 7 1"
            stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"
          />
          <path d="M7 1l2.5 2.5L7 6" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
        {loading ? "fetching…" : "get latest frame"}
      </button>
    </div>
  );
}
