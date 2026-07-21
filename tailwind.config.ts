import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: "class",
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        bg: "#0d0d0f",
        panel: "#141417",
        panel2: "#1a1a1f",
        accent: "#6c4bdb",
        accent2: "#4f7cf7",
        muted: "#8b8b96",
        faint: "#5c5c66",
      },
      fontFamily: {
        sans: ["var(--font-inter)", "ui-sans-serif", "system-ui", "sans-serif"],
      },
      borderColor: {
        DEFAULT: "rgba(255,255,255,0.07)",
      },
    },
  },
  plugins: [],
};

export default config;
