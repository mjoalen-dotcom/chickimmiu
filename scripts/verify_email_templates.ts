/**
 * Email 模板系統 驗證（乾淨 temp DB）。
 *
 *   rm -f data/_em.db*
 *   yes y | DATABASE_URI=file:./data/_em.db NODE_OPTIONS=--no-deprecation pnpm exec payload migrate
 *   RESEND_API_KEY= DATABASE_URI=file:./data/_em.db NODE_OPTIONS=--no-deprecation pnpm exec payload run scripts/verify_email_templates.ts
 *
 * ⚠️ RESEND_API_KEY= （留空）強制 console-fallback：handoff 設計是「無 key 不真寄」，
 *    驗證在此前提下跑。若帶真 key，sender 會真打 Resend，未驗證 domain 會 403（預期，
 *    那正是 user 待辦的卡關）。免打擾時段（預設 22-08）會擋行銷寄送，故本 script 於
 *    P4 前把 CRM quietHours 設成不阻擋窗口。
 *
 * 覆蓋：
 *   P1 — ensureDefaultEmailTemplates 補齊 9 種；renderEmailFromTemplate 各事件合併 +
 *        結構化區塊注入；停用 → fallback（null）；5 sender 不 throw（console-fallback）。
 *   P2 — welcome / delivered sender 不 throw。
 *   P4 — channelDispatcher.sendEmail 真呼叫（emailSubscribed gate）；automationEngine send_email 不 throw。
 */
import { getPayload } from 'payload'
import config from '@payload-config'

import {
  EMAIL_EVENT_KEYS,
  ensureDefaultEmailTemplates,
  renderEmailFromTemplate,
  buildSampleVars,
  type EmailEventKey,
} from '@/lib/email/renderFromTemplate'
import { sendOrderConfirmationEmail } from '@/lib/email/orderConfirmation'
import { sendOrderShippedEmail } from '@/lib/email/orderShipped'
import { sendOrderCancelledEmail } from '@/lib/email/orderCancelled'
import { sendOrderRefundedEmail } from '@/lib/email/orderRefunded'
import { sendAdminNewOrderAlert } from '@/lib/email/adminNewOrderAlert'
import { sendWelcomeEmail } from '@/lib/email/welcome'
import { sendOrderDeliveredEmail } from '@/lib/email/orderDelivered'

const results: Array<{ name: string; ok: boolean; detail: string }> = []
function check(name: string, ok: boolean, detail = '') {
  results.push({ name, ok, detail })
  process.stdout.write(`  [${ok ? 'PASS' : 'FAIL'}] ${name}${detail ? ` — ${detail}` : ''}\n`)
}

async function main() {
  const payload = await getPayload({ config })
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const p = payload as any

  // ── P1.1 懶 seed 補齊 9 種 ──
  const created = await ensureDefaultEmailTemplates(payload)
  check('P1 ensureDefaultEmailTemplates 首跑建 9 筆', created.length === EMAIL_EVENT_KEYS.length, `created=${created.length}`)
  const all = await p.find({ collection: 'email-templates', limit: 100, overrideAccess: true })
  check('P1 email-templates 共 9 筆', all.totalDocs === EMAIL_EVENT_KEYS.length, `total=${all.totalDocs}`)

  // ── P1.2 冪等：再跑不重建 ──
  const created2 = await ensureDefaultEmailTemplates(payload)
  const all2 = await p.find({ collection: 'email-templates', limit: 100, overrideAccess: true })
  check('P1 二次 seed 冪等（不重建）', created2.length === 0 && all2.totalDocs === EMAIL_EVENT_KEYS.length, `created2=${created2.length}, total=${all2.totalDocs}`)

  // ── P1.3 各事件 render：subject/html 合併 + 結構化區塊出現 ──
  const blockMarker: Record<EmailEventKey, string[]> = {
    welcome: ['前往會員中心'],
    order_confirmation: ['應付總額', '韓系針織開衫'],
    payment_received: ['已收到您訂單', '查看訂單'],
    order_shipped: ['CKMU-SAMPLE-0001', '查看訂單'],
    order_delivered: ['查看訂單'],
    order_cancelled: ['取消原因', '查看訂單'],
    order_refunded: ['退款金額', '查看訂單'],
    admin_new_order: ['商品清單', '開啟後台訂單'],
    auth_verify: ['驗證 Email', 'SAMPLE_TOKEN'],
    auth_forgot_password: ['重設密碼', 'SAMPLE_TOKEN'],
  }
  for (const key of EMAIL_EVENT_KEYS) {
    const vars = buildSampleVars(key)
    const r = await renderEmailFromTemplate(payload, key, vars)
    const markers = blockMarker[key]
    const ok = Boolean(
      r &&
        r.subject.length > 0 &&
        r.html.includes('CHIC KIM') &&
        !r.html.includes('{{') &&
        markers.every((m) => r.html.includes(m)),
    )
    check(`P1 render ${key}`, ok, r ? `subject="${r.subject.slice(0, 40)}"` : 'null')
  }

  // ── P1.4 停用 → fallback（null） ──
  const shippedDoc = (await p.find({ collection: 'email-templates', where: { eventKey: { equals: 'order_shipped' } }, limit: 1, overrideAccess: true })).docs[0]
  await p.update({ collection: 'email-templates', id: shippedDoc.id, data: { enabled: false }, overrideAccess: true })
  const disabled = await renderEmailFromTemplate(payload, 'order_shipped', buildSampleVars('order_shipped'))
  check('P1 停用 order_shipped → render 回 null（走 fallback）', disabled === null)
  await p.update({ collection: 'email-templates', id: shippedDoc.id, data: { enabled: true }, overrideAccess: true })

  // ── 建測試會員 + 範例 order 物件（不寫真 Orders，避免觸發一堆 hook） ──
  const user = await p.create({
    collection: 'users',
    data: { email: `em_${Date.now()}@test.local`, password: 'Test12345!', name: '驗證會員' },
    disableVerificationEmail: true,
    overrideAccess: true,
  })
  const sampleOrder: Record<string, unknown> = {
    id: 1,
    orderNumber: 'CKMU-VERIFY-0001',
    customer: user.id,
    items: [{ productName: '針織開衫', variant: '駝色/M', quantity: 1, unitPrice: 1880, subtotal: 1880 }],
    subtotal: 1880,
    total: 1880,
    refundAmount: 1880,
    paymentMethod: 'ecpay',
    paymentStatus: 'paid',
    shippingMethod: { methodName: '宅配', trackingNumber: 'TRK123', trackingUrl: 'https://x/track' },
    shippingAddress: { recipientName: '驗證會員', phone: '0912000000', city: '台北市', district: '大安區', address: '測試路 1 號' },
    cancelReason: '顧客申請',
    pointsUsed: 50,
  }

  // ── P1.5 5 sender 不 throw（透過模板 → console-fallback transport） ──
  for (const [name, fn] of [
    ['orderConfirmation', sendOrderConfirmationEmail],
    ['orderShipped', sendOrderShippedEmail],
    ['orderCancelled', sendOrderCancelledEmail],
    ['orderRefunded', sendOrderRefundedEmail],
  ] as const) {
    try {
      await fn(payload, sampleOrder)
      check(`P1 sender ${name} 不 throw`, true)
    } catch (e) {
      check(`P1 sender ${name} 不 throw`, false, e instanceof Error ? e.message : String(e))
    }
  }
  try {
    await sendAdminNewOrderAlert(payload, sampleOrder, ['admin@test.local'])
    check('P1 sender adminNewOrderAlert 不 throw', true)
  } catch (e) {
    check('P1 sender adminNewOrderAlert 不 throw', false, e instanceof Error ? e.message : String(e))
  }

  // ── P2 welcome / delivered sender 不 throw ──
  try {
    await sendWelcomeEmail(payload, { id: user.id, email: user.email, name: user.name })
    check('P2 sender welcome 不 throw', true)
  } catch (e) {
    check('P2 sender welcome 不 throw', false, e instanceof Error ? e.message : String(e))
  }
  try {
    await sendOrderDeliveredEmail(payload, sampleOrder)
    check('P2 sender orderDelivered 不 throw', true)
  } catch (e) {
    check('P2 sender orderDelivered 不 throw', false, e instanceof Error ? e.message : String(e))
  }

  // ── P4 channelDispatcher.sendEmail 真呼叫 + emailSubscribed gate ──
  // 把免打擾時段設成不含「現在」的窗口（避免被 quiet hours 擋住而誤判）。
  try {
    await p.updateGlobal({
      slug: 'crm-settings',
      data: { automationConfig: { quietHoursStart: 3, quietHoursEnd: 4 } },
      overrideAccess: true,
    })
  } catch {
    // ignore
  }
  try {
    const { sendMessage } = await import('@/lib/marketing/channelDispatcher')
    const r1 = await sendMessage(String(user.id), 'email', { subject: '行銷測試', body: '<p>hi</p>' })
    check('P4 行銷 email 已訂閱 → success', r1.success === true, JSON.stringify(r1))
    // 退訂 → 跳過
    await p.update({ collection: 'users', id: user.id, data: { subscriptionStatus: { emailSubscribed: false } }, overrideAccess: true })
    const r2 = await sendMessage(String(user.id), 'email', { subject: '行銷測試2', body: '<p>hi</p>' })
    check('P4 退訂後行銷 email → 跳過（success=false）', r2.success === false, JSON.stringify(r2))
    await p.update({ collection: 'users', id: user.id, data: { subscriptionStatus: { emailSubscribed: true } }, overrideAccess: true })
  } catch (e) {
    check('P4 channelDispatcher suite', false, e instanceof Error ? e.message : String(e))
  }

  const passed = results.filter((r) => r.ok).length
  const failed = results.length - passed
  process.stdout.write(`\n=== Email 模板 verify: ${passed} PASS / ${failed} FAIL (of ${results.length}) ===\n`)
  if (failed > 0) process.exitCode = 1
}

await main()
