import { NextRequest, NextResponse } from 'next/server'
import { getPayload } from 'payload'
import config from '@payload-config'
import { adjustWallet } from '@/lib/wallet/server'

/**
 * 儲值金退現
 * ──────────
 *   POST   /api/account/wallet/withdraw  { amount, bankName, bankCode?, accountName, accountNumber, note? }
 *          → 驗證 + 先扣住儲值金（adjustWallet 出帳）+ 建 pending 申請（held=true）
 *   DELETE /api/account/wallet/withdraw?id=  → 取消本人 pending 申請（hook 自動退回扣住金額）
 *
 * 安全：以 cookie 驗證會員；申請一律綁本人；扣款失敗則回滾刪除申請。
 */

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const MIN_WITHDRAW = 100 // NT$ 最低退現金額

export async function POST(req: NextRequest) {
  try {
    const payload = await getPayload({ config })
    const { user } = await payload.auth({ headers: req.headers })
    if (!user) {
      return NextResponse.json({ success: false, error: '請先登入' }, { status: 401 })
    }

    const body = (await req.json().catch(() => ({}))) as {
      amount?: number
      bankName?: string
      bankCode?: string
      accountName?: string
      accountNumber?: string
      note?: string
    }

    const amount = Math.floor(Number(body.amount))
    if (!Number.isFinite(amount) || amount < MIN_WITHDRAW) {
      return NextResponse.json(
        { success: false, error: `最低退現金額為 NT$ ${MIN_WITHDRAW}` },
        { status: 400 },
      )
    }
    const accountName = String(body.accountName || '').trim()
    const accountNumber = String(body.accountNumber || '').trim()
    const bankName = String(body.bankName || '').trim()
    if (!bankName || !accountName || !accountNumber) {
      return NextResponse.json(
        { success: false, error: '請填寫完整收款帳戶（銀行、戶名、帳號）' },
        { status: 400 },
      )
    }

    // 餘額預檢（hold 時 adjustWallet 會再嚴格判一次，防併發）
    const fresh = (await payload
      .findByID({ collection: 'users', id: user.id, depth: 0 })
      .catch(() => null)) as unknown as Record<string, unknown> | null
    const balance = Number(fresh?.storedValueBalance) || 0
    if (amount > balance) {
      return NextResponse.json(
        { success: false, error: `儲值金餘額不足（目前 NT$ ${balance.toLocaleString()}）` },
        { status: 400 },
      )
    }

    // 先建申請（held=false），再扣款；扣款失敗就回滾刪除，避免有扣無單 / 有單無扣
    const wd = await payload.create({
      collection: 'wallet-withdrawals',
      data: {
        user: user.id,
        amount,
        status: 'pending',
        held: false,
        bankInfo: {
          bankName,
          bankCode: String(body.bankCode || '').trim() || undefined,
          accountName,
          accountNumber,
        },
        userNote: body.note ? String(body.note).slice(0, 500) : undefined,
      } as never,
      overrideAccess: true,
    })

    const hold = await adjustWallet(payload, {
      userId: user.id,
      wallet: 'storedValue',
      amount: -amount,
      type: 'withdraw',
      source: 'withdrawal',
      description: `退現申請 #${wd.id}`,
      relatedWithdrawal: wd.id as string | number,
    })

    if (!hold.ok) {
      await payload
        .delete({ collection: 'wallet-withdrawals', id: wd.id, overrideAccess: true })
        .catch(() => {})
      return NextResponse.json(
        { success: false, error: hold.error || '儲值金餘額不足' },
        { status: 400 },
      )
    }

    await payload.update({
      collection: 'wallet-withdrawals',
      id: wd.id,
      data: { held: true } as never,
      overrideAccess: true,
    })

    return NextResponse.json({ success: true, id: String(wd.id), balance: hold.balance })
  } catch (error) {
    console.error('[account/wallet/withdraw POST] error:', error)
    return NextResponse.json({ success: false, error: '申請失敗，請稍後再試' }, { status: 500 })
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const payload = await getPayload({ config })
    const { user } = await payload.auth({ headers: req.headers })
    if (!user) {
      return NextResponse.json({ success: false, error: '請先登入' }, { status: 401 })
    }

    const id = String(req.nextUrl.searchParams.get('id') || '').trim()
    if (!id) {
      return NextResponse.json({ success: false, error: '缺少申請編號' }, { status: 400 })
    }

    const wd = (await payload
      .findByID({ collection: 'wallet-withdrawals', id, depth: 0 })
      .catch(() => null)) as unknown as Record<string, unknown> | null
    if (!wd) {
      return NextResponse.json({ success: false, error: '找不到申請' }, { status: 404 })
    }
    // 擁有權 + 狀態檢查
    const ownerId = typeof wd.user === 'object' && wd.user !== null ? (wd.user as { id: unknown }).id : wd.user
    if (String(ownerId) !== String(user.id)) {
      return NextResponse.json({ success: false, error: '無權限' }, { status: 403 })
    }
    if (wd.status !== 'pending') {
      return NextResponse.json(
        { success: false, error: '僅能取消處理中的申請' },
        { status: 409 },
      )
    }

    // 設為 cancelled → collection afterChange hook 自動退回扣住的儲值金
    await payload.update({
      collection: 'wallet-withdrawals',
      id,
      data: { status: 'cancelled' } as never,
      overrideAccess: true,
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('[account/wallet/withdraw DELETE] error:', error)
    return NextResponse.json({ success: false, error: '取消失敗' }, { status: 500 })
  }
}
