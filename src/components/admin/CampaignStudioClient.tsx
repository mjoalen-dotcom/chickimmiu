'use client'

import React, { useEffect, useState } from 'react'

/**
 * CampaignStudioClient — /admin/campaign-studio 的客端 UI
 * ────────────────────────────────────────────────────────
 * 稽核發現：preview API（POST /api/admin/campaigns/[id]/preview）寫好了、
 * admin 驗證過、零副作用，但**全站沒有任何一行 UI 呼叫它**——等於做了
 * 「試算」卻沒有人能用。這頁就是把它接起來：選活動、組一台測試購物車、
 * 看伺服器算出來的完整價格明細與規則命中/被拒原因。
 *
 * 刻意只做「試算」不做「編輯」：活動欄位仍在 Payload 原生編輯頁維護
 * （單一事實來源）。這裡回答的是上線前最關鍵、原本無從回答的問題——
 * 「這條規則對這台購物車，到底會折多少？沒折的話為什麼？」
 */

const GOLD = '#C19A5B'
const BORDER = 'var(--theme-elevation-150, #e4e4e7)'
const CARD = 'var(--theme-elevation-0, #fff)'
const TEXT = 'var(--theme-elevation-900, #111)'
const MUTED = 'var(--theme-elevation-600, #666)'
const DANGER = '#dc2626'
const OK = '#16a34a'

type CampaignLite = { id: number | string; campaignName: string; status: string; campaignSlug?: string }
type Row = { productId: string; quantity: number }

type PreviewResp = {
  ok: boolean
  errors?: string[]
  breakdown?: Record<string, number | string | boolean | null>
  evaluation?: {
    applications?: Array<{
      ruleKey: string
      slug: string
      source: string
      effectType: string
      discountAmount: number
      shippingDiscountAmount: number
    }>
    rejections?: Array<{ ruleKey: string; slug: string; source: string; reasonCodes: string[] }>
    progress?: Array<{ slug: string; label?: string; current?: number; target?: number; unlocked?: boolean }>
    rewardIntents?: Array<{ type: string; rewardKey?: string; productId?: number | string; multiplier?: number }>
  }
  lines?: Array<{
    lineId: string
    productName: string
    quantity: number
    unitPrice: number
    lineSubtotal: number
  }>
}

/** reason code → 人話。看得懂為什麼沒折，才有辦法修規則。 */
const REASON_TEXT: Record<string, string> = {
  applied: '已套用',
  not_started: '活動尚未開始',
  ended: '活動已結束',
  no_eligible_lines: '購物車沒有符合範圍的商品',
  condition_not_met: '觸發條件未達成',
  member_blocked: '該會員被列入排除分群',
  exclusive_group_conflict: '與同互斥群組中優先序更前的規則衝突',
  stacking_conflict: '與已套用的其他優惠不可疊加',
  per_user_limit_reached: '已達每人使用次數上限',
  total_usage_limit_reached: '已達活動總使用次數上限',
  budget_exhausted: '活動預算已用完',
  budget_unknown: '預算資料不完整（fail closed，不套用）',
  missing_cost_data: '商品缺成本資料，無法驗證毛利底線（fail closed）',
  margin_floor_violation: '折後毛利低於底線',
  zero_discount: '計算後折抵為 0',
  invalid_rule: '規則設定不合法',
}

const card: React.CSSProperties = {
  border: `1px solid ${BORDER}`,
  borderRadius: 12,
  padding: 20,
  background: CARD,
  marginBottom: 20,
}
const label: React.CSSProperties = { fontSize: 12, color: MUTED, display: 'block', marginBottom: 4 }
const input: React.CSSProperties = {
  padding: '8px 10px',
  border: `1px solid ${BORDER}`,
  borderRadius: 8,
  fontSize: 13,
  background: CARD,
  color: TEXT,
  width: '100%',
}
const th: React.CSSProperties = {
  textAlign: 'left',
  padding: '8px 12px',
  borderBottom: `2px solid ${BORDER}`,
  fontSize: 12,
  color: MUTED,
  fontWeight: 600,
}
const td: React.CSSProperties = { padding: '8px 12px', borderBottom: `1px solid ${BORDER}`, fontSize: 13 }

const money = (n: unknown) =>
  typeof n === 'number' ? `NT$ ${n.toLocaleString('zh-TW')}` : String(n ?? '—')

const CampaignStudioClient: React.FC = () => {
  const [campaigns, setCampaigns] = useState<CampaignLite[]>([])
  const [campaignId, setCampaignId] = useState<string>('')
  const [rows, setRows] = useState<Row[]>([{ productId: '', quantity: 1 }])
  const [coupon, setCoupon] = useState('')
  const [userId, setUserId] = useState('')
  const [resp, setResp] = useState<PreviewResp | null>(null)
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<string | null>(null)

  useEffect(() => {
    fetch('/api/marketing-campaigns?limit=100&depth=0&sort=-updatedAt', { credentials: 'include' })
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(`HTTP ${r.status}`))))
      .then((j: { docs?: CampaignLite[] }) => {
        const docs = j.docs ?? []
        setCampaigns(docs)
        if (docs[0]) setCampaignId(String(docs[0].id))
      })
      .catch((e: unknown) => setErr(e instanceof Error ? e.message : String(e)))
  }, [])

  const run = async () => {
    setBusy(true)
    setErr(null)
    setResp(null)
    try {
      const items = rows
        .filter((r) => r.productId.trim() !== '' && r.quantity > 0)
        .map((r) => ({ productId: r.productId.trim(), quantity: Number(r.quantity) }))
      if (items.length === 0) throw new Error('請至少填一個商品 ID 與數量')
      const r = await fetch(`/api/admin/campaigns/${campaignId}/preview`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          items,
          couponCodes: coupon.trim() ? [coupon.trim()] : [],
          userId: userId.trim() || undefined,
        }),
      })
      const j = (await r.json()) as PreviewResp
      if (!r.ok) throw new Error((j.errors ?? [`HTTP ${r.status}`]).join('、'))
      setResp(j)
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : String(e))
    } finally {
      setBusy(false)
    }
  }

  const apps = resp?.evaluation?.applications ?? []
  const rejs = resp?.evaluation?.rejections ?? []
  const intents = resp?.evaluation?.rewardIntents ?? []

  return (
    <>
      <section style={card}>
        <h2 style={{ margin: '0 0 4px', fontSize: 17, fontWeight: 600 }}>試算購物車</h2>
        <p style={{ margin: '0 0 16px', fontSize: 12, color: MUTED }}>
          用伺服器同一套計價引擎試算，<strong>零副作用</strong>：不會建訂單、不扣預算、不發獎、不寫用量。
          可試算草稿與已暫停的活動，上線前先確認折抵金額與規則命中結果。
        </p>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(220px,1fr))', gap: 12, marginBottom: 14 }}>
          <div>
            <span style={label}>活動</span>
            <select style={input} value={campaignId} onChange={(e) => setCampaignId(e.target.value)}>
              {campaigns.map((c) => (
                <option key={String(c.id)} value={String(c.id)}>
                  {c.campaignName}（{c.status}）
                </option>
              ))}
            </select>
          </div>
          <div>
            <span style={label}>優惠券碼（選填）</span>
            <input style={input} value={coupon} onChange={(e) => setCoupon(e.target.value)} placeholder="例：WELCOME100" />
          </div>
          <div>
            <span style={label}>以哪位會員身分試算（選填會員 ID）</span>
            <input style={input} value={userId} onChange={(e) => setUserId(e.target.value)} placeholder="留空 = 訪客" />
          </div>
        </div>

        <span style={label}>商品（填商品 ID 與數量）</span>
        {rows.map((r, i) => (
          <div key={i} style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
            <input
              style={{ ...input, flex: 2 }}
              value={r.productId}
              placeholder="商品 ID"
              onChange={(e) => {
                const next = [...rows]
                next[i] = { ...next[i], productId: e.target.value }
                setRows(next)
              }}
            />
            <input
              style={{ ...input, flex: 1 }}
              type="number"
              min={1}
              value={r.quantity}
              onChange={(e) => {
                const next = [...rows]
                next[i] = { ...next[i], quantity: Number(e.target.value) }
                setRows(next)
              }}
            />
            <button
              type="button"
              onClick={() => setRows(rows.filter((_, idx) => idx !== i))}
              disabled={rows.length === 1}
              style={{ ...input, width: 44, cursor: 'pointer', opacity: rows.length === 1 ? 0.4 : 1 }}
            >
              ×
            </button>
          </div>
        ))}
        <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
          <button
            type="button"
            onClick={() => setRows([...rows, { productId: '', quantity: 1 }])}
            style={{ ...input, width: 'auto', cursor: 'pointer' }}
          >
            + 加一列
          </button>
          <button
            type="button"
            onClick={run}
            disabled={busy || !campaignId}
            style={{
              ...input,
              width: 'auto',
              cursor: busy ? 'wait' : 'pointer',
              background: GOLD,
              color: '#fff',
              border: `1px solid ${GOLD}`,
              fontWeight: 600,
            }}
          >
            {busy ? '試算中…' : '執行試算'}
          </button>
        </div>

        {err ? (
          <p style={{ marginTop: 14, fontSize: 13, color: DANGER }}>試算失敗：{err}</p>
        ) : null}
      </section>

      {resp ? (
        <>
          <section style={card}>
            <h2 style={{ margin: '0 0 12px', fontSize: 17, fontWeight: 600 }}>價格明細</h2>
            {resp.ok === false ? (
              <p style={{ fontSize: 13, color: DANGER, margin: 0 }}>
                計價未通過：{(resp.errors ?? []).join('、')}
              </p>
            ) : (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(160px,1fr))', gap: 12 }}>
                {[
                  ['商品小計', 'itemsSubtotal'],
                  ['活動折抵', 'promotionDiscount'],
                  ['優惠券折抵', 'couponDiscount'],
                  ['會員折扣', 'memberDiscount'],
                  ['運費', 'shippingFee'],
                  ['商品成本', 'itemsCost'],
                  ['應付總額', 'total'],
                ].map(([lbl, key]) => (
                  <div key={key} style={{ border: `1px solid ${BORDER}`, borderRadius: 10, padding: 12 }}>
                    <div style={{ fontSize: 11, color: MUTED, marginBottom: 4 }}>{lbl}</div>
                    <div style={{ fontSize: 18, fontWeight: 700, color: key === 'total' ? GOLD : TEXT }}>
                      {money(resp.breakdown?.[key as string])}
                    </div>
                  </div>
                ))}
              </div>
            )}
            {resp.breakdown && resp.breakdown.costDataComplete === false ? (
              <p style={{ marginTop: 12, fontSize: 12, color: DANGER }}>
                ⚠ 有商品未填成本，「商品成本」低估、毛利會被高估；毛利底線護欄對這台車無法可靠驗證。
              </p>
            ) : null}
          </section>

          <section style={card}>
            <h2 style={{ margin: '0 0 12px', fontSize: 17, fontWeight: 600 }}>
              規則命中 <span style={{ fontSize: 13, color: MUTED, fontWeight: 400 }}>（{apps.length} 條套用 / {rejs.length} 條未套用）</span>
            </h2>
            {apps.length === 0 && rejs.length === 0 ? (
              <p style={{ fontSize: 13, color: MUTED, margin: 0 }}>沒有任何規則參與這台購物車。</p>
            ) : (
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr>
                      <th style={th}>規則</th>
                      <th style={th}>來源</th>
                      <th style={th}>結果</th>
                      <th style={{ ...th, textAlign: 'right' }}>折抵</th>
                    </tr>
                  </thead>
                  <tbody>
                    {apps.map((a) => (
                      <tr key={a.ruleKey}>
                        <td style={td}>{a.slug}</td>
                        <td style={td}>{a.source === 'coupon' ? '優惠券' : '活動規則'}</td>
                        <td style={{ ...td, color: OK, fontWeight: 600 }}>已套用（{a.effectType}）</td>
                        <td style={{ ...td, textAlign: 'right' }}>
                          {money(a.discountAmount + a.shippingDiscountAmount)}
                        </td>
                      </tr>
                    ))}
                    {rejs.map((r) => (
                      <tr key={r.ruleKey}>
                        <td style={td}>{r.slug}</td>
                        <td style={td}>{r.source === 'coupon' ? '優惠券' : '活動規則'}</td>
                        <td style={{ ...td, color: MUTED }}>
                          {r.reasonCodes.map((c) => REASON_TEXT[c] ?? c).join('；')}
                        </td>
                        <td style={{ ...td, textAlign: 'right', color: MUTED }}>—</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>

          {intents.length > 0 ? (
            <section style={card}>
              <h2 style={{ margin: '0 0 8px', fontSize: 17, fontWeight: 600 }}>將發放的獎勵</h2>
              <p style={{ margin: '0 0 12px', fontSize: 12, color: MUTED }}>
                贈品會在計價時直接以 0 元行加入購物車；點數倍率與獎項於付款成功後發放。
              </p>
              <ul style={{ margin: 0, paddingLeft: 18, fontSize: 13 }}>
                {intents.map((it, i) => (
                  <li key={i} style={{ marginBottom: 4 }}>
                    {it.type === 'gift_item'
                      ? `贈品：商品 #${it.productId}`
                      : it.type === 'points_multiplier'
                        ? `點數倍率 ×${it.multiplier}`
                        : `獎項：${it.rewardKey}`}
                  </li>
                ))}
              </ul>
            </section>
          ) : null}

          <section style={card}>
            <h2 style={{ margin: '0 0 12px', fontSize: 17, fontWeight: 600 }}>試算購物車內容</h2>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr>
                    <th style={th}>商品</th>
                    <th style={{ ...th, textAlign: 'right' }}>數量</th>
                    <th style={{ ...th, textAlign: 'right' }}>單價</th>
                    <th style={{ ...th, textAlign: 'right' }}>小計</th>
                  </tr>
                </thead>
                <tbody>
                  {(resp.lines ?? []).map((l) => (
                    <tr key={l.lineId}>
                      <td style={td}>
                        {l.productName}
                        {l.unitPrice === 0 ? (
                          <span style={{ marginLeft: 6, fontSize: 11, color: GOLD }}>贈品</span>
                        ) : null}
                      </td>
                      <td style={{ ...td, textAlign: 'right' }}>{l.quantity}</td>
                      <td style={{ ...td, textAlign: 'right' }}>{money(l.unitPrice)}</td>
                      <td style={{ ...td, textAlign: 'right' }}>{money(l.lineSubtotal)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        </>
      ) : null}
    </>
  )
}

export default CampaignStudioClient
