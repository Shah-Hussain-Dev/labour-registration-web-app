import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      "/yolo-hms-api": {
        target: "https://hms.yolohealth.in",
        changeOrigin: true,
        secure: true,
        rewrite: (p) => p.replace(/^\/yolo-hms-api/, "/api"),
      },
    },
  },
});
