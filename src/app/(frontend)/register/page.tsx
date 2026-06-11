import { Suspense } from 'react'

import { getEnabledSocialProviders } from '@/lib/auth/socialProviders'

import RegisterClient from './RegisterClient'

// 後台 socialLogin 開關改了要立即生效，不能被 build-time prerender 鎖住
export const dynamic = 'force-dynamic'

export default async function RegisterPage() {
  const socialProviders = await getEnabledSocialProviders()
  return (
    <Suspense>
      <RegisterClient socialProviders={socialProviders} />
    </Suspense>
  )
}
