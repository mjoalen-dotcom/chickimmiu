# 29 — Meta Ads 憑證盤點 + PR-C (Pixel + CAPI 雙線去重)

**Date:** 2026-05-04
**Stacked on:** [PR-A #150 商品目錄 feed](https://github.com/mjoalen-dotcom/chickimmiu/pull/150) (open)
**Sibling:** [PR-B #151 UTM 商品歸因](https://github.com/mjoalen-dotcom/chickimmiu/pull/151) (open, orthogonal)
**Branch:** `feat/meta-pixel-capi-dedup`

---

## 0. PR-C 範圍對焦 — 比預期窄

PR-A commit message 寫的「PR-C = Pixel + CAPI 雙線 + CSP 補 connect.facebook.net」實際盤點後：

| Item                                  | 狀態                                  |
| ------------------------------------- | ------------------------------------- |
| CSP `connect.facebook.net` allowlist  | ✅ 早就有（`next.config.mjs`）         |
| Pixel base script 注入                | ✅ 早就有（`GTMScript.tsx`）           |
| Client-side 5 個標準事件 (`fbq`)      | ✅ 早就有（`src/lib/tracking.ts`）     |
| CAPI helper skeleton                  | ✅ 早就有（`sendMetaCAPI`）            |
| **CAPI 真的有 fire**                  | ❌ `sendServerPurchaseEvent` 是 dead code |
| **Pixel + CAPI 用同 eventID 去重**     | ❌ 沒做                                |
| **PII 真的有 SHA-256 hash**           | ❌ 註解寫「正式環境應先 hash」但沒做   |
| **CAPI 帶 fbp/fbc/IP/UA**             | ❌ 沒讀                                |
| **CAPI token multi-source (env + DB)** | ❌ 只讀 env                            |
| **`test_event_code` 接 prod 驗證**     | ❌ 沒接                                |

PR-C 把後 6 個缺口補完。**5 檔變動，0 schema 改動，0 migration**。

---

## 1. 變動摘要

```
src/lib/tracking.ts                    +60L  fbqTrack 收 eventID / purchaseEventId 衍生
                                              / getFbp / getFbc helpers / CAPIEventData
                                              加 event_id+fbp+fbc / sendMetaCAPI 收
                                              testEventCode
src/app/actions/tracking.ts            重寫   resolveCAPIConfig (env→DB fallback)
                                              / sha256Lower / normalizePhone /
                                              readClientHints 從 next/headers /
                                              sendServerPurchaseEvent 收 eventID
                                              + userPhone + 真正 hash + fbp/fbc/IP/UA
src/app/(frontend)/checkout/page.tsx   +20L  生 eventID = `purchase_<orderNumber>` /
                                              trackPurchase 帶 eventID / fire-and-forget
                                              呼叫 sendServerPurchaseEvent / 失敗不擋
                                              checkout 導頁
docs/session-prompts/29-meta-ads-credentials-handoff.md  NEW (本檔)
```

---

## 2. 雙線去重原理

Meta CAPI 文件：(event_name, event_id) 作為 dedup key。客戶端 Pixel 與伺服器 CAPI **同一個 event_id** 會被視為同一個 conversion，計算一次。

**eventID 用訂單編號衍生**（`purchase_<orderNumber>`）的好處：

- 同訂單客戶端意外重觸（雙擊「完成下單」、SPA 路由 race）也只算一次
- 伺服器端 `sendServerPurchaseEvent` 不用 race 客戶端，自己組 eventID 也對得到
- 訂單號是 source of truth，debug 時直接從 Meta Events Manager 對 order

**PII match key（match rate 由高到低）**：

1. `em` — SHA-256(lowercase(trim(email)))
2. `ph` — SHA-256(digits-only(phone)) — 我們 strip 空白/連字號/括號，保留 `+`
3. `fbp` — `_fbp` cookie（Pixel 寫入，per-browser）
4. `fbc` — `_fbc` cookie 或 URL `fbclid` 衍生
5. `client_ip_address` + `client_user_agent` — 從 `X-Forwarded-For` / `User-Agent` header

---

## 3. CAPI 啟用 — 需手動補 token

PR-C 結構上把 CAPI 全部寫好了，但 **缺 token = no-op**（不丟錯、不擋 checkout）。要實際 fire 到 Meta，二擇一：

### Path A — env 控管（推薦）

```bash
# /var/www/chickimmiu/.env
META_CAPI_ACCESS_TOKEN=EAAxx...        # 真的能呼叫 Conversions API 的 token
META_CAPI_TEST_EVENT_CODE=TEST123      # 選填，prod 灰度時 routed 到 Meta 測試介面
```

設完 `pm2 restart chickimmiu-nextjs` 即生效。**Test Event Code 設了會把 prod 真實事件 routed 到測試介面**（不影響真 conversion）— 灰度驗證 dedup 行為對才能拿掉這個 env，正式上 prod。

### Path B — 後台填欄位（fallback）

`/admin/globals/global-settings` → 廣告追蹤碼 → Meta CAPI Token。
資料庫已有欄位（pre-existing），PR-C 把 server action 改成 env 沒值就讀這裡。

env 永遠優先於 DB；DB token 只有 env 空時才生效。

### CAPI Token 為何 blocked

Memory 記錄：BM `2137781379827397` 你帳號是 Employee 角色 + Shopline gateway 用著現有 token。需要：

- 升 BM Admin（找 BM owner 改你角色），或
- 用 System User `61574030394578` 自己 mint 新 token（System User 跟 Employee 角色獨立）— 但仍需 admin 操作把 Pixel asset 配到 System User 上，可能還是擋住

PR-D/E/F 的 catalog batch push 也吃同一個 token，會一次解。

---

## 4. GMC ID 已抓 — 需手動填後台

**Merchant Center Account ID = `122621691`**（CHIC KIM & MIU；2026-05-04 chrome-mcp-bridge 確認）

**這個 PR 不寫進 migration**（admin 設定不該綁 schema）— 請手動：

1. 開 `/admin/globals/ads-catalog-settings`
2. 「Google（Merchant Center / Ads）」section
3. `Merchant Center Account ID` 填 `122621691`
4. 儲存

GMC 帳號也已連 chickimmiu.com 並上架商品（首頁顯示「皇家扣式耳環」、「[現貨] 夾耳十字架耳環」等正在 Google Shopping 顯示）。Merchant Center → 動態消息 → 排定爬取，貼 PR-A 的 `https://chickimmiu.com/feeds/google.xml` 即可。

---

## 5. 已抓 Meta IDs（FYI）

| Asset             | ID                       | 落點 |
| ----------------- | ------------------------ | ---- |
| Business Manager  | `2137781379827397`       | `AdsCatalogSettings.meta.businessManagerId` |
| Ad Account        | `act_441158936893428`    | `AdsCatalogSettings.meta.adAccountId` |
| Pixel             | `210263407374946`        | `GlobalSettings.tracking.metaPixelId`（已是 canonical 來源） |
| Commerce Catalog  | `783798852869998`        | `AdsCatalogSettings.meta.catalogId` |
| System User       | `61574030394578`         | （未來 PR-F catalog batch push 用） |
| GMC               | **`122621691`**          | `AdsCatalogSettings.google.merchantCenterId`（待填） |
| CAPI Token        | **blocked**              | `META_CAPI_ACCESS_TOKEN` env 或 `GlobalSettings.tracking.metaCapiToken` DB |

---

## 6. 部署步驟（**不**要動 migrate）

PR-C 純程式碼，無 migration。merge 後：

```bash
ssh root@5.223.85.14 'cd /var/www/chickimmiu && \
  git pull && \
  pnpm install --frozen-lockfile && \
  pnpm build && \
  pm2 restart chickimmiu-nextjs'
```

**不要跑 `pnpm payload migrate`** — 這個 PR 沒新增 collection 也沒改 field，跑了會讓 prod 進 dirty schema 確認流程。

---

## 7. 上線後驗證

### 7.1 Pixel + CAPI dedup 對齊驗證（test_event_code 灰度）

1. prod env 補 `META_CAPI_ACCESS_TOKEN` + `META_CAPI_TEST_EVENT_CODE=<從 Events Manager 取>`
2. `pm2 restart chickimmiu-nextjs`
3. 真實下一張單（小額即可）
4. Meta Events Manager → Pixel `210263407374946` → 測試事件
5. 預期看到 **同一個 Purchase 事件**，瀏覽器 + Server 兩個 source 都列出，**Deduplicated** 標籤
6. 對成功 → 拿掉 `META_CAPI_TEST_EVENT_CODE` env → restart → 走真實流量

### 7.2 PII match rate 驗證

Meta Events Manager → 你的 Pixel → 事件詳細 → 客戶資訊參數品質：

- `em` (email) → 應顯示 ★★★ 或 ★★ 含「已雜湊」
- `ph` (phone) → 同上
- `fbp` → 依瀏覽器是否阻擋第三方 cookie 而異
- `client_ip_address` + `client_user_agent` → 必到

**沒看到 hashed em/ph** = `sha256Lower` 沒跑到（不太可能但要驗）。
**fbp 一直 blank** = `_fbp` cookie 被 `connect.facebook.net` 寫入失敗，回頭看 CSP 是否有擋掉 script-src 或 connect-src（PR-C 沒動 CSP，但要排除其他 PR 改壞）。

### 7.3 不擋 checkout 驗證（最關鍵）

故意把 `META_CAPI_ACCESS_TOKEN` 設成壞值（`xxx_invalid`），下一張單。

預期：
- ✅ 訂單成功成立（`/checkout/success/<id>` 200）
- ✅ 客戶端 fbq Purchase 仍 fire（dev tool Network → POST 到 `facebook.com/tr`）
- ✅ Server log 印 `[CAPI] Error: ...` 但**不** throw
- ✅ Checkout 導頁正常

CAPI 失敗永遠不該擋 user 結帳。`sendServerPurchaseEvent` 用 `.catch()` fire-and-forget。

---

## 8. PR-C 後續

完整 Meta ads 計劃還有：

- **PR-D** = Catalog batch push（即時把 product 變動推給 Meta，不等 feed scrape）— 需 catalog token + System User 擺平
- **PR-E** = 動態廣告 (DPA) custom audience + retargeting 設定
- **PR-F** = Google Ads conversion API（伺服器端 + UTM 對齊）

這幾個都吃 CAPI Token / System User 解封，所以實際進度看 BM admin 升等狀況。

---

## 9. 對 MEMORY 的修正

**錯**：MEMORY.md 說 "PR-A/B shipped"
**對**：[#150](https://github.com/mjoalen-dotcom/chickimmiu/pull/150) + [#151](https://github.com/mjoalen-dotcom/chickimmiu/pull/151) **OPEN，未 merge**（2026-05-04）

**錯**：MEMORY 說 "GMC 還沒抓（chrome-mcp-bridge profile Google 沒登）"
**對**：profile 早登好了，URL `?a=122621691` 就是 ID，2026-05-04 已抓
