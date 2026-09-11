import type { Config } from "tailwindcss";

/**
 * eFootball Team AI デザインシステム。
 * 色・寸法の実体は src/app/globals.css の CSS 変数。ここではそれを参照するだけ。
 */
const config: Config = {
  content: ["./src/app/**/*.{ts,tsx}", "./src/components/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        bg: "rgb(var(--color-bg-rgb) / <alpha-value>)",
        surface: "rgb(var(--color-surface-rgb) / <alpha-value>)",
        "surface-2": "rgb(var(--color-surface-2-rgb) / <alpha-value>)",
        "surface-3": "rgb(var(--color-surface-3-rgb) / <alpha-value>)",
        border: "rgb(var(--color-border-rgb) / <alpha-value>)",
        "border-strong": "rgb(var(--color-border-strong-rgb) / <alpha-value>)",
        text: "rgb(var(--color-text-rgb) / <alpha-value>)",
        "text-dim": "rgb(var(--color-text-dim-rgb) / <alpha-value>)",
        "text-muted": "rgb(var(--color-text-muted-rgb) / <alpha-value>)",
        accent: "rgb(var(--color-accent-rgb) / <alpha-value>)",
        "accent-ink": "rgb(var(--color-accent-ink-rgb) / <alpha-value>)",
        "accent-soft": "var(--color-accent-soft)",
        success: "rgb(var(--color-success-rgb) / <alpha-value>)",
        warning: "rgb(var(--color-warning-rgb) / <alpha-value>)",
        danger: "rgb(var(--color-danger-rgb) / <alpha-value>)",
        info: "rgb(var(--color-info-rgb) / <alpha-value>)",
      },
      borderRadius: {
        sm: "var(--radius-sm)",
        md: "var(--radius-md)",
        card: "var(--radius-md)",
        lg: "var(--radius-lg)",
        pill: "var(--radius-pill)",
      },
      boxShadow: {
        card: "var(--shadow-card)",
        pop: "var(--shadow-pop)",
      },
      maxWidth: {
        content: "var(--content-regular)",
        "content-wide": "var(--content-wide)",
        "content-xwide": "var(--content-xwide)",
        "content-full": "var(--content-full)",
      },
      spacing: {
        header: "var(--header-h)",
        sidebar: "var(--sidebar-w)",
      },
      fontSize: {
        "2xs": ["0.6875rem", { lineHeight: "1rem" }],
      },
      transitionTimingFunction: {
        "out-soft": "cubic-bezier(0.22, 1, 0.36, 1)",
      },
    },
  },
  plugins: [],
};

export default config;
