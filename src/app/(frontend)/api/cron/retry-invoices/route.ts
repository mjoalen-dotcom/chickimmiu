import { NextResponse } from 'next/server'
import { getPayload } from 'payload'
import config from '@payload-config'

import { verifyCronAuth } from '@/lib/cron/auth'
import { retryFailedInvoices } from '@/lib/invoice/ecpayInvoiceEngine'
import { sendAdminInvoiceRetryAlert } from '@/lib/email/adminInvoiceRetryAlert'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 120

/**
 * /api/cron/retry-invoices
 *
 * 重試開立失敗的電子發票：engine 只撈 status=failed 且 retryCount 未達上限（3）者，
 * 逐張重打綠界 Issue；production 缺 ECPAY_INVOICE_* 憑證時 engine 直接略過（retried:0）。
 *
 * 本輪仍有失敗 → 寄 admin 警示信（OrderSettings.notifications.adminAlertEmails）。
 * 每張發票最多重試 3 次，警示信最多跟著出現 3 封，不會無限轟炸。
 *
 * 建議排程：每 30 分鐘一次（發票有 48 小時法定開立時限，重試窗要留人工處理餘裕）。
 */
export async function POST(request: Request) {
  const authFail = verifyCronAuth(request)
  if (authFail) return authFail

  const started = Date.now()
  const result = await retryFailedInvoices()

  if (result.failed > 0) {
    try {
      const payload = await getPayload({ config })
      const settings = (await payload.findGlobal({
        slug: 'order-settings',
      })) as unknown as {
        notifications?: { adminAlertEmails?: Array<{ email?: string }> }
      }
      const emails = (settings?.notifications?.adminAlertEmails ?? [])
        .map((e) => e?.email)
        .filter((e): e is string => Boolean(e))
      if (emails.length > 0) {
        sendAdminInvoiceRetryAlert(payload, result, emails).catch((err) =>
          console.error('[Cron retry-invoices] admin 警示信寄送失敗:', err),
        )
      }
    } catch (err) {
      console.error('[Cron retry-invoices] 讀 order-settings 失敗:', err)
    }
  }

  return NextResponse.json({
    ok: true,
    ...result,
    duration_ms: Date.now() - started,
  })
}
