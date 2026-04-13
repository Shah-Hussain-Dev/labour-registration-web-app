import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");
  const googleMapsKey =
    env.GOOGLE_MAP_API ||
    env.VITE_GOOGLE_MAP_API ||
    env.VITE_GOOGLE_MAPS_API_KEY ||
    "AIzaSyBlQWQorcsM6UNRANCvUF11LyGdFexBNEA";

  return {
    plugins: [react()],
    server: {
      proxy: {
        "/yolo-hms-api": {
          target: "https://hms.yolohealth.in",
          changeOrigin: true,
          secure: true,
          rewrite: (p) => p.replace(/^\/yolo-hms-api/, "/api"),
        },
        /* Dev: same-origin fetch to /api/healthatm/v1/... → system.healthatm.com/api/v1/... */
        "/api/healthatm": {
          target: "https://system.healthatm.com",
          changeOrigin: true,
          secure: true,
          rewrite: (p) => p.replace(/^\/api\/healthatm/, "/api"),
        },
        "/api/maps/static": {
          target: "https://maps.googleapis.com",
          changeOrigin: true,
          configure(proxy) {
            proxy.on("proxyReq", (proxyReq, req) => {
              const reqUrl = req.url || "";
              const qi = reqUrl.indexOf("?");
              const qs = qi >= 0 ? reqUrl.slice(qi + 1) : "";
              const params = new URLSearchParams(qs);
              params.set("key", googleMapsKey);
              proxyReq.path = `/maps/api/staticmap?${params.toString()}`;
            });
          },
        },
        "/api/maps/geocode": {
          target: "https://maps.googleapis.com",
          changeOrigin: true,
          configure(proxy) {
            proxy.on("proxyReq", (proxyReq, req) => {
              const reqUrl = req.url || "";
              const qi = reqUrl.indexOf("?");
              const qs = qi >= 0 ? reqUrl.slice(qi + 1) : "";
              const incoming = new URLSearchParams(qs);
              const latlng = incoming.get("latlng") || "";
              const params = new URLSearchParams();
              params.set("latlng", latlng);
              params.set("key", googleMapsKey);
              proxyReq.path = `/maps/api/geocode/json?${params.toString()}`;
            });
          },
        },
      },
    },
  };
});
