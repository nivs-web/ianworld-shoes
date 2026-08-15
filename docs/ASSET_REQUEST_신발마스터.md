# 신발 마스터 시트 제작 사양서 — ✅ 해결됨 (문서 보존용)

> **2026-08-13 해결**: 외부 시트 없이 `tools/generate-shoes.mjs` 가 130종을 전량 코드로 생성한다.
> 사용자가 제공한 스니커즈 픽셀아트 시트의 스타일(왼쪽 향함, 크림 밑창, 흰 레이스 사다리,
> 대각 스트라이프, 발등 딥, 진한 외곽선)을 코드 템플릿으로 재현했다.
> 이 문서는 "왜 원본 `신발130개.png` 를 쓰지 않았는가"의 기록으로만 남긴다.

## 원본을 쓰지 않은 이유

1. **픽셀아트가 아님** — 색 변화 간격 1px, 고유색 87,720개, 경계 안티앨리어싱 49.6%. 게임에 넣으면 흐릿하게 뭉개진다.
2. **상표 침해** — 신발마다 나이키 스우시. 출시 불가.

## 현재 파이프라인

```
tools/generate-shoes.mjs  (실루엣 템플릿 + 티어별 130 팔레트)
  → public/assets/shoes/shoes_master.png  520×416  (50×30, 도감용)
  → public/assets/shoes/shoes_stair.png   260×208  (25×15, 계단용 — 정수 ½)
  → public/assets/shoes/shoes_worn.png    160×130  (15×9, 착용용)
  → src/data/shoes.json                   (id·tier·한글이름·아틀라스 좌표)
```

색이나 디자인을 바꾸려면 `generate-shoes.mjs` 의 `buildPalettes()` / `makeTemplate()` 를 수정하고
`npm run assets:shoes` 를 재실행한다. 외부 이미지 의존이 없어 언제든 재현 가능하다.
