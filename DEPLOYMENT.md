# CHIC KIM & MIU — 部署指南

> **最後更新**：2026-04-16（Phase 5.4 P3）
> **現行部署形態**：本機 Windows 11 + Next.js dev server（port 3001）+ Cloudflare Tunnel → `testshop.ckmu.co`
> **資料庫**：SQLite 本機檔 `data/chickimmiu.db`（~36 MB）
> ⚠️ **原 Vercel + PostgreSQL 策略已棄用**。歷史 commits `55d8aa0` / `71cd250` / `421a405` / `4a99a25` 是 Vercel 時期遺留，相關細節見 `HANDOFF_PHASE5.4.md` P2 section。

## 目錄
1. [架構實景](#架構實景)
2. [環境變數](#環境變數)
3. [本機開發](#本機開發)
4. [Cloudflare Tunnel 運維](#cloudflare-tunnel-運維)
5. [追蹤事件驗證](#追蹤事件驗證)
6. [測試 Checklist](#測試-checklist)
7. [疑難排解](#疑難排解)

---

## 架構實景

```
瀏覽器
  ↓ https://testshop.ckmu.co
Cloudflare 邊緣（DNS + TLS 終結 + Tunnel ingress）
  ↓ tunnel UUID 49879c4b-691b-4698-b48b-f6a990055494
cloudflared daemon（本機 Windows）
  ↓ http://127.0.0.1:3001
Next.js dev server（pnpm dev -p 3001；Payload CMS 同進程）
  ↓
SQLite 檔：data/chickimmiu.db（~36 MB）
```

### 關鍵檔案與位置

| 項目 | 路徑 |
|---|---|
| Tunnel 設定 | `C:\Users\mjoal\.cloudflared\config.yml` |
| Tunnel 憑證 | `C:\Users\mjoal\.cloudflared\49879c4b-691b-4698-b48b-f6a990055494.json` |
| Tunnel CLI | `C:\Program Files (x86)\cloudflared\cloudflared.exe` |
| DB 本尊 | `data/chickimmiu.db` |
| DB 備份 | `data/chickimmiu.db.bak`（~2.8 MB，舊）/ `data/chickimmiu.db.pre-phase1-bak`（~36 MB） |
| Preview launch 設定 | `.claude/launch.json`（`runtimeArgs: ["dev", "-p", "3001"]`，**不可改成 `start`**） |
| Payload DB adapter | `src/payload.config.ts` → `sqliteAdapter` |

### `config.yml` 現行 ingress

```yaml
tunnel: 49879c4b-691b-4698-b48b-f6a990055494
credentials-file: C:\Users\mjoal\.cloudflared\49879c4b-691b-4698-b48b-f6a990055494.json
ingress:
  - hostname: ally.ckmu.co        # 其他專案，port 8610
    service: http://127.0.0.1:8610
  - hostname: group.ckmu.co       # 其他專案，port 8610
    service: http://127.0.0.1:8610
  - hostname: testshop.ckmu.co    # ← 本專案
    service: http://127.0.0.1:3001
  - hostname: stocks.ckmu.co      # 其他專案，port 8601
    service: http://127.0.0.1:8601
  - service: http_status:404      # fallback
```

---

## 環境變數

`.env` 目前**只需**以下 6 個 key。社群登入 / 金流 / 追蹤碼相關 key 目前**未設**（功能未啟用或走後台 Payload Global 設定）。

```bash
cp .env.example .env    # 首次才需要
```

| 變數 | 目前值形態 | 說明 |
|---|---|---|
| `PAYLOAD_SECRET` | 32+ 字元隨機字串 | Payload CMS 加密金鑰。`openssl rand -base64 32` 產生 |
| `DATABASE_URI` | `file:./data/chickimmiu.db` | SQLite 本機檔路徑 |
| `NEXT_PUBLIC_SITE_URL` | `https://testshop.ckmu.co` | 前台使用的公開網址 |
| `NEXT_PUBLIC_SITE_NAME` | `CHIC KIM & MIU` | 顯示名稱 |
| `AUTH_SECRET` | 32+ 字元隨機字串 | NextAuth v5 密鑰 |
| `AUTH_URL` | `https://testshop.ckmu.co` | NextAuth callback base URL |

> 💡 **為什麼不是 Turso / libsql cloud**：`.env` 沒有 `DATABASE_AUTH_TOKEN`，表示目前走 SQLite file 模式、直接讀本機檔。`package.json` 仍保留 `libsql` + `@libsql/client` deps（Vercel 時期引入），目前未啟用但不移除以備未來切換。

### 還未啟用的變數（有需求時再填）

`.env.example` 列了一堆社群登入、金流、廣告追蹤的 key。目前專案不需要這些：
- **社群登入**：NextAuth 已 wire，但 OAuth client 未申請 → 只能 email 登入
- **金流**：checkout 還在 demo / mock 階段
- **追蹤碼**：走後台 Payload Global「全站設定 → 廣告追蹤碼」動態注入，非 build-time

---

## 本機開發

### 日常啟動

```bash
# 首次 / 裝新 dep 後
pnpm install

# 啟動 dev server（Next.js + Payload CMS 同進程）
pnpm dev -p 3001     # port 3001 是約定好的，Tunnel 指向這個 port
```

### Claude Code 使用者

```
preview_start chickimmiu-next   # 走 .claude/launch.json，跑 pnpm dev -p 3001
```

### 維護指令

```bash
# 清除 .next cache 後重啟（HMR 累積異常時用）
pnpm devsafe                   # = rimraf .next && pnpm dev

# 型別檢查
pnpm tsc --noEmit

# 核心 lookup data seed（tiers / shipping / frontNameMale）
pnpm seed:core                 # 寫入
pnpm seed:core:dry             # 只印不寫

# Payload CLI
pnpm payload migrate           # 執行 pending migrations
pnpm payload migrate:status    # 看 migration 狀態
```

### ⚠️ 不用的指令

| 指令 | 原因 |
|---|---|
| `pnpm build` | Vercel 時期才需要。目前 dev-only，build 非必要（且因 `ignoreBuildErrors: true` 也不會抓到新 TS 錯誤） |
| `pnpm start` | 跑 production server，但目前 workflow 就是 `dev` → Tunnel。`next start` 不會自動 reload，HMR 不起作用 |

---

## Cloudflare Tunnel 運維

### 啟動 tunnel（手動）

```bash
# Windows PowerShell 或 Git Bash，視需要開新 terminal
cloudflared tunnel --config C:\Users\mjoal\.cloudflared\config.yml run
```

### 健檢

```bash
# 1) 本機 dev server 在不在？
netstat -ano | findstr :3001              # Windows
# 應看到 LISTENING

# 2) cloudflared daemon 在不在？
tasklist | findstr cloudflared            # Windows
# 應看到一個或多個 cloudflared.exe 進程

# 3) 對外是否通？
curl -I https://testshop.ckmu.co          # 應 200 或 307（redirect 到 /admin 或別處也 OK）
```

### 自動開機啟動（建議）

目前 `cloudflared` + `pnpm dev` 都是**手動啟動**，使用者登出 / 重開機後會斷。建議選一個方案讓它常駐：

| 方案 | 難度 | 備註 |
|---|---|---|
| Windows Task Scheduler | 低 | 開機時 trigger 兩個指令 |
| [NSSM](https://nssm.cc/) | 中 | 把 `cloudflared` + `pnpm dev` 包成 Windows Service |
| PM2 + pm2-windows-service | 中 | node 生態熟 |

⚠️ 本 repo **尚未實作**自動啟動。每次重開機後需手動拉起。

### 斷線復原

1. **「502 Bad Gateway」** → `pnpm dev -p 3001` 沒跑。重新啟動
2. **「Host error」** → cloudflared 沒跑 / 設定錯。檢查 `cloudflared tunnel list`、重跑 run 指令
3. **本機打得到 `http://localhost:3001` 但對外 502** → tunnel 的 `config.yml` service port 不是 3001。檢查

---

## 追蹤事件驗證

> 前台追蹤碼注入走 Payload Global「全站設定 → 廣告追蹤碼」，**後台設定優先於 `.env`**。

### 開發環境（Debug 模式）

所有追蹤事件在 dev 模式會自動 `console.log`：
```
[Tracking] page_view { page_path: "/products/autumn-dress" }
[Tracking] view_item { currency: "TWD", value: 1280, items: [...] }
[Tracking] add_to_cart { currency: "TWD", value: 1280, items: [...] }
```

### GTM Preview

1. 前往 [GTM](https://tagmanager.google.com/)
2. 點 **Preview**
3. 輸入 `https://testshop.ckmu.co`
4. 操作流程，Tag Assistant 驗證事件觸發

### Meta Pixel

- Chrome 裝 [Meta Pixel Helper](https://chrome.google.com/webstore/detail/meta-pixel-helper/)
- [Events Manager](https://business.facebook.com/events_manager2/) 檢查事件

### GA4

- GA4 → 設定 → **DebugView**
- 或 [GA Debugger](https://chrome.google.com/webstore/detail/google-analytics-debugger/) 擴充

### Google Ads 轉換

- Google Ads → 工具 → **轉換** 檢查狀態
- 完成測試訂單，確認轉換追蹤

---

## 測試 Checklist

### 🛍️ 購物流程
- [ ] 首頁正常載入，所有區塊顯示正確
- [ ] 商品列表 — 篩選、排序、分類切換
- [ ] 商品詳情 — 圖片輪播、顏色/尺寸選擇、庫存顯示
- [ ] 加入購物車 — CartDrawer 滑出、數量更新
- [ ] 購物車頁 — 修改數量、刪除商品、運費計算
- [ ] 結帳 — 地址填寫、付款方式選擇
- [ ] 結帳成功 — 訂單編號顯示、追蹤事件觸發

### 👤 會員系統
- [ ] 註冊（Email）
- [ ] 登入 / 登出
- [ ] 社群登入（Google / Facebook / LINE）— **目前 OAuth key 未配置**
- [ ] 帳戶設定 — 個人資料編輯（含性別欄位，Phase 5.5 新增）
- [ ] 訂單列表 — 展開明細
- [ ] 收藏清單 — 新增/移除
- [ ] 地址管理 — CRUD + 設定預設
- [ ] 點數/購物金 — 餘額與歷史（Phase 5.5 Batch B 接通真實資料）
- [ ] 會員等級 — 稱號 gender-aware（男性讀 `frontNameMale`）

### 🎮 遊戲互動
- [ ] 轉盤 — 旋轉動畫、獎品顯示
- [ ] 刮刮卡 — 刮除效果、自動揭曉
- [ ] 每日簽到 — 7 天連續、獎勵累積（Phase 5.3 修跳天累加 bug）

### 🤝 合作夥伴後台
- [ ] 推廣總覽 — 統計正確
- [ ] 推廣連結 — 複製功能
- [ ] 佣金明細 — 列表與匯出按鈕
- [ ] 申請提款 — 表單提交

### 📝 內容系統
- [ ] 部落格列表 — 分類篩選
- [ ] 部落格文章 — 相關文章推薦
- [ ] 動態頁面 — Section Builder 各區塊渲染
- [ ] 會員福利頁 — 六層等級卡片（Phase 5.5 Batch A 接通 MembershipTiers collection）

### 📊 追蹤事件
- [ ] PageView — 每頁載入觸發
- [ ] ViewContent — 商品頁觸發
- [ ] AddToCart — 加入購物車觸發
- [ ] BeginCheckout — 進入結帳頁觸發
- [ ] Purchase — 結帳成功觸發（含金額、商品明細）
- [ ] UTM 參數 — 正確解析並儲存
- [ ] Cookie Consent — 同意前不載入追蹤腳本

### 🔍 SEO
- [ ] 所有頁面有正確的 title 和 description
- [ ] 商品頁 — Product JSON-LD
- [ ] 部落格 — Article JSON-LD
- [ ] 麵包屑 — BreadcrumbList JSON-LD
- [ ] Open Graph / Twitter Card 正確
- [ ] sitemap.xml 可正常存取
- [ ] robots.txt 正確設定
- [ ] canonical URL 設定

### 📱 響應式 & 效能
- [ ] 所有頁面 Mobile / Tablet / Desktop 正常顯示
- [ ] 圖片使用 Next/Image 並有 lazy loading
- [ ] Framer Motion 動畫流暢
- [ ] Lighthouse Performance ≥ 90
- [ ] 無 Console 錯誤

### 🔐 後台 (Payload CMS)
- [ ] Admin 登入正常（`/admin`）
- [ ] 商品 CRUD
- [ ] 部落格文章 CRUD（Phase 5.1 Batch 3 revalidate hook 已接通，改後前台自動失效）
- [ ] 會員管理（含 `gender` 欄位）
- [ ] CSV/Excel 匯入匯出
- [ ] 全站設定 — 追蹤碼更新後前台生效
- [ ] Homepage Settings → 穿搭誌區塊改任何欄位都能儲存（Phase 5.4 P1 修復）
- [ ] RBAC — Partner 只能看自己的資料

### 🚀 部署自檢
- [ ] `pnpm dev -p 3001` 啟動無 error
- [ ] `curl http://localhost:3001/` → 200
- [ ] `curl -I https://testshop.ckmu.co` → 200
- [ ] `tsc --noEmit` — 允許既有 3 個錯（account/points、account/referrals、shoplineXlsxImport 屬 Phase 5.4/5.5 遺留）
- [ ] `data/chickimmiu.db` mtime 合理（seed 或後台改動後會更新）

---

## 疑難排解

### `.next` cache 污染 → webpack chunk Runtime TypeError
**症狀**：白屏、console `Cannot read properties of undefined (reading 'call')` @ `_next/static/chunks/webpack.js`
**原因**：HMR 多次 "performing full reload because your application had an unrecoverable error" 累積 `.next` chunk manifest 失步
**修法**：
```bash
# 停 dev server → 清 .next → 重啟
rimraf .next
pnpm dev -p 3001
```
或直接 `pnpm devsafe`。
Phase 5.4 P0 詳細記錄見 `HANDOFF_PHASE5.4.md`。

### Hydration mismatch（cart / wishlist 徽章閃爍）
**修法**：Phase 5.4 `cfe26ba` 已用 `skipHydration: true` + 手動 rehydrate 解決（`src/stores/cartStore.ts`、`src/stores/wishlistStore.ts`、`src/components/layout/Providers.tsx`）。
未來再新增 `persist(zustand)` store 一律照此模式，否則會 mismatch。

### Claude Desktop 內建 webview 顯示異常但 Chrome 正常
**原因**：Claude Desktop 用 Electron 41，有獨立 HTTP cache，即使 `next.config.mjs` 設 `Cache-Control: no-store` 也可能被繞過
**建議**：驗證時優先用標準 Chrome / Edge、Ctrl+Shift+R hard reload

### Homepage Settings 儲存時報「穿搭誌區塊 → 內容來源」invalid
已於 commit `4444b37` 修復（legacy `mode: 'latest'` 自動正規化為 `'auto'`）。
若後台 UI 仍顯示錯誤，按一次儲存 hook 會治癒 DB → 重整後正常。

### iPad/Safari 白屏（webpack chunk hash mismatch）
`next.config.mjs` 已對 HTML pages 設 `Cache-Control: no-store`（commit `98bdcfd`）。若仍發生，確認：
1. HTML 的 response headers 真的有 `no-store`
2. `_next/static/*` 仍維持 immutable cache（這段正常）

### 相關文件

- `HANDOFF_PHASE5.4.md` — Phase 5.4 偵察紀錄、P0~P4 狀態
- `PHASE4_HANDOFF.md` — Phase 4 + 5.1~5.5 完整 phase 記錄
- `SITE_MAP.md` — 全站結構、access 規則、hooks 機制
- `C:\Users\mjoal\.claude\projects\C--Users-mjoal-ally-site-chickimmiu\memory\MEMORY.md` — 跨對話記憶
