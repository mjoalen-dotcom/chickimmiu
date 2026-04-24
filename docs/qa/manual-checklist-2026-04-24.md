# 封測期人工實測 Checklist — 2026-04-24

> 本 checklist 涵蓋自動化測試（curl smoke / code review）測不到的所有路徑。
> 預期一輪約 90-120 分鐘。發現的 bug 開 issue + assign 對應「組別」（A-I）給後續 session 處理。
>
> **環境**：`https://pre.chickimmiu.com`（prod，SQLite，pm2 nginx-fronted）
> **Prod SHA**：`35cecfa`（含 PR #97）
> **測試帳號**：建議用使用者本人 + 1 個全新註冊帳號交叉驗
> **測試卡**：ECPay sandbox `4311-9522-2222-2222`，CVV 任三碼，到期日任未來月 / 年
> **測試地址**：台北市信義區松壽路 1 號（信義誠品，避免真寄到家）

---

## 0. 開始前 — 準備事項

- [ ] 兩個瀏覽器（A：Chrome 一般 / B：隱私視窗）並排開啟
- [ ] DevTools Console 全程開著，留意 hydration error / CSP error / 4xx-5xx
- [ ] iPad Safari 一台（若手邊有）— 至少跑 §5
- [ ] 手機（Android / iPhone）— 至少跑 §1 §2 §10 響應式
- [ ] 測試 email inbox 開著（看 confirm / shipped / cancelled / refunded / admin alert）

---

## 1. 訪客流（未登入）

| # | 路徑 | 預期 | 結果 |
|---|---|---|---|
| 1.1 | `/` | 首頁 hero / 商品輪播 / 6 個 nav link 全顯示 | [ ] |
| 1.2 | `/products` | 列表至少 5 件商品、可切排序（4 種）、可勾分類 filter | [ ] |
| 1.3 | `/products/<隨便挑一件>` | PDP 顯示圖片、尺寸表、加購鈕、立即購買鈕 | [ ] |
| 1.4 | 點「加入購物車」 | 出現「已加入」toast 或 mini cart 閃 | [ ] |
| 1.5 | `/cart` | 剛加的品項在裡面、能改數量、能刪 | [ ] |
| 1.6 | `/cart` 點「前往結帳」 | 跳 `/login?redirect=/checkout`（未登入應強制登入） | [ ] |
| 1.7 | `/contact` | 表單顯示、`/api/contact` POST 後回 ticketNumber | [ ] |
| 1.8 | `/size-guide` | 9 組尺寸表 render（按 SizeCharts.category 分組） | [ ] |
| 1.9 | `/bundles` | 至少 1 組組合商品列表 | [ ] |
| 1.10 | `/terms` `/privacy` `/shipping` `/returns` `/about` | 5 個政策/CMS 頁全 200 + 文字非空 | [ ] |
| 1.11 | `/blog`（若有 published post）| 列表 + 點進 detail page | [ ] |

**Bug log**：

```
ISSUE-?: <一行描述>
組別: <A/B/C/.../I>
路徑: <URL>
重現步驟: ...
```

---

## 2. 註冊 / 登入 / OAuth

### 2.1 Email + 密碼註冊

| # | 步驟 | 預期 | 結果 |
|---|---|---|---|
| 2.1.1 | 用 B 隱私視窗開 `/register` | 表單顯示、條款 checkbox 必勾 | [ ] |
| 2.1.2 | 填 email + 密碼 + 勾條款 + 註冊 | 自動登入 → `/account` | [ ] |
| 2.1.3 | 收件匣有沒有「歡迎信」/「驗證信」 | （視 GlobalSettings 是否開）至少不報錯 | [ ] |
| 2.1.4 | Admin 後台看 Users collection | 多了一筆，role=customer | [ ] |

### 2.2 Email + 密碼登入

| # | 步驟 | 預期 | 結果 |
|---|---|---|---|
| 2.2.1 | `/login` 用 2.1 帳號登入 | 跳 `/account` | [ ] |
| 2.2.2 | 故意輸錯密碼 10 次 | 第 11 次帳號 lock 10 分鐘（PR #4 maxLoginAttempts） | [ ] |

### 2.3 忘記密碼

| # | 步驟 | 預期 | 結果 |
|---|---|---|---|
| 2.3.1 | `/forgot-password` 輸 email | 回統一訊息「若 email 存在會寄信」 | [ ] |
| 2.3.2 | 收件匣有 reset 信 | 帶 `/reset-password?token=...` | [ ] |
| 2.3.3 | 點 link → 設新密碼 | 自動登入 + 新密碼可用 | [ ] |

### 2.4 OAuth — Google / Facebook / LINE / Apple

| # | Provider | 點按鈕 | 預期 | 結果 |
|---|---|---|---|---|
| 2.4.1 | Google | `/login` 點 Google | OAuth → callback → `/account` | [ ] |
| 2.4.2 | Facebook | 同上 | 同上 | [ ] |
| 2.4.3 | LINE | 同上 | 同上 | [ ] |
| 2.4.4 | Apple | 同上 | （等 Dev Program；目前可能 503） | N/A |
| 2.4.5 | 4.1-4.3 任一登入後 | `/account/points` 不再 redirect 回 login（PR #95 fix）| [ ] |

### 2.5 登出

- [ ] 登入狀態下，header 是否有「登出」按鈕？（QA 報告當時沒有，待驗）
- [ ] 點登出 → `/login`，cookie `payload-token` 清除（DevTools → Application → Cookies）

---

## 3. 會員頁（auth gate）

> 全部 8 頁先在 B 隱私視窗（未登入）跑一輪 — 應該每頁都 redirect 到 `/login?redirect=...`。
> 然後在 A 視窗（已登入）跑一輪 — 應該真資料 render。

| # | 路徑 | 未登入預期 | 已登入預期 | 結果 |
|---|---|---|---|---|
| 3.1 | `/account` | redirect login | dashboard 顯示真會員等級 + 點數 + 訂單 + 勳章 + 寶物 + avatar | [ ] |
| 3.2 | `/account/orders` | redirect | 真實訂單列表（無單顯示空狀態 + CTA） | [ ] |
| 3.3 | `/account/orders/<id>` | redirect | 訂單明細 + 退換貨入口（若 shipped/delivered） | [ ] |
| 3.4 | `/account/points` | redirect | FIFO 到期點數計算（Phase 5.5.4） | [ ] |
| 3.5 | `/account/referrals` | redirect | 真 SUM totalReward + 推薦碼 | [ ] |
| 3.6 | `/account/subscription` | redirect | Spark/VIP/Diamond 3 方案 | [ ] |
| 3.7 | `/account/wishlist` | redirect | Zustand store / 空狀態 OK | [ ] |
| 3.8 | `/account/addresses` | redirect | 可新增 / 編輯 / 刪除地址 | [ ] |
| 3.9 | `/account/settings` | redirect | 真姓名 / 性別 / 生日 / 身體量測 / 發票資料 + 可改 | [ ] |
| 3.10 | `/account/cards` | redirect | 造型卡牌列表（可能空）+ 動作列（mint/transfer/burn/craft） | [ ] |
| 3.11 | `/account/treasure` | redirect | 寶物箱列表（PR #79 schema） | [ ] |
| 3.12 | `/account/returns` | redirect | 退換貨申請列表 | [ ] |
| 3.13 | `/account/exchanges` (`new`) | redirect | 換貨申請表 | [ ] |
| 3.14 | `/account/invoices` | redirect | 已開立發票列表 | [ ] |
| 3.15 | `/account/reviews` | redirect | 商品評論列表 | [ ] |

---

## 4. 購物 → 結帳 → 付款 → 訂單

> 這是主 happy path。每種 paymentMethod 各跑一次。

### 4.1 加購車 → 結帳預備

- [ ] 加 2-3 件不同商品
- [ ] `/cart` 顯示正確 subtotal
- [ ] 套 coupon code（先在 admin 建一張 `WELCOME10` 10% off）→ 折扣顯示 OK
- [ ] 試 coupon 錯誤碼 → 顯示「無效折扣碼」
- [ ] `/checkout` 顯示：商品列、地址表、物流方式（至少 7 種）、付款方式

### 4.2 各 paymentMethod

| # | paymentMethod | 預期 | 結果 |
|---|---|---|---|
| 4.2.1 | `cash_meetup`（面交）| 出現「面交時間/地點」必填欄；下單後 paymentStatus=unpaid（admin 後台手動 mark paid）| [ ] |
| 4.2.2 | `cash_cod`（貨到付款）| 加 codFee 到 total；paymentStatus=unpaid | [ ] |
| 4.2.3 | `ecpay`（信用卡）| **目前**只建單，paymentStatus 停 unpaid（組 A 上線後才會跳 ECPay）| [ ] |
| 4.2.4 | `linepay` `newebpay` `paypal` | 應該還沒接，可能 console.log 或 alert | [ ] |

### 4.3 下單後（任一 method）

- [ ] 成功跳 `/account/orders` 或 `/checkout/success`
- [ ] `/account/orders` 列表多一筆，狀態 `pending`
- [ ] 收件匣有「訂單確認信」（若 OrderSettings.notifications.sendConfirmationEmail = true）
- [ ] Admin 設定的 `adminAlertEmails` 收到「新單通知」
- [ ] Admin 後台 Orders 看到該筆，items / coupon / tax / total 全對

### 4.4 訂單狀態流（admin 操作）

> 在 admin 後台手動推進該筆訂單：

| # | status 變化 | 預期 email | 結果 |
|---|---|---|---|
| 4.4.1 | pending → processing | 「訂單處理中」（若 sendConfirmationEmail=on）| [ ] |
| 4.4.2 | → shipped | 「已出貨」+ tracking number | [ ] |
| 4.4.3 | → delivered | 觸發 `/account/orders/<id>` 顯示退換貨入口 | [ ] |
| 4.4.4 | → cancelled | 「訂單取消」一律寄 | [ ] |
| 4.4.5 | → refunded | 「已退款」一律寄 | [ ] |
| 4.4.6 | paymentStatus → paid | 觸發 invoice hook（組 B 接前先看 console log） + 點數/wallet hook | [ ] |

---

## 5. 退換貨（PR #85 P4-2）

| # | 步驟 | 預期 | 結果 |
|---|---|---|---|
| 5.1 | shipped/delivered 訂單 → `/account/orders/<id>` 點「申請退貨」 | `/account/returns/new` 表單 | [ ] |
| 5.2 | 填原因 + 照片 + 退款方式（original / credit）+ 提交 | 跳 `/account/returns/<id>`，狀態 pending | [ ] |
| 5.3 | 客戶收件匣有「退貨申請已收到」信 | | [ ] |
| 5.4 | Admin 收「新退貨申請」alert | | [ ] |
| 5.5 | Admin 後台 Returns → approve | 客戶收「退貨核准」信 | [ ] |
| 5.6 | refundMethod=credit 時，approve 後應自動寫 WalletTransactions（**目前未接，組 E**）| 預期失敗 | 預期 [x] FAIL → 組 E |
| 5.7 | 同流程跑一次 exchange（換貨）| 3 封信流程同 | [ ] |

---

## 6. 造型卡牌（PR #79 + #84）

> **未在公開 QA 中跑過**，這是新功能，特別仔細。

| # | 步驟 | 預期 | 結果 |
|---|---|---|---|
| 6.1 | `/account/cards` | 卡牌列表 + 4 顆 action button (transfer/burn/craft/?) | [ ] |
| 6.2 | 觸發 mint hook（買齊一個 series 的訂單 → afterChange）| 卡牌新增 | [ ] |
| 6.3 | Transfer：選對方 email/userId 送出 | 對方 `/account/cards` 出現該卡 | [ ] |
| 6.4 | Burn：點銷毀 → 再次 confirm → 卡消失 | | [ ] |
| 6.5 | Craft：選 N 張同類合成 | 新一張高階卡 + 原 N 張消失 | [ ] |

---

## 7. 14 款遊戲

> 至少跑前 4 款 luck 類 + 1 款 challenge / social。

| # | slug | 名稱 | 簡測 | 結果 |
|---|---|---|---|---|
| 7.1 | `daily-checkin` | 每日簽到 | 點簽到 → 點數 + 1 day streak | [ ] |
| 7.2 | `spin-wheel` | 幸運轉盤 | 點轉動 → 中獎 / 槓龜，points 異動 | [ ] |
| 7.3 | `scratch-card` | 刮刮樂 | 同 7.2 | [ ] |
| 7.4 | `movie-lottery` | 電影票抽獎 | 用點數 → 出抽獎結果 | [ ] |
| 7.5 | `fashion-challenge` | 璀璨穿搭挑戰 | AI 評分 60s 流程 | [ ] |
| 7.6 | `card-battle` | 抽卡比大小 | 邀好友（測試 2 帳號） | [ ] |
| 7.7 | `style-pk` | 穿搭 PK | feed/submit/vote（PR #49 stub→ready）| [ ] |
| 7.8 | `style-relay` | 穿搭接龍 | 跑流程 | [ ] |
| 7.9 | `weekly-challenge` | 每週挑戰 | 報名 → 提交 | [ ] |
| 7.10 | `co-create` | 共創穿搭 | 開房 + 邀請 | [ ] |
| 7.11 | `wish-pool` | 許願池 | 投許願 → 看別人的 | [ ] |
| 7.12 | `blind-box` | 穿搭盲盒 | 互送一輪 | [ ] |
| 7.13 | `queen-vote` | 女王投票 | 投票 → 結果 | [ ] |
| 7.14 | `team-style` | 團體穿搭房 | 開房 + 邀請 | [ ] |

> 若任何遊戲 implementationStatus='stub' 而前台沒擋掉 → 算 bug。

---

## 8. Admin CRUD

> **謹慎**：這會動 prod 資料。建一筆假訂單測完記得 admin 直接刪。

| # | Collection | 動作 | 結果 |
|---|---|---|---|
| 8.1 | Products | 新增 / 改價 / 改庫存 / 刪 | [ ] |
| 8.2 | Categories | Shopline 拖曳樹（PR #90/#91）— 拖移 / 改父子 / 4 顆動作鈕 | [ ] |
| 8.3 | Orders | 改 status / paymentStatus / trackingNumber | [ ] |
| 8.4 | Coupons | 新增 / 改 / disable | [ ] |
| 8.5 | Bundles | 新增組合商品 + 上架到 `/bundles` | [ ] |
| 8.6 | GiftRules / AddOnProducts | 同 8.5 | [ ] |
| 8.7 | TaxSettings global | 改稅率 + verify 結帳重算 | [ ] |
| 8.8 | OrderSettings global | toggle email 開關 + verify 對應行為 | [ ] |
| 8.9 | GlobalSettings | 改 metaPixelId / siteName / footer | [ ] |
| 8.10 | Media upload | 上傳 jpg/png/webp 各一張 → 都成功；上傳 svg → **應被擋**（PR #4）| [ ] |
| 8.11 | LoginAttempts | 看到自己這幾天的成功登入紀錄 | [ ] |
| 8.12 | `/admin/login` BasicAuth | 若 ADMIN_BASIC_USER/PW 已設，先過一道 401 | [ ] |

---

## 9. SMTP / Email 收件實測

> 整輪測下來累計收件數應該是：
>
> - 註冊 ×1（若 email verify on）
> - reset password ×1
> - 訂單確認 ×N（每筆訂單）
> - admin new order ×N（每筆 → adminAlertEmails 收）
> - shipped / cancelled / refunded ×?
> - 退貨申請 / 退貨核准 / 換貨申請 / 換貨核准 ×?
> - contact form → admin
>
> 若有任何「應該寄」沒收到 → 可能 SMTP 沒設好（`.env.example` 沒列 SMTP vars，prod 是否真的接 Resend / SES / MailHog 未驗）。

| # | 期望事件 | 收到？ | 結果 |
|---|---|---|---|
| 9.1 | 訂單確認信 | [ ] |
| 9.2 | shipped 通知 | [ ] |
| 9.3 | cancelled 通知 | [ ] |
| 9.4 | refunded 通知 | [ ] |
| 9.5 | admin new order alert | [ ] |
| 9.6 | 退貨申請信（給客戶）| [ ] |
| 9.7 | 退貨新單信（給 admin）| [ ] |
| 9.8 | 退貨核准信（給客戶）| [ ] |
| 9.9 | 換貨同上 3 封 | [ ] |
| 9.10 | contact form admin 收件 | [ ] |
| 9.11 | reset password | [ ] |
| 9.12 | （若 verify on）註冊驗證信 | [ ] |

---

## 10. 響應式 / 跨裝置

| # | 裝置 | 測 | 結果 |
|---|---|---|---|
| 10.1 | iPhone Safari | `/` `/products` `/cart` `/checkout` `/account` | [ ] |
| 10.2 | Android Chrome | 同 10.1 | [ ] |
| 10.3 | iPad Safari | 同 10.1 + `/diag` 截圖（驗 hydration 防禦）| [ ] |
| 10.4 | Desktop 1920×1080 | `/products` 列表 + admin | [ ] |
| 10.5 | Desktop 1366×768 | 同 10.4 | [ ] |

---

## 11. CSP / Tracking

| # | 動作 | 預期 | 結果 |
|---|---|---|---|
| 11.1 | Admin 設 metaPixelId | 前台 DevTools Network 看到 `connect.facebook.net/.../fbevents.js` 200（PR #96）| [ ] |
| 11.2 | DevTools Console 全程 | 沒有 CSP `Refused to load` 錯誤 | [ ] |
| 11.3 | GA4 ID 若設了 | gtag.js 200 + GTM container 載入 | [ ] |
| 11.4 | OAuth callback | 沒有 CSP 擋 | [ ] |

---

## 12. Edge cases / Error states

| # | 狀況 | 預期 | 結果 |
|---|---|---|---|
| 12.1 | 商品庫存歸零後加購 | 前台跳「庫存不足」/ checkout 擋下 | [ ] |
| 12.2 | 同 SKU 加購超過設定上限 | 數量被截到上限 | [ ] |
| 12.3 | 同訂單同 coupon 用第二次 | 應擋（usageLimitPerUser）| [ ] |
| 12.4 | Coupon expired 後試用 | 擋 | [ ] |
| 12.5 | 不存在的網址（/foobar）| 404 頁面 + nav 仍可用 | [ ] |
| 12.6 | API 故意 POST 空 body | 400 而非 500 | [ ] |
| 12.7 | 未登入呼叫 `/api/cart` GET | 401 silently | [ ] |
| 12.8 | 未登入呼叫 `/api/orders` POST | 401 / 403 | [ ] |
| 12.9 | 進別人的 `/account/orders/<otherUserOrderId>` | redirect / 403 | [ ] |
| 12.10 | DB 連線失敗時 | 友善錯誤頁 / 不暴露 stacktrace | （難重現，跳過）|

---

## 13. 已知缺口確認（不應 FAIL，但要確認）

| # | 描述 | 預期狀態 |
|---|---|---|
| 13.1 | ECPay paymentMethod 實際付款 | unpaid（待組 A）|
| 13.2 | Invoice 真打 ECPay API | hook 觸發但 API stub（待組 B）|
| 13.3 | refundMethod=credit 自動入 WalletTransactions | 未接（待組 E）|
| 13.4 | Phase 3 遊樂場外部 API | 未接（待組 D）|
| 13.5 | PayPal | 未接（待組 F）|
| 13.6 | Apple OAuth | 503（等 Dev Program）|
| 13.7 | sitemap 缺政策頁（ISSUE-009）| 未確認是否已補 |

---

## 14. 統計與彙整

跑完一輪後在底部填：

```
總共測試項目: ___ 項
PASS: ___
FAIL: ___
BLOCKED / NOT TESTED: ___
新發現 issue 數: ___ 條（明細請開 docs/issues/ISSUE-XXX.md）

按組別分類的 issue 數：
- 組 A (ECPay 付款): ___
- 組 B (ECPay 發票): ___
- 組 C (ALL-CAPS 審計): ___
- 組 D (Phase 3 遊樂場): ___
- 組 E (退換貨後續): ___
- 組 F (PayPal): ___
- 組 G (稅金多幣別): ___
- 組 H (Gamification): ___
- 其他 / 未分類: ___

封測是否可繼續？ [ ] Yes [ ] No, blocker:
正式上線前還缺什麼？ ...
```

---

## 附錄 A — 開 issue 模板

```markdown
# ISSUE-XXX: <一行標題>

**Severity**: P0 Blocker / P1 High / P2 Medium / P3 Low
**Group**: A / B / C / D / E / F / G / H / I / unassigned
**Found by**: 2026-04-24 manual checklist §X.Y
**URL**: https://pre.chickimmiu.com/...

## 重現步驟
1. ...
2. ...
3. ...

## 預期 vs 實際
**預期**: ...
**實際**: ...

## 截圖 / Console log

```

## 修復建議
（可選）

## 影響
（影響哪些使用者 / 哪些路徑連帶受影響）
```

---

## 附錄 B — 跑完後 commit 此檔

跑完 checklist 把每個 [ ] 勾成 [x] 或 [FAIL]，然後：

```bash
git add docs/qa/manual-checklist-2026-04-24.md
git commit -m "qa(manual): closed-beta checklist results 2026-04-24"
git push
gh pr create --title "qa: 封測期人工實測結果 2026-04-24" --body "..."
```

新發現的 issue 各自 `docs/issues/ISSUE-XXX-*.md`，跟著同一個 PR。
