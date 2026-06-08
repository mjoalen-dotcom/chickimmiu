import { headers as nextHeaders } from 'next/headers'
import { NextResponse } from 'next/server'
import { getPayload } from 'payload'
import config from '@payload-config'

import { getWhiteHatDashboard } from '@/lib/marketing/whiteHatAutomation'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET() {
  const payload = await getPayload({ config })
  const headersList = await nextHeaders()
  const { user } = await payload.auth({ headers: headersList })

  if (!user || (user as unknown as { role?: string }).role !== 'admin') {
    return NextResponse.json({ ok: false, error: '需要管理員權限' }, { status: 403 })
  }

  try {
    const dashboard = await getWhiteHatDashboard(payload as never)
    return NextResponse.json(dashboard)
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    return NextResponse.json({ ok: false, error: message }, { status: 500 })
  }
}
