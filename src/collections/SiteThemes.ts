import type { CollectionConfig, Field } from 'payload'

import { isAdmin } from '../access/isAdmin'
import { safeRevalidate } from '../lib/revalidate'

/**
 * SiteThemes
 * ──────────
 * 全站主題 preset 集合 — 春 / 夏 / 秋 / 冬 / 活動 / 常駐。
 * 同一時間僅一筆 isActive=true（afterChange hook 強制單一）。
 *
 * 前端 layout.tsx 透過 ThemeStyles RSC 拉 active theme，
 * 把 palette 注入 :root CSS variable，讓 hero/品牌 banner 等元件能即時換色。
 *
 * heroLayout 控制首頁輪播版型；HomepageSettings.heroLayoutOverride 可覆寫。
 */

const colorField = (
  name: string,
  label: string,
  defaultValue: string,
  description?: string,
): Field => ({
  name,
  label,
  type: 'text',
  defaultValue,
  required: true,
  admin: {
    description,
    components: {
      Field: '@/components/admin/ColorField',
    },
  },
  validate: (val: unknown) => {
    if (typeof val !== 'string') return '必須是 hex 色碼'
    if (!/^#[0-9a-fA-F]{6}$/.test(val)) return '格式 #RRGGBB（例如 #C19A5B）'
    return true
  },
})

export const SiteThemes: CollectionConfig = {
  slug: 'site-themes',
  labels: {
    singular: '網站主題',
    plural: '網站主題',
  },
  admin: {
    group: '⑥ 內容與頁面',
    description: '一鍵切換春夏秋冬主題色 + 首頁輪播版型',
    useAsTitle: 'name',
    defaultColumns: ['name', 'season', 'heroLayout', 'isActive', 'updatedAt'],
  },
  access: {
    read: () => true,
    create: isAdmin,
    update: isAdmin,
    delete: isAdmin,
  },
  hooks: {
    afterChange: [
      async ({ doc, previousDoc, req, operation }) => {
        // 只要這筆變成 active，把其他 themes 設成非 active（保證單一 active）
        const justActivated =
          doc?.isActive === true &&
          (operation === 'create' || previousDoc?.isActive !== true)
        if (justActivated && doc?.id) {
          try {
            await req.payload.update({
              collection: 'site-themes',
              where: { and: [{ isActive: { equals: true } }, { id: { not_equals: doc.id } }] },
              data: { isActive: false },
              req,
            })
          } catch {
            /* best-effort; admin 重存一次即可重新平衡 */
          }
        }
        safeRevalidate(['/'])
      },
    ],
    afterDelete: [
      () => {
        safeRevalidate(['/'])
      },
    ],
  },
  fields: [
    {
      type: 'row',
      fields: [
        {
          name: 'name',
          label: '主題名稱',
          type: 'text',
          required: true,
          admin: {
            placeholder: '例如：春櫻 2026',
            width: '50%',
          },
        },
        {
          name: 'season',
          label: '季節',
          type: 'select',
          required: true,
          defaultValue: 'default',
          options: [
            { label: '🌸 春', value: 'spring' },
            { label: '🌊 夏', value: 'summer' },
            { label: '🍁 秋', value: 'autumn' },
            { label: '❄️ 冬', value: 'winter' },
            { label: '🎉 活動檔期', value: 'event' },
            { label: '🏛️ 常駐', value: 'default' },
          ],
          admin: { width: '25%' },
        },
        {
          name: 'isActive',
          label: '啟用此主題',
          type: 'checkbox',
          defaultValue: false,
          admin: {
            description: '勾選後其他主題會自動取消啟用',
            width: '25%',
          },
        },
      ],
    },

    // ── 色票 ──
    {
      type: 'tabs',
      tabs: [
        {
          label: '🎨 色票',
          description: '點色塊開取色器，或直接輸入 #RRGGBB',
          fields: [
            {
              type: 'collapsible',
              label: '主色 / 強調色',
              admin: { initCollapsed: false },
              fields: [
                colorField('palettePrimary', '主色 (primary)', '#C19A5B', '主要按鈕、強調文字、品牌色'),
                colorField('paletteAccent', '強調色 (accent)', '#EFBBAA', '次要按鈕、tag、hover 狀態'),
                colorField('paletteSurface', '表面色 (surface)', '#F9F5EC', 'hero / banner 背景、區塊底色'),
                colorField('paletteInk', '文字色 (ink)', '#2C2C2C', '主要文字顏色'),
                colorField('paletteOnPrimary', '主色文字 (onPrimary)', '#FDFBF7', '出現在主色按鈕上的文字色'),
                colorField('paletteOnAccent', '強調色文字 (onAccent)', '#2C2C2C', '出現在強調色按鈕上的文字色'),
              ],
            },
            {
              type: 'collapsible',
              label: 'Hero 漸層遮罩',
              admin: { initCollapsed: true },
              fields: [
                colorField('paletteHeroOverlayFrom', '遮罩起始色', '#000000', '全幅 hero 上的漸層遮罩起點（一般是黑）'),
                colorField('paletteHeroOverlayTo', '遮罩結束色', '#000000', '結束點（一般也是黑，控制透明度即可）'),
                {
                  name: 'paletteHeroOverlayOpacity',
                  label: '遮罩不透明度（0-1）',
                  type: 'number',
                  defaultValue: 0.45,
                  min: 0,
                  max: 1,
                  admin: { step: 0.05, description: '0 透明、1 全黑；建議 0.3-0.6' },
                },
              ],
            },
          ],
        },
        {
          label: '✒️ 字型',
          fields: [
            {
              name: 'serifFont',
              label: 'Serif 字型（標題）',
              type: 'select',
              defaultValue: 'noto-serif-tc',
              options: [
                { label: 'Noto Serif TC（思源宋體）', value: 'noto-serif-tc' },
                { label: 'Playfair Display（雜誌風）', value: 'playfair-display' },
                { label: 'Cormorant Garamond（古典）', value: 'cormorant' },
                { label: 'DM Serif Display（粗體現代）', value: 'dm-serif' },
              ],
              admin: { description: '需先在 layout.tsx 載入對應 font；目前僅 Noto Serif TC 已啟用，其他選項預留' },
            },
            {
              name: 'sansFont',
              label: 'Sans 字型（內文）',
              type: 'select',
              defaultValue: 'noto-sans-tc',
              options: [
                { label: 'Noto Sans TC（思源黑體）', value: 'noto-sans-tc' },
                { label: 'Inter', value: 'inter' },
                { label: 'Manrope', value: 'manrope' },
              ],
              admin: { description: '需先在 layout.tsx 載入對應 font；目前僅 Noto Sans TC 已啟用' },
            },
          ],
        },
        {
          label: '🎬 Hero 版型',
          fields: [
            {
              name: 'heroLayout',
              label: '首頁輪播版型',
              type: 'select',
              defaultValue: 'split',
              required: true,
              options: [
                { label: 'Split — 左文右圖（現行版型）', value: 'split' },
                { label: 'Editorial — 全幅大圖 + 左下標題 + 漸層遮罩', value: 'editorial' },
                { label: 'Cinematic — 全幅 Ken Burns + 中央置中 + 上下黑色 bar', value: 'cinematic' },
                { label: 'Magazine — 全幅 + 金色細框 + 不對稱排版', value: 'magazine' },
              ],
              admin: {
                description: '可在「首頁設定」單獨覆寫此版型（不動主題）',
              },
            },
            {
              name: 'heroMinHeightDesktop',
              label: '桌面最小高度（vh）',
              type: 'number',
              defaultValue: 85,
              min: 50,
              max: 100,
              admin: { step: 5, description: '建議 75-95；100 = 全螢幕' },
            },
            {
              name: 'heroMinHeightMobile',
              label: '手機最小高度（vh）',
              type: 'number',
              defaultValue: 60,
              min: 40,
              max: 100,
              admin: { step: 5 },
            },
          ],
        },
      ],
    },
  ],
}
