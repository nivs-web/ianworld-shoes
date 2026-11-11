import { defineConfig } from 'vite';
import fs from 'node:fs';
import path from 'node:path';
import { CONFIG as R2, liveBase, checkLive } from './tools/r2-assets.mjs';

/**
 * ★ 게임 그림 · 소리를 R2(oraksil.onstori.com)에서 내보낸다 (2026-11-11 · 설정 r2-assets.json · 도구 tools/r2-*.mjs)
 * 운영 빌드에서만 : live=true 인 게임의 prefix(예 /assets/iandragon_game/)를 R2 판 주소로 바꿔 끼운다(코드 · CSS 전부 한 곳에서).
 * strip=true 면 배포에서 그 파일을 빼는데, 빼기 전에 R2 에 하나도 빠짐없이 있는지 확인하고 없으면 빌드를 멈춘다.
 * 개발 서버는 그대로 로컬 파일 — 보조 · 겜팀장 작업 방식이 안 바뀐다.
 */
function r2Assets() {
  /* 시험용 : R2_LIVE=idg 면 설정과 상관없이 그 게임을 R2 로 · R2_DEV=1 이면 개발 서버에서도 (실제 화면으로 R2 확인할 때만) */
  const force = (process.env.R2_LIVE || '').split(',').filter(Boolean);
  const live = Object.entries(R2.games).filter(([gid, g]) => g.live || force.includes(gid));
  return {
    name: 'r2-assets', apply: (_, { command }) => command === 'build' || process.env.R2_DEV === '1', enforce: 'pre',
    transform(code, id) {
      if (!live.length || id.includes('node_modules') || !/\.(js|mjs|css|json)(\?|$)/.test(id)) return null;
      let out = code, hit = false;
      for (const [gid, g] of live) {
        if (Array.isArray(g.only)) { for (const rel of g.only) if (out.includes(g.prefix + rel)) { out = out.split(g.prefix + rel).join(liveBase(gid) + rel); hit = true; } }   // 파일 몇 개만
        else if (out.includes(g.prefix)) { out = out.split(g.prefix).join(liveBase(gid)); hit = true; }
      }
      return hit ? { code: out, map: null } : null;
    },
    async closeBundle() {
      for (const [gid, g] of live) {
        if (!g.strip) continue;
        const c = await checkLive(gid);
        if (!c.ok) throw new Error(`[r2] ${g.name} : R2 에 없는 파일 ${c.missing.length} · 크기 다름 ${c.badSize.length} · CORS 없음 ${c.noCors.length} → npm run r2:sync 먼저 (배포 멈춤)`);
        if (Array.isArray(g.only)) for (const rel of g.only) fs.rmSync(path.join('dist', g.prefix, rel), { force: true });
        else fs.rmSync(path.join('dist', g.prefix), { recursive: true, force: true });
        console.log(`[r2] ${g.name} : R2 ${c.total}개 확인 · 배포에서 뺌`);
      }
    },
  };
}

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
  plugins: [r2Assets()],
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
