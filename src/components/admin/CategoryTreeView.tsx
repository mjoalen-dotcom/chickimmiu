import React from 'react'
import type { ListViewServerProps } from 'payload'
import CategoryTreeClient from './CategoryTreeClient'

/**
 * CategoryTreeView — 取代 /admin/collections/categories 預設 list view。
 * ───────────────────────────────────────────────────────────────────────
 * Shopline 風格樹狀分類管理：直接在原「Categories」列表頁以拖曳樹取代表格。
 *
 * 登入的 /admin 側邊 Categories 連結仍然帶到此頁；管理員不用學新 URL。
 * 非 admin 進來顯示擋截訊息（沒 write 權限就沒拖曳/刪除的意義）。
 *
 * 注意：Payload v3 會自動把 collection list view 外層包 DefaultTemplate，
 * 本 view 只要回傳主內容即可（不要再 import 一個 DefaultTemplate）。
 */
const CategoryTreeView: React.FC<ListViewServerProps> = ({ user }) => {
  const isAdmin = Boolean(user && (user as { role?: string }).role === 'admin')

  return (
    <div style={{ maxWidth: 1280, margin: '0 auto', padding: '24px 32px' }}>
      <h1 style={{ fontSize: 28, fontWeight: 700, margin: 0, marginBottom: 4 }}>
        🌳 分類管理
      </h1>
      <p
        style={{
          margin: 0,
          marginBottom: 24,
          color: 'var(--theme-elevation-600, #666)',
          fontSize: 14,
        }}
      >
        拖曳式分類管理：直接拖列到另一列「之前」＝同層排序；拖到另一列「之內」＝變子分類（最深 3 層）。
        每列右側可快速切換啟用、前台查閱、編輯欄位、刪除。
      </p>
      {isAdmin ? (
        <CategoryTreeClient />
      ) : (
        <p style={{ fontSize: 14, color: 'var(--theme-elevation-600, #666)' }}>
          僅 admin 角色可以管理分類樹。
        </p>
      )}
    </div>
  )
}

export default CategoryTreeView
