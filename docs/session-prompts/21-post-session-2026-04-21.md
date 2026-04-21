# Session 21 交接（2026-04-21 後半）

> **Prod SHA**：`728a4cd`
> **Main SHA**：`728a4cd`（同步）
> **Open PRs**：0
> **本 session 輸出**：4 PR merged + prod deploy + smoke all green

## 本 session 做了什麼

### 1. Shopline gap 4-group 計畫（PR [#64](https://github.com/mjoalen-dotcom/chickimmiu/pull/64)）
上半場完成。掃過 Shopline 後台 14 主選單 → 4 份平行 session prompts（19A/B/C/D）。後半場 4 組都已被併行 session 推完：
- 19A Coupons（[#72](https://github.com/mjoalen-dotcom/chickimmiu/pull/72)）
- 19B Tax（[#67](https://github.com/mjoalen-dotcom/chickimmiu/pull/67)）
- 19C Checkout+Order Settings（[#74](https://github.com/mjoalen-dotcom/chickimmiu/pull/74)）
- 19D Promo trio（[#68](https://github.com/mjoalen-dotcom/chickimmiu/pull/68)）

### 2. 清 open PR
- PR #73 user-rewards test suite — 併行 session merged
- PR #55 OAuth rebridge fix — 併行 session merged
- PR #76 retention dashboard — 併行 session merged
- **PR #77 關閉 as duplicate of #75**（`couponId → coupon` rename 已由 #75 做了）

### 3. P4-1 Email 通知補完（PR [#81](https://github.com/mjoalen-dotcom/chickimmiu/pull/81)）
- 新檔 5 個：`_shared.ts`、`orderShipped.ts`、`orderCancelled.ts`、`orderRefunded.ts`、`adminNewOrderAlert.ts`
- Orders.ts 加 4 個 afterChange hooks + 修正既有 pending→processing hook 真的讀 `sendConfirmationEmail` toggle
- 零 schema / 零 migration
- 事件 / Toggle / 預設：
  - pending→processing：`sendConfirmationEmail` / 寄
  - →shipped：`sendShippedEmail` / 寄
  - →cancelled：—（一律寄）
  - →refunded：—（一律寄）
  - operation=create：`sendAdminNewOrderAlert` + `adminAlertEmails` / 收件人空陣列時不寄

### 4. Prod smoke 挖出 2 bug（PR [#83](https://github.com/mjoalen-dotcom/chickimmiu/pull/83)）
實測 31 個前台路徑 + 15 個 globals API：
- ✅ 28/31 前台 200（3 個 404 → 下面 #5 補）
- ✅ 13/15 globals 200
- **❌ 2 個 500** — schema 和程式不一致：

| 問題 | Root cause | Fix |
|---|---|---|
| `/api/globals/checkout-settings` 500 | Payload 欄位 `requireTOS` → Drizzle 期待 `require_t_o_s`（每個大寫字母獨立 `_`），但 19C migration 建的是 `require_tos` | 欄位改名 `requireTos`（同 PR #75 pattern）|
| `/api/globals/policy-pages-settings` 500 | `accountReturnsNotice.title` 欄位存在但 prod DB 沒這欄（漏 migration）| 新 migration `20260422_200000_fix_policy_returns_notice_title`，`ADD COLUMN account_returns_notice_title TEXT DEFAULT '退換貨須知'`，PRAGMA 冪等 |

### 5. 3 個 404 補齊（PR [#87](https://github.com/mjoalen-dotcom/chickimmiu/pull/87)）
- `/contact` — server + ContactForm client + `/api/contact` POST（建 customer-service-ticket + 寄 admin email）
- `/size-guide` — 依 SizeCharts.category 分 9 組，表格動態欄位
- `/bundles`（root list）— 對應已有的 `/bundles/[slug]` PDP

實測：
```
200  /contact
200  /size-guide
200  /bundles
POST /api/contact → {"ok":true,"ticketNumber":"CS202604216983"}  ← 真建工單
```

## Prod 現況總覽

**可實測的完整 happy path**：
- 訪客 → 逛 /products → 加入 /cart → /checkout（套 coupon + 稅 + bundle/add-on/gift 全部真接）→ 下單 → Order afterChange 觸發：
  - 訂單確認信（toggle on）
  - admin 新單通知（若設 adminAlertEmails）
  - 自動開發票（ECPay Invoice schema 有，API 真打未接）
  - 寶物箱 state 回流
  - 信用分數 hook
  - 地址寫回 user.addresses
- 訂單狀態 → shipped/cancelled/refunded 都有對應 email
- `/account/returns` / `/account/orders[id]` RMA UX 已接（PR #86 P4-2）

**待做的大塊**：
- ECPay 付款正式（目前選項有 UI 但 callback 沒接 → `paymentStatus` 停在 `unpaid`）
- ECPay 電子發票 API（schema 有，API 呼叫 stub）
- Phase 3 遊樂場系統
- Phase 5 完整 CSP（Meta Pixel、OAuth 橋接）

## 今天學到的 pattern

### ALL-CAPS 欄位名陷阱（重要）
Payload / Drizzle 的 snake-case rule 對 `requireTOS` 會產 `require_t_o_s`（每個大寫字母獨立 `_`）。
但 migration 寫手常誤寫成 `require_tos`。這種錯一定 500。

**預防法**：
1. 新欄位命名避免連續大寫（`TOS` → `Tos`、`UBN` → `Ubn`、`IPs` → `Ips`）
2. 新 global / collection 上 prod 前一定 `curl /api/globals/<slug>` 測一下
3. Migration 寫完用 `pnpm payload generate:schema`（若有）對一次

目前仍有風險的欄位（grep 過，但我沒實測每支 API）：
- `maxAIRounds`, `stylePKEnabled`, `rankSPoints/A/B/CPoints`, `stylePK`
- `hashIV`, `sellerUBN`, `lineOA`
- `enableABTesting`, `sameIPLimit`, `blockedIPs`, `buyerUBN`
- `useAIRecommendation`, `useUGC`, `costKRW`, `costTWD`

這些有些在 globals、有些在 collections。下次如果碰到類似 500 先看是不是這個。

### Prod deploy 現況
- `ssh root@5.223.85.14 /root/deploy-ckmu.sh` 全自動（pull + install + migrate + build + pm2 restart + smoke）
- 本 session 跑了 3 次，每次 50-90 秒完工
- 未遇到 migration prompt（memory 的 `yes y |` workaround 沒用到）

## 下 3 組接手 prompts（選一個直接貼）

### Option A — P4-3 ECPay 付款真接（需 creds）
```
接 P4-3 ECPay 付款正式串接。先跟我要 4 個 env：
  ECPAY_MERCHANT_ID, ECPAY_HASH_KEY, ECPAY_HASH_IV, ECPAY_ENV=stage|prod
沒 creds 前只寫 scaffold + unit test：

從 main (728a4cd) 起 worktree feat/ecpay-payment：
1. src/lib/ecpay/checkMacValue.ts — CheckMacValue 計算（sha256 + URLEncode 台灣特規）
2. src/lib/ecpay/aioCheckout.ts — 產生 AioCheckOut form payload + redirect URL
3. src/app/api/ecpay/aio-checkout/route.ts — POST 從 cart 產生結帳 redirect
4. src/app/api/ecpay/callback/route.ts — 接 ReturnURL，驗 CheckMacValue，更新 Order.paymentStatus=paid
5. src/app/(frontend)/checkout/payment-success/page.tsx — 付款成功頁
6. src/app/(frontend)/checkout/payment-fail/page.tsx
7. Orders.ts：加 paymentStatus='paid' 觸發現有 autoIssueInvoice hook 就好

測試計畫：
- Stage mode 用 ECPay sandbox 的 testmerchant creds
- curl POST /api/ecpay/aio-checkout 回 <form> HTML
- 模擬 ReturnURL POST 要能驗成功

Merge 流程同以往：PR → squash merge → ssh root@5.223.85.14 /root/deploy-ckmu.sh → curl smoke
```

### Option B — Phase 5 CSP 強化（Meta Pixel allowlist）
```
目前 PR #4 CSP 沒把 connect.facebook.net 加進 script-src / connect-src，Meta
Pixel 在 prod 會被 CSP 擋。GlobalSettings.tracking.metaPixelId 若設了但 CSP
擋，前台 console 會噴 Refused to load。

從 main 起 worktree feat/csp-meta-pixel-allowlist：
1. next.config.mjs 的 Content-Security-Policy header：
   script-src 加 'https://connect.facebook.net'
   connect-src 加 'https://www.facebook.com' 'https://*.facebook.com'
   img-src 加 'https://www.facebook.com'（Pixel 像素圖）
2. 若有 MetaCAPI token，connect-src 也要加 'https://graph.facebook.com'
3. 測試：用 Chrome MCP 到 pre.chickimmiu.com/（需先在 admin 設 metaPixelId 測試值）→ 開 DevTools Network → 應看到 connect.facebook.net/en_US/fbevents.js 200，沒有 CSP error

Merge + deploy 流程同往。Pattern 參考 memory feedback_prod_schema_sync_on_new_collections。
```

### Option C — 其他 ALL-CAPS 欄位掃清（預防後面 500）
```
今天 PR #83 修了 requireTOS 的 ALL-CAPS Payload/Drizzle snake-case 不一致。
但 memory 裡列的這些欄位還沒實測：
  maxAIRounds, stylePKEnabled, rankSPoints/APoints/BPoints/CPoints, stylePK,
  hashIV, sellerUBN, lineOA, enableABTesting, sameIPLimit, blockedIPs,
  buyerUBN, useAIRecommendation, useUGC, costKRW, costTWD

從 main 起 worktree fix/all-caps-field-audit：
1. 寫個腳本 scripts/audit-field-schemas.ts，對每個 collection + global：
   - payload.find({collection, limit: 1}) 或 findGlobal({slug})
   - catch SQLITE_ERROR "no such column" → 記下來
2. 整理成 report：哪些欄位會 500、哪些通
3. 批次改名（field 而非 column）跟 PR #75 / PR #83 的 pattern
4. 每個改名要仔細看：
   - 若 field 只存在於 schema + 還沒 data → 直接改 Payload field 名
   - 若已有 data → 要 migration 改 column 名（SQLite ALTER TABLE RENAME COLUMN，3.35+ 支援）
5. 最後 curl loop 測所有 /api/collections/* + /api/globals/* 全 200

Merge + deploy 流程同往。
```

## 不要重做的事
- **19A/B/C/D 全 merged**，別再起 worktree 做這 4 條
- **PR #77 已關閉**，不要再開類似的 couponId rename（#75 已定案）
- **P4-1 email、P4-2 RMA UX 都 merged**，別再做

## 起手必做
```
git fetch origin && git checkout main && git pull
git log --oneline -10  # 確認 prod/main HEAD = 728a4cd 或更新
"/c/Program Files/GitHub CLI/gh.exe" pr list --state open  # 看有沒有新 open PR
ssh root@5.223.85.14 "cd /var/www/chickimmiu && git log --oneline -1"  # 對齊 prod SHA
```

若 prod SHA 落後 main 很多 → 先 deploy-ckmu.sh 再開工。
