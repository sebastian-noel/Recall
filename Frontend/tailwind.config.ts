import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        recall: {
          50:  "#e0f9ff",
          100: "#b3f0ff",
          200: "#66e2ff",
          300: "#1ad4ff",
          400: "#00c4f0",
          500: "#00a8d4",
          600: "#0089b0",
          700: "#006b8a",
          800: "#004d64",
          900: "#003040",
        },
        surface: {
          DEFAULT: "rgba(255,255,255,0.04)",
          hover:   "rgba(255,255,255,0.07)",
          border:  "rgba(255,255,255,0.08)",
        },
        navy: {
          950: "#050810",
          900: "#080c14",
          800: "#0d1220",
          700: "#121828",
          600: "#1a2235",
        },
      },
      fontFamily: {
        mono: ["'JetBrains Mono'", "Menlo", "monospace"],
      },
      backgroundImage: {
        "grid-dark":
          "linear-gradient(rgba(0,196,240,0.03) 1px, transparent 1px), linear-gradient(90deg, rgba(0,196,240,0.03) 1px, transparent 1px)",
      },
      backgroundSize: {
        grid: "40px 40px",
      },
      animation: {
        pulse2: "pulse2 2s ease-in-out infinite",
        scan: "scan 3s linear infinite",
        "fade-in": "fadeIn 0.3s ease-out",
      },
      keyframes: {
        pulse2: {
          "0%, 100%": { opacity: "1" },
          "50%":      { opacity: "0.4" },
        },
        scan: {
          "0%":   { transform: "translateY(-100%)" },
          "100%": { transform: "translateY(100vh)" },
        },
        fadeIn: {
          from: { opacity: "0", transform: "translateY(6px)" },
          to:   { opacity: "1", transform: "translateY(0)" },
        },
      },
    },
  },
  plugins: [],
};

export default config;
