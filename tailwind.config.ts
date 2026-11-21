import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: ["class"],
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/features/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        brand: {
          DEFAULT: "#4F46E5",
          light: "#6366F1",
          soft: "#EEF2FF",
        },
        prism: {
          amber: "#F59E0B",
          orange: "#F97316",
          rose: "#EC4899",
          indigo: "#4F46E5",
          blue: "#2563EB",
          cyan: "#06B6D4",
        },
        cyber: {
          bg: "#F8FAFC",
          surface: "#F1F5F9",
          card: "#FFFFFF",
          "card-hover": "#F8FAFC",
          border: "#E2E8F0",
          "border-bright": "#CBD5E1",
        },
        neon: {
          emerald: "#10B981",
          amber: "#F59E0B",
          crimson: "#EF4444",
          cyan: "#06B6D4",
          purple: "#6366F1",
          pink: "#EC4899",
          orange: "#F97316",
          sky: "#0EA5E9",
        },
      },
      boxShadow: {
        "neon-emerald": "0 8px 24px -6px rgba(16, 185, 129, 0.22)",
        "neon-amber": "0 8px 24px -6px rgba(245, 158, 11, 0.22)",
        "neon-crimson": "0 8px 24px -6px rgba(239, 68, 68, 0.22)",
        "neon-cyan": "0 8px 24px -6px rgba(6, 182, 212, 0.2)",
        "neon-purple": "0 10px 28px -6px rgba(79, 70, 229, 0.25)",
      },
    },
  },
  plugins: [],
};

export default config;
