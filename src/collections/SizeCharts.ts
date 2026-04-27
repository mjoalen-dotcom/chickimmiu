import type { CollectionConfig } from 'payload'

import { isAdmin } from '../access/isAdmin'
import { safeRevalidate } from '../lib/revalidate'

/**
 * SizeCharts Collection
 * ─────────────────────
 * 可跨商品復用的尺寸表。
 *
 * 用法：
 *   1. 在後台「商品管理 → 尺寸表」建立一張，例如「韓版上衣尺寸表」
 *      - measurements 定義量測欄位（肩寬、胸圍、衣長…）
 *      - rows 填入每一個 size 對應的實際數值
 *   2. 在商品編輯頁選擇此尺寸表（relationship）
 *   3. 前台 /products/[slug] 的「尺寸建議」按鈕會跳出這張表
 *
 * 為什麼要獨立成 Collection？
 *   - 品牌通常同類商品共用同一張尺寸表（例如所有 basic tee 都是同一張）
 *   - 如果塞在 Product 內部 array，改一個要全部改，很痛苦
 *   - 獨立 collection 後，改一次所有 relationship 的商品前台都會更新
 */
export const SizeCharts: CollectionConfig = {
  slug: 'size-charts',
  admin: {
    useAsTitle: 'name',
    defaultColumns: ['name', 'slug', 'category', 'unit', 'updatedAt'],
    group: '② 商品管理',
    description: '尺寸表範本（可跨商品復用），例如洋裝尺寸表、上衣尺寸表',
    listSearchableFields: ['name', 'slug'],
  },
  access: {
    read: () => true,
    create: isAdmin,
    update: isAdmin,
    delete: isAdmin,
  },
  hooks: {
    afterChange: [
      () => {
        // 尺寸表改動時，revalidate 所有商品詳細頁（這裡我們用整張 tag 打掉）
        safeRevalidate(['/products'], ['products', 'size-charts'])
      },
    ],
    afterDelete: [
      () => {
        safeRevalidate(['/products'], ['products', 'size-charts'])
      },
    ],
  },
  fields: [
    {
      type: 'row',
      fields: [
        {
          name: 'name',
          label: '尺寸表名稱',
          type: 'text',
          required: true,
          admin: {
            width: '60%',
            description: '例如：韓版洋裝尺寸表、歐版 T-shirt 尺寸表',
          },
        },
        {
          name: 'slug',
          label: '代碼',
          type: 'text',
          required: true,
          unique: true,
          admin: {
            width: '40%',
            description: '例如 dress-kr（英文 + 連字號）',
          },
        },
      ],
    },
    {
      type: 'row',
      fields: [
        {
          name: 'category',
          label: '適用類別',
          type: 'select',
          defaultValue: 'top',
          options: [
            { label: '上衣 Top', value: 'top' },
            { label: '下身 Bottom', value: 'bottom' },
            { label: '洋裝 Dress', value: 'dress' },
            { label: '外套 Outerwear', value: 'outerwear' },
            { label: '連身褲 Jumpsuit', value: 'jumpsuit' },
            { label: '泳裝 Swimwear', value: 'swimwear' },
            { label: '內搭 Innerwear', value: 'innerwear' },
            { label: '配件 Accessory', value: 'accessory' },
            { label: '其他 Other', value: 'other' },
          ],
          admin: { width: '50%' },
        },
        {
          name: 'unit',
          label: '單位',
          type: 'select',
          defaultValue: 'cm',
          options: [
            { label: '公分 cm', value: 'cm' },
            { label: '英吋 inch', value: 'inch' },
          ],
          admin: { width: '50%' },
        },
      ],
    },
    {
      name: 'measurements',
      label: '量測欄位定義',
      type: 'array',
      minRows: 1,
      admin: {
        description:
          '定義這張尺寸表有哪幾欄，例如「肩寬、胸圍、衣長、袖長」。每一個 key 會對應到下面 rows 裡面 values 的 key。',
      },
      fields: [
        {
          type: 'row',
          fields: [
            {
              name: 'key',
              label: '代碼 (key)',
              type: 'text',
              required: true,
              admin: {
                width: '40%',
                description: '英文代碼，例如 shoulder / bust / length / sleeve',
              },
            },
            {
              name: 'label',
              label: '中文名稱',
              type: 'text',
              required: true,
              admin: {
                width: '60%',
                description: '例如：肩寬 / 胸圍 / 衣長 / 袖長',
              },
            },
          ],
        },
      ],
    },
    {
      name: 'rows',
      label: '尺寸數據',
      type: 'array',
      minRows: 1,
      admin: {
        description: '每一列代表一個 size（例如 S/M/L），對應上方每個量測欄位的數值',
      },
      fields: [
        {
          name: 'size',
          label: '尺寸代號',
          type: 'text',
          required: true,
          admin: { description: '例如 XS / S / M / L / XL / F（均一尺寸）' },
        },
        {
          name: 'values',
          label: '各欄數值',
          type: 'array',
          fields: [
            {
              type: 'row',
              fields: [
                {
                  name: 'key',
                  label: '對應的量測欄位 key',
                  type: 'text',
                  required: true,
                  admin: {
                    width: '50%',
                    description: '必須和上方 measurements 的 key 對得上',
                  },
                },
                {
                  name: 'value',
                  label: '數值',
                  type: 'text',
                  required: true,
                  admin: {
                    width: '50%',
                    description: '例如 42 或 40-42（允許範圍）',
                  },
                },
              ],
            },
          ],
        },
      ],
    },
    {
      name: 'note',
      label: '備註 / 量測方式說明',
      type: 'textarea',
      admin: {
        description:
          '例如：本表為平量尺寸，量法是將衣服平放量測，實際可能有 ±1-2cm 誤差；或附上量測示意圖說明。',
      },
    },
    {
      name: 'isActive',
      label: '啟用',
      type: 'checkbox',
      defaultValue: true,
      admin: { description: '停用後此尺寸表在商品選單中將不再出現' },
    },
  ],
}
