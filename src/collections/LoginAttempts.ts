import type { CollectionConfig } from 'payload'
import { isAdmin } from '../access/isAdmin'

/**
 * LoginAttempts Collection
 * ────────────────────────
 * 記錄每次「成功」登入（email / userId / IP / UA / 時間）。
 *
 * ⚠️ 失敗登入 **不** 在此記錄：Payload 內建 `auth.maxLoginAttempts` + `lockTime`
 *   已用 `users.loginAttempts` 欄位擋暴力破解（見 Users.ts auth config）。
 *   若未來需要失敗嘗試歷史紀錄，改寫此 collection 描述並加 `success` bool。
 *
 * 用途：資安事件回溯、可疑 IP 追蹤、併發 session 偵測。
 * 寫入：Users.ts hooks.afterLogin
 * 讀取：僅 admin
 */
export const LoginAttempts: CollectionConfig = {
  slug: 'login-attempts',
  labels: { singular: '登入記錄', plural: '登入記錄' },
  admin: {
    useAsTitle: 'email',
    defaultColumns: ['email', 'ip', 'userAgent', 'createdAt'],
    group: '安全記錄',
    description: '成功登入記錄（失敗由 Payload 內建 maxLoginAttempts 處理）',
  },
  access: {
    read: isAdmin,
    // create 走 afterLogin hook（req.payload.create，不經過 access check 用 overrideAccess:false 時會擋，
    // 實際在 hook 內用 req 是 authenticated 的 user，故 create:true 即可）
    create: () => true,
    update: () => false,
    delete: isAdmin,
  },
  fields: [
    { name: 'email', label: 'Email', type: 'text', index: true },
    { name: 'userId', label: 'User ID', type: 'text', index: true },
    { name: 'ip', label: 'IP', type: 'text' },
    { name: 'userAgent', label: 'User-Agent', type: 'textarea' },
  ],
  timestamps: true,
}
