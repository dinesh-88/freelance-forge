/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      fontFamily: {
        display: ["\"Space Grotesk\"", "ui-sans-serif", "system-ui"],
        body: ["\"Source Sans 3\"", "ui-sans-serif", "system-ui"],
      },
      colors: {
        ink: "#0F1419",
        cloud: "#F2F5F7",
        ember: "#2AA7A1",
        moss: "#1F6F6B",
        slate: "#2F3A44",
        haze: "#B8C1CC",
      },
      boxShadow: {
        glow: "0 12px 50px rgba(42, 167, 161, 0.25)",
        lift: "0 18px 60px rgba(15, 20, 30, 0.12)",
      },
      borderRadius: {
        xl: "18px",
      },
    },
  },
  plugins: [],
};
