import { headers as nextHeaders } from 'next/headers'
import { NextResponse } from 'next/server'
import { getPayload } from 'payload'
import config from '@payload-config'

import { runWhiteHatAutomation, type WhiteHatRunOptions } from '@/lib/marketing/whiteHatAutomation'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const MODES = new Set(['all', 'daily', 'weekly', 'seo', 'email', 'procurement', 'video'])

export async function POST(req: Request) {
  const payload = await getPayload({ config })
  const headersList = await nextHeaders()
  const { user } = await payload.auth({ headers: headersList })

  if (!user || (user as unknown as { role?: string }).role !== 'admin') {
    return NextResponse.json({ ok: false, error: '需要管理員權限' }, { status: 403 })
  }

  let body: Partial<WhiteHatRunOptions> = {}
  try {
    body = await req.json()
  } catch {
    body = {}
  }

  const requestedMode = body.mode ?? 'all'
  if (!MODES.has(requestedMode)) {
    return NextResponse.json({ ok: false, error: '不支援的 mode' }, { status: 400 })
  }

  try {
    const result = await runWhiteHatAutomation(payload as never, {
      mode: requestedMode,
      commitSEO: Boolean(body.commitSEO),
      source: 'admin',
    })
    return NextResponse.json({ ok: true, result })
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    return NextResponse.json({ ok: false, error: message }, { status: 500 })
  }
}
