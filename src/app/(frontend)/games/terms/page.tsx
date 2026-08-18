import type { Metadata } from 'next'
import { getPayload } from 'payload'
import config from '@payload-config'
import type { Where } from 'payload'
import { GAME_DEFS, type GameDef } from '@/lib/games/gameConfig'
import { estimatePrizeValueTwd } from '@/lib/games/abuseDetection'
import { MYSTERY_GIFT_POOL_TAG } from '@/lib/promotions/types'

export const metadata: Metadata = {
  title: '遊戲規範與獎項公示 | CHIC KIM & MIU',
  description:
    '依消費者保護法及相關法令公示 CHIC KIM & MIU 各互動遊戲之獎項清單、中獎機率、剩餘庫存與兌換方式。',
}

export const dynamic = 'force-dynamic'

type LooseRecord = Record<string, unknown>

interface PoolEntry {
  id: number
  name: string
  prizeType: string
  amount: number
  weight: number
  inventoryUnlimited: boolean
  inventoryRemaining: number | null
  inventoryTotal: number | null
  estimatedValue: number | null
  deliveryMethod: string
  redemptionInstructions: string
  expiryDays: number
  startsAt: string | null
  endsAt: string | null
}

/**
 * 訂單神秘禮物不是「遊戲」，但依消保法／公平會規範，贈獎活動一樣要公示中獎機率
 * 與獎項價值。做成一個假的 GameDef 混進下面同一份表格渲染，是為了讓機率算法、
 * 價值優先序（`estimatedValue ?? estimatePrizeValueTwd()`）與剩餘庫存顯示
 * 完全共用同一份程式 —— 對外揭露的數字若和內部扣預算的數字分家，就是揭露錯誤。
 *
 * slug 用連字號版是因為下面的查表統一走 `slug.replace(/-/g, '_')`。
 */
const MYSTERY_GIFT_SECTION: GameDef = {
  id: 'order-mystery-gift',
  slug: MYSTERY_GIFT_POOL_TAG.replace(/_/g, '-'),
  enabledKey: 'orderMysteryGiftEnabled' as GameDef['enabledKey'],
  settingsKey: 'orderMysteryGift' as GameDef['settingsKey'],
  name: '訂單神秘禮物',
  icon: '🎁',
  color: 'from-rose-400 to-fuchsia-500',
  description: '活動期間下單並完成付款後自動抽獎。本活動保證有獎，獎池不含銘謝惠顧。',
  category: 'luck',
  categoryLabel: '購物回饋',
  implementationStatus: 'ready',
}

const PUBLIC_PRIZE_SECTIONS: GameDef[] = [...GAME_DEFS, MYSTERY_GIFT_SECTION]

const PRIZE_TYPE_LABELS: Record<string, string> = {
  points: '會員點數',
  credit: '購物金',
  coupon: '優惠券',
  movie_ticket: '電影票',
  free_shipping: '免運券',
  physical_gift: '實體贈品',
  badge: '專屬徽章',
  none: '銘謝惠顧',
}

const DELIVERY_LABELS: Record<string, string> = {
  instant_credit: '即時入帳',
  digital_coupon: '電子券（寶物箱）',
  physical_shipping: '隨單寄出',
  manual_contact: '客服聯繫履行',
}

async function loadPoolByGame(): Promise<Record<string, PoolEntry[]>> {
  const payload = await getPayload({ config })
  const now = new Date().toISOString()

  let res: { docs: unknown[] }
  try {
    res = await payload.find({
      collection: 'prize-pools',
      where: {
        and: [
          { active: { equals: true } },
          { or: [{ startsAt: { exists: false } }, { startsAt: { less_than_equal: now } }] },
          { or: [{ endsAt: { exists: false } }, { endsAt: { greater_than_equal: now } }] },
        ],
      } as Where,
      limit: 500,
      depth: 0,
    })
  } catch {
    return {}
  }

  const byGame: Record<string, PoolEntry[]> = {}
  for (const d of res.docs) {
    const r = d as LooseRecord
    const games = (r.eligibleGames as string[] | undefined) || []
    const entry: PoolEntry = {
      id: Number(r.id),
      name: String(r.name || '獎品'),
      prizeType: String(r.prizeType || 'none'),
      amount: Number(r.amount || 0),
      weight: Number(r.weight || 0),
      inventoryUnlimited: Boolean(r.inventoryUnlimited),
      inventoryRemaining:
        r.inventoryRemaining === null || r.inventoryRemaining === undefined
          ? null
          : Number(r.inventoryRemaining),
      inventoryTotal:
        r.inventoryTotal === null || r.inventoryTotal === undefined
          ? null
          : Number(r.inventoryTotal),
      estimatedValue:
        r.estimatedValue === null || r.estimatedValue === undefined
          ? null
          : Number(r.estimatedValue),
      deliveryMethod: String(r.deliveryMethod || 'instant_credit'),
      redemptionInstructions: String(r.redemptionInstructions || ''),
      expiryDays: Number(r.expiryDays || 365),
      startsAt: typeof r.startsAt === 'string' ? r.startsAt : null,
      endsAt: typeof r.endsAt === 'string' ? r.endsAt : null,
    }
    for (const g of games) {
      if (!byGame[g]) byGame[g] = []
      byGame[g].push(entry)
    }
  }
  return byGame
}

export default async function GamesTermsPage() {
  const payload = await getPayload({ config })
  const settings = (await payload.findGlobal({ slug: 'game-settings' })) as unknown as LooseRecord
  const termsCfg = (settings.terms as LooseRecord | undefined) || {}
  const complianceCfg = (settings.compliance as LooseRecord | undefined) || {}
  const fullContent = (termsCfg.fullContent as string) || '（後台尚未設定條款內容）'
  const version = (termsCfg.version as string) || '0'
  const lastUpdatedAt = termsCfg.lastUpdatedAt as string | undefined
  const monthlyMaxValue = Number(complianceCfg.monthlyMaxValuePerUser || 0)

  const poolByGame = await loadPoolByGame()

  return (
    <main className="min-h-screen bg-cream-50 pb-20">
      {/* Header */}
      <div className="bg-gradient-to-br from-gold-500/10 to-cream-100 border-b border-cream-200">
        <div className="max-w-3xl mx-auto px-4 py-10">
          <p className="text-xs tracking-[0.4em] text-gold-600 mb-2">COMPLIANCE &amp; TRANSPARENCY</p>
          <h1 className="text-2xl md:text-3xl font-serif mb-3">遊戲規範與獎項公示</h1>
          <p className="text-sm text-muted-foreground leading-relaxed">
            依《消費者保護法》及公平交易委員會抽獎活動相關規範，CHIC KIM &amp; MIU 公示所有互動遊戲之獎項清單、中獎機率、剩餘庫存與兌換方式。
          </p>
          <div className="flex gap-3 mt-4 text-xs text-muted-foreground">
            <span>規範版本：<span className="font-mono text-gold-700">{version}</span></span>
            {lastUpdatedAt && (
              <span>最後更新：{new Date(lastUpdatedAt).toLocaleDateString('zh-TW')}</span>
            )}
          </div>
        </div>
      </div>

      <div className="max-w-3xl mx-auto px-4 py-8 space-y-10">
        {/* 條文全文 */}
        <section>
          <h2 className="text-lg font-semibold mb-3 flex items-center gap-2">
            <span className="w-1 h-5 bg-gold-500 rounded-full" />
            完整條文
          </h2>
          <div className="bg-white border border-cream-200 rounded-2xl p-6">
            <pre className="whitespace-pre-wrap text-sm leading-7 text-foreground/90 font-sans">{fullContent}</pre>
          </div>
        </section>

        {/* 月度上限 */}
        {monthlyMaxValue > 0 && (
          <section>
            <h2 className="text-lg font-semibold mb-3 flex items-center gap-2">
              <span className="w-1 h-5 bg-gold-500 rounded-full" />
              月度獎品總值上限
            </h2>
            <div className="bg-amber-50 border border-amber-200 rounded-2xl p-5 text-sm">
              <p className="leading-relaxed">
                為避免異常累積，每位會員每月可獲得之獎品總值（依預估市值換算）上限為
                <span className="font-bold text-amber-700 mx-1">NT$ {monthlyMaxValue.toLocaleString()}</span>
                。達上限後，該月剩餘抽獎將自動顯示「銘謝惠顧（已達月度獎品上限）」，但仍計入每日次數。
              </p>
            </div>
          </section>
        )}

        {/* 各遊戲獎項清單 */}
        <section>
          <h2 className="text-lg font-semibold mb-3 flex items-center gap-2">
            <span className="w-1 h-5 bg-gold-500 rounded-full" />
            各遊戲獎項與機率公示
          </h2>
          <p className="text-xs text-muted-foreground mb-4">
            機率為當前後台設定之即時值；獎品上下架、庫存售罄等變動會即時影響實際抽獎結果。
          </p>

          {PUBLIC_PRIZE_SECTIONS.filter((g) => poolByGame[g.slug.replace(/-/g, "_")]).length === 0 && (
            <div className="bg-white border border-dashed border-cream-300 rounded-2xl p-8 text-center text-sm text-muted-foreground">
              <p>後台尚未設定大獎池獎品 — 系統暫以預設獎項抽獎，admin 可至「⑤ 互動體驗 → 大獎池獎品」配置。</p>
            </div>
          )}

          <div className="space-y-6">
            {PUBLIC_PRIZE_SECTIONS.map((game) => {
              const gameKey = game.slug.replace(/-/g, '_')
              const prizes = poolByGame[gameKey]
              if (!prizes || prizes.length === 0) return null
              const totalWeight = prizes.reduce((s, p) => s + p.weight, 0)

              return (
                <div key={game.id} className="bg-white border border-cream-200 rounded-2xl overflow-hidden">
                  <div className="flex items-center gap-3 px-5 py-4 bg-cream-50 border-b border-cream-200">
                    <span className="text-2xl">{game.icon}</span>
                    <div className="flex-1">
                      <h3 className="font-medium">{game.name}</h3>
                      <p className="text-xs text-muted-foreground">{game.description}</p>
                    </div>
                    <span className="text-xs text-muted-foreground">{prizes.length} 項獎品</span>
                  </div>

                  {game.id === MYSTERY_GIFT_SECTION.id && (
                    <div className="px-5 py-3 bg-rose-50 border-b border-rose-100 text-xs leading-relaxed text-rose-900">
                      本活動<strong>保證有獎</strong>，獎池不含「銘謝惠顧」；限量獎項發放完畢後改發保底獎項。
                      每位會員每檔活動限領一次，需登入會員且訂單完成付款後始發放；訂單取消或退款時獎項失效。
                    </div>
                  )}

                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead className="bg-cream-50 text-xs text-muted-foreground">
                        <tr>
                          <th className="text-left px-4 py-2 font-normal">獎品</th>
                          <th className="text-left px-4 py-2 font-normal">類型</th>
                          <th className="text-right px-4 py-2 font-normal">數量/面額</th>
                          <th className="text-right px-4 py-2 font-normal">機率</th>
                          <th className="text-right px-4 py-2 font-normal">預估市值</th>
                          <th className="text-left px-4 py-2 font-normal">兌換方式</th>
                          <th className="text-right px-4 py-2 font-normal">剩餘量</th>
                        </tr>
                      </thead>
                      <tbody>
                        {prizes
                          .sort((a, b) => b.weight - a.weight)
                          .map((p) => {
                            const probability = totalWeight > 0
                              ? ((p.weight / totalWeight) * 100).toFixed(2)
                              : '0.00'
                            const value = p.estimatedValue ?? estimatePrizeValueTwd(p.prizeType, p.amount)
                            const remainingDisplay = p.inventoryUnlimited
                              ? '不限'
                              : p.inventoryRemaining === null
                                ? '—'
                                : `${p.inventoryRemaining} / ${p.inventoryTotal ?? '?'}`
                            return (
                              <tr key={p.id} className="border-t border-cream-100">
                                <td className="px-4 py-2.5">{p.name}</td>
                                <td className="px-4 py-2.5 text-muted-foreground">
                                  {PRIZE_TYPE_LABELS[p.prizeType] || p.prizeType}
                                </td>
                                <td className="px-4 py-2.5 text-right tabular-nums">
                                  {p.amount > 0 ? p.amount.toLocaleString() : '—'}
                                </td>
                                <td className="px-4 py-2.5 text-right tabular-nums">
                                  <span className={p.prizeType === 'none' ? 'text-muted-foreground' : 'text-gold-600 font-medium'}>
                                    {probability}%
                                  </span>
                                </td>
                                <td className="px-4 py-2.5 text-right text-muted-foreground tabular-nums">
                                  {value > 0 ? `NT$ ${value.toLocaleString()}` : '—'}
                                </td>
                                <td className="px-4 py-2.5 text-xs text-muted-foreground">
                                  {DELIVERY_LABELS[p.deliveryMethod] || p.deliveryMethod}
                                </td>
                                <td className="px-4 py-2.5 text-right text-xs text-muted-foreground">
                                  {remainingDisplay}
                                </td>
                              </tr>
                            )
                          })}
                      </tbody>
                    </table>
                  </div>
                </div>
              )
            })}
          </div>
        </section>

        {/* 客服聯絡 */}
        <section className="bg-white border border-cream-200 rounded-2xl p-6 text-sm space-y-2">
          <h2 className="font-semibold">爭議與客服</h2>
          <p className="text-muted-foreground leading-relaxed">
            獎項相關爭議請於得獎日起 30 日內聯繫客服中心，逾期視同認可。
          </p>
          <p className="text-muted-foreground">
            客服信箱：<a href="mailto:service@chickimmiu.com" className="text-gold-600 underline">service@chickimmiu.com</a>
          </p>
          <p className="text-xs text-muted-foreground pt-2">
            本網站及 APP 內所有遊戲為娛樂消費回饋，<span className="text-amber-700 font-medium">不具任何投資或賭博性質</span>。
          </p>
        </section>
      </div>
    </main>
  )
}
