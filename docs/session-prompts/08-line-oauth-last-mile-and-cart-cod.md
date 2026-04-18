# Session handoff — LINE OAuth 最後一哩 + Cart + 貨到付款

> 2026-04-18 session 8 收尾。上一 session 把 LINE OAuth 從完全壞推到「OAuth 握手本身成功，但 Payload session bridge 還沒真的完成」，剩 3 件事要做。

---

## 已完成（請勿重做，memory 也已同步）

### PR #3 `feat/line-oauth` → main（commit `c6af222`）
- `src/auth.ts` signIn callback 裡加 `setPayloadSessionCookie()`，OAuth 成功後同時下 `payload-token` cookie
- `docs/LINE_LOGIN_SETUP.md` 設定手冊
- login page 的 known-limitation 註解已刪（commit `10b5647`）

### PR #5 `fix/line-oauth-state` → main（commit `a7fcce9`）
- `src/auth.ts` 的 `Line()` provider 顯式加 `checks: ['pkce', 'state', 'nonce']`
- 原因：Auth.js v5 內建 LINE provider 預設 `checks` 只放 `pkce`，LINE Login v2.1 要求 `state`，不加會被 LINE callback 擋成 `error=INVALID_REQUEST&error_description='state' is not specified`

### Prod 部署 + env 換 Channel
- `ssh ckmu-prod` → `git pull origin main` → `pnpm build` → `pm2 restart --update-env`
- `.env`：`AUTH_LINE_CHANNEL_ID=2009827245`（**新 channel**，舊的 `1594635781` 廢掉，使用者不換只能新開）+ 對應 secret
- LINE Developers Console：Callback URL `https://pre.chickimmiu.com/api/auth/callback/line` 已登記在 **Channel 2009827245**（使用者實測已回 code，state 驗證也過）

### nginx proxy buffer 調大
- `/etc/nginx/sites-enabled/pre.chickimmiu.com` 加：
  ```nginx
  proxy_buffer_size 16k;
  proxy_buffers 8 16k;
  proxy_busy_buffers_size 32k;
  ```
- 原因：NextAuth signin 回 3 個 JWE-encrypted cookie（state/nonce/pkce_verifier）共 ~3KB，default 4k buffer 擠不下 → 502 Bad Gateway
- backup: `/etc/nginx/sites-enabled/pre.chickimmiu.com.bak-20260418-095347`

### DB migration 補跑
- `pnpm payload migrate` → 應用 `20260418_220000_add_login_attempts`（PR #2 security-polish 有註冊在 `src/migrations/index.ts` 但從沒在 prod DB 跑過）
- 加了 `login_attempts` 表 + `payload_locked_documents_rels.login_attempts_id` 欄位
- DB 安全快照：`/var/www/chickimmiu/data/chickimmiu.db.pre-login-attempts-migrate-20260418-095951`
- 原因：bridge fix 的 `payload.find({collection:'users'})` 會觸發 Payload 查 locked-documents，drizzle 組 SQL 引用 `login_attempts_id` 欄位，缺欄位就炸 `SQLITE_ERROR: no such column`，錯誤被 NextAuth 吃掉包成 `OAuthCallbackError: OAuth Provider returned an error`（很誤導）

### LINE OAuth 握手驗證全綠
curl 透過 HTTPS 實測 `POST /api/auth/signin/line?` → `302 Found`：
```
location: https://access.line.me/oauth2/v2.1/authorize
  ?client_id=2009827245            ✓ 新 Channel
  &state=eyJhbGciOi...              ✓ LINE 要求
  &nonce=...                        ✓ OIDC replay protection
  &code_challenge=...               ✓ PKCE
```
Set-Cookie 4 個（callback-url / state / pkce / nonce）順利通過 nginx。

---

## 本 session 要做

### 1. ⚠️ LINE 登入「最後一哩」— 使用者回報仍被踢

使用者 2026-04-18 10:04 測試：LINE 授權完成 → 跳回 `/account` → 馬上又被踢回 `/login?redirect=/account`。

症狀判讀：NextAuth session cookie 有，但 `payload-token` cookie 沒有 → Payload `payload.auth({headers})` 不認識使用者 → `/account/**` 全 redirect。表示 **bridge fix 的 `setPayloadSessionCookie()` 在 DB migration 之後仍在某處失敗**。

**上一 session 結束時做的事**（續跑前確認）：
- 10:16:47 UTC 把 `/root/.pm2/logs/chickimmiu-nextjs-error.log` 和 `out.log` 都截斷到 0 bytes
- `pm2 restart --update-env` 新 pid 43106（fresh process，確定讀到 migrated schema）
- **請求使用者在隱私視窗重測**，但使用者沒回就要交接了

**下一步診斷流程**：

1. 問使用者「剛剛有隱私視窗重測嗎？還是還沒？」
2. 如果還沒 → 請使用者現在測：
   - 新開 Chrome 隱私視窗
   - 打 `https://pre.chickimmiu.com/login`
   - 點 LINE → 授權 → 看停在哪個 URL
   - DevTools → Application → Cookies → 看有沒有 `payload-token`
3. 同時 tail server log：
   ```bash
   ssh ckmu-prod 'pm2 logs chickimmiu-nextjs --lines 100 --nostream | tail -120'
   ssh ckmu-prod 'tail -100 /root/.pm2/logs/chickimmiu-nextjs-error.log'
   ```
4. 找 `[NextAuth] signIn callback error:` 字串（bridge 的 catch 會印這個 prefix）

**剩餘可能失敗點**（DB 已解掉，排查順序）：
- **(a)** `payload.secret` 沒載入 → `jwtSign` 會炸。檢查：`ssh ckmu-prod "grep PAYLOAD_SECRET /var/www/chickimmiu/.env"`。沒值或 undefined 就是兇手。
- **(b)** `authConfig.tokenExpiration` undefined → `jwtSign` 可能噴 NaN / cookie maxAge 錯。檢查 `src/collections/Users.ts` auth 區塊有沒有 `tokenExpiration`。PR #4 security-polish 改過 Users.ts（加 maxLoginAttempts + lockTime），可能沒動到 tokenExpiration 但還是要看。
- **(c)** cookie domain / sameSite / secure 設不對 → 瀏覽器接到但 Payload 在下次 request 讀不到。檢查 Payload config 有沒有設 `cookies.domain`；prod 在 `pre.chickimmiu.com`，不該設 domain（讓瀏覽器預設 host-only）。sameSite 這 session bridge 用 `'lax'` 應該 OK（same-site redirect 都走）。
- **(d)** 使用者透過 PROXY/VPN/加速器，cookie 被中間人擋 → 不太可能但可以問。

Bridge code 位置：`src/auth.ts` lines 73-140（signIn callback）+ 147-196（`setPayloadSessionCookie` fn）。

**驗收**：
- 使用者真實 LINE 登入 → DevTools 看到 `__Secure-authjs.session-token` **AND** `payload-token` 兩個 cookie
- 直接打 `/account/points` 不被 redirect
- pm2 error log 乾淨

---

### 2. 購物車「商品無法加入購物車」— 待確認細節

使用者只丟一句「商品無法加入購物車」，還沒提供：
- 具體商品 slug / URL
- 「無法」是按了沒反應 / 有錯誤訊息 / Console 紅字 / 網路請求失敗？
- 是登入狀態還是 guest？

**已知 context**：
- PR #3 commerce-core（commit `f513daa` on `feat/commerce-core` branch）**尚未 merge 到 main**
- 那個 PR 加了：Carts collection（server-side sync）+ `/api/cart` endpoints + `/api/shipping-settings` endpoint + Orders.ts beforeChange 庫存扣減
- Prod 目前跑 `a7fcce9`（`feat/commerce-core` 沒進），所以 cart 是舊的 localStorage-only 版本
- 理論上 guest localStorage cart 還能加（沒要打 server），如果失敗可能是 cart UI / store 層的 bug

**下一步**：
1. 問使用者具體商品 URL + 重現步驟 + Console log 截圖
2. 如果是 guest localStorage 炸：查 `src/stores/cartStore.ts` 和 PDP 頁面 add-to-cart button
3. 如果是登入狀態需要 server sync：很可能要先 merge PR #3（`feat/commerce-core` → main），之後 deploy
4. **重要**：本 repo `C:/Users/mjoal/ally-site/chickimmiu/` working tree 上有 PR #3 的未 commit 變更（cart/page.tsx, Orders.ts, cartStore.ts, api/cart/, api/shipping-settings/ 等），那些是**另一個 worktree/session** 留下的殘影，不要拿來做 cart fix。要修 cart 請先 `git log --oneline -10` + `git worktree list` 搞清楚狀態，必要時用 `C:/Users/mjoal/ally-site/ckmu-line-oauth/` worktree（feat/line-oauth branch，空白 wt）或新開 worktree。

---

### 3. 貨到付款（COD）正式 payment option — 新 feature

使用者確認：**正式長駐選項，不是測試捷徑**。

**Scope（和使用者同步過）**：

**DB / collections**：
- `src/collections/Orders.ts` 加 `paymentMethod` select：`credit_card`（ECPay）/ `cod`（貨到付款），未來可延伸 `bank_transfer`
- 加 `codFee` number 欄位（admin 可設 per-order override，預設走 global）
- `paymentStatus` 行為：COD 訂單下單 → `unpaid`；配送員收款回報 → admin 手動 mark `paid`

**Global settings**：
- 新增或擴充 `PaymentSettings` global：
  - `codEnabled` boolean（是否開放 COD）
  - `codDefaultFee` number（預設手續費，台灣通常 30 元）
  - `codMaxAmount` number（COD 訂單金額上限，太貴的不讓 COD）

**Checkout page**（`src/app/(frontend)/checkout/page.tsx`）：
- 付款方式 radio 多一個「貨到付款」選項
- 選了 COD 就把 ECPay 區塊隱藏
- 訂單總金額顯示 `COD 手續費` line item
- 驗證：訂單金額 > `codMaxAmount` 就不讓選 COD（UI 禁用 + error text）

**Migration**：
- 新 migration `yyyymmdd_hhmmss_add_cod_payment.ts` 加 `payment_method` / `cod_fee` 欄位到 `orders` 表
- 沿用專案 PRAGMA 冪等 pattern（參考 `20260418_220000_add_login_attempts.ts`）

**Admin workflow**：
- Orders 列表加 filter 按 paymentMethod
- COD 訂單配送完後 admin 手動 mark paid（之後可接 courier API）

**注意 dependency**：
- 使用者目前測不動 cart（上一項），所以 e2e 購買流程測不了
- COD 可以先做 code + migration，但 e2e 驗證要等 cart 修好
- 或者：merge PR #3 commerce-core 把 cart 修好 → 再接著做 COD（順序比較合理）

**建議做法**：獨立 branch `feat/cod-payment`，全部開好後 PR 給使用者 review。

---

## Prod 其他狀態（本 session 不動，知情即可）

- pm2 restart count 17（今天幾波 deploy 累積）
- Prod 跑 Next 15.5.15 + Payload 3.x + SQLite @ `/var/www/chickimmiu/data/chickimmiu.db`
- 日備份 + R2 offsite 有開（memory project_prod_hetzner_deployment.md）
- nginx default 站點還在，跟 pre.chickimmiu.com 共用 80/443 port；nginx -t 有 warn 但不影響

---

## 參考

- **Branches**:
  - `feat/cron-runner` (local HEAD, 但實際 PR #4 已合 main 為 `b8cb2a8`)
  - `feat/line-oauth` → PR #3 已合（`c6af222`）
  - `fix/line-oauth-state` → PR #5 已合（`a7fcce9`）
  - `feat/commerce-core`（commit `f513daa`）**未合**，有 cart + shipping-settings
- **Worktrees**:
  - `C:/Users/mjoal/ally-site/chickimmiu` (feat/cron-runner，working tree 有 PR #3 殘影別碰)
  - `C:/Users/mjoal/ally-site/ckmu-line-oauth` (feat/line-oauth，乾淨，可拿來新 branch)
  - `C:/Users/mjoal/ally-site/ckmu-auth-hardening`、`ckmu-member-fields`、`ckmu-sec-polish`（其他 session）
- **Bridge code**:
  - `src/auth.ts:73-140` signIn callback（含 setPayloadSessionCookie call）
  - `src/auth.ts:147-196` setPayloadSessionCookie fn（getFieldsToSign + jwtSign + cookies().set）
- **Auth doc**: `docs/LINE_LOGIN_SETUP.md`
- **Previous handoff**: `docs/session-prompts/07-line-oauth-deploy.md`
- **SSH alias**: `ssh ckmu-prod` (5.223.85.14)
- **Prod deploy path**: `/var/www/chickimmiu`
- **log 位置**:
  - `/root/.pm2/logs/chickimmiu-nextjs-{out,error}.log`
  - `/var/log/nginx/{access,error}.log`
- **`gh` CLI 在這台 Windows 沒裝**，PR 操作都要使用者在瀏覽器點

---

## Session opener prompt（給使用者貼到新 session）

```
繼續 LINE OAuth 最後一哩 + cart + 貨到付款。上一 session 把 4 層
root cause（state param / channel ID / nginx buffer / login-attempts
migration）全解掉，LINE OAuth 握手到 /account 已經 work，但 Payload
session bridge 在某處還是沒下 `payload-token` cookie，所以 /account
還是被踢回 /login。

完整交接在 docs/session-prompts/08-line-oauth-last-mile-and-cart-cod.md，
請先讀那個檔，然後：

1. 問我「隱私視窗有重測嗎？」— 如果沒測我現場測，你 tail
   `ssh ckmu-prod 'tail -100 /root/.pm2/logs/chickimmiu-nextjs-error.log'`
2. 找 `[NextAuth] signIn callback error:` 訊息，排查
   (a) PAYLOAD_SECRET (b) Users.auth.tokenExpiration (c) cookie 屬性
3. 解掉之後問我 cart 的具體症狀（商品 URL / Console 錯誤 / guest or logged-in）
4. Cart 修好之後再做貨到付款 feature（scope 在交接檔）
```
