import { defineConfig } from "vite";
export default defineConfig({
  server: {
    host: "0.0.0.0",
    port: 4173,
    strictPort: true,
    proxy: {
      "/api": { target: "http://127.0.0.1:4174", changeOrigin: false },
      "/socket.io": {
        target: "http://127.0.0.1:4174",
        ws: true,
        changeOrigin: false,
      },
    },
  },
});
