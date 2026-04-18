import type { Metadata } from 'next'
import { headers as nextHeaders } from 'next/headers'
import { redirect } from 'next/navigation'
import { getPayload } from 'payload'
import config from '@payload-config'

import AddressesClient, { type AddressLite } from './AddressesClient'

export const metadata: Metadata = {
  title: '地址管理',
  robots: { index: false, follow: false },
}

type LooseRecord = Record<string, unknown>

export default async function AddressesPage() {
  const payload = await getPayload({ config })
  const headersList = await nextHeaders()
  const { user: sessionUser } = await payload.auth({ headers: headersList })
  if (!sessionUser) redirect('/login?redirect=/account/addresses')

  const userDoc = (await payload.findByID({
    collection: 'users',
    id: sessionUser.id,
    depth: 0,
  })) as unknown as LooseRecord

  const raw = (userDoc.addresses as LooseRecord[] | null | undefined) ?? []
  const addresses: AddressLite[] = raw.map((a) => ({
    id: a.id ? String(a.id) : null,
    label: (a.label as string | null) ?? null,
    recipientName: (a.recipientName as string | null) ?? null,
    phone: (a.phone as string | null) ?? null,
    zipCode: (a.zipCode as string | null) ?? null,
    city: (a.city as string | null) ?? null,
    district: (a.district as string | null) ?? null,
    address: (a.address as string | null) ?? null,
    isDefault: Boolean(a.isDefault),
  }))

  return <AddressesClient userId={String(sessionUser.id)} addresses={addresses} />
}
