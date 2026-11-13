"""브레스 색 아이콘 12종 : 기본 불꽃(breath_default.png)을 밝기 순위로 팔레트(lookFx BREATH_PAL)에 다시 칠한다. 외부 도구 없음 · 결정적.
   python tools/_breath-icons.py [--write]  (--write 없으면 미리보기 시트만)"""
import re, sys, colorsys
from PIL import Image
META='public/assets/iandragon_game/ai/meta/'
src=open('src/games/iandragon_game/data/lookFx.js',encoding='utf8').read()
blk=src[src.index('export const BREATH_PAL'):]; blk=blk[:blk.index('};')]
PAL={m.group(1):[int(h,16) for h in re.findall(r'0x([0-9a-fA-F]{6})',m.group(2))] for m in re.finditer(r'(\w+):\s*\[([^\]]*)\]',blk)}
base=Image.open(META+'breath_default.png').convert('RGBA'); W,H=base.size
px=base.load()
lum=lambda r,g,b:0.299*r+0.587*g+0.114*b
vals=sorted(lum(*px[x,y][:3]) for y in range(H) for x in range(W) if px[x,y][3]>0)
def rank(v):
    import bisect; return bisect.bisect_left(vals,v)/max(1,len(vals)-1)
rgb=lambda c:((c>>16)&255,(c>>8)&255,c&255)
L=8
def ramp(pal):
    cs=sorted((rgb(c) for c in pal),key=lambda c:lum(*c))
    dark=tuple(int(v*0.45) for v in cs[0])
    stops=[dark,cs[0],cs[1],cs[2],cs[3]]; return stops
def at(stops,t):
    f=t*(len(stops)-1); i=min(len(stops)-2,int(f)); u=f-i
    return tuple(int(round(stops[i][k]*(1-u)+stops[i+1][k]*u)) for k in range(3))
out={}
for name,pal in PAL.items():
    st=ramp(pal); im=Image.new('RGBA',(W,H),(0,0,0,0)); q=im.load()
    for y in range(H):
        for x in range(W):
            r,g,b,a=px[x,y]
            if a==0: continue
            t=round(rank(lum(r,g,b))*L)/L
            q[x,y]=at(st,t)+(a,)
    out[name]=im
if '--write' in sys.argv:
    for n,im in out.items(): im.save(META+f'breath_{n}.webp',lossless=True); print('쓰기',f'breath_{n}.webp')
sheet=Image.new('RGBA',(W*6,H*2),(40,30,70,255))
for i,(n,im) in enumerate(out.items()): sheet.alpha_composite(im,((i%6)*W,(i//6)*H))
sheet.convert('RGB').save('C:/Users/ARIANC~1/AppData/Local/Temp/cv/breaths.png'); print(list(out))
