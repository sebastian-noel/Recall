"use client";

import { useState, useRef, useEffect } from "react";
import { emitMicActive } from "../lib/micBus";
const AGENT_ID = "agent_3001kmw7p0qdes3a2xpg93edk389";

interface Message {
  id: number;
  sender: "user" | "recall";
  text: string;
  timestamp: Date;
}

const SUGGESTIONS = [
  "Where did I leave my keys?",
  "Who did I talk to this morning?",
  "What was I working on earlier?",
  "Did I lock the door?",
];

export default function ChatWindow() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [micState, setMicState] = useState<"idle" | "recording" | "processing">("idle");
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const nextId = useRef(0);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  useEffect(() => {
    emitMicActive(micState === "recording");
  }, [micState]);

  const sendMessage = async (text?: string, isVoice = false) => {
    const question = (text ?? input).trim();
    if (!question || loading) return;

    const userMsg: Message = {
      id: nextId.current++,
      sender: "user",
      text: question,
      timestamp: new Date(),
    };
    setMessages((prev) => [...prev, userMsg]);
    setInput("");
    setLoading(true);

    try {
      const res = await fetch("/api/query", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question }),
      });
      const data = await res.json();
      const answer = data.answer || "No relevant memories found.";
      setMessages((prev) => [
        ...prev,
        { id: nextId.current++, sender: "recall", text: answer, timestamp: new Date() },
      ]);

      if (isVoice) {
        try {
          const ttsRes = await fetch("/api/tts", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ text: answer }),
          });
          if (ttsRes.ok) {
            const blob = await ttsRes.blob();
            const url = URL.createObjectURL(blob);
            const audio = new Audio(url);
            audio.play();
            audio.onended = () => URL.revokeObjectURL(url);
          }
        } catch { /* ignore TTS errors */ }
      }
    } catch {
      setMessages((prev) => [
        ...prev,
        {
          id: nextId.current++,
          sender: "recall",
          text: "Connection error — backend offline.",
          timestamp: new Date(),
        },
      ]);
    } finally {
      setLoading(false);
      inputRef.current?.focus();
    }
  };

  const toggleRecording = async () => {
    if (micState === "recording") {
      mediaRecorderRef.current?.stop();
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);
      audioChunksRef.current = [];

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) audioChunksRef.current.push(e.data);
      };

      recorder.onstop = async () => {
        stream.getTracks().forEach((t) => t.stop());
        setMicState("processing");

        const blob = new Blob(audioChunksRef.current, { type: "audio/webm" });
        const form = new FormData();
        form.append("audio", blob, "audio.webm");

        try {
          const res = await fetch("/api/transcribe", { method: "POST", body: form });
          const data = await res.json();
          if (data.text) await sendMessage(data.text, true);
        } catch {
          // silently ignore transcription errors
        } finally {
          setMicState("idle");
        }
      };

      mediaRecorderRef.current = recorder;
      recorder.start();
      setMicState("recording");
    } catch {
      setMicState("idle");
    }
  };

  const fmt = (d: Date) =>
    d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false });

  return (
    <div className="flex flex-col flex-1 overflow-hidden">
      {/* Messages area */}
      <div className="flex-1 overflow-y-auto px-6 py-6 space-y-4">
        {messages.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full min-h-[40vh] text-center fade-in">
            {/* Eye icon */}
            <div className="relative w-16 h-16 mb-6">
              <div className="absolute inset-0 rounded-full border border-recall-500/30 animate-ping" style={{ animationDuration: "3s" }} />
              <div className="absolute inset-2 rounded-full border border-recall-500/20" />
              <div className="absolute inset-0 flex items-center justify-center">
                <svg width="32" height="20" viewBox="0 0 32 20" fill="none">
                  <path d="M1 10C1 10 7 1 16 1C25 1 31 10 31 10C31 10 25 19 16 19C7 19 1 10 1 10Z" stroke="#00c4f0" strokeWidth="1.2" strokeLinejoin="round" />
                  <circle cx="16" cy="10" r="5" stroke="#00c4f0" strokeWidth="1.2" />
                  <circle cx="16" cy="10" r="2" fill="#00c4f0" fillOpacity="0.6" />
                </svg>
              </div>
            </div>

            <h2 className="text-xl font-semibold text-slate-200 mb-1 tracking-tight">Ask Recall anything</h2>
            <p className="text-sm text-slate-600 font-mono mb-8">Your memory is being recorded — query it anytime.</p>

            {/* Suggestion chips */}
            <div className="flex flex-wrap gap-2 justify-center max-w-lg">
              {SUGGESTIONS.map((s) => (
                <button
                  key={s}
                  onClick={() => sendMessage(s)}
                  className="text-xs font-mono px-3 py-1.5 rounded-full glass border border-white/10 text-slate-400 hover:text-recall-400 hover:border-recall-500/30 transition-all hover:glow-cyan-sm"
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        )}

        {messages.map((msg) => (
          <div
            key={msg.id}
            className={`flex fade-in ${msg.sender === "user" ? "justify-end" : "justify-start"}`}
          >
            {msg.sender === "recall" && (
              <div className="w-6 h-6 rounded-full border border-recall-500/40 flex items-center justify-center mr-2 flex-shrink-0 mt-1">
                <div className="w-2 h-2 rounded-full bg-recall-500" />
              </div>
            )}

            <div className={`max-w-[72%] ${msg.sender === "user" ? "" : ""}`}>
              <div
                className={`rounded-2xl px-4 py-3 text-sm leading-relaxed ${
                  msg.sender === "user"
                    ? "bg-recall-500/20 text-slate-200 border border-recall-500/30 rounded-tr-sm"
                    : "glass text-slate-300 border-white/[0.06] rounded-tl-sm"
                }`}
              >
                {msg.text}
              </div>
              <p className="text-[10px] font-mono text-slate-700 mt-1 px-1">
                {fmt(msg.timestamp)}
              </p>
            </div>

            {msg.sender === "user" && (
              <div className="w-6 h-6 rounded-full bg-recall-500/20 border border-recall-500/30 flex items-center justify-center ml-2 flex-shrink-0 mt-1">
                <span className="text-[8px] font-mono text-recall-400">YOU</span>
              </div>
            )}
          </div>
        ))}

        {loading && (
          <div className="flex justify-start fade-in">
            <div className="w-6 h-6 rounded-full border border-recall-500/40 flex items-center justify-center mr-2 flex-shrink-0 mt-1">
              <div className="w-2 h-2 rounded-full bg-recall-500 animate-pulse" />
            </div>
            <div className="glass rounded-2xl rounded-tl-sm px-5 py-3.5 border border-white/[0.06]">
              <div className="flex gap-1.5 items-center">
                <div className="w-1.5 h-1.5 rounded-full bg-recall-500 typing-dot" />
                <div className="w-1.5 h-1.5 rounded-full bg-recall-500 typing-dot" />
                <div className="w-1.5 h-1.5 rounded-full bg-recall-500 typing-dot" />
              </div>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Input bar */}
      <div className="px-6 pb-6">
        <div className="glass rounded-2xl border border-white/[0.08] flex items-center gap-3 px-4 py-3 focus-within:border-recall-500/40 focus-within:glow-cyan transition-all">
          <svg className="w-4 h-4 text-slate-600 flex-shrink-0" viewBox="0 0 16 16" fill="none">
            <circle cx="8" cy="8" r="6" stroke="currentColor" strokeWidth="1.2" />
            <circle cx="8" cy="8" r="2.5" stroke="currentColor" strokeWidth="1" />
          </svg>
          <input
            ref={inputRef}
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && sendMessage()}
            placeholder="Ask about your day..."
            className="flex-1 bg-transparent text-sm text-slate-200 placeholder-slate-700 focus:outline-none font-mono"
            disabled={loading}
          />
          <button
            onClick={toggleRecording}
            disabled={loading || micState === "processing"}
            title={micState === "recording" ? "Stop recording" : "Speak your question"}
            className={`relative flex items-center justify-center w-8 h-8 rounded-xl border transition-all flex-shrink-0 ${
              micState === "recording"
                ? "bg-red-500/20 border-red-500/50 text-red-400"
                : "bg-white/5 border-white/10 text-slate-500 hover:text-recall-400 hover:border-recall-500/30"
            } disabled:opacity-30 disabled:cursor-not-allowed`}
          >
            {micState === "recording" && (
              <span className="absolute inset-0 rounded-xl bg-red-500/20 animate-ping" />
            )}
            {micState === "processing" ? (
              <svg className="animate-spin" width="14" height="14" viewBox="0 0 14 14" fill="none">
                <circle cx="7" cy="7" r="5" stroke="currentColor" strokeWidth="1.5" strokeDasharray="8 8" />
              </svg>
            ) : (
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                <rect x="4" y="1" width="6" height="8" rx="3" stroke="currentColor" strokeWidth="1.2" />
                <path d="M2 7c0 2.761 2.239 5 5 5s5-2.239 5-5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
                <line x1="7" y1="12" x2="7" y2="13.5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
              </svg>
            )}
          </button>
          <button
            onClick={() => sendMessage()}
            disabled={loading || !input.trim()}
            className="flex items-center gap-2 px-4 py-1.5 rounded-xl text-xs font-mono font-medium bg-recall-500/20 text-recall-400 border border-recall-500/30 hover:bg-recall-500/30 disabled:opacity-30 disabled:cursor-not-allowed transition-all"
          >
            <span>ASK</span>
            <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
              <path d="M1 5h8M6 2l3 3-3 3" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
        </div>
        <p className="text-center text-[10px] font-mono text-slate-800 mt-2">
          press <kbd className="text-slate-700">enter</kbd> to send
        </p>
      </div>
    </div>
  );
}
