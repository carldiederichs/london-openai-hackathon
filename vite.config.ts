import { defineConfig } from "vite";
export default defineConfig({
  // Lazy scene/practice chunks share the same prebundled React dispatcher.
  optimizeDeps: {
    include: [
      "react",
      "react-dom/client",
      "react/jsx-dev-runtime",
      "react-dom/server",
    ],
  },
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
