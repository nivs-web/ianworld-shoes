"""RTDB 전송량·요금 모델 (2026-11-04). docs/MEMBER_REDESIGN_2026-11-04.md 의 표를 만든 계산.
   python tools/_cost-model.py
   열: (지금, a57a8ab 고친 뒤, 재설계). 가정은 문서 2장."""
import sys
sys.stdout.reconfigure(encoding='utf-8')
H = 3600

def comp(N):
    V = 0.10 * N; W = 0.20 * N
    card, hb_old, hb_new, scan = 250, 110, 90, 10_000
    r = {}
    r['접속자 목록 화면'] = (V*(N/15)*hb_old*H + V*N*card, V*(min(N, 100)/15)*hb_new*H + V*min(N, 100)*card, 0)
    r['대기방 유령 확인'] = (W/5*N*card*H, W/5*2*40*H, W/5*2*40*H)
    r['방 목록 열기'] = (N*6*(scan+N*card), N*6*(scan+48*40), N*6*(scan+48*40))
    rooms = 0.3*N/2
    r['결투 상대 위치'] = (rooms*2*10*90*H, rooms*2*5*90*H, rooms*2*5*90*H)
    sp = 0.1*N
    r['레이스 진행'] = (sp*3.3*3*120*H, sp*2*3*120*H, sp*2*3*120*H)
    common = 0.3*N*130*H + 0.3*N/5*90*H + sp*3/5*90*H
    r['게임 진행·생존 신호'] = (common, common, common)
    r['쪽지함'] = (N*200*150, N*200*150, N*30*150)
    r['친구 접속 확인'] = (0, 0, N*2*20*40)
    r['운영자 통계'] = (0, 0, N*60 + 2*N*40)
    return r

for N in (100, 1000):
    r = comp(N); tot = [0, 0, 0]
    print(f'\n=== 동시접속 {N}명, 1시간당 MB (지금 / 고친뒤 / 재설계) ===')
    for k, v in r.items():
        print(f'{k:14s} ' + ' '.join(f'{x/1e6:10.1f}' for x in v))
        for i in range(3): tot[i] += v[i]
    for i, name in enumerate(['지금', '고친뒤', '재설계']):
        gbm = tot[i]/1e9*120
        print(f'  {name}: {tot[i]/1e6:.0f}MB/h · 월 {gbm:.0f}GB → Blaze 약 ${max(0, gbm-10.8):.0f}/월')
