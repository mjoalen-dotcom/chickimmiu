'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useMemo, useState, useTransition } from 'react'

export type CardRow = {
  id: number
  displayTitle?: string
  cardType: 'common' | 'limited'
  serialNo: number | null
  status: 'active' | 'burned' | 'revoked' | 'transferred-out'
  mintedVia: 'purchase' | 'points-shop' | 'craft'
  mintedAt: string
  shareSlug: string
  productId: number | null
  productTitle: string
  productImageUrl?: string
  templateTotalSupply?: number
  templateBurnReward?: number
}

type Tab = 'active' | 'history'

const TAB_LABELS: Record<Tab, string> = {
  active: '持有中',
  history: '歷史紀錄',
}

export default function CardsClient({
  cards,
  currentUserId: _currentUserId,
}: {
  cards: CardRow[]
  currentUserId: number
}) {
  const router = useRouter()
  const [tab, setTab] = useState<Tab>('active')
  const [isPending, startTransition] = useTransition()
  const [craftMode, setCraftMode] = useState(false)
  const [selectedForCraft, setSelectedForCraft] = useState<Set<number>>(new Set())
  const [pendingAction, setPendingAction] = useState<number | 'craft' | null>(null)
  const [flash, setFlash] = useState<{ kind: 'ok' | 'err'; msg: string } | null>(null)

  const { activeCards, historyCards } = useMemo(() => {
    const active: CardRow[] = []
    const history: CardRow[] = []
    for (const c of cards) {
      if (c.status === 'active') active.push(c)
      else history.push(c)
    }
    return { activeCards: active, historyCards: history }
  }, [cards])

  const shown = tab === 'active' ? activeCards : historyCards

  const counts = useMemo(
    () => ({
      common: activeCards.filter((c) => c.cardType === 'common').length,
      limited: activeCards.filter((c) => c.cardType === 'limited').length,
    }),
    [activeCards],
  )

  // ── 合成候選：同 productId 的 common active 卡；至少 3 張才能合成 ──
  const craftableGroups = useMemo(() => {
    const groups = new Map<number, CardRow[]>()
    for (const c of activeCards) {
      if (c.cardType !== 'common' || c.productId == null) continue
      const arr = groups.get(c.productId) ?? []
      arr.push(c)
      groups.set(c.productId, arr)
    }
    return [...groups.entries()].filter(([_, arr]) => arr.length >= 3)
  }, [activeCards])

  // 同一組合成時只允許選同 product；不同 product 的常規卡不能一起選
  const selectedProductId = useMemo(() => {
    if (selectedForCraft.size === 0) return null
    const firstId = [...selectedForCraft][0]
    const c = activeCards.find((x) => x.id === firstId)
    return c?.productId ?? null
  }, [selectedForCraft, activeCards])

  function setFlashAuto(kind: 'ok' | 'err', msg: string) {
    setFlash({ kind, msg })
    setTimeout(() => setFlash(null), 3500)
  }

  function toggleCraftSelect(card: CardRow) {
    if (card.cardType !== 'common' || card.status !== 'active') return
    setSelectedForCraft((prev) => {
      const next = new Set(prev)
      if (next.has(card.id)) {
        next.delete(card.id)
        return next
      }
      if (prev.size > 0 && card.productId !== selectedProductId) {
        // 切 product → 清空重來
        return new Set([card.id])
      }
      if (next.size >= 3) {
        // 滿 3 張不收新的；使用者要先 deselect
        return prev
      }
      next.add(card.id)
      return next
    })
  }

  async function onTransfer(card: CardRow) {
    const raw = window.prompt(`輸入收卡會員的 email（轉送 ${card.productTitle || card.displayTitle || '此卡'}）`)
    if (!raw) return
    const toEmail = raw.trim()
    if (!toEmail.includes('@')) {
      setFlashAuto('err', '請輸入有效的 email')
      return
    }
    setPendingAction(card.id)
    try {
      const r = await fetch(`/api/cards/${card.id}/transfer`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ toEmail }),
      })
      const data = (await r.json().catch(() => ({}))) as Record<string, unknown>
      if (!r.ok) {
        const code = String(data.error ?? 'unknown')
        const msg =
          code === 'recipient_not_found'
            ? '找不到此 email 對應的會員'
            : code === 'cannot_transfer_to_self'
              ? '不能轉送給自己'
              : String(data.message ?? `轉送失敗（${code}）`)
        setFlashAuto('err', msg)
        return
      }
      setFlashAuto('ok', `已轉送給 ${data.newOwnerEmail || toEmail}`)
      startTransition(() => router.refresh())
    } catch (err) {
      setFlashAuto('err', `網路錯誤：${String(err)}`)
    } finally {
      setPendingAction(null)
    }
  }

  async function onBurn(card: CardRow) {
    const points =
      card.cardType === 'limited'
        ? (card.templateBurnReward ?? 500)
        : 30
    const ok = window.confirm(
      `確定要銷毀這張卡？\n\n` +
        `類型：${card.cardType === 'limited' ? `限量卡 #${card.serialNo ?? '?'}` : '普通卡'}\n` +
        `商品：${card.productTitle || '—'}\n` +
        `可得點數：+${points}\n\n` +
        `此動作無法復原。`,
    )
    if (!ok) return

    setPendingAction(card.id)
    try {
      const r = await fetch(`/api/cards/${card.id}/burn`, {
        method: 'POST',
        credentials: 'include',
      })
      const data = (await r.json().catch(() => ({}))) as Record<string, unknown>
      if (!r.ok) {
        setFlashAuto('err', String(data.message ?? data.error ?? '銷毀失敗'))
        return
      }
      setFlashAuto('ok', `銷毀成功，+${data.pointsAwarded} 點`)
      startTransition(() => router.refresh())
    } catch (err) {
      setFlashAuto('err', `網路錯誤：${String(err)}`)
    } finally {
      setPendingAction(null)
    }
  }

  async function onCraft() {
    if (selectedForCraft.size !== 3) {
      setFlashAuto('err', '請選 3 張同商品的普通卡')
      return
    }
    setPendingAction('craft')
    try {
      const r = await fetch('/api/cards/craft', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ cardIds: [...selectedForCraft] }),
      })
      const data = (await r.json().catch(() => ({}))) as Record<string, unknown>
      if (!r.ok) {
        const code = String(data.error ?? 'unknown')
        const fallback: Record<string, string> = {
          not_all_common: '只能用 3 張普通卡合成',
          different_products: '3 張卡必須是相同商品',
          no_template: '此商品未開放合成',
          crafting_pool_empty: '合成池已用完',
        }
        setFlashAuto('err', fallback[code] ?? String(data.message ?? code))
        return
      }
      setFlashAuto('ok', `合成成功！獲得限量卡 #${String(data.serialNo).padStart(4, '0')}`)
      setSelectedForCraft(new Set())
      setCraftMode(false)
      startTransition(() => router.refresh())
    } catch (err) {
      setFlashAuto('err', `網路錯誤：${String(err)}`)
    } finally {
      setPendingAction(null)
    }
  }

  return (
    <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6 lg:px-8">
      <header className="mb-8">
        <h1 className="text-3xl font-bold tracking-tight text-gray-900">我的造型卡收藏</h1>
        <p className="mt-2 text-sm text-gray-600">
          購物滿 NT$5,000 即獲限量編號卡；一般商品每件發放普通卡。3 張同商品普通卡可合成 1 張限量卡。
        </p>
        <div className="mt-4 flex flex-wrap gap-6 text-sm">
          <div>
            <span className="text-gray-500">普通卡：</span>
            <span className="ml-1 font-semibold text-gray-900">{counts.common}</span>
          </div>
          <div>
            <span className="text-gray-500">限量卡：</span>
            <span className="ml-1 font-semibold text-amber-700">{counts.limited}</span>
          </div>
          {craftableGroups.length > 0 && (
            <div>
              <span className="text-gray-500">可合成商品種類：</span>
              <span className="ml-1 font-semibold text-purple-700">{craftableGroups.length}</span>
            </div>
          )}
        </div>
      </header>

      {flash && (
        <div
          className={`mb-4 rounded-lg px-4 py-3 text-sm ${
            flash.kind === 'ok'
              ? 'bg-green-50 text-green-800 border border-green-200'
              : 'bg-red-50 text-red-800 border border-red-200'
          }`}
        >
          {flash.msg}
        </div>
      )}

      <nav className="mb-6 flex items-center justify-between border-b border-gray-200">
        <div className="flex gap-1">
          {(['active', 'history'] as Tab[]).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`px-4 py-2 text-sm font-medium transition-colors ${
                tab === t
                  ? 'border-b-2 border-amber-600 text-amber-700'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              {TAB_LABELS[t]}
              <span className="ml-1 text-xs text-gray-400">
                ({t === 'active' ? activeCards.length : historyCards.length})
              </span>
            </button>
          ))}
        </div>
        {tab === 'active' && craftableGroups.length > 0 && (
          <button
            onClick={() => {
              setCraftMode((m) => !m)
              setSelectedForCraft(new Set())
            }}
            className={`mb-1 rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
              craftMode
                ? 'bg-purple-600 text-white hover:bg-purple-700'
                : 'bg-white border border-purple-300 text-purple-700 hover:bg-purple-50'
            }`}
          >
            {craftMode ? '取消合成' : '合成限量卡（3→1）'}
          </button>
        )}
      </nav>

      {craftMode && (
        <div className="mb-4 rounded-lg border border-purple-200 bg-purple-50 p-4 text-sm">
          <div className="flex items-center justify-between gap-4">
            <div>
              <strong className="text-purple-900">合成模式：</strong>
              <span className="ml-2 text-purple-700">
                選 3 張同商品普通卡（已選 {selectedForCraft.size}/3）
              </span>
            </div>
            <button
              onClick={onCraft}
              disabled={selectedForCraft.size !== 3 || pendingAction === 'craft' || isPending}
              className="rounded-md bg-purple-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-purple-700 disabled:cursor-not-allowed disabled:bg-gray-300"
            >
              {pendingAction === 'craft' ? '合成中...' : '確認合成'}
            </button>
          </div>
        </div>
      )}

      {shown.length === 0 ? (
        <div className="rounded-lg border border-dashed border-gray-300 p-12 text-center">
          <p className="text-gray-500">
            {tab === 'active'
              ? '還沒有任何卡片。去逛逛商品，完成訂單就會獲得第一張卡！'
              : '沒有歷史紀錄。'}
          </p>
          {tab === 'active' && (
            <Link
              href="/products"
              className="mt-4 inline-block rounded-md bg-amber-600 px-4 py-2 text-sm font-medium text-white hover:bg-amber-700"
            >
              前往商品
            </Link>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
          {shown.map((c) => {
            const isLimited = c.cardType === 'limited'
            const isDisabled = c.status !== 'active'
            const isSelected = selectedForCraft.has(c.id)
            const canBeSelected =
              craftMode && c.cardType === 'common' && c.status === 'active'
            const isDifferentProduct =
              canBeSelected &&
              selectedProductId != null &&
              c.productId !== selectedProductId
            const isThisPending = pendingAction === c.id
            return (
              <div
                key={c.id}
                className={`group relative overflow-hidden rounded-xl border shadow-sm transition-all ${
                  isSelected
                    ? 'border-purple-500 ring-2 ring-purple-300 bg-purple-50'
                    : isLimited
                      ? 'border-amber-400 bg-gradient-to-br from-amber-50 to-white'
                      : 'border-gray-200 bg-white'
                } ${isDisabled ? 'opacity-60' : 'hover:shadow-md'} ${
                  isDifferentProduct ? 'opacity-40' : ''
                } ${canBeSelected && !isDifferentProduct ? 'cursor-pointer' : ''}`}
                onClick={() => canBeSelected && !isDifferentProduct && toggleCraftSelect(c)}
              >
                <div className="aspect-[4/5] w-full overflow-hidden bg-gray-100">
                  {c.productImageUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={c.productImageUrl}
                      alt={c.productTitle || 'Card'}
                      className="h-full w-full object-cover transition-transform group-hover:scale-105"
                    />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center text-gray-400">
                      無圖
                    </div>
                  )}
                  {isSelected && (
                    <div className="absolute right-2 top-2 flex h-7 w-7 items-center justify-center rounded-full bg-purple-600 text-xs font-bold text-white">
                      ✓
                    </div>
                  )}
                  {c.status !== 'active' && (
                    <div className="absolute inset-0 flex items-center justify-center bg-black/40 text-xs font-semibold text-white">
                      {c.status === 'burned' && '已銷毀'}
                      {c.status === 'revoked' && '已撤回'}
                      {c.status === 'transferred-out' && '已轉出'}
                    </div>
                  )}
                </div>
                <div className="p-3">
                  <div className="flex items-center gap-2">
                    <span
                      className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                        isLimited ? 'bg-amber-600 text-white' : 'bg-gray-100 text-gray-700'
                      }`}
                    >
                      {isLimited ? '限量' : '普通'}
                    </span>
                    {isLimited && c.serialNo != null && (
                      <span className="text-xs font-mono text-amber-700">
                        #{String(c.serialNo).padStart(4, '0')}
                        {c.templateTotalSupply ? ` / ${c.templateTotalSupply}` : ''}
                      </span>
                    )}
                  </div>
                  <h3 className="mt-1 line-clamp-1 text-sm font-medium text-gray-900">
                    {c.productTitle || c.displayTitle || '未命名'}
                  </h3>
                  <p className="mt-0.5 text-xs text-gray-500">
                    {new Date(c.mintedAt).toLocaleDateString('zh-TW')}
                    {' · '}
                    {c.mintedVia === 'purchase'
                      ? '購買'
                      : c.mintedVia === 'points-shop'
                        ? '點數兌換'
                        : '合成'}
                  </p>

                  {/* 行動按鈕：active 且非 craft-mode 才顯示 */}
                  {c.status === 'active' && !craftMode && (
                    <div className="mt-2 flex gap-1.5">
                      <button
                        onClick={(e) => {
                          e.stopPropagation()
                          onTransfer(c)
                        }}
                        disabled={isThisPending || isPending}
                        className="flex-1 rounded-md border border-gray-300 bg-white px-2 py-1 text-[11px] font-medium text-gray-700 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        轉送
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation()
                          onBurn(c)
                        }}
                        disabled={isThisPending || isPending}
                        className="flex-1 rounded-md border border-red-200 bg-white px-2 py-1 text-[11px] font-medium text-red-700 hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        銷毀
                      </button>
                    </div>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}

      <footer className="mt-10 rounded-lg bg-gray-50 p-4 text-xs text-gray-500">
        <p>
          <strong className="text-gray-700">即將開放（PR C）：</strong>
          分享到 IG / Threads / LINE、點數商店兌換限量卡、依會員等級動態渲染金/銀/銅邊框。
        </p>
      </footer>
    </div>
  )
}
