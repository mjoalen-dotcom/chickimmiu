# CHIC KIM & MIU — 部署指南

## 目錄
1. [環境變數設定](#環境變數設定)
2. [本機開發](#本機開發)
3. [Vercel 部署](#vercel-部署)
4. [追蹤事件驗證](#追蹤事件驗證)
5. [測試 Checklist](#測試-checklist)

---

## 環境變數設定

複製 `.env.example` 為 `.env`，填入所有必要值：

```bash
cp .env.example .env
```

### 必要變數

| 變數 | 說明 | 範例 |
|------|------|------|
| `PAYLOAD_SECRET` | Payload CMS 加密金鑰（≥32 字元） | `openssl rand -base64 32` |
| `DATABASE_URI` | PostgreSQL 連線字串 | `postgresql://user:pw@host:5432/db` |
| `NEXT_PUBLIC_SITE_URL` | 網站正式網址 | `https://www.chickimmiu.com` |
| `AUTH_SECRET` | NextAuth v5 密鑰 | `openssl rand -base64 32` |

### 社群登入

| 變數 | 取得位置 |
|------|----------|
| `AUTH_GOOGLE_ID` / `AUTH_GOOGLE_SECRET` | [Google Cloud Console](https://console.cloud.google.com/) |
| `AUTH_FACEBOOK_ID` / `AUTH_FACEBOOK_SECRET` | [Meta for Developers](https://developers.facebook.com/) |
| `AUTH_LINE_CHANNEL_ID` / `AUTH_LINE_CHANNEL_SECRET` | [LINE Developers](https://developers.line.biz/) |

### 金流

| 變數 | 取得位置 |
|------|----------|
| `NEXT_PUBLIC_PAYPAL_CLIENT_ID` / `PAYPAL_CLIENT_SECRET` | [PayPal Developer](https://developer.paypal.com/) |
| `ECPAY_MERCHANT_ID` / `ECPAY_HASH_KEY` / `ECPAY_HASH_IV` | [綠界科技](https://www.ecpay.com.tw/) |
| `NEWEBPAY_MERCHANT_ID` / `NEWEBPAY_HASH_KEY` / `NEWEBPAY_HASH_IV` | [藍新支付](https://www.newebpay.com/) |
| `LINE_PAY_CHANNEL_ID` / `LINE_PAY_CHANNEL_SECRET` | [LINE Pay](https://pay.line.me/) |

### 廣告追蹤

| 變數 | 說明 |
|------|------|
| `NEXT_PUBLIC_GTM_ID` | Google Tag Manager 容器 ID（GTM-XXXXXXX） |
| `NEXT_PUBLIC_META_PIXEL_ID` | Meta Pixel ID |
| `META_CAPI_ACCESS_TOKEN` | Meta Conversions API 存取權杖 |
| `NEXT_PUBLIC_GA4_ID` | GA4 評估 ID（G-XXXXXXXXXX） |
| `NEXT_PUBLIC_GOOGLE_ADS_ID` | Google Ads ID（AW-XXXXXXXXX） |

> **提示**：追蹤 ID 也可在 Payload 後台「全站設定 → 廣告追蹤碼」中設定，後台設定優先於環境變數。

---

## 本機開發

```bash
# 安裝依賴
pnpm install

# 啟動開發伺服器（Next.js + Payload CMS）
pnpm dev

# 型別檢查
pnpm tsc --noEmit

# Production 建構
pnpm build

# 啟動 Production 模式
pnpm start
```

### PostgreSQL 本機設定

```bash
# 使用 Docker
docker run -d --name ckm-postgres \
  -e POSTGRES_DB=chickimmiu \
  -e POSTGRES_PASSWORD=password \
  -p 5432:5432 postgres:16

# DATABASE_URI=postgresql://postgres:password@localhost:5432/chickimmiu
```

---

## Vercel 部署

### 步驟

1. **推送至 GitHub**：
   ```bash
   git push origin main
   ```

2. **在 Vercel 建立專案**：
   - 匯入 GitHub 倉庫
   - Framework Preset: **Next.js**
   - Root Directory: `.`（如果是 monorepo 則選子目錄）

3. **設定環境變數**：
   - 在 Vercel Dashboard → Settings → Environment Variables
   - 加入所有 `.env.example` 中列出的變數
   - **注意**：`NEXT_PUBLIC_*` 開頭的變數在建構時嵌入，需要重新部署才會生效

4. **PostgreSQL 連線**：
   - 推薦使用 [Supabase](https://supabase.com/)、[Neon](https://neon.tech/) 或 [Vercel Postgres](https://vercel.com/storage/postgres)
   - 使用 Transaction Pooler 連線字串（支援 Serverless）

5. **域名設定**：
   - 在 Vercel Dashboard → Domains 加入自訂域名
   - 更新 `NEXT_PUBLIC_SITE_URL` 為正式域名
   - 確認 DNS 設定正確

### 注意事項

- Payload CMS 與 Next.js **同一個專案部署**，不需分開
- 建構時 Payload 會自動產生 Admin UI
- 確認 PostgreSQL 允許來自 Vercel IP 的連線
- 如使用 S3/R2 儲存媒體檔案，需設定對應的環境變數

---

## 追蹤事件驗證

### 開發環境（Debug 模式）

所有追蹤事件在開發模式下會自動 `console.log`，格式如：
```
[Tracking] page_view { page_path: "/products/autumn-dress" }
[Tracking] view_item { currency: "TWD", value: 1280, items: [...] }
[Tracking] add_to_cart { currency: "TWD", value: 1280, items: [...] }
```

### GTM Preview 模式

1. 前往 [GTM](https://tagmanager.google.com/)
2. 點擊「Preview」按鈕
3. 輸入網站 URL
4. 操作網站流程，在 Tag Assistant 中驗證事件觸發

### Meta Pixel 驗證

1. 安裝 [Meta Pixel Helper](https://chrome.google.com/webstore/detail/meta-pixel-helper/) Chrome 擴充套件
2. 瀏覽網站頁面，檢查 Pixel 是否正確觸發
3. 在 [Events Manager](https://business.facebook.com/events_manager2/) 驗證事件

### GA4 驗證

1. 前往 GA4 → 設定 → DebugView
2. 或使用 [GA Debugger](https://chrome.google.com/webstore/detail/google-analytics-debugger/) 擴充套件

### Google Ads 轉換驗證

1. 在 Google Ads → 工具 → 轉換 中檢查狀態
2. 完成一筆測試訂單，確認轉換追蹤

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
- [ ] 社群登入（Google / Facebook / LINE）
- [ ] 帳戶設定 — 個人資料編輯
- [ ] 訂單列表 — 展開明細
- [ ] 收藏清單 — 新增/移除
- [ ] 地址管理 — CRUD + 設定預設
- [ ] 點數/購物金 — 餘額與歷史
- [ ] 會員等級 — 正確顯示

### 🎮 遊戲互動
- [ ] 轉盤 — 旋轉動畫、獎品顯示
- [ ] 刮刮卡 — 刮除效果、自動揭曉
- [ ] 每日簽到 — 7 天連續、獎勵累積

### 🤝 合作夥伴後台
- [ ] 推廣總覽 — 統計正確
- [ ] 推廣連結 — 複製功能
- [ ] 佣金明細 — 列表與匯出按鈕
- [ ] 申請提款 — 表單提交

### 📝 內容系統
- [ ] 部落格列表 — 分類篩選
- [ ] 部落格文章 — 相關文章推薦
- [ ] 動態頁面 — Section Builder 各區塊渲染
- [ ] 會員福利頁 — 六層等級卡片

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
- [ ] Admin 登入正常
- [ ] 商品 CRUD
- [ ] 部落格文章 CRUD
- [ ] 會員管理
- [ ] CSV/Excel 匯入匯出
- [ ] 全站設定 — 追蹤碼更新後前台生效
- [ ] RBAC — Partner 只能看自己的資料

### 🚀 部署
- [ ] `pnpm build` 無錯誤
- [ ] `tsc --noEmit` 無錯誤
- [ ] 環境變數完整設定
- [ ] PostgreSQL 連線正常
- [ ] 域名 & SSL 設定正確
