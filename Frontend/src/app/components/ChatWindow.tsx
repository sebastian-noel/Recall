"use client";

import { useState, useRef, useEffect } from "react";

interface Message {
  id: number;
  sender: "user" | "recall";
  text: string;
  timestamp: Date;
}

export default function ChatWindow() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const nextId = useRef(0);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const sendMessage = async () => {
    const question = input.trim();
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
      const recallMsg: Message = {
        id: nextId.current++,
        sender: "recall",
        text: data.answer || "Sorry, I couldn't find an answer.",
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, recallMsg]);
    } catch {
      setMessages((prev) => [
        ...prev,
        {
          id: nextId.current++,
          sender: "recall",
          text: "Connection error. Make sure the backend is running.",
          timestamp: new Date(),
        },
      ]);
    } finally {
      setLoading(false);
    }
  };

  const formatTime = (date: Date) =>
    date.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });

  return (
    <div className="flex flex-col flex-1">
      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-6 space-y-4">
        {messages.length === 0 && (
          <div className="text-center text-gray-400 mt-20">
            <p className="text-xl mb-2">Welcome to Recall</p>
            <p className="text-lg">Ask me anything about what you've seen or done today.</p>
            <p className="text-base mt-4 text-gray-300">
              Try: "Where did I leave my keys?" or "Did I lock the door?"
            </p>
          </div>
        )}

        {messages.map((msg) => (
          <div
            key={msg.id}
            className={`flex ${msg.sender === "user" ? "justify-end" : "justify-start"}`}
          >
            <div
              className={`max-w-[75%] rounded-2xl px-5 py-3 ${
                msg.sender === "user"
                  ? "bg-recall-500 text-white"
                  : "bg-gray-100 text-gray-800"
              }`}
            >
              <p className="text-lg leading-relaxed">{msg.text}</p>
              <p
                className={`text-xs mt-1 ${
                  msg.sender === "user" ? "text-recall-200" : "text-gray-400"
                }`}
              >
                {formatTime(msg.timestamp)}
              </p>
            </div>
          </div>
        ))}

        {loading && (
          <div className="flex justify-start">
            <div className="bg-gray-100 rounded-2xl px-5 py-3">
              <div className="flex space-x-2">
                <div className="w-2.5 h-2.5 bg-gray-400 rounded-full animate-bounce" />
                <div className="w-2.5 h-2.5 bg-gray-400 rounded-full animate-bounce [animation-delay:0.15s]" />
                <div className="w-2.5 h-2.5 bg-gray-400 rounded-full animate-bounce [animation-delay:0.3s]" />
              </div>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className="border-t border-recall-200 bg-white p-4">
        <div className="flex gap-3 max-w-3xl mx-auto">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && sendMessage()}
            placeholder="Ask about your day..."
            className="flex-1 px-5 py-3 text-lg border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-recall-400 focus:border-transparent"
            disabled={loading}
          />
          <button
            onClick={sendMessage}
            disabled={loading || !input.trim()}
            className="px-6 py-3 text-lg font-medium bg-recall-500 text-white rounded-xl hover:bg-recall-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            Ask
          </button>
        </div>
      </div>
    </div>
  );
}
