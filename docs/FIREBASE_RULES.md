# Firebase 보안 규칙

Firebase 콘솔에 **그대로 붙여넣는** 규칙이다. 프로덕션/잠금 모드로 만든 뒤 이걸로 덮어쓴다.

> Firebase 웹 설정값(`apiKey` 등)은 **비밀이 아니다.** 번들에 그대로 들어가고 누구나 볼 수 있다.
> 실제 보호는 전부 아래 규칙이 한다. 그래서 규칙을 대충 두면 키를 숨겨도 아무 의미가 없다.

> **이 문서는 2026-08-26 에 실제 배포본과 맞췄다.**
>
> 그 전에는 문서가 낡아 있었다 — 콘솔에서만 더한 항목이 문서에 없어서,
> 문서를 그대로 올렸다면 그것들이 **지워졌을** 것이다.
> 규칙을 고칠 때는 반드시 **콘솔 것을 먼저 받아** 그 위에 얹어라.

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
    match /scores/{scoreId} {
      allow read: if true;

      function d() { return request.resource.data; }

      // 기간 필드는 셋 중 하나만 들어간다.
      function periodOk() {
        return (d().period == 'dy' && d().dy == d().key)
            || (d().period == 'wk' && d().wk == d().key)
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

      // 덮어쓰기는 점수가 내려가지 않을 때만.
      // 같은 값도 통과시키는 건 닉네임·캐릭터만 고치는 갱신이 지나가야 하기 때문이다.
      allow update: if signedIn() && valid()
                    && d().stairs >= resource.data.stairs
                    && d().difficulty == resource.data.difficulty
                    && d().key == resource.data.key;

      allow delete: if false;
    }

    // ── 드래곤 스트라이커 순위 (2026-08-26 E단계) ──────────────────
    //
    // 점수판과 금화판을 **다른 컬렉션**에 둔다. 점수가 잘 나온 판과 금화를 많이 먹은
    // 판은 보통 다른 판이라, 한 문서에 같이 넣으면 "점수는 올랐는데 금화는 줄었다" 는
    // 갱신을 규칙이 통째로 막아 버린다. 따로 두면 각자 '내려가지 않는다' 만 지키면 된다.
    //
    // ★ 복합 색인이 필요 없다. 정렬 열쇠 `sk` 하나에 난이도·기간키·값을 모두 담아
    //   (`hard|2026-08-26#9871600`) 범위 조회 + 같은 필드 정렬로 뽑기 때문이다.
    //   그래서 콘솔에서 만들 색인이 **하나도 없다** — 이 규칙만 붙이면 된다.

    function dgValid(id, d, field, maxV) {
      return d.uid == request.auth.uid
          && id == d.uid + '_' + d.difficulty + '_' + d.key
          && d.difficulty in ['easy', 'normal', 'hard']
          && d.key is string
          && d.sk is string
          && d.sk.size() < 64
          && d[field] is int
          && d[field] >= 0
          && d[field] <= maxV
          && ((d.period == 'dy' && d.dy == d.key)
           || (d.period == 'wk' && d.wk == d.key)
           || (d.period == 'mo' && d.mo == d.key));
    }

    match /dragonScores/{id} {
      allow read: if true;
      allow create: if signedIn() && dgValid(id, request.resource.data, 'score', 1000000);
      // 같은 값도 통과시킨다 — 닉네임·드래곤만 고치는 갱신이 지나가야 한다
      allow update: if signedIn() && dgValid(id, request.resource.data, 'score', 1000000)
                    && request.resource.data.score >= resource.data.score
                    && request.resource.data.difficulty == resource.data.difficulty
                    && request.resource.data.key == resource.data.key;
      allow delete: if false;
    }

    match /dragonCoins/{id} {
      allow read: if true;
      allow create: if signedIn() && dgValid(id, request.resource.data, 'coins', 20000);
      allow update: if signedIn() && dgValid(id, request.resource.data, 'coins', 20000)
                    && request.resource.data.coins >= resource.data.coins
                    && request.resource.data.difficulty == resource.data.difficulty
                    && request.resource.data.key == resource.data.key;
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
### 끝나지 않은 판의 판돈은 **주인이 되가져갈 수 있어야 한다** (2026-08-19)

부활 비용은 판이 끝나야 승자에게 간다. 그런데 상대가 튕기거나 앱을 꺼서 **순위가 영영
안 박히면** 그 신발은 아무에게도 안 가고 방에만 남는다 — 실제로 100켤레를 걸었다가
통째로 잃었다는 신고가 있었다.

그래서 `result/given/$uid` 쓰기에 한 항을 더했다 — **순위가 없을 때는 자기 것을 지우는
것만** 허용한다(`|| !newData.exists()`). 이게 있어야 방을 이미 나온 사람도 회수할 수 있다.
순위가 박힌 뒤에는 그 신발이 승자 몫이므로 이 경로로 빼낼 수 없다.

### 나간 사람 판단과 결과 명함 — `awayAt` · `result/cards` (2026-08-21 31차, 게시 완료)

**게시 확인**: 되읽어 대조 — 한 줄 9,918자 / djb2 `958749413` (게시 전 9,221 / 2824372086).

| 필드 | 무엇 | 없으면 |
|---|---|---|
| `players/$uid/awayAt` | **본인이** 홈 버튼을 누른 서버 시각 | 그 쓰기만 조용히 거부되고 예전처럼 조용함(30초)으로 판단한다 |
| `result/cards/$uid` | 순위와 함께 남기는 이름·캐릭터·아이템·계단 스냅샷 | 결과 화면이 클라이언트 폴백(인게임에서 넘겨받은 명단)으로만 그린다 |

`awayAt` 의 검증식은 `offAt` 과 **글자 그대로 같다**(본인 것만, 남의 것은 값이 그대로).

### 아웃체크 1회 제한 — `awayCount` (2026-08-21 33차, 게시 완료)

**게시 확인**: 되읽어 대조 — 한 줄 **10,063자 / djb2 `3629868605`**
(게시 전 9,918 / 958749413 — **차이는 `awayCount` 잎 하나뿐**임을 문자열로 검산했다).

**규칙 플레이그라운드 실측** — 게시했다는 것과 통과한다는 것은 다르다(§9-0-56):

| 시뮬레이션 (`set /rooms/QA33`, uid=u1) | 결과 |
|---|---|
| `awayCount: 1` 을 포함한 방 쓰기 | **허용** (게시 전이면 `$other:false` 에 걸려 거부됐다) |
| `awayCount: 100` (상한 99 초과) | **거부** — 검증이 실제로 돈다 |

| 새 필드 | 무엇 | 규칙이 없으면 |
|---|---|---|
| `players/$uid/awayCount` | 이 판에서 **긴 유예(아웃체크 30초)를 몇 번 썼나** (0~99, 본인만) | 그 쓰기만 거부되고 **누구나 매번 30초**를 받는다 — 판정이 깨지는 게 아니라 너그러워질 뿐이다 |

`markAway(false)`(= 돌아왔다)가 `awayAt: null` 과 함께 **한 번의 update** 로 보낸다.
규칙이 아직 없으면 `$other: false` 때문에 그 update 가 통째로 거부되므로, 클라이언트는
**표시 지우기만 따로 한 번 더** 보낸다 — 안 그러면 돌아온 사람의 `awayAt` 이 안 지워져
억울하게 진다.

다음 판 준비(`resetRoom`)는 `players` 맵을 통째로 다시 쓰면서 이 키를 **빼 버린다** —
그래서 **판마다 1회**가 저절로 성립한다(`revives`·`out` 과 같은 취급).

`result/cards` 는 **순위 확정 update 에 얹지 않았다.** `$other: false` 라 규칙에 없는
필드는 그 update 를 통째로 막는데, 그러면 규칙이 아직 안 올라간 기기에서 **순위 확정
자체가 거부되고 판이 영영 안 끝난다.** 명함은 화면에 예쁘게 보이자는 것이고 판을
끝내는 일은 그것보다 훨씬 무겁다 — 그래서 **따로, 실패해도 되는 쓰기**로 보낸다.

### 역전 배틀 — 새 필드 셋과 판돈 상한 (2026-08-18, 3차)

`players/$uid` 에 `revives`(부활 횟수) · `deadAt`(죽은 서버 시각) · `out`(부활 포기)이 늘었다.
**규칙에 안 적으면 그 쓰기가 통째로 거부된다**(`$other: false`) — 예전에 이 함정으로
멀티가 통째로 죽은 적이 있다. 셋 다 "본인 것만, 남의 것은 값이 그대로" 규칙을 따른다.
`revives` 는 0~10 으로 못 박았다 — 부활 상한(`MULTI.maxRevives`)과 같은 수다.

`result/given/$uid` 의 개수 상한도 4 → **220** 으로 올렸다. 부활 한 번에 20켤레씩
최대 10번 + 기본 1켤레 = 201켤레가 한 사람의 최대 납부액이다.

### 정산은 **방을 나간 뒤에도** 끝낼 수 있어야 한다 (2026-08-18, 2차)

판이 끝나면 모두 방에서 나간다 — 안 그러면 시체 방이 매칭 창(`open==true` 앞 12개)을
차지한다. 그런데 정산은 대개 그 **뒤에** 끝난다: 패자가 몇 초 늦게 내고, 승자는 다음
접속에 걷는다. 방 멤버만 쓸 수 있게 두면 나가는 순간 그 신발이 공중에 뜬다.

그래서 두 경로만 딱 열어 뒀다 — `result/given/$uid` 와 `result/settled/$uid`.
**본인 것만**, 그리고 **순위가 확정된 진짜 방에만**(`rankings.exists()`) 쓸 수 있다.
실측: 방 밖 납부 200 · 남의 납부 401 · 없는 방 401.

또 `$code/.write` 의 `!data.exists()` 항을 없앴다. 그게 있으면 **존재하지 않는 코드에
아무 필드나 써서 유령 방을 만들 수 있다**(참가자도 상태도 없는 방 — 코드로 들어가면
영원히 시작 안 되는 대기실이 된다). 방 만들기는 "내 참가자를 포함해 쓴다"는 항이
이미 허용하므로 기능은 그대로다. 실측: 방 만들기 200 · 유령 방 401.

### 다음 판 준비는 남의 칸도 **0으로만** 되돌릴 수 있다 (2026-08-18)

`resetRoom` 은 방 전체를 한 번에 되돌린다 — 모두의 `stairs·shoesFound·ready·alive` 를
초기값으로 적는다. 그런데 필드 규칙이 `$uid == auth.uid || 값이 그대로` 뿐이라,
**상대가 한 계단이라도 올랐으면 그 update 가 통째로 거부됐다**(401). 상대가 한 판도
안 뛴 방에서만 우연히 통과해서 테스트에서 안 보였다. 증상은 '방에 남기'를 눌러도
"네트워크 오류" 토스트만 뜨고 **같은 방에서 두 번째 판을 영영 못 하는 것.**

그래서 남의 칸이라도 **초기값으로 되돌리는 것만** 허용한다 — 그것도 **끝난 방**(`data` 의
`state` 가 `finished`)이 같은 쓰기에서 `waiting` 으로 돌아가고 `result` 까지 지워질 때만.
조건이 셋인 이유: 처음에는 "새 상태가 `waiting`"만 봤는데, 그러면 판 도중에
`{state:'waiting', players/상대/stairs:0}` 한 방으로 **남의 점수를 지울 수 있었다**(실측 200).
옛 상태까지 보게 하니 막힌다(실측 401).
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
      ".indexOn": [
        "open"
      ],
      "$code": {
        ".write": "auth != null && (data.child('players').child(auth.uid).exists() || (newData.child('players').child(auth.uid).exists() && !data.child('players').child(auth.uid).exists()) || (!newData.exists() && !data.child('players').hasChildren()))",
        "code": {
          ".validate": "newData.val() == $code"
        },
        "isPrivate": {
          ".validate": "newData.isBoolean() && (!data.exists() || newData.val() == data.val())"
        },
        "open": {
          ".validate": "newData.isBoolean()"
        },
        "seed": {
          ".validate": "newData.isNumber() && (!data.exists() || newData.val() == data.val() || newData.parent().child('state').val() == 'waiting')"
        },
        "difficulty": {
          ".validate": "newData.val() == 'easy' || newData.val() == 'normal' || newData.val() == 'hard'"
        },
        "state": {
          ".validate": "newData.val() == 'waiting' || newData.val() == 'countdown' || newData.val() == 'playing' || newData.val() == 'finished'"
        },
        "maxPlayers": {
          ".validate": "newData.isNumber() && newData.val() >= 2 && newData.val() <= 4"
        },
        "createdAt": {
          ".validate": "newData.isNumber() && (!data.exists() || newData.val() == data.val())"
        },
        "startAt": {
          ".validate": "newData.isNumber()"
        },
        "hostUid": {
          ".validate": "newData.isString() && (!data.exists() || newData.val() == data.val() || !newData.parent().child('players').hasChild(data.val()) || newData.val() == newData.parent().child('result').child('rankings').child('0').val())"
        },
        "players": {
          "$uid": {
            ".validate": "newData.hasChildren(['nickname', 'characterId', 'ready', 'stairs', 'shoesFound', 'alive', 'joinedAt']) && ($uid == auth.uid || data.exists())",
            "nickname": {
              ".validate": "newData.isString() && newData.val().length <= 16 && ($uid == auth.uid || newData.val() == data.val())"
            },
            "characterId": {
              ".validate": "newData.isString() && newData.val().length <= 24 && ($uid == auth.uid || newData.val() == data.val())"
            },
            "ready": {
              ".validate": "newData.isBoolean() && ($uid == auth.uid || newData.val() == data.val() || (data.parent().parent().parent().child('state').val() == 'finished' && newData.parent().parent().parent().child('state').val() == 'waiting' && !newData.parent().parent().parent().child('result').exists()))"
            },
            "stairs": {
              ".validate": "newData.isNumber() && newData.val() >= 0 && newData.val() <= 100000 && ($uid == auth.uid || newData.val() == data.val() || (newData.val() == 0 && data.parent().parent().parent().child('state').val() == 'finished' && newData.parent().parent().parent().child('state').val() == 'waiting' && !newData.parent().parent().parent().child('result').exists()))"
            },
            "shoesFound": {
              ".validate": "newData.isNumber() && newData.val() >= 0 && newData.val() <= 1000 && ($uid == auth.uid || newData.val() == data.val() || (newData.val() == 0 && data.parent().parent().parent().child('state').val() == 'finished' && newData.parent().parent().parent().child('state').val() == 'waiting' && !newData.parent().parent().parent().child('result').exists()))"
            },
            "alive": {
              ".validate": "newData.isBoolean() && ($uid == auth.uid || newData.val() == data.val() || (newData.val() == true && data.parent().parent().parent().child('state').val() == 'finished' && newData.parent().parent().parent().child('state').val() == 'waiting' && !newData.parent().parent().parent().child('result').exists()))"
            },
            "joinedAt": {
              ".validate": "newData.isNumber() && ($uid == auth.uid || newData.val() == data.val())"
            },
            "reachedAt": {
              ".validate": "newData.isNumber() && ($uid == auth.uid || newData.val() == data.val())"
            },
            "waiting": {
              ".validate": "newData.isBoolean() && ($uid == auth.uid || newData.val() == data.val())"
            },
            "shoesOwned": {
              ".validate": "newData.isNumber() && newData.val() >= 0 && ($uid == auth.uid || newData.val() == data.val())"
            },
            "multiWins": {
              ".validate": "newData.isNumber() && newData.val() >= 0 && ($uid == auth.uid || newData.val() == data.val())"
            },
            "multiLosses": {
              ".validate": "newData.isNumber() && newData.val() >= 0 && ($uid == auth.uid || newData.val() == data.val())"
            },
            "revives": {
              ".validate": "newData.isNumber() && newData.val() >= 0 && newData.val() <= 10 && ($uid == auth.uid || newData.val() == data.val())"
            },
            "deadAt": {
              ".validate": "newData.isNumber() && ($uid == auth.uid || newData.val() == data.val())"
            },
            "out": {
              ".validate": "newData.isBoolean() && ($uid == auth.uid || newData.val() == data.val())"
            },
            "$other": {
              ".validate": false
            },
            "offAt": {
              ".validate": "newData.isNumber() && ($uid == auth.uid || newData.val() == data.val())"
            },
            "awayAt": {
              ".validate": "newData.isNumber() && ($uid == auth.uid || newData.val() == data.val())"
            },
            "awayCount": {
              ".validate": "newData.isNumber() && newData.val() >= 0 && newData.val() <= 99 && ($uid == auth.uid || newData.val() == data.val())"
            },
            "seenAt": {
              ".validate": "newData.isNumber() && ($uid == auth.uid || newData.val() == data.val() || (data.parent().parent().parent().child('state').val() == 'finished' && newData.parent().parent().parent().child('state').val() == 'waiting' && !newData.parent().parent().parent().child('result').exists()))"
            },
            "outAt": {
              ".validate": "newData.isNumber() && ($uid == auth.uid || newData.val() == data.val())"
            },
            "pauseUsed": {
              ".validate": "newData.isBoolean() && ($uid == auth.uid || newData.val() == data.val())"
            },
            "items": {
              ".validate": "newData.isString() && newData.val().length <= 64 && ($uid == auth.uid || newData.val() == data.val())"
            }
          }
        },
        "result": {
          "endedAt": {
            ".validate": "newData.isNumber()"
          },
          "rankings": {
            "$i": {
              ".validate": "newData.isString() && newData.parent().parent().parent().child('players').hasChild(newData.val())"
            }
          },
          "found": {
            "$uid": {
              ".validate": "newData.isNumber() && newData.val() >= 0 && newData.val() <= 1000"
            }
          },
          "cards": {
            "$uid": {
              "nickname": { ".validate": "newData.isString() && newData.val().length <= 16" },
              "characterId": { ".validate": "newData.isString() && newData.val().length <= 24" },
              "items": { ".validate": "newData.isString() && newData.val().length <= 64" },
              "stairs": { ".validate": "newData.isNumber() && newData.val() >= 0 && newData.val() <= 100000" },
              "shoesFound": { ".validate": "newData.isNumber() && newData.val() >= 0 && newData.val() <= 1000" },
              "revives": { ".validate": "newData.isNumber() && newData.val() >= 0 && newData.val() <= 10" },
              "joinedAt": { ".validate": "newData.isNumber()" },
              "$other": { ".validate": false }
            }
          },
          "given": {
            "$uid": {
              ".write": "auth != null && auth.uid == $uid && (root.child('rooms').child($code).child('result').child('rankings').exists() || !newData.exists())",
              ".validate": "!newData.hasChild('220')",
              "$i": {
                ".validate": "newData.isNumber() && newData.val() >= 0 && newData.val() <= 129 && ($uid == auth.uid || newData.val() == data.val())"
              }
            }
          },
          "settled": {
            "$uid": {
              ".write": "auth != null && auth.uid == $uid && root.child('rooms').child($code).child('result').child('rankings').exists()",
              ".validate": "newData.isNumber() && ($uid == auth.uid || newData.val() == data.val())"
            }
          },
          "claims": {
            "$uid": {
              ".write": "auth != null && auth.uid == $uid && root.child('rooms').child($code).child('result').child('rankings').exists()",
              "$from": {
                ".validate": "newData.isNumber() && newData.val() >= 0 && newData.val() <= 220 && ($uid == auth.uid || newData.val() == data.val())"
              }
            }
          },
          "$other": {
            ".validate": false
          }
        },
        "$other": {
          ".validate": false
        },
        "pausedBy": {
          ".validate": "newData.isString() && newData.val() == auth.uid"
        },
        "pausedAt": {
          ".validate": "newData.isNumber() && newData.val() == now"
        },
        "chat": {
          "$mid": {
            ".write": "auth != null && root.child('rooms').child($code).child('players').child(auth.uid).exists() && ((!data.exists() && newData.child('uid').val() == auth.uid) || !newData.exists())",
            ".validate": "!newData.exists() || newData.hasChildren(['uid', 'name', 'text', 'at'])",
            "uid": {
              ".validate": "newData.isString() && newData.val() == auth.uid"
            },
            "name": {
              ".validate": "newData.isString() && newData.val().length <= 16"
            },
            "text": {
              ".validate": "newData.isString() && newData.val().length > 0 && newData.val().length <= 60"
            },
            "at": {
              ".validate": "newData.isNumber() && newData.val() == now"
            },
            "$other": {
              ".validate": false
            }
          }
        }
      }
    },
    "presence": {
      ".read": "auth != null",
      "$uid": {
        ".write": "auth != null && auth.uid == $uid",
        ".validate": "!newData.exists() || newData.hasChildren(['nickname', 'state', 'at'])",
        "nickname": {
          ".validate": "newData.isString() && newData.val().length <= 16"
        },
        "characterId": {
          ".validate": "newData.isString() && newData.val().length <= 24"
        },
        "shoesOwned": {
          ".validate": "newData.isNumber() && newData.val() >= 0"
        },
        "multiWins": {
          ".validate": "newData.isNumber() && newData.val() >= 0"
        },
        "multiLosses": {
          ".validate": "newData.isNumber() && newData.val() >= 0"
        },
        "state": {
          ".validate": "newData.val() == 'lobby' || newData.val() == 'playing'"
        },
        "at": {
          ".validate": "newData.isNumber()"
        },
        "lastActive": {
          ".validate": "newData.val() == now"
        },
        "$other": {
          ".validate": false
        }
      }
    },
    "inbox": {
      "$uid": {
        ".read": "auth != null && auth.uid == $uid",
        "$id": {
          ".write": "auth != null && (auth.uid == $uid || (!data.exists() && newData.child('from').val() == auth.uid && root.child('prefs').child($uid).child('accept').val() != false && !root.child('prefs').child($uid).child('blocked').child(auth.uid).exists()))",
          ".validate": "!newData.exists() || newData.hasChildren(['from', 'kind', 'at'])",
          "from": {
            ".validate": "newData.isString() && (newData.val() == auth.uid || newData.val() == data.val())"
          },
          "fromName": {
            ".validate": "newData.isString() && newData.val().length <= 16"
          },
          "kind": {
            ".validate": "newData.val() == 'msg' || newData.val() == 'challenge' || newData.val() == 'system'"
          },
          "text": {
            ".validate": "newData.isString() && newData.val().length <= 100"
          },
          "code": {
            ".validate": "newData.isString() && newData.val().length <= 8"
          },
          "at": {
            ".validate": "newData.isNumber()"
          },
          "to": {
            ".validate": "newData.isString() && newData.val().length <= 64"
          },
          "toName": {
            ".validate": "newData.isString() && newData.val().length <= 16"
          },
          "out": {
            ".validate": "newData.isBoolean()"
          },
          "read": {
            ".validate": "newData.isBoolean()"
          },
          "$other": {
            ".validate": false
          }
        }
      }
    },
    "prefs": {
      "$uid": {
        ".read": "auth != null && auth.uid == $uid",
        ".write": "auth != null && auth.uid == $uid",
        "accept": {
          ".read": "auth != null",
          ".validate": "newData.isBoolean()"
        },
        "blocked": {
          ".read": "auth != null && auth.uid == $uid",
          "$other": {
            ".validate": "newData.isBoolean()"
          }
        },
        "$other": {
          ".validate": false
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

### `result/found` — 판 중에 주운 신발 개수 (2026-08-19)

`finalizeResult` 가 순위와 **함께** 박는다. 이 값이 `players` 에만 있던 동안에는
패자가 방을 나가는 순간(`leaveRoom` 이 `players/<uid>` 를 지운다) 승자가 셀 근거가
사라져서, "판 중에 주운 신발은 1등이 가져간다"는 규칙이 조용히 0을 세고 있었다.
`rankings`·`given` 과 같은 이유로 **결과는 자립해야 한다.**

`$other: false` 때문에 **규칙에 안 적으면 결과 확정 자체가 통째로 거부된다** —
그러면 판이 영영 안 끝난다. 새 필드를 넣을 때 가장 조심할 지점이다.

### 대기방 참가자 카드 — 보유신발·승률 (2026-08-19)

`players/$uid` 에 `shoesOwned`(보유 켤레) · `multiWins`(멀티 승수) · `multiLosses`(멀티 패수)를
추가했다(§11). **`nickname`·`characterId` 와 같은 입장 시점 스냅샷**이라 판 중에 신발을
더 모아도 방 안의 숫자는 안 바뀐다 — 다른 필드처럼 "본인만, 남의 것은 값이 그대로"를 따른다.
`resetRoom` 이 다음 판을 위해 참가자를 다시 쓸 때도 이 세 값은 그대로 옮겨 적는다
(승패 수는 방 안에서 안 바뀌는 값이라 옮겨도 규칙을 어기지 않는다).


### `presence` · `inbox` — 접속 표시와 쪽지함 (2026-08-19 11차)

현재접속자 목록·쪽지·대결신청을 위해 최상위 노드 둘이 늘었다.

**`presence/$uid`** — "지금 접속해 있다"는 표시 하나. 누구나 읽고(그게 목록이다),
**본인만 쓴다.** 끊기면 `onDisconnect` 가 지운다 — 그래서 브라우저를 그냥 닫아도
유령이 안 남는다. `state` 는 `lobby`(대기중) 또는 `playing`(게임중) 둘뿐이고,
그 값이 **대결 신청을 받을 수 있는지**를 정한다.

**`inbox/$uid/$id`** — 받는 사람만 읽는다. 쓰기 규칙이 두 갈래인 게 핵심이다:

```
(!data.exists() && newData.child('from').val() == auth.uid)   ← 보내기: 새 쪽지만, 보낸이는 나
|| (!newData.exists() && auth.uid == $uid)                    ← 지우기: 받은 사람만
```

- **덮어쓰기가 없다**(`!data.exists()`). 있으면 남이 이미 읽지 않은 쪽지의 내용을
  바꿔치기할 수 있다 — 대결 신청의 방 코드를 엉뚱한 방으로 갈아 끼우는 식이다.
- **보낸이 위조가 안 된다**(`from == auth.uid`, 잎에서 한 번 더 검증). 남의 이름으로
  대결을 신청해 엉뚱한 방으로 보내는 경로를 끊는다.
- **지우는 건 받은 사람만**이다. 보낸 사람이 지울 수 있으면 "읽기 전에 회수"가 되는데,
  그건 이 기능에 필요 없고 경합만 만든다.
- `text` 100자 제한은 **클라이언트의 `maxlength` 와 같은 숫자**다(`UserCard.openComposer`).
  다르면 규칙에서 거부되는데 사용자 화면에는 "보내기를 눌렀는데 아무 일도 안 났다"로 보인다.
- `$other: false` 는 다른 노드와 같은 이유 — 규칙에 없는 키는 아예 못 쓴다.

> **읽기 범위를 알고 둔다.** `presence` 는 로그인한 사람 전체에게 열려 있다.
> 담긴 값은 닉네임·캐릭터·보유 신발·승패 — 전부 명예의 전당에 이미 공개되는 값이라
> 새로 새어 나가는 정보는 없다. 이메일이나 uid 외의 식별자는 넣지 않는다.


### `prefs` — 수신 설정과 차단 (2026-08-19 12차)

*"'꺼짐'을 누르면 메세지나 1:1대결을 보낼 수 없어 (…) 차단 누르면 (…) 이 유저가 보내는
메세지는 차단 되게끔"*

**읽기 범위가 둘로 갈린다.** 이게 이 노드의 전부다.

| | 누가 읽나 | 왜 |
|---|---|---|
| `prefs/$uid/accept` | **로그인한 누구나** | 보내는 사람이 이유를 알아야 `상대방에 메세지 수신 거부중` 이라고 말해 줄 수 있다 |
| `prefs/$uid/blocked` | **본인만** | 차단 목록이 공개되면 그 자체가 사고다 |

차단은 그래서 **화면이 아니라 규칙이 막는다.** `inbox/$uid/$id/.write` 에 두 항을 더했다:

```
root.child('prefs').child($uid).child('accept').val() != false
&& !root.child('prefs').child($uid).child('blocked').child(auth.uid).exists()
```

클라이언트는 거부당했다는 사실만 보고 `상대방이 차단 설정을 했습니다` 로 옮긴다.
목록을 못 읽으므로 **누가 나를 차단했는지 알아낼 방법이 없다** — 그게 맞다.

> `accept.val() != false` 이지 `== true` 가 아니다. 값이 **없는 사람**(설정을 한 번도
> 건드리지 않은 대다수)이 기본으로 받아야 하기 때문이다. `== true` 로 쓰면 신규 사용자
> 전원이 쪽지를 못 받는다.

#### ★ `prefs/$uid` 에 `.read` 가 빠져 있었다 (2026-08-19 14차에 수정)

12차에 `.read` 를 **잎에만** 걸었다 — `accept`(공개) 와 `blocked`(본인). 그런데
**RTDB 읽기 권한은 아래로만 흐른다.** 부모(`prefs/$uid`)를 읽으려면 그 자리나 그 위에
`.read` 가 있어야 하고, 자식에 아무리 걸어 봐야 부모 읽기는 열리지 않는다.

`subscribeMyPrefs()` 는 정확히 그 부모를 구독한다(`onValue(ref(rtdb,'prefs/<uid>'))`).
그래서 **권한 거부 → 오류 콜백 → `cb(null)`** 로 흘렀고, 화면에서는 이렇게 보였다:

| 화면 | 증상 | 실제 |
|---|---|---|
| 메세지 수신 설정 | **꺼짐을 눌러도 반응이 없다** | 쓰기(`setAccept`)는 성공한다. **상태가 안 내려와서** 버튼이 안 바뀔 뿐 |
| 받은 메세지함 | **차단 해제가 없다** | `blocked` 가 늘 `{}` 라 항상 '차단하기'로만 그려졌다 |

`prefs/$uid` 자리에 `".read": "auth != null && auth.uid == $uid"` 를 넣어 고쳤다.
`accept` 의 공개 읽기는 그대로 살아 있다 — **깊은 규칙은 권한을 더하기만 한다.**

> 교훈은 §9-0-15 와 같다. **없으면 조용히 꺼지는 것**이 제일 비싸다. 쓰기는 되고 읽기만
> 막히면 "버튼이 안 눌린다"로 보이지, "권한이 없다"로는 절대 안 보인다.

게시하고 **콘솔에서 되읽어 확인**했다(minify 기준 길이 8077 · djb2 1938703942 —
로컬 문서의 `JSON.stringify` 결과와 바이트 단위로 같다). 그리고 **규칙 플레이그라운드로
세 갈래를 실측**했다:

| 시뮬레이션 (get) | 결과 |
|---|---|
| `testuid` 가 `/prefs/testuid` 읽기 | **허용** ← 고치기 전에는 거부됐다 |
| `otheruid` 가 `/prefs/testuid` 읽기 | **거부** (남의 차단 목록은 여전히 비공개) |
| `otheruid` 가 `/prefs/testuid/accept` 읽기 | **허용** (수신 여부는 보내는 사람이 읽어야 한다) |

> 콘솔에 저장된 값은 **줄바꿈 없는 한 줄**이다(콘솔이 그렇게 정규화한다). 그래서 앞으로
> 대조는 문서의 들여쓴 원문이 아니라 **`JSON.stringify` 한 값**으로 한다 —
> 안 그러면 같은 규칙인데 길이가 달라 보여 "안 올라갔다"고 오해한다.

### 쪽지함은 이제 **이력**이다 (2026-08-19 12차)

읽은 쪽지를 지우던 것을 `read: true` 로 바꿨다(사용자 요청: 주고받은 것 전부 남기기).
그래서 규칙 두 곳이 느슨해졌다 — 둘 다 **자기 쪽지함 안에서만** 이다.

- `$id/.write` 첫 항이 `auth.uid == $uid` 다. 내 쪽지함은 내가 고친다(읽음 표시·정리·
  보낸 사본). 남의 함에는 여전히 **새 쪽지를 만드는 것만** 되고 덮어쓰기는 안 된다.
- `from` 검증에 `|| newData.val() == data.val()` 을 더했다. 안 그러면 **받은 쪽지에
  읽음 표시를 다는 순간** `from` 이 내 uid 가 아니라서 거부된다.

새 필드 넷: `to` · `toName` · `out`(보낸 사본 표시) · `read`.
`$other: false` 라 **적지 않으면 그 쓰기가 통째로 거부된다** — 늘 그렇듯 여기가 제일 조심할 곳이다.

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
| `scores` | `difficulty` 오름차순, `dy` 오름차순, `stairs` **내림차순** | **오늘 탭 (2026-08-19 19차 신설 — 콘솔에 만들어 뒀다: `CICAgJjmiJEK`)** |
| `scores` | `difficulty` 오름차순, `wk` 오름차순, `stairs` **내림차순** | 주간 탭 |
| `scores` | `difficulty` 오름차순, `mo` 오름차순, `stairs` **내림차순** | 월간 탭 |
| `scores` | `difficulty` 오름차순, `yr` 오름차순, `stairs` **내림차순** | ~~연간 탭~~ — 19차에 탭을 없앴다. 색인은 남겨 둬도 해가 없다 |

**신발왕·역대 탭은 색인이 필요 없다.** `users` 를 단일 필드(`shoesOwned`,
`bestByDifficulty.easy` 등)로 정렬하는데, 단일 필드 색인은 Firestore 가 자동으로 만든다.

**하단 '내 순위'도 색인이 필요 없다.** 문서 ID가 `uid_난이도_기간키` 로 정해져 있어
쿼리가 아니라 문서 하나를 바로 읽는다.

## 멀티게임순위 (2026-08-19 23차) — **색인도 규칙도 새로 만들 것이 없다**

승리왕·승률왕·오늘·주간·월간 다섯 탭은 전부 `users` 문서를 바로 정렬한다.
계정 문서는 이미 `allow list: if signedIn()` 이고 필드 검증이 없으므로 **규칙은 그대로다.**

계정 문서에 늘어난 칸 (`multiSettle.multiRankFields` 가 쓴다):

| 필드 | 값 | 쓰이는 곳 |
|------|-----|-----------|
| `multiWins` · `multiLosses` | 총 승·패 (원래 있던 값) | 승리왕 |
| `multiGames` | 승+패 | 승률 표시 |
| `winRate` | 만분율 정수 (8333 = 83.33%). **10판 미만이면 아예 안 쓴다** | 승률왕 |
| `mwDy` · `mwWk` · `mwMo` | `"기간키#뒤집은승수"` (예: `2026-08-20#9996`) | 오늘·주간·월간 |
| `mwDyN` · `mwWkN` · `mwMoN` | 그 기간 승수 (표시용) | 목록 값 |

**복합 색인이 필요 없는 이유가 설계에 들어 있다.** `where(기간키) + orderBy(승수)` 로
짰다면 색인 3개를 콘솔에서 손으로 만들어야 하고, 하나라도 빠지면 그 탭이 **빈 채로 뜬다**
(원인이 화면에 안 보인다). 기간 키와 승수를 **한 필드에 담아** 같은 필드로 범위 조회 +
정렬하면 Firestore 가 모든 필드에 자동으로 만들어 두는 단일 색인만으로 끝난다.
승수를 `9999 - n` 으로 뒤집어 넣었으므로 **오름차순 정렬이 곧 많이 이긴 순**이다.

승률왕의 "10판 이상" 규칙도 같은 수법이다 — 10판을 넘겨야 `winRate` 필드가 생기고,
**없는 필드는 색인에 안 실려** 조회에서 저절로 빠진다(§9-0-5 의 기간 필드와 같다).

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
