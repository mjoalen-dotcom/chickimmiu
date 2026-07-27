import { getPayload } from 'payload'
import config from '@payload-config'

/**
 * 上線設定批次（冪等，可重跑）— 2026-07-27
 * ─────────────────────────────────────────────
 * 1. GlobalSettings.payment.enabledMethods 加入 'ecpay'（保留既有 cash_cod/cash_meetup）
 *    — §4 ECPay 程式已串完，sandbox 測試商店可全程測刷卡
 * 2. LB-13：CheckoutSettings.fieldRequirements.birthdayRequired / genderRequired → false
 * 3. LB-13：OrderSettings.notifications.adminAlertEmails 空時填 service@chickimmiu.com
 *    + sendAdminNewOrderAlert → true（既有收件人不覆蓋）
 *
 * 用法：pnpm payload run scripts/oneoff/launch-settings-20260727.ts
 */
const ADMIN_ALERT_EMAIL = 'service@chickimmiu.com'

async function main() {
  const payload = await getPayload({ config })

  // ── 1. enabledMethods 加 ecpay ──
  const gs = (await payload.findGlobal({ slug: 'global-settings', depth: 0 })) as unknown as {
    payment?: Record<string, unknown>
  }
  const currentPayment = gs.payment ?? {}
  const methods = (currentPayment.enabledMethods as string[] | undefined) ?? []
  if (methods.includes('ecpay')) {
    console.log('[ecpay] enabledMethods 已含 ecpay，略過:', JSON.stringify(methods))
  } else {
    const next = [...methods, 'ecpay']
    await payload.updateGlobal({
      slug: 'global-settings',
      data: { payment: { ...currentPayment, enabledMethods: next } } as never,
    })
    console.log(`[ecpay] enabledMethods: ${JSON.stringify(methods)} → ${JSON.stringify(next)}`)
  }

  // ── 2. LB-13 關生日/性別必填 ──
  const cs = (await payload.findGlobal({ slug: 'checkout-settings', depth: 0 })) as unknown as {
    fieldRequirements?: Record<string, unknown>
  }
  const fr = cs.fieldRequirements ?? {}
  if (fr.birthdayRequired === false && fr.genderRequired === false) {
    console.log('[checkout] 生日/性別必填已關，略過')
  } else {
    await payload.updateGlobal({
      slug: 'checkout-settings',
      data: {
        fieldRequirements: { ...fr, birthdayRequired: false, genderRequired: false },
      } as never,
    })
    console.log(
      `[checkout] birthdayRequired: ${fr.birthdayRequired} → false; genderRequired: ${fr.genderRequired} → false`,
    )
  }

  // ── 3. LB-13 店家新單通知信箱 ──
  const os = (await payload.findGlobal({ slug: 'order-settings', depth: 0 })) as unknown as {
    notifications?: Record<string, unknown>
  }
  const noti = os.notifications ?? {}
  const emails = (noti.adminAlertEmails as { email: string }[] | undefined) ?? []
  const needEmail = emails.length === 0
  const needFlag = noti.sendAdminNewOrderAlert !== true
  if (!needEmail && !needFlag) {
    console.log(
      '[order] adminAlertEmails 已設，略過:',
      JSON.stringify(emails.map((e) => e.email)),
    )
  } else {
    await payload.updateGlobal({
      slug: 'order-settings',
      data: {
        notifications: {
          ...noti,
          sendAdminNewOrderAlert: true,
          ...(needEmail ? { adminAlertEmails: [{ email: ADMIN_ALERT_EMAIL }] } : {}),
        },
      } as never,
    })
    console.log(
      `[order] sendAdminNewOrderAlert → true; adminAlertEmails ${needEmail ? `→ ["${ADMIN_ALERT_EMAIL}"]` : '既有收件人保留'}`,
    )
  }

  // ── 驗證輸出 ──
  const gAfter = (await payload.findGlobal({ slug: 'global-settings', depth: 0 })) as unknown as {
    payment?: { enabledMethods?: string[] }
  }
  const cAfter = (await payload.findGlobal({ slug: 'checkout-settings', depth: 0 })) as unknown as {
    fieldRequirements?: { birthdayRequired?: boolean; genderRequired?: boolean }
  }
  const oAfter = (await payload.findGlobal({ slug: 'order-settings', depth: 0 })) as unknown as {
    notifications?: { sendAdminNewOrderAlert?: boolean; adminAlertEmails?: { email: string }[] }
  }
  console.log('[verify] payment.enabledMethods =', JSON.stringify(gAfter.payment?.enabledMethods))
  console.log(
    '[verify] birthdayRequired =',
    cAfter.fieldRequirements?.birthdayRequired,
    '; genderRequired =',
    cAfter.fieldRequirements?.genderRequired,
  )
  console.log(
    '[verify] sendAdminNewOrderAlert =',
    oAfter.notifications?.sendAdminNewOrderAlert,
    '; adminAlertEmails =',
    JSON.stringify(oAfter.notifications?.adminAlertEmails?.map((e) => e.email)),
  )
  console.log('[done] launch-settings 完成')
}

await main()
process.exit(0)
