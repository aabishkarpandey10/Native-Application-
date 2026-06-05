/** @type {import('tailwindcss').Config} */
module.exports = {
  // NOTE: Update this to include the paths to all of your component files.
  content: ["./src/**/*.{js,jsx,ts,tsx}"],
  presets: [require("nativewind/preset")],
  theme: {
    extend: {
      colors: {
        surface: {
          base: "#0A0A0C",
          raised: "#111114",
          card: "#1A1A1F",
          elevated: "#222228",
          border: "#2C2C32",
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
          primary: "#0A84FF",
          secondary: "#30D158",
          background: "#0A0A0C",
          card: "#1A1A1F",
          text: "#FFFFFF",
          textMuted: "#8E8E93",
          border: "#2C2C32",
        },
      },
    },
  },
  plugins: [],
}
