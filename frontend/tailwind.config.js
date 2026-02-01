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
        ink: "#0C0D10",
        cloud: "#F7F5F0",
        ember: "#F35C38",
        moss: "#0E5A3B",
        slate: "#2E343C",
        haze: "#B8BDC7",
      },
      boxShadow: {
        glow: "0 12px 50px rgba(243, 92, 56, 0.25)",
        lift: "0 18px 60px rgba(15, 20, 30, 0.12)",
      },
      borderRadius: {
        xl: "18px",
      },
    },
  },
  plugins: [],
};
