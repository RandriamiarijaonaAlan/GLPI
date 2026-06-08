import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      "/glpi-api-v1": {
        target: "http://glpi.localhost",
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/glpi-api-v1/, "/api.php/v1"),
      },

      "/glpi-api-v2": {
        target: "http://glpi.localhost",
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/glpi-api-v2/, "/api.php/v2.3"),
      },

      "/glpi-token": {
        target: "http://glpi.localhost",
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/glpi-token/, "/api.php/token"),
      },
    },
  },
});