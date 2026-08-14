import Link from 'next/link'
import { getPayload } from 'payload'
import config from '@payload-config'

import GuestJoinForm from '@/components/checkout/GuestJoinForm'
import { verifyGuestClaimToken } from '@/lib/commerce/guestClaimToken'

export const dynamic = 'force-dynamic'

/**
 * 訂單確認信裡「設定密碼成為會員」的落地頁。
 * token 由伺服器驗章（14 天有效）；驗不過就只顯示提示，不露出表單。
 */
export default async function JoinMemberPage({
  searchParams,
}: {
  searchParams: Promise<{ t?: string }>
}) {
  const { t } = await searchParams
  let email: string | undefined
  let valid = false
  try {
    const payload = await getPayload({ config })
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const claim = verifyGuestClaimToken((payload as any).secret as string, t)
    if (claim) {
      valid = true
      email = claim.email
    }
  } catch {
    valid = false
  }

  return (
    <div className="container py-10 md:py-16 max-w-lg">
      <h1 className="text-2xl font-light tracking-wide mb-6">加入會員</h1>
      {valid ? (
        <GuestJoinForm token={t} email={email} />
      ) : (
        <div className="bg-white border border-cream-200 rounded-2xl p-6 text-sm">
          <p className="mb-4">
            這個邀請連結已失效或不正確（連結有效期 14 天）。您仍然可以用訂單編號與手機查詢訂單，
            或直接註冊一個新帳號。
          </p>
          <div className="flex flex-wrap gap-3">
            <Link
              href="/order-lookup"
              className="inline-flex items-center justify-center px-5 py-2.5 border border-foreground/20 rounded-full"
            >
              訂單查詢
            </Link>
            <Link
              href="/register"
              className="inline-flex items-center justify-center px-5 py-2.5 bg-foreground text-cream-50 rounded-full"
            >
              註冊會員
            </Link>
          </div>
        </div>
      )}
    </div>
  )
}
