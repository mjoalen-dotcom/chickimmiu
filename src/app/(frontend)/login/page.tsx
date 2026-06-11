import { Suspense } from 'react'

import { getEnabledSocialProviders } from '@/lib/auth/socialProviders'

import LoginClient from './LoginClient'

// 後台 socialLogin 開關改了要立即生效，不能被 build-time prerender 鎖住
export const dynamic = 'force-dynamic'

export default async function LoginPage() {
  const socialProviders = await getEnabledSocialProviders()
  return (
    <Suspense>
      <LoginClient socialProviders={socialProviders} />
    </Suspense>
  )
}
