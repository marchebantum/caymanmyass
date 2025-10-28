import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5175, // Use port 5175 to avoid conflicts with agent dashboard (5174)
    host: true
  },
  optimizeDeps: {
    exclude: ['lucide-react'],
  },
});
