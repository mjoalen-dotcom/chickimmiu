import React from 'react'
import { DefaultTemplate } from '@payloadcms/next/templates'
import type { AdminViewServerProps } from 'payload'

/**
 * HelpView — /admin/help
 * ─────────────────────
 * 後台使用說明頁，集中所有「怎麼用」的操作指引：
 *   1. 媒體上傳規則（檔案大小 / 格式 / 檔名）
 *   2. 商品圖整批上傳約定（資料夾命名 + 流水號）
 *   3. 商品列表批次操作（全選刪除 / 批次上架 / 匯入匯出）
 *   4. XLSX 匯入匯出格式
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

const blocks: Block[] = [
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
        <p style={pStyle}>
          建議先做無損壓縮：
        </p>
        <ul style={{ ...pStyle, paddingLeft: 24 }}>
          <li>
            圖片：
            <a href="https://squoosh.app" target="_blank" rel="noopener noreferrer">Squoosh</a>
            （免費網頁版）— 商品圖建議輸出 webp 或 jpeg 約 <strong>300–800 KB</strong>，
            寬度 1600 px 即可支援 desktop 4 種圖檔尺寸（thumbnail / card / tablet / desktop）。
          </li>
          <li>
            影片：
            <a href="https://handbrake.fr" target="_blank" rel="noopener noreferrer">HandBrake</a>
            （免費開源）— 建議輸出 H.264 mp4，1080p 以內，位元率 2–4 Mbps。
          </li>
          <li>PDF：如果是多頁文件可用 <code style={codeStyle}>pdftk</code> 或線上工具拆檔。</li>
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
        <ol style={{ ...pStyle, paddingLeft: 24 }}>
          <li>在電腦準備好以商品貨號命名的資料夾，裡面圖片依 <code style={codeStyle}>01-…</code>、<code style={codeStyle}>02-…</code> 命名。</li>
          <li>到「後台 → 工具 → 商品圖整批上傳」頁面（待開發）。</li>
          <li>把整個資料夾拖到網頁視窗；系統會顯示「找到 N 個資料夾 / M 張圖 / 對應 K 個商品 / 有 L 個貨號找不到商品」的預覽。</li>
          <li>確認無誤後按「開始上傳」；上傳完成後會自動把圖片依檔名順序寫入 <code style={codeStyle}>products.images</code>。</li>
        </ol>
      </>
    ),
  },
  {
    title: '商品列表批次操作',
    body: (
      <>
        <h3 style={h3Style}>全選一鍵刪除</h3>
        <p style={pStyle}>
          到「商品管理 → 商品」列表頁：
        </p>
        <ol style={{ ...pStyle, paddingLeft: 24 }}>
          <li>
            勾選列表最上方表頭的 checkbox（也可以先用上方搜尋條件過濾出特定商品再全選）。
          </li>
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
        <p style={pStyle}>
          列表頁上方「<strong>⚡ 批次操作</strong>」面板提供三個一鍵動作：
        </p>
        <ul style={{ ...pStyle, paddingLeft: 24 }}>
          <li>
            <strong>✅ 批次上架所有草稿</strong>：把 <code style={codeStyle}>status=draft</code> 的商品全部轉為
            <code style={codeStyle}>published</code>（二次確認）。
          </li>
          <li>
            <strong>📦 將「已上架但庫存 0」設為下架</strong>：避免客戶下單後才發現缺貨。
          </li>
          <li>
            <strong>🔄 全站快取重新生成</strong>：需要讓前台立刻反映後台修改時使用。
          </li>
        </ul>

        <h3 style={h3Style}>XLSX / CSV 匯入匯出</h3>
        <p style={pStyle}>
          列表上方另有「匯出 CSV / 匯出 Excel / 匯入 CSV·Excel」按鈕，適合大量修改：
        </p>
        <ol style={{ ...pStyle, paddingLeft: 24 }}>
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
  {
    title: '權限與角色',
    body: (
      <>
        <p style={pStyle}>
          系統區分三種角色：
        </p>
        <ul style={{ ...pStyle, paddingLeft: 24 }}>
          <li>
            <strong>admin</strong>：完整後台權限，可刪除商品、管理會員、改全站設定。
          </li>
          <li>
            <strong>staff</strong>：僅能讀寫內容（商品、文章、媒體），不能刪商品也不能改全站設定。
          </li>
          <li>
            <strong>customer</strong>：前台使用者，僅能讀自己資料 + 寫 UGC / 評論 / 頭像。
          </li>
        </ul>
        <p style={pStyle}>
          如果操作時出現「<em>權限不足</em>」或「<em>Forbidden</em>」，請跟 admin 確認帳號角色。
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
          集中所有「怎麼用」的操作指引。若找不到想要的功能說明，請聯絡技術支援。
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
