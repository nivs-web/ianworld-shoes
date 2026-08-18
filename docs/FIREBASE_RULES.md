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

> ### ★ 2026-08-16 전면 교체 — 예전 규칙은 두 군데가 근본적으로 틀렸다
>
> **(1) 하위 `.write` 는 아예 평가되지 않았다.** RTDB 는 **상위에서 허용하면 하위 `.write` 를
> 보지 않는다**(shallower rules override deeper). `$code` 에 쓰기를 열어 뒀으므로
### 다음 판 준비는 남의 칸도 **0으로만** 되돌릴 수 있다 (2026-08-18)

`resetRoom` 은 방 전체를 한 번에 되돌린다 — 모두의 `stairs·shoesFound·ready·alive` 를
초기값으로 적는다. 그런데 필드 규칙이 `$uid == auth.uid || 값이 그대로` 뿐이라,
**상대가 한 계단이라도 올랐으면 그 update 가 통째로 거부됐다**(401). 상대가 한 판도
안 뛴 방에서만 우연히 통과해서 테스트에서 안 보였다. 증상은 '방에 남기'를 눌러도
"네트워크 오류" 토스트만 뜨고 **같은 방에서 두 번째 판을 영영 못 하는 것.**

그래서 남의 칸이라도 **초기값으로 되돌리는 것만** 허용한다 — 그것도 같은 쓰기에서
방이 `waiting` 으로 돌아갈 때만(`newData.parent().parent().parent().child('state')`).
점수를 **올려** 주는 조작은 여전히 불가능하고, 남의 진행도를 지우려면 판 자체를
끝내야 하므로 이득이 없다.

### `players/$uid` 는 **객체여야 한다** (2026-08-18)

`players/{남의uid}: true` 처럼 **원시값**을 쓰면 필드 규칙이 하나도 안 걸린다
(자식이 없으니 평가할 게 없다). 실제로 REST 로 넣어 봤더니 200 이 떨어졌고,
`Object.keys(players).length` 로 세는 인원이 늘어나 **방을 가짜로 만원**으로 만들 수 있었다.
그래서 `$uid` 노드 자체에 필수 자식 검사를 걸었다.

> `players/$uid/.write`(본인만) 와 `result/given/$uid/.write`(패자 본인만) 두 방어선은
> 방에 들어온 사람에게 **존재하지 않았다.** 방 하나 만들고 콘솔에서
> `set(ref(db,'rooms/<code>'), {...})` 한 줄이면 가짜 참가자를 넣고 `result.given` 에
> 신발 수백 켤레를 적어 지갑과 도감을 통째로 채울 수 있었다.
>
> **(2) `hostUid` 검증식이 정상 동작을 막고 있었다.** `!data.exists() || data.val() == auth.uid`
> 는 **기존 값이 나여야** 통과다. 그런데 입장·이탈·결과확정은 전부 방 노드 전체를 다시 쓰는
> 트랜잭션이라 `hostUid` 가 늘 쓰기에 포함된다 → **방장이 아닌 사람은 입장 자체가 거부**된다.
>
> **고친 방식: `.write` 대신 `.validate` 로 잠근다.**
> `.validate` 는 `.write` 와 달리 **쓰이는 모든 노드에서 각각 평가된다**(상위가 하위를 덮지 않는다).
> 그래서 잎(leaf)마다 `내 것이거나, 값이 그대로여야 한다` 를 걸었다:
> ```
> $uid == auth.uid || newData.val() == data.val()
> ```
> 방 전체를 다시 쓰는 트랜잭션은 남의 값을 **그대로** 넣으므로 통과하고,
> 남의 계단 수를 고치거나 가짜 참가자를 끼워 넣는 쓰기는 정확히 여기서 걸린다.
> 클라이언트 코드는 한 줄도 안 바꿔도 된다.

```json
{
  "rules": {
    "rooms": {
      ".read": "auth != null",
      ".indexOn": ["open"],
      "$code": {
        ".write": "auth != null && (!data.exists() || data.child('players').child(auth.uid).exists() || (newData.child('players').child(auth.uid).exists() && !data.child('players').child(auth.uid).exists()) || (!newData.exists() && !data.child('players').hasChildren()))",

        "code":       { ".validate": "newData.val() == $code" },
        "isPrivate":  { ".validate": "newData.isBoolean() && (!data.exists() || newData.val() == data.val())" },
        "open":       { ".validate": "newData.isBoolean()" },
        "seed":       { ".validate": "newData.isNumber() && (!data.exists() || newData.val() == data.val() || newData.parent().child('state').val() == 'waiting')" },
        "difficulty": { ".validate": "newData.val() == 'easy' || newData.val() == 'normal' || newData.val() == 'hard'" },
        "state":      { ".validate": "newData.val() == 'waiting' || newData.val() == 'countdown' || newData.val() == 'playing' || newData.val() == 'finished'" },
        "maxPlayers": { ".validate": "newData.isNumber() && newData.val() >= 2 && newData.val() <= 4" },
        "createdAt":  { ".validate": "newData.isNumber() && (!data.exists() || newData.val() == data.val())" },
        "startAt":    { ".validate": "newData.isNumber()" },

        "hostUid": {
          ".validate": "newData.isString() && (!data.exists() || newData.val() == data.val() || !newData.parent().child('players').hasChild(data.val()))"
        },

        "players": {
          "$uid": {
            ".validate": "newData.hasChildren(['nickname', 'characterId', 'ready', 'stairs', 'shoesFound', 'alive', 'joinedAt']) && ($uid == auth.uid || data.exists())",

            "nickname":    { ".validate": "newData.isString() && newData.val().length <= 16 && ($uid == auth.uid || newData.val() == data.val())" },
            "characterId": { ".validate": "newData.isString() && newData.val().length <= 24 && ($uid == auth.uid || newData.val() == data.val())" },
            "ready":       { ".validate": "newData.isBoolean() && ($uid == auth.uid || newData.val() == data.val() || (newData.val() == false && newData.parent().parent().parent().child('state').val() == 'waiting'))" },
            "stairs":      { ".validate": "newData.isNumber() && newData.val() >= 0 && newData.val() <= 100000 && ($uid == auth.uid || newData.val() == data.val() || (newData.val() == 0 && newData.parent().parent().parent().child('state').val() == 'waiting'))" },
            "shoesFound":  { ".validate": "newData.isNumber() && newData.val() >= 0 && newData.val() <= 1000 && ($uid == auth.uid || newData.val() == data.val() || (newData.val() == 0 && newData.parent().parent().parent().child('state').val() == 'waiting'))" },
            "alive":       { ".validate": "newData.isBoolean() && ($uid == auth.uid || newData.val() == data.val() || (newData.val() == true && newData.parent().parent().parent().child('state').val() == 'waiting'))" },
            "joinedAt":    { ".validate": "newData.isNumber() && ($uid == auth.uid || newData.val() == data.val())" },
            "reachedAt":   { ".validate": "newData.isNumber() && ($uid == auth.uid || newData.val() == data.val())" },
            "waiting":     { ".validate": "newData.isBoolean() && ($uid == auth.uid || newData.val() == data.val())" },
            "$other":      { ".validate": false }
          }
        },

        "result": {
          "endedAt": { ".validate": "newData.isNumber()" },

          "rankings": {
            "$i": {
              ".validate": "newData.isString() && newData.parent().parent().parent().child('players').hasChild(newData.val())"
            }
          },

          "given": {
            "$uid": {
              ".validate": "!newData.hasChild('4')",
              "$i": {
                ".validate": "newData.isNumber() && newData.val() >= 0 && newData.val() <= 129 && ($uid == auth.uid || newData.val() == data.val())"
              }
            }
          },

          "settled": {
            "$uid": { ".validate": "newData.isNumber() && ($uid == auth.uid || newData.val() == data.val())" }
          },

          "$other": { ".validate": false }
        },

        "$other": { ".validate": false }
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

**각 줄의 이유**

- **게임 중인 방에도 들어갈 수 있다** — 입장 조건에서 `state == 'waiting'` 을 뺐다.
  자리가 남아 있으면 **대기자**(`waiting: true`)로 들어가 다음 판을 기다린다.
  대기자는 이번 판의 순위·정산에서 통째로 빠진다(`matchRules.playersInRound`).
  대신 "**내가 아직 없을 때만** 나를 넣을 수 있다"로 좁혔다.
- **`seed` 는 대기 상태에서만 다시 뽑을 수 있다** — 다음 판을 시작할 때 새 계단이 필요하다.
  판이 도는 중에는 여전히 못 바꾼다(바뀌면 사람마다 다른 계단이 나와 승부가 성립하지 않는다).

- **`$uid == auth.uid || newData.val() == data.val()`** — 이 규칙의 심장. 잎마다 붙어 있고,
  "내 값만 바꿀 수 있다. 남의 값은 **있는 그대로** 다시 써 넣어야 한다"는 뜻이다.
  방 전체를 다시 쓰는 트랜잭션(입장·이탈·결과확정)은 통과하고, 남의 계단 수를 고치는 쓰기는 막힌다.
  **가짜 참가자 삽입도 여기서 막힌다** — 남의 `$uid` 인데 `data` 가 없으면
  `newData.val() == data.val()` 이 `숫자 == null` 이라 거짓이다.
- **`hostUid`** — 값이 그대로거나, 최초 생성이거나, **직전 방장이 이미 방에 없을 때만** 바꿀 수 있다.
  방장이 나갔을 때 남은 사람에게 넘기는 정상 동작(`leaveRoom`)은 통과하고, 방장이 멀쩡한데
  가로채는 건 막힌다. 예전 규칙이 입장 자체를 막던 문제도 여기서 풀린다.
- **정원은 규칙으로 못 센다** — RTDB 규칙에는 `numChildren()` 이 **없다**(`hasChild`/`hasChildren` 뿐).
  게시할 때 `No such method/property 'numChildren'` 로 거부돼서 알았다. 정원은 클라이언트
  트랜잭션이 계속 막는다. 다만 **가짜 참가자는 못 넣으므로**(아래 규칙) 최악이 "자기 자신이
  5번째로 끼어드는" 정도다 — 신발이 생기지는 않는다.
- **`rankings/$i` 는 실재하는 참가자여야 한다** — 가짜 uid 를 1등에 박고 정산을 돌리는 경로를 끊는다.
  위의 가짜 참가자 차단과 짝을 이룬다.
- **`given/$uid` 는 인덱스 4가 없어야 한다**(= 4개 이하), **값은 0~129**(신발 130종).
  개수를 셀 방법이 없어 `!newData.hasChild('4')` 로 표현했다. 패널티는 1켤레지만 여유를 뒀다.
  예전에는 길이·값 제한이 아예 없어 수백 켤레를 적을 수 있었다.
- **`settled/$uid`** — 정산 도장(§9-0-14). 로컬에만 두면 저장소를 지우거나 기기를 바꿀 때
  같은 방이 다시 정산돼 신발이 복제된다. 본인만 찍고, 남의 도장은 못 지운다.
- **`$other: false`** — 규칙에 없는 키는 아예 못 쓴다. 오타나 미래의 실수가 조용히 통과하지 않는다.
- **`seed` · `createdAt` · `isPrivate` 는 생성 후 불변**. 시드가 바뀌면 사람마다 다른 계단이 나와
  승부가 성립하지 않는다.
- `rooms/.indexOn: ["open"]` 은 자동 매칭 쿼리(`open == true`)용. 없으면 전체를 훑고 경고가 뜬다.

- **참가자가 0명인 방은 누구나 지울 수 있다** (`!newData.exists() && !data.child('players').hasChildren()`).
  연결이 끊기면 `onDisconnect` 가 그 사람을 방에서 빼는데, 마지막 한 명이 나가면 **참가자 0명짜리
  빈 방**이 남는다. 그 방은 방 멤버가 아무도 없으니 예전 규칙으로는 **누구도 지울 수 없었다** —
  영원히 쌓여서 자동 매칭이 훑는 12칸을 갉아먹는다. 지우는 것 말고는 아무것도 못 하므로 안전하다.

**남아 있는 한계 (알고 두는 것)**

- 방에 들어온 사람이 **다른 참가자를 지울** 수는 있다. `.validate` 는 삭제되는 노드에서는
  돌지 않기 때문이다. 신발이 생기지는 않으므로(정산 대상에서 빠질 뿐) 치명은 아니다.
  완전히 막으려면 방 전체 트랜잭션을 없애고 `players` 서브트리만 트랜잭션해야 한다 —
  클라이언트 구조 변경이 필요해 다음 판으로 미뤘다.
- `rooms/.read` 가 로그인 사용자 전체에 열려 있어 **비밀방 코드가 비밀이 아니다.**
  방 목록을 훑으면 코드를 알 수 있다. 참가 자체는 정원·상태 규칙이 막지만,
  "아는 사람끼리만" 을 보장하려면 코드 해시로 조회하는 구조가 필요하다.
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
