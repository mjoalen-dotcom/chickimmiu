import type { GlobalConfig } from 'payload'
import { isAdmin } from '../access/isAdmin'
import { safeRevalidate } from '../lib/revalidate'

/**
 * 結帳設定 Global（slug: checkout-settings）
 * ─────────────────────────────────────────
 * 封測期對齊 Shopline「結帳設定」。控制：
 *   - TOS / 行銷同意勾選
 *   - 客戶資料欄位必填或隱藏
 *   - 是否允許訪客結帳
 *   - 最低消費 / 單筆件數上限
 *   - 訂單備註欄位顯示 / 長度
 *
 * 不動 Orders / Products 既有欄位；只是前端讀這個 config 決定 checkout UI 的表現。
 */
export const CheckoutSettings: GlobalConfig = {
  slug: 'checkout-settings',
  label: '結帳設定',
  admin: {
    group: '訂單管理',
    description: '結帳頁表單必填欄位、最低消費、備註欄設定',
  },
  access: {
    read: () => true,
    update: isAdmin,
  },
  hooks: {
    afterChange: [() => safeRevalidate(['/checkout', '/cart'], ['checkout-settings'])],
  },
  fields: [
    // ── 條款 / 行銷同意 ──
    {
      name: 'requireTos',
      label: '強制勾選同意服務條款',
      type: 'checkbox',
      defaultValue: true,
      admin: { description: '取消勾選則 checkout 不出現 TOS checkbox；建議保持開啟' },
    },
    {
      name: 'tosLinkText',
      label: 'TOS 同意 checkbox 文字',
      type: 'text',
      defaultValue: '同意服務條款與隱私權政策',
    },
    {
      name: 'requireMarketingConsent',
      label: '強制勾選接收行銷訊息',
      type: 'checkbox',
      defaultValue: false,
      admin: { description: '啟用後結帳時 marketing opt-in 變必勾，否則無法提交訂單' },
    },
    {
      name: 'marketingConsentText',
      label: '行銷同意 checkbox 文字',
      type: 'text',
      defaultValue: '我願意收到 CHIC KIM & MIU 最新活動與優惠資訊',
    },
    // ── 欄位必填規則 ──
    {
      name: 'fieldRequirements',
      label: '客戶資料欄位必填規則',
      type: 'group',
      admin: { description: '控制結帳 / 註冊時哪些欄位必填' },
      fields: [
        { name: 'phoneRequired', label: '聯絡電話必填', type: 'checkbox', defaultValue: true },
        { name: 'birthdayRequired', label: '生日必填', type: 'checkbox', defaultValue: false },
        {
          name: 'nationalIdRequired',
          label: '身分證字號必填',
          type: 'checkbox',
          defaultValue: false,
          admin: { description: '個人戶發票才需要；一般情況關閉' },
        },
        { name: 'genderRequired', label: '性別必填', type: 'checkbox', defaultValue: false },
      ],
    },
    // ── 訪客結帳 / 數量限制 ──
    {
      name: 'checkoutAsGuest',
      label: '允許訪客（非會員）結帳',
      type: 'checkbox',
      defaultValue: true,
      admin: { description: '關閉後結帳頁只允許已登入會員完成下單' },
    },
    {
      name: 'minOrderAmount',
      label: '最低消費金額（TWD）',
      type: 'number',
      defaultValue: 0,
      min: 0,
      admin: { description: '0 = 不限制；大於 0 時，未達金額結帳送出時阻擋' },
    },
    {
      name: 'maxItemsPerOrder',
      label: '單筆訂單最大商品件數',
      type: 'number',
      defaultValue: 99,
      min: 1,
      admin: { description: '含變體與加購；單張訂單的 items[].quantity 總和上限' },
    },
    // ── 訂單備註 ──
    {
      name: 'notes',
      label: '訂單備註欄位',
      type: 'group',
      fields: [
        { name: 'allowOrderNote', label: '顯示訂單備註欄位', type: 'checkbox', defaultValue: true },
        {
          name: 'orderNoteLabel',
          label: '備註欄標籤文字',
          type: 'text',
          defaultValue: '給賣家的備註',
        },
        {
          name: 'orderNoteMaxLength',
          label: '備註欄字數上限',
          type: 'number',
          defaultValue: 200,
          min: 1,
        },
      ],
    },
  ],
}
