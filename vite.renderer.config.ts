import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Le renderer utilise maintenant React comme couche de vue.
export default defineConfig({
  plugins: [react()],
});
