import { fileURLToPath } from 'node:url';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';
import { config } from '../server/config.js';
const target = 'http://127.0.0.1:' + config.port;
export default defineConfig({
  root: fileURLToPath(new URL('.', import.meta.url)),
  plugins: [react()],
  server: { port: 5173, strictPort: true, proxy: { '/api': target, '/covers': target } },
});
