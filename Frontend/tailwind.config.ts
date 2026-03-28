import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        recall: {
          50: "#fdf8f0",
          100: "#f9eeda",
          200: "#f2dbb5",
          300: "#e8c285",
          400: "#dda854",
          500: "#d4932f",
          600: "#c07b24",
          700: "#9f5f20",
          800: "#814c21",
          900: "#693f1e",
        },
      },
    },
  },
  plugins: [],
};

export default config;
