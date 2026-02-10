import type { Config } from "tailwindcss";
import tailwindcssAnimate from "tailwindcss-animate";

const config: Config = {
  darkMode: ["class"],
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        border: "hsl(var(--border))",
        input: "hsl(var(--input))",
        ring: "hsl(var(--ring))",
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        primary: {
          DEFAULT: "#003F87",
          light: "#0052B0",
          dark: "#002D62",
          foreground: "#FFFFFF",
        },
        secondary: {
          DEFAULT: "hsl(var(--secondary))",
          foreground: "hsl(var(--secondary-foreground))",
        },
        destructive: {
          DEFAULT: "hsl(var(--destructive))",
          foreground: "hsl(var(--destructive-foreground))",
        },
        muted: {
          DEFAULT: "hsl(var(--muted))",
          foreground: "hsl(var(--muted-foreground))",
        },
        accent: {
          DEFAULT: "#D4AF37",
          light: "#F0E2A0",
          foreground: "#1A1A1A",
        },
        popover: {
          DEFAULT: "hsl(var(--popover))",
          foreground: "hsl(var(--popover-foreground))",
        },
        card: {
          DEFAULT: "hsl(var(--card))",
          foreground: "hsl(var(--card-foreground))",
        },
        surface: {
          DEFAULT: "#F7F8FA",
          hover: "#EEF0F4",
        },
        "text-primary": "#1A1A1A",
        "text-secondary": "#5A6070",
        "text-muted": "#9CA3AF",
        "border-default": "#E2E5EB",
        "border-light": "#EFF1F5",
        success: "#059669",
        warning: "#D97706",
      },
      borderRadius: {
        lg: "var(--radius)",
        md: "calc(var(--radius) - 2px)",
        sm: "calc(var(--radius) - 4px)",
        xl: "16px",
      },
      fontFamily: {
        sans: [
          "-apple-system",
          "BlinkMacSystemFont",
          '"SF Pro Display"',
          '"Segoe UI"',
          "Roboto",
          '"Helvetica Neue"',
          "Arial",
          "sans-serif",
        ],
      },
      maxWidth: {
        content: "1120px",
      },
      boxShadow: {
        xs: "0 1px 2px rgba(0,0,0,0.04)",
        sm: "0 2px 8px rgba(0,0,0,0.06)",
        md: "0 4px 16px rgba(0,0,0,0.08)",
        lg: "0 8px 32px rgba(0,0,0,0.10)",
        xl: "0 16px 48px rgba(0,0,0,0.12)",
        hero: "0 4px 24px rgba(0,0,0,0.15), 0 0 0 1px rgba(255,255,255,0.1)",
        "hero-focus": "0 4px 24px rgba(0,0,0,0.2), 0 0 0 2px #D4AF37",
      },
      keyframes: {
        "pulse-dot": {
          "0%, 100%": { opacity: "1" },
          "50%": { opacity: "0.4" },
        },
        "msg-in": {
          from: { opacity: "0", transform: "translateY(8px)" },
          to: { opacity: "1", transform: "translateY(0)" },
        },
        blink: {
          "0%, 80%, 100%": { opacity: "0.3" },
          "40%": { opacity: "1" },
        },
      },
      animation: {
        "pulse-dot": "pulse-dot 2s infinite",
        "msg-in": "msg-in 0.3s ease",
        blink: "blink 1.4s infinite both",
      },
    },
  },
  plugins: [tailwindcssAnimate],
};
export default config;
