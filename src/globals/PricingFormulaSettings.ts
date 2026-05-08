import type { GlobalConfig } from 'payload'
import { isAdmin } from '../access/isAdmin'

/**
 * 商品計價公式 Global
 * ─────────────────────
 * 用於後台「商品 → 自動計價」自動算出建議售價，公式：
 *
 *   採購成本 (採購幣別)
 *     ÷ 採購匯率（manualRateOverride OR Currencies.rateAgainstTwd）
 *   = 換算成本 TWD
 *
 *   重量 (g) × weightShippingPerGram + weightShippingFlatFee
 *   = 重量運費 TWD
 *
 *   profitMode：
 *     - percent_only       → (cost+shipping) × profitPercent / 100
 *     - fixed_only         → profitFixedFloor
 *     - whichever_higher   → max(percent, fixed)
 *
 *   建議售價 = round((cost + shipping + profit) ÷ priceRoundTo) × priceRoundTo
 *
 * 邊界：成本欄位「非必填」— 留空時整個 autoPricing 跳過，後台仍可手填 `price`。
 *      `useAutoPricing=false` 時 hook 不覆寫 `price`，admin 完全自主。
 *
 * v1 scope：自動計價只支援 KRW/JPY/USD/CNY → TWD（台灣電商主要採購來源）。
 * 多貨幣訂閱 / 多 SKU 不同成本 / 庫存成本平均化都屬 v2。
 */
export const PricingFormulaSettings: GlobalConfig = {
  slug: 'pricing-formula-settings',
  label: '商品計價公式',
  admin: {
    group: '⑦ 系統與安全',
    description:
      '採購韓幣 → 自動算建議售價的公式設定（後台商品「自動計價」會引用）',
  },
  access: {
    read: () => true, // 後台 admin 元件 + Products.beforeChange hook 都會讀
    update: isAdmin,
  },
  fields: [
    {
      name: 'currencyCode',
      label: '預設採購幣別',
      type: 'select',
      defaultValue: 'KRW',
      options: [
        { label: '韓元 KRW', value: 'KRW' },
        { label: '日圓 JPY', value: 'JPY' },
        { label: '美元 USD', value: 'USD' },
        { label: '人民幣 CNY', value: 'CNY' },
      ],
      admin: {
        description:
          '商品編輯頁的「自動計價」採購幣別預設為這個值（建立商品時可逐筆覆寫）',
      },
    },
    {
      name: 'manualRateOverride',
      label: '鎖定採購匯率（選填）',
      type: 'number',
      min: 0,
      admin: {
        description:
          '留空 = 即時跟「幣別與匯率」collection 走；填入 = 鎖定此值（1 TWD = 多少採購幣別）。例：KRW 36 表示 1 元 ≈ 36 韓元。匯率突波時可暫時鎖住採購端。',
      },
    },
    {
      type: 'row',
      fields: [
        {
          name: 'weightShippingPerGram',
          label: '每公克運費（TWD）',
          type: 'number',
          defaultValue: 0.3,
          min: 0,
          admin: {
            width: '50%',
            description: '國際運費攤提，例：0.3 = 一克 0.3 元',
          },
        },
        {
          name: 'weightShippingFlatFee',
          label: '固定處理費（TWD）',
          type: 'number',
          defaultValue: 80,
          min: 0,
          admin: {
            width: '50%',
            description: '不論重量都加，例：80 = 每件加 80 元清關/包裝',
          },
        },
      ],
    },
    {
      name: 'profitMode',
      label: '保底淨利計算方式',
      type: 'select',
      defaultValue: 'percent_only',
      options: [
        { label: '只用百分比', value: 'percent_only' },
        { label: '只用固定金額', value: 'fixed_only' },
        { label: '取其大者（百分比 vs 固定金額）', value: 'whichever_higher' },
      ],
      admin: {
        description:
          '「取其大者」確保毛利同時滿足「成本敏感商品 → 至少賺百分比」與「低價商品 → 至少賺固定金額」',
      },
    },
    {
      type: 'row',
      fields: [
        {
          name: 'profitPercent',
          label: '加成百分比（%）',
          type: 'number',
          defaultValue: 35,
          min: 0,
          admin: {
            width: '50%',
            description: '在「成本 + 運費」之上加幾 %，例：35 = 加 35 %',
          },
        },
        {
          name: 'profitFixedFloor',
          label: '保底固定金額（TWD）',
          type: 'number',
          defaultValue: 200,
          min: 0,
          admin: {
            width: '50%',
            description: '至少賺多少元，例：200',
          },
        },
      ],
    },
    {
      name: 'priceRoundTo',
      label: '售價自動取整（TWD）',
      type: 'number',
      defaultValue: 10,
      min: 1,
      admin: {
        description:
          '建議售價自動 round 到此值的倍數。例：10 = 個位數歸零（1234 → 1230）；100 = 百位數歸零（1234 → 1200）',
      },
    },
  ],
}
