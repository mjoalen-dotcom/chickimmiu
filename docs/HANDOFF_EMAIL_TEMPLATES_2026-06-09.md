# 交接：自動化 Email 模板系統（範圍＝「全都做」）— 2026-06-09

> 給新對話：這份是自足交接包，照它做即可，**不必重做調研**。部署 SOP / dev DB drift / 乾淨 temp DB 驗證招式 → 見 `docs/HANDOFF_SHOPLINE_PARITY_2026-06-09.md`（不重複）。開工前 `git log --oneline -5` 確認狀態（user 多 session 並行）。

## 0. 任務 / 範圍（user 拍板＝全都做）
做一個「**後台可編輯 / 即時預覽 / 測試寄送**」的 email 模板系統，自動套變數、依事件自動寄出。範圍：
- **核心**：會員歡迎信 + 訂單 6 種狀態通知（確認 / 出貨 / 送達 / 取消 / 退款 / 後台新單提醒）→ 全部改成可編輯模板 + 預覽 + 測試寄送 + 變數自動套用。
- **(A) 接通行銷/旅程 email**：`channelDispatcher.sendEmail` / `automationEngine.send_email` 的死 stub → 真的 `payload.sendEmail`（解鎖既有 campaign / 生日 / 自動化旅程 email）。
- **(B) auth 信也可編輯**：email 驗證信 / 忘記密碼信納入同一套模板系統（token 自動帶入）。

## 1. 起點狀態
- branch `feat/shopline-parity`，HEAD `36301ab` == `hetzner/main` == 已部署 prod。**本 email 探索沒改任何檔**（純調研）。
- canonical git = hetzner（GitHub 停權，**絕不 push origin**）。prod `5.223.85.14:/var/www/chickimmiu`，SQLite，`https://pre.chickimmiu.com`。

## 2. 既有 email 基礎 — **重用，別重造**（已調研確認）
1. **Transport 已 live**：`@payloadcms/email-resend`，`src/payload.config.ts:113-153` 的 `resendAdapter` **env-gated**（無 `RESEND_API_KEY` → console fallback，只 log 不真寄、永不 throw）。寄信 primitive = **`payload.sendEmail({ to, subject, html })`**。FROM = name `CHIC KIM & MIU` / address `EMAIL_FROM_ADDRESS`(env, 預設 `no-reply@chickimmiu.com`)。`.env.example:87-96`。
2. **`src/lib/email/`（9 檔，全 live）**：
   - `_shared.ts` — **`emailWrapper({headline, preheader, content})`** 品牌外框（bg `#faf6ec`、金 `#c9a961`、卡片 `#fff`）+ `escapeHtml` / `ntd` / `renderItemsTable` / `renderAddress` / `renderTracking` / `getCustomerEmailFromOrder(payload, order)` / `orderAccountUrl` / `adminOrderUrl`。**全部重用。**
   - `orderConfirmation.ts` / `orderShipped.ts` / `orderCancelled.ts` / `orderRefunded.ts` / `adminNewOrderAlert.ts` + 退貨 3 檔。每檔 pattern：`getCustomerEmailFromOrder` → 組 `subject` + `content`(內層 HTML) → `emailWrapper(...)` → `payload.sendEmail`。**`orderShipped.ts` 是重構樣板。**
3. **Orders.ts afterChange hooks（`:1083-1164`）已接好自動寄信**：`pending→processing`=確認信（gated `OrderSettings.notifications.sendConfirmationEmail`）、`→shipped`=出貨（`sendShippedEmail`）、`→cancelled`、`→refunded`、`create`=後台新單提醒（`sendAdminNewOrderAlert` + `adminAlertEmails[]`）。**`→delivered` 沒信（缺口）**。status 值 `:296-308`（pending/processing/shipped/delivered/cancelled/refunded）；`trackingNumber :393`、`shippingMethod` group `:371-391`、`orderNumber :106-115`。
4. **`{{變數}}` 合併引擎已存在**：`src/lib/marketing/personalizedContent.ts` 的 **`replaceTemplateVariables(template, vars)` (`:189-202`)**（`{{var}}` regex replace）→ **重用此函式**。`generatePersonalizedContent(templateId, userId) (:67-164)` 載 message-templates + 組 user 變數。
5. **行銷 email 死 stub**：`src/lib/marketing/channelDispatcher.ts` `sendEmail (:222-267)` 只 `console.log` 從不呼叫 `payload.sendEmail`（讀 `CRMSettings.emailSenderName/Address`）。`src/lib/crm/automationEngine.ts` `send_email case (:426-430)` 同樣 stub。**各一行改 → payload.sendEmail**。
6. **auth 信（Payload 原生，inline Users.ts）**：忘記密碼 `:73-91`（reset URL `${NEXT_PUBLIC_SITE_URL}/reset-password?token=`）、email 驗證 `:97-116`（`/verify-email?token=`，gated `GlobalSettings.emailAuth.requireEmailVerification`）。`generateEmailHTML` **可改成 async**（回 `Promise<string>`）→ 可載模板。
7. **後台預覽 / 自訂 view pattern**：`src/components/admin/BlogAIDraftView.tsx`（server view 包 `DefaultTemplate` + admin gate + `'use client'` 子元件）；註冊在 `payload.config.ts:313-367` 的 `admin.components.views.*`。**⚠️ 加任何 `admin.components.*` 必跑 `pnpm payload generate:importmap` 並 commit `src/app/(payload)/admin/importMap.js`，否則 silently 不掛載、無 console error（本 repo 中過 2 次雷）**。
8. **品牌 / 寄件人資料**：`GlobalSettings.site.siteName :47` / `logo` / `businessInfo.email :161` / `socialLinks :136`。**無**專屬 email from-name/reply-to/footer 的 global。
9. **沒有** react-email / mjml / handlebars，只有 `@payloadcms/email-resend`；HTML 全是 template literal。
10. **Users 退訂欄位（行銷要尊重）**：`subscriptionStatus.emailSubscribed :657`（預設 true）/ `smsSubscribed` / `lineSubscribed` / `unsubscribedAt :680`。`notificationPreferences :1303` 是 **admin-only**，別拿來 gate 客戶信。**交易信（歡迎/訂單）bypass 退訂（legitimate interest）；行銷信才檢查 `emailSubscribed`。**

> ⚠️ 也別跟 customer-service 的 `Messages` / `MessageTags` / `Conversations` 搞混（那是客服 inbox，不是 email）。

## 3. 設計（具體）
**核心決策：建專屬 `EmailTemplates` collection**（交易事件導向，比硬塞 marketing `message-templates` 清楚、解耦）。`message-templates` 留給行銷。

### 3.1 `src/collections/EmailTemplates.ts`（slug `email-templates`，group ④ 行銷推廣）
欄位：
- `name`（text）、`eventKey`（select **unique**：`welcome` / `order_confirmation` / `order_shipped` / `order_delivered` / `order_cancelled` / `order_refunded` / `admin_new_order` / `auth_verify` / `auth_forgot_password`）
- `enabled`（checkbox，預設 true）
- `subject`（text，支援 `{{var}}`）、`headline`（text，`{{var}}`）、`bodyHtml`（`type:'code'` lang html 或 textarea，`{{var}}`）
- `availableVariables`（`type:'ui'` 或 readonly textarea：依 eventKey 列出該事件可用變數清單，給 admin 參考）
- （選）`previewSample`（json：預覽用樣本變數）
- 存取：admin only（read/create/update/delete = isAdmin）。afterChange revalidate 不需要（後台用）。

### 3.2 `src/lib/email/renderFromTemplate.ts`
```ts
// renderEmailFromTemplate(payload, eventKey, vars) → { subject, html } | null
// 1. find email-templates where eventKey == eventKey AND enabled; 無 → return null（caller fallback 現有 HTML）
// 2. subject = replaceTemplateVariables(tpl.subject, vars)
// 3. content = replaceTemplateVariables(tpl.bodyHtml, vars)
// 4. headline = replaceTemplateVariables(tpl.headline, vars)
// 5. html = emailWrapper({ headline, preheader: vars.preheader, content })
// return { subject, html }
```
重用 `replaceTemplateVariables`（from personalizedContent）+ `emailWrapper`（from _shared）。

### 3.3 結構化區塊用「已 render 變數」注入
senders 先用 `_shared` helper 把品項表 / 物流 / 地址 / 按鈕 render 好，當變數傳進去，admin 在 body 用 `{{itemsTable}}` `{{trackingBlock}}` `{{addressBlock}}` `{{orderButton}}` 擺位置；純量另給 `{{customerName}}` `{{orderNumber}}` `{{total}}` `{{itemCount}}` 等。→ admin 自由改文案/主旨，訂單資料照樣正確 render。

### 3.4 每個 sender 重構（零退化）
```ts
const vars = { customerName: name||'會員', orderNumber, total: ntd(total), itemCount,
  itemsTable: renderItemsTable(items), trackingBlock: renderTracking(shippingMethod),
  addressBlock: renderAddress(shippingAddress, shippingMethod),
  orderButton: `<a href="${orderAccountUrl(orderId)}" ...>查看訂單</a>`, preheader }
const tpl = await renderEmailFromTemplate(payload, 'order_shipped', vars)
if (tpl) { await payload.sendEmail({ to: email, subject: tpl.subject, html: tpl.html }); return }
// else → 現有 hardcoded 路徑（保留，當 fallback）
```
→ 模板停用/未建時完全走舊行為，**不可能弄壞現有信**。

### 3.5 Seed 預設模板（migration 內 INSERT 或 seed script）
把**每個 sender 現有的 subject / headline / 內層 content** 抽出來當該 eventKey 的預設 `subject`/`headline`/`bodyHtml`（把結構化段落換成 `{{itemsTable}}` 等佔位）。→ admin 一進來就是現有設計、可微調。

### 3.6 新增信
- **歡迎信**：`src/lib/email/welcome.ts` `sendWelcomeEmail(payload, user)`（eventKey `welcome`，變數 `{{customerName}}`/`{{accountUrl}}`/`{{couponBlock}}`?），hook 進 `customerRegister.ts`（`:174` create 之後）或 `Users.afterLogin` 首次登入。template enabled 才寄。
- **送達信**：`src/lib/email/orderDelivered.ts` + Orders hook `→delivered`（eventKey `order_delivered`，可帶評價/回購 CTA）。

### 3.7 預覽 / 測試寄送（後台 view）
- `src/components/admin/EmailTemplatePreviewView.tsx`（copy `BlogAIDraftView`：server view + admin gate + `'use client'` 子）：左選 eventKey、右 iframe `srcDoc={渲染後完整 html}`（用 previewSample 變數即時合併）、「寄測試到我信箱」按鈕。
- 測試寄送 API：`src/app/api/admin/email-templates/test/route.ts`（admin gate → renderEmailFromTemplate(eventKey, sample) → `payload.sendEmail({ to: 登入 admin email })`）。
- 註冊 `admin.components.views.emailTemplatePreview`（path `/tools/email-templates`）→ **`pnpm payload generate:importmap` + commit importMap.js**。
- （選）模板編輯頁內加 `type:'ui'`（`'use client'`）即時預覽欄位。

### 3.8 (A) 行銷/旅程 email 接通
- `channelDispatcher.sendEmail (:222-267)`：把 `console.log` 換成 `await payload.sendEmail({ to: email, subject, html })`（content 是 HTML 就直送；純文字用 `emailWrapper` 包）。**行銷信先檢查 `users.subscriptionStatus.emailSubscribed`，false 則跳過**。
- `automationEngine.send_email (:426-430)`：載對應 template（用 `generatePersonalizedContent` 或 `renderEmailFromTemplate`）→ `payload.sendEmail`。

### 3.9 (B) auth 信納入模板
- `Users.ts` `auth.verify.generateEmailHTML` / `auth.forgotPassword.generateEmailHTML` 改 **async**：`renderEmailFromTemplate(payload, 'auth_verify', { name, verifyUrl })`，無模板/失敗 → 現有 inline HTML fallback。token URL 當變數 `{{verifyUrl}}` / `{{resetUrl}}` 帶入。⚠️ 這支在 Payload auth 流程內跑，fallback 要穩。

### 3.10 （選）寄件人 chrome 設定
要 admin 可改 from-name / reply-to / footer：新增 `EmailSettings` global 或擴 `GlobalSettings`；並 reconcile 孤兒 `CRMSettings.emailSenderName/Address`。非必要，可後話。

## 4. 安全性質（務必保留）
- 寄信 **env-gated**（無 `RESEND_API_KEY` → console fallback）→ **建 + 部署都安全，不會真的寄給客戶**，直到 user 設好 key + verified domain 並啟用模板。
- **Fallback to hardcoded**：模板層是 override，停用即回舊行為 → 零退化。
- 交易信 bypass 退訂；行銷信尊重 `emailSubscribed`。

## 5. 驗證（乾淨 temp DB；見 shopline handoff §6 招式）
- `scripts/verify_email_templates.ts`：seed email-templates → 每事件 `renderEmailFromTemplate(sample vars)` 斷言 subject/html 已合併 + 結構化區塊出現；測 **fallback**（停用 → null → 走 hardcoded）；測 welcome/delivered sender（console-fallback transport 不 throw）；測 marketing stub 現在會呼叫 sendEmail（不 throw）。
- 預覽 view：preview 工具開乾淨 temp DB dev server → `/admin/.../tools/email-templates` → render + 測試寄送（console fallback 收得到 log）。
- `tsc 0`；**加 admin view 後 `pnpm payload generate:importmap`**；新欄位/collection 一律附冪等 PRAGMA migration（學本 repo 既有 pattern；`payload-types.ts` 是 gitignored，加新 collection slug 的 typed `find()` 要先 `pnpm payload generate:types` 才 tsc 過）。
- **🔑 Payload SQLite relationship CREATE 要傳原型別 id（integer），`String(id)` 會 invalid**（本 repo 反覆踩過）。

## 6. 部署
hetzner push + `SKIP_GIT_RESET=1 ... /root/deploy-ckmu.sh` + **有新 migration 手動補跑** `ssh prod 'cd /var/www/chickimmiu && yes y | pnpm payload migrate'`（deploy 內 auto-migrate 被 dev-dirty prompt 擋住會靜默跳過）。importMap.js 要 commit。詳見 shopline handoff §3。

## 7. 🔴 卡關（等 user 給）
- **`RESEND_API_KEY` + 已驗證寄件 domain（`EMAIL_FROM_ADDRESS`）**：沒有就只能 console-fallback（建/部署/預覽都 OK，但**不會真的寄給客戶**）。要真上線寄信，user 必須到 resend.com 建 key + 驗證 chickimmiu.com domain，寫進 prod `.env`。

## 8. 建議分階段（每階段 temp DB 驗證 → commit → 安全部署）
- **P1** 核心 editable：EmailTemplates collection + migration + `renderEmailFromTemplate` + 重構 5 既有 sender(fallback) + seed 預設。
- **P2** 新增信：welcome + delivered sender + hooks + 2 template 列。
- **P3** 預覽/測試寄送 admin view + test API + importMap regen。
- **P4** (A) 行銷/旅程 stub → 真寄（含 emailSubscribed gate）。
- **P5** (B) auth 信納入模板（async generateEmailHTML + fallback）。

## 9. 新對話開場白（建議貼這句）
> 接「自動化 Email 模板系統（全都做）」：先讀 `docs/HANDOFF_EMAIL_TEMPLATES_2026-06-09.md` + `docs/HANDOFF_SHOPLINE_PARITY_2026-06-09.md`，`git log --oneline -5` 確認在 `feat/shopline-parity`。照 §8 分階段做，每階段乾淨 temp DB 驗證 → commit → hetzner 部署。缺 RESEND_API_KEY 走 console-fallback 沒關係。
