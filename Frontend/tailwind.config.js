/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      fontFamily: {
        sans: ["Inter", "ui-sans-serif", "system-ui", "sans-serif"],
      },
      colors: {
        ink: "#202622",
        teal: "#0f9f8f",
        tomato: "#f26b4f",
        saffron: "#eab308",
      },
      boxShadow: {
        panel: "0 12px 30px rgba(32, 38, 34, 0.08)",
      },
    },
  },
  plugins: [],
};
