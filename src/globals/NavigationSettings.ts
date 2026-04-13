import type { GlobalConfig } from 'payload'

import { isAdmin } from '../access/isAdmin'

/**
 * 導覽設定 Global
 * ────────────────
 * 管理公告橫幅、主選單結構、頁尾連結等全站導覽元素
 */
export const NavigationSettings: GlobalConfig = {
  slug: 'navigation-settings',
  label: '導覽設定',
  admin: {
    group: '頁面管理',
    description: '管理公告橫幅、主選單連結',
  },
  access: {
    read: () => true,
    update: isAdmin,
  },
  fields: [
    // ── 公告橫幅 ──
    {
      name: 'announcementBar',
      label: '公告橫幅',
      type: 'group',
      admin: { description: '網站頂端的公告條，可用於促銷訊息、免運提醒等' },
      fields: [
        { name: 'enabled', label: '啟用公告橫幅', type: 'checkbox', defaultValue: true },
        { name: 'text', label: '公告文字', type: 'text', defaultValue: '全館滿 $1,000 免運費 ♥ 新會員註冊即享 9 折' },
        { name: 'link', label: '連結網址（可選）', type: 'text', admin: { description: '點擊公告後導向的頁面，留空則不可點擊' } },
        {
          name: 'style',
          label: '樣式',
          type: 'select',
          defaultValue: 'default',
          options: [
            { label: '預設（品牌金）', value: 'default' },
            { label: '節慶（紅色）', value: 'festive' },
            { label: '促銷（深色）', value: 'promo' },
          ],
        },
      ],
    },

    // ── 主選單 ──
    {
      name: 'mainMenu',
      label: '主選單',
      type: 'array',
      maxRows: 10,
      admin: { description: 'Navbar 上方的主要導覽連結' },
      fields: [
        { name: 'label', label: '名稱', type: 'text', required: true },
        { name: 'href', label: '連結', type: 'text', required: true },
        {
          name: 'children',
          label: '子選單',
          type: 'array',
          maxRows: 12,
          admin: { description: '下拉式子選單項目（可選）' },
          fields: [
            { name: 'label', label: '名稱', type: 'text', required: true },
            { name: 'href', label: '連結', type: 'text', required: true },
          ],
        },
      ],
    },

    // ── 頁尾連結 ──
    {
      name: 'footerSections',
      label: '頁尾連結區塊',
      type: 'array',
      maxRows: 4,
      admin: { description: '頁尾的連結分類區塊' },
      fields: [
        { name: 'title', label: '區塊標題', type: 'text', required: true },
        {
          name: 'links',
          label: '連結項目',
          type: 'array',
          maxRows: 12,
          fields: [
            { name: 'label', label: '名稱', type: 'text', required: true },
            { name: 'href', label: '連結', type: 'text', required: true },
          ],
        },
      ],
    },
  ],
}
