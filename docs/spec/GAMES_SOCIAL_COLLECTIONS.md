# Games Social Collections — Spec (Draft)

**Status**: Draft for review
**Author session**: 2026-04-20
**Scope**: 資料層設計給 8 個 UGC/社交 stub 遊戲，**不含** UI 接線與 server actions（後續 PR）。

---

## 1. 目的

把 `src/lib/games/gameConfig.ts` 裡 8 個 `implementationStatus: 'stub'` 遊戲的
資料層統一設計，避免每個遊戲各建一張 collection 造成 bloat，也避免塞進一個
discriminated god-table 造成查詢與 access 混亂。

### Non-goals

- UI 重構（stub tsx 現仍 hidden，PR-3+ 逐一接線）
- Server actions / `/api/games` endpoint 擴充（PR-2）
- 排行榜重構（`GameLeaderboard` 照用）
- `MiniGameRecords` afterChange → `UserRewards` 既有獎勵流程（照用，不動）

---

## 2. 8 stub 遊戲機制分解

| Game ID | 中文名 | category | 核心機制 | 需要的資料形狀 |
|---|---|---|---|---|
| `style-pk` | 穿搭 PK 對戰 | challenge | 1v1 作品對戰，觀眾投票 | submission + vote + (可選 room) |
| `style-relay` | 穿搭接龍 | creative | 後者作品接續前者 | submission + `parent` self-ref |
| `weekly-challenge` | 每週風格挑戰賽 | challenge | 全站公開賽，主題/時間框 | submission + vote + theme |
| `co-create` | 好友共創穿搭 | social | 多人同房協作 | room + submission |
| `wish-pool` | 穿搭許願池 | creative | 求助 → 回應（非對稱） | wish + grant（ref → submission）|
| `blind-box` | 穿搭盲盒互贈 | social | 隨機送好友、拆箱 | room（2 人 pair）+ submission |
| `queen-vote` | 女王投票大賽 | challenge | 大型公開選美 | submission + vote + ranking |
| `team-style` | 團體穿搭房 | social | 隊伍房間競賽 | room + submission + vote |

共享的資料原型：
1. **作品** — 用戶上傳圖片 + 文案（所有遊戲共用）
2. **投票** — 誰對哪個作品投了什麼票（7/8 遊戲共用，只 `wish-pool` 沒投票）
3. **房間** — 多人 session 容器（4/8 遊戲需要）
4. **許願** — ask/grant 不對稱結構（僅 `wish-pool`）

---

## 3. 提案：4 個新 Collection

### 3.1 `style-submissions`

**用途**：所有遊戲的作品 UGC sink；用 `gameType` discriminator 切。

#### Fields

| 欄位 | 型別 | 必填 | 說明 |
|---|---|---|---|
| `player` | relationship → users | Y | 上傳者 |
| `gameType` | select | Y | enum 與 `mini-game-records.gameType` 一致（擴充後）|
| `room` | relationship → style-game-rooms | N | 多人遊戲才填；indexed |
| `parent` | relationship → style-submissions | N | style-relay 鏈前一節；indexed；self-ref |
| `wish` | relationship → style-wishes | N | wish-grant 類型才填；indexed |
| `theme` | text | N | 週主題 / 賽主題（weekly-challenge, queen-vote）|
| `images` | array of upload → media | Y | minRows 1, maxRows 6 |
| `caption` | textarea | N | 文案 |
| `tags` | array of text | N | 搜尋/分類 |
| `status` | select | Y | `draft` \| `submitted` \| `approved` \| `hidden` \| `winner` \| `disqualified`，default `submitted` |
| `rank` | number | N | 結算後 snapshot |
| `voteCount` | number | N | denormalized cache，default 0 |
| `viewCount` | number | N | default 0 |
| `playerTierSnapshot` | text | N | 會員等級 snapshot |
| `moderation` | group | N | `reviewedBy` / `reviewedAt` / `note` |
| `metadata` | json | N | 各遊戲額外資料 |

#### Access

- **read**：`status ∈ {approved, winner}` 公開所有登入會員；draft 只有 author；admin 全部
- **create**：登入會員（限 `isAdmin` 以外的 authenticated）；實際投遞由 server action 包裝做 game-setting 驗證與 daily quota
- **update**：`isAdmin` only（會員送出後不能改；admin 可隱藏/提升為 winner）
- **delete**：`isAdmin`

#### Hooks

- `beforeChange` — status 轉移驗證（例：不能 `submitted → draft`）
- `afterChange` 當 `status` 進入 `winner` — 建對應 `mini-game-records` row（outcome `win` → 既有 `UserRewards` 自動入箱 pipeline 就接上了）

#### Indexes

```
(player, gameType, createdAt)  -- 我的作品列表
(gameType, status, createdAt)  -- 各遊戲公開 feed
(room)                          -- 房間內作品
(parent)                        -- relay 鏈查詢
(wish)                          -- 許願回應查詢
```

---

### 3.2 `style-game-rooms`

**用途**：多人房間 session container。

> **決策 A（未拍板）**：暫不動現有 `CardBattles` collection（prod 已跑）；此 collection 只給 8 stub 用。若拍板要統一，需加 card-battle enum + migrate。參考第 6 節。

#### Fields

| 欄位 | 型別 | 必填 | 說明 |
|---|---|---|---|
| `roomCode` | text | Y | unique，auto-gen `SR-YYYYMMDD-XXXX` |
| `gameType` | select | Y | `style_pk` \| `co_create` \| `blind_box` \| `team_style` |
| `host` | relationship → users | Y | 開房者 |
| `participants` | array | Y | 每列：`user` (rel), `role` (`host` \| `member` \| `spectator`), `joinedAt`, `status` (`active` \| `left` \| `kicked`) |
| `capacity` | number | Y | default 2, max 10 |
| `visibility` | select | Y | `private` \| `friends` \| `public`，default `private` |
| `inviteCode` | text | N | unique partial index（非 null 時唯一） |
| `theme` | text | N | 房間主題 |
| `settings` | json | N | 時限 / 計分規則等遊戲特定參數 |
| `status` | select | Y | `waiting` \| `active` \| `voting` \| `settled` \| `expired` \| `cancelled`，default `waiting` |
| `startedAt` | date | N |  |
| `settledAt` | date | N |  |
| `expiresAt` | date | Y | default 建立後 24h |
| `result` | group | N | `winner` (rel → users or null), `totalSubmissions`, `totalVotes`, `summary` |
| `metadata` | json | N |  |

#### Access

- **read**：host / participants / admin；若 `visibility='public'` + `status='settled'` 則登入會員都可看
- **create**：登入會員
- **update**：`isAdmin` only（host 透過 endpoints `/api/games/room/join`, `/leave`, `/start`, `/settle` 間接操作，直接 PATCH 禁止）
- **delete**：`isAdmin`

#### Hooks

- `beforeChange` `create` — auto-gen `roomCode`，default `expiresAt = now + 24h`
- `afterChange` 當 `status='settled'` — 對每個 participant 建 `mini-game-records`（outcome 依 `result.winner` 判定 `win`/`lose`/`draw`）

#### Indexes

```
roomCode UNIQUE
inviteCode UNIQUE partial  -- WHERE inviteCode IS NOT NULL
(host, status, createdAt)
(gameType, status)
(expiresAt)                -- 清理 expired 房
```

---

### 3.3 `style-votes`

**用途**：正規化投票；防止重複投票；feed 排序。

#### Fields

| 欄位 | 型別 | 必填 | 說明 |
|---|---|---|---|
| `voter` | relationship → users | Y | 投票人 |
| `submission` | relationship → style-submissions | Y | 被投作品 |
| `room` | relationship → style-game-rooms | N | denormalized，per-room 查詢用 |
| `voteType` | select | Y | `pk_pick` \| `like` \| `star` \| `score`，default `like` |
| `score` | number | N | 1–10 加權分（voteType=`score` 時必填） |
| `metadata` | json | N |  |

#### Access

- **read**：`isAdmin` 全部；會員讀自己的；計數經由 `style-submissions.voteCount` cache 公開
- **create**：登入會員；endpoint 側檢查 `voter ≠ submission.player`（no self-vote），檢查 `voteType` 是否符合該 gameType 允許清單
- **update**：**不允許**（vote immutable；要改先 delete 再 create）
- **delete**：`isAdmin` only（作弊清理）

#### Hooks

- `beforeChange` `create` — 檢查 `voter !== submission.player`；throw 若同人
- `afterChange` `create` — `style-submissions.voteCount++`
- `afterDelete` — `style-submissions.voteCount--`

#### Indexes

```
UNIQUE (voter, submission, voteType)  -- 一人對一作品同類型只能投一次
(submission, createdAt)
(room, createdAt)
(voter, createdAt)
```

---

### 3.4 `style-wishes`

**用途**：wish-pool 專用（ask/grant 非對稱）。

> **決策 B（未拍板）**：是否併進 `style-submissions`？推**獨立**，因為
>   1. UX 上 seeker 只描述需求、不貼作品；granter 才貼作品
>   2. 管理端不同流程：wish 過期自動關閉、granter 投稿後 seeker 挑選
>   3. 獎勵模式不同：bountyPoints 從 seeker 過到 granter（現金流）

#### Fields

| 欄位 | 型別 | 必填 | 說明 |
|---|---|---|---|
| `seeker` | relationship → users | Y | 許願者 |
| `title` | text | Y | 許願標題 |
| `description` | textarea | Y | 需求描述 |
| `referencePhotos` | array of upload → media | N | 參考圖（≤5）|
| `budgetHint` | text | N | 例「正式場合 / 週末約會 / 辦公室」 |
| `bountyPoints` | number | N | default 0；seeker 預扣，winningGrant 決定後轉給 granter |
| `status` | select | Y | `open` \| `granted` \| `closed` \| `expired`，default `open` |
| `grants` | array | N | 每列：`granter` (rel), `submission` (rel → style-submissions), `note`, `createdAt` |
| `winningGrant` | relationship → style-submissions | N | seeker 選出的最佳回應 |
| `expiresAt` | date | Y | default 建立後 14d |
| `metadata` | json | N |  |

#### Access

- **read**：`status ∈ {open, granted}` 公開所有登入會員；`closed`/`expired` 僅 seeker + admin
- **create**：登入會員；endpoint 檢查 `seeker.points >= bountyPoints` 並預扣
- **update**：seeker 可改自己的（在 `open` 狀態下；pick winner 時自動轉 `granted`）；admin 全部
- **delete**：`isAdmin`

#### Hooks

- `afterChange` 當 `winningGrant` 被設 —
  - 把 `bountyPoints` 從 seeker 帳戶轉到 granter（走 `PointsTransactions`）
  - 設 `status='granted'`
  - 建 granter 的 `mini-game-records`（outcome `win`, gameType `wish_pool`）
- `beforeChange` `create` — 若 `bountyPoints > 0` 預扣 seeker 點數（失敗 throw）
- Scheduled job（非 hook）— 掃 `expiresAt < now && status='open'` → 退還 bountyPoints、設 `status='expired'`

#### Indexes

```
(seeker, status, createdAt)
(status, createdAt)  -- 公開許願池 feed
(expiresAt)
```

---

## 4. 現有系統整合

### 4.1 `mini-game-records.gameType` enum 擴充

目前枚舉（`src/collections/MiniGameRecords.ts:48-55`）只有 6 個值。本 spec 需擴充：

```ts
options: [
  { label: '轉盤抽獎', value: 'spin_wheel' },
  { label: '刮刮樂', value: 'scratch_card' },
  { label: '每日簽到', value: 'daily_checkin' },
  { label: '電影抽獎', value: 'movie_lottery' },
  { label: '穿搭挑戰', value: 'fashion_challenge' },
  { label: '抽卡片比大小', value: 'card_battle' },
  // ↓ 新增
  { label: '穿搭 PK', value: 'style_pk' },
  { label: '穿搭接龍', value: 'style_relay' },
  { label: '每週挑戰', value: 'weekly_challenge' },
  { label: '好友共創', value: 'co_create' },
  { label: '穿搭盲盒', value: 'blind_box' },
  { label: '女王投票', value: 'queen_vote' },
  { label: '團體穿搭房', value: 'team_style' },
  { label: '穿搭許願池', value: 'wish_pool' },
],
```

SQLite 把 select 存為 TEXT，不需要 DB migration，只需 code change。

### 4.2 獎勵結算走向

所有 8 stub 最終 **都透過 `mini-game-records` 作為獎勵 sink**，不要繞開：

| 遊戲 | 觸發時機 | 產生 mini-game-records |
|---|---|---|
| style-pk | room `settled` | 兩位 participants（winner `win`、loser `lose`）|
| style-relay | cron 週期結算 top-N | 前 N 名 `win`；其餘 `completed` |
| weekly-challenge | cron 結算 | 前 N 名 `win` |
| co-create | room `settled` | 所有 participants 共享 `win`（team outcome）|
| blind-box | 收禮方點「拆箱」 | 送禮+收禮各一筆（送禮 `completed` + 小額、收禮 `win`）|
| queen-vote | contest end | top-3 `win` |
| team-style | room `settled` | 勝方 `win`、敗方 `lose` |
| wish-pool | seeker pick winningGrant | granter `win` |

`UserRewards` 寶物箱的 auto-create（`MiniGameRecords.hooks.afterChange`）已涵蓋 coupon/badge 類獎品；points/credit 由 settlement endpoint 直接寫 `PointsTransactions` + 更新 `users.points` / `users.shoppingCredit`。

### 4.3 `GameSettings` global

無需 schema 變動。現有 pattern（`stylePKEnabled` / `styleRelayEnabled` / ... bool）繼續用；開關邏輯在 `src/lib/games/getEnabledGames.ts`，只要把對應遊戲的 `implementationStatus` 從 `stub` 翻成 `ready` 就會自動進入 enabled list。

### 4.4 `GameLeaderboard` collection

繼續當跨遊戲總排行；每個社交遊戲的**局內**排名靠 `style-submissions.voteCount` 排序；不需要另建 per-game ranking。

### 4.5 與 `UGCPosts` 的分工

**保持分離**，兩者域不同：

| collection | 來源 | 審核 | 目的 |
|---|---|---|---|
| `ugc-posts` | 外部（IG/FB/TikTok/手動匯入） | admin only | 品牌端社群聚合展示 |
| `style-submissions` | 會員站內上傳 | auto-approve + admin 可隱藏 | 遊戲作品 + 投票 |

---

## 5. Migration 計畫

檔名順序（沿用 PRAGMA/sqlite_master 冪等 pattern，參考 [20260419_210000_add_user_rewards.ts](src/migrations/20260419_210000_add_user_rewards.ts)）：

```
src/migrations/20260420_100000_add_style_submissions.ts
src/migrations/20260420_110000_add_style_game_rooms.ts
src/migrations/20260420_120000_add_style_votes.ts
src/migrations/20260420_130000_add_style_wishes.ts
```

每份 migration 必含：
- `tableExists` / `columnExists` / `indexExists` helper（copy from add_user_rewards）
- 建 table + 所有 indexes
- `payload_locked_documents_rels` 加對應 `*_id` 欄位 + index（Payload 要）
- `down` 只 DROP TABLE，不動 locked_documents_rels（成本高且 dangling FK 無害）

**FK 策略**：全用 `ON DELETE set null`（沿用 UserRewards pattern），避免會員被刪導致整串 cascade。

**唯一約束（partial index）**：
- `style-votes`：`UNIQUE (voter, submission, voteType)`
- `style-game-rooms`：`UNIQUE roomCode`，`UNIQUE inviteCode WHERE inviteCode IS NOT NULL`

---

## 6. 分期 PR 規劃

| PR | 範圍 | 涵蓋遊戲 |
|---|---|---|
| **PR-1** | 本 spec 的 4 collections + migrations + `MiniGameRecords.gameType` enum 擴充 | — (純資料層，stubs 仍 hidden) |
| PR-2 | `src/lib/games/socialGameActions.ts` + `/api/games/{slug}/submit` / `/vote` / `/room` / `/wish` endpoints + rate limit | — |
| PR-3 | 把 `style-pk` 從 stub → ready | style-pk |
| PR-4 | `queen-vote` + `weekly-challenge`（同機制，主題不同） | queen-vote, weekly-challenge |
| PR-5 | `style-relay`（parent chain） | style-relay |
| PR-6 | `co-create` + `team-style`（房間類） | co-create, team-style |
| PR-7 | `blind-box`（pair/gift） | blind-box |
| PR-8 | `wish-pool` | wish-pool |

每個 stub PR：
1. 把 `implementationStatus: 'stub'` → `'ready'`（`src/lib/games/gameConfig.ts`）
2. 替換對應 `*.tsx`（目前 demo UI）為 fetch /api/games/... 的實作
3. admin `GameSettings` 若需該遊戲專屬設定（獎勵倍率、主題列表、時段限制等），加 group

---

## 7. 待決策（本 spec 之外）

| 代號 | 問題 | 建議 | 影響 |
|---|---|---|---|
| A | `CardBattles` 保留獨立 or migrate into `style-game-rooms`? | **保留獨立** | 若統一，需額外 migrate + data backfill；prod 已跑避免動 |
| B | `wish-pool` 併入 `style-submissions` or 獨立? | **獨立**（見 3.4 理由） | 併入省 1 collection，但 access 與結算流要寫很多特例 |
| C | 投票 denormalize `voteCount` 雙寫? | **雙寫**（style-votes 正規化 + submissions.voteCount cache） | 排行榜 / feed 排序免 aggregate；一致性靠 hook |
| D | 作品審核：auto-approve 公開 or admin 先審? | **auto-approve + 舉報下架**（`status` default `submitted` → 立即公開視為 `approved` 等效）；admin 可事後 `hidden` | 封測初期可切換 pre-moderation，加 feature flag `gameSettings.moderation.preApprove` |
| E | Daily submission quota / user / game? | **admin-configurable per tier**（沿用現有 `GameSettings` 等級表 pattern） | 若硬寫易被客訴；放 admin 較安全 |
| F | Points 預扣（wish bounty、投票費用等）是否可退? | **seeker 取消 or expired → 全退；granted → 不退** | 走 `PointsTransactions` 正負抵銷，不改 `users.points` 直接數字 |

---

## 8. 風險與非明顯限制

1. **SQLite 單寫**：`style-votes.afterChange` 更新 `submissions.voteCount` 在高併發下可能 race（雙寫視窗）。可接受：單寫程序 + 票數即時性需求不高。若日後 Postgres：用 `UPDATE ... SET voteCount = voteCount + 1` atomic 即可。
2. **自 FK 環（style-relay）**：`style-submissions.parent` 是 self-ref，SQLite 支援但要小心無限深度；前端 chain 顯示限制 50 層。
3. **`participants` array 在 Payload**：陣列內 relationship 查詢效能不如獨立 join table。初期可接受；若 team-style / co-create 單房 >50 人再拆出獨立 `style-room-participants`。
4. **`style-wishes.grants` array** 同上；若單願回應 >30 也要拆 join table（暫不拆）。
5. **審核 / 反濫用**：UGC 圖片需踩 `Media.ts` 既有的 8MB/50MB/10MB 分型上限 + path traversal 擋（見 memory：PR #4 security-polish 已做）。社交遊戲不加碼。
6. **Tier snapshot stale**：`playerTierSnapshot` 只在 submission 建立時寫，之後會員升等不回填；這是 snapshot 不是 live field（相同 pattern `mini-game-records.playerTier`）。

---

## 9. 不在本 spec 範圍

- AI 試穿（見 memory：ai_virtual_tryon 另案）
- 好友關係 graph（目前沒有 `friendships` collection；社交遊戲階段可用 email / referralCode 作輕量邀請，不建 follower 系統）
- IG/FB share-to-social 的外部導流
- Push notification（wish granted / room invited）
- 實時房間（WebSocket / polling）— 初期用 polling
- 審核後台 UI

---

## 10. Review Checklist

本 spec 送 PR-1 實作前需確認：

- [ ] 決策 A-F 全拍板
- [ ] `gameType` enum 值命名定案（目前用 snake_case；與現有 6 個一致）
- [ ] 欄位中文 label 定案
- [ ] `participants` / `grants` array 改 join table 的門檻 OK 不拆
- [ ] 獎勵結算 endpoint vs hook 的分工定案（建議 endpoint 算、hook 只副作用）
- [ ] Migration FK ON DELETE 策略確認（set null / restrict）
