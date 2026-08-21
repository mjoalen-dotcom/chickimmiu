import type { CollectionConfig, PayloadRequest } from 'payload'

import { isAdmin, isAdminFieldLevel } from '../access/isAdmin'
import { escapeHtml } from '../lib/email/_shared'
import { renderEmailFromTemplate } from '../lib/email/renderFromTemplate'
import { isAdminOrSelf } from '../access/isAdminOrSelf'
import { createExportEndpoint, createImportEndpoint, type FieldMapping } from '../endpoints/importExport'
import { customerRegisterEndpoint } from '../endpoints/customerRegister'
import { bindEmailEndpoint } from '../endpoints/bindEmail'

const customerFieldMappings: FieldMapping[] = [
  { key: 'name', label: '姓名' },
  { key: 'email', label: 'Email' },
  { key: 'phone', label: '電話' },
  { key: 'points', label: '點數' },
  { key: 'shoppingCredit', label: '購物金' },
  { key: 'totalSpent', label: '累計消費' },
  { key: 'birthday', label: '生日' },
  { key: 'referralCode', label: '推薦碼' },
  { key: 'addresses', label: '地址（JSON）' },
]

/**
 * Customers Collection（APP-API-001 步驟16：從 Users 分離出來的獨立顧客
 * auth collection）
 * ──────────────────────────────────────────────────────────────
 * 2026-08-16 拆分自 src/collections/Users.ts。原本 users 單一 collection
 * 混裝 admin/operator/partner/customer 四種身分，僅靠 role 欄位區分——
 * 稽核確認 role 欄位寫入已鎖 admin-only，非可利用漏洞，但 APP 端發出的
 * 顧客 JWT 若沿用同一張表，語意上等同「後台鑰匙同款式」，僅靠角色檢查
 * 把關而非架構層隔離。Alan 拍板：真的做全量物理分離（非輕量 JWT scope
 * 方案），既有 role='customer' 的 users 資料整批搬進本 collection。
 *
 * 欄位對照 Users.ts：與顧客身分相關的欄位（會員等級/點數/CRM信用/標籤/
 * 體型/地址簿/社群綁定/活動統計/遊戲與AI/寶物箱）全部原樣搬過來，欄位
 * 名稱刻意保持一致——大量既有程式碼（hooks、engines、admin元件）是用
 * 欄位名稱直接讀寫（如 `user.points`），改名會擴大炸裂半徑。
 * **不搬過來**的只有三塊 admin-only 內容：role 欄位本身（customers
 * collection 定義上就只會是顧客，不需要 role 區分）、adminPermissions
 * 群組（僅 role=admin 生效）、客服通知偏好 tab（僅 staff 用）。
 *
 * ID 保留策略：資料搬移腳本（scripts/migrate-users-to-customers.ts，
 * 尚未寫）會讓每筆 customers row 沿用原本 users row 的數字 ID——這樣
 * Orders.customer／PointsTransactions.user 等 ~40 個既有關聯欄位的
 * 「資料值」完全不用改，只需要把欄位定義的 relationTo 從 'users' 改成
 * 'customers'，既有整數 FK 值直接對得上新表的同一個 ID。
 */
export const Customers: CollectionConfig = {
  slug: 'customers',
  labels: { singular: '顧客', plural: '顧客' },
  // 顧客已被訂單、分群、點數等稽核資料引用時不可安全 hard delete，跟
  // Users 同樣的 trash 設計。
  trash: true,
  admin: {
    hidden: ({ user }) => user?.role !== 'admin',
    useAsTitle: 'email',
    defaultColumns: ['name', 'email', 'memberTier', 'points', 'totalSpent', 'creditStatus', 'createdAt'],
    group: '③ 會員與 CRM',
    description: '前台顧客帳號（含 APP 顧客）— 與後台 users（admin/operator/partner）完全分離的獨立 auth collection',
    components: {
      beforeListTable: [
        {
          path: '@/components/admin/ImportExportButtons',
          clientProps: { collectionSlug: 'customers' },
        },
      ],
    },
  },
  auth: {
    tokenExpiration: 60 * 60 * 24 * 7,
    // 暴力破解防護：10 次失敗鎖 10 分鐘（沿用 Users 既有政策）
    maxLoginAttempts: 10,
    lockTime: 10 * 60 * 1000,
    cookies: {
      sameSite: 'Lax',
      secure: process.env.NODE_ENV === 'production',
    },
    forgotPassword: {
      generateEmailSubject: () => 'CHIC KIM & MIU｜重設密碼請求',
      generateEmailHTML: async (
        args = {} as { token?: string; user?: Record<string, unknown>; req?: PayloadRequest },
      ) => {
        const token = args?.token
        const user = args?.user
        const reqPayload = args?.req?.payload
        const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://pre.chickimmiu.com'
        const resetUrl = `${siteUrl}/reset-password?token=${token || ''}`
        const name = (user?.name as string) || (user?.email as string) || '會員'
        if (reqPayload) {
          try {
            const r = await renderEmailFromTemplate(reqPayload, 'auth_forgot_password', {
              customerName: escapeHtml(name),
              resetUrl,
            })
            if (r) return r.html
          } catch (e) {
            console.error('[Customers.forgotPassword] 模板渲染失敗，fallback inline:', e)
          }
        }
        return `<!DOCTYPE html>
<html><body style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI','PingFang TC','Microsoft JhengHei',sans-serif;background:#FDF8F3;padding:24px;color:#2C2C2C">
  <div style="max-width:560px;margin:0 auto;background:#fff;border:1px solid #E5DED4;border-radius:14px;padding:28px">
    <h2 style="margin:0 0 16px;font-size:20px;font-weight:600">${name}，您好</h2>
    <p style="margin:0 0 16px;line-height:1.7">我們收到您的重設密碼請求。請點以下按鈕或連結在 1 小時內完成重設：</p>
    <div style="text-align:center;margin:24px 0"><a href="${resetUrl}" style="display:inline-block;padding:12px 28px;background:#C19A5B;color:#fff;border-radius:999px;text-decoration:none;font-size:14px">重設密碼</a></div>
    <p style="margin:0 0 8px;font-size:12px;color:#6B6B6B;line-height:1.6">連結無法點擊請複製：</p>
    <p style="margin:0 0 16px;font-size:12px;word-break:break-all;color:#6B6B6B">${resetUrl}</p>
    <p style="margin:16px 0 0;font-size:12px;color:#6B6B6B;line-height:1.6">若您未發起此請求，請忽略此信，您的密碼不會改變。</p>
  </div>
</body></html>`
      },
    },
    verify: {
      generateEmailSubject: () => 'CHIC KIM & MIU｜請驗證您的 Email',
      generateEmailHTML: async (
        args = {} as { token?: string; user?: unknown; req?: PayloadRequest },
      ) => {
        const token = args?.token
        const reqPayload = args?.req?.payload
        const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://pre.chickimmiu.com'
        const verifyUrl = `${siteUrl}/verify-email?token=${token || ''}`
        const u = args?.user as Record<string, unknown> | undefined
        const name = (u?.name as string) || (u?.email as string) || '會員'
        if (reqPayload) {
          try {
            const r = await renderEmailFromTemplate(reqPayload, 'auth_verify', {
              customerName: escapeHtml(name),
              verifyUrl,
            })
            if (r) return r.html
          } catch (e) {
            console.error('[Customers.verify] 模板渲染失敗，fallback inline:', e)
          }
        }
        return `<!DOCTYPE html>
<html><body style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI','PingFang TC','Microsoft JhengHei',sans-serif;background:#FDF8F3;padding:24px;color:#2C2C2C">
  <div style="max-width:560px;margin:0 auto;background:#fff;border:1px solid #E5DED4;border-radius:14px;padding:28px">
    <h2 style="margin:0 0 16px;font-size:20px;font-weight:600">${name}，歡迎加入 CHIC KIM & MIU</h2>
    <p style="margin:0 0 16px;line-height:1.7">感謝您註冊 CHIC KIM & MIU 會員。請點以下按鈕或連結完成 email 驗證，驗證後即可登入帳號享受會員專屬優惠：</p>
    <div style="text-align:center;margin:24px 0"><a href="${verifyUrl}" style="display:inline-block;padding:12px 28px;background:#C19A5B;color:#fff;border-radius:999px;text-decoration:none;font-size:14px">驗證 Email</a></div>
    <p style="margin:0 0 8px;font-size:12px;color:#6B6B6B;line-height:1.6">連結無法點擊請複製：</p>
    <p style="margin:0 0 16px;font-size:12px;word-break:break-all;color:#6B6B6B">${verifyUrl}</p>
    <p style="margin:16px 0 0;font-size:12px;color:#6B6B6B;line-height:1.6">若您未申請註冊，請忽略此信。</p>
  </div>
</body></html>`
      },
    },
  },
  access: {
    // req.user 型別現在是 User | Customer 的聯集（兩個 collection 都有 auth）。
    // 只有 User 才有 role 欄位——Customer 文件本身不可能通過這裡的 admin 檢查
    // （沒有 role 就一律 false），這正是分離的意義：顧客 token 天生過不了
    // admin 檢查，不需要額外判斷是哪個 collection 發的。
    admin: ({ req: { user } }) => {
      const role = (user as { role?: string } | undefined)?.role
      return role === 'admin' || role === 'operator' || role === 'partner'
    },
    read: isAdminOrSelf,
    create: isAdmin,
    update: isAdminOrSelf,
    delete: ({ req: { user }, data }) =>
      (user as { role?: string } | undefined)?.role === 'admin' &&
      Boolean((data as { deletedAt?: unknown } | undefined)?.deletedAt),
  },
  endpoints: [
    createExportEndpoint('customers', customerFieldMappings),
    createImportEndpoint('customers', customerFieldMappings),
    customerRegisterEndpoint,
    bindEmailEndpoint,
  ],
  hooks: {
    beforeChange: [
      async ({ data, operation, req }) => {
        if (operation !== 'create') return data
        if (data?.referralCode) return data
        try {
          const { generateUniqueCustomerReferralCode } = await import('../lib/referralCode')
          data.referralCode = await generateUniqueCustomerReferralCode(req.payload)
        } catch {
          // 產碼失敗不擋 create；使用者首次讀 /account/referrals 時會 lazy backfill
        }
        return data
      },
    ],
    afterLogin: [
      async ({ req, user }) => {
        try {
          const headers = req?.headers as Headers | undefined
          const getHeader = (k: string) => (typeof headers?.get === 'function' ? headers.get(k) : '') || ''
          const xff = getHeader('x-forwarded-for')
          const ip = (xff.split(',')[0] || getHeader('x-real-ip') || '').trim()
          const ua = getHeader('user-agent')
          await req.payload.create({
            collection: 'login-attempts',
            data: {
              email: (user as { email?: string })?.email || '',
              userId: (user as { id?: string | number })?.id != null ? String((user as { id: string | number }).id) : '',
              ip,
              userAgent: ua,
            },
            req,
          })
        } catch {
          // ignore
        }
      },
      async ({ req, user }) => {
        try {
          const u = user as unknown as Record<string, unknown>
          if (!u?.referredBy || u.registrationReferralRewarded === true) return
          const { grantRegistrationReferralReward } = await import('../lib/referral/registrationReward')
          await grantRegistrationReferralReward(req.payload, u.id as string | number)
        } catch (e) {
          console.error(
            '[customers.afterLogin] registration referral reward failed:',
            e instanceof Error ? e.message : String(e),
          )
        }
      },
    ],
  },
  fields: [
    {
      type: 'tabs',
      tabs: [
        // ── TAB 1: 基本資料 ────────────────────────────────────
        {
          label: '基本資料',
          description: '顧客基本資訊',
          fields: [
            {
              type: 'row',
              fields: [
                { name: 'name', label: '姓名', type: 'text', required: true, admin: { width: '50%' } },
                { name: 'phone', label: '電話', type: 'text', admin: { width: '50%' } },
              ],
            },
            {
              type: 'row',
              fields: [
                {
                  name: 'isGuest',
                  label: '訪客結帳臨時帳號',
                  type: 'checkbox',
                  defaultValue: false,
                  access: { create: isAdminFieldLevel, update: isAdminFieldLevel },
                  admin: {
                    width: '50%',
                    readOnly: true,
                    description: '由訪客結帳流程自動建立；非真實註冊會員',
                  },
                },
                {
                  name: 'birthday',
                  label: '生日',
                  type: 'date',
                  admin: { width: '50%', date: { pickerAppearance: 'dayOnly' } },
                },
              ],
            },
            {
              name: 'birthTime',
              label: '出生時間（選填）',
              type: 'text',
              admin: {
                description: '24 小時制 HH:mm（e.g. 14:30）。用於更精準的星座上升星座推算。',
                placeholder: 'HH:mm',
              },
              validate: (value: unknown) => {
                if (value == null || value === '') return true
                if (typeof value !== 'string') return '請輸入 HH:mm 格式'
                if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(value)) {
                  return '時間格式錯誤（須為 HH:mm，e.g. 09:05、14:30、23:59）'
                }
                return true
              },
            },
            {
              name: 'gender',
              label: '性別',
              type: 'select',
              options: [
                { label: '女性', value: 'female' },
                { label: '男性', value: 'male' },
                { label: '其他 / 不透露', value: 'other' },
              ],
              admin: {
                description: '影響會員等級前台稱號顯示（未填或 female → frontName；male → frontNameMale fallback frontName）',
              },
            },
            {
              name: 'avatar',
              label: '頭像',
              type: 'upload',
              relationTo: 'media',
              hooks: {
                beforeValidate: [
                  async ({ value, req }) => {
                    if (value == null || value === '') return value
                    const mediaId =
                      typeof value === 'object' && value !== null
                        ? (value as { id?: string | number }).id
                        : (value as string | number)
                    if (mediaId == null || mediaId === '') return value
                    try {
                      const doc = await req.payload.findByID({ collection: 'media', id: mediaId, depth: 0 })
                      if (!doc || !(doc as { filename?: string }).filename) {
                        throw new Error('頭像檔案不存在或已被刪除，請重新上傳或清空此欄位')
                      }
                      return value
                    } catch (e) {
                      if (e instanceof Error && /頭像檔案/.test(e.message)) throw e
                      throw new Error('頭像檔案不存在或已被刪除，請重新上傳或清空此欄位')
                    }
                  },
                ],
              },
            },
            {
              name: 'invoiceInfo',
              label: '公司發票資料（預設）',
              type: 'group',
              admin: {
                description: '預設三聯式發票抬頭。顧客於結帳頁可一鍵套用。',
              },
              fields: [
                {
                  type: 'row',
                  fields: [
                    { name: 'invoiceTitle', label: '發票抬頭', type: 'text', admin: { width: '50%', description: '公司全名' } },
                    { name: 'taxId', label: '統一編號', type: 'text', maxLength: 8, admin: { width: '50%', description: '8 碼數字' } },
                  ],
                },
                { name: 'invoiceAddress', label: '發票寄送地址', type: 'text', admin: { description: '紙本三聯式發票寄送地址（電子發票可留空）' } },
                {
                  type: 'row',
                  fields: [
                    { name: 'invoiceContactName', label: '聯絡人', type: 'text', admin: { width: '50%' } },
                    { name: 'invoicePhone', label: '聯絡電話', type: 'text', admin: { width: '50%' } },
                  ],
                },
              ],
            },
            {
              name: 'invoiceProfiles',
              label: '其他發票資料（多筆）',
              type: 'array',
              admin: { description: '若同一帳號需開立給多家公司，可在此自由新增多筆，結帳時挑選即可。' },
              fields: [
                {
                  type: 'row',
                  fields: [
                    { name: 'profileName', label: '此筆別名', type: 'text', required: true, admin: { width: '40%' } },
                    { name: 'invoiceTitle', label: '發票抬頭', type: 'text', required: true, admin: { width: '60%' } },
                  ],
                },
                {
                  type: 'row',
                  fields: [
                    { name: 'taxId', label: '統一編號', type: 'text', maxLength: 8, admin: { width: '40%' } },
                    { name: 'invoiceContactName', label: '聯絡人', type: 'text', admin: { width: '30%' } },
                    { name: 'invoicePhone', label: '聯絡電話', type: 'text', admin: { width: '30%' } },
                  ],
                },
                { name: 'invoiceAddress', label: '發票寄送地址', type: 'text' },
                { name: 'note', label: '備註', type: 'text' },
              ],
            },
            {
              type: 'row',
              fields: [
                {
                  name: 'shoplineCustomerId',
                  label: 'Shopline 顧客 ID',
                  type: 'text',
                  index: true,
                  admin: { width: '50%', description: 'Shopline 匯出的 customer_id，用於資料對接' },
                },
                {
                  name: 'signupSource',
                  label: '註冊來源',
                  type: 'select',
                  options: [
                    { label: 'Shopline 匯入', value: 'shopline' },
                    { label: '官網自然註冊', value: 'organic' },
                    { label: 'LINE 登入', value: 'line' },
                    { label: 'Facebook 登入', value: 'facebook' },
                    { label: 'Google 登入', value: 'google' },
                    { label: '推薦', value: 'referral' },
                    { label: '後台手動建立', value: 'admin' },
                    { label: 'APP 註冊', value: 'app' },
                  ],
                  admin: { width: '50%', description: '會員首次註冊的管道' },
                },
              ],
            },
          ],
        },

        // ── TAB 2: 會員等級 & 點數 ────────────────────────────
        {
          label: '會員等級 & 點數',
          description: '會員等級、點數餘額、購物金',
          fields: [
            {
              name: 'memberTier',
              label: '會員等級',
              type: 'relationship',
              relationTo: 'membership-tiers',
              // D-1（2026-08-21）：等級決定免費抽獎次數/點數倍率/折扣，顧客不可自改；
              // 系統升等走 local API（overrideAccess）不受此限
              access: { update: isAdminFieldLevel },
              admin: { description: '由系統根據累計消費自動升級，或由管理員手動調整。' },
            },
            {
              type: 'row',
              fields: [
                { name: 'points', label: '會員點數', type: 'number', defaultValue: 0, min: 0, access: { update: isAdminFieldLevel }, admin: { width: '33%' } },
                { name: 'shoppingCredit', label: '購物金餘額', type: 'number', defaultValue: 0, min: 0, access: { update: isAdminFieldLevel }, admin: { width: '33%' } },
                { name: 'totalSpent', label: '累計消費金額', type: 'number', defaultValue: 0, min: 0, access: { update: isAdminFieldLevel }, admin: { width: '33%' } },
              ],
            },
            {
              name: 'storedValueBalance',
              label: '儲值金餘額',
              type: 'number',
              defaultValue: 0,
              min: 0,
              access: { update: isAdminFieldLevel },
              admin: { description: '使用者自行儲值的現金額度，理論上可退現。與購物金不同。' },
            },
            {
              type: 'row',
              fields: [
                { name: 'totalCheckIns', label: '累計簽到次數', type: 'number', defaultValue: 0, min: 0, access: { update: isAdminFieldLevel }, admin: { width: '33%' } },
                { name: 'consecutiveCheckIns', label: '連續簽到天數', type: 'number', defaultValue: 0, min: 0, access: { update: isAdminFieldLevel }, admin: { width: '33%' } },
                { name: 'lastCheckInDate', label: '最後簽到日期 (TPE)', type: 'text', access: { update: isAdminFieldLevel }, admin: { width: '33%', readOnly: true, description: 'YYYY-MM-DD（Asia/Taipei）' } },
              ],
            },
            {
              name: 'subscriptionStatus',
              label: '訂閱狀態',
              type: 'group',
              admin: { description: '會員訂閱狀態與偏好' },
              fields: [
                {
                  type: 'row',
                  fields: [
                    { name: 'emailSubscribed', label: 'Email 訂閱', type: 'checkbox', defaultValue: true, admin: { width: '33%' } },
                    { name: 'smsSubscribed', label: 'SMS 訂閱', type: 'checkbox', defaultValue: false, admin: { width: '33%' } },
                    { name: 'lineSubscribed', label: 'LINE 訂閱', type: 'checkbox', defaultValue: false, admin: { width: '33%' } },
                  ],
                },
                { name: 'unsubscribedAt', label: '取消訂閱日期', type: 'date', admin: { readOnly: true } },
              ],
            },
            {
              name: 'membership',
              label: '付費訂閱會員',
              type: 'group',
              admin: { description: '訂閱系統自動維護（勿手動改），來源 = 會員訂閱 collection' },
              fields: [
                {
                  type: 'row',
                  fields: [
                    { name: 'activePlan', label: '生效方案', type: 'relationship', relationTo: 'subscription-plans', admin: { width: '50%', readOnly: true } },
                    { name: 'activeSubscription', label: '生效訂閱紀錄', type: 'relationship', relationTo: 'user-subscriptions', admin: { width: '50%', readOnly: true } },
                  ],
                },
                {
                  type: 'row',
                  fields: [
                    { name: 'validUntil', label: '權益有效至', type: 'date', admin: { width: '50%', readOnly: true, date: { pickerAppearance: 'dayAndTime' } } },
                    { name: 'streakMonths', label: '連續訂閱月數', type: 'number', defaultValue: 0, admin: { width: '50%', readOnly: true } },
                  ],
                },
              ],
            },
            {
              type: 'row',
              fields: [
                // D-1（2026-08-21）：推薦碼 / 推薦人不可由顧客自改（碰撞/冒用/自導推薦獎勵）；
                // 註冊產碼與綁定推薦人走 hooks / local API，不受欄位權限限制
                { name: 'referralCode', label: '推薦碼', type: 'text', unique: true, access: { update: isAdminFieldLevel }, admin: { width: '50%', description: '此會員的專屬推薦碼（可分享給朋友）' } },
                {
                  name: 'referredBy',
                  label: '推薦人',
                  type: 'relationship',
                  relationTo: 'customers',
                  access: { update: isAdminFieldLevel },
                  admin: { width: '50%', description: '註冊時使用的推薦碼所屬會員' },
                },
              ],
            },
            {
              name: 'registrationReferralRewarded',
              label: '推薦註冊獎勵已發放',
              type: 'checkbox',
              defaultValue: false,
              access: {
                update: ({ req }) => (req.user as { role?: string } | undefined)?.role === 'admin',
              },
              admin: { readOnly: true, description: '防止重複發放推薦註冊獎勵；由系統自動標記' },
            },
          ],
        },

        // ── TAB 3: CRM & 信用 ────────────────────────────────
        {
          label: 'CRM & 信用',
          description: '信用分數、黑名單管理、客服等級',
          fields: [
            {
              type: 'row',
              fields: [
                { name: 'creditScore', label: '信用分數', type: 'number', defaultValue: 100, min: 0, max: 100, access: { update: isAdminFieldLevel }, admin: { width: '33%', description: '0~100，預設 100' } },
                {
                  name: 'creditStatus',
                  label: '信用狀態',
                  type: 'select',
                  defaultValue: 'excellent',
                  options: [
                    { label: '優質好客人 (90-100)', value: 'excellent' },
                    { label: '一般 (70-89)', value: 'normal' },
                    { label: '觀察名單 (50-69)', value: 'watchlist' },
                    { label: '警示名單 (30-49)', value: 'warning' },
                    { label: '黑名單 (10-29)', value: 'blacklist' },
                    { label: '停權 (0-9)', value: 'suspended' },
                  ],
                  access: { update: isAdminFieldLevel },
                  admin: { width: '33%', readOnly: true, description: '系統依信用分數自動判斷' },
                },
                {
                  name: 'serviceLevel',
                  label: '客服等級',
                  type: 'select',
                  defaultValue: 'standard',
                  options: [
                    { label: '標準', value: 'standard' },
                    { label: '優先', value: 'priority' },
                    { label: 'VIP 專屬', value: 'vip' },
                  ],
                  admin: { width: '33%' },
                },
              ],
            },
            {
              type: 'row',
              fields: [
                { name: 'isBlacklisted', label: '黑名單', type: 'checkbox', defaultValue: false, access: { update: isAdminFieldLevel }, admin: { width: '25%', description: '信用分數低於 30 自動標記' } },
                { name: 'isSuspended', label: '停權', type: 'checkbox', defaultValue: false, access: { update: isAdminFieldLevel }, admin: { width: '25%', description: '信用分數低於 10 自動停權' } },
                { name: 'blacklistReason', label: '黑名單原因', type: 'text', admin: { width: '50%', description: '記錄黑名單原因', condition: (data) => Boolean(data?.isBlacklisted) } },
              ],
            },
            {
              name: 'vipOwner',
              label: '專屬 VIP 客服',
              type: 'relationship',
              relationTo: 'users',
              admin: { description: 'T4（星耀皇后）以上指派專屬客服人員（客服是 staff，仍在 users collection）' },
            },
            { name: 'crmNote', label: 'CRM 備註', type: 'textarea', admin: { description: '客服或管理員留下的會員備註' } },
          ],
        },

        // ── TAB 4: 偏好 & 標籤 ────────────────────────────────
        {
          label: '偏好 & 標籤',
          description: '購物偏好、行銷分群標籤',
          fields: [
            {
              name: 'tags',
              label: '會員標籤',
              type: 'array',
              admin: { description: '行銷分群標籤，例如：韓系愛好者、職場穿搭、高回購、沉睡客' },
              fields: [{ name: 'tag', label: '標籤', type: 'text', required: true }],
            },
            {
              type: 'row',
              fields: [
                { name: 'preferredCategory', label: '偏好商品類別', type: 'text', admin: { width: '33%', description: '如：洋裝、上衣、套裝' } },
                { name: 'preferredSize', label: '常購尺碼', type: 'text', admin: { width: '33%', description: '如 M、S/M' } },
                { name: 'preferredColor', label: '偏好色系', type: 'text', admin: { width: '33%', description: '如：米白、黑色、粉色系' } },
              ],
            },
            {
              name: 'bodyProfile',
              label: '身體資料（AI 尺寸推薦用）',
              type: 'group',
              admin: { description: '可選填，系統將自動推薦最合適的尺寸與款式' },
              fields: [
                {
                  type: 'row',
                  fields: [
                    { name: 'height', label: '身高（cm）', type: 'number', min: 100, max: 250, admin: { width: '25%' } },
                    { name: 'weight', label: '體重（kg）', type: 'number', min: 30, max: 200, admin: { width: '25%' } },
                    {
                      name: 'bodyShape',
                      label: '身形',
                      type: 'select',
                      options: [
                        { label: '瘦小', value: 'petite' },
                        { label: '標準', value: 'standard' },
                        { label: '豐滿', value: 'curvy' },
                        { label: '梨型（下身較寬）', value: 'pear' },
                        { label: '蘋果型（中段較寬）', value: 'apple' },
                        { label: '沙漏型（上下均勻）', value: 'hourglass' },
                        { label: '運動型', value: 'athletic' },
                      ],
                      admin: { width: '25%' },
                    },
                    { name: 'preferredSizes', label: '常穿尺寸', type: 'text', admin: { width: '25%', description: '例如 M, S/M' } },
                  ],
                },
                {
                  type: 'row',
                  fields: [
                    { name: 'footLength', label: '腳長（cm）', type: 'number', min: 15, max: 35, admin: { width: '25%', description: '選鞋款時自動建議尺寸' } },
                    { name: 'bust', label: '胸圍（cm）', type: 'number', min: 50, max: 160, admin: { width: '25%' } },
                    { name: 'waist', label: '腰圍（cm）', type: 'number', min: 40, max: 160, admin: { width: '25%' } },
                    { name: 'hips', label: '臀圍（cm）', type: 'number', min: 50, max: 170, admin: { width: '25%' } },
                  ],
                },
              ],
            },
          ],
        },

        // ── TAB 5: 地址 & 社群 ────────────────────────────────
        {
          label: '地址 & 社群',
          description: '地址簿、社群帳號綁定',
          fields: [
            {
              name: 'addresses',
              label: '地址簿',
              type: 'array',
              fields: [
                {
                  type: 'row',
                  fields: [
                    { name: 'label', label: '地址標籤', type: 'text', admin: { width: '30%', description: '例如：住家、公司' } },
                    { name: 'recipientName', label: '收件人姓名', type: 'text', required: true, admin: { width: '35%' } },
                    { name: 'phone', label: '聯絡電話', type: 'text', required: true, admin: { width: '35%' } },
                  ],
                },
                {
                  type: 'row',
                  fields: [
                    { name: 'zipCode', label: '郵遞區號', type: 'text', admin: { width: '15%' } },
                    { name: 'city', label: '縣市', type: 'text', required: true, admin: { width: '20%' } },
                    { name: 'district', label: '鄉鎮區', type: 'text', admin: { width: '20%' } },
                    { name: 'address', label: '詳細地址', type: 'text', required: true, admin: { width: '35%' } },
                    { name: 'isDefault', label: '預設', type: 'checkbox', defaultValue: false, admin: { width: '10%' } },
                  ],
                },
              ],
            },
            {
              name: 'socialLogins',
              label: '社群帳號綁定',
              type: 'group',
              admin: { description: '透過 NextAuth v5（網頁）或原生 SDK（APP）綁定的社群帳號' },
              fields: [
                {
                  type: 'row',
                  fields: [
                    { name: 'googleId', label: 'Google ID', type: 'text', admin: { width: '25%' } },
                    { name: 'facebookId', label: 'Facebook ID', type: 'text', admin: { width: '25%' } },
                    { name: 'lineId', label: 'LINE ID', type: 'text', admin: { width: '25%' } },
                    { name: 'appleId', label: 'Apple ID', type: 'text', admin: { width: '25%' } },
                  ],
                },
              ],
            },
            { name: 'lineUid', label: 'LINE UID', type: 'text', admin: { description: 'LINE 官方帳號用戶 UID，用於推播訊息' } },
          ],
        },

        // ── TAB 6: 活動 & 消費 ────────────────────────────────
        {
          label: '活動 & 消費',
          description: '消費統計、訂單歷史、登入記錄',
          fields: [
            {
              type: 'row',
              fields: [
                { name: 'annualSpend', label: '年度消費金額', type: 'number', defaultValue: 0, min: 0, access: { update: isAdminFieldLevel }, admin: { width: '33%', description: '當年度累計消費，每年 1/1 歸零' } },
                { name: 'lifetimeSpend', label: '歷史累計消費金額', type: 'number', defaultValue: 0, min: 0, access: { update: isAdminFieldLevel }, admin: { width: '33%', description: '自註冊以來累計消費總額' } },
                { name: 'orderCount', label: '訂單總數', type: 'number', defaultValue: 0, min: 0, access: { update: isAdminFieldLevel }, admin: { width: '33%', readOnly: true, description: '系統自動計算' } },
              ],
            },
            {
              type: 'row',
              fields: [
                { name: 'lastOrderDate', label: '最後購買日期', type: 'date', admin: { width: '50%', readOnly: true } },
                { name: 'lastLoginDate', label: '最後登入日期', type: 'date', admin: { width: '50%', readOnly: true } },
              ],
            },
            { name: 'orderHistoryNote', label: '訂單歷史備註', type: 'textarea', admin: { description: '查看完整訂單記錄請前往 Orders 集合篩選此會員', readOnly: true } },
            {
              name: 'firstTouchAttribution',
              label: 'UTM 首次接觸歸因',
              type: 'group',
              admin: {
                description: '會員首次進站（90 天 cookie）的 UTM 來源，註冊時自動寫入。',
                readOnly: true,
              },
              fields: [
                { name: 'utmSource', label: 'UTM Source', type: 'text' },
                { name: 'utmMedium', label: 'UTM Medium', type: 'text' },
                { name: 'utmCampaign', label: 'UTM Campaign', type: 'text' },
                { name: 'utmTerm', label: 'UTM Term', type: 'text' },
                { name: 'utmContent', label: 'UTM Content', type: 'text' },
                { name: 'referrer', label: 'Referrer', type: 'text' },
                { name: 'landingPath', label: '首次進站頁', type: 'text' },
                { name: 'capturedAt', label: '捕獲時間', type: 'date' },
              ],
            },
          ],
        },

        // ── TAB 7: 遊戲 & AI ────────────────────────────────
        {
          label: '遊戲 & AI',
          description: '遊樂場活動記錄、MBTI 個性、AI 推薦 DM',
          fields: [
            {
              name: 'mbtiProfile',
              label: 'MBTI 個性測驗結果',
              type: 'group',
              admin: { description: '會員在 MBTI 個性穿搭測驗中的最近一次結果（用於商品推薦）' },
              fields: [
                {
                  name: 'mbtiType',
                  label: 'MBTI 類型',
                  type: 'select',
                  options: [
                    { label: 'INTJ 建築師', value: 'INTJ' }, { label: 'INTP 邏輯學家', value: 'INTP' },
                    { label: 'ENTJ 指揮官', value: 'ENTJ' }, { label: 'ENTP 辯論家', value: 'ENTP' },
                    { label: 'INFJ 提倡者', value: 'INFJ' }, { label: 'INFP 調停者', value: 'INFP' },
                    { label: 'ENFJ 主人公', value: 'ENFJ' }, { label: 'ENFP 競選者', value: 'ENFP' },
                    { label: 'ISTJ 物流師', value: 'ISTJ' }, { label: 'ISFJ 守衛者', value: 'ISFJ' },
                    { label: 'ESTJ 總經理', value: 'ESTJ' }, { label: 'ESFJ 執政官', value: 'ESFJ' },
                    { label: 'ISTP 鑑賞家', value: 'ISTP' }, { label: 'ISFP 探險家', value: 'ISFP' },
                    { label: 'ESTP 企業家', value: 'ESTP' }, { label: 'ESFP 表演者', value: 'ESFP' },
                  ],
                  admin: { description: '由 MBTI 個性穿搭測驗自動寫入；商品推薦會以此為依據' },
                },
                { name: 'mbtiTakenAt', label: '上次測驗時間', type: 'date', admin: { readOnly: true, description: '系統自動記錄' } },
                { name: 'mbtiScores', label: '測驗分數（JSON）', type: 'json', admin: { readOnly: true, description: '4 維度淨分，系統自動記錄' } },
                {
                  name: 'primaryOccasion',
                  label: '主要場合（MBTI64）',
                  type: 'select',
                  options: [
                    { label: '都會 都會 / 通勤 / 商務', value: 'urban' },
                    { label: '度假 旅行 / 戶外 / 放鬆', value: 'vacation' },
                    { label: '派對 夜晚 / 慶典 / 紅毯', value: 'party' },
                    { label: '居家 在家 / 散步 / 日常', value: 'cozy' },
                  ],
                  admin: { description: '由測驗最後 4 題 lifestyle 場合題自動推算；與 mbtiType 組合 → 64 sub-personality 推薦' },
                },
                { name: 'occasionScores', label: '場合分數（JSON）', type: 'json', admin: { readOnly: true, description: '4 場合票數，系統自動記錄；用於分群與重新推薦' } },
                {
                  name: 'personalityAvatarPreview',
                  type: 'ui',
                  admin: {
                    components: { Field: '@/components/admin/PersonalityAvatarField' },
                  },
                },
              ],
            },
            {
              name: 'gameActivity',
              label: '遊樂場活動記錄',
              type: 'group',
              admin: { description: '記錄會員在遊樂場中參與過的遊戲與獲得的獎勵' },
              fields: [
                {
                  type: 'row',
                  fields: [
                    { name: 'totalGamesPlayed', label: '總遊戲次數', type: 'number', defaultValue: 0, min: 0, admin: { width: '33%', readOnly: true } },
                    { name: 'totalPointsWon', label: '遊戲獲得點數', type: 'number', defaultValue: 0, min: 0, admin: { width: '33%', readOnly: true } },
                    { name: 'favoriteGame', label: '最常玩的遊戲', type: 'text', admin: { width: '33%', readOnly: true } },
                  ],
                },
                {
                  name: 'recentGames',
                  label: '最近遊戲記錄',
                  type: 'array',
                  admin: { readOnly: true, description: '系統自動記錄最近 10 筆遊戲活動' },
                  maxRows: 10,
                  fields: [
                    {
                      type: 'row',
                      fields: [
                        { name: 'gameName', label: '遊戲名稱', type: 'text', admin: { width: '30%' } },
                        { name: 'result', label: '結果', type: 'text', admin: { width: '20%' } },
                        { name: 'reward', label: '獎勵', type: 'text', admin: { width: '25%' } },
                        { name: 'playedAt', label: '時間', type: 'date', admin: { width: '25%' } },
                      ],
                    },
                  ],
                },
              ],
            },
            {
              name: 'gameTermsAcceptance',
              label: '遊戲規範同意紀錄',
              type: 'group',
              admin: { description: 'GameSettings.terms.version 變更時自動失效，會員下次進 /games 須重簽' },
              fields: [
                {
                  type: 'row',
                  fields: [
                    { name: 'acceptedAt', label: '同意時間', type: 'date', admin: { width: '50%', readOnly: true, date: { pickerAppearance: 'dayAndTime' } } },
                    { name: 'acceptedVersion', label: '同意的版本號', type: 'text', admin: { width: '50%', readOnly: true, description: '對齊 GameSettings.terms.version' } },
                  ],
                },
                {
                  type: 'row',
                  fields: [
                    { name: 'adultConfirmed', label: '已確認年滿 20 歲', type: 'checkbox', defaultValue: false, admin: { width: '50%', readOnly: true } },
                    { name: 'acceptanceIp', label: '同意時 IP', type: 'text', admin: { width: '50%', readOnly: true, description: '法律存證用' } },
                  ],
                },
              ],
            },
            {
              name: 'aiDmPreferences',
              label: 'AI 行銷 DM 設定',
              type: 'group',
              admin: { description: '根據會員瀏覽與購買行為，自動產生個人化行銷訊息' },
              fields: [
                {
                  name: 'interestedProducts',
                  label: '感興趣的商品',
                  type: 'relationship',
                  relationTo: 'products',
                  hasMany: true,
                  admin: { description: '系統自動追蹤或手動新增的感興趣商品清單' },
                },
                { name: 'lastDmSentAt', label: '上次 DM 發送時間', type: 'date', admin: { readOnly: true } },
                {
                  name: 'dmChannel',
                  label: 'DM 發送管道',
                  type: 'select',
                  defaultValue: 'email',
                  options: [
                    { label: 'Email', value: 'email' },
                    { label: 'LINE', value: 'line' },
                    { label: 'SMS', value: 'sms' },
                    { label: 'All Channels', value: 'all' },
                  ],
                },
                {
                  name: 'dmHistory',
                  label: 'DM 發送記錄',
                  type: 'array',
                  admin: { readOnly: true },
                  maxRows: 20,
                  fields: [
                    {
                      type: 'row',
                      fields: [
                        { name: 'channel', label: '管道', type: 'text', admin: { width: '15%' } },
                        { name: 'subject', label: '主題', type: 'text', admin: { width: '35%' } },
                        { name: 'status', label: '狀態', type: 'text', admin: { width: '15%' } },
                        { name: 'sentAt', label: '發送時間', type: 'date', admin: { width: '20%' } },
                        { name: 'openedAt', label: '開啟時間', type: 'date', admin: { width: '15%' } },
                      ],
                    },
                  ],
                },
              ],
            },
          ],
        },

        // ── TAB 8: 寶物箱 & 點數紀錄 ────────────────────────────
        {
          label: '寶物箱 & 點數紀錄',
          description: '會員目前擁有的獎項庫存，以及所有點數獲得、兌換、過期、調整紀錄',
          fields: [
            {
              name: 'treasureBoxPanel',
              type: 'ui',
              admin: {
                components: { Field: '@/components/admin/MemberTreasureBoxPanel' },
              },
            },
          ],
        },
      ],
    },
  ],
  timestamps: true,
}
