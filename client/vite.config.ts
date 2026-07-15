import path from 'node:path';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, path.resolve(__dirname, '..'), '');
  const apiTarget = env.GU_API_TARGET || 'http://127.0.0.1:8080';
  const isLiveApi = apiTarget.startsWith('https://');

  return {
    plugins: [react()],
    envDir: path.resolve(__dirname, '..'),
    server: {
      port: 5173,
      proxy: {
        '/api': {
          target: apiTarget,
          changeOrigin: true,
          secure: isLiveApi,
          cookieDomainRewrite: '127.0.0.1',
          configure: (proxy) => {
            proxy.on('proxyRes', (proxyRes) => {
              const sc = proxyRes.headers['set-cookie'];
              if (sc) {
                proxyRes.headers['set-cookie'] = sc.map((c) => c.replace(/;\\s*Secure/gi, ''));
              }
            });
          },
        },
        '/uploads': {
          target: apiTarget,
          changeOrigin: true,
          secure: isLiveApi,
        },
      },
    },
    build: {
      outDir: 'dist',
      emptyOutDir: true,
    },
  };
});
