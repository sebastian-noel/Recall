"use client";

import { useState, useEffect } from "react";

interface Status {
  camera_connected: boolean;
  mic_connected: boolean;
  memory_count: number;
  pipeline_active: boolean;
}

export default function StatusBar() {
  const [status, setStatus] = useState<Status | null>(null);

  const fetchStatus = async () => {
    try {
      const res = await fetch("/api/status");
      setStatus(await res.json());
    } catch {
      setStatus(null);
    }
  };

  useEffect(() => {
    fetchStatus();
    const interval = setInterval(fetchStatus, 5000);
    return () => clearInterval(interval);
  }, []);

  const Dot = ({ active }: { active: boolean }) => (
    <span
      className={`inline-block w-2.5 h-2.5 rounded-full mr-2 ${
        active ? "bg-green-500" : "bg-red-400"
      }`}
    />
  );

  return (
    <div className="flex items-center gap-6 px-6 py-2 bg-recall-800 text-white text-sm">
      <span className="font-medium">Status:</span>

      {status ? (
        <>
          <span>
            <Dot active={status.camera_connected} />
            Camera
          </span>
          <span>
            <Dot active={status.mic_connected} />
            Microphone
          </span>
          <span>
            <Dot active={status.pipeline_active} />
            Pipeline
          </span>
          <span className="ml-auto text-recall-200">
            {status.memory_count} memories logged
          </span>
        </>
      ) : (
        <span className="text-recall-300">Backend offline</span>
      )}
    </div>
  );
}
