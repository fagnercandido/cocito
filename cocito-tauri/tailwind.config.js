/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        bg: "var(--bg)",
        surface: "var(--surface)",
        "surface-2": "var(--surface-2)",
        text: "var(--text)",
        "text-dim": "var(--text-dim)",
        accent: "var(--accent)",
        border: "var(--border)",
      },
      fontFamily: {
        sans: "var(--ff-sans)",
        serif: "var(--ff-serif)",
        mono: "var(--ff-mono)",
      },
      transitionTimingFunction: {
        "out-smooth": "cubic-bezier(0.22, 1, 0.36, 1)",
      },
    },
  },
  plugins: [],
};
