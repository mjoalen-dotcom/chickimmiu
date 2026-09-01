import type { CollectionConfig } from 'payload'
import { isAdmin } from '../access/isAdmin'
import { awardActivityPoints } from '../lib/app-activities/award'

/**
 * 團購 好物分享（App 專屬活動二）
 * ═══════════════════════════════
 * 工單 2026-08-25。刻意另開 collection 而非沿用 product-reviews：本活動綁的是
 * 團購文章不是商品、也沒有星等（塞進去會有兩個必填欄位無值可填），另需精選、
 * 留言數、可編輯期限，既有的都沒有。photos 沿用 product-reviews.photos 的形狀。
 *
 * 可見性（後端在所有查詢介面須遵守）：
 *   pending  待審核 —— 僅作者本人
 *   approved 已通過 —— 所有人
 *   rejected 未通過 —— 僅作者本人
 *   deleted  作者刪除（軟刪除）—— 無人
 *
 * 發獎時機是「審核通過時」，不是送出時。已通過的分享若因檢舉需下架，改回 rejected
 * 即可（作者仍看得到自己那篇、他人看不到），已發放的獎勵不追回。
 *
 * Access：全 admin-only；App 一律走 /api/app/group-buy/* 端點（overrideAccess）。
 */
export const GroupBuyShares: CollectionConfig = {
  slug: 'group-buy-shares',
  labels: { singular: '團購好物分享', plural: '團購好物分享' },
  admin: {
    group: '⑤ 互動體驗',
    useAsTitle: 'articleTitle',
    defaultColumns: ['user', 'articleTitle', 'status', 'isFeatured', 'commentCount', 'createdAt'],
    description:
      'App 團購好物分享（審核制）。標為「金金精選」會即時發放精選加碼點數 —— 僅 approved 的分享會發',
  },
  access: { read: isAdmin, create: isAdmin, update: isAdmin, delete: isAdmin },
  timestamps: true,
  hooks: {
    afterChange: [
      async ({ doc, previousDoc, operation, req, context }) => {
        if (operation !== 'update') return doc
        // ⚠️ 本 hook 內所有寫入都要帶 req（沿用外層交易）：afterChange 執行時
        // 外層交易仍持有這一列的鎖，另開交易去改同一列會互等到 timeout。
        // 發點同理用 req.transactionID，順便滿足工單「加點與帳本同一交易」。
        // 本 hook 自己觸發的更新不再進來一次
        if (context?.groupBuyFeaturedHook) return doc

        const payload = req.payload
        // req.transactionID 型別含 Promise（Payload 內部延遲建立），只取已解析的純值；
        // 沒有就讓 awardActivityPoints 自己開一個交易。
        const txID =
          typeof req.transactionID === 'string' || typeof req.transactionID === 'number'
            ? req.transactionID
            : undefined
        const nowFeatured = doc.isFeatured === true
        const wasFeatured = previousDoc?.isFeatured === true
        const nowApproved = doc.status === 'approved'
        const wasApproved = previousDoc?.status === 'approved'

        // A) 離開 approved（編輯退回 pending、或因檢舉改 rejected）→ 取消精選版位。
        //    featuredAt 保留不清除，所以之後再次精選也不會重複發獎。
        if (wasApproved && !nowApproved && nowFeatured) {
          await payload
            .update({
              collection: 'group-buy-shares',
              id: doc.id,
              data: { isFeatured: false } as never,
              overrideAccess: true,
              req,
              context: { groupBuyFeaturedHook: true },
            })
            .catch((e: unknown) =>
              console.error(
                '[group-buy-shares] 離開 approved 時取消精選失敗:',
                e instanceof Error ? e.message : String(e),
              ),
            )
          return doc
        }

        // B) 審核通過 → 發分享獎勵。
        //    發獎時機是「審核通過時」，不是送出時（工單指定）。
        //    冪等：本篇 rewarded 旗標 + 「同會員同文章只有第一篇發獎」。
        //    編輯退回 pending 再通過時不會重發，因為 rewarded 已為真。
        if (!wasApproved && nowApproved && doc.rewarded !== true) {
          try {
            const settings = (await payload.findGlobal({
              slug: 'app-activity-settings',
              depth: 0,
            })) as unknown as Record<string, unknown>
            const cfg = (settings.groupBuyShare as Record<string, unknown>) || {}
            const points = Math.max(0, Math.floor(Number(cfg.sharePoints ?? 0)))
            const userId =
              typeof doc.user === 'object' && doc.user !== null
                ? (doc.user as { id: string | number }).id
                : (doc.user as string | number)
            const articleId =
              typeof doc.article === 'object' && doc.article !== null
                ? (doc.article as { id: string | number }).id
                : (doc.article as string | number)

            const { hasRewardedShare } = await import('../lib/app-activities/groupBuy')
            const alreadyRewarded =
              userId != null && articleId != null
                ? await hasRewardedShare(payload, userId, articleId)
                : false

            if (!alreadyRewarded && points > 0 && userId != null) {
              await awardActivityPoints(payload, {
                userId,
                amount: points,
                source: 'product_review',
                description: '團購好物分享獎勵',
                existingTransactionID: txID,
              })
            }
            // 不論有無實際發點都標記 rewarded，避免每次通過審核都重跑判定
            await payload.update({
              collection: 'group-buy-shares',
              id: doc.id,
              data: { rewarded: true } as never,
              overrideAccess: true,
              req,
              context: { groupBuyFeaturedHook: true },
            })
          } catch (e) {
            console.error(
              '[group-buy-shares] 分享獎勵發放失敗:',
              e instanceof Error ? e.message : String(e),
            )
          }
        }

        // C) 標為精選 → 發精選加碼。
        //    冪等以 featuredAt 是否曾被寫入判斷，不可用 isFeatured：後台可以取消精選
        //    再重新標記，用 isFeatured 判斷會被當成第一次而重複發獎。
        if (!wasFeatured && nowFeatured && nowApproved && !doc.featuredAt) {
          try {
            const settings = (await payload.findGlobal({
              slug: 'app-activity-settings',
              depth: 0,
            })) as unknown as Record<string, unknown>
            const cfg = (settings.groupBuyShare as Record<string, unknown>) || {}
            const points = Math.max(0, Math.floor(Number(cfg.featuredPoints ?? 0)))
            const userId =
              typeof doc.user === 'object' && doc.user !== null
                ? (doc.user as { id: string | number }).id
                : (doc.user as string | number)

            if (points > 0 && userId != null) {
              await awardActivityPoints(payload, {
                userId,
                amount: points,
                source: 'product_review_featured',
                description: '團購好物分享．金金精選加碼',
                existingTransactionID: txID,
              })
            }
            // featuredAt 一經寫入不覆蓋（冪等依據）
            await payload.update({
              collection: 'group-buy-shares',
              id: doc.id,
              data: { featuredAt: new Date().toISOString() } as never,
              overrideAccess: true,
              req,
              context: { groupBuyFeaturedHook: true },
            })
          } catch (e) {
            console.error(
              '[group-buy-shares] 精選加碼發放失敗:',
              e instanceof Error ? e.message : String(e),
            )
          }
        }

        return doc
      },
    ],
  },
  fields: [
    {
      name: 'user',
      label: '會員',
      type: 'relationship',
      relationTo: 'customers',
      required: true,
      index: true,
      admin: {
        description:
          '分享牆是公開場合：顯示名稱取 nickname，未設定時回遮罩姓名（不可回 name），頭像取 avatar',
      },
    },
    {
      name: 'article',
      label: '團購文章',
      type: 'relationship',
      relationTo: 'blog-posts',
      required: true,
      index: true,
      maxDepth: 0,
    },
    {
      name: 'articleTitle',
      label: '文章標題（快照）',
      type: 'text',
      admin: { description: '建立時的標題快照；文章改標題或下架後，分享仍顯示當時的團購名稱' },
    },
    { name: 'purchaseDate', label: '購買日期', type: 'date' },
    {
      name: 'orderNumber',
      label: '訂單編號（正規化後）',
      type: 'text',
      index: true,
      admin: { description: '僅後台對單用，不回傳給前台。已去空白／全形轉半形／轉大寫' },
    },
    { name: 'content', label: '分享內容', type: 'textarea', required: true },
    {
      name: 'photos',
      label: '分享照片',
      type: 'array',
      admin: { description: '張數上限由 App 活動設定控制，不寫死' },
      fields: [
        { name: 'image', label: '照片', type: 'upload', relationTo: 'media', required: true },
      ],
    },
    {
      name: 'commentCount',
      label: '留言數',
      type: 'number',
      defaultValue: 0,
      min: 0,
      admin: { readOnly: true, description: '只計 published 的留言，隱藏留言不計入' },
    },
    {
      type: 'row',
      fields: [
        {
          name: 'isFeatured',
          label: '金金精選',
          type: 'checkbox',
          defaultValue: false,
          admin: { width: '50%', description: '勾選即發放精選加碼（僅 approved 的分享會發）' },
        },
        {
          name: 'featuredAt',
          label: '首次精選時間',
          type: 'date',
          admin: {
            width: '50%',
            readOnly: true,
            description: '精選加碼的冪等依據，一經寫入不覆蓋；取消精選後再標記不會重複發獎',
          },
        },
      ],
    },
    {
      name: 'status',
      label: '狀態',
      type: 'select',
      required: true,
      defaultValue: 'pending',
      index: true,
      options: [
        { label: '待審核', value: 'pending' },
        { label: '已通過', value: 'approved' },
        { label: '未通過', value: 'rejected' },
        { label: '作者已刪除', value: 'deleted' },
      ],
      admin: { description: '改為「已通過」時由端點發放分享獎勵；下架請改回「未通過」' },
    },
    {
      name: 'editableUntil',
      label: '可編輯至',
      type: 'date',
      admin: { readOnly: true, description: '建立時間 + 設定的可編輯時數，與審核進度無關' },
    },
    {
      name: 'rewarded',
      label: '已發過分享獎勵',
      type: 'checkbox',
      defaultValue: false,
      admin: {
        readOnly: true,
        description:
          '審核通過時寫入。「同會員同文章只有第一篇發獎」是查該會員在該文章是否已有任一筆 rewarded（含已刪除的）',
      },
    },
  ],
}
