/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./App.{js,jsx,ts,tsx}", "./src/**/*.{js,jsx,ts,tsx}"],
  presets: [require("nativewind/preset")],
  theme: {
    extend: {
      colors: {
        background: "#FBF9F5",
        foreground: "#1F1D1A",
        border: "#E2DDD4",
        card: "#FFFFFF",
        primary: {
          DEFAULT: "#E8732A",
          50: "#FDF2EC",
          100: "#FBE4D8",
          200: "#F6C4AC",
          300: "#F1A47F",
          400: "#EC8353",
          500: "#E8732A", // Signature VIGIL Matte Orange
          600: "#C75C1D",
          700: "#994716",
          800: "#6E3310",
          900: "#441F0A",
        },
        secondary: {
          DEFAULT: "#EFECE6",
          foreground: "#262320",
          border: "#DCD5CB",
        },
        muted: {
          DEFAULT: "#F3F0EA",
          foreground: "#7B736B",
        },
        telemetry: {
          moving: "#10B981",
          idle: "#F59E0B",
          destructive: "#E11D48",
        },
        dark: {
          50: "#1A1B1C",
          100: "#141515",
          200: "#0F1010",
          300: "#0A0B0B",
          400: "#060707",
          500: "#040504",
          600: "#030403",
          700: "#020302",
          800: "#010201",
          900: "#000100",
        },
      },
    },
  },
  plugins: [],
};
