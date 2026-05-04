'use server'

import { headers, cookies } from 'next/headers'
import { createHash } from 'crypto'
import { getPayload } from 'payload'
import config from '@payload-config'

import { sendMetaCAPI } from '@/lib/tracking'
import type { CAPIEventData } from '@/lib/tracking'

/* ─── 設定來源解析 ─── */

interface CAPIConfig {
  pixelId: string
  accessToken: string
  testEventCode?: string
  source: 'env' | 'db'
}

/**
 * 多來源解析 CAPI 設定。
 *
 * 優先序：env (`META_CAPI_ACCESS_TOKEN` + `NEXT_PUBLIC_META_PIXEL_ID`)
 *        → DB (`GlobalSettings.tracking.metaCapiToken` + `GlobalSettings.tracking.metaPixelId`)
 *        → null（任一空就 no-op）
 *
 * Test event code 永遠來自 env (`META_CAPI_TEST_EVENT_CODE`)；
 * 在 prod 設了會把所有事件 routed 到 Meta「測試事件」工具，不影響真實 conversion。
 */
async function resolveCAPIConfig(): Promise<CAPIConfig | null> {
  const testEventCode = process.env.META_CAPI_TEST_EVENT_CODE || undefined

  const envToken = process.env.META_CAPI_ACCESS_TOKEN || ''
  const envPixelId = process.env.NEXT_PUBLIC_META_PIXEL_ID || ''
  if (envToken && envPixelId) {
    return { pixelId: envPixelId, accessToken: envToken, testEventCode, source: 'env' }
  }

  try {
    const payload = await getPayload({ config })
    const settings = (await payload.findGlobal({ slug: 'global-settings' })) as
      | { tracking?: { metaPixelId?: string; metaCapiToken?: string } }
      | null
    const dbToken = settings?.tracking?.metaCapiToken || ''
    const dbPixelId = settings?.tracking?.metaPixelId || envPixelId
    if (dbToken && dbPixelId) {
      return { pixelId: dbPixelId, accessToken: dbToken, testEventCode, source: 'db' }
    }
  } catch (err) {
    console.warn('[CAPI] resolveCAPIConfig: GlobalSettings lookup failed', err)
  }

  return null
}

/* ─── PII hash + 請求中介資訊 ─── */

function sha256Lower(value: string | undefined | null): string | undefined {
  if (!value) return undefined
  const normalized = value.toLowerCase().trim()
  if (!normalized) return undefined
  return createHash('sha256').update(normalized).digest('hex')
}

/**
 * 把使用者輸入的電話正規化（去空白/連字號/括號），保留國碼前綴 +。
 * 例：'02-1234-5678' → '0212345678'，'+886 912 345 678' → '+886912345678'
 */
function normalizePhone(phone: string | undefined | null): string | undefined {
  if (!phone) return undefined
  return phone.replace(/[\s\-()]/g, '')
}

async function readClientHints(): Promise<{
  ip?: string
  userAgent?: string
  fbp?: string
  fbc?: string
}> {
  const h = await headers()
  const c = await cookies()

  // X-Forwarded-For 第一段是 client，後面是中介 proxy
  const xff = h.get('x-forwarded-for') || ''
  const ip = xff.split(',')[0]?.trim() || h.get('x-real-ip') || undefined

  return {
    ip,
    userAgent: h.get('user-agent') || undefined,
    fbp: c.get('_fbp')?.value,
    fbc: c.get('_fbc')?.value,
  }
}

/* ─── Server Actions ─── */

/**
 * Server Action：發送 Meta Conversions API Purchase 事件
 *
 * 跟客戶端 Pixel `fbq('track','Purchase')` 雙線送 — Meta 用 (event_name, event_id)
 * 去重。eventID 由呼叫端產（建議 `purchaseEventId(orderNumber)`）。
 *
 * 缺 token 或缺 pixelId 自動 no-op，不丟錯，不擋 checkout。
 */
export async function sendServerPurchaseEvent(data: {
  transactionId: string
  value: number
  currency: string
  items: { id: string; name: string; quantity: number; price?: number }[]
  userEmail?: string
  userPhone?: string
  eventID: string
  sourceUrl?: string
}): Promise<{ ok: boolean; reason?: string; source?: string }> {
  const cfg = await resolveCAPIConfig()
  if (!cfg) {
    if (process.env.NODE_ENV === 'development') {
      console.log('[CAPI] no-op: missing pixelId or accessToken')
    }
    return { ok: false, reason: 'missing_config' }
  }

  const hints = await readClientHints()

  const event: CAPIEventData = {
    event_name: 'Purchase',
    event_time: Math.floor(Date.now() / 1000),
    event_id: data.eventID,
    action_source: 'website',
    event_source_url: data.sourceUrl,
    user_data: {
      client_ip_address: hints.ip,
      client_user_agent: hints.userAgent,
      fbp: hints.fbp,
      fbc: hints.fbc,
      ...(data.userEmail
        ? { em: [sha256Lower(data.userEmail)].filter(Boolean) as string[] }
        : {}),
      ...(data.userPhone
        ? { ph: [sha256Lower(normalizePhone(data.userPhone))].filter(Boolean) as string[] }
        : {}),
    },
    custom_data: {
      currency: data.currency,
      value: data.value,
      content_ids: data.items.map((i) => i.id),
      contents: data.items.map((i) => ({
        id: i.id,
        quantity: i.quantity,
        ...(typeof i.price === 'number' ? { item_price: i.price } : {}),
      })),
      content_type: 'product',
      num_items: data.items.reduce((sum, i) => sum + i.quantity, 0),
      order_id: data.transactionId,
    },
  }

  await sendMetaCAPI(cfg.pixelId, cfg.accessToken, [event], cfg.testEventCode)
  return { ok: true, source: cfg.source }
}
