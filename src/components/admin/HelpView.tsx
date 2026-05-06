import React from 'react'
import { DefaultTemplate } from '@payloadcms/next/templates'
import type { AdminViewServerProps } from 'payload'

/**
 * HelpView — /admin/help
 * ─────────────────────
 * 後台使用說明頁，集中所有「怎麼用」的操作指引與完整的站台架構地圖。
 *
 * 結構（15 節）：
 *   1. 網站架構總覽        — 34 collections + 15 globals 分域
 *   2. 首次上線 checklist  — go-live 前必檢項目
 *   3. 權限與角色
 *   4. 媒體上傳規則
 *   5. 相簿 / 資料夾分類
 *   6. 從供應商網站抓圖    — Python CLI + /api/media/import-from-supplier
 *   7. 商品圖整批上傳（開發中）
 *   8. 商品列表批次操作
 *   9. 會員等級 & 點數系統
 *   10. 訂單管理流程
 *   11. 行銷 & CRM 自動化
 *   12. 內容管理
 *   13. 遊戲系統
 *   14. 發票 & 稅務
 *   15. 常見問題排障
 *
 * 對應程式：
 *   - src/collections/Media.ts beforeChange 驗證
 *   - src/components/admin/ProductBulkActions.tsx
 *   - src/components/admin/ImportExportButtons.tsx
 *   - src/endpoints/importExport.ts
 */

type Block = {
  title: string
  body: React.ReactNode
}

const cardStyle: React.CSSProperties = {
  border: '1px solid var(--theme-elevation-150, #e4e4e7)',
  borderRadius: 12,
  padding: 24,
  marginBottom: 20,
  background: 'var(--theme-elevation-0, #fff)',
}

const h2Style: React.CSSProperties = {
  margin: 0,
  marginBottom: 16,
  fontSize: 20,
  fontWeight: 600,
  color: 'var(--theme-elevation-900, #111)',
}

const h3Style: React.CSSProperties = {
  margin: 0,
  marginTop: 20,
  marginBottom: 8,
  fontSize: 15,
  fontWeight: 600,
  color: 'var(--theme-elevation-800, #222)',
}

const pStyle: React.CSSProperties = {
  margin: '8px 0',
  lineHeight: 1.7,
  fontSize: 14,
  color: 'var(--theme-elevation-700, #333)',
}

const tableStyle: React.CSSProperties = {
  width: '100%',
  borderCollapse: 'collapse',
  fontSize: 13,
  marginTop: 12,
}

const thStyle: React.CSSProperties = {
  textAlign: 'left',
  padding: '8px 10px',
  borderBottom: '1px solid var(--theme-elevation-200, #e4e4e7)',
  background: 'var(--theme-elevation-50, #fafafa)',
  fontWeight: 600,
}

const tdStyle: React.CSSProperties = {
  padding: '8px 10px',
  borderBottom: '1px solid var(--theme-elevation-100, #f4f4f5)',
  verticalAlign: 'top',
}

const codeStyle: React.CSSProperties = {
  fontFamily: 'ui-monospace, SF Mono, Consolas, monospace',
  fontSize: 12,
  padding: '1px 6px',
  background: 'var(--theme-elevation-100, #f4f4f5)',
  borderRadius: 4,
}

const tocStyle: React.CSSProperties = {
  position: 'sticky',
  top: 20,
  padding: 16,
  background: 'var(--theme-elevation-50, #fafafa)',
  border: '1px solid var(--theme-elevation-150, #e4e4e7)',
  borderRadius: 8,
  fontSize: 13,
  lineHeight: 1.9,
}

const ulStyle: React.CSSProperties = { ...pStyle, paddingLeft: 24 }

const blocks: Block[] = [
  // ══════════════════════════════════════════════════════════════════════
  // 1. 網站架構總覽
  // ══════════════════════════════════════════════════════════════════════
  {
    title: '網站架構總覽',
    body: (
      <>
        <p style={pStyle}>
          CHIC KIM &amp; MIU 後台以 <strong>Payload CMS v3</strong> 建置，共 34 個 collection（資料集合）與
          15 個 global（全站設定）。左側導覽依功能域分組，主要的域：
        </p>
        <table style={tableStyle}>
          <thead>
            <tr>
              <th style={thStyle}>域</th>
              <th style={thStyle}>主要 collections</th>
              <th style={thStyle}>對應 globals</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td style={tdStyle}>會員管理</td>
              <td style={tdStyle}>Users、MembershipTiers、SubscriptionPlans</td>
              <td style={tdStyle}>LoyaltySettings、ReferralSettings、PointRedemptionSettings</td>
            </tr>
            <tr>
              <td style={tdStyle}>商品管理</td>
              <td style={tdStyle}>Products、Categories、SizeCharts、ProductReviews</td>
              <td style={tdStyle}>RecommendationSettings</td>
            </tr>
            <tr>
              <td style={tdStyle}>訂單管理</td>
              <td style={tdStyle}>Orders、Returns、Refunds、Exchanges、ShippingMethods、Invoices、Carts</td>
              <td style={tdStyle}>GlobalSettings (shipping/payment)、InvoiceSettings</td>
            </tr>
            <tr>
              <td style={tdStyle}>行銷活動</td>
              <td style={tdStyle}>
                PointsRedemptions、MarketingCampaigns、BirthdayCampaigns、FestivalTemplates、ABTests、
                MessageTemplates、MarketingExecutionLogs
              </td>
              <td style={tdStyle}>MarketingAutomationSettings</td>
            </tr>
            <tr>
              <td style={tdStyle}>CRM</td>
              <td style={tdStyle}>
                CreditScoreHistory、PointsTransactions、AutomationJourneys、AutomationLogs、
                CustomerServiceTickets、MemberSegments、ConciergeServiceRequests
              </td>
              <td style={tdStyle}>CRMSettings、SegmentationSettings</td>
            </tr>
            <tr>
              <td style={tdStyle}>內容管理</td>
              <td style={tdStyle}>BlogPosts、Pages、UGCPosts、Media</td>
              <td style={tdStyle}>
                HomepageSettings、AboutPageSettings、FAQPageSettings、PolicyPagesSettings、NavigationSettings
              </td>
            </tr>
            <tr>
              <td style={tdStyle}>遊戲系統</td>
              <td style={tdStyle}>MiniGameRecords、CardBattles、GameLeaderboard</td>
              <td style={tdStyle}>GameSettings</td>
            </tr>
            <tr>
              <td style={tdStyle}>合作夥伴</td>
              <td style={tdStyle}>Affiliates</td>
              <td style={tdStyle}>—</td>
            </tr>
            <tr>
              <td style={tdStyle}>稽核 / 安全</td>
              <td style={tdStyle}>LoginAttempts</td>
              <td style={tdStyle}>—</td>
            </tr>
          </tbody>
        </table>
        <h3 style={h3Style}>導覽原則</h3>
        <ul style={ulStyle}>
          <li>
            <strong>Collections</strong> 管「一筆一筆的資料」（一個會員、一筆訂單、一支商品）。
          </li>
          <li>
            <strong>Globals</strong> 管「整站只有一份的設定」（忠誠度計畫參數、首頁 Hero、政策頁內文）。
          </li>
          <li>要改 <strong>行為規則 / 參數</strong> → 找 global；要改 <strong>個別資料</strong> → 找 collection。</li>
        </ul>
      </>
    ),
  },

  // ══════════════════════════════════════════════════════════════════════
  // 2. 首次上線 checklist
  // ══════════════════════════════════════════════════════════════════════
  {
    title: '首次上線 checklist',
    body: (
      <>
        <p style={pStyle}>
          開站前請把以下 10 項檢查完再對外開放。順序建議由上到下，因為後面幾項會依賴前面設定。
        </p>
        <ol style={ulStyle}>
          <li>
            <strong>全站設定</strong>（Globals → 全站設定）：品牌名稱、聯絡 email/電話、SEO meta、
            LINE/IG 連結、貨幣（TWD 預設）。
          </li>
          <li>
            <strong>忠誠度計畫設定</strong>：點數兌換比例（如 1 元 = 0.01 點）、各等級消費倍率、
            點數效期（預設 365 天）。
          </li>
          <li>
            <strong>會員等級</strong>（MembershipTiers）：六級 T0 優雅初遇者 → T5 璀璨天后，
            確認每級的升等門檻、前台稱號（含男版 <code style={codeStyle}>frontNameMale</code>）。
          </li>
          <li>
            <strong>商品類別</strong>（Categories）：建主類別 + 子類別，類別會影響商品頁麵包屑與
            AI 推薦分群。
          </li>
          <li>
            <strong>至少一筆商品發布</strong>：<code style={codeStyle}>status=published</code>，
            有庫存、有商品圖、有 SKU，用來走通結帳流程。
          </li>
          <li>
            <strong>運送方式</strong>（ShippingMethods + 全站設定 → 運費）：啟用的方式（宅配、超商取貨、
            到辦公室取貨、新竹物流、面交等），免運門檻。
          </li>
          <li>
            <strong>付款方式</strong>（全站設定 → 付款）：ECPay / 信用卡 / 貨到付款 / 現金面交，
            勾選要啟用的。
          </li>
          <li>
            <strong>發票設定</strong>（InvoiceSettings）：綠界電子發票 API 金鑰、賣方統一編號、
            LOGO，測試開一張。
          </li>
          <li>
            <strong>首頁內容</strong>（HomepageSettings）：Hero 圖、特色區塊、行銷 banner。
          </li>
          <li>
            <strong>政策頁面</strong>（PolicyPagesSettings）：服務條款、隱私權、退貨政策、會員條款
            — 結帳頁與 footer 都會連到這些。
          </li>
        </ol>
        <p style={pStyle}>
          <strong>建議</strong>：建一位 <code style={codeStyle}>role=customer</code> 的測試帳號，
          親自下一筆訂單、退一次貨，確保整條鏈路都通。
        </p>
      </>
    ),
  },

  // ══════════════════════════════════════════════════════════════════════
  // 3. 權限與角色
  // ══════════════════════════════════════════════════════════════════════
  {
    title: '權限與角色',
    body: (
      <>
        <p style={pStyle}>系統區分三種角色（Users.role 欄位）：</p>
        <table style={tableStyle}>
          <thead>
            <tr>
              <th style={thStyle}>角色</th>
              <th style={thStyle}>後台權限</th>
              <th style={thStyle}>前台行為</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td style={tdStyle}><strong>admin</strong></td>
              <td style={tdStyle}>完整權限：刪商品、改全站設定、改別人資料、看稽核日誌</td>
              <td style={tdStyle}>正常購物</td>
            </tr>
            <tr>
              <td style={tdStyle}><strong>partner</strong></td>
              <td style={tdStyle}>
                可讀寫內容（商品、文章、媒體），<strong>不能</strong>刪商品或改全站設定
              </td>
              <td style={tdStyle}>正常購物</td>
            </tr>
            <tr>
              <td style={tdStyle}><strong>customer</strong></td>
              <td style={tdStyle}>沒後台存取權</td>
              <td style={tdStyle}>可讀自己資料、寫 UGC、評論、上傳頭像</td>
            </tr>
          </tbody>
        </table>
        <h3 style={h3Style}>管理員細部權限</h3>
        <p style={pStyle}>
          在 admin 使用者卡片 → 「基本資料 &amp; 權限」分頁 → 「管理員權限設定」可以細調某位 admin
          能碰的模組（商品、訂單、會員、行銷、財務、系統設定、內容、CRM）。例如行銷專員勾 <em>行銷管理</em>
          + <em>內容管理</em> 就好。
        </p>
        <h3 style={h3Style}>操作時出現「權限不足」/「Forbidden」</h3>
        <p style={pStyle}>
          請跟 admin 確認：(1) 角色是不是對的；(2) 若是細部權限被關掉，admin 要在該 user 的權限面板重開。
          customer 角色無論如何都進不了 <code style={codeStyle}>/admin</code>。
        </p>
      </>
    ),
  },

  // ══════════════════════════════════════════════════════════════════════
  // 4. 媒體上傳規則
  // ══════════════════════════════════════════════════════════════════════
  {
    title: '媒體上傳規則',
    body: (
      <>
        <p style={pStyle}>
          所有媒體檔案上傳到「<strong>媒體資源 → Media</strong>」後，可在任何 collection 的圖片欄位（商品圖、頭像、部落格 hero 圖…）被選用。
          上傳時請留意以下限制：
        </p>
        <table style={tableStyle}>
          <thead>
            <tr>
              <th style={thStyle}>類型</th>
              <th style={thStyle}>大小上限</th>
              <th style={thStyle}>支援格式</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td style={tdStyle}>圖片</td>
              <td style={tdStyle}><strong>8 MB</strong></td>
              <td style={tdStyle}>jpeg / png / webp / gif</td>
            </tr>
            <tr>
              <td style={tdStyle}>影片</td>
              <td style={tdStyle}><strong>50 MB</strong></td>
              <td style={tdStyle}>mp4</td>
            </tr>
            <tr>
              <td style={tdStyle}>文件</td>
              <td style={tdStyle}><strong>10 MB</strong></td>
              <td style={tdStyle}>pdf</td>
            </tr>
          </tbody>
        </table>
        <h3 style={h3Style}>超過上限怎麼辦？</h3>
        <p style={pStyle}>建議先做無損壓縮：</p>
        <ul style={ulStyle}>
          <li>
            圖片：<a href="https://squoosh.app" target="_blank" rel="noopener noreferrer">Squoosh</a>
            （免費網頁版）— 商品圖建議輸出 webp 或 jpeg 約 <strong>300–800 KB</strong>，
            寬度 1600 px 即可支援 desktop 4 種圖檔尺寸（thumbnail / card / tablet / desktop）。
          </li>
          <li>
            影片：<a href="https://handbrake.fr" target="_blank" rel="noopener noreferrer">HandBrake</a>
            （免費開源）— 建議輸出 H.264 mp4，1080p 以內，位元率 2–4 Mbps。
          </li>
          <li>PDF：多頁文件可用 <code style={codeStyle}>pdftk</code> 或線上工具拆檔。</li>
        </ul>
        <h3 style={h3Style}>為什麼不支援 SVG / HEIC？</h3>
        <p style={pStyle}>
          <strong>SVG 已被停用</strong>，因為可以嵌 JavaScript 造成 XSS 風險；
          <strong>HEIC（iPhone 預設格式）</strong>目前未支援，請先在手機「設定 → 相機 → 格式」切成「最相容」輸出 jpg，或用任何轉檔工具轉 jpeg。
        </p>
        <h3 style={h3Style}>檔名限制</h3>
        <p style={pStyle}>
          檔名不可包含 <code style={codeStyle}>/</code>、<code style={codeStyle}>\</code>、<code style={codeStyle}>..</code>（防路徑穿越攻擊）。
          中文檔名可以使用，但 <strong>建議改英數</strong>（如商品貨號），系統會正規化成 URL 安全字串。
        </p>
      </>
    ),
  },

  // ══════════════════════════════════════════════════════════════════════
  // 5. 相簿 / 資料夾分類
  // ══════════════════════════════════════════════════════════════════════
  {
    title: '相簿 / 資料夾分類',
    body: (
      <>
        <p style={pStyle}>
          Media 有「相簿 / 資料夾名稱」欄位，填入後可在 Media 列表頁用此欄位搜尋、篩選、排序，讓圖庫不會一團亂。
          建議命名慣例：
        </p>
        <table style={tableStyle}>
          <thead>
            <tr>
              <th style={thStyle}>用途</th>
              <th style={thStyle}>建議命名</th>
              <th style={thStyle}>範例</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td style={tdStyle}>商品圖</td>
              <td style={tdStyle}>用商品貨號</td>
              <td style={tdStyle}><code style={codeStyle}>SS25-001</code>、<code style={codeStyle}>CKM-DR-042</code></td>
            </tr>
            <tr>
              <td style={tdStyle}>活動 / 型錄</td>
              <td style={tdStyle}>年份 + 活動名</td>
              <td style={tdStyle}><code style={codeStyle}>2026-spring-campaign</code></td>
            </tr>
            <tr>
              <td style={tdStyle}>版位素材</td>
              <td style={tdStyle}>用途分類</td>
              <td style={tdStyle}><code style={codeStyle}>banner</code>、<code style={codeStyle}>lookbook</code>、<code style={codeStyle}>ugc</code></td>
            </tr>
          </tbody>
        </table>
      </>
    ),
  },

  // ══════════════════════════════════════════════════════════════════════
  // 6. 從供應商網站抓圖（Python CLI + /api/media/import-from-supplier）
  // ══════════════════════════════════════════════════════════════════════
  {
    title: '從供應商網站抓圖（Sinsang / 1688 / 自家後台）',
    body: (
      <>
        <p style={pStyle}>
          針對「供應商給的圖片要先抓下來再上架」這個常見痛點，後台提供一支 <strong>Python 命令列工具</strong>，
          可從韓國 sinsangmarket、中國 1688 / Alibaba、自家 chickimmiu PDP 等網頁批量抓圖、自動分類成
          主圖 / 細節圖，產出 <code style={codeStyle}>manifest.json</code> 後可一鍵餵進 Media。
        </p>

        <div
          style={{
            display: 'flex',
            gap: 12,
            alignItems: 'center',
            flexWrap: 'wrap',
            marginTop: 16,
            marginBottom: 16,
          }}
        >
          <a
            href="/downloads/image-downloader.zip"
            download
            style={{
              display: 'inline-block',
              padding: '10px 20px',
              background: 'var(--theme-success-500, #16a34a)',
              color: '#fff',
              borderRadius: 8,
              fontWeight: 600,
              textDecoration: 'none',
              fontSize: 14,
            }}
          >
            ⬇ 下載工具（image-downloader.zip）
          </a>
          <span style={{ fontSize: 12, color: 'var(--theme-elevation-500, #888)' }}>
            約 23 KB · 4 個檔案 · 需要 Python 3.9+
          </span>
        </div>

        <h3 style={h3Style}>第一次安裝（約 5 分鐘）</h3>
        <ol style={ulStyle}>
          <li>下載 zip 並解壓到電腦，例如桌面 <code style={codeStyle}>image-downloader/</code>。</li>
          <li>
            確認電腦有 Python 3.9 以上：打開命令提示字元 / Terminal，跑
            <code style={codeStyle}>python --version</code>。沒有的話到{' '}
            <a href="https://www.python.org/downloads/" target="_blank" rel="noopener noreferrer">
              python.org
            </a>{' '}
            下載安裝（Windows 安裝精靈第一步記得勾「Add Python to PATH」）。
          </li>
          <li>
            進到解壓後的資料夾，跑：
            <pre style={{ ...pStyle, ...codeStyle, padding: 12, overflow: 'auto', fontSize: 12 }}>
{`python -m venv .venv
.venv\\Scripts\\activate          # Windows
# 或 source .venv/bin/activate   # macOS / Linux
pip install -r requirements.txt`}
            </pre>
          </li>
        </ol>

        <h3 style={h3Style}>抓單一商品頁</h3>
        <pre style={{ ...pStyle, ...codeStyle, padding: 12, overflow: 'auto', fontSize: 12 }}>
{`python image_downloader.py -u https://www.chickimmiu.com/products/<slug>`}
        </pre>
        <p style={pStyle}>
          圖會下載到當下資料夾的 <code style={codeStyle}>downloads/&lt;頁面 slug&gt;/</code>，
          並產出 <code style={codeStyle}>manifest.json</code>（含每張圖的解析度、分類、md5）。
        </p>

        <h3 style={h3Style}>批次抓多個商品</h3>
        <p style={pStyle}>
          新增一個 <code style={codeStyle}>urls.txt</code>，每行一個 URL（# 開頭視為註解）：
        </p>
        <pre style={{ ...pStyle, ...codeStyle, padding: 12, overflow: 'auto', fontSize: 12 }}>
{`# 第一波春夏新品
https://sinsangmarket.kr/item/100001
https://sinsangmarket.kr/item/100002
https://detail.1688.com/offer/700123456789.html`}
        </pre>
        <pre style={{ ...pStyle, ...codeStyle, padding: 12, overflow: 'auto', fontSize: 12 }}>
{`python image_downloader.py -f urls.txt -o downloads/2026-spring/ --sharpen`}
        </pre>

        <h3 style={h3Style}>抓完之後一鍵上傳 Media</h3>
        <p style={pStyle}>
          檢查 <code style={codeStyle}>downloads/</code> 裡的圖、刪掉不要的之後，
          用同捆的 <code style={codeStyle}>upload_to_payload.py</code> 全傳到後台 Media：
        </p>
        <pre style={{ ...pStyle, ...codeStyle, padding: 12, overflow: 'auto', fontSize: 12 }}>
{`python upload_to_payload.py \\
  --base-url https://www.chickimmiu.com \\
  --email <你的後台 email> \\
  --password <密碼> \\
  --manifest downloads/2026-spring/manifest.json \\
  --categories main,detail`}
        </pre>
        <p style={pStyle}>
          <strong>斷點續傳</strong>：中途斷線重跑同樣指令會自動跳過已上傳的；紀錄寫在
          <code style={codeStyle}>uploaded.json</code>。傳完每張圖會在
          <strong>媒體資源 → Media</strong> 列表出現，<code style={codeStyle}>folder</code> 欄位
          自動填成商品頁的 slug，方便用相簿名稱篩選。
        </p>

        <h3 style={h3Style}>進階：直接後台貼 URL（不需要本機 Python）</h3>
        <p style={pStyle}>
          後台另提供 <code style={codeStyle}>POST /api/media/import-from-supplier</code> endpoint，
          admin 帳號可從 DevTools console 直接呼叫：
        </p>
        <pre style={{ ...pStyle, ...codeStyle, padding: 12, overflow: 'auto', fontSize: 12 }}>
{`fetch('/api/media/import-from-supplier', {
  method: 'POST',
  credentials: 'include',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    url: 'https://www.chickimmiu.com/products/<slug>',
    maxImages: 30,
    dryRun: true,    // 先預覽不實際入庫；確認後改 false 再跑一次
  })
}).then(r => r.json()).then(console.log)`}
        </pre>
        <p style={pStyle}>
          <strong>注意</strong>：被 Cloudflare bot challenge 保護的站（sinsangmarket、部分 1688）
          伺服器端會 403 抓不到，請改走上面命令列路線從你的瀏覽器 cookie 抓。
        </p>

        <h3 style={h3Style}>故障排除</h3>
        <ul style={ulStyle}>
          <li>
            <strong><code style={codeStyle}>[Empty] xxx 沒有抽到任何圖片</code></strong>
            ——多半是 SPA 動態載入，或需要登入。前者改用 Playwright（README 有教），
            後者請從瀏覽器 DevTools → Cookies 拷出來。
          </li>
          <li>
            <strong>大量 <code style={codeStyle}>[HTTP 403]</code></strong>
            ——降低 <code style={codeStyle}>--workers</code> 到 2-3，部分 CDN 對並發很敏感。
          </li>
          <li>
            <strong>圖片解析度不夠</strong> —— 加
            <code style={codeStyle}>--upscale 1600 --sharpen</code> 把短邊放大到 1600px + 銳利化。
          </li>
          <li>
            其他問題請看 zip 內 <code style={codeStyle}>README.md</code> 的 FAQ 與已知限制章節。
          </li>
        </ul>
      </>
    ),
  },

  // ══════════════════════════════════════════════════════════════════════
  // 7. 商品圖整批上傳
  // ══════════════════════════════════════════════════════════════════════
  // (留為原 section 7 — 拖曳資料夾批次上傳，仍開發中)
  {
    title: '商品圖整批上傳（資料夾拖曳）',
    body: (
      <>
        <p style={pStyle}>
          <em>🚧 這個功能即將推出（follow-up PR）。</em>
          本節先說明前置準備，等功能上線後資料夾拉進來就能直接使用。
        </p>
        <h3 style={h3Style}>資料夾命名規則</h3>
        <p style={pStyle}>
          在本機先把同一個商品的圖片放進一個資料夾，資料夾名稱就是「<strong>商品貨號</strong>」（對應 Products 的
          <code style={codeStyle}>productSku</code> 欄位），系統會用貨號找到商品並自動把圖片掛上。
        </p>
        <h3 style={h3Style}>檔案命名規則（決定顯示順序）</h3>
        <p style={pStyle}>
          資料夾裡的檔名用 <strong>固定長度數字</strong>前綴，系統會依數字排序後依序掛到商品的
          <code style={codeStyle}>images</code> 陣列：
        </p>
        <pre style={{ ...pStyle, ...codeStyle, padding: 12, overflow: 'auto' }}>
{`SS25-001/
  ├── 01-front.jpg      ← 商品列表主圖、PDP 第一張
  ├── 02-back.jpg
  ├── 03-detail.jpg
  ├── 04-sleeve.jpg
  └── 05-size-chart.png ← 尺寸表通常放最後`}
        </pre>
        <h3 style={h3Style}>操作流程（即將推出）</h3>
        <ol style={ulStyle}>
          <li>在電腦準備好以商品貨號命名的資料夾，裡面圖片依 <code style={codeStyle}>01-…</code>、<code style={codeStyle}>02-…</code> 命名。</li>
          <li>到「後台 → 工具 → 商品圖整批上傳」頁面（待開發）。</li>
          <li>把整個資料夾拖到網頁視窗；系統會顯示「找到 N 個資料夾 / M 張圖 / 對應 K 個商品 / 有 L 個貨號找不到商品」的預覽。</li>
          <li>確認無誤後按「開始上傳」；上傳完成後會自動把圖片依檔名順序寫入 <code style={codeStyle}>products.images</code>。</li>
        </ol>
      </>
    ),
  },

  // ══════════════════════════════════════════════════════════════════════
  // 8. 商品列表批次操作
  // ══════════════════════════════════════════════════════════════════════
  {
    title: '商品列表批次操作',
    body: (
      <>
        <h3 style={h3Style}>全選一鍵刪除</h3>
        <p style={pStyle}>到「商品管理 → 商品」列表頁：</p>
        <ol style={ulStyle}>
          <li>勾選列表最上方表頭的 checkbox（也可以先用上方搜尋條件過濾出特定商品再全選）。</li>
          <li>列表上方出現「<strong>Delete</strong>」按鈕，點擊後系統會要求你二次確認。</li>
          <li>
            系統限制：<strong>只有 admin 角色</strong>才能刪除商品（<code style={codeStyle}>access.delete: isAdmin</code>）。
          </li>
        </ol>
        <p style={pStyle}>
          <strong>⚠️ 注意：</strong>刪除是硬刪除、不可復原，且會同步刪除前台快取。
          若只是要下架，建議改用下方「批次下架」，保留商品資料以便之後回架。
        </p>

        <h3 style={h3Style}>批次上 / 下架</h3>
        <p style={pStyle}>列表頁上方「<strong>⚡ 批次操作</strong>」面板提供三個一鍵動作：</p>
        <ul style={ulStyle}>
          <li>
            <strong>✅ 批次上架所有草稿</strong>：把 <code style={codeStyle}>status=draft</code> 的商品全部轉為
            <code style={codeStyle}>published</code>（二次確認）。
          </li>
          <li><strong>📦 將「已上架但庫存 0」設為下架</strong>：避免客戶下單後才發現缺貨。</li>
          <li><strong>🔄 全站快取重新生成</strong>：需要讓前台立刻反映後台修改時使用。</li>
        </ul>

        <h3 style={h3Style}>XLSX / CSV 匯入匯出</h3>
        <p style={pStyle}>列表上方另有「匯出 CSV / 匯出 Excel / 匯入 CSV·Excel」按鈕，適合大量修改：</p>
        <ol style={ulStyle}>
          <li>
            點「<strong>匯出 Excel</strong>」下載目前資料庫所有商品，欄位包含：商品名稱、網址代碼、商品總 SKU、品牌、原價、特價、庫存、狀態、新品、熱銷、重量、材質、原產地、變體（JSON）、標籤（JSON）。
          </li>
          <li>在 Excel / Numbers / Google Sheets 修改後存回 .xlsx。</li>
          <li>
            點「<strong>匯入 CSV·Excel</strong>」上傳檔案；系統以「網址代碼（<code style={codeStyle}>slug</code>）」為 key —
            已存在就更新、不存在就新增。
          </li>
        </ol>
        <p style={pStyle}>
          除了這個通用匯入匯出，還有專屬的「<strong>Shopline XLSX 匯入</strong>」（對應 Shopline 匯出的 BulkUpdateForm.xlsx）
          和「<strong>Sinsang 匯入</strong>」（對應 Sinsang 商品抓取格式）兩個按鈕。
        </p>
      </>
    ),
  },

  // ══════════════════════════════════════════════════════════════════════
  // 9. 會員等級 & 點數系統
  // ══════════════════════════════════════════════════════════════════════
  {
    title: '會員等級 & 點數系統',
    body: (
      <>
        <h3 style={h3Style}>六級等級制</h3>
        <p style={pStyle}>
          會員等級（<strong>MembershipTiers</strong>）分六級，升降邏輯：
        </p>
        <ul style={ulStyle}>
          <li><strong>升等</strong>：按累計消費金額（<code style={codeStyle}>users.lifetimeSpend</code>）達門檻自動升。</li>
          <li>
            <strong>降等</strong>：按年度消費（<code style={codeStyle}>annualSpend</code>，每年 1/1 歸零）
            或連續 6 個月無訂單自動降一級；admin 也可手動指定。
          </li>
          <li>
            <strong>前台稱號</strong>：女版走 <code style={codeStyle}>frontName</code>，男版走
            <code style={codeStyle}>frontNameMale</code>；男會員沒設男版會 fallback 到 <code style={codeStyle}>frontName</code>。
            依 <code style={codeStyle}>users.gender</code> 判斷。
          </li>
        </ul>

        <h3 style={h3Style}>四種點數 / 金流</h3>
        <table style={tableStyle}>
          <thead>
            <tr>
              <th style={thStyle}>類別</th>
              <th style={thStyle}>來源</th>
              <th style={thStyle}>可退現</th>
              <th style={thStyle}>效期</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td style={tdStyle}><strong>會員點數</strong> (points)</td>
              <td style={tdStyle}>消費賺取（倍率看等級）、活動贈送</td>
              <td style={tdStyle}>否</td>
              <td style={tdStyle}>365 天 FIFO 到期</td>
            </tr>
            <tr>
              <td style={tdStyle}><strong>購物金</strong> (shoppingCredit)</td>
              <td style={tdStyle}>簽到、推薦、生日禮、節慶活動</td>
              <td style={tdStyle}>否</td>
              <td style={tdStyle}>依活動設定</td>
            </tr>
            <tr>
              <td style={tdStyle}><strong>儲值金</strong> (storedValueBalance)</td>
              <td style={tdStyle}>會員用真金白銀儲值進來</td>
              <td style={tdStyle}>是（退現 API 未開通）</td>
              <td style={tdStyle}>不到期</td>
            </tr>
            <tr>
              <td style={tdStyle}><strong>信用分數</strong> (creditScore)</td>
              <td style={tdStyle}>系統依退貨頻率、消費穩定度自動調整</td>
              <td style={tdStyle}>—</td>
              <td style={tdStyle}>0–100 持續浮動</td>
            </tr>
          </tbody>
        </table>

        <h3 style={h3Style}>相關 globals</h3>
        <ul style={ulStyle}>
          <li>
            <strong>LoyaltySettings</strong>：點數兌換比例（預設 1 元 = 0.01 點）、各級消費倍率、
            點數效期天數、簽到獎勵、生日禮、AI 推薦權重。
          </li>
          <li>
            <strong>ReferralSettings</strong>：推薦人/被推薦人的點數或購物金獎勵、防濫用（同 IP、同 device）門檻。
          </li>
          <li>
            <strong>PointRedemptionSettings</strong>：到期提醒天數、限時加倍活動、稀缺性、抽獎機制。
          </li>
        </ul>

        <h3 style={h3Style}>點數流水（PointsTransactions）</h3>
        <p style={pStyle}>
          每一筆點數進出都會在 <strong>PointsTransactions</strong> collection 留紀錄，欄位含
          <code style={codeStyle}>type</code>（earn/redeem/adjust/expire）、
          <code style={codeStyle}>amount</code>、<code style={codeStyle}>source</code>（訂單 ID / 簽到 / 推薦 / admin 手動調整）、
          <code style={codeStyle}>createdAt</code>。會員端 /account/points 頁就是讀這個集合。
        </p>
      </>
    ),
  },

  // ══════════════════════════════════════════════════════════════════════
  // 10. 訂單管理流程
  // ══════════════════════════════════════════════════════════════════════
  {
    title: '訂單管理流程',
    body: (
      <>
        <h3 style={h3Style}>訂單狀態機</h3>
        <p style={pStyle}>Orders.status 值流轉：</p>
        <pre style={{ ...pStyle, ...codeStyle, padding: 12, overflow: 'auto' }}>
{`  pending       ← 下單、等付款
    ↓
  processing    ← 付款完成、準備出貨
    ↓
  shipped       ← 已出貨（填出貨單號）
    ↓
  delivered     ← 物流確認已送達
    ↓
  completed     ← 訂單完成（鎖定，不可再改）

  分支：cancelled / refunded / returned （任何階段可到）`}
        </pre>

        <h3 style={h3Style}>庫存扣減規則</h3>
        <ul style={ulStyle}>
          <li>
            <strong>下單時原子扣減</strong>（Orders.beforeChange 驗庫存並扣），庫存不足直接 throw、訂單不會成立。
          </li>
          <li>
            <strong>退貨時不自動加回</strong>：需 admin 手動調整，避免退貨商品有瑕疵誤上架。
          </li>
          <li>
            SQLite 環境限定單進程才安全；如果將來換 Postgres 需配合 FOR UPDATE 防併發。
          </li>
        </ul>

        <h3 style={h3Style}>退貨 / 退款 / 換貨三連體</h3>
        <ul style={ulStyle}>
          <li>
            <strong>Returns</strong>（退貨申請）：記錄會員退貨意願、原因、照片，admin 審核通過後收貨確認。
          </li>
          <li>
            <strong>Refunds</strong>（退款執行）：Returns 審核通過後建立，串接金流退款或以購物金/儲值金形式退。
          </li>
          <li>
            <strong>Exchanges</strong>（換貨）：尺寸、款式換，不涉及金流；若新舊商品有價差會自動產生 Refund。
          </li>
        </ul>

        <h3 style={h3Style}>運送方式</h3>
        <p style={pStyle}>
          <strong>ShippingMethods</strong> collection 管每種運送方案（宅配、超商取貨、到辦公室取貨、
          新竹物流、面交自取等），含運費、免運門檻、適用地區。前台結帳頁依此顯示選項，
          <strong>GlobalSettings.shipping</strong> 則控「全站免運門檻」這類 cross-method 規則。
        </p>

        <h3 style={h3Style}>常見 admin 動作</h3>
        <ul style={ulStyle}>
          <li>訂單列表 → 篩選 <code style={codeStyle}>status=processing</code> → 批次列印出貨單。</li>
          <li>個別訂單 → 編輯 → 填 <code style={codeStyle}>trackingNumber</code> → 狀態改 shipped → 系統寄通知。</li>
          <li>遇到客訴 → 訂單 → 加 <code style={codeStyle}>internalNote</code>（內部備註，不對外）。</li>
        </ul>
      </>
    ),
  },

  // ══════════════════════════════════════════════════════════════════════
  // 11. 行銷 & CRM 自動化
  // ══════════════════════════════════════════════════════════════════════
  {
    title: '行銷 & CRM 自動化',
    body: (
      <>
        <h3 style={h3Style}>手動活動 vs 自動化流程</h3>
        <ul style={ulStyle}>
          <li>
            <strong>MarketingCampaigns</strong>：手動活動（雙 11、週年慶、新品發表）。設開始/結束時間、
            目標客群、優惠內容，到時自動啟用。
          </li>
          <li>
            <strong>AutomationJourneys</strong>：觸發式自動流程（新會員註冊後 7 日問候、棄購 24 小時提醒、
            購買後 14 日邀請評論）。<strong>AutomationLogs</strong> 記錄每次觸發結果。
          </li>
          <li>
            <strong>BirthdayCampaigns</strong>：生日專屬活動，自動在會員生日當月/當日發送。
          </li>
          <li>
            <strong>FestivalTemplates</strong>：節慶訊息模板（中秋、農曆年、情人節），搭配生日或分群活動用。
          </li>
        </ul>

        <h3 style={h3Style}>訊息與 A/B 測試</h3>
        <ul style={ulStyle}>
          <li>
            <strong>MessageTemplates</strong>：Email / SMS / LINE 訊息模板，支援變數插入（如
            <code style={codeStyle}>{'{{name}}'}</code>、<code style={codeStyle}>{'{{tierName}}'}</code>）。
          </li>
          <li>
            <strong>ABTests</strong>：一個活動可指定多個訊息版本（主旨 A/B、CTA 文字 A/B），
            系統自動分流並記錄開信率、點擊率。
          </li>
          <li>
            <strong>MarketingExecutionLogs</strong>：每次發送的稽核日誌（何時發、對誰發、用什麼模板、結果）。
          </li>
        </ul>

        <h3 style={h3Style}>會員分群</h3>
        <p style={pStyle}>
          <strong>MemberSegments</strong> 動態分群（沉睡客、高消費、新客、VIP 候選人）。分群規則走
          <strong>SegmentationSettings</strong>（權重、門檻、重算排程）。分群可當作活動的目標對象。
        </p>

        <h3 style={h3Style}>CRM 專屬 VIP 管家</h3>
        <ul style={ulStyle}>
          <li>
            <strong>ConciergeServiceRequests</strong>：T4 以上會員可發起專屬客服請求（穿搭建議、造型諮詢、
            特殊訂製）。admin 可在 users.vipOwner 指派專屬客服。
          </li>
          <li>
            <strong>CustomerServiceTickets</strong>：一般客服單（退換貨諮詢、發票問題、帳號問題）。
          </li>
          <li>
            <strong>CreditScoreHistory</strong>：每次信用分數變動記錄（退貨、棄單、客訴），供信用分系統追溯。
          </li>
        </ul>

        <h3 style={h3Style}>對應 global</h3>
        <p style={pStyle}>
          <strong>MarketingAutomationSettings</strong>：通道開關、A/B 樣本比例、個人化參數、節慶/生日
          統一設定；<strong>CRMSettings</strong>：信用分數權重、AI 客服、自動化流程、通知模板。
        </p>
      </>
    ),
  },

  // ══════════════════════════════════════════════════════════════════════
  // 12. 內容管理
  // ══════════════════════════════════════════════════════════════════════
  {
    title: '內容管理',
    body: (
      <>
        <h3 style={h3Style}>三種內容 collection</h3>
        <ul style={ulStyle}>
          <li>
            <strong>BlogPosts</strong>：部落格文章。用 Lexical 富文本編輯器，支援圖片上傳、
            標題層級、引用、程式碼區塊。Slug 決定前台 URL <code style={codeStyle}>/blog/&lt;slug&gt;</code>。
          </li>
          <li>
            <strong>Pages</strong>：自訂頁面，主要用於 About / FAQ / 政策頁。內容是 Lexical 富文本。
          </li>
          <li>
            <strong>UGCPosts</strong>：用戶產生內容（客戶穿搭分享、好評回饋）。前台使用者投稿後
            admin 審核上架。
          </li>
        </ul>

        <h3 style={h3Style}>內容型 globals（整站只有一份）</h3>
        <table style={tableStyle}>
          <thead>
            <tr>
              <th style={thStyle}>Global</th>
              <th style={thStyle}>用途</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td style={tdStyle}>HomepageSettings</td>
              <td style={tdStyle}>首頁 Hero、特色區塊、品牌故事、行銷 banner、熱銷推薦</td>
            </tr>
            <tr>
              <td style={tdStyle}>AboutPageSettings</td>
              <td style={tdStyle}>About 頁內容：品牌故事、團隊、里程碑</td>
            </tr>
            <tr>
              <td style={tdStyle}>FAQPageSettings</td>
              <td style={tdStyle}>FAQ 問答分類與條目</td>
            </tr>
            <tr>
              <td style={tdStyle}>PolicyPagesSettings</td>
              <td style={tdStyle}>服務條款、隱私權、退貨、會員條款 — 富文本</td>
            </tr>
            <tr>
              <td style={tdStyle}>NavigationSettings</td>
              <td style={tdStyle}>頁首導覽、頁尾連結結構</td>
            </tr>
          </tbody>
        </table>

        <h3 style={h3Style}>發布前預覽</h3>
        <p style={pStyle}>
          BlogPosts 與 Pages 都支援 <code style={codeStyle}>status=draft</code> 草稿狀態，
          改成 <code style={codeStyle}>published</code> 才對外可見。草稿 URL 可附
          <code style={codeStyle}>?draft=true</code> 預覽（需 admin 登入）。
        </p>

        <h3 style={h3Style}>媒體引用</h3>
        <p style={pStyle}>
          Lexical 編輯器內插圖透過「上傳」按鈕，會進到 Media collection。
          同一張圖可以被多篇文章引用；刪除 Media 時系統會警告有幾處引用。
        </p>
      </>
    ),
  },

  // ══════════════════════════════════════════════════════════════════════
  // 13. 遊戲系統
  // ══════════════════════════════════════════════════════════════════════
  {
    title: '遊戲系統',
    body: (
      <>
        <p style={pStyle}>
          前台 <code style={codeStyle}>/games</code> 提供多款小遊戲，玩贏可獲得點數或購物金。所有獎勵
          由 <strong>GameSettings</strong> global 控參數（免費次數、獎勵級距、徽章觸發條件）。
        </p>

        <h3 style={h3Style}>三個 collection</h3>
        <ul style={ulStyle}>
          <li>
            <strong>MiniGameRecords</strong>：每局小遊戲結果（用戶 ID、遊戲名、結果、獎勵、時間）。
            系統會自動把最近 10 筆同步到 <code style={codeStyle}>users.gameActivity.recentGames</code>。
          </li>
          <li>
            <strong>CardBattles</strong>：卡牌對戰（擬真 PvE 或 PvP）。記錄戰況、使用卡牌、結果。
          </li>
          <li>
            <strong>GameLeaderboard</strong>：排行榜快照，週/月/季三檔，週期結束時自動冒泡獎勵。
          </li>
        </ul>

        <h3 style={h3Style}>獎勵入帳流程</h3>
        <ol style={ulStyle}>
          <li>玩家完成遊戲 → 前端 POST 到 <code style={codeStyle}>/api/games/*</code>。</li>
          <li>Server 依 GameSettings 參數計算獎勵 → 寫 MiniGameRecords。</li>
          <li>
            同步呼叫點數/購物金 engine → 寫 <strong>PointsTransactions</strong> 並更新
            <code style={codeStyle}>users.points</code> / <code style={codeStyle}>shoppingCredit</code>。
          </li>
          <li>若是排行榜賽事，結算時再從 <strong>GameLeaderboard</strong> 結算額外獎勵。</li>
        </ol>

        <h3 style={h3Style}>admin 調參</h3>
        <p style={pStyle}>
          到 Globals → GameSettings 調各遊戲免費次數、獎勵倍率、排行榜週期、徽章成就條件。
          變更會立即生效（下一局就用新參數）。
        </p>
      </>
    ),
  },

  // ══════════════════════════════════════════════════════════════════════
  // 14. 發票 & 稅務
  // ══════════════════════════════════════════════════════════════════════
  {
    title: '發票 & 稅務',
    body: (
      <>
        <h3 style={h3Style}>流程概觀</h3>
        <ol style={ulStyle}>
          <li>訂單完成付款（status → processing）→ 系統依 <strong>InvoiceSettings.autoIssue</strong> 判斷是否自動開立。</li>
          <li>自動開立：呼叫綠界電子發票 API → 建立 <strong>Invoices</strong> 紀錄。</li>
          <li>Invoices 有 PDF 下載（<code style={codeStyle}>/api/invoices/[id]/pdf</code>）與個別明細。</li>
          <li>退貨/退款時 → 作廢發票 → 新 Invoices 紀錄（type=void）。</li>
        </ol>

        <h3 style={h3Style}>InvoiceSettings 關鍵欄位</h3>
        <ul style={ulStyle}>
          <li><strong>API 金鑰</strong>：綠界開的 MerchantID / HashKey / HashIV，填錯會開不出發票。</li>
          <li><strong>賣方資訊</strong>：統一編號、公司名、地址、電話，會印在發票上。</li>
          <li><strong>LOGO</strong>：電子發票上的 logo 圖（建議 PNG 透明背景）。</li>
          <li><strong>autoIssue</strong>：是否自動開立，建議 true（否則要 admin 手動一張一張開）。</li>
          <li><strong>testMode</strong>：開發/測試期開啟，走綠界測試環境；上線記得關掉。</li>
        </ul>

        <h3 style={h3Style}>三聯式發票</h3>
        <p style={pStyle}>
          會員若是公司戶，可在 Users → 公司發票資料（預設）填統一編號與發票抬頭，結帳時一鍵套用。
          多家公司代買的造型師 / 採購可在「其他發票資料（多筆）」自由新增。
        </p>

        <h3 style={h3Style}>對帳 / 檢核</h3>
        <p style={pStyle}>
          Invoices 集合有 <code style={codeStyle}>invoiceNumber</code>、
          <code style={codeStyle}>invoiceDate</code>、<code style={codeStyle}>totalAmount</code>、
          <code style={codeStyle}>taxAmount</code>、<code style={codeStyle}>buyerTaxId</code>，
          可匯出 XLSX 送會計月結；或直接用 <code style={codeStyle}>createdAt</code> 區間篩選後整批匯出。
        </p>
      </>
    ),
  },

  // ══════════════════════════════════════════════════════════════════════
  // 15. 常見問題排障
  // ══════════════════════════════════════════════════════════════════════
  {
    title: '常見問題排障',
    body: (
      <>
        <h3 style={h3Style}>登入 / 帳號</h3>
        <ul style={ulStyle}>
          <li>
            <strong>忘記密碼</strong>：前台 /forgot-password 填 email，系統會寄重設信；
            若 RESEND_API_KEY 未設定，token 會 log 到 server console（systemd journal / pm2 logs），
            客服手動發給使用者。
          </li>
          <li>
            <strong>登入失敗 10 次鎖 10 分鐘</strong>：Payload 內建暴力破解防護。使用者只要等 10 分鐘
            就會自動解鎖；admin 若要立即解鎖，從 <code style={codeStyle}>users</code> 集合把該使用者的
            <code style={codeStyle}>loginAttempts</code> 歸零即可。
          </li>
          <li>
            <strong>後台右上頭像破圖</strong>：使用者的 avatar media 檔案掛了。
            編輯該使用者 → 基本資料 → 清空「頭像」欄位並重存。
            系統已加 validation 阻擋無效 media ref（Users.avatar.beforeValidate hook），清完重上傳即可。
          </li>
        </ul>

        <h3 style={h3Style}>商品 / 庫存</h3>
        <ul style={ulStyle}>
          <li>
            <strong>庫存顯示跟實際不同</strong>：商品列表頂部「<strong>🔄 全站快取重新生成</strong>」按下去，
            前台會立刻重讀資料庫最新狀態。
          </li>
          <li>
            <strong>商品圖上傳失敗</strong>：檢查檔案（1）小於 8 MB、（2）格式是 jpeg/png/webp/gif、
            （3）檔名不含 / 或 ..。SVG 被禁用（XSS 風險）。
          </li>
          <li>
            <strong>下單庫存不足</strong>：系統會 throw、訂單不會成立，這是正確行為。admin 要增加庫存
            或客戶要換商品才能成單。
          </li>
        </ul>

        <h3 style={h3Style}>會員 / 點數</h3>
        <ul style={ulStyle}>
          <li>
            <strong>點數沒進帳</strong>：查 <strong>PointsTransactions</strong> 集合、用
            <code style={codeStyle}>user</code> 欄位篩選。若沒紀錄代表規則沒觸發（訂單還沒到
            processing 狀態、或活動沒在有效期內）。
          </li>
          <li>
            <strong>等級沒升等</strong>：升等依 <code style={codeStyle}>lifetimeSpend</code>，
            而 lifetimeSpend 是訂單狀態到 completed 才累計。若訂單卡在 processing/shipped，
            消費金額不會進 lifetimeSpend。
          </li>
          <li>
            <strong>前台稱號是「男/女版哪一個」</strong>：依 <code style={codeStyle}>users.gender</code>。
            男性且 tier 有 <code style={codeStyle}>frontNameMale</code> 就顯示男版；
            其他情況 fallback 到 <code style={codeStyle}>frontName</code>。
          </li>
        </ul>

        <h3 style={h3Style}>訂單 / 發票</h3>
        <ul style={ulStyle}>
          <li>
            <strong>開不出發票</strong>：InvoiceSettings → API 金鑰填錯或 testMode 忘了關；
            看 Invoices 該筆的 <code style={codeStyle}>errorMessage</code> 欄位，綠界會回傳錯誤碼。
          </li>
          <li>
            <strong>訂單重複扣庫存</strong>：目前庫存扣減在 Orders.beforeChange，pending→processing 轉換不會再扣。
            若發現重複扣，優先檢查是否重跑了 seed 或誤按復建。
          </li>
        </ul>

        <h3 style={h3Style}>緊急聯絡</h3>
        <p style={pStyle}>
          遇到此頁沒涵蓋的問題，請附上（1）操作步驟截圖、（2）瀏覽器 console 截圖（F12 → Console）、
          （3）訂單 / 使用者 ID，發給技術支援。
        </p>
      </>
    ),
  },
]

const HelpView: React.FC<AdminViewServerProps> = ({
  initPageResult,
  params,
  searchParams,
}) => {
  return (
    <DefaultTemplate
      i18n={initPageResult.req.i18n}
      locale={initPageResult.locale}
      params={params}
      payload={initPageResult.req.payload}
      permissions={initPageResult.permissions}
      searchParams={searchParams}
      user={initPageResult.req.user || undefined}
      visibleEntities={initPageResult.visibleEntities}
    >
      <div style={{ maxWidth: 1200, margin: '0 auto', padding: '24px 32px' }}>
        <h1 style={{ fontSize: 28, fontWeight: 700, margin: 0, marginBottom: 8 }}>
          📖 後台使用說明
        </h1>
        <p style={{ ...pStyle, marginBottom: 24, color: 'var(--theme-elevation-600, #666)' }}>
          集中所有「怎麼用」的操作指引與網站架構地圖。若找不到想要的功能說明，請聯絡技術支援。
        </p>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 260px', gap: 24 }}>
          <main>
            {blocks.map((b, i) => (
              <section key={i} id={`section-${i}`} style={cardStyle}>
                <h2 style={h2Style}>
                  {i + 1}. {b.title}
                </h2>
                {b.body}
              </section>
            ))}
          </main>
          <aside>
            <nav style={tocStyle}>
              <div style={{ fontWeight: 600, marginBottom: 8, fontSize: 12, color: 'var(--theme-elevation-500, #888)' }}>
                目錄
              </div>
              {blocks.map((b, i) => (
                <div key={i}>
                  <a
                    href={`#section-${i}`}
                    style={{ color: 'var(--theme-elevation-800, #222)', textDecoration: 'none' }}
                  >
                    {i + 1}. {b.title}
                  </a>
                </div>
              ))}
            </nav>
          </aside>
        </div>
      </div>
    </DefaultTemplate>
  )
}

export default HelpView
