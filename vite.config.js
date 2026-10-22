import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');

  return {
    plugins: [react()],
    server: {
      port: Number(env.PORT) || 7115,
      // Forward the push API to a locally running push server (server/).
      proxy: {
        '/api/push': `http://127.0.0.1:${env.PUSH_SERVER_PORT || 3100}`,
      },
    },
    preview: {
      port: Number(env.PORT) || 7115,
    },
    test: {
      environment: 'jsdom',
      setupFiles: './src/setupTests.js',
      include: ['src/**/*.test.{js,jsx,ts,tsx}'],
      // One jsdom per worker instead of one per file, still isolated per file.
      pool: 'vmThreads',
      // Leaves CPU for jsdom work, which keeps timing sensitive tests stable.
      maxWorkers: '50%',
    },
  };
});
