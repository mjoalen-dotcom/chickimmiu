import { headers as nextHeaders } from 'next/headers'
import { getPayload } from 'payload'
import config from '@payload-config'
import { auth as nextAuth } from '@/auth'

export interface CurrentUser {
  id: string | number
  email: string
  name: string
  source: 'payload' | 'nextauth'
}

/**
 * Canonical 當前使用者（SSR helper）
 * ------------------------------------
 * 優先 Payload session cookie（`payload-token`）→ fallback NextAuth session。
 *
 * Email/pw 與 OAuth 登入最終都會有 Payload session cookie（OAuth 經
 * `/api/auth/bridge` 補寫），所以 Payload 當主要真相來源、NextAuth 只
 * 覆蓋 OAuth 剛完成尚未過 bridge 的短暫狀態。
 */
export async function getCurrentUser(): Promise<CurrentUser | null> {
  const headersList = await nextHeaders()

  try {
    const payload = await getPayload({ config })
    const { user } = await payload.auth({ headers: headersList })
    if (user && user.email) {
      const u = user as { id: string | number; email: string; name?: string }
      return {
        id: u.id,
        email: u.email,
        name: u.name || u.email.split('@')[0],
        source: 'payload',
      }
    }
  } catch {
    // Payload 初始化或 DB 失敗 → 不擋整頁，fallback NextAuth
  }

  try {
    const session = await nextAuth()
    if (session?.user?.email) {
      return {
        id: session.user.id || '',
        email: session.user.email,
        name: session.user.name || session.user.email.split('@')[0],
        source: 'nextauth',
      }
    }
  } catch {
    // ignore
  }

  return null
}
