# Firebase 보안 규칙

Firebase 콘솔에 **그대로 붙여넣는** 규칙이다. 프로덕션/잠금 모드로 만든 뒤 이걸로 덮어쓴다.

> Firebase 웹 설정값(`apiKey` 등)은 **비밀이 아니다.** 번들에 그대로 들어가고 누구나 볼 수 있다.
> 실제 보호는 전부 아래 규칙이 한다. 그래서 규칙을 대충 두면 키를 숨겨도 아무 의미가 없다.

---

## Firestore

콘솔 → Firestore Database → **규칙** 탭 → 전체 교체 → 게시

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {

    function signedIn() { return request.auth != null; }
    function isMe(uid)  { return signedIn() && request.auth.uid == uid; }

    // 계정 — 남의 문서는 읽지도 쓰지도 못한다.
    // 단 닉네임 중복 확인은 로그인한 사람이면 조회할 수 있어야 한다.
    match /users/{uid} {
      allow get: if isMe(uid);
      allow list: if signedIn();          // nicknameLower 쿼리용
      allow create, update: if isMe(uid);
      allow delete: if false;             // 계정 삭제는 콘솔/함수로만
    }

    // 도감 — 본인만
    match /users/{uid}/collection/{shoeId} {
      allow read, write: if isMe(uid);
    }

    // 랭킹 원장 — 제출은 되지만 **고칠 수는 없다**.
    // update/delete 를 열어두면 자기 기록을 나중에 올려칠 수 있다.
    match /scores/{scoreId} {
      allow read: if true;
      allow create: if signedIn()
                    && request.resource.data.uid == request.auth.uid
                    && request.resource.data.stairs is int
                    && request.resource.data.stairs >= 0
                    && request.resource.data.stairs <= 100000;
      allow update, delete: if false;
    }

    // 집계 캐시 — 읽기 전용. 쓰기는 서버(Cloud Functions)만.
    match /leaderboards/{doc} {
      allow read: if true;
      allow write: if false;
    }
  }
}
```

---

## Realtime Database (멀티플레이, M7)

콘솔 → Realtime Database → **규칙** 탭 → 전체 교체 → 게시

```json
{
  "rules": {
    "rooms": {
      "$code": {
        ".read": "auth != null",
        ".write": "auth != null",
        "players": {
          "$uid": {
            ".write": "auth != null && auth.uid == $uid"
          }
        }
      }
    }
  }
}
```

방 자체는 참가자면 같이 쓰되, **players/{uid} 는 본인만** 고칠 수 있다.
남의 진행도(계단 수)를 조작해 승패를 뒤집는 걸 막는 최소선이다.

---

## 승인된 도메인

Authentication → 설정 → **승인된 도메인** 에 배포 주소를 추가한다.
빠뜨리면 배포본에서 구글 로그인이 `auth/unauthorized-domain` 으로 막힌다.

- `ianworld-shoes.vercel.app`
- (커스텀 도메인을 붙이면 그것도 추가)

`localhost` 는 기본으로 들어있다.

---

## Vercel 환경변수

Vercel → 프로젝트 → Settings → **Environment Variables** 에 `.env.example` 의 키를
같은 이름으로 등록한다. `VITE_` 접두사가 없으면 브라우저 번들에 들어가지 않는다.

등록 후에는 **재배포해야** 반영된다 (환경변수는 빌드 시점에 박힌다).


---

## 색인 (명예의 전당)

명예의 전당은 **집계 서버 없이 클라이언트 쿼리로** 돈다 (Cloud Functions 는 유료 요금제가 필요).
그래서 Firestore 복합 색인이 필요하다.

가장 쉬운 방법: 앱에서 각 탭을 **한 번씩 눌러 본다.** 색인이 없으면 브라우저 콘솔에
`https://console.firebase.google.com/.../firestore/indexes?create_composite=...` 링크가 찍히고,
그 링크를 누르면 필요한 색인이 자동으로 채워진 채 생성 화면이 열린다. 만드는 데 1~2분 걸린다.

직접 만들려면 콘솔 → Firestore → **색인** → 복합 색인 추가:

| 컬렉션 | 필드 순서 |
|--------|-----------|
| `scores` | `difficulty` 오름차순, `wk` 오름차순, `stairs` **내림차순** |
| `scores` | `difficulty` 오름차순, `mo` 오름차순, `stairs` **내림차순** |
| `scores` | `difficulty` 오름차순, `yr` 오름차순, `stairs` **내림차순** |
| `scores` | `uid` 오름차순, `difficulty` 오름차순, `wk` 오름차순, `stairs` **내림차순** |
| `scores` | `uid` 오름차순, `difficulty` 오름차순, `mo` 오름차순, `stairs` **내림차순** |
| `scores` | `uid` 오름차순, `difficulty` 오름차순, `yr` 오름차순, `stairs` **내림차순** |

뒤 세 개는 "내가 100위 밖일 때 하단에 내 기록을 고정"하는 조회용이다.

**신발왕·역대 탭은 색인이 필요 없다.** `users` 를 단일 필드(`shoesOwned`,
`bestByDifficulty.easy` 등)로 정렬하는데, 단일 필드 색인은 Firestore 가 자동으로 만든다.

### 왜 기간을 문자열로 저장하나

`createdAt >= 이번주시작` 같은 부등호를 쓰면 Firestore 는 **부등호를 건 필드로 먼저 정렬**하라고
요구한다. 그러면 "계단 수 상위 100명"을 뽑을 수 없다. 그래서 제출할 때
`wk: '2026-W33'` · `mo: '2026-08'` · `yr: '2026'` 을 미리 박아 둔다 — 등호 비교라
계단 수로 바로 정렬할 수 있다.
