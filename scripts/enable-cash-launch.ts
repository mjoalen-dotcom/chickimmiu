import { getPayload } from 'payload'
import config from '@payload-config'

/**
 * LB-01 + LB-05 prod 一次性設定（冪等，可重跑）
 * ─────────────────────────────────────────────
 * 1. GlobalSettings.payment.enabledMethods → ['cash_cod', 'cash_meetup']
 *    （現金版開賣：只開真正能運作的現金方式；線上金流未串接前絕不開）
 * 2. email-templates 的 order_confirmation 模板若仍是舊預設文案
 *    「已收到付款並開始處理」→ 換成動態 {{statusLine}} 變數 + 中性 preheader。
 *    admin 已自訂過（不含舊句）的模板不動。
 *
 * 用法：pnpm payload run scripts/enable-cash-launch.ts
 */
async function main() {
  const payload = await getPayload({ config })

  // ── 1. 啟用現金付款方式 ──
  const gs = (await payload.findGlobal({ slug: 'global-settings', depth: 0 })) as unknown as {
    payment?: Record<string, unknown>
  }
  const currentPayment = gs.payment ?? {}
  const currentMethods = (currentPayment.enabledMethods as string[] | undefined) ?? []
  const target = ['cash_cod', 'cash_meetup']
  const alreadySet =
    currentMethods.length === target.length && target.every((m) => currentMethods.includes(m))

  if (alreadySet) {
    console.log('[enable-cash] enabledMethods 已是 cash_cod + cash_meetup，略過')
  } else {
    await payload.updateGlobal({
      slug: 'global-settings',
      data: {
        payment: { ...currentPayment, enabledMethods: target },
      } as never,
    })
    console.log(
      `[enable-cash] enabledMethods: ${JSON.stringify(currentMethods)} → ${JSON.stringify(target)}`,
    )
  }

  // ── 2. 修 order_confirmation 模板舊文案 ──
  const OLD_SENTENCE = '已收到付款並開始處理'
  const res = await payload.find({
    collection: 'email-templates',
    where: { eventKey: { equals: 'order_confirmation' } },
    limit: 1,
    depth: 0,
    overrideAccess: true,
  })
  const tpl = res.docs?.[0] as
    | { id: string | number; bodyHtml?: string; preheader?: string }
    | undefined

  if (!tpl) {
    console.log('[email-tpl] order_confirmation 模板不存在（未 seed），fallback 已是新文案，略過')
  } else {
    const patch: Record<string, string> = {}
    if (tpl.bodyHtml?.includes(OLD_SENTENCE)) {
      patch.bodyHtml = tpl.bodyHtml.replace(OLD_SENTENCE, '{{statusLine}}')
    }
    if (tpl.preheader?.includes(OLD_SENTENCE)) {
      patch.preheader = '您的訂單 {{orderNumber}} 已成立，明細請見內文'
    }
    if (Object.keys(patch).length === 0) {
      console.log('[email-tpl] 模板無舊句（admin 已自訂或已修過），不動')
    } else {
      await payload.update({
        collection: 'email-templates',
        id: tpl.id,
        data: patch as never,
        overrideAccess: true,
      })
      console.log(`[email-tpl] 已更新欄位: ${Object.keys(patch).join(', ')}`)
    }
  }

  // ── 驗證輸出 ──
  const after = (await payload.findGlobal({ slug: 'global-settings', depth: 0 })) as unknown as {
    payment?: { enabledMethods?: string[] }
  }
  console.log('[verify] payment.enabledMethods =', JSON.stringify(after.payment?.enabledMethods))
  console.log('[done] enable-cash-launch 完成')
}

await main()
process.exit(0)
