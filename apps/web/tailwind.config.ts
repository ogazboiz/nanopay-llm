import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: {
    extend: {
      fontFamily: {
        sans: ["var(--font-inter)", "system-ui", "sans-serif"],
        mono: ["var(--font-jbm)", "ui-monospace", "monospace"],
      },
      colors: {
        ink: {
          0: "#0a0a0a",
          50: "#111111",
          100: "#171717",
          200: "#1f1f1f",
          300: "#262626",
          400: "#404040",
          500: "#525252",
          600: "#737373",
          700: "#a3a3a3",
          800: "#d4d4d4",
          900: "#fafafa",
        },
      },
      boxShadow: {
        glow: "0 0 40px -12px rgba(99,102,241,0.6)",
        "glow-sm": "0 0 16px -4px rgba(99,102,241,0.4)",
      },
      keyframes: {
        shimmer: {
          "0%": { backgroundPosition: "-200% 0" },
          "100%": { backgroundPosition: "200% 0" },
        },
        "pulse-dot": {
          "0%, 100%": { opacity: "1", transform: "scale(1)" },
          "50%": { opacity: "0.4", transform: "scale(0.75)" },
        },
      },
      animation: {
        shimmer: "shimmer 2s linear infinite",
        "pulse-dot": "pulse-dot 1.6s ease-in-out infinite",
      },
    },
  },
  plugins: [],
};
export default config;
