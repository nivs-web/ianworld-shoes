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

    // 랭킹 — 문서 한 장 = 한 사람의 그 기간·그 난이도 최고기록.
    //
    // 문서 ID를 uid_난이도_기간키 로 못 박는 게 이 규칙의 핵심이다.
    // ID를 자유롭게 두면 한 사람이 문서를 여러 장 만들어 순위표를 도배할 수 있다.
    // (예전처럼 판마다 한 장씩 쌓는다면 클라이언트가 uid로 접어야 하는데,
    //  그건 300건을 읽어야 하고 닉네임을 바꿔도 옛 이름이 그대로 남는다.)
    match /scores/{scoreId} {
      allow read: if true;

      function d() { return request.resource.data; }

      // 기간 필드는 셋 중 **하나만** 들어간다. 셋을 다 넣으면 주간 색인이 연간 문서까지 훑는다.
      function periodOk() {
        return (d().period == 'wk' && d().wk == d().key)
            || (d().period == 'mo' && d().mo == d().key)
            || (d().period == 'yr' && d().yr == d().key);
      }

      function valid() {
        return d().uid == request.auth.uid
            && scoreId == d().uid + '_' + d().difficulty + '_' + d().key
            && d().difficulty in ['easy', 'normal', 'hard']
            && d().key is string
            && d().stairs is int
            && d().stairs >= 0
            && d().stairs <= 100000
            && periodOk();
      }

      allow create: if signedIn() && valid();

      // 덮어쓰기는 **점수가 내려가지 않을 때만**. 같은 값도 통과시키는 건
      // 닉네임·캐릭터만 고치는 갱신(leaderboard.syncIdentity)이 지나가야 하기 때문이다.
      allow update: if signedIn() && valid()
                    && d().stairs >= resource.data.stairs
                    && d().difficulty == resource.data.difficulty
                    && d().key == resource.data.key;

      allow delete: if false;
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
      ".read": "auth != null",
      ".indexOn": ["open"],
      "$code": {
        ".write": "auth != null && (!data.exists() || data.child('players').child(auth.uid).exists() || (newData.child('players').child(auth.uid).exists() && data.child('state').val() == 'waiting'))",

        "hostUid":    { ".validate": "!data.exists() || data.val() == auth.uid" },
        "seed":       { ".validate": "newData.isNumber() && (!data.exists() || data.val() == newData.val())" },
        "difficulty": { ".validate": "newData.val() == 'easy' || newData.val() == 'normal' || newData.val() == 'hard'" },
        "state":      { ".validate": "newData.val() == 'waiting' || newData.val() == 'countdown' || newData.val() == 'playing' || newData.val() == 'finished'" },
        "maxPlayers": { ".validate": "newData.isNumber() && newData.val() >= 2 && newData.val() <= 4" },

        "players": {
          "$uid": {
            ".write": "auth != null && auth.uid == $uid",
            "stairs":     { ".validate": "newData.isNumber() && newData.val() >= 0 && newData.val() <= 100000" },
            "shoesFound": { ".validate": "newData.isNumber() && newData.val() >= 0" },
            "alive":      { ".validate": "newData.isBoolean()" }
          }
        },

        "result": {
          "given": {
            "$uid": { ".write": "auth != null && auth.uid == $uid" }
          }
        }
      }
    },

    "userRooms": {
      "$uid": {
        ".read": "auth != null && auth.uid == $uid",
        ".write": "auth != null && auth.uid == $uid"
      }
    }
  }
}
```

**왜 이렇게 잘게 쪼갰나**

- `players/{uid}` 는 **본인만** 쓴다. 남의 계단 수를 고쳐 승패를 뒤집는 걸 막는 최소선이다.
- `$code` 쓰기는 **이미 방에 있는 사람**이거나 **대기 중인 방에 자기를 넣는 경우**만
  허용한다. 아무나 남의 방 상태를 `finished` 로 바꿔 게임을 끊을 수 없다.
- `seed` 는 **한 번 정해지면 못 바꾼다**(`data.val() == newData.val()`). 시드가 바뀌면
  사람마다 다른 계단이 나와서 승부 자체가 성립하지 않는다.
- `hostUid` 는 자기 자신으로만 쓸 수 있다 — 남을 방장으로 만들어 놓고 조종할 수 없다.
- `result/given/{uid}` 는 **패자 본인만** 쓴다. 내가 내놓은 신발 목록을 승자가 읽어 가는
  구조라(§5-7 정산), 남이 대신 써 주면 없는 신발이 생긴다.
- `rooms/.indexOn: ["open"]` 은 자동 매칭 쿼리(`open == true`)용이다.
  없으면 RTDB 가 전체를 훑고 콘솔에 경고를 찍는다.
- `userRooms/{uid}` 는 **내가 참가한 방 목록**이다. 정산을 안 하고 앱을 꺼도
  다음 접속에 여기서 미정산 방을 찾아 청산한다. 본인만 읽고 쓴다.

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

| 컬렉션 | 필드 순서 | 쓰이는 곳 |
|--------|-----------|-----------|
| `scores` | `difficulty` 오름차순, `wk` 오름차순, `stairs` **내림차순** | 주간 탭 |
| `scores` | `difficulty` 오름차순, `mo` 오름차순, `stairs` **내림차순** | 월간 탭 |
| `scores` | `difficulty` 오름차순, `yr` 오름차순, `stairs` **내림차순** | 연간 탭 |

**신발왕·역대 탭은 색인이 필요 없다.** `users` 를 단일 필드(`shoesOwned`,
`bestByDifficulty.easy` 등)로 정렬하는데, 단일 필드 색인은 Firestore 가 자동으로 만든다.

**하단 '내 순위'도 색인이 필요 없다.** 문서 ID가 `uid_난이도_기간키` 로 정해져 있어
쿼리가 아니라 문서 하나를 바로 읽는다.

> 2026-08-15까지 `uid` 가 앞에 붙은 색인 3개를 더 만들어 뒀다. 원장을 기간별 한 장으로
> 바꾸면서 쓸 일이 없어졌지만, 남아 있어도 해가 없어 지우지 않았다.

### 왜 기간을 문자열로 저장하나

`createdAt >= 이번주시작` 같은 부등호를 쓰면 Firestore 는 **부등호를 건 필드로 먼저 정렬**하라고
요구한다. 그러면 "계단 수 상위 100명"을 뽑을 수 없다. 그래서 제출할 때
`wk: '2026-W33'` · `mo: '2026-08'` · `yr: '2026'` 을 미리 박아 둔다 — 등호 비교라
계단 수로 바로 정렬할 수 있다.

기간 필드는 문서마다 **하나만** 넣는다. 셋을 다 넣으면 주간 색인에 연간·월간 문서까지
실려서 읽을 일 없는 문서를 훑게 된다. 없는 필드는 색인에 아예 안 실리므로,
`wk` 만 가진 문서는 주간 쿼리에만 걸린다.
