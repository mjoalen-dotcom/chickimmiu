import { Suspense } from 'react'

import OrderLookupClient from './OrderLookupClient'

export const dynamic = 'force-dynamic'

export default function OrderLookupPage() {
  return (
    <Suspense>
      <OrderLookupClient />
    </Suspense>
  )
}
