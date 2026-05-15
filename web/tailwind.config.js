/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  darkMode: "class",
  theme: {
    extend: {
      colors: {
        background: "hsl(222 30% 5%)",
        panel: "hsl(222 28% 8%)",
        "panel-2": "hsl(222 24% 11%)",
        border: "hsl(222 18% 18%)",
        muted: "hsl(222 12% 60%)",
        foreground: "hsl(210 20% 96%)",
        accent: {
          DEFAULT: "hsl(196 95% 55%)",
          soft: "hsla(196,95%,55%,0.15)",
        },
        ok: {
          DEFAULT: "hsl(150 70% 50%)",
          soft: "hsla(150,70%,50%,0.18)",
        },
        warn: {
          DEFAULT: "hsl(38 95% 60%)",
          soft: "hsla(38,95%,60%,0.18)",
        },
        danger: {
          DEFAULT: "hsl(0 80% 62%)",
          soft: "hsla(0,80%,62%,0.18)",
        },
      },
      fontFamily: {
        sans: [
          "Inter",
          "ui-sans-serif",
          "system-ui",
          "-apple-system",
          "Segoe UI",
          "Roboto",
          "sans-serif",
        ],
        mono: [
          "JetBrains Mono",
          "ui-monospace",
          "SFMono-Regular",
          "Menlo",
          "monospace",
        ],
      },
      boxShadow: {
        glow: "0 0 0 1px hsl(196 95% 55% / 0.3), 0 0 24px hsl(196 95% 55% / 0.15)",
        card: "0 1px 0 hsl(222 18% 18% / 0.8), 0 12px 32px -16px rgb(0 0 0 / 0.6)",
      },
      keyframes: {
        pulseSoft: {
          "0%, 100%": { opacity: "0.85" },
          "50%": { opacity: "0.4" },
        },
        shimmer: {
          "0%": { backgroundPosition: "-200% 0" },
          "100%": { backgroundPosition: "200% 0" },
        },
      },
      animation: {
        pulseSoft: "pulseSoft 2.4s ease-in-out infinite",
        shimmer: "shimmer 2.4s linear infinite",
      },
    },
  },
  plugins: [],
};
