import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  // Relative base so assets load whether served at a custom domain root
  // (admin.roosterclub.co.in) or a github.io/<repo> subpath.
  base: './',
  plugins: [react()],
  server: { port: 5180 },
  // Libraries go in their own files: they rarely change, so after a deploy
  // the phone only re-downloads the app code, not React/Supabase/charts again.
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          react: ['react', 'react-dom'],
          supabase: ['@supabase/supabase-js'],
          charts: ['recharts'],
        },
      },
    },
    chunkSizeWarningLimit: 700,
  },
});
