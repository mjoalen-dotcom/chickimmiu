import type { Metadata } from 'next'
import { headers as nextHeaders } from 'next/headers'
import { redirect } from 'next/navigation'
import { getPayload } from 'payload'
import config from '@payload-config'

import InvoicesClient, { type InvoiceLite } from './InvoicesClient'

export const metadata: Metadata = {
  title: '電子發票',
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

const CARRIER_TYPE_LABEL: Record<string, string> = {
  phone_barcode: '手機條碼',
  natural_cert: '自然人憑證',
  ecpay_member: '綠界會員載具',
}

export default async function InvoicesPage() {
  const payload = await getPayload({ config })
  const headersList = await nextHeaders()
  const { user: sessionUser } = await payload.auth({ headers: headersList })
  if (!sessionUser) redirect('/login?redirect=/account/invoices')

  const result = await payload.find({
    collection: 'invoices',
    where: { customer: { equals: sessionUser.id } },
    sort: '-createdAt',
    limit: 50,
    depth: 1,
  })

  const invoices: InvoiceLite[] = (result.docs as unknown as LooseRecord[]).map((doc) => {
    const order = (doc.order as LooseRecord | null) ?? null
    const orderNumber = order
      ? ((order.orderNumber as string) ?? String(order.id ?? '—'))
      : '—'

    const buyerInfo = (doc.buyerInfo as LooseRecord | null) ?? {}
    const carrierInfo = (doc.carrierInfo as LooseRecord | null) ?? {}
    const donationInfo = (doc.donationInfo as LooseRecord | null) ?? {}
    const rawItems = (doc.invoiceItems as LooseRecord[] | null | undefined) ?? []

    const carrierTypeKey = (carrierInfo.carrierType as string | null | undefined) ?? 'none'
    const carrierNumber = (carrierInfo.carrierNumber as string | null | undefined) ?? ''
    const carrierDisplay =
      carrierTypeKey && carrierTypeKey !== 'none'
        ? [CARRIER_TYPE_LABEL[carrierTypeKey] ?? carrierTypeKey, carrierNumber]
            .filter(Boolean)
            .join(' ')
        : null

    const buyerName =
      (buyerInfo.buyerCompanyName as string | null | undefined) ||
      (buyerInfo.buyerName as string | null | undefined) ||
      '—'

    return {
      id: String(doc.id),
      invoiceNumber: (doc.invoiceNumber as string) ?? '—',
      date: formatDate(doc.createdAt),
      orderNumber,
      invoiceType: (doc.invoiceType as string) ?? 'b2c_personal',
      status: (doc.status as string) ?? 'pending',
      totalAmount: (doc.totalAmount as number) ?? 0,
      buyerName,
      carrierDisplay,
      loveCode: (donationInfo.loveCode as string | null | undefined) ?? null,
      pdfUrl: (doc.pdfUrl as string | null | undefined) ?? null,
      items: rawItems.map((it) => ({
        name: (it.itemName as string) ?? '—',
        quantity: (it.itemCount as number) ?? 1,
        price: (it.itemPrice as number) ?? 0,
      })),
    }
  })

  return <InvoicesClient invoices={invoices} />
}
