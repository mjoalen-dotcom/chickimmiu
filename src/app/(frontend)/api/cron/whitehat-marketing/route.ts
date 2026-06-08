import { NextResponse } from 'next/server'
import { getPayload } from 'payload'
import config from '@payload-config'

import { verifyCronAuth } from '@/lib/cron/auth'
import { runWhiteHatAutomation } from '@/lib/marketing/whiteHatAutomation'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const MODES = new Set(['all', 'daily', 'weekly', 'seo', 'email', 'procurement', 'video'])

export async function POST(request: Request) {
  const authFail = verifyCronAuth(request)
  if (authFail) return authFail

  const url = new URL(request.url)
  const mode = url.searchParams.get('mode') || 'daily'
  if (!MODES.has(mode)) {
    return NextResponse.json({ ok: false, error: 'unsupported_mode' }, { status: 400 })
  }

  const payload = await getPayload({ config })
  const result = await runWhiteHatAutomation(payload as never, {
    mode: mode as never,
    commitSEO: url.searchParams.get('commitSEO') !== '0',
    source: 'cron',
  })

  return NextResponse.json(result)
}
