import type { Config } from "tailwindcss";
import animate from "tailwindcss-animate";

const token = (name: string) => `hsl(var(--${name}) / <alpha-value>)`;

export default {
  darkMode: ["class"],
  content: {
    relative: true, // globs resolve from this file, not the working directory
    files: [
      "./app/**/*.{ts,tsx}",
      "./components/**/*.{ts,tsx}",
      "./charts/**/*.{ts,tsx}",
      "./layouts/**/*.{ts,tsx}",
      "./lib/**/*.{ts,tsx}",
    ],
  },
  theme: {
    container: { center: true, padding: "1rem", screens: { "2xl": "1440px" } },
    extend: {
      fontFamily: {
        sans: ["var(--font-sans)", "system-ui", "sans-serif"],
        display: ["var(--font-display)", "var(--font-sans)", "system-ui", "sans-serif"],
        mono: ["var(--font-mono)", "ui-monospace", "monospace"],
      },
      colors: {
        border: token("border"),
        input: token("input"),
        ring: token("ring"),
        background: token("background"),
        foreground: token("foreground"),
        surface: { DEFAULT: token("surface"), 2: token("surface-2") },
        primary: { DEFAULT: token("primary"), foreground: token("primary-foreground") },
        secondary: { DEFAULT: token("secondary"), foreground: token("secondary-foreground") },
        destructive: { DEFAULT: token("destructive"), foreground: token("destructive-foreground") },
        success: { DEFAULT: token("success"), foreground: token("success-foreground") },
        warning: { DEFAULT: token("warning"), foreground: token("warning-foreground") },
        info: token("info"),
        muted: { DEFAULT: token("muted"), foreground: token("muted-foreground") },
        accent: { DEFAULT: token("accent"), foreground: token("accent-foreground") },
        popover: { DEFAULT: token("popover"), foreground: token("popover-foreground") },
        card: { DEFAULT: token("card"), foreground: token("card-foreground") },
        chart: { 1: token("chart-1"), 2: token("chart-2"), 3: token("chart-3"), 4: token("chart-4"), 5: token("chart-5") },
      },
      borderRadius: {
        xl: "calc(var(--radius) + 4px)",
        lg: "var(--radius)",
        md: "calc(var(--radius) - 2px)",
        sm: "calc(var(--radius) - 4px)",
      },
      keyframes: {
        "accordion-down": { from: { height: "0" }, to: { height: "var(--radix-accordion-content-height)" } },
        "accordion-up": { from: { height: "var(--radix-accordion-content-height)" }, to: { height: "0" } },
        shimmer: { "100%": { transform: "translateX(100%)" } },
        "pulse-dot": { "0%,100%": { opacity: "1", transform: "scale(1)" }, "50%": { opacity: ".45", transform: "scale(.85)" } },
        "ping-slow": { "75%,100%": { transform: "scale(2.2)", opacity: "0" } },
        "border-flow": { "0%": { backgroundPosition: "0% 50%" }, "100%": { backgroundPosition: "200% 50%" } },
        float: { "0%,100%": { transform: "translateY(0)" }, "50%": { transform: "translateY(-6px)" } },
      },
      animation: {
        "accordion-down": "accordion-down 0.2s ease-out",
        "accordion-up": "accordion-up 0.2s ease-out",
        shimmer: "shimmer 1.6s infinite",
        "pulse-dot": "pulse-dot 1.4s ease-in-out infinite",
        "ping-slow": "ping-slow 2s cubic-bezier(0, 0, 0.2, 1) infinite",
        "border-flow": "border-flow 3s linear infinite",
        float: "float 5s ease-in-out infinite",
      },
    },
  },
  plugins: [animate],
} satisfies Config;
