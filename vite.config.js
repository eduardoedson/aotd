import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');

  return {
    plugins: [react()],
    server: {
      port: Number(env.PORT) || 7115,
    },
    preview: {
      port: Number(env.PORT) || 7115,
    },
    test: {
      environment: 'jsdom',
      setupFiles: './src/setupTests.js',
    },
  };
});
