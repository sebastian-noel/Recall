"use client";

import { useState } from "react";
import ChatWindow from "./components/ChatWindow";
import MemoryTimeline from "./components/MemoryTimeline";
import StatusBar from "./components/StatusBar";

export default function Home() {
  const [showTimeline, setShowTimeline] = useState(false);

  return (
    <div className="flex flex-col h-screen">
      <StatusBar />

      <div className="flex flex-1 overflow-hidden">
        {/* Main chat area */}
        <div className="flex-1 flex flex-col">
          <div className="flex items-center justify-between px-6 py-3 border-b border-recall-200 bg-white">
            <h1 className="text-2xl font-semibold text-recall-800">Recall</h1>
            <button
              onClick={() => setShowTimeline(!showTimeline)}
              className="px-4 py-2 text-sm rounded-lg bg-recall-100 hover:bg-recall-200 text-recall-700 transition-colors"
            >
              {showTimeline ? "Hide Timeline" : "Show Timeline"}
            </button>
          </div>
          <ChatWindow />
        </div>

        {/* Memory timeline sidebar */}
        {showTimeline && (
          <div className="w-80 border-l border-recall-200 bg-white overflow-y-auto">
            <MemoryTimeline />
          </div>
        )}
      </div>
    </div>
  );
}
