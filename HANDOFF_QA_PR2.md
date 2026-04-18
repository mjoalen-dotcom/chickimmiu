# Handoff — PR #2 接棒（auth gate + 會員頁資料接通）

**Created**: 2026-04-18
**Previous session**: QA 2026-04-18 + PR #1 auth 三連體
**Target session**: **新開對話** 做 PR #2

---

## 1. 上游狀態

### PR #1（本 session 剛 commit）

`src/endpoints/customerRegister.ts`（新）、`src/collections/Users.ts`（加 endpoint + forgotPassword email template）、`src/app/(frontend)/{login,register,forgot-password,reset-password}/page.tsx`。commit SHA 見 `git log --oneline -5`。

解掉的 issue：
- **ISSUE-001** email/pw 按鈕無 onClick
- **ISSUE-002** email/pw 未接路徑（NextAuth 其實有設，只差 credentials；修法走 Payload REST 不動 NextAuth）
- **ISSUE-003** 忘記密碼 + 重設密碼頁

tsc `--noEmit` 乾淨。

### 未解 / 交棒

- **ISSUE-004** `/account/**` layout 無 auth gate
- **ISSUE-005** `/account` 主頁全硬寫 0
- **ISSUE-006** `/account/orders` 硬寫 DEMO_ORDERS
- **ISSUE-007** `/account/addresses` 硬寫 + useState-only
- **ISSUE-008** `/account/settings` 硬寫「王小美」
- **ISSUE-009** sitemap 缺政策頁（P2，可跟 PR #2 夾帶一起修或另案）

---

## 2. PR #2 scope（建議邊界）

### 核心 5 檔

1. **`src/app/(frontend)/account/layout.tsx`** — async server component，加 `payload.auth()` + `redirect('/login?redirect=/account')`
2. **`src/app/(frontend)/account/page.tsx`** — async server，拉 `users`（depth:1 for memberTier）、`orders`（limit:3, user=self）、points aggregate、render 真實數字
3. **`src/app/(frontend)/account/orders/page.tsx`** — async server 拉完整 orders；拆 `OrdersClient.tsx` 容納 `expandedId`
4. **`src/app/(frontend)/account/addresses/page.tsx`** — async server 讀 `user.addresses[]`；拆 `AddressesClient.tsx` 接 `PATCH /api/users/{id}` 持久化
5. **`src/app/(frontend)/account/settings/page.tsx`** — async server 讀 user；拆 `SettingsClient.tsx` 接 `PATCH /api/users/{id}`（email 欄位 disabled）

### 依賴確認（前期偵察已做完）

- ✅ `Users.ts` 已有 `addresses` array field（Tab 5）—— **不用** migration
- ✅ `Users.ts` 已有 `birthday` date field（Tab 1）
- ✅ `Users.ts` 已有 `socialLogins` group（但社群區塊在 settings 頁建議暫時隱藏，因 OAuth session ↔ Payload session 未整合）
- ✅ `Orders.ts` 有 `user` relationship（SITE_MAP.md 確認）— 需要在檔案內驗 `access.read: isAdminOrSelf`
- ✅ Pattern 可直接抄 `/account/points` 或 `/account/referrals`（頂部 auth gate + Promise.all + client 子元件）

### PR #2 不做（避免 scope creep）

- ❌ OAuth session ↔ Payload session 橋接（遺留設計缺陷，另案）
- ❌ 地址簿改用獨立 collection（現在 user.addresses array 夠封測用）
- ❌ 超商取貨真接 API（還是純 demo 欄位）
- ❌ email 欄位改 email 時重新驗證流程（Payload 本身有 `email-verification` config，另案）
- ❌ ISSUE-009 sitemap（可夾帶，但不算核心）

---

## 3. 預期改動 diff 規模

- 5 頁改 async + 3 個新 `*Client.tsx` 子檔
- ~600-800 行 diff，中等大小
- 不碰 schema / migration，風險低
- tsc + SSR curl 驗證即可

---

## 4. 新對話開場提示詞

```
接續 CHIC KIM & MIU 專案（C:\Users\mjoal\ally-site\chickimmiu）。

本對話做 PR #2 —— /account/** auth gate + 5 頁會員資料接通（ISSUE-004
+ ISSUE-005/006/007/008）。上游 PR #1（auth 三連體，解 ISSUE-001/002/003）
已 commit 進 main，細節見 HANDOFF_QA_PR2.md。

Prod：https://pre.chickimmiu.com（Hetzner SQLite）
Admin：https://pre.chickimmiu.com/admin（admin@chickimmiu.com / CKMU2026!admin）

必讀：
  HANDOFF_QA_PR2.md — 本次 scope 邊界 + 依賴確認結果
  QA_REPORT_2026-04-18.md — 原 QA 結果
  docs/issues/ISSUE-004..008.md — 各 issue 的修法提案 + 驗收條件

動手前：
  git log --oneline -10  # 確認 PR #1 commit 在
  npx tsc --noEmit       # 確認起點乾淨

規則（沿用）：
  - 禁止 push / pull / merge / rebase / reset / pnpm build
  - Context 60% 警告
  - 偵察優先、改動最少
  - 大改檔（>300 行 diff）先偵察邊界再動

實作順序建議：
  1. 先做 ISSUE-004 layout auth gate（最小改，獨立動作）
  2. /account/points + /referrals + /subscription 檢查是否可把
     既有的頁內 gate 刪掉（因為 layout 已 gate）— 若沒動到就留
  3. ISSUE-005 /account 主頁（最多資料源：user + orders + points aggregate）
  4. ISSUE-006 /account/orders（純 orders.find + OrdersClient）
  5. ISSUE-007 /account/addresses（PATCH /api/users/{id}.addresses 陣列）
  6. ISSUE-008 /account/settings（PATCH /api/users/{id}，email disabled）

不做：
  - ISSUE-009 sitemap（可夾帶也可另案，先問使用者）
  - OAuth ↔ Payload session 橋接（另案）
```

---

## 5. 驗收（PR #2 完成的 Definition of Done）

- [ ] `tsc --noEmit` 0 err
- [ ] 未登入 curl `/account` → 302 redirect `/login?redirect=/account`
- [ ] 登入後 curl `/account` → 200 + 真實等級 / 點數 / 最近 3 筆訂單
- [ ] 新增地址 → F5 重整仍在
- [ ] 編輯 settings phone / name → F5 仍在
- [ ] 原 PR #1 解掉的 email/pw 登入流程仍可用（沒被 auth gate 副作用打壞）
- [ ] `/account/points` + `/account/referrals` + `/account/subscription` 三個已接通的頁仍 200 正常

---

## 6. 本 session 的 context 狀態

PR #1 動 6 檔（4 新增 + 2 修），tsc 0 err。commit 見 `git log --oneline -5`. QA_REPORT 已補 correction note；ISSUE-002 已改寫為「修正紀錄 + resolved 狀態」。

memory MEMORY.md 已加一行指向 QA_REPORT（上 session 尾）。PR #1 commit 後建議再加一行：
- `**PR #1 DONE** (2026-04-18) — auth 三連體（ISSUE-001/002/003）解。...`
（本 session 如有餘力就加；沒有就下 session 補）
