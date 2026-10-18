import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  plugins: [react(), tailwindcss()],
  build: {
    // ExcelJS (about 930 kB) is its own chunk, fetched only when a spreadsheet file is opened or downloaded.
    chunkSizeWarningLimit: 1000,
  },
});
