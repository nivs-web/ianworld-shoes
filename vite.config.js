import { defineConfig } from 'vite';

export default defineConfig({
  base: '/',
  server: {
    host: true,
    port: 5173,
  },
  build: {
    outDir: 'dist',
    assetsInlineLimit: 0, // PNG를 base64로 인라인하지 않는다 (픽셀 에셋은 항상 파일로)
    target: 'es2020',
    rollupOptions: {
      output: {
        // Firebase는 무거우므로 분리해서 초기 로딩에서 제외
        manualChunks(id) {
          if (id.includes('node_modules/firebase') || id.includes('node_modules/@firebase')) {
            return 'firebase';
          }
        },
      },
    },
  },
});
