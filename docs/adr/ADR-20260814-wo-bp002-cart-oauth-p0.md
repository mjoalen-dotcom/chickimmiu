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

## 4. 未做（刻意）

- **沒有在 prod 建測試訂單**跑端到端結帳。Campaign Engine 上線後「真人下單成功」這一哩
  目前只有偽造單被擋的證據，沒有正常單成立的證據；要補這個驗證會在 prod 產生真訂單
  （扣庫存、寄信、之後要取消），屬於有副作用的動作 → 留給 Alan 決定。
- **Facebook email 不採信**的副作用：未來 FB 上線後，既有 email 會員第一次用 FB 登入會建立
  新帳號而不是併進舊帳號。安全優先；若要改成可併，正確做法是「登入後在會員中心做綁定驗證」，
  不是回頭信任未驗證 email。
