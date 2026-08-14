import { NextResponse } from 'next/server'

import { getEnabledSocialProviders } from '@/lib/auth/socialProviders'

/**
 * GET /api/auth/social-providers —— 目前「真的可用」的社群登入 provider
 *
 * 登入/註冊頁是 server component，直接呼叫 getEnabledSocialProviders()；
 * 結帳頁是 client component 拿不到，改用這支。判斷同一份
 * （resolveSocialAuth：後台開關 AND 憑證齊全，15 秒快取）——
 * 「按鈕出現」⟺「provider 有註冊」，不會再出現點了必進錯誤頁的按鈕。
 *
 * 只回布林旗標，不含任何憑證。
 */
export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const enabled = await getEnabledSocialProviders()
    return NextResponse.json(enabled, {
      headers: { 'Cache-Control': 'private, max-age=15' },
    })
  } catch (err) {
    console.error('[api/auth/social-providers] failed', err)
    // 失敗時一律回全關：寧可少顯示按鈕，也不要給一顆點了會壞的
    return NextResponse.json({ google: false, facebook: false, line: false, apple: false })
  }
}
