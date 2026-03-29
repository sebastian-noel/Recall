"use client";

import { useState, useRef, useCallback } from "react";

interface Clip {
  blob: Blob;
  name: string;
}

const MIN_CLIPS = 10;

function ClipSlot({
  index, clip, isRecording, countdown,
  onRecord, onStop, onUpload, onRemove,
}: {
  index: number;
  clip: Clip | null;
  isRecording: boolean;
  countdown: number;
  onRecord: (i: number) => void;
  onStop: () => void;
  onUpload: (i: number) => void;
  onRemove: (i: number) => void;
}) {
  return (
    <div
      className={`relative rounded-xl border p-3 flex flex-col gap-2 transition-all ${
        clip
          ? "border-recall-500/30 bg-recall-500/5"
          : isRecording
          ? "border-red-500/40 bg-red-500/5"
          : "border-white/[0.06] bg-white/[0.02] hover:border-white/10"
      }`}
    >
      <div className="flex items-center justify-between">
        <span className="text-[10px] font-mono text-slate-700">CLIP {index + 1}</span>
        {clip && (
          <button onClick={() => onRemove(index)} className="text-slate-700 hover:text-red-400 transition-colors">
            <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
              <path d="M1 1l8 8M9 1L1 9" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
            </svg>
          </button>
        )}
      </div>

      {clip ? (
        <div className="flex items-center gap-2">
          <div className="w-5 h-5 rounded-full bg-recall-500/20 flex items-center justify-center flex-shrink-0">
            <div className="w-1.5 h-1.5 rounded-full bg-recall-400" />
          </div>
          <p className="text-[11px] font-mono text-slate-400 truncate">{clip.name}</p>
        </div>
      ) : isRecording ? (
        <div className="flex flex-col items-center gap-2 py-1">
          <div className="relative w-7 h-7 flex items-center justify-center">
            <span className="absolute inset-0 rounded-full bg-red-500/20 animate-ping" />
            <span className="w-3 h-3 rounded-full bg-red-500" />
          </div>
          <span className="text-lg font-mono font-semibold text-red-400 tabular-nums">{countdown}s</span>
          <button
            onClick={onStop}
            className="text-[10px] font-mono text-slate-600 hover:text-red-400 transition-colors"
          >
            stop early
          </button>
        </div>
      ) : (
        <div className="flex flex-col gap-1.5">
          <button
            onClick={() => onRecord(index)}
            className="flex items-center justify-center gap-1.5 px-2 py-1.5 rounded-lg text-[10px] font-mono text-slate-500 border border-white/[0.06] hover:text-recall-400 hover:border-recall-500/30 transition-all"
          >
            <span className="w-1.5 h-1.5 rounded-full bg-red-500/70" />
            Record 30s
          </button>
          <button
            onClick={() => onUpload(index)}
            className="flex items-center justify-center gap-1.5 px-2 py-1.5 rounded-lg text-[10px] font-mono text-slate-500 border border-white/[0.06] hover:text-slate-300 hover:border-white/10 transition-all"
          >
            <svg width="9" height="9" viewBox="0 0 9 9" fill="none">
              <path d="M4.5 6V1M2 3.5L4.5 1 7 3.5" stroke="currentColor" strokeWidth="1.1" strokeLinecap="round" strokeLinejoin="round" />
              <path d="M1 7.5h7" stroke="currentColor" strokeWidth="1.1" strokeLinecap="round" />
            </svg>
            Upload
          </button>
        </div>
      )}
    </div>
  );
}

export default function VoicePage() {
  const [clips, setClips] = useState<(Clip | null)[]>(Array(MIN_CLIPS).fill(null));
  const [voiceName, setVoiceName] = useState("");
  const [recordingIndex, setRecordingIndex] = useState<number | null>(null);
  const [countdown, setCountdown] = useState(30);
  const [status, setStatus] = useState<"idle" | "submitting" | "done" | "error">("idle");
  const [voiceId, setVoiceId] = useState("");
  const [errorMsg, setErrorMsg] = useState("");
  const [copied, setCopied] = useState(false);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const countdownRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const uploadIndexRef = useRef<number | null>(null);

  const filledCount = clips.filter(Boolean).length;
  const canSubmit = filledCount >= MIN_CLIPS && voiceName.trim().length > 0 && status === "idle";

  const startRecording = useCallback(async (index: number) => {
    if (recordingIndex !== null) return;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      chunksRef.current = [];
      const recorder = new MediaRecorder(stream);

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };

      recorder.onstop = () => {
        stream.getTracks().forEach((t) => t.stop());
        const blob = new Blob(chunksRef.current, { type: "audio/webm" });
        setClips((prev) => {
          const next = [...prev];
          next[index] = { blob, name: `Recording ${index + 1}` };
          return next;
        });
        setRecordingIndex(null);
        if (countdownRef.current) clearInterval(countdownRef.current);
      };

      mediaRecorderRef.current = recorder;
      recorder.start();
      setRecordingIndex(index);
      setCountdown(30);

      let t = 30;
      countdownRef.current = setInterval(() => {
        t -= 1;
        setCountdown(t);
        if (t <= 0) {
          recorder.stop();
          if (countdownRef.current) clearInterval(countdownRef.current);
        }
      }, 1000);
    } catch {
      setRecordingIndex(null);
    }
  }, [recordingIndex]);

  const stopRecording = useCallback(() => {
    mediaRecorderRef.current?.stop();
    if (countdownRef.current) clearInterval(countdownRef.current);
  }, []);

  const removeClip = useCallback((index: number) => {
    setClips((prev) => {
      const next = [...prev];
      next[index] = null;
      return next;
    });
  }, []);

  const addSlot = () => setClips((prev) => [...prev, null]);

  const triggerUpload = useCallback((index: number) => {
    uploadIndexRef.current = index;
    fileInputRef.current?.click();
  }, []);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    const index = uploadIndexRef.current;
    if (!file || index === null) return;
    setClips((prev) => {
      const next = [...prev];
      next[index] = { blob: file, name: file.name };
      return next;
    });
    e.target.value = "";
    uploadIndexRef.current = null;
  };

  const handleSubmit = async () => {
    const filled = clips.filter(Boolean) as Clip[];
    if (filled.length < MIN_CLIPS || !voiceName.trim()) return;

    setStatus("submitting");
    setErrorMsg("");

    const form = new FormData();
    form.append("name", voiceName.trim());
    filled.forEach((clip) => {
      const ext = clip.name.includes(".") ? "" : ".webm";
      form.append("files", clip.blob, clip.name + ext);
    });

    try {
      const res = await fetch("/api/clone-voice", { method: "POST", body: form });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Clone failed");

      const vid = data.voice_id;
      setVoiceId(vid);

      await fetch("/api/set-voice", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ voice_id: vid }),
      });

      setStatus("done");
    } catch (err: unknown) {
      setErrorMsg(err instanceof Error ? err.message : "Something went wrong");
      setStatus("error");
    }
  };

  const copyVoiceId = () => {
    navigator.clipboard.writeText(voiceId);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="h-full overflow-y-auto px-8 py-6">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-lg font-semibold text-slate-200 tracking-tight">My Voice</h1>
        <p className="text-xs font-mono text-slate-600 mt-0.5">
          Clone your voice so Recall speaks as you — record or upload {MIN_CLIPS}+ clips
        </p>
      </div>

      {status === "done" ? (
        /* ── Success state ── */
        <div className="flex flex-col items-center justify-center py-12 gap-6">
          <div className="relative w-16 h-16 flex items-center justify-center">
            <div className="absolute inset-0 rounded-full bg-recall-500/10 animate-ping" style={{ animationDuration: "2s" }} />
            <div className="w-12 h-12 rounded-full border border-recall-500/40 flex items-center justify-center glass">
              <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
                <path d="M4 10l4 4 8-8" stroke="#00c4f0" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </div>
          </div>

          <div className="text-center">
            <p className="text-slate-200 font-semibold mb-1">Voice cloned and applied</p>
            <p className="text-xs font-mono text-slate-600">Recall will now speak in your voice</p>
          </div>

          <div className="glass rounded-xl border p-4 w-full max-w-md" style={{ borderColor: "rgba(0,196,240,0.15)" }}>
            <p className="text-[10px] font-mono text-slate-600 tracking-widest uppercase mb-2">Voice ID</p>
            <div className="flex items-center gap-3">
              <code className="flex-1 text-xs font-mono text-recall-400 truncate">{voiceId}</code>
              <button
                onClick={copyVoiceId}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[10px] font-mono border border-white/10 text-slate-500 hover:text-slate-300 hover:border-white/20 transition-all flex-shrink-0"
              >
                {copied ? (
                  <>
                    <svg width="9" height="9" viewBox="0 0 9 9" fill="none">
                      <path d="M1 4.5l2.5 2.5 4.5-4.5" stroke="#00c4f0" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                    <span className="text-recall-400">copied</span>
                  </>
                ) : "copy"}
              </button>
            </div>
            <p className="text-[10px] font-mono text-slate-700 mt-2">Saved to config.py · live immediately</p>
          </div>

          <button
            onClick={() => { setStatus("idle"); setVoiceId(""); setClips(Array(MIN_CLIPS).fill(null)); setVoiceName(""); }}
            className="text-xs font-mono text-slate-600 hover:text-slate-400 transition-colors"
          >
            Clone another voice
          </button>
        </div>
      ) : (
        <>
          {/* Voice name */}
          <div className="mb-5 max-w-sm">
            <label className="block text-[10px] font-mono text-slate-600 tracking-widest uppercase mb-2">Voice Name</label>
            <input
              type="text"
              value={voiceName}
              onChange={(e) => setVoiceName(e.target.value)}
              placeholder="e.g. Chris"
              className="w-full glass rounded-xl border border-white/[0.08] px-4 py-2.5 text-sm font-mono text-slate-200 placeholder-slate-700 focus:outline-none focus:border-recall-500/40 transition-all"
            />
          </div>

          {/* Progress */}
          <div className="flex items-center gap-3 mb-4">
            <div className="flex-1 h-1 rounded-full bg-white/5 overflow-hidden">
              <div
                className="h-full rounded-full bg-recall-500/60 transition-all duration-500"
                style={{ width: `${Math.min((filledCount / MIN_CLIPS) * 100, 100)}%` }}
              />
            </div>
            <span className="text-[11px] font-mono text-slate-600 flex-shrink-0">
              <span className={filledCount >= MIN_CLIPS ? "text-recall-400" : "text-slate-400"}>{filledCount}</span>
              <span> / {MIN_CLIPS} clips</span>
            </span>
          </div>

          {/* Clip grid */}
          <div className="grid grid-cols-5 gap-3 mb-6">
            {clips.map((clip, i) => (
              <ClipSlot
                key={i}
                index={i}
                clip={clip}
                isRecording={recordingIndex === i}
                countdown={countdown}
                onRecord={startRecording}
                onStop={stopRecording}
                onUpload={triggerUpload}
                onRemove={removeClip}
              />
            ))}
            <button
              onClick={addSlot}
              className="rounded-xl border border-dashed border-white/[0.06] flex items-center justify-center gap-1.5 text-[10px] font-mono text-slate-700 hover:text-slate-500 hover:border-white/10 transition-all py-6"
            >
              <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
                <path d="M5 1v8M1 5h8" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
              </svg>
              Add clip
            </button>
          </div>

          {/* Error */}
          {status === "error" && (
            <p className="text-xs font-mono text-red-400 mb-4">{errorMsg}</p>
          )}

          {/* Tips */}
          <div className="glass rounded-xl border p-4 mb-6 max-w-2xl" style={{ borderColor: "rgba(255,255,255,0.06)" }}>
            <p className="text-[10px] font-mono text-slate-600 tracking-widest uppercase mb-2">Tips for best results</p>
            <ul className="space-y-1">
              {[
                "Record in a quiet room — background noise reduces quality",
                "Speak naturally at your normal pace and tone",
                "Vary your sentences — avoid repeating the same phrases",
                "Each clip should be ~30 seconds of continuous speech",
              ].map((tip) => (
                <li key={tip} className="flex items-start gap-2 text-[11px] font-mono text-slate-600">
                  <span className="text-recall-500/60 mt-0.5">·</span>
                  {tip}
                </li>
              ))}
            </ul>
          </div>

          {/* Submit */}
          <button
            onClick={handleSubmit}
            disabled={!canSubmit}
            className="flex items-center gap-2.5 px-6 py-2.5 rounded-xl text-sm font-mono border border-recall-500/30 bg-recall-500/10 text-recall-400 hover:bg-recall-500/20 hover:border-recall-500/50 disabled:opacity-30 disabled:cursor-not-allowed transition-all"
          >
            {status === "submitting" ? (
              <>
                <div className="w-3.5 h-3.5 border border-recall-500/40 rounded-full animate-spin border-t-recall-400" />
                Cloning voice…
              </>
            ) : (
              <>
                <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                  <rect x="4" y="1" width="6" height="8" rx="3" stroke="currentColor" strokeWidth="1.2" />
                  <path d="M2 7c0 2.761 2.239 5 5 5s5-2.239 5-5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
                </svg>
                Clone my voice
              </>
            )}
          </button>
        </>
      )}

      <input
        ref={fileInputRef}
        type="file"
        accept="audio/*,video/*"
        className="hidden"
        onChange={handleFileUpload}
      />
    </div>
  );
}
