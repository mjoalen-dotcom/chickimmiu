import type { Metadata } from 'next'
import { headers as nextHeaders } from 'next/headers'
import { redirect } from 'next/navigation'
import { getPayload } from 'payload'
import config from '@payload-config'

import { InvoicesClient, type InvoiceLite, type InvoiceItemLite } from './InvoicesClient'

export const metadata: Metadata = {
  title: '我的電子發票',
  robots: { index: false, follow: false },
}

type LooseRecord = Record<string, unknown>

function formatDate(raw: unknown): string {
  if (!raw) return ''
  try {
    const d = new Date(raw as string)
    const y = d.getFullYear()
    const m = String(d.getMonth() + 1).padStart(2, '0')
    const day = String(d.getDate()).padStart(2, '0')
    return `${y}-${m}-${day}`
  } catch {
    return ''
  }
}

export default async function InvoicesPage() {
  const payload = await getPayload({ config })
  const headersList = await nextHeaders()
  const { user: sessionUser } = await payload.auth({ headers: headersList })
  if (!sessionUser) redirect('/login?redirect=/account/invoices')

  let invoices: InvoiceLite[] = []

  if (process.env.DATABASE_URI) {
    try {
      const result = await payload.find({
        collection: 'invoices',
        where: { customer: { equals: sessionUser.id } },
        sort: '-createdAt',
        limit: 50,
        depth: 1,
      })

      invoices = (result.docs as unknown as LooseRecord[]).map((doc) => {
        const order = doc.order as LooseRecord | null | undefined
        const carrierInfo = doc.carrierInfo as LooseRecord | null | undefined
        const donationInfo = doc.donationInfo as LooseRecord | null | undefined
        const buyerInfo = doc.buyerInfo as LooseRecord | null | undefined
        const rawItems = (doc.invoiceItems as LooseRecord[] | null | undefined) ?? []

        const items: InvoiceItemLite[] = rawItems.map((it) => ({
          name: (it.itemName as string) ?? '—',
          quantity: (it.itemCount as number) ?? 1,
          price: (it.itemPrice as number) ?? 0,
        }))

        return {
          id: String(doc.id),
          invoiceNumber: (doc.invoiceNumber as string) ?? '',
          date: formatDate(doc.createdAt),
          orderNumber: (order?.orderNumber as string) ?? String(order?.id ?? '—'),
          invoiceType: ((doc.invoiceType as string) ?? 'b2c_personal') as InvoiceLite['invoiceType'],
          status: ((doc.status as string) ?? 'pending') as InvoiceLite['status'],
          totalAmount: (doc.totalAmount as number) ?? 0,
          buyerName: (buyerInfo?.buyerName as string) ?? (buyerInfo?.buyerCompanyName as string) ?? '',
          carrierType: (carrierInfo?.carrierType as string) ?? null,
          loveCode: (donationInfo?.loveCode as string) ?? null,
          items,
        }
      })
    } catch {
      // DB not ready — show empty state
    }
  }

  return <InvoicesClient invoices={invoices} />
}
