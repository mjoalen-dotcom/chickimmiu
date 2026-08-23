import type { GlobalConfig } from 'payload'

import { isAdmin } from '../access/isAdmin'
import { safeRevalidate } from '../lib/revalidate'

/**
 * 穿搭誌列表頁設定 Global
 * ──────────────────────
 * 2026-08-24 需求：/blog 分類頁籤過多（兩站合計 14 個，其中 6 個零篇）擠成
 * 橫向滑桿，且版型寫死在程式裡。此 global 把「分類怎麼排」與「文章怎麼陳列」
 * 都變成後台開關，日後換版型不用改 code。
 *
 * 對應 migration：20260824_190000_add_blog_page_settings（CREATE TABLE）。
 */
export const BlogPageSettings: GlobalConfig = {
  slug: 'blog-page-settings',
  label: '穿搭誌頁設定',
  admin: {
    group: '⑥ 內容與頁面',
    description: '/blog 列表頁的 Hero、分類導覽排列方式、文章版型與每頁篇數；存檔即生效',
  },
  access: {
    read: () => true,
    update: isAdmin,
  },
  hooks: {
    afterChange: [
      () => {
        safeRevalidate(['/blog'], ['blog-posts'])
      },
    ],
  },
  fields: [
    {
      type: 'tabs',
      tabs: [
        {
          label: '分類導覽',
          description: '解決分類過多擠成滑桿的問題：換排列方式、藏空分類、收摺多餘項目',
          fields: [
            {
              name: 'categoryNav',
              label: '分類列',
              type: 'group',
              fields: [
                {
                  name: 'style',
                  label: '排列方式',
                  type: 'select',
                  defaultValue: 'pills-wrap',
                  options: [
                    { label: '膠囊自動換行（推薦，不出現滑桿）', value: 'pills-wrap' },
                    { label: '單行橫向捲動（舊版行為）', value: 'pills-scroll' },
                    { label: '文字選單列（極簡雜誌感）', value: 'underline' },
                    { label: '下拉選單（最省空間）', value: 'dropdown' },
                    { label: '不顯示分類', value: 'hidden' },
                  ],
                },
                {
                  name: 'hideEmpty',
                  label: '自動隱藏沒有文章的分類',
                  type: 'checkbox',
                  defaultValue: true,
                  admin: { description: '避免點進去看到「此分類目前沒有文章」' },
                },
                {
                  name: 'showCount',
                  label: '分類後面顯示文章數',
                  type: 'checkbox',
                  defaultValue: true,
                },
                {
                  name: 'maxVisible',
                  label: '最多直接顯示幾個分類',
                  type: 'number',
                  defaultValue: 6,
                  min: 0,
                  max: 30,
                  admin: { description: '超過的收進「更多」；填 0 表示全部展開' },
                },
                {
                  name: 'sortBy',
                  label: '分類排序依據',
                  type: 'select',
                  defaultValue: 'count',
                  options: [
                    { label: '文章多的排前面', value: 'count' },
                    { label: '照後台分類設定的排序欄位', value: 'manual' },
                    { label: '名稱筆劃／字母序', value: 'name' },
                  ],
                },
              ],
            },
          ],
        },
        {
          label: '文章版型',
          description: '換版型只要改這裡，不用動程式',
          fields: [
            {
              name: 'layout',
              label: '列表版型',
              type: 'group',
              fields: [
                {
                  name: 'style',
                  label: '版型',
                  type: 'select',
                  defaultValue: 'magazine',
                  options: [
                    { label: '雜誌網格（大圖卡片，預設）', value: 'magazine' },
                    { label: '編輯部雙欄（左圖右文，適合長標題）', value: 'editorial' },
                    { label: '極簡清單（小縮圖＋標題，資訊密度最高）', value: 'minimal' },
                    { label: '瀑布流（圖片高度不齊，視覺活潑）', value: 'masonry' },
                  ],
                },
                {
                  name: 'columns',
                  label: '桌機每列幾欄',
                  type: 'select',
                  defaultValue: '3',
                  options: [
                    { label: '2 欄（圖大）', value: '2' },
                    { label: '3 欄（預設）', value: '3' },
                    { label: '4 欄（一次看更多）', value: '4' },
                  ],
                  admin: { description: '極簡清單版型不受此設定影響' },
                },
                {
                  name: 'showEditorsPick',
                  label: '第一篇放大為 Editor’s Pick',
                  type: 'checkbox',
                  defaultValue: true,
                },
                {
                  name: 'showExcerpt',
                  label: '卡片顯示摘要文字',
                  type: 'checkbox',
                  defaultValue: true,
                },
                {
                  name: 'pageSize',
                  label: '每頁文章數',
                  type: 'number',
                  defaultValue: 12,
                  min: 3,
                  max: 60,
                },
              ],
            },
          ],
        },
        {
          label: 'Hero 與訂閱區',
          fields: [
            {
              name: 'hero',
              label: '頁首 Hero',
              type: 'group',
              fields: [
                { name: 'enabled', label: '顯示 Hero 區塊', type: 'checkbox', defaultValue: true },
                {
                  name: 'overline',
                  label: '上方小標',
                  type: 'text',
                  defaultValue: 'Style Journal · 穿搭誌',
                },
                { name: 'title', label: '主標', type: 'text', defaultValue: '讓每一天' },
                {
                  name: 'titleAccent',
                  label: '主標金色強調字',
                  type: 'text',
                  defaultValue: '都成為經典',
                },
                {
                  name: 'description',
                  label: '副標說明',
                  type: 'textarea',
                  defaultValue:
                    '韓系穿搭靈感、時尚趨勢解讀、編輯部精選 — 由金老佛爺帶領，讓你從通勤到約會，從日常到重要時刻都有屬於自己的風格答案。',
                },
                {
                  name: 'showActions',
                  label: '顯示「追蹤金老佛爺 IG／金金同款專區」兩顆按鈕',
                  type: 'checkbox',
                  defaultValue: true,
                },
              ],
            },
            {
              name: 'newsletter',
              label: '底部訂閱區塊',
              type: 'group',
              fields: [
                { name: 'enabled', label: '顯示訂閱區塊', type: 'checkbox', defaultValue: true },
                {
                  name: 'overline',
                  label: '上方小標',
                  type: 'text',
                  defaultValue: 'Stay in Style',
                },
                { name: 'title', label: '主標', type: 'text', defaultValue: '每週一封穿搭靈感信' },
                {
                  name: 'description',
                  label: '說明文字',
                  type: 'textarea',
                  defaultValue: '訂閱穿搭誌 newsletter — 第一時間收到新品上市、季節穿搭與會員專屬優惠',
                },
              ],
            },
          ],
        },
      ],
    },
  ],
}
