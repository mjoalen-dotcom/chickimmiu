/**
 * 個人化內容產生引擎
 * ─────────────────────────────────────
 * CHIC KIM & MIU 行銷內容個人化核心邏輯
 *
 * 根據會員的客群、信用分數、偏好、行為自動產生個人化內容。
 * 支援模板變數替換、信用分數分級變體、客群變體、
 * 以及 AI 推薦商品 + UGC 內容豐富化。
 *
 * ⚠️ 前台介面一律只顯示 TIER_FRONT_NAMES
 *    絕對不可出現 bronze / silver / gold 等金屬分級名稱
 */

import { getPayload } from 'payload'
import config from '@payload-config'
import type { Where } from 'payload'
import { TIER_FRONT_NAMES } from '../crm/tierEngine'

// ══════════════════════════════════════════════════════════
// Types
// ══════════════════════════════════════════════════════════

/** 信用分數內容變體 */
interface CreditScoreVariant {
  minScore: number
  maxScore: number
  contentOverride: string
  extraDiscount: number
}

/** 客群內容變體 */
interface SegmentVariant {
  segment: string
  contentOverride: string
  subjectOverride?: string
}

/** 模板文件型別（從 message-templates 讀取） */
interface TemplateDoc {
  id: string
  name: string
  subject: string
  content: string
  htmlContent?: string
  creditScoreVariants?: CreditScoreVariant[]
  segmentVariants?: SegmentVariant[]
  metadata?: Record<string, unknown>
}

// ══════════════════════════════════════════════════════════
// Core — 產生個人化內容
// ══════════════════════════════════════════════════════════

/**
 * 根據會員的客群、信用分數、偏好、行為自動產生個人化內容
 *
 * 流程：
 * 1. 載入模板與會員資料
 * 2. 依信用分數 / 客群選擇內容變體
 * 3. 替換模板變數（{{user_name}}, {{tier_front_name}} 等）
 * 4. 回傳個人化後的主旨與內容
 *
 * @param templateId - 模板 ID（message-templates）
 * @param userId - 會員 ID
 * @returns 個人化後的主旨、內容與中繼資料
 */
export async function generatePersonalizedContent(
  templateId: string,
  userId: string,
): Promise<{ subject: string; content: string; metadata: Record<string, unknown> }> {
  const payload = await getPayload({ config })

  // 載入模板
  const templateDoc = await payload.findByID({
    collection: 'message-templates',
    id: templateId,
  })
  const template = templateDoc as unknown as TemplateDoc

  // 載入會員資料
  const userDoc = await payload.findByID({ collection: 'users', id: userId })
  const user = userDoc as unknown as Record<string, unknown>

  const tierCode = typeof user.tier === 'string' ? user.tier : 'ordinary'
  const creditScore = typeof user.creditScore === 'number' ? user.creditScore : 60
  const userName = typeof user.name === 'string' ? user.name : '貴賓'
  const pointsBalance = typeof user.pointsBalance === 'number' ? user.pointsBalance : 0
  const email = typeof user.email === 'string' ? user.email : ''

  // 查詢會員分群
  let segmentCode = 'REG1'
  let segmentLabel = '穩定優雅會員'
  try {
    const segQuery: Where = { user: { equals: userId } }
    const segResult = await payload.find({
      collection: 'member-segments',
      where: segQuery satisfies Where,
      limit: 1,
    })
    if (segResult.docs.length > 0) {
      const segDoc = segResult.docs[0] as unknown as Record<string, unknown>
      segmentCode = typeof segDoc.currentSegment === 'string' ? segDoc.currentSegment : 'REG1'
      segmentLabel = typeof segDoc.segmentLabel === 'string' ? segDoc.segmentLabel : '穩定優雅會員'
    }
  } catch {
    // 查詢失敗時使用預設值
  }

  // ── 建立變數對照表（⚠️ 只使用前台名稱，不暴露後台代碼）──
  const tierFrontName = TIER_FRONT_NAMES[tierCode] ?? '會員'
  const variables: Record<string, string> = {
    user_name: userName,
    tier_front_name: tierFrontName,
    credit_score: String(creditScore),
    points_balance: String(pointsBalance),
    email,
    segment_label: segmentLabel,
    brand_name: 'CHIC KIM & MIU',
    current_date: new Date().toLocaleDateString('zh-TW'),
  }

  // ── 選擇內容變體 ──
  let subject = template.subject
  let content = template.content
  const metadata: Record<string, unknown> = {
    templateId,
    userId,
    tierFrontName,
    creditScore,
    segmentCode,
    segmentLabel,
  }

  // 信用分數變體
  if (template.creditScoreVariants && template.creditScoreVariants.length > 0) {
    const creditVariant = selectCreditScoreVariant(template.creditScoreVariants, creditScore)
    if (creditVariant) {
      content = creditVariant.content
      metadata.creditScoreVariantApplied = true
      metadata.extraDiscount = creditVariant.extraDiscount
      if (creditVariant.extraDiscount > 0) {
        variables['extra_discount'] = String(creditVariant.extraDiscount)
      }
    }
  }

  // 客群變體
  if (template.segmentVariants && template.segmentVariants.length > 0) {
    const segVariant = selectSegmentVariant(template.segmentVariants, segmentCode)
    if (segVariant) {
      content = segVariant.content
      if (segVariant.subject) {
        subject = segVariant.subject
      }
      metadata.segmentVariantApplied = true
    }
  }

  // ── 替換模板變數 ──
  subject = replaceTemplateVariables(subject, variables)
  content = replaceTemplateVariables(content, variables)

  return { subject, content, metadata }
}

// ══════════════════════════════════════════════════════════
// Core — 模板變數替換
// ══════════════════════════════════════════════════════════

/**
 * 替換模板中的變數
 *
 * 支援 {{variable_name}} 格式。
 * 常用變數：
 * - {{user_name}} — 會員姓名
 * - {{tier_front_name}} — 等級前台稱號（⚠️ 絕不暴露後台代碼）
 * - {{credit_score}} — 信用分數
 * - {{points_balance}} — 點數餘額
 * - {{email}} — Email
 * - {{segment_label}} — 客群前台標籤
 * - {{brand_name}} — 品牌名稱
 * - {{current_date}} — 當天日期
 * - {{extra_discount}} — 額外折扣
 *
 * @param template - 含變數的模板字串
 * @param variables - 變數對照表
 * @returns 替換後的字串
 */
export function replaceTemplateVariables(
  template: string,
  variables: Record<string, string>,
): string {
  let result = template

  for (const [key, value] of Object.entries(variables)) {
    // 替換 {{key}} 格式
    const pattern = new RegExp(`\\{\\{\\s*${key}\\s*\\}\\}`, 'g')
    result = result.replace(pattern, value)
  }

  return result
}

// ══════════════════════════════════════════════════════════
// Core — 信用分數內容變體選擇
// ══════════════════════════════════════════════════════════

/**
 * 根據信用分數選擇對應的內容變體
 *
 * 遍歷所有變體，找到信用分數落在 [minScore, maxScore] 範圍內的變體。
 * 高信用分數 = 更好的內容（更高折扣、更多專屬優惠）。
 *
 * @param variants - 變體陣列
 * @param creditScore - 目前信用分數
 * @returns 匹配的內容與額外折扣，若無匹配則回傳 null
 */
export function selectCreditScoreVariant(
  variants: Array<{ minScore: number; maxScore: number; contentOverride: string; extraDiscount: number }>,
  creditScore: number,
): { content: string; extraDiscount: number } | null {
  for (const variant of variants) {
    if (creditScore >= variant.minScore && creditScore <= variant.maxScore) {
      return {
        content: variant.contentOverride,
        extraDiscount: variant.extraDiscount,
      }
    }
  }
  return null
}

// ══════════════════════════════════════════════════════════
// Core — 客群內容變體選擇
// ══════════════════════════════════════════════════════════

/**
 * 根據客群選擇對應的內容變體
 *
 * 依 segment code 匹配變體。每個客群可有專屬的文案與主旨。
 *
 * @param variants - 變體陣列
 * @param segment - 客群代碼
 * @returns 匹配的內容與主旨，若無匹配則回傳 null
 */
export function selectSegmentVariant(
  variants: Array<{ segment: string; contentOverride: string; subjectOverride?: string }>,
  segment: string,
): { content: string; subject?: string } | null {
  const match = variants.find((v) => v.segment === segment)
  if (!match) return null

  return {
    content: match.contentOverride,
    subject: match.subjectOverride,
  }
}

// ══════════════════════════════════════════════════════════
// Core — 豐富化內容（推薦商品 + UGC）
// ══════════════════════════════════════════════════════════

/**
 * 組合 AI 推薦商品 + UGC 內容到行銷訊息中
 *
 * 在 {{recommended_products}} 標記處插入推薦商品區塊，
 * 在 {{ugc_reviews}} 標記處插入精選用戶評價。
 *
 * @param content - 原始內容（含 {{recommended_products}} 與 {{ugc_reviews}} 標記）
 * @param userId - 會員 ID
 * @param maxProducts - 最多推薦商品數量
 * @returns 豐富化後的內容
 */
export async function enrichContentWithRecommendations(
  content: string,
  userId: string,
  maxProducts: number,
): Promise<string> {
  const payload = await getPayload({ config })
  let enrichedContent = content

  // ── 推薦商品 ──
  try {
    // 查詢近期熱門商品（簡化版：以最新上架且有庫存為主）
    const productsResult = await payload.find({
      collection: 'products',
      where: {
        _status: { equals: 'published' },
      } satisfies Where,
      sort: '-createdAt',
      limit: maxProducts,
    })

    if (productsResult.docs.length > 0) {
      const productLines = productsResult.docs.map((doc) => {
        const p = doc as unknown as Record<string, unknown>
        const name = typeof p.title === 'string' ? p.title : typeof p.name === 'string' ? p.name : '商品'
        const price = typeof p.price === 'number' ? `NT$${p.price.toLocaleString()}` : ''
        return `- ${name} ${price}`
      })

      const productBlock = productLines.join('\n')
      enrichedContent = enrichedContent.replace(
        /\{\{\s*recommended_products\s*\}\}/g,
        productBlock,
      )
    } else {
      enrichedContent = enrichedContent.replace(/\{\{\s*recommended_products\s*\}\}/g, '')
    }
  } catch (error) {
    console.error('[Marketing] 推薦商品查詢失敗:', error)
    enrichedContent = enrichedContent.replace(/\{\{\s*recommended_products\s*\}\}/g, '')
  }

  // ── UGC 精選評價 ──
  try {
    const reviewsQuery: Where = {
      status: { equals: 'approved' },
    }

    const reviewsResult = await payload.find({
      collection: 'product-reviews',
      where: reviewsQuery satisfies Where,
      sort: '-createdAt',
      limit: 3,
    })

    if (reviewsResult.docs.length > 0) {
      const reviewLines = reviewsResult.docs.map((doc) => {
        const r = doc as unknown as Record<string, unknown>
        const reviewContent = typeof r.content === 'string' ? r.content : ''
        const rating = typeof r.rating === 'number' ? r.rating : 5
        const stars = '★'.repeat(rating) + '☆'.repeat(Math.max(0, 5 - rating))
        // 截取前 50 字
        const snippet = reviewContent.length > 50
          ? reviewContent.substring(0, 50) + '...'
          : reviewContent
        return `${stars} ${snippet}`
      })

      const reviewBlock = reviewLines.join('\n')
      enrichedContent = enrichedContent.replace(
        /\{\{\s*ugc_reviews\s*\}\}/g,
        reviewBlock,
      )
    } else {
      enrichedContent = enrichedContent.replace(/\{\{\s*ugc_reviews\s*\}\}/g, '')
    }
  } catch (error) {
    console.error('[Marketing] UGC 評價查詢失敗:', error)
    enrichedContent = enrichedContent.replace(/\{\{\s*ugc_reviews\s*\}\}/g, '')
  }

  return enrichedContent
}
