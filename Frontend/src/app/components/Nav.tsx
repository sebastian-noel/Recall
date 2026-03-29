"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const links = [
  {
    href: "/",
    label: "Memory",
    icon: (
      <svg width="13" height="13" viewBox="0 0 13 13" fill="none">
        <circle cx="6.5" cy="6.5" r="5.5" stroke="currentColor" strokeWidth="1.1" />
        <circle cx="6.5" cy="6.5" r="2" stroke="currentColor" strokeWidth="1" />
      </svg>
    ),
  },
  {
    href: "/stats",
    label: "Analytics",
    icon: (
      <svg width="13" height="13" viewBox="0 0 13 13" fill="none">
        <rect x="1" y="7" width="2.5" height="5" rx="0.5" stroke="currentColor" strokeWidth="1" />
        <rect x="5.25" y="4" width="2.5" height="8" rx="0.5" stroke="currentColor" strokeWidth="1" />
        <rect x="9.5" y="1" width="2.5" height="11" rx="0.5" stroke="currentColor" strokeWidth="1" />
      </svg>
    ),
  },
];

export default function Nav() {
  const pathname = usePathname();

  return (
    <div className="flex items-center gap-1 px-6 py-2 border-b" style={{ borderColor: "rgba(255,255,255,0.06)" }}>
      {links.map((l) => {
        const active = pathname === l.href;
        return (
          <Link
            key={l.href}
            href={l.href}
            className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-mono tracking-wider transition-all ${
              active
                ? "bg-recall-500/15 text-recall-400 border border-recall-500/25"
                : "text-slate-600 hover:text-slate-400 border border-transparent"
            }`}
          >
            {l.icon}
            {l.label.toUpperCase()}
          </Link>
        );
      })}
    </div>
  );
}
