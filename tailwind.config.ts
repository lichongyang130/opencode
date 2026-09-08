import type { Config } from "tailwindcss";

export default {
  content: ["./src/**/*.{ts,tsx}"],
  // 暗色由 <html class="dark"> 驱动（layout.tsx 内联脚本 + ShellSidebar 切换），
  // 显式声明后新组件可直接用 dark: 变体，无需再往 globals.css 里加全局覆盖规则
  darkMode: "class",
  theme: {
    extend: {
      colors: {
        brand: {
          50: "#faf4ee",
          100: "#f4e7db",
          200: "#e9cfba",
          300: "#dcb092",
          400: "#cf8a63",
          500: "#c7754a",
          600: "#c05f3c",
          700: "#a94f31",
          800: "#8a4029",
          900: "#703524",
        },
      },
    },
  },
  plugins: [],
} satisfies Config;
