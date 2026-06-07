/** @type {import('tailwindcss').Config} */
/** Keep in sync with src/constants/design.ts PALETTE + SEMANTIC. */
module.exports = {
  content: ["./src/**/*.{js,jsx,ts,tsx}"],
  presets: [require("nativewind/preset")],
  theme: {
    extend: {
      colors: {
        surface: {
          base: "#EFEFF4",
          raised: "#FFFFFF",
          card: "#FFFFFF",
          elevated: "#FFFFFF",
          border: "#C6C6C8",
        },
        transit: {
          train: "#F06724",
          metro: "#00A9CE",
          bus: "#00B5EF",
          lightrail: "#E31837",
          ferry: "#008A44",
          subway: "#00A9CE",
        },
        brand: {
          primary: "#0079C1",
          secondary: "#34C759",
          background: "#EFEFF4",
          card: "#FFFFFF",
          text: "#000000",
          textMuted: "#6D6D72",
          border: "#C6C6C8",
        },
      },
    },
  },
  plugins: [],
};
