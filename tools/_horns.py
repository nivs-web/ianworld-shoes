# -*- coding: utf-8 -*-
"""드래곤 뿔 생성기 — `src/games/dragon/dragon.js` 의 `B_HORNS` 를 다시 만든다.

★ 왜 손으로 찍지 않고 만들어내는가
드래곤을 20~30 마리까지 늘릴 계획이다. 36x32 도트를 서른 벌 손으로 찍는 것은
감당이 안 되고, 하나 고칠 때마다 외곽선을 다시 세어야 한다.
그래서 **뼈대(G)만 그리고 외곽선(K)은 자동으로 두른다** —
새 뿔 하나를 더하는 일이 아래에 함수 하나 적는 일이 된다.

    python tools/_horns.py

지켜야 할 것 둘 (스크립트가 직접 검사한다):
  · 0줄은 비워 둔다 — 거기까지 올라간 뿔은 화면 위에서 **뭉툭하게 잘린다**
  · 두개골 윗면(7줄)보다 위에 G 가 넉넉히 있어야 한다 — 안 그러면 뿔이 안 보인다
"""
import io
import math

W, H = 36, 32
TOP_SAFE = 1          # 0줄은 비워 둔다
SKULL_ROW = 7         # 두개골 윗면


def blank():
    return [['.'] * W for _ in range(H)]


def put(g, x, y, ch='G'):
    x, y = int(round(x)), int(round(y))
    if 0 <= x < W and TOP_SAFE <= y < H:
        g[y][x] = ch


def horn(g, x, y, n, dx, dy, thick=2, taper=True):
    """밑동 (x,y) 에서 (dx,dy) 방향으로 n 칸. 끝으로 갈수록 가늘어진다."""
    fx, fy = float(x), float(y)
    for i in range(n):
        t = i / max(1, n - 1)
        w = max(1, int(round(thick * (1 - t * 0.75)))) if taper else thick
        for k in range(w):
            put(g, fx + k, fy)
        fx += dx
        fy += dy


def curl(g, cx, cy, n, r, start, sweep, thick=2):
    """숫양처럼 말린 뿔."""
    for i in range(n):
        t = i / max(1, n - 1)
        a = start + sweep * t
        rr = r * (1 - t * 0.42)
        px = cx + math.cos(a) * rr
        py = cy + math.sin(a) * rr
        w = max(1, int(round(thick * (1 - t * 0.5))))
        for k in range(w):
            put(g, px + k, py)


def outline(g):
    """G 에 닿은 빈 칸을 K 로 두른다 — 몸통과 같은 굵기의 검은 테두리."""
    out = [row[:] for row in g]
    for y in range(H):
        for x in range(W):
            if g[y][x] != '.':
                continue
            for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1),
                           (1, 1), (-1, -1), (1, -1), (-1, 1)):
                nx, ny = x + dx, y + dy
                if 0 <= nx < W and 0 <= ny < H and g[ny][nx] == 'G':
                    out[y][x] = 'K'
                    break
    return out


# ── 열 마리의 뿔 ────────────────────────────────────────────
# 두개골 꼭대기는 7줄, 가로로는 20~30칸 언저리다. 뿔은 거기서 위로 자란다.
# 갈래 사이는 두 칸 이상 띄운다 — 붙으면 외곽선이 이어져 덩어리로 보인다.

def d0(g):   # 노바트 — 뒤로 젖혀진 쌍뿔 (처음 함께하는 드래곤)
    horn(g, 26, 7, 6, -0.85, -0.95, 2)
    horn(g, 31, 7, 5, 0.45, -1.05, 2)


def d1(g):   # 솔라리스 — 햇살처럼 곧게 뻗은 세 갈래
    horn(g, 22, 7, 4, -0.30, -1.0, 2)
    horn(g, 26, 7, 6, 0.0, -1.0, 2)
    horn(g, 30, 7, 4, 0.30, -1.0, 2)


def d2(g):   # 아쿠안티스 — 지느러미 부채 (낮고 넓게)
    for i, hgt in enumerate([2, 3, 4, 3, 2]):
        horn(g, 22 + i * 3, 7, hgt, 0.10, -1.0, 1, taper=False)
    for x in range(22, 34):
        put(g, x, 7)


def d3(g):   # 포레스티아 — 사슴뿔 (가지가 갈라진다)
    horn(g, 25, 7, 6, -0.30, -0.95, 2)
    horn(g, 23, 4, 3, -1.0, -0.35, 1)
    horn(g, 30, 7, 5, 0.50, -0.95, 2)
    horn(g, 32, 4, 3, 1.0, -0.30, 1)


def d4(g):   # 크림슨데 — 쌍뿔의 전사 (두껍고 짧은 황소뿔)
    horn(g, 23, 7, 4, -0.95, -0.75, 3)
    horn(g, 31, 7, 4, 0.95, -0.75, 3)


def d5(g):   # 프로스트윙 — 서리 왕관 (갈래마다 두 칸씩 띄운다)
    for i, hgt in enumerate([3, 5, 3]):
        horn(g, 23 + i * 4, 7, hgt, 0.0, -1.0, 2)


def d6(g):   # 볼트테일 — 외뿔 (하나가 크고 곧다)
    horn(g, 26, 7, 6, 0.20, -1.0, 3)


def d7(g):   # 샌드스케일 — 뒤로 눕힌 낮은 능선
    for i, hgt in enumerate([2, 3, 4, 3]):
        horn(g, 22 + i * 3, 7, hgt, -0.35, -1.0, 2)


def d8(g):   # 섀도우펜 — 길게 뒤로 젖힌 한 쌍 (빠른 느낌)
    horn(g, 30, 7, 9, -1.0, -0.55, 3)
    horn(g, 32, 6, 7, -1.0, -0.40, 2)


def d9(g):   # 골드렉스 — 말려 올라간 숫양뿔
    curl(g, 27, 6, 10, 4.4, 2.1, 3.6, 3)
    curl(g, 32, 6, 8, 3.2, 1.7, 3.0, 2)


HORNS = [d0, d1, d2, d3, d4, d5, d6, d7, d8, d9]


def build(fn):
    g = blank()
    fn(g)
    assert all(c == '.' for c in g[0]), '0줄까지 올라간 뿔은 잘린다'
    above = sum(1 for y in range(SKULL_ROW) for x in range(W) if g[y][x] == 'G')
    assert above >= 6, '두개골 위로 보이는 부분이 너무 적다 (%d칸)' % above
    return [''.join(r) for r in outline(g)], above


def main():
    p = 'src/games/dragon/dragon.js'
    s = io.open(p, encoding='utf-8').read()
    lines = []
    for n, fn in enumerate(HORNS):
        rows, above = build(fn)
        lines.append('  [   // %d' % n)
        lines.append(',\n'.join("    '%s'" % r for r in rows))
        lines.append('  ],')
        print('  %d: skull-top %d' % (n, above))

    i = s.index('const B_HORNS = [')
    j = s.index('\n];', i) + len('\n];')
    s = s[:i] + 'const B_HORNS = [\n' + '\n'.join(lines) + '\n];' + s[j:]
    io.open(p, 'w', encoding='utf-8').write(s)
    print('rebuilt %d horn sets' % len(HORNS))


if __name__ == '__main__':
    main()
