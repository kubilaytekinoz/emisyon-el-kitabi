import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Köprü ile aynı hostta, yalnızca /rehber/ altında çalışır.
export default defineConfig({
  base: '/rehber/',
  plugins: [react()],
  server: {
    port: 5173,
    proxy: { '/rehber/api': 'http://127.0.0.1:4000' }
  },
  build: { outDir: 'dist', emptyOutDir: true }
});
