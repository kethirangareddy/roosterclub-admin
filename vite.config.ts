import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  // Relative base so assets load whether served at a custom domain root
  // (admin.roosterclub.co.in) or a github.io/<repo> subpath.
  base: './',
  plugins: [react()],
  server: { port: 5180 },
});
