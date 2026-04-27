import type { CollectionConfig, Where } from 'payload'
import { isAdmin } from '../access/isAdmin'

/**
 * UGC 社群內容聚合 Collection
 * ────────────────────────────
 * 匯集品牌帳號貼文、標註品牌內容、手動匯入
 * 支援：隱藏/篩選/置頂/商品連結/數據分析
 * 版型：格狀/瀑布/幻燈片/精選動態/導購櫥窗/導購影音
 */
export const UGCPosts: CollectionConfig = {
  slug: 'ugc-posts',
  labels: { singular: 'UGC 貼文', plural: 'UGC 貼文' },
  admin: {
    group: '互動體驗',
    description: 'UGC 社群內容聚合（Instagram / Facebook / 手動匯入）',
    defaultColumns: ['authorName', 'platform', 'status', 'isPinned', 'likes', 'createdAt'],
  },
  access: {
    read: ({ req: { user } }) => {
      if (user && (user as unknown as Record<string, unknown>).role === 'admin') return true
      return { status: { equals: 'approved' } } as Where
    },
    create: isAdmin,
    update: isAdmin,
    delete: isAdmin,
  },
  fields: [
    // ── 來源 ──
    {
      name: 'platform',
      label: '來源平台',
      type: 'select',
      required: true,
      options: [
        { label: 'Instagram', value: 'instagram' },
        { label: 'Facebook', value: 'facebook' },
        { label: 'TikTok', value: 'tiktok' },
        { label: 'YouTube', value: 'youtube' },
        { label: '手動匯入', value: 'manual' },
      ],
    },
    {
      name: 'sourceType',
      label: '內容類型',
      type: 'select',
      options: [
        { label: '品牌帳號貼文', value: 'brand_post' },
        { label: '用戶標註品牌', value: 'user_tag' },
        { label: '用戶提及品牌', value: 'user_mention' },
        { label: '手動匯入', value: 'manual_import' },
      ],
    },
    { name: 'externalId', label: '外部貼文 ID', type: 'text', unique: true, admin: { description: '平台原始貼文 ID，防止重複匯入' } },
    { name: 'externalUrl', label: '原始連結', type: 'text' },

    // ── 作者資訊 ──
    { name: 'authorName', label: '作者名稱', type: 'text', required: true },
    { name: 'authorHandle', label: '作者帳號', type: 'text', admin: { description: '例如 @chickimmiu' } },
    { name: 'authorAvatar', label: '作者頭像', type: 'upload', relationTo: 'media' },

    // ── 內容 ──
    {
      name: 'contentType',
      label: '媒體類型',
      type: 'select',
      required: true,
      options: [
        { label: '圖片', value: 'image' },
        { label: '影片', value: 'video' },
        { label: '輪播圖', value: 'carousel' },
        { label: 'Reels / Shorts', value: 'reel' },
      ],
    },
    { name: 'caption', label: '貼文文案', type: 'textarea' },
    {
      name: 'mediaItems',
      label: '媒體檔案',
      type: 'array',
      minRows: 1,
      fields: [
        { name: 'file', label: '圖片/影片', type: 'upload', relationTo: 'media', required: true },
        { name: 'thumbnailUrl', label: '縮圖 URL（外部）', type: 'text' },
        { name: 'videoUrl', label: '影片 URL（外部）', type: 'text' },
      ],
    },

    // ── 數據 ──
    { name: 'likes', label: '按讚數', type: 'number', defaultValue: 0, min: 0 },
    { name: 'comments', label: '留言數', type: 'number', defaultValue: 0, min: 0 },
    { name: 'shares', label: '分享數', type: 'number', defaultValue: 0, min: 0 },
    { name: 'views', label: '觀看數', type: 'number', defaultValue: 0, min: 0 },
    { name: 'publishedAt', label: '原始發布時間', type: 'date' },

    // ── 商品連結 ──
    {
      name: 'taggedProducts',
      label: '標註商品',
      type: 'relationship',
      relationTo: 'products',
      hasMany: true,
      admin: { description: '置入商品購買連結，前端點擊可直接導向商品頁' },
    },

    // ── 管理 ──
    {
      name: 'status',
      label: '狀態',
      type: 'select',
      defaultValue: 'pending',
      options: [
        { label: '待審核', value: 'pending' },
        { label: '已核准', value: 'approved' },
        { label: '已隱藏', value: 'hidden' },
        { label: '已拒絕', value: 'rejected' },
      ],
    },
    { name: 'isPinned', label: '置頂釘選', type: 'checkbox', defaultValue: false },
    { name: 'sortOrder', label: '排序權重', type: 'number', defaultValue: 0 },

    // ── 展示設定 ──
    {
      name: 'displayLocations',
      label: '展示位置',
      type: 'select',
      hasMany: true,
      options: [
        { label: '首頁', value: 'homepage' },
        { label: '商品頁', value: 'product_page' },
        { label: '活動頁', value: 'campaign_page' },
        { label: 'UGC 專區', value: 'ugc_gallery' },
      ],
    },
    {
      name: 'displayLayout',
      label: '推薦版型',
      type: 'select',
      admin: { description: '格狀/瀑布/幻燈片/精選動態/導購櫥窗/導購影音' },
      options: [
        { label: '格狀式', value: 'grid' },
        { label: '瀑布式', value: 'masonry' },
        { label: '幻燈片式', value: 'carousel' },
        { label: '精選動態式', value: 'featured_feed' },
        { label: '導購櫥窗版型', value: 'shoppable_gallery' },
        { label: '導購影音版型', value: 'shoppable_video' },
      ],
    },

    // ── 標籤 ──
    {
      name: 'hashtags',
      label: 'Hashtags',
      type: 'array',
      fields: [
        { name: 'tag', label: '標籤', type: 'text' },
      ],
    },
    { name: 'adminNote', label: '後台備註', type: 'textarea' },
  ],
  timestamps: true,
}
