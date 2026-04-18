# GAMIFICATION_SCOPE.md

> **目的**：Phase 5.8 決策依據 — `src/components/gamification/*` 4 個遺留元件的去留分析。
> **狀態**：2026-04-18 session 8，待 user 4 項決策後再開子任務清單。
> **規則**：本 session 純 recon + 決策支援，不動任何 code（含 Edit/Write 到 src/）。
> **前置**：Phase 5.7 已把 DailyCheckin 接上 `/api/games`（commit `7d6d364`），其他 3 個 orphan 已在 Phase 5.7 加 `ARCHIVED` JSDoc 頂部區塊，暫不 delete。

---

## 0. 雙套元件架構（務必先懂）

本 repo 有**兩套平行的遊戲 UI**：

| 路徑 | 觸發 surface | 狀態 | Phase 5.7 備註 |
|---|---|---|---|
| `src/components/gamification/*` | Modal（open/onClose props） | 5/5 舊版，其中 4 個 orphan + 1 個 active | 3 個已加 ARCHIVED header |
| `src/components/games/*Game.tsx` | 全頁（`<Props settings>`） | 15 個，由 `/games/[slug]` → `GamePageClient` GAME_COMPONENTS map 分派 | DailyCheckinGame 接通 API |

**Route 層衝突**（重要）：`/games/card-battle/page.tsx` 是**靜態 route**，Next.js 解析時會**蓋過** `/games/[slug]` dynamic route。這意味：

- `/games/card-battle` → **永遠**跑 `gamification/CardBattle` (Modal 版)，即使 `GamePageClient` 的 map 有 `'card-battle': CardBattleGame`
- `games/CardBattleGame.tsx` (272 行) = **unreachable dead code**，除非砍掉 `/games/card-battle/page.tsx`

這是本次最底層的糾結來源之一。

**Server 側能力**（沒被 orphan 引用）：`src/lib/games/gameActions.ts` 有完整的 Payload server actions — `spinWheel`、`playScratchCard`、`createCardBattleRoom`/`joinCardBattle`、`submitFashionChallenge` — 全部讀 admin 設定、寫 `mini-game-records` + `points-transactions`、呼 `awardGamePoints` 走每日上限檢查。目前**只有** `performDailyCheckin` 被 Phase 5.7 透過 `/api/games/route.ts` 接上，其他 4 個 action 寫好但 0 caller。

---

## 1. SpinWheel.tsx（179 行，orphan with ARCHIVED header）

### 完整度
- Modal 骨架完整（backdrop, framer-motion wheel rotation, result modal）
- **加權機率 prize table**：8 個獎項（點/credit/再來一次），probability 10/25/30/15/10/8/5/4/3 hardcoded
- 客端 only — 無 API call、無 user/auth、無每日上限
- 無 PRIZES 來源於 admin global

### 依賴與對照
- 0 imports 指向本檔
- 對照：`games/SpinWheelGame.tsx`（166 行）是全頁版，目前也是 demo 狀態（settings 從 `GameSettings` global 讀但未接 server action）
- Server 側 `gameActions.spinWheel(userId)` 已寫好 → 從 `game-settings.spinWheel.prizes[]` 讀加權獎項、寫 mini-game-records、觸發 awardGamePoints。等誰接。

### 3 選項成本
| 選項 | 成本 | 說明 |
|---|---|---|
| A. Modal surface | 中（6–10h） | 新開 `/account/points` 的「今日幸運」區塊 + Modal 觸發；或獨立 `/games/spin` 頁面浮出 Modal。須接 `gameActions.spinWheel`，保留 JSDoc、改 props、加 auth/submit state |
| B. 獨立 `/games/spin-wheel` 路由 | 已存在（但是 SpinWheelGame，非本檔） | 要改用本檔需要先砍 SpinWheelGame 或改 map。無此需求理由 |
| **C. 刪掉** | **低（15 分鐘）** | **推薦**。留 SpinWheelGame 當 canonical。加權機率已在 `gameActions.spinWheel` 有更好版本（讀 admin global，非 hardcoded）。唯一「可復用資產」是 wheel rotation 動畫 CSS/framer 配置，但 SpinWheelGame 也有 |

### 推薦：**C（刪）**
理由：無 modal 場景規劃、加權邏輯已被 server 端覆蓋、SpinWheelGame 是 canonical。留著只會誤導未來 Claude 以為是 Phase 5.8 候選。

---

## 2. ScratchCard.tsx（175 行，orphan with ARCHIVED header）

### 完整度
- Canvas-based scratch mask（`<canvas>` + mouse/touch scratch detection + percentage unveiled threshold）
- 7 個獎項 hardcoded（無 probability 欄位 —— 不像 SpinWheel，是均勻 random）
- 3 格刮刮樂 + 三連中大獎邏輯
- 客端 only — 無 API call

### 依賴與對照
- 0 imports 指向本檔
- 對照：`games/ScratchCardGame.tsx`（263 行）是全頁版，設計三連中大獎邏輯類似
- Server 側 `gameActions.playScratchCard(userId)` 已寫好 → 從 `game-settings.scratchCard.prizes[]` 讀加權獎項、三連中邏輯、寫 DB

### 3 選項成本
| 選項 | 成本 | 說明 |
|---|---|---|
| A. Modal surface | 中（6–10h） | 同 SpinWheel A 理由；canvas scratch 作為「限時活動驚喜彈窗」比全頁更合適 |
| B. `/games/scratch` 路由 | 已存在 ScratchCardGame，無理由再開一份 |
| **C. 刪掉** | **低（15 分鐘）** | **推薦**。ScratchCardGame 是 canonical。Canvas scratch 實作可復用，但若未來真要 modal 限時活動，再從 git history 挖出來 |

### 推薦：**C（刪）**，但若 user 有「週末限時驚喜彈窗」企劃，改推 **A**
理由：同 SpinWheel。差別是 canvas scratch 對 modal 場景比 wheel 更契合，所以如果有該企劃，A 的投資比較值得。

---

## 3. FashionChallenge.tsx（488 行，orphan with ARCHIVED header — 最大）

### 完整度
- 三段 GameState：`intro → playing → scoring`
- Outfit builder：類別（上衣/下身/外套/配件/鞋子）、色彩家族（warm/cool/neutral）、styleTags
- **AI 評分 UI** + share card 視覺
- 倒數計時器（Clock icon）
- 完整 modal backdrop + animation
- 客端 only — 無 API、無真實 AI

### 依賴與對照
- 0 imports 指向本檔
- 對照：`games/FashionChallengeGame.tsx`（285 行）是全頁版，實作比本檔**更簡陋**（archive header 明講：本檔「更接近沉浸式 modal 體驗原型」）
- Server 側 `gameActions.submitFashionChallenge(userId, selectedItems, timeTaken)` 已寫好 → 用 `selectedItems.length * 15 + timeBonus + varietyBonus` 做 fake AI 評分、寫 DB、awardGamePoints
- 另一 gap：`selectedItems` 規格是 **product IDs**（server action 參數），但兩個前端都用 mock fashion item list（archive header 說「可復用本檔流程」）

### 3 選項成本
| 選項 | 成本 | 說明 |
|---|---|---|
| A. Modal surface | **高（12–20h）** | 沉浸式 modal 挑戰 + 接 gameActions + 把 mock items 換成真 products + 評分 UI 對齊 server 邏輯。是 4 檔中最值得投資的 |
| B. 取代 FashionChallengeGame 做 `/games/fashion-challenge` 路由 | 中高（10–15h） | 把本檔從 Modal 拆成全頁版，取代 FashionChallengeGame。複雜度跟 A 接近，但失去 modal 的「限時活動感」 |
| **C. 刪掉** | **低（15 分鐘）** | 保 FashionChallengeGame 當 canonical，未來 Phase 5.9+ 要做「限時挑戰活動」時從 git history 挖 |

### 推薦：**C（刪）**，但若 user 有明確「限時時尚挑戰活動」企劃，強力推 **A**
理由：本檔設計品質明顯高於 FashionChallengeGame，如果 roadmap 有限時活動的企劃，這是少數值得投資復用的 asset。若無具體企劃，488 行留在 repo 只會被誤讀為 Phase 5.8 待辦。

---

## 4. CardBattle.tsx（517 行，**非 orphan** — 已掛在 `/games/card-battle`）

### 完整度
- 四段 GameState：`lobby → waiting → battle → result`
- 完整撲克牌系統（rank 1–13、四花色 symbol/name helpers、A/J/Q/K display）
- 邀請連結機制：吃 `roomCode` + `referralCode` props（`/games/card-battle/page.tsx` 從 searchParams 餵進來）
- Modal backdrop + framer-motion + AnimatePresence
- 本檔**沒加 ARCHIVED header**（因有 active import）
- 客端 only — 無 API call、無真 multiplayer（demo 對手 random draw）

### 依賴與對照
- **1 import**：`/games/card-battle/page.tsx:7`（static route，覆蓋 `/games/[slug]`）
- 對照：`games/CardBattleGame.tsx`（272 行）= **unreachable dead code**（static route 蓋掉 dynamic route map）
- Server 側 `gameActions.createCardBattleRoom(userId, referralCode?)` + `joinCardBattle(userId, battleId)` 已寫好 → 真的寫 `card-battles` collection（有對應 schema）、處理 waiting/completed 狀態、bonus 計算、awardGamePoints 到雙方

### 3 選項成本

CardBattle 不是純 orphan，選項定義稍微不同：

| 選項 | 成本 | 說明 |
|---|---|---|
| **A. 接 gameActions（保留 Modal UX，補 real backend）** | 中高（10–16h） | 本檔改成 call server action、`card-battles` collection CRUD、處理 waiting 狀態 polling、邀請流程端到端驗證。**邀請機制需要 modal 載入在 invite 頁上**，所以 Modal surface 本身就是對的 |
| B. 換成 CardBattleGame（砍掉本檔 + 砍 `/games/card-battle/page.tsx`） | 中（4–6h） | 刪靜態 route、讓 /games/card-battle 走 dynamic → CardBattleGame。CardBattleGame 也得接 gameActions + 新增 room/ref URL 參數處理。失去「邀請 invite 頁」的獨立頭部（rules/grid/how-to-play），要重建在 [slug] 頁或 CardBattleGame 內 |
| C. 刪掉 | **N/A** | 不可選 — CardBattle 是 `/games/card-battle` 靜態 route 的唯一 UI。真要砍必先處理 /games/card-battle/page.tsx |

### 推薦：**A（接 gameActions 補 real backend）**
理由：
1. CardBattle 是唯一有真 multiplayer 需求的遊戲（需要 room + waiting + join），modal 作為「被邀請加入對戰」surface 是正確設計
2. `card-battles` collection + gameActions.createCardBattleRoom/joinCardBattle 已經存在 → 前端接上就有端到端體驗
3. CardBattleGame dead code 問題建議同時解決（刪掉）避免未來 Claude 混淆
4. 唯一風險：waiting 狀態需要 polling 或 WebSocket，是比單人遊戲複雜的真功。若 user 想先跳過多人對戰，可降級為「單人 vs AI」demo 當前版，Phase 5.9+ 再接 real multiplayer

**次推**：若 Phase 5.8 context 不想投資多人對戰，**B（降級到 CardBattleGame + 砍本檔）** 也是合理終局，只是犧牲 invite 頁 UX。

---

## 5. 統合建議 & 矩陣

| 檔案 | 推薦 | 理由摘要 | 需 user 決策點 |
|---|---|---|---|
| SpinWheel.tsx | **C** 刪 | SpinWheelGame 是 canonical、server action 覆蓋機率邏輯 | 是否有 Modal 場景計畫？無則刪 |
| ScratchCard.tsx | **C** 刪 | 同上；若有「週末限時驚喜彈窗」企劃改 A | 是否有限時彈窗企劃？ |
| FashionChallenge.tsx | **C** 刪 | 設計品質高但 0 具體企劃；FashionChallengeGame 是 canonical | 是否有限時時尚挑戰企劃？有則 A |
| CardBattle.tsx | **A** 接 gameActions | 靜態 route 在用、邀請 modal 是正確設計、server action 已備 | 多人 polling/waiting 邏輯是否納入 5.8？否則 B |

**整體建議路線**：
- **最小 Phase 5.8**：刪 3 個 orphan（SpinWheel/ScratchCard/FashionChallenge）、CardBattle 接 gameActions、砍 CardBattleGame dead code → 預估 12–18h
- **保守版**：只刪 3 個 orphan，CardBattle 不動 → 1–2h
- **積極版**：4 個全接 gameActions/Modal surface、加「每日幸運」Hub 頁面 → 30–50h

---

## 6. 未決但相關的上下文（供 Phase 5.8 參考，不在本決策範圍）

這些是掃 code 時發現的順帶問題，**不是**本 4 項決策的一部分，但 Phase 5.8 可能會踩到：

1. **`GamePageClient` GAME_COMPONENTS map 有 14 個，但 `gameActions.ts` 只有 6 個 action**：StylePK 有 action、StyleRelay/WeeklyChallenge/CoCreate/WishPool/BlindBox/QueenVote/TeamStyle 都沒 action（全是客端 demo）。整個 `/games/*` 區塊的「真連上後端」狀態只有 DailyCheckin（Phase 5.7），餘下都是 demo。
2. **`/games/card-battle/page.tsx` 與 `/games/[slug]?slug=card-battle` route 衝突**：靜態 route 蓋掉 dynamic map，導致 `games/CardBattleGame.tsx` 不可達。這是獨立的技術債，與本決策交錯但不等於本決策。
3. **`awardGamePoints` 的 `balanceAfter` 寫死 0 + TODO**（`gameActions.ts:54`）：Phase 5.8 若要接 server action，這個 balance 計算得先修好，不然 `/account/points` 顯示會亂。同類 TODO 還有 `drawMovieTicket` 的 `remainingTickets` 扣減（`gameActions.ts:302`）。
4. **`performDailyCheckin` 的 streak 偵測用 `gameType + createdAt greater_than 昨天`**（`gameActions.ts:90-108`）跟 Phase 5.7 的 `users.dailyCheckinStreak` **雙軌制**：`performDailyCheckin` 讀 `mini-game-records` 算 streak，Phase 5.7 `/api/games/route.ts` 是讀 `users.dailyCheckinStreak` 欄位。兩邊算的 streak 可能不一致 — 此債已存在，但 Phase 5.8 若 users 想統一 API 介面時要處理。

---

## 7. 等待 user 決策（4 項各別 A/B/C）

請就以下 4 題各給 1 個答案：

**Q1. SpinWheel.tsx** → A / B / **C** (推薦)？
**Q2. ScratchCard.tsx** → A / B / **C** (推薦)？
**Q3. FashionChallenge.tsx** → A / B / **C** (推薦)？
**Q4. CardBattle.tsx** → **A** (推薦) / B / C-no？

Follow-up：若 Q4 = A，是否把 `games/CardBattleGame.tsx` 同時刪掉解決 route 衝突？（強烈建議 Yes）

User 回覆 4 項決策後，本檔會追加 **Section 8：Phase 5.8 子任務清單**。

---

## 8. Phase 5.8 子任務清單（partial — 2026-04-18 session 8）

### User 決策紀錄

| # | 決策 | 狀態 |
|---|---|---|
| Q1 | SpinWheel.tsx | **C**（刪 — SpinWheelGame 當 canonical，無 Modal 場景需求）|
| Q2 | ScratchCard.tsx | **A**（Modal surface + 接 `gameActions.playScratchCard`）|
| Q3 | FashionChallenge.tsx | **A**（Modal surface + 接 `gameActions.submitFashionChallenge`）|
| Q4 | CardBattle.tsx | **A**（接 `gameActions.createCardBattleRoom`/`joinCardBattle` + 同時刪 `games/CardBattleGame.tsx` 解 route 衝突）|
| Q5.8.2-P4 | FashionChallenge product 來源 | **ii**（`FashionChallengeSettings` global 加 `gameAssets` relation，admin 挑貨）|
| Q5.8.3 多人 | CardBattle waiting 同步 | **x**（3s polling，client `setInterval` 輪詢 `/api/games/card-battle/:id`）|

### 共同前置（prereq，必須先做）

**P1. `awardGamePoints` 的 `balanceAfter=0` TODO**（`gameActions.ts:54`）
- 現況：所有 action 寫入 `points-transactions` 時 `balanceAfter: 0` 硬寫
- 影響：`/account/points` 歷史列會亂，用戶看不到正確累計
- 做法：awardGamePoints 內先 `find({ collection: 'points-transactions', where: { user: { equals: userId } }, sort: '-createdAt', limit: 1 })` 拿最後 balance → + 新 amount → 寫入。同檔案 `drawMovieTicket` 的 `remainingTickets` 扣減同時修（line 302 TODO）
- 成本：2–3h，獨立 commit
- 驗證：跑一次 ScratchCard → 看 `/account/points` 歷史的 `balanceAfter` 是否遞增正確

**P2. 決定 client Modal → server action 的 wiring 模式**
- 選項 α：Next.js 15 `'use server'` action 從 client component 直接 call（已存在於 `gameActions.ts`）
- 選項 β：加 `/api/games/scratch`、`/api/games/fashion-challenge`、`/api/games/card-battle/create`、`/api/games/card-battle/join` API routes（同 Phase 5.7 DailyCheckin 模式）
- 推薦 α（少寫 4 個 route handler、直接用現有 server action）
- 成本：0h（純決策）；若選 β 另計 3h

**P3. Modal 掛載 surface 決定**
- 候選：(a) `/account/points` 頁面加「今日幸運」card，每張包一個 Modal trigger；(b) 新開 `/account/games` 會員限定 Hub；(c) 維持 `/games/[slug]` 全頁 + 額外彈 Modal
- 推薦 (a) — 既有 `/account/points` 已是「點數與福利」中心，加 3 個 Modal trigger card 最自然
- 成本：含在下面各子任務內

---

### Phase 5.8.1 — ScratchCard Modal surface（Q2 = A）

預估 6–10h。依賴 P1、P2、P3。

| 步驟 | 說明 | 檔案 |
|---|---|---|
| 1 | 移除 ARCHIVED JSDoc header | `gamification/ScratchCard.tsx` |
| 2 | 改 props：`open/onClose/userId` → 加 `onComplete?(result)` callback；移除 hardcoded `POSSIBLE_PRIZES` | 同上 |
| 3 | 初始 `useEffect` fetch `GET /api/games` 確認 scratchCard.enabled + 剩餘次數；rejected 時顯示訊息不開 canvas | 同上 |
| 4 | Scratch 達門檻自動呼叫 `playScratchCard(userId)` server action（P2 選 α）| 同上 |
| 5 | 接 response：`cells` + `allSame` + `points` 顯示，寫入 UI | 同上 |
| 6 | 每日上限錯誤處理：`daily_limit` reason → show 「今日已達上限」狀態 | 同上 |
| 7 | `/account/points` 頁面加「今日幸運 - 刮刮樂」trigger card + Modal mount | `app/(frontend)/account/points/page.tsx` (或拆出的 client component) |
| 8 | 驗證：登入 → 刮一次 → 看 `/account/points` 歷史新增一筆 + balance 正確 | — |

### Phase 5.8.2 — FashionChallenge Modal surface（Q3 = A）

預估 12–20h（最大工作量）。依賴 P1、P2、P3 + 新前置 P4。

**P4（本 subtask 專屬前置）— 鎖定選項 ii**：`submitFashionChallenge` server action 要求 `selectedItems: string[]` 是 **product IDs**。在 `FashionChallengeSettings` global 加一個 `gameAssets` relationship 欄位（`relationTo: 'products', hasMany: true`）→ admin 直接挑貨。前端元件用 `gameAssets` 渲染，用戶選擇後直接把 product id 丟進 `submitFashionChallenge`。成本 2–4h，會動 `src/globals/FashionChallengeSettings.ts`（或同位階 global；若未存在，判斷是否應該掛在 `GameSettings.fashionChallenge.gameAssets` 子欄位）+ 新 migration（idempotent PRAGMA pattern，照 `20260417_100000_add_stored_value_balance.ts` 範例）。

| 步驟 | 說明 | 檔案 |
|---|---|---|
| 1 | P4：`FashionChallengeSettings` global 加 `gameAssets` relation to products（若 global 不存在，先建）+ migration | `src/globals/*.ts` + migrations |
| 2 | 移除 ARCHIVED header；改 props | `gamification/FashionChallenge.tsx` |
| 3 | 初始 fetch：GET `/api/games` 確認 enabled + 拉 gameAssets + timer 設定 | 同上 |
| 4 | 把 intro/playing/scoring 的 mock `fashionItems` 換成 server 拉來的 products（Image + title + category）| 同上 |
| 5 | `handleSubmit`：compile `selectedItems` (product IDs) + `timeTaken` → call `submitFashionChallenge` | 同上 |
| 6 | 接 response：`score`/`rank`/`points`/`message` 顯示；share card 用真 rank | 同上 |
| 7 | 每日上限處理同 5.8.1 | 同上 |
| 8 | `/account/points` 加「時尚挑戰」trigger card | `account/points/page.tsx` |
| 9 | 驗證：登入 → 挑 3+ 件 → 看評分 → 歷史正確 | — |

### Phase 5.8.3 — CardBattle 接 real backend + dead code 清理（Q4 = A）

預估 10–16h。依賴 P1、P2。

**多人 waiting 同步 — 鎖定選項 x（3s polling）**：client `setInterval(3000)` 輪詢 `GET /api/games/card-battle/:battleId`，直到 server 回 `status === 'completed'` 才切 result 階段。建議上限 5 分鐘無配對則 timeout（server side `expiresAt` 已支援）。**注意**：使用者關掉 Modal 或切頁要 `clearInterval` 避免 leak；建議在 `useEffect` cleanup 清掉。後期若流量起來可再升級 SSE/WebSocket。

| 步驟 | 說明 | 檔案 |
|---|---|---|
| 1 | 把 `roomCode` props 語意改為 `battleId`（從 Payload `card-battles` 拿）+ 外部 invite URL 格式改成 `?battle=<id>&ref=<code>` | `gamification/CardBattle.tsx` + `/games/card-battle/page.tsx` |
| 2 | Lobby「建立對戰」→ call `createCardBattleRoom(userId, referralCode?)` → 轉 waiting 階段帶回 battleId | 同上 |
| 3 | Waiting 階段：輪詢 `GET /api/games/card-battle/:id` 看 `status` 是否變 `completed` | 新 API route `src/app/api/games/card-battle/[id]/route.ts` |
| 4 | 被邀請入房：讀 query `battle=<id>` → call `joinCardBattle(userId, battleId)` → 拿雙方卡 + result | `gamification/CardBattle.tsx` |
| 5 | Result 階段：用 server 回傳的 `myCard`/`opponentCard`/`result`/`points`/`hasReferralBonus` 渲染 | 同上 |
| 6 | 刪除 `games/CardBattleGame.tsx` + 從 `GamePageClient` GAME_COMPONENTS map 移除 `'card-battle'` 條目 | `games/GamePageClient.tsx`、`games/CardBattleGame.tsx` |
| 7 | 確認 `/games/[slug]` 以 slug=card-battle 訪問時會 404（或在 GamesHub UI 改成連到 `/games/card-battle` 靜態 route）| `lib/games/getEnabledGames.ts`、`games/GamesHub.tsx` |
| 8 | 驗證：雙 browser（A 建房 → B 從 invite URL 加入 → 雙方都看到 result + points 正確發放）| — |

### Phase 5.8.4 — SpinWheel 刪除（Q1 = C）

預估 15 分鐘。

| 步驟 | 說明 | 檔案 |
|---|---|---|
| 1 | `grep -r "gamification/SpinWheel" src/` 確認 0 hit（現況已 0 hit，ARCHIVED header 明確記錄）| — |
| 2 | `rm src/components/gamification/SpinWheel.tsx` | `gamification/SpinWheel.tsx` |
| 3 | `tsc --noEmit` 確認無新錯（應該只剩 3 個 pre-existing —— 已在 N2 commit `5b57433` 清零，現在應為 0 錯）| — |
| 4 | 備註：若未來有「今日幸運轉盤」Modal 企劃，仍可從 `games/SpinWheelGame.tsx` + `gameActions.spinWheel` 組合出 Modal 版。SpinWheelGame 的 `settings` prop 吃 `GameSettings.spinWheel` global，邏輯已集中化 | — |

### Phase 5.8.5 — 順手清死碼（連帶任務，建議夾在 5.8.3 內）

- [ ] 刪 `src/components/gamification/SpinWheel.tsx`（5.8.4）
- [ ] 刪 `src/components/games/CardBattleGame.tsx`（Q4b = Y）
- [ ] 從 `GamePageClient.tsx` GAME_COMPONENTS map 移除 `'card-battle': CardBattleGame` 條目 + 對應 `import`
- [ ] `grep -r "CardBattleGame" src/` 確認無其他殘留 import
- [ ] `grep -r "gamification/SpinWheel" src/` 確認無殘留 import
- [ ] 同一 commit，訊息 `chore(phase5.8): remove unreachable SpinWheel modal + CardBattleGame dead code`

---

### 推薦執行順序（全部鎖定）

```
Step 1: P1 (balanceAfter fix)     ──  2–3h  獨立 commit
Step 2: P4 (FashionChallengeSettings.gameAssets + migration)  ──  2–4h  獨立 commit
Step 3: 5.8.4 + 5.8.5 清死碼（SpinWheel + CardBattleGame）    ──  0.5h   獨立 commit
Step 4: 5.8.1 ScratchCard Modal surface                       ──  6–10h
Step 5: 5.8.2 FashionChallenge Modal surface                  ──  12–20h
Step 6: 5.8.3 CardBattle real backend + polling               ──  10–16h
                                                              ──────────
                                                          TOTAL 32–53h
```

**順序理由**：
- Step 1 是所有 server action 的 balance 正確性前置 — 必先做，否則 5.8.1/5.8.2/5.8.3 寫入資料都會錯
- Step 2 是 5.8.2 專屬前置，但獨立成 commit 才能與前端實作分離測試
- Step 3 先清死碼，避免後續 CardBattle 實作時踩到 unreachable `CardBattleGame` 誤判
- Step 4–6 可選序交付，建議由簡到繁：ScratchCard < FashionChallenge < CardBattle

### 下一步行動

1. ✅ 4 項決策 + 2 項子追問已鎖定（Q1=C, Q2=A, Q3=A, Q4=A+Q4b=Y, P4=ii, 多人=x）
2. ✅ Section 8 handoff-ready — 下個 session 可直接 implement，照 Step 1→6 順序
3. ✅ 本 session 0 行 code 改動（僅新增 `GAMIFICATION_SCOPE.md` 單檔）
4. 建議下個 session 開場白：
   > 接續 Phase 5.8。先讀 `GAMIFICATION_SCOPE.md` Section 8 + `PHASE4_HANDOFF.md` Phase 5.7 sections。照 Step 1–6 順序做，每步獨立 commit 附 `(updates GAMIFICATION_SCOPE)` tag，完成就把本檔 Step N 改成 `✅ DONE (commit <sha>)`。遵守「交接紀律」（PHASE4_HANDOFF.md 文末）。
5. 建議本 session commit：`docs(phase5.8): add GAMIFICATION_SCOPE with locked decisions`（問 user 是否同意 commit，才下手）


