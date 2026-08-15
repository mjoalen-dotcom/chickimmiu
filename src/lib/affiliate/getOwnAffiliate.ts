import type { Payload } from 'payload'
import type { Affiliate } from '@/payload-types'

/**
 * 查詢目前登入使用者自己的 Affiliate 資料（合作夥伴分潤帳戶）。
 * admin 尚未建立 affiliates 紀錄前查不到自己的（正常——admin 不是合作夥伴），
 * 回 null 讓呼叫端顯示「尚未建立合作夥伴資料」。
 */
export async function getOwnAffiliate(
  payload: Payload,
  userId: string | number,
): Promise<Affiliate | null> {
  const res = await payload.find({
    collection: 'affiliates',
    where: { user: { equals: userId } },
    limit: 1,
    depth: 0,
  })
  return (res.docs[0] as Affiliate | undefined) ?? null
}
