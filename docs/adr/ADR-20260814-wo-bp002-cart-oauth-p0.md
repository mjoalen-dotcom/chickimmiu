# ADR-20260814 — WO-BP002 購物車／OAuth P0 稽核與修復

- **狀態**：已實作、本機驗證完畢，**尚未部署**（等 Alan 授權：本次動到登入鏈）
- **基準**：`hetzner/main` a06556e（= 當時 prod）
- **工作分支**：`fix/wo-bp002-cart-oauth-p0`（worktree `chickimmiu-wt-campaign`）

---

## 0. 工單範圍怎麼定的

WO-BP002 只存在於 hub 指揮台的待辦清單（`chickimmiu 購物車／OAuth P0 修復`，標籤 P0），
全機器上找不到對應的工單內文。因此本次把範圍定義為：
**對「購物車 → 結帳 → 建單」與「OAuth 登入鏈」兩條路徑做 P0 稽核，確認既有 P0 是否已關閉，
並修掉稽核當下發現的實際缺陷。**

### 購物車半邊：既有 P0 在 a06556e 已關閉（本次覆核，非重做）

| 既有 P0 | 狀態 |
|---|---|
| LB-02 選變體 → NT$0 結帳 | ✅ 已修（`4383555`） |
| LB-03 超賣無防護 | ✅ `Orders.beforeChange` 逐項比對可用庫存 |
| `total=0` / `paymentStatus=paid` 偽造 | ✅ Campaign Engine 伺服器權威計價（`2ebf9cb`…`a06556e`） |
| 負數量壓低總額 | ✅ `materializeCartLines` 過濾 `quantity > 0`，且 server 會覆寫 items |
| 商品卡隱形「加入購物車」鈕（觸控裝置） | ✅ 已修（`48649be`） |

→ 購物車這半邊本次**只找到 1 個新缺陷**（下面 C），其餘為覆核通過。

---

## 1. 修復項目

### A. 【P0 · 帳號接管】網頁 OAuth 用「未驗證的 provider email」匹配既有會員

**根因**：`socialIdentity.linkOrCreateSocialUser` 的第 2 順位是「email 相同 → 綁進既有會員」。
原生 App 那條路（`/api/v1/auth/social`）本來就擋掉未驗證 email：

```ts
const trustedEmail = identity.emailVerified ? identity.email : null
```

但**網頁**這條（`auth.ts` 的 NextAuth `signIn` callback）直接把 `user.email` 交下去，沒有同一道檢查。

**攻擊路徑**：攻擊者在某 provider 註冊一個掛著受害者 email 的帳號（該 provider 不強制驗證 email）
→ 在 CKMU 點該 provider 登入 → `signIn` 依 email 匹配到受害者的 Payload 會員 → 綁定社群 ID
→ `/api/auth/bridge` 簽出受害者的 `payload-token`。訂單、點數、購物金、地址全部落入攻擊者手中。

**修法**：

1. 新增純函式 `src/lib/auth/emailTrust.ts`，把「這個 provider 的 email 可不可信」集中成一份規則：
   - `google` → 只認 `email_verified === true`
   - `apple` → `true` 或字串 `"true"`（Apple 會序列化成字串）
   - `line` → LINE 只在 email 已由 LINE 驗證時才回傳 → 視為已驗證
   - `facebook` / 未知 → 不採信（fail closed）
2. `auth.ts` `signIn`：改傳 `trustedEmailFrom(provider, profile, user.email)`；未驗證 → `null`
   → 走 socialId-only 路徑，新帳號用 placeholder email（與 App 端行為一致）。
3. `auth.ts` `jwt`/`session`：把判定結果帶進 JWT（`providerEmailVerified`）。
4. `/api/auth/bridge`：**同一道門檻**。bridge 自己也會用 `session.user.email` 找 Payload user，
   只擋 `signIn` 不擋 bridge 等於沒修 —— 未驗證時不採用 email 分支，只走 `socialLogins.{field}`。

> 欄位刻意命名 `providerEmailVerified` 而非 `emailVerified`，避免與 Auth.js adapter 語意
> （`User.emailVerified: Date | null`）撞名。

**現網影響**：prod 目前只有 LINE 上線，LINE 判定維持「可信」→ 對現有使用者零行為變化；
Google / Apple / Facebook 是在憑證還沒上線前先把洞補起來。

### B. 【P1 · 釣魚跳板】`/api/auth/bridge?next=` 開放轉址

**根因**：`next` 只檢查「以 `/` 開頭且不是 `//`」。但 WHATWG URL parser 對 special scheme
會把反斜線當斜線，實測：

```
new URL('/\\evil.com', 'https://pre.chickimmiu.com')  →  https://evil.com/
```

於是 `/api/auth/bridge?next=/\evil.com` 會在使用者「真的完成 LINE 登入」之後把人送到外部網域
——掛在自家網域下、又出現在登入成功之後，是很高說服力的釣魚跳板。

**修法**：改用既有的 `safeInternalRedirect()`（`/login`、`/register` 早就在用），
它同時擋 `//`、`\`、CR/LF。**新增回歸測試** `safeRedirect.test.mjs`，斷言不是看字串長相，
而是「`new URL(結果, base).origin` 必須等於自家 origin」。

### C. 【P2 · 運費 fail-open】指定的物流查不到時，運費被當成 0

**根因**：`computeOrderPricing` 在 `findByID('shipping-methods')` 失敗時把 `shippingMethodDoc`
設成 `null`，於是 `shippingBaseFee = 0`。報價與建單吃同一支函式、同一個壞 id
→ 兩邊都算 0 → 總額比對「一致」→ **訂單以零運費成立**。反過來，若報價帶了壞 id、
建單卻沒帶 `shippingMethod.method`（走預估分支拿到真運費），兩邊就會永遠差一個運費 → 每筆 409。

**修法**：指定了 `shippingMethodId` 卻查不到 → `errors.push('shipping_method_not_found')` → fail closed
（quote 回 422、建單回 400「請回到購物車重新確認」）。空字串視同未指定，續走預估分支。

---

## 2. 驗證

| 項目 | 結果 |
|---|---|
| `node --test src/lib/auth/emailTrust.test.mjs`（新） | 5/5 PASS |
| `node --test src/lib/auth/safeRedirect.test.mjs`（新） | 5/5 PASS |
| `node --test src/lib/promotions/evaluator.test.mjs`（既有回歸） | 41/41 PASS |
| `npx tsc --noEmit` | 綠 |
| `pnpm build` | 綠 |

開放轉址的實測證據（修復前）：

```
"/\\evil.com" 通過舊防線: true  ->  https://evil.com/
```

---

## 3. 回滾

三個修復彼此獨立，皆為單檔可回退：

1. A：`git revert` 該 commit 即回到「email 直接匹配」（回到有洞的狀態，不建議）
2. B：改回原本兩行字串判斷
3. C：把 `errors.push('shipping_method_not_found')` 拿掉即回到 fail-open

無 DB migration、無 schema 變更、無設定變更。

### D. 【P0 · 超賣】庫存防線在 product id 是「數字」時整個被跳過

做訪客結帳的本機驗證時撞到的**既有 bug**（不是這次改壞的）：

```ts
// Orders.beforeChange（舊）
const productId = typeof item.product === 'string' ? item.product : item.product?.id
if (!productId || qty <= 0) continue   // ← 數字 id 走到這裡就 continue 了
```

`item.product` 有三種可能：字串（前台購物車的 id 是 `String(product.id)`）、
**數字**（App / server 端建單、SQLite 原生 id）、或 populated object。舊寫法只認
字串與物件 —— 數字 id 會讓 `productId` 變 `undefined`，整個「拒絕超賣」檢查被
`continue` 跳過。

**實測**（本機）：庫存 5 的商品，連下 8 筆單全部成立，庫存被 `Math.max(0, …)` 夾在 0，
等於賣掉 3 件不存在的貨。前台網頁因為送字串 id 沒中招，但 App 端與任何以數字 id 建單的
路徑（包含本次新增的訪客結帳）都會中。

**修法**：id 正規化 —— 物件取 `.id`，其餘直接用（字串或數字皆可），並改用
`productId == null` 判斷（`0` 不該被當成沒填）。驗證腳本也補了「庫存 +1 → 400
OUT_OF_STOCK 且庫存不變」的斷言（原本的 quantity 99999 其實是先撞到單筆件數上限，
驗不到庫存防線）。

---

## 3.5 追加：訪客結帳（Alan 2026-08-14 拍板「可以訪客結帳，但要設定開關」）

**開關**：沿用既有的後台欄位 結帳設定 → **允許訪客（非會員）結帳**
（`checkout-settings.checkoutAsGuest`，預設開）。前後端同一份判斷；前台設定拉不到時
fallback 取保守值（不允許），伺服器端再擋一次。

### 資料模型的取捨（重要）

`orders.customer` 是 **NOT NULL**，而且全站有大量「訂單一定有 customer」的假設
（訂單信、會員中心、金流擁有權檢查、點數／推薦／發票 hooks）。兩條路：

| 方案 | 代價 |
|---|---|
| 把 `orders.customer_id` 改成 nullable | SQLite 要**整表重建 orders**（全站最重要的表）+ 上述所有路徑都要改 → 迴歸面積極大 |
| **每筆訪客單開一個 `isGuest` 臨時帳號**（採用） | 多出臨時會員列；但既有路徑一行都不用改 |

採用後者。臨時帳號的 email 是**合成的**（`guest_<uuid>@guest.invalid`，RFC 2606
保留網域、不可投遞），顧客真正填的信箱寫進新欄位 `orders.guestEmail`，
所有訂單信件優先讀它。

> **為什麼不用顧客的真 email 當臨時帳號的 email**：那樣就得「同 email 重複使用同一個
> 訪客帳號」，而我們建單後會簽 session cookie（金流那關需要登入）——等於只要知道
> 某人的 email 就能拿到他過往訪客訂單的 session。合成信箱讓每筆訪客單各自獨立，
> 沒有這條側路。
>
> 也**刻意不查**「這個 email 是不是既有會員」：查了等於提供帳號列舉介面。代價是
> 忘記登入的會員會拿到一筆不在會員中心的訂單，前台用「登入後可累積點數與查詢紀錄」提示。

### 送單路徑

新增 `POST /api/checkout/guest-order`（不是放寬 `Orders.access.create`——那等於開放
任何人對 `/api/orders` 灌任意欄位）。這支只收：商品 id／數量／券碼／物流／收件資訊／email，
**完全不收金額欄位**。

⚠️ 關鍵陷阱：本路由用 local API 建單，而 `beforeChangeServerPricing` 對 local API 是
**跳過**的 → 這支自己就是計價權威，訂單金額全部取自 `computeOrderPricing`。庫存檢查
hook 沒有 local-API 豁免，仍會跑。券快照（`appliedCoupons`）也必須跟著寫，否則
訪客用券不計額度 = 無限次使用。

其他：IP 限流 5 次／10 分鐘；`maxItemsPerOrder` / `minOrderAmount` 伺服器端再驗一次；
建單失敗會把剛建的臨時帳號刪掉（否則每次失敗留一筆垃圾會員）；UTM 歸因以白名單搬運
（不送就會讓訪客單在廣告報表上全部變成無來源）。

### DB

`20260814_120000_add_guest_checkout`：兩個純增欄，不動既有資料、不動 NOT NULL。

```
orders.guest_email  TEXT
users.is_guest      INTEGER DEFAULT false
```

## 4. 未做（刻意）

- ~~沒有在 prod 建測試訂單~~ ✅ Alan 已授權，2026-08-14 已在 prod 跑完
  `scripts/verify-checkout-http-e2e.ts`：8/8 PASS（測試單 CKMU20260814001 建立 → 驗證 → 取消、
  庫存回補）。這補上了「伺服器計價強制不會誤殺正常訂單」的證據。
- **訪客訂單沒有訂單查詢頁**。訪客拿得到訂單編號與確認信，但沒有「用訂單編號 + email
  查詢」的頁面（session cookie 過期後就查不到了）。要不要做是下一個決策點。
- **臨時帳號會累積**：每筆訪客單一列 `isGuest` 會員。已用 `isGuest` 標記可在後台過濾，
  但會員總數統計要記得排除。
- **Facebook email 不採信**的副作用：未來 FB 上線後，既有 email 會員第一次用 FB 登入會建立
  新帳號而不是併進舊帳號。安全優先；若要改成可併，正確做法是「登入後在會員中心做綁定驗證」，
  不是回頭信任未驗證 email。
