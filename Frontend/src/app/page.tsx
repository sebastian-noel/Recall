"use client";

import ChatWindow from "./components/ChatWindow";
import MemoryTimeline from "./components/MemoryTimeline";

export default function Home() {
  return (
    <div className="flex h-full overflow-hidden">
      {/* Memory timeline — always-visible left sidebar */}
      <div className="w-72 flex-shrink-0 border-r overflow-hidden flex flex-col" style={{ borderColor: "rgba(255,255,255,0.06)" }}>
        <MemoryTimeline />
      </div>

      {/* Chat area */}
      <div className="flex-1 flex flex-col overflow-hidden">
        <ChatWindow />
      </div>
    </div>
  );
}
