import React from 'react'

/**
 * ProductsUsageNotice
 * ───────────────────
 * 顯示在「② 商品管理 → 商品」列表頁最上方的使用說明卡片。
 * 對照本頁 beforeListTable 載入的 6 個工具，告訴 admin 各做什麼、
 * 何時該用哪一個，並指引到 /admin/help 看完整指南。
 *
 * 注意：標題文字與 emoji 必須與各 panel 自家標題一致，
 * 否則 admin 找不到對應 panel。標題對照來源：
 *   - ProductBulkActions.tsx        ⚡ 批次操作
 *   - ShoplineXlsxImporter.tsx      📥 SHOPLINE BulkUpdateForm 匯入（.xlsx）
 *   - SinsangImporter.tsx           📦 從 Sinsang Market 匯入
 *   - ShoplineImportPanel.tsx       📦 Shopline 商品匯入
 *   - ImageMigrationPanel.tsx       🖼️ 商品圖片遷移
 *   - ImportExportButtons.tsx       匯出 / 匯入 CSV·Excel（無 wrapper title）
 */
const cardStyle: React.CSSProperties = {
  border: '1px solid var(--theme-elevation-150, #e4e4e7)',
  borderRadius: 8,
  padding: 16,
  marginBottom: 16,
  background: 'var(--theme-elevation-50, #fafafa)',
}

const rowStyle: React.CSSProperties = {
  display: 'grid',
  gridTemplateColumns: '200px 1fr',
  gap: 8,
  padding: '6px 0',
  fontSize: 13,
  lineHeight: 1.6,
  borderBottom: '1px dashed var(--theme-elevation-100, #f0f0f0)',
}

const labelStyle: React.CSSProperties = {
  color: 'var(--theme-elevation-500, #666)',
  fontWeight: 500,
  whiteSpace: 'nowrap',
}

const linkStyle: React.CSSProperties = {
  color: 'var(--theme-success-500, #16a34a)',
  textDecoration: 'underline',
  fontWeight: 500,
}

const ProductsUsageNotice: React.FC = () => {
  return (
    <details style={cardStyle} open>
      <summary
        style={{
          cursor: 'pointer',
          fontSize: 14,
          fontWeight: 600,
          marginBottom: 12,
          listStyle: 'revert',
        }}
      >
        📖 商品列表使用說明（點擊收合）
      </summary>

      <p style={{ fontSize: 13, color: 'var(--theme-elevation-700, #333)', margin: '8px 0 12px 0', lineHeight: 1.6 }}>
        本頁是 CHIC KIM &amp; MIU 商品總管。下方 6 個工具按用途排序，
        日常修改商品請直接捲到底下表格；批次與匯入工作則用上方面板。
        完整圖文教學請看左側「<strong>⓪ 數據儀表 → 使用說明</strong>」或{' '}
        <a href="/admin/help" style={linkStyle}>/admin/help</a>。
      </p>

      <div style={rowStyle}>
        <div style={labelStyle}>⚡ 批次操作</div>
        <div>
          全選商品一鍵刪除、把所有 <code>draft</code> 轉 <code>published</code>、
          把「已上架但庫存 0」批次下架、全站快取重新生成。
          刪除為硬刪除不可復原，僅 <strong>admin</strong> 角色可用。
        </div>
      </div>

      <div style={rowStyle}>
        <div style={labelStyle}>📥 SHOPLINE BulkUpdateForm</div>
        <div>
          直接拖入 SHOPLINE 後台「商品管理 → 批量更新」匯出的{' '}
          <code>BulkUpdateForm.xlsx</code>，自動跳過繁中說明列、依
          <code>Product ID</code> 分組變體並解析「顏色 + 尺寸」。先按
          <strong>預覽</strong> 跑 dry-run，確認無誤再按 <strong>確認匯入</strong>。
        </div>
      </div>

      <div style={rowStyle}>
        <div style={labelStyle}>📦 從 Sinsang Market 匯入</div>
        <div>
          貼一個 Sinsang Market 商品 URL，系統抓取 韓元原價 → 套用換算係數
          自動帶出建議 TWD 售價，並建立內部採購欄位（賣場、攤位、
          原文標題、材質）。適合上游選品的單一商品快速建檔。
        </div>
      </div>

      <div style={rowStyle}>
        <div style={labelStyle}>📦 Shopline 商品匯入</div>
        <div>
          Shopline 一般 CSV/批量匯入流程（與 BulkUpdateForm 不同）。
          支援單筆貼入或批量檔，匯入過程顯示進度條、成功後自動 reload 列表。
          適合從 Shopline 搬家或一次倒入大量新品。
        </div>
      </div>

      <div style={rowStyle}>
        <div style={labelStyle}>🖼️ 商品圖片遷移</div>
        <div>
          掃描現有商品 <code>images</code> 欄位，把外部 URL（Shopline / Sinsang
          原圖等）下載到 Media、並把欄位轉為 Media reference。
          搬完後圖片走 R2 + Next.js image cache，前台速度大幅提升。
        </div>
      </div>

      <div style={rowStyle}>
        <div style={labelStyle}>📤 匯出 / 匯入 CSV·Excel</div>
        <div>
          通用版匯入匯出（不綁特定平台）。匯出包含 15 欄：商品名稱、
          網址代碼、SKU、品牌、原價、特價、庫存、狀態、新品、熱銷、重量、
          材質、原產地、變體（JSON）、標籤（JSON）。匯入以
          <strong>網址代碼（slug）</strong>為 key — 已存在就更新、不存在就新增。
        </div>
      </div>

      <div style={{ ...rowStyle, borderBottom: 'none' }}>
        <div style={labelStyle}>常用底層欄位</div>
        <div>
          底下表格預設欄位：商品名稱 / 原價 / 特價 / 庫存 / 低庫存標記 /
          狀態 / 熱銷 / 新品 / 最後更新。可用上方搜尋框搜尋
          <strong>商品名稱、網址代碼、商品總 SKU</strong>。
        </div>
      </div>
    </details>
  )
}

export default ProductsUsageNotice
