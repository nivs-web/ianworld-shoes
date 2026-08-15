import { defineConfig } from 'vite';

/**
 * 배포마다 달라지는 값. 서비스 워커를 `sw.js?v=…` 로 등록할 때 쓴다 —
 * 이게 없으면 브라우저는 sw.js 를 같은 파일로 보고 낡은 캐시를 계속 쓴다.
 * 버셀에서는 커밋 해시가 있으니 그걸 쓰고(같은 배포는 같은 값), 로컬은 시간으로 때운다.
 */
const BUILD_ID = (process.env.VERCEL_GIT_COMMIT_SHA || '').slice(0, 8) || Date.now().toString(36);

/**
 * ★ 환경변수 앞뒤 공백을 **굽기 전에** 잘라 낸다. (CLAUDE.md §9-0-13)
 *
 * 버셀 대시보드에 값을 붙여 넣을 때 줄바꿈이 딸려 들어간 적이 있다.
 * `VITE_FIREBASE_PROJECT_ID` 가 `"find-shoes-f5c55\n"` 으로 번들에 박히면서
 * 파이어스토어 요청이 전부 `projects/find-shoes-f5c55%0A/...` 로 나갔고,
 * 서버가 스트리밍 채널을 503으로 끊어 **명예의 전당이 통째로 죽어 있었다.**
 * 콘솔에는 멀쩡한 이름으로 찍혀서 눈으로는 찾을 수가 없다.
 */
for (const [k, v] of Object.entries(process.env)) {
  if (!k.startsWith('VITE_') || typeof v !== 'string' || v === v.trim()) continue;
  console.warn(`[build] ${k} 앞뒤에 공백/줄바꿈이 있어 잘라냈습니다 — 배포 환경변수도 다시 저장하세요`);
  process.env[k] = v.trim();
}

export default defineConfig({
  base: '/',
  define: { __BUILD_ID__: JSON.stringify(BUILD_ID) },
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
