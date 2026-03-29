import type { Metadata } from "next";
import "./globals.css";
import StatusBar from "./components/StatusBar";
import Nav from "./components/Nav";

export const metadata: Metadata = {
  title: "Recall — AI Memory Assistant",
  description: "Your personal AI memory assistant",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="bg-navy-900 text-slate-200 min-h-screen overflow-hidden flex flex-col h-screen"
        style={{
          background:
            "radial-gradient(ellipse 80% 50% at 50% -10%, rgba(0,196,240,0.06) 0%, transparent 60%), #080c14",
          backgroundImage:
            "radial-gradient(ellipse 80% 50% at 50% -10%, rgba(0,196,240,0.06) 0%, transparent 60%), linear-gradient(rgba(0,196,240,0.025) 1px, transparent 1px), linear-gradient(90deg, rgba(0,196,240,0.025) 1px, transparent 1px)",
          backgroundSize: "100% 100%, 48px 48px, 48px 48px",
        }}
      >
        <StatusBar />
        <Nav />
        <div className="flex-1 overflow-hidden">{children}</div>
      </body>
    </html>
  );
}
