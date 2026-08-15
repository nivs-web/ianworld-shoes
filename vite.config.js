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
        // Firebase는 무거우므로 분리해서 초기 로딩에서 제외한다.
        // 한 덩어리로 두면 로그인 한 번 하려고 Firestore·RTDB까지 같이 내려받는다.
        // 실제로 필요해지는 시점이 다르므로 SDK별로 쪼갠다:
        //   auth   — 부팅 직후 (세션 복원)
        //   store  — 로그인 후 (프로필·도감)
        //   rtdb   — 멀티플레이 방 입장 (M7)
        manualChunks(id) {
          if (id.includes('@firebase/firestore') || id.includes('firebase/firestore')) {
            return 'firebase-store';
          }
          if (id.includes('@firebase/database') || id.includes('firebase/database')) {
            return 'firebase-rtdb';
          }
          if (id.includes('node_modules/firebase') || id.includes('node_modules/@firebase')) {
            return 'firebase';
          }
        },
      },
    },
  },
});
