# LB-11 — www.chickimmiu.com 域名切換 Runbook

- **撰寫日期**：2026-07-28（基於當日 DNS / prod 實測）
- **目標**：`www.chickimmiu.com` 從 Shopline 切到 Hetzner 新站；順手修復 apex `chickimmiu.com`（目前死 IP）。
- **原則**：切換前所有前置全綠、Shopline 保留至少 7 天當回滾網，低流量時段執行。

---

## 0. 現況盤點（2026-07-28 實測）

| 項目 | 現值 |
|---|---|
| DNS 託管 | **GoDaddy**（ns05/ns06.domaincontrol.com） |
| `www` | CNAME → `www.chickimmiu.com.cname.shoplineapp.com` → CloudFront（Shopline 現役商店） |
| apex `chickimmiu.com` | A → `192.119.67.130`，**HTTP/HTTPS 完全無回應（死路）** |
| `pre` | A → `5.223.85.14`（Hetzner），nginx + certbot 正常 |
| prod nginx | 只有 `pre.chickimmiu.com` server block（`/etc/nginx/sites-enabled/`；同機另有 `hr.ckmu.co` 勿動） |
| prod env | `NEXT_PUBLIC_SITE_URL=https://pre.chickimmiu.com`、`AUTH_URL=https://pre.chickimmiu.com` |
| robots | host-based：host 以 `pre.`/`staging.` 開頭 → 全站 Disallow；SITE_URL 改成 www 後**自動恢復索引**（`src/app/robots.ts`） |
| ECPay callback | `create/route.ts:81` 用 `NEXT_PUBLIC_SITE_URL` 組 ReturnURL/OrderResultURL → 切換後自動跟著走 |

⚠️ **`NEXT_PUBLIC_*` 與 robots/sitemap 是 build-time 烘進去的** — 改 env 必須跑完整 deploy（rebuild），只 `pm2 restart` 無效。deploy 腳本 `/root/deploy-ckmu.sh` 本來就會 rebuild，照常跑即可。

---

## 1. 前置（T-1 天以前，全部可逆）

1. **TTL 降檔**：GoDaddy DNS 把 `www` 與 apex 記錄 TTL 改 600 秒（半小時內生效，回滾也快）。
2. **LINE Login callback**：LINE Developers Console → channel `2009827245` → Callback URL **加一行** `https://www.chickimmiu.com/api/auth/callback/line`（保留 pre 那行）。
3. **nginx 預埋 server block**（先只開 80，SSL 等憑證到手）：
   ```
   server {
     listen 80;
     server_name www.chickimmiu.com chickimmiu.com;
     # 內容抄 pre.chickimmiu.com 的 proxy_pass 設定
   }
   ```
   `nginx -t && systemctl reload nginx`。DNS 未切前此 block 不會收到流量，零風險。
4. **憑證預先簽發（推薦，零憑證空窗）**：
   ```
   certbot certonly --manual --preferred-challenges dns -d www.chickimmiu.com -d chickimmiu.com
   ```
   certbot 會給兩筆 `_acme-challenge` TXT 值 → 到 GoDaddy 加 TXT 記錄 → 驗證通過拿到憑證 → 填進 nginx 443 block。
   （偷懶替代案：跳過此步，切 DNS 後直接 `certbot --nginx`，代價是傳播完成前 https 有幾分鐘憑證錯誤空窗。）
5. **庫存最後同步（LB-04，若拍板現貨模式）**：Shopline 後台匯出最新庫存 → 跑 stock 同步腳本。切換前一晚做，切換後 Shopline 停收單，漂移歸零。
6. **綠界正式收單先切好**（與域名無關，先做先驗）：綠界廠商後台 → 系統開發管理 → 系統介接設定，抄 MerchantID/HashKey/HashIV → prod `.env` 的 `ECPAY_MERCHANT_ID/ECPAY_HASH_KEY/ECPAY_HASH_IV` + `ECPAY_ENV=production` → `pm2 restart chickimmiu-nextjs --update-env` → 在 pre 域名下真卡小額實測一筆再退款。

## 2. 切換日（建議平日早上 06:00–08:00 低流量時段）

依序執行，每步驗證再走下一步：

1. **Shopline 停收單**（後台關閉結帳/商店維護模式）。訂閱**不要退**，回滾要用。
2. **prod env 改域名**：
   ```
   NEXT_PUBLIC_SITE_URL=https://www.chickimmiu.com
   AUTH_URL=https://www.chickimmiu.com
   ```
3. **跑 deploy**（rebuild + migrate + restart + health check）：`/root/deploy-ckmu.sh`。
   此刻 pre 域名照常服務，只是 canonical/OG/sitemap/robots 已指 www——幾分鐘的過渡可接受。
4. **GoDaddy DNS 切換**：
   - `www`：**刪掉 CNAME**（指 shoplineapp 那筆），新增 **A → 5.223.85.14**。
   - apex `chickimmiu.com`：A 記錄 `192.119.67.130` → **5.223.85.14**。
5. **憑證**：若第 1.4 步已預簽 → nginx 443 block 上線 reload 即可；若沒預簽 → `dig www.chickimmiu.com` 看到 5.223.85.14 後立刻 `certbot --nginx -d www.chickimmiu.com -d chickimmiu.com`。
   - 若走了預簽（manual DNS-01），切換完成後**再跑一次** `certbot --nginx -d www.chickimmiu.com -d chickimmiu.com` 換成可自動續期的 HTTP-01 lineage，否則 90 天後要手動續。
6. **nginx 收尾**：
   - apex → `return 301 https://www.chickimmiu.com$request_uri;`
   - `pre.chickimmiu.com` block → `return 301 https://www.chickimmiu.com$request_uri;`（**必做**：SITE_URL 改 www 後 robots 全站 allow，pre 若繼續出內容會變重複內容+可被索引）。

## 3. 切換後驗證（30 分鐘內）

- [ ] `curl -I https://www.chickimmiu.com` → 200、憑證有效
- [ ] `curl https://www.chickimmiu.com/robots.txt` → allow 規則 + sitemap 指 www
- [ ] `https://chickimmiu.com` 與 `https://pre.chickimmiu.com` → 301 到 www
- [ ] www 上跑一筆現金單 + 一筆綠界正式小額刷卡（成功頁/確認信/後台 paid）
- [ ] LINE 登入在 www 上成功（callback 驗證）
- [ ] `pm2 logs chickimmiu-nextjs --err` 乾淨；全站 smoke（首頁/products/PDP/cart/account）

## 4. 收尾（T+1 ～ T+7）

- Google Search Console：新增 `www.chickimmiu.com`（或 Domain property）→ 提交 sitemap；觀察索引恢復與 soft-404 報告（工單 §2.5 已知限制）。
- Meta：Pixel/網域驗證/catalog feed URL 改 www（feed URL 由 SITE_URL 生成，rebuild 後自動正確，但 Meta 後台登記的舊網址要更新）。
- LINE OA / 名片 / 社群連結逐步改 www。
- **T+7 天穩定後**才考慮終止 Shopline 訂閱；終止前把 Shopline 歷史訂單/顧客資料完整匯出封存。

## 5. 回滾（任一驗證失敗且 15 分鐘內修不好）

1. GoDaddy：`www` 刪 A 記錄 → 復原 CNAME `www.chickimmiu.com.cname.shoplineapp.com`（TTL 600 → 約 10 分鐘生效）。
2. Shopline 後台解除維護模式恢復收單。
3. prod `.env` 改回 `pre.` 兩值 → 重跑 deploy；nginx pre block 的 301 撤掉。
4. 新站繼續在 pre 服務，擇日再戰。
