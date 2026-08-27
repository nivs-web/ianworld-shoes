# -*- coding: utf-8 -*-
"""위에서 내려다본 드래곤 도트를 짓는다.

세로 모드에서는 **위에서 내려다본다.** 옆모습 도트를 그대로 쓰면 용이 옆으로
누워 나는 것처럼 보인다. 그래서 같은 격자 크기로 **윗모습 한 벌**을 더 만든다.

## 왜 손으로 안 치고 짓는가

32줄 x 36칸을 손으로 치면 **좌우가 절대 안 맞는다.** 위에서 본 그림은 좌우가
정확히 대칭이라 한 칸만 어긋나도 눈에 띈다. 그래서 가운데 줄을 축으로 잡고
**반쪽만 계산해서 거울로 붙인다.**

## 방향

머리는 **오른쪽**이다 - 옆모습 도트와 같은 약속이다. 세로에서는 판이 90도
돌아가므로 논리 +x(오른쪽)가 화면 위가 되고, 그래서 머리가 화면 위를 본다.
좌우 반전(적).명중 판정.주둥이 위치가 전부 그대로 맞아떨어진다.

고칠 일이 있으면 이 파일을 고쳐서 다시 돌린다:
    python tools/_gen-topdown.py
"""
import io, sys


# -- 격자 도구 ---------------------------------------------------
class Grid:
    def __init__(self, cols, rows):
        self.cols, self.rows = cols, rows
        self.cy = rows / 2.0
        self.g = [['.'] * cols for _ in range(rows)]

    def put(self, x, y, ch):
        x, y = int(round(x)), int(round(y))
        if 0 <= x < self.cols and 0 <= y < self.rows:
            self.g[y][x] = ch

    def mput(self, x, dy, ch):
        """축에서 dy 만큼 위와 아래에 같이 찍는다 (좌우 대칭 보장).

        ★ dy 를 **먼저 정수로 만든 뒤** 위아래에 나눠 찍는다.
        반올림을 위아래에서 따로 하면 15.5 가 위에서는 15, 아래에서는 16 이
        되어 **가운데 줄 하나가 통째로 비는** 일이 생긴다 (실제로 그랬다).
        """
        self.sput(x, dy, -1, ch)
        self.sput(x, dy, 1, ch)

    def sput(self, x, dy, sgn, ch):
        """축에서 dy 만큼 한쪽에만 찍는다 (sgn = -1 위 / 1 아래)."""
        d = int(round(dy))
        h = self.rows // 2
        self.put(x, (h + d) if sgn > 0 else (h - 1 - d), ch)

    def outlined(self):
        """칠해진 칸 바깥에 K 를 두른다. 손으로 두르면 반드시 빠뜨린다."""
        out = [row[:] for row in self.g]
        for y in range(self.rows):
            for x in range(self.cols):
                if self.g[y][x] != '.':
                    continue
                for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)):
                    nx, ny = x + dx, y + dy
                    if (0 <= nx < self.cols and 0 <= ny < self.rows
                            and self.g[ny][nx] not in ('.', 'K')):
                        out[y][x] = 'K'
                        break
        return out

    def rows_str(self, outline=True):
        g = self.outlined() if outline else self.g
        return [''.join(r) for r in g]


def js(name, grids, comment, multi=False):
    def one(rows, ind):
        return ',\n'.join(ind + "'" + r + "'" for r in rows)
    if multi:
        body = ',\n'.join('  [\n' + one(r, '    ') + '\n  ]' for r in grids)
    else:
        body = one(grids, '  ')
    return '/** %s */\nconst %s = [\n%s\n];\n' % (comment, name, body)


# -- 몸통 --------------------------------------------------------
def body_grid(cols, rows, prof, eye_x, snout_x, plate=None, legs=()):
    """prof(x) : 축 위아래 반쪽 두께(칸)."""
    G = Grid(cols, rows)
    for x in range(cols):
        h = prof(x)
        if h <= 0.2:
            continue
        dy = 0
        while dy <= h:
            t = dy / max(h, 0.001)
            tail = x < cols * 0.28
            ch = 'T' if tail else ('L' if t < 0.34 else 'M' if t < 0.72 else 'D')
            G.mput(x, dy, ch)
            dy += 1
    # 등줄기 갑주 - 축을 따라 한 줄
    if plate:
        for x in range(plate[0], plate[1]):
            G.mput(x, 0, 'P')
            G.mput(x, 1, 'P')
    # 다리 넷 - 두 칸 폭 통짜. 한 칸씩 흩으면 외곽선이 파고들어 부서져 보인다
    for (hx, reach) in legs:
        for k in range(6):
            G.mput(hx, reach - 4.0 + k * 0.8, 'D')
            G.mput(hx + 1, reach - 4.0 + k * 0.8, 'D')
        G.mput(hx, reach + 0.9, 'C')
        G.mput(hx + 1, reach + 0.9, 'C')
    # 눈 - 위에서 보면 옆통수에 하나씩 붙어 있다
    G.mput(eye_x, 2.4, 'E')
    G.mput(eye_x + 1, 2.4, 'E')
    G.mput(eye_x, 1.4, 'H')
    # 이빨 . 콧구멍
    G.mput(snout_x - 2, 2.6, 'W')
    G.mput(snout_x - 1, 1.8, 'W')
    G.mput(snout_x, 1.0, 'N')
    return G.rows_str()


# -- 날개 --------------------------------------------------------
def wing_grid(cols, rows, root, spread):
    """위에서 본 날갯짓은 **폭이 줄었다 늘었다** 하는 것으로 보인다.

    폭만 변하면 숨쉬는 것처럼 보이므로 앞뒤로 젖히는 각도도 같이 준다.
    """
    G = Grid(cols, rows)
    x0b, x1b = root
    # ★ 짧게 잡으면 **날개가 안 보인다.** 위에서 본 용은 날개가 몸보다 넓다 —
    #   처음에 rows*0.42 로 잡았더니 몸통에 붙은 지느러미처럼 보였다.
    reach = rows * 0.30 + spread * (rows * 0.50 - rows * 0.30)
    steps = int(reach * 4)
    for k in range(steps + 1):
        t = k / float(steps)
        dy = 2.0 + t * (reach - 2.0)
        # ★ 앞뒤 가장자리가 **둘 다 뒤로 젖혀지되 뒷쪽이 더 빨리** 젖혀진다.
        #   그래야 끝이 뾰족한 삼각 날개가 된다. 둘을 같은 속도로 젖히면
        #   폭이 그대로라 판때기가 된다 (한 번 그렇게 나왔다).
        x0 = x0b + 1.5 - t * (2.0 + (1 - spread) * 4.0)
        x1 = x1b + 2.5 - t * (6.0 + (1 - spread) * 5.0)
        span = x1 - x0
        if span < 1:
            break
        n = int(span)
        for i in range(n + 1):
            # 앞 가장자리만 뼈(f), 맨 뒤 한 줄만 뒷선(k). 양쪽을 두 줄씩 쓰면
            # 막(w)이 남지 않아 날개가 그냥 어두운 막대가 된다
            ch = 'f' if i == 0 else ('k' if i >= n else 'w')
            G.mput(x0 + i, dy, ch)
    return G.rows_str()


# -- 뿔 열 벌 ----------------------------------------------------
# (갈래 수, 뻗는 길이, 뒤로 젖힘, 벌어짐, 끝에 가시)
HORN_STYLES = [
    (2, 5.0, 2.6, 1.1, 0),   # 0 뒤로 젖힌 쌍뿔
    (5, 4.2, 0.4, 0.9, 0),   # 1 햇살
    (4, 3.4, 1.2, 0.5, 0),   # 2 지느러미 부채
    (3, 5.6, 2.0, 1.6, 1),   # 3 사슴뿔
    (2, 4.4, 0.8, 2.4, 1),   # 4 황소뿔
    (6, 3.0, 1.6, 1.0, 1),   # 5 가시다발
    (1, 6.4, 0.0, 0.0, 1),   # 6 외뿔
    (5, 4.8, 1.0, 1.4, 1),   # 7 서리 왕관
    (2, 3.2, 3.4, 0.6, 0),   # 8 유선형
    (2, 4.6, 1.4, 2.8, 0),   # 9 숫양뿔
]


def horn_grid(cols, rows, base_x, style):
    n, length, back, flare, tip = style
    G = Grid(cols, rows)
    for i in range(n):
        # 갈래를 축 기준으로 고르게 편다. 홀수면 가운데 갈래가 축 위에 온다
        u = 0.0 if n == 1 else (i / (n - 1.0)) * 2 - 1
        steps = int(length * 3)
        for k in range(steps + 1):
            t = k / float(steps)
            if u == 0:
                # 가운데 갈래는 **한 줄만** — 위아래로 찍으면 두 갈래로 보인다
                G.sput(base_x + t * length * 0.8, 0, -1, 'G')
                continue
            x = base_x - back * t + (1 - abs(u)) * t * 1.4
            dy = abs(u) * (1.6 + flare * t * 2.2) + t * 0.6
            G.sput(x, dy, 1 if u > 0 else -1, 'G')
        if tip and u != 0:
            x = base_x - back + (1 - abs(u)) * 1.4
            dy = abs(u) * (1.6 + flare * 2.2) + 0.6
            G.sput(x - 1, dy + 1, 1 if u > 0 else -1, 'G')
    return G.rows_str()


# -- 등가시 . 꼬리칼날 . 아가리 ----------------------------------
def ridge_grid(cols, rows, span):
    G = Grid(cols, rows)
    for x in range(span[0], span[1], 2):
        G.mput(x, 0, 'S')
        G.mput(x, 1, 'S')
    return G.rows_str()


def tail_grid(cols, rows, tip_x):
    """꼬리 칼날 - 위에서 보면 좌우로 벌어진 날이다."""
    G = Grid(cols, rows)
    for k in range(5):
        G.mput(tip_x + k * 0.6, 0.6 + k * 0.9, 'S')
        G.mput(tip_x + k * 0.6, 1.4 + k * 0.9, 'S')
    return G.rows_str()


def maw_grid(cols, rows, snout_x):
    """벌린 아가리 - 위에서 보면 주둥이가 좌우로 갈라진다."""
    G = Grid(cols, rows)
    for k in range(5):
        G.mput(snout_x - k, 0.8 + k * 0.55, 'W')
    return G.rows_str()


# -- 위에서 본 기수 ----------------------------------------------
def rider_grid(cols, rows, cx, head='z', torso='a', face='r', crown=None):
    """용 등에 올라탄 사람을 위에서 본 모습 - 머리.어깨.양팔이 전부다.

    다리는 용에 가려 안 보인다. 위에서 본 사람의 특징은 **어깨의 가로선**이다.
    """
    G = Grid(cols, rows)
    for dy in range(3):                      # 어깨
        for x in range(cx - 2, cx + 3):
            G.mput(x, dy, torso)
    for dy in range(2):                      # 머리 (어깨 앞쪽)
        for x in range(cx + 2, cx + 5):
            G.mput(x, dy, head)
    G.mput(cx + 4, 0, face)                  # 얼굴
    for k in range(3):                       # 팔 - 옆으로 뻗어 고삐를 잡는다
        G.mput(cx + k, 3 + k * 0.4, 'A')
    if crown:
        for x in range(cx + 1, cx + 6, 2):
            G.mput(x, 3, crown)
    return G.rows_str()


# -- 윤곽 --------------------------------------------------------
def prof_B(x):
    """36x32 몸통. 구간을 나눠 손으로 잡았다 - 매끄러운 수식 하나로는
    '목이 잘록하고 머리가 다시 벌어진다' 는 용의 윤곽이 안 나온다."""
    if x < 2:   return 0
    if x < 10:  return 0.5 + (x - 2) * 0.22      # 꼬리 끝 -> 꼬리
    if x < 14:  return 2.3 + (x - 10) * 0.78     # 엉덩이
    if x < 17:  return 5.4 + (x - 14) * 0.22     # 몸통
    if x < 21:  return 6.1 - (x - 17) * 0.30     # 가장 넓은 곳
    if x < 25:  return 4.9 - (x - 21) * 0.85     # 목 (잘록하다)
    if x < 28:  return 1.5 + (x - 25) * 0.95     # 머리 (다시 벌어진다)
    if x < 31:  return 4.3 - (x - 28) * 0.62     # 볼 -> 주둥이
    if x < 34:  return 2.4 - (x - 31) * 0.70     # 주둥이 -> 코끝
    return 0


def prof_A(x):
    """30x28 몸통. 같은 짜임이되 머리가 조금 더 크다 (어린 용)."""
    if x < 2:   return 0
    if x < 9:   return 0.5 + (x - 2) * 0.26
    if x < 12:  return 2.3 + (x - 9) * 0.80
    if x < 16:  return 4.7 + (x - 12) * 0.10
    if x < 20:  return 5.1 - (x - 16) * 0.90
    if x < 23:  return 1.5 + (x - 20) * 1.05
    if x < 26:  return 4.6 - (x - 23) * 0.75
    if x < 29:  return 2.3 - (x - 26) * 0.72
    return 0


out = ['/* ' + '=' * 62 + '\n'
       '   위에서 내려다본 도트 - 세로 모드용\n'
       '   * 손으로 고치지 말 것. `tools/_gen-topdown.py` 가 만든다.\n'
       '   ' + '=' * 62 + ' */']

out.append(js('B_TOP_BODY',
              body_grid(36, 32, prof_B, 27, 32, plate=(11, 24),
                        legs=((12, 8.0), (21, 7.6))),
              '위에서 본 몸통 B (36x32, 머리는 오른쪽)'))
out.append(js('B_TOP_WINGS',
              [wing_grid(36, 32, (14, 26), s) for s in (1.0, 0.76, 0.52, 0.76)],
              '위에서 본 날갯짓 B - 활짝 / 접는 중 / 좁게 / 펴는 중', multi=True))
out.append(js('B_TOP_HORNS', [horn_grid(36, 32, 29, st) for st in HORN_STYLES],
              '위에서 본 뿔 열 벌 - 옆모습 뿔과 순서가 같다', multi=True))
out.append(js('B_TOP_RIDGE', ridge_grid(36, 32, (12, 25)), '위에서 본 등가시 B'))
out.append(js('B_TOP_TAIL', tail_grid(36, 32, 3), '위에서 본 꼬리칼날 B'))
out.append(js('B_TOP_MAW', maw_grid(36, 32, 33), '위에서 본 벌린 아가리 B'))
out.append(js('B_TOP_RIDER_KNIGHT', rider_grid(36, 32, 15, 'a', 'a', 'r'),
              '위에서 본 갑옷 기사'))
out.append(js('B_TOP_RIDER_KING', rider_grid(36, 32, 15, 'z', 'a', 'r', crown='o'),
              '위에서 본 왕관 쓴 좀비 로드'))
out.append(js('A_TOP_BODY',
              body_grid(30, 28, prof_A, 22, 27, plate=(9, 20),
                        legs=((10, 6.8), (17, 6.4))),
              '위에서 본 몸통 A (30x28)'))
out.append(js('A_TOP_WINGS',
              [wing_grid(30, 28, (11, 22), s) for s in (1.0, 0.76, 0.52, 0.76)],
              '위에서 본 날갯짓 A', multi=True))
out.append(js('A_TOP_CREST', horn_grid(30, 28, 24, HORN_STYLES[0]), '위에서 본 뿔 A'))
out.append(js('A_TOP_RIDGE', ridge_grid(30, 28, (10, 21)), '위에서 본 등가시 A'))
out.append(js('A_TOP_RIDER', rider_grid(30, 28, 12, 'z', 'a', 'r'),
              '위에서 본 작은 좀비 기수'))

io.open('tools/_out/top_art.js', 'w', encoding='utf-8').write('\n'.join(out))

if '-q' not in sys.argv:
    for r in body_grid(36, 32, prof_B, 27, 32, plate=(11, 24),
                       legs=((12, 8.0), (21, 7.6))):
        sys.stdout.write(r + '\n')
    sys.stdout.write('-' * 36 + '\n')
    for r in wing_grid(36, 32, (16, 25), 1.0):
        sys.stdout.write(r + '\n')
    sys.stdout.write('-' * 36 + '\n')
    for r in horn_grid(36, 32, 29, HORN_STYLES[3]):
        sys.stdout.write(r + '\n')
