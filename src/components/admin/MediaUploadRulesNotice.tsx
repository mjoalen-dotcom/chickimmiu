import React from 'react'

/**
 * MediaUploadRulesNotice
 * ──────────────────────
 * 顯示在 Media 單筆編輯 / 新增頁面最上方的說明卡片，
 * 讓使用者在上傳前就看到大小上限、支援格式、資料夾命名建議。
 *
 * 對應後端驗證：src/collections/Media.ts beforeChange hook
 *   - 圖片 8 MB / 影片 50 MB / PDF 10 MB
 *   - jpeg / png / webp / gif / mp4 / pdf 白名單
 *   - 檔名禁 `/`、`\`、`..`（路徑穿越防禦）
 */
const rowStyle: React.CSSProperties = {
  display: 'grid',
  gridTemplateColumns: '140px 1fr',
  gap: 8,
  padding: '4px 0',
  fontSize: 13,
}

const labelStyle: React.CSSProperties = {
  color: 'var(--theme-elevation-500, #666)',
  fontWeight: 500,
}

const MediaUploadRulesNotice: React.FC = () => {
  return (
    <div
      style={{
        border: '1px solid var(--theme-elevation-150, #e4e4e7)',
        borderRadius: 8,
        padding: 16,
        marginBottom: 16,
        background: 'var(--theme-elevation-50, #fafafa)',
      }}
    >
      <h4 style={{ margin: 0, marginBottom: 12, fontSize: 14, fontWeight: 600 }}>
        📋 上傳規則
      </h4>

      <div style={rowStyle}>
        <div style={labelStyle}>檔案大小上限</div>
        <div>
          <strong>圖片 8 MB</strong>（jpeg / png / webp / gif）｜
          <strong>影片 50 MB</strong>（mp4）｜
          <strong>PDF 10 MB</strong>
        </div>
      </div>

      <div style={rowStyle}>
        <div style={labelStyle}>檔名限制</div>
        <div>禁用 <code>/</code>、<code>\</code>、<code>..</code> 等路徑字元</div>
      </div>

      <div style={rowStyle}>
        <div style={labelStyle}>超過上限怎麼辦？</div>
        <div>
          先壓縮：
          <a
            href="https://squoosh.app"
            target="_blank"
            rel="noopener noreferrer"
            style={{ color: 'var(--theme-success-500, #16a34a)', marginLeft: 4 }}
          >
            Squoosh
          </a>
          （圖片）或
          <a
            href="https://handbrake.fr"
            target="_blank"
            rel="noopener noreferrer"
            style={{ color: 'var(--theme-success-500, #16a34a)', marginLeft: 4 }}
          >
            HandBrake
          </a>
          （影片）都可免費轉檔。建議商品圖輸出 webp 或 jpeg 約 300–800 KB。
        </div>
      </div>

      <div style={rowStyle}>
        <div style={labelStyle}>相簿 / 資料夾</div>
        <div>
          填入「相簿 / 資料夾名稱」欄位可在列表頁搜尋分組；建議用
          <strong>商品貨號</strong>、
          <strong>活動名稱</strong>或
          <strong>用途分類</strong>（banner / lookbook / ugc）。
          完整建議請見「後台使用說明」。
        </div>
      </div>
    </div>
  )
}

export default MediaUploadRulesNotice
