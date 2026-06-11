# 36 — LINE B+C 整合 + Shopline 全功能轉移收尾（交接 2026-06-11）

> **📌 2026-06-12 追加（commit `df851c2` + `231737e`，已部署 prod）**
>
> - **BGM 左下按鈕沒聲音已修**（`231737e`）：BrandAnthemPlayer「video 讓位」listener 在 document capture phase 連 BGM 自己 `<audio>` 的 play 事件都攔 → 開播即自我 pause()。已排除自身；本地 prod build 瀏覽器實測播放連續 + video 讓位無回歸。
> - **main 不可 build 地雷已拆**（`df851c2`）：Products.ts/importMap 引用的 ProductCheckboxToggleCell/ProductInlineNumberCell 之前只在 `claude/gifted-turing-ef2d21`（`6c9ff59`）沒進 main，乾淨 checkout build 必炸（prod 靠 untracked scp 殘留副本撐著）。已從 `6c9ff59` 還原進 main。
> - ⚠️ 本地 `next dev` mount 必炸（dev-only webpack factory-undefined，見 HANDOFF_B5_DIAGNOSIS.md）→ 本地驗證一律 `pnpm build` + launch.json `chickimmiu-next-prod-3006`。

> **📌 2026-06-11 進度更新（commit `7efb313` + `891522b`，已部署 prod）**
>
> - **C 收尾 ✅ 全做完**：
>   - C#2 socialLogin 開關接通（login/register server wrapper + `SocialLoginButtons` 共用元件；缺 env 憑證 provider 自動隱藏 — prod 現在只剩 LINE 按鈕會出現）
>   - C#3 lineId-first 匹配 + 無 email LINE 帳號可登入（placeholder `@noemail.invalid` + `/account/settings` 綁定 Email UI + `POST /api/users/bind-email`；行銷信對 placeholder 自動跳過）
>   - C#1 端到端實測：⏳ 待 user 瀏覽器走一次 LINE 授權（程式已部署）
> - **B ✅ 程式全接真（user 拍板：沿用 Shopline channel 1661280982，總開關預設關）**：
>   - `src/lib/line/{client,verifySignature,orderNotifications}.ts` + `/api/webhooks/line` + CRMSettings `lineMessagingEnabled`（開啟跳 confirm 警告 Shopline 失效）/`lineChannelSecret` + migration `20260611_150000`
>   - channelDispatcher nested-bug 已修 + sendLineMessage 真推（尊重 `lineSubscribed`）+ automationEngine `send_line` 接真 + Orders afterChange 確認/出貨 LINE 推播
>   - ⏳ **剩 user 行動**：從 Shopline 後台抄 token/secret → 寫 prod `.env`（`LINE_CHANNEL_ACCESS_TOKEN`/`LINE_CHANNEL_SECRET`）或填 admin CRM 設定欄位；要切換時在後台打開總開關 + LINE Console 把 webhook 指到 `https://pre.chickimmiu.com/api/webhooks/line`
> - **P1 內容頁 ✅**：`/pages/offline-shop-1` + `/pages/tagckmu` 已 seed 上 prod（`scripts/seed-p1-content-pages.ts`）
> - 下一步：P2 內容頁（ckmustyle UGC 圖牆 / member-recommendation）+ P3 301 redirect map + 後台 inbox UI（客服中心 1B-1G）

> **給新對話的第一句話**：先讀完本文件再動手。開工前必跑：
> ```bash
> git log --oneline -5          # user 多 session 並行，先確認 HEAD
> grep -c CelebrityFeatures src/payload.config.ts   # 必須 ≥2，若 0 = 被 reset，先讀本文件第 7 節還原
> ```

## 0. 任務範圍（user 拍板 2026-06-11）

1. **B — LINE Messaging API**（行銷推播 + 訂單通知 + 客服 webhook）：從 stub 接到真
2. **C — LINE Login**：~~從頭做~~ → **已經上線**，只剩 3 件收尾（見第 2 節）
3. **Shopline 全功能轉移收尾**：內容頁遷移 P1/P2 + 301 redirect map + parity 殘項（見第 4、5 節）

---

## 1. ⚠️ Git/部署現狀（2026-06-11 已大整理，先懂這個再動）

- **GitHub 帳號停權中** → canonical git = **hetzner remote**（`ssh://root@5.223.85.14/srv/git/chickimmiu.git`）。絕不 push origin。
- **`hetzner/main` = 唯一 source of truth**（HEAD `03bfb28`）。2026-06-11 已把三條線全部合併進 main：
  - `867f86c` CKMU ON SHOW（celebrity-features + banner hero + 161 圖）
  - `feat/shopline-parity` 的 `b4dce22` email 模板系統（之前只在 branch，已併入）
  - `03bfb28` brand anthem（BGM toggle + blog 影音 hero）
  - **`feat/shopline-parity` branch 已過時，別再用它開工 — 一律從 main 開**
- **Prod**：`5.223.85.14:/var/www/chickimmiu`，HEAD = `03bfb28`（乾淨，無 dirty tracked files），SQLite `data/chickimmiu.db`，pm2 `chickimmiu-nextjs`，站台 `https://pre.chickimmiu.com`。
- **部署 SOP**：改動先 commit + push hetzner main → prod `git fetch hetzner-local main && git reset --hard hetzner-local/main` → `NODE_OPTIONS=--max-old-space-size=2048 pnpm build`（3.7GB RAM 必須加 heap）→ `pm2 restart chickimmiu-nextjs --update-env`。migration 要跑 `yes y | pnpm payload migrate`。
  - 另一條 scp 流程（`/root/deploy-ckmu-local.sh` + `/tmp/ckmu-staging`）仍可用，但**有 stash 陷阱**：每次部署必須把所有「已改過但未進 main」的 tracked file 全部重新 scp，否則 stash 步驟會把它們還原成 HEAD。**現在 main 已收齊所有工作，建議改走 git 流程，少踩這個雷。**
- **GitHub Actions 停權 → prod crontab fallback 11 條 `[ckmu-outage-cron]`** 在跑。GitHub 恢復後刪：`crontab -l | grep -v '\[ckmu-outage-cron\]' | crontab -`。

## 2. C — LINE Login：已上線，只剩收尾（先做，半天內）

**現狀（已實測）**：`/login` 有「LINE 登入」按鈕、`/api/auth/providers` 回 LINE OIDC provider、callback `https://pre.chickimmiu.com/api/auth/callback/line`。prod `.env` 已有 `AUTH_LINE_CHANNEL_ID=2009827245`（**pre 專屬 channel，不是 Shopline 那個**）+ `AUTH_LINE_CHANNEL_SECRET`。完整接線：`src/auth.ts`（env-gated provider + `checks:['pkce','state','nonce']` + signIn callback upsert Payload Users `socialLogins.lineId`）+ `api/auth/bridge`（NextAuth→payload-token 雙 session 橋接）。Runbook：`docs/LINE_LOGIN_SETUP.md`。

**剩 3 件**：
1. **端到端實測一次**：瀏覽器走完 LINE 授權 → 回站 → `/account` 能進 → admin Users 看 `socialLogins.lineId` 有值。若 LINE 認證頁報 callback 錯誤 = LINE Developers Console（channel 2009827245）callback 白名單漏了 `https://pre.chickimmiu.com/api/auth/callback/line`，請 user 登入 console 補。
2. **`socialLogin.enableLine` 開關是死的**：GlobalSettings 有開關但 login/register 頁 4 顆社群按鈕全 hardcode。要接：`login/page.tsx` + `register/page.tsx`（client）需從 server wrapper 傳設定進去。順便處理：**Google/Facebook/Apple 憑證 prod 是空的，那 3 顆按鈕點了會失敗** — 建議接開關後把沒憑證的 provider 預設關掉。
3. **無 email 的 LINE 帳號登入會失敗**（`src/auth.ts` `if (!user.email) return false`）。台灣 LINE 用戶很多沒設 email。可選工程（量不小）：lineId-first 匹配 + 允許無 email 帳號 + 身份合併 UI。先跟 user 確認要不要做。

## 3. B — LINE Messaging API：真正的建設工作（1-2 天）

### 3.1 憑證（第一步，卡 user）
- **Messaging API channel 與 Login channel 是兩個不同 channel**。Shopline 現用 Messaging API channel = `1661280982`（secret + access token 都看得到：Shopline 後台 → https://admin.shoplineapp.com/admin/chickimmiu/channels/line/2868/view）。
- **關鍵決策（要 user 拍板）**：
  - **選項 1 — 沿用 Shopline 的 channel**：token/secret 直接抄。但 webhook URL 是單一值，現在指向 Shopline（`front-admin.shoplineapp.com/line/webhook/...`）。切到 pre = **Shopline 的 LINE 功能立即失效**。適合「準備棄用 Shopline」的時點。
  - **選項 2 — 同一個 LINE OA 下開新 Messaging API channel**：webhook 指 pre，Shopline 照舊。過渡期推薦。
  - 不論哪個：token/secret **寫 prod `.env`**（`LINE_CHANNEL_ACCESS_TOKEN` + `LINE_CHANNEL_SECRET`），不要 commit 進 git。
- ⚠️ `lineId`（Login OIDC sub）與 `lineUid`（Messaging API userId）**只有同一 LINE provider 下才相同**，綁定流程不能假設互通，要實測。

### 3.2 已有的基礎（全部可重用，調查驗證過）
| 資產 | 路徑 | 備註 |
|---|---|---|
| CS collections schema 全 LINE-ready | `src/collections/{Conversations,Messages,MessageTags,ConversationActivities}.ts` | `channel='line'`、`externalThreadId`（source.userId）、`externalId`（messageId dedup）、`replyToExternalId`（reply token）、`actorType='webhook'` 全預留好；Messages afterChange 自動同步 thread 狀態 |
| channelDispatcher LINE 路由 | `src/lib/marketing/channelDispatcher.ts` | `sendLineMessage` 是 TODO stub；`batchSend` 50/批+1s 延遲、`isQuietHours` 都現成 |
| automationEngine `send_line` | `src/lib/crm/automationEngine.ts:~420` | console stub；照隔壁 `send_email` 的 dynamic import 改 3 行 |
| `Users.lineUid` | `src/collections/Users.ts` | 推播對象欄位已存在 |
| token 存放欄位 | `src/globals/CRMSettings.ts` `notificationChannels.lineChannelAccessToken` | **缺 `lineChannelSecret` 欄位（驗章必需，要補 + migration）** |
| 客服設定 | `src/globals/CustomerServiceSettings.ts`（slug `cs-settings`） | `greeting.line`（follow 歡迎詞）、`offHourAutoReply`、SLA per-channel 含 line — 全現成 |
| HMAC 驗證 helper 範本 | `src/lib/cron/auth.ts` | `timingSafeEqual` 寫法直接挪去做 `x-line-signature` HMAC-SHA256 |
| 訂單通知 pattern | `src/lib/email/orderShipped.ts` + `src/collections/Orders.ts` afterChange（~L1097/1115）fire-and-forget | LINE 推播照抄這個 pattern 掛同一個 hook |

### 3.3 🐛 必修 bug（接 LINE 時一起修）
`channelDispatcher.ts` 的 `loadCRMSettings()` 讀 **flat** `settings.lineChannelAccessToken`，但 CRMSettings 該欄位 **nested 在 `notificationChannels` group** → token 永遠 undefined。

### 3.4 要新增的檔案（比照 pattern）
| 新檔 | 內容 |
|---|---|
| `src/app/(frontend)/api/webhooks/line/route.ts` | repo 第一個外部 inbound webhook。POST + `runtime='nodejs'` + `force-dynamic`；**先讀 raw text 驗 `x-line-signature`（HMAC-SHA256 base64）再 JSON.parse**；event 處理：message → `externalId` dedup → upsert Conversation（`externalThreadId`+`channel='line'`）→ create Message(in)；follow → 回 `cs-settings.greeting.line`；**<1 秒回 200**（fire-and-forget 處理）；reply token 約 1 分鐘單次，逾期 fallback push |
| `src/lib/line/client.ts` | raw fetch 包 `https://api.line.me/v2/bot/*`（pushMessage/replyMessage/getProfile）；repo 慣例不裝 `@line/bot-sdk`；token 讀 env → DB fallback（比照 Meta CAPI multi-source）；缺 token = console no-op 不 throw |
| `src/lib/line/verifySignature.ts` | crypto.createHmac + timingSafeEqual |
| `src/lib/line/orderNotifications.ts` | `sendOrderShippedLine(payload, order)` 等，Flex Message；**不 import @payload-config**（防模組循環，payload 由 caller 傳 — renderFromTemplate 同規矩）；掛 Orders afterChange email 旁邊 |
| `src/migrations/2026xxxx_add_line_channel_secret.ts` | CRMSettings 補 secret 欄（PRAGMA 冪等） |

### 3.5 既有檔案改動
- `channelDispatcher.ts`：`sendLineMessage` 接真 + 修 3.3 bug + 行銷推播尊重退訂（比照 email `emailSubscribed`；Users 需確認 LINE 訂閱欄位存不存在，沒有就補）
- `automationEngine.ts`：`send_line` 改 dynamic import `sendMessage(userId,'line',…)`
- `Orders.ts`：afterChange 加 LINE 推播 fire-and-forget（confirmation/shipped）
- 後台 inbox UI（客服中心 1B-1G）**完全沒做** — webhook 收進來的訊息只能在 admin collection list 看。人工回覆介面是獨立大工程，先跟 user 確認排程。

## 4. Shopline 內容頁遷移（盤點完成，直接做）

pre 站 Pages collection 目前只有 2 頁（`ckmu-on-show` 🔒PROTECTED 勿動、`fashion-issue-moha9mlu`）。135 個 categories 已全量匯入。原生 route 已覆蓋大部分內容頁（/about /faq /packaging /membership-benefits /shopping-guide /blog /terms /privacy-policy /return-policy）。

**真正要做的**：
| 優先 | 項目 | 做法 |
|---|---|---|
| P1 | `offline-shop-1` 預約體驗（showroom：02-2718-9488 / LINE @ckmu / 台北市基隆路一段68號9樓 / 09:30-18:00） | Pages collection：magazine-cover banner + rich-text + cta，半天內 |
| P1 | `tagckmu` 穿搭分享領購物金（活動規則頁） | Pages collection：cta + faq + rich-text |
| P2 | `ckmustyle` 會員穿搭區（UGC 圖牆 + LINE 投稿 CTA） | 獨立 route（如 `/style`）接 UGCPosts collection（wiring 基礎在 commit `c22ab88`） |
| P2 | `member-recommendation` 推薦獎賞公開說明頁 | Pages collection 或 nav 直連 `/account/referrals` |
| P3 | **301 redirect map**：~35 個 Shopline `/pages/<分類導購>` → `/category/<slug>`（如 `instockckmu`→`rush-delivery`、`wedding-formal-dress`→`formal-dresses`、`kimlafayettelive2-1`→`jin-live`） | next.config redirects 或 middleware；**正式換 domain 前必做**（SEO） |
| 不遷 | `ckmu-young`（0 商品空頁）、`kimlive260305`（過期檔期）、`aboutus`/`faqs` 等已被原生 route 覆蓋者 | — |

## 5. Parity 殘項總表（來源 `docs/SHOPLINE_PARITY_ROADMAP.md` + `docs/HANDOFF_SHOPLINE_PARITY_2026-06-09.md`）

**「無外部依賴」清單已全部清空。**剩：

### ⛔ 卡外部憑證（程式已 env-gated，缺值 no-op）— 都是 user 行動項
1. **ECPay 線上金流（P0 最嚴重）**：缺 MerchantID/HashKey/HashIV（測試憑證即可開工）。**沒接 = checkout 不收錢**。閉環設計：`docs/HANDOFF_SHOPLINE_PARITY_2026-06-08.md` 第 7 節
2. ECPay 電子發票：引擎在 `ecpayInvoiceEngine.ts`，缺發票憑證 + 依賴金流先通
3. ECPay 物流（超商取貨電子地圖）：缺物流憑證
4. **LINE 推播 token：→ 本次任務 B 解掉**
5. SMS（三竹/Twilio 帳密）：`send_sms` stub + 手機 OTP
6. Google Ads dev token：審核中

### 🏗️ 待 user 拍板（別 auto-pilot）
7. AI 客服真 LLM（Groq）+ web chat widget — 要先審 guardrails
8. i18n 前台套用（字典已有、前台 hardcoded 中文）
9. POS 門市（等實體店決策）
10. 直播購物（FB/IG 留言成單，等決策）

### ⚠️ 小事
11. GitHub 恢復後刪 crontab fallback + 確認 `CRON_SECRET`
12. Podcast 封面 ≥1400×1400（Apple 退件風險）
13. coupon `excludeSaleItems` 欄位
14. 社交遊戲零碎（file picker / 刮刮樂機率 / StylePK 配對）— 文件未確認完成，開工前 `git log` 驗證
15. A/B `trackABTestEvent`（sent/open/click）— 同上
16. 推薦獎勵防濫用（IP/裝置）— 同上

## 6. 本次（2026-06-11）session 完成的事（背景知識）

- LINE 客服按鈕修好：`global_settings.customer_service_line_oa_url='https://lin.ee/AYWzgKW'`（之前 NULL，按鈕點了沒反應）。**Messenger 還是壞的**（`meta_page_id` NULL → `m.me/null`），要嘛填 Page ID 要嘛關掉 `enable_messenger`。
- 品牌主題曲全套上線：BGM 左下浮動按鈕（`bgmStore` + `BrandAnthemPlayer`，預設關、checkout 不顯示、video 播放時自動暫停）+ `/blog` 釘選 hero card + `/blog/confidence-is-the-silhouette`（影片 lightbox + 音檔 player + lyrics 欄位）。**歌詞還空著** — user 要自己貼到 `/admin/collections/blog-posts/8` 的「歌詞」欄。
- Media id：16146 (mp4) / 16147 (mp3) / 16148 (poster)。
- 三線合併進 main（見第 1 節）— 之前 main/feat-parity/我的 branch 三方分岔已收斂。

## 7. 🔒 PROTECTED — `/pages/ckmu-on-show` 復原 runbook

User 明令這頁不可動（被 git reset 誤殺過 2 次）。正確版本特徵：magazine-cover.layout=`banner`、stats 白卡（18/161/12/8）、celebrity-grid 18 卡（前 2 featured + 編號徽章 + 整輯數金徽章）。守護檢查：`grep -c CelebrityFeatures src/payload.config.ts` ≥ 2。如果是 0：`git fetch hetzner-local main && git reset --hard hetzner-local/main && pnpm build && pm2 restart chickimmiu-nextjs`（main 已含全部，不再需要 scp 還原）。

## 8. 驗證 checklist（每次部署後跑）

```bash
for p in / /products /cart /login /blog /blog/confidence-is-the-silhouette /pages/ckmu-on-show /celebrity/02; do
  echo "$p $(curl -s -o /dev/null -w '%{http_code}' https://pre.chickimmiu.com$p)"; done
curl -s -o /dev/null -w "%{http_code}\n" https://pre.chickimmiu.com/admin/tools/email-templates  # 200
curl -s https://pre.chickimmiu.com/api/auth/providers | grep -c line                            # 1
```
