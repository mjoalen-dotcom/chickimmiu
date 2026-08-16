/**
 * Orders × Affiliates 分潤歸因（beforeChange，create only）
 * ─────────────────────────────────────────────────────────
 * client（或 guest-order route）只送 `affiliateInfo.referralCode` 這一個字串；
 * 其餘欄位（affiliateUser／commissionRate／commissionAmount／commissionStatus）
 * 一律由這支 hook 依 referralCode 查 Affiliates 表後自己算，絕不採信 client
 * 送來的其他值——同一原則跟 beforeChangeServerPricing 對金額的態度一致，
 * 只是這裡不需要對 local API 呼叫端放行（guest-order route 自己也是把
 * referralCode 從 server 端讀到的 cookie 值傳進來，不是轉傳 client body），
 * 所以兩種入單管道都統一走這支 hook 處理。
 *
 * referralCode 找不到對應 active 的 Affiliate → 整段 affiliateInfo 清空
 * （不留半殘資料，避免壞碼/過期碼在訂單上留下誤導性痕跡）。
 *
 * commissionAmount 用當下 order 的 total（此時已經過 beforeChangeServerPricing
 * 重算，是伺服器權威金額）× commissionRate 算，四捨五入到整數（新台幣無小數）。
 * 之後 Orders.afterChange 既有的分潤累加 hook 會在付款確認後把這筆金額
 * 累加進 Affiliates.totalEarnings / pendingAmount。
 */
import type { CollectionBeforeChangeHook } from 'payload'

export const beforeChangeAffiliateAttribution: CollectionBeforeChangeHook = async ({
  data,
  operation,
  req,
}) => {
  if (operation !== 'create' || !data) return data

  const incoming = (data as Record<string, unknown>).affiliateInfo as
    | { referralCode?: unknown }
    | undefined
  const referralCode =
    typeof incoming?.referralCode === 'string' ? incoming.referralCode.trim() : ''

  if (!referralCode) {
    // 沒有推薦碼：確保欄位乾淨，不留 client 亂塞的其他值
    return { ...data, affiliateInfo: undefined }
  }

  try {
    const affRes = await req.payload.find({
      collection: 'affiliates',
      where: {
        and: [{ referralCode: { equals: referralCode } }, { status: { equals: 'active' } }],
      },
      limit: 1,
      depth: 0,
      overrideAccess: true,
    })
    const affiliate = affRes.docs[0] as
      | { id: number | string; user: number | string | { id: number | string }; commissionRate: number }
      | undefined

    if (!affiliate) {
      return { ...data, affiliateInfo: undefined }
    }

    const affiliateUserId =
      typeof affiliate.user === 'object' ? affiliate.user.id : affiliate.user
    const total = Number((data as Record<string, unknown>).total) || 0
    const rate = Number(affiliate.commissionRate) || 0
    const commissionAmount = Math.round((total * rate) / 100)

    return {
      ...data,
      affiliateInfo: {
        referralCode,
        affiliateUser: affiliateUserId,
        commissionRate: rate,
        commissionAmount,
        commissionStatus: 'pending',
      },
    }
  } catch (err) {
    req.payload.logger.error({
      err,
      msg: 'Orders beforeChange: affiliate attribution failed',
      referralCode,
    })
    // 分潤查詢失敗不該擋單——顧客結帳體驗優先，清空欄位讓訂單照常建立
    return { ...data, affiliateInfo: undefined }
  }
}
