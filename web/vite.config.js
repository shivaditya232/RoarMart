import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// In development the React app runs on Vite (port 5173) and forwards API calls and the
// live Socket.io connection to the RoarMart server on port 4000.
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      '/api': 'http://localhost:4000',
      '/socket.io': { target: 'http://localhost:4000', ws: true },
    },
  },
});
