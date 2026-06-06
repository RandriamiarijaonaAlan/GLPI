import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/glpi-api-v1': {
        target: 'http://localhost',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/glpi-api-v1/, '/glpi/api.php/v1'),
      },
      '/glpi-api-v2': {
        target: 'http://localhost',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/glpi-api-v2/, '/glpi/api.php/v2.3'),
      },
    },
  },
});
