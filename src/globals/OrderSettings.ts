import type { GlobalConfig } from 'payload'
import { isAdmin } from '../access/isAdmin'
import { safeRevalidate } from '../lib/revalidate'

/**
 * 訂單設定 Global（slug: order-settings）
 * ─────────────────────────────────────
 * 封測期對齊 Shopline「訂單設定」。控制：
 *   - 訂單編號規則（prefix / 日期格式 / 流水號位數 / 每日重置）
 *   - 自動取消未付款訂單
 *   - 自動完成已配送訂單
 *   - 出貨 / 新單通知 email 開關 + admin 通知收件人
 *   - 訂單狀態流（processing / ready_for_pickup / 自訂狀態）
 *
 * Orders.ts 的 beforeChange hook 讀 `numbering.*` 自動產生 `orderNumber`。
 * cron `/api/cron/auto-cancel-orders` 讀 `autoActions.autoCancelUnpaidMinutes`。
 */
export const OrderSettings: GlobalConfig = {
  slug: 'order-settings',
  label: '訂單設定',
  admin: {
    group: '① 訂單與物流',
    description: '訂單編號規則、自動取消 / 完成、通知信、狀態流',
  },
  access: {
    read: () => true,
    update: isAdmin,
  },
  hooks: {
    afterChange: [() => safeRevalidate([], ['order-settings'])],
  },
  fields: [
    // ── 訂單編號規則 ──
    {
      name: 'numbering',
      label: '訂單編號規則',
      type: 'group',
      admin: {
        description:
          '例：prefix=CKMU、includeDate=yes、sequenceDigits=3 → CKMU20260421001。改設定僅影響「改設定之後」的新訂單；既有訂單不動。',
      },
      fields: [
        { name: 'prefix', label: '訂單編號前綴', type: 'text', defaultValue: 'CKMU' },
        {
          name: 'includeDate',
          label: '編號中包含日期（YYYYMMDD）',
          type: 'checkbox',
          defaultValue: true,
        },
        {
          name: 'sequenceDigits',
          label: '流水號位數',
          type: 'number',
          defaultValue: 3,
          min: 1,
          max: 10,
          admin: { description: '3 → 001~999；4 → 0001~9999' },
        },
        {
          name: 'sequenceResetDaily',
          label: '每日流水號歸零',
          type: 'checkbox',
          defaultValue: true,
          admin: { description: 'includeDate=yes 時生效；每天從 001 重新起算' },
        },
      ],
    },
    // ── 自動動作 ──
    {
      name: 'autoActions',
      label: '自動化動作',
      type: 'group',
      fields: [
        {
          name: 'autoCancelUnpaidMinutes',
          label: '未付款自動取消（分鐘）',
          type: 'number',
          defaultValue: 60,
          min: 0,
          admin: {
            description:
              '0 = 不自動取消；其他正整數 = 下單後 N 分鐘仍未付款則系統自動取消。由 /api/cron/auto-cancel-orders 定時掃。',
          },
        },
        {
          name: 'autoCompleteAfterDelivery',
          label: '出貨後自動標完成',
          type: 'checkbox',
          defaultValue: false,
        },
        {
          name: 'autoCompleteAfterDays',
          label: '出貨後 N 天自動標完成',
          type: 'number',
          defaultValue: 7,
          min: 1,
          admin: { description: 'autoCompleteAfterDelivery=yes 時生效' },
        },
      ],
    },
    // ── 通知 ──
    {
      name: 'notifications',
      label: '通知信開關',
      type: 'group',
      fields: [
        {
          name: 'sendConfirmationEmail',
          label: '訂單確認信（寄給顧客）',
          type: 'checkbox',
          defaultValue: true,
        },
        {
          name: 'sendShippedEmail',
          label: '出貨通知信（寄給顧客）',
          type: 'checkbox',
          defaultValue: true,
        },
        {
          name: 'sendDeliveredEmail',
          label: '送達通知信（寄給顧客）',
          type: 'checkbox',
          defaultValue: true,
        },
        {
          name: 'sendAdminNewOrderAlert',
          label: '新訂單 admin 通知信',
          type: 'checkbox',
          defaultValue: true,
        },
        {
          name: 'adminAlertEmails',
          label: 'admin 通知收件人',
          type: 'array',
          admin: {
            description: 'sendAdminNewOrderAlert=yes 時，新單成立時寄到這些信箱',
          },
          fields: [{ name: 'email', label: 'Email', type: 'text', required: true }],
        },
      ],
    },
    // ── 超商託運（ECPay C2C 發號） ──
    {
      name: 'cvsShipping',
      label: '超商託運寄件人',
      type: 'group',
      admin: {
        description:
          '批次出貨「超商發號」用：綠界 /Express/Create 託運單上的寄件人。手機必填（09 開頭 10 碼），沒填不能發號。',
      },
      fields: [
        {
          name: 'senderName',
          label: '寄件人名稱',
          type: 'text',
          defaultValue: '靚秀國際',
          admin: { description: '印在託運單上；避免特殊符號，最長 10 字' },
        },
        {
          name: 'senderCellPhone',
          label: '寄件人手機',
          type: 'text',
          admin: { description: '09 開頭 10 碼，門市/物流聯絡寄件人用' },
        },
        {
          name: 'returnStoreId',
          label: '7-ELEVEN 退貨門市代號',
          type: 'text',
          admin: {
            description:
              '包裹退貨時退到這間 7-11 門市（6 碼店號）。只有 7-ELEVEN C2C 支援；' +
              '全家/萊爾富一律退回原寄件門市。留空 = 退回原寄件門市。',
          },
        },
      ],
    },
    // ── 宅配託運（綠界 HOME：黑貓/中華郵政）──
    {
      name: 'homeShipping',
      label: '宅配託運寄件人（黑貓/郵政）',
      type: 'group',
      admin: {
        description:
          '批次出貨「宅配發號」用：綠界 /Express/Create（HOME）託運單寄件人。' +
          '宅配規格要求姓名 4~10 字元（2 個中文字即可）、地址含郵遞區號必填。' +
          '新竹物流綠界不支援，維持人工填單號。逆物流（ReturnHome）收件人也用這組。',
      },
      fields: [
        {
          name: 'senderName',
          label: '寄件人名稱',
          type: 'text',
          admin: { description: '4~10 字元（中文以 2 字元計），不可含數字與特殊符號' },
        },
        {
          name: 'senderCellPhone',
          label: '寄件人手機',
          type: 'text',
          admin: { description: '09 開頭 10 碼' },
        },
        {
          name: 'senderZipCode',
          label: '寄件郵遞區號',
          type: 'text',
          admin: { description: '3 或 5 碼' },
        },
        {
          name: 'senderAddress',
          label: '寄件地址',
          type: 'text',
          admin: { description: '6~60 字，黑貓要求完整地址（含縣市區）' },
        },
        {
          name: 'temperature',
          label: '溫層',
          type: 'select',
          defaultValue: '0001',
          options: [
            { label: '常溫', value: '0001' },
            { label: '冷藏', value: '0002' },
            { label: '冷凍', value: '0003' },
          ],
          admin: { description: '黑貓用；郵政一律常溫。冷藏/冷凍不可用 150cm 規格' },
        },
        {
          name: 'specification',
          label: '包裹規格',
          type: 'select',
          defaultValue: '0001',
          options: [
            { label: '60cm', value: '0001' },
            { label: '90cm', value: '0002' },
            { label: '120cm', value: '0003' },
            { label: '150cm', value: '0004' },
          ],
        },
        {
          name: 'defaultGoodsWeight',
          label: '預設包裹重量（公斤）',
          type: 'number',
          defaultValue: 1,
          admin: { description: '中華郵政必填重量（上限 20kg）；黑貓不用' },
        },
      ],
    },
    // ── 狀態流設定 ──
    {
      name: 'statusFlow',
      label: '訂單狀態流',
      type: 'group',
      fields: [
        {
          name: 'enableProcessing',
          label: '啟用「處理中」狀態',
          type: 'checkbox',
          defaultValue: true,
        },
        {
          name: 'autoStatusFromLogistics',
          label: '物流貨態自動流轉訂單狀態',
          type: 'checkbox',
          defaultValue: true,
          admin: {
            description:
              '綠界物流狀態通知打進來時：買家取貨/宅配配完 → 已送達；' +
              '包裹退回寄件門市/賣家取回 → 已退回。關掉 = 只記錄貨態不動狀態。',
          },
        },
        {
          name: 'enableReadyForPickup',
          label: '啟用「待取貨」狀態',
          type: 'checkbox',
          defaultValue: false,
          admin: { description: '面交 / 超商取貨流程用' },
        },
        {
          name: 'customStatuses',
          label: '自訂訂單狀態',
          type: 'array',
          admin: {
            description:
              '顯示在訂單狀態下拉的額外選項。封測期可留空；Shopline 對齊用。',
          },
          fields: [
            { name: 'value', label: 'value（英數）', type: 'text', required: true },
            { name: 'label', label: 'label（顯示）', type: 'text', required: true },
            { name: 'sortOrder', label: '排序', type: 'number', defaultValue: 100 },
          ],
        },
      ],
    },
  ],
}
