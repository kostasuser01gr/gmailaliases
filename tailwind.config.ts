import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/app/**/*.{ts,tsx}",
    "./src/components/**/*.{ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        surface: "#EEEFEA",
        ink: "#161714",
        muted: "#6E7065",
        hairline: "#D6D7CF",
        signal: "#0E7C5A",
        "signal-bright": "#16A37A",
        warn: "#B23A22",
      },
      fontFamily: {
        display: ["var(--font-space-grotesk)", "system-ui", "sans-serif"],
        mono: ["var(--font-ibm-plex-mono)", "ui-monospace", "monospace"],
      },
    },
  },
  plugins: [],
};

export default config;
