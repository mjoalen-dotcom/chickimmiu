import type { Metadata } from 'next'
import { headers as nextHeaders } from 'next/headers'
import { redirect } from 'next/navigation'
import { getPayload } from 'payload'
import config from '@payload-config'

import SettingsClient, { type SettingsInitial } from './SettingsClient'

export const metadata: Metadata = {
  title: '帳號設定',
  robots: { index: false, follow: false },
}

type LooseRecord = Record<string, unknown>

function toDateInputValue(raw: unknown): string {
  if (!raw) return ''
  try {
    const d = new Date(raw as string)
    if (Number.isNaN(d.getTime())) return ''
    const y = d.getFullYear()
    const m = String(d.getMonth() + 1).padStart(2, '0')
    const day = String(d.getDate()).padStart(2, '0')
    return `${y}-${m}-${day}`
  } catch {
    return ''
  }
}

/** number/null → string for controlled inputs */
function toNumStr(raw: unknown): string {
  if (raw === null || raw === undefined || raw === '') return ''
  const n = Number(raw)
  return Number.isFinite(n) ? String(n) : ''
}

function toStr(raw: unknown): string {
  return typeof raw === 'string' ? raw : ''
}

export default async function SettingsPage() {
  const payload = await getPayload({ config })
  const headersList = await nextHeaders()
  const { user: sessionUser } = await payload.auth({ headers: headersList })
  if (!sessionUser) redirect('/login?redirect=/account/settings')

  const userDoc = (await payload.findByID({
    collection: 'users',
    id: sessionUser.id,
    depth: 0,
  })) as unknown as LooseRecord

  const body = (userDoc.bodyProfile as LooseRecord | undefined) ?? {}
  const invoice = (userDoc.invoiceInfo as LooseRecord | undefined) ?? {}

  const initial: SettingsInitial = {
    userId: String(sessionUser.id),
    name: (userDoc.name as string) ?? '',
    email: (userDoc.email as string) ?? '',
    phone: (userDoc.phone as string) ?? '',
    birthday: toDateInputValue(userDoc.birthday),
    // 身體資料（AI 尺寸推薦用）
    bodyProfile: {
      height: toNumStr(body.height),
      weight: toNumStr(body.weight),
      footLength: toNumStr(body.footLength),
      bust: toNumStr(body.bust),
      waist: toNumStr(body.waist),
      hips: toNumStr(body.hips),
    },
    // 公司發票資料（結帳時可一鍵帶入）
    invoiceInfo: {
      invoiceTitle: toStr(invoice.invoiceTitle),
      taxId: toStr(invoice.taxId),
      invoiceAddress: toStr(invoice.invoiceAddress),
      invoiceContactName: toStr(invoice.invoiceContactName),
      invoicePhone: toStr(invoice.invoicePhone),
    },
  }

  return <SettingsClient initial={initial} />
}
