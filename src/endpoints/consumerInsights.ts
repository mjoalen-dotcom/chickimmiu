import type { Endpoint, PayloadRequest } from 'payload'

/**
 * GET /api/users/consumer-insights?days=30
 * ─────────────────────────────────────────
 * 消費者分析儀表板資料源（僅 admin 可呼叫）。
 *
 * 一次回傳 6 大區塊：
 *   1. funnel              — pageview → product_view → add_to_cart → checkout_start → purchase
 *   2. topPages            — top 30 pagePath × views / avg dwell / scroll median
 *   3. clickHotspots       — top elementKey × click count
 *   4. cartAbandonment     — top 20 商品：加購數 - 購買數 = 流失
 *   5. sourceDeviceMatrix  — UTM source × deviceType × pageview / atc / purchase 比率
 *   6. recommendations     — 8-12 條 rule-based 經營建議（含 severity）
 *
 * 資料量假設：封測期 < 50k events / 30d。in-memory 算夠用；
 *   超過 100k events 改 raw SQL group by。
 *
 * 設計選擇：
 *   - days 參數 7 / 14 / 30 / 90，預設 30
 *   - 不算 unique users（高成本，要 sessionId set）只算總次數＋unique session
 *   - dwell 中位數用 sort + index，不用平均（被 idle tab 拉歪）
 */

type EventLite = {
  id: string | number
  eventType: string
  sessionId?: string | null
  pagePath?: string | null
  product?: string | number | null
  elementKey?: string | null
  value?: number | null
  quantity?: number | null
  durationMs?: number | null
  scrollPctMax?: number | null
  utmSource?: string | null
  utmCampaign?: string | null
  deviceType?: string | null
  createdAt?: string | null
}

type ProductLite = {
  id: string | number
  name?: string | null
  title?: string | null
  slug?: string | null
}

type OrderLite = {
  id: string | number
  total?: number | null
  status?: string | null
  items?: Array<{ product?: string | number | null; quantity?: number | null }> | null
  createdAt?: string | null
}

interface FunnelStage {
  key: string
  label: string
  sessions: number
  events: number
  conversionFromPrev: number // 0..1
}

interface TopPageRow {
  pagePath: string
  views: number
  uniqueSessions: number
  avgDwellSec: number
  medianScrollPct: number
}

interface ClickHotspotRow {
  elementKey: string
  count: number
  topPagePath?: string
}

interface CartAbandonRow {
  productId: string | number
  productName: string
  addToCartCount: number
  purchaseCount: number
  abandonCount: number
  abandonRate: number // 0..1
}

interface SourceDeviceRow {
  source: string
  deviceType: string
  pageviews: number
  addToCarts: number
  purchases: number
  atcRate: number
  purchaseRate: number
}

interface Recommendation {
  id: string
  severity: 'info' | 'warn' | 'critical'
  title: string
  body: string
  metric?: string
}

function median(arr: number[]): number {
  if (!arr.length) return 0
  const sorted = [...arr].sort((a, b) => a - b)
  const mid = Math.floor(sorted.length / 2)
  return sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid]
}

export const consumerInsightsEndpoint: Endpoint = {
  path: '/consumer-insights',
  method: 'get',
  handler: async (req: PayloadRequest) => {
    const user = req.user
    if (!user || (user as { role?: string }).role !== 'admin') {
      return Response.json({ error: 'Unauthorized' }, { status: 401 })
    }

    try {
      const url = new URL(req.url || 'http://localhost')
      const daysRaw = parseInt(url.searchParams.get('days') || '30', 10)
      const days = [7, 14, 30, 90].includes(daysRaw) ? daysRaw : 30

      const since = new Date(Date.now() - days * 86400000).toISOString()

      // ── 1. Behavior events (30 天) ─────────────────────────────────────
      const eventsResp = await req.payload.find({
        collection: 'behavior-events',
        where: { createdAt: { greater_than_equal: since } },
        limit: 100000,
        depth: 0,
        pagination: false,
        overrideAccess: true,
      })
      const events = eventsResp.docs as unknown as EventLite[]

      // ── 2. Orders (30 天，已付款以上) ──────────────────────────────────
      const ordersResp = await req.payload.find({
        collection: 'orders',
        where: {
          createdAt: { greater_than_equal: since },
          status: { in: ['processing', 'shipped', 'delivered', 'completed'] },
        },
        limit: 20000,
        depth: 0,
        pagination: false,
        overrideAccess: true,
      })
      const orders = ordersResp.docs as unknown as OrderLite[]

      // ── 3. Products (商品 id → 名字) ──────────────────────────────────
      const productsResp = await req.payload.find({
        collection: 'products',
        limit: 10000,
        depth: 0,
        pagination: false,
        overrideAccess: true,
      })
      const products = productsResp.docs as unknown as ProductLite[]
      const productNameMap = new Map<string, string>()
      for (const p of products) {
        productNameMap.set(
          String(p.id),
          p.name || p.title || p.slug || `商品 #${p.id}`,
        )
      }

      // ──────────────────────────────────────────────────────────────────
      // Section 1: Funnel
      // ──────────────────────────────────────────────────────────────────
      // 用「unique session 觸發過該事件」算每階段
      const stageSessions: Record<string, Set<string>> = {
        pageview: new Set(),
        product_view: new Set(),
        add_to_cart: new Set(),
        checkout_start: new Set(),
        purchase: new Set(),
      }
      const stageEvents: Record<string, number> = {
        pageview: 0,
        product_view: 0,
        add_to_cart: 0,
        checkout_start: 0,
        purchase: 0,
      }
      for (const ev of events) {
        if (!ev.eventType || !ev.sessionId) continue
        if (ev.eventType in stageSessions) {
          stageSessions[ev.eventType].add(ev.sessionId)
          stageEvents[ev.eventType] += 1
        }
      }
      // Orders 也算進 purchase（補事件流失）
      const ordersTotal = orders.length

      const funnelOrder: { key: string; label: string }[] = [
        { key: 'pageview', label: '網站瀏覽' },
        { key: 'product_view', label: '商品瀏覽' },
        { key: 'add_to_cart', label: '加入購物車' },
        { key: 'checkout_start', label: '開始結帳' },
        { key: 'purchase', label: '完成購買' },
      ]
      const funnel: FunnelStage[] = []
      let prev: number | null = null
      for (const stg of funnelOrder) {
        let sessions = stageSessions[stg.key].size
        let evtCount = stageEvents[stg.key]
        if (stg.key === 'purchase') {
          // 用 Orders 數補 purchase（更準）
          sessions = Math.max(sessions, ordersTotal)
          evtCount = Math.max(evtCount, ordersTotal)
        }
        const cvr = prev != null && prev > 0 ? sessions / prev : 1
        funnel.push({
          key: stg.key,
          label: stg.label,
          sessions,
          events: evtCount,
          conversionFromPrev: cvr,
        })
        prev = sessions
      }

      // ──────────────────────────────────────────────────────────────────
      // Section 2: Top pages
      // ──────────────────────────────────────────────────────────────────
      // 一次 walk events：對每個 pagePath 累加
      type PageBucket = {
        views: number
        sessionSet: Set<string>
        dwells: number[]
        scrollMax: number[]
      }
      const pageBuckets = new Map<string, PageBucket>()
      const ensurePage = (path: string): PageBucket => {
        let b = pageBuckets.get(path)
        if (!b) {
          b = { views: 0, sessionSet: new Set(), dwells: [], scrollMax: [] }
          pageBuckets.set(path, b)
        }
        return b
      }
      for (const ev of events) {
        if (!ev.pagePath) continue
        const b = ensurePage(ev.pagePath)
        if (ev.eventType === 'pageview') {
          b.views += 1
          if (ev.sessionId) b.sessionSet.add(ev.sessionId)
        }
        if (ev.eventType === 'dwell') {
          if (typeof ev.durationMs === 'number' && ev.durationMs > 0) {
            b.dwells.push(ev.durationMs)
          }
          if (typeof ev.scrollPctMax === 'number') {
            b.scrollMax.push(ev.scrollPctMax)
          }
        }
      }
      const topPages: TopPageRow[] = Array.from(pageBuckets.entries())
        .map(([path, b]) => ({
          pagePath: path,
          views: b.views,
          uniqueSessions: b.sessionSet.size,
          avgDwellSec:
            b.dwells.length > 0
              ? Math.round(b.dwells.reduce((a, c) => a + c, 0) / b.dwells.length / 100) /
                10 // round to 0.1s
              : 0,
          medianScrollPct: Math.round(median(b.scrollMax)),
        }))
        .sort((a, b) => b.views - a.views)
        .slice(0, 30)

      // ──────────────────────────────────────────────────────────────────
      // Section 3: Click hotspots
      // ──────────────────────────────────────────────────────────────────
      type ClickBucket = { count: number; pageMap: Map<string, number> }
      const clickBuckets = new Map<string, ClickBucket>()
      for (const ev of events) {
        if (ev.eventType !== 'click' || !ev.elementKey) continue
        let b = clickBuckets.get(ev.elementKey)
        if (!b) {
          b = { count: 0, pageMap: new Map() }
          clickBuckets.set(ev.elementKey, b)
        }
        b.count += 1
        if (ev.pagePath) {
          b.pageMap.set(ev.pagePath, (b.pageMap.get(ev.pagePath) || 0) + 1)
        }
      }
      const clickHotspots: ClickHotspotRow[] = Array.from(clickBuckets.entries())
        .map(([key, b]) => {
          let topPath: string | undefined
          let topCount = 0
          for (const [p, c] of b.pageMap) {
            if (c > topCount) {
              topCount = c
              topPath = p
            }
          }
          return { elementKey: key, count: b.count, topPagePath: topPath }
        })
        .sort((a, b) => b.count - a.count)
        .slice(0, 20)

      // ──────────────────────────────────────────────────────────────────
      // Section 4: Cart abandonment by product
      // ──────────────────────────────────────────────────────────────────
      const productAtc = new Map<string, number>()
      for (const ev of events) {
        if (ev.eventType !== 'add_to_cart' || ev.product == null) continue
        const id = String(ev.product)
        productAtc.set(id, (productAtc.get(id) || 0) + (ev.quantity || 1))
      }
      const productPurchase = new Map<string, number>()
      for (const ord of orders) {
        const items = Array.isArray(ord.items) ? ord.items : []
        for (const it of items) {
          if (it.product == null) continue
          const id = String(it.product)
          productPurchase.set(id, (productPurchase.get(id) || 0) + (it.quantity || 1))
        }
      }
      const cartAbandon: CartAbandonRow[] = []
      for (const [id, atc] of productAtc) {
        const purchased = productPurchase.get(id) || 0
        const abandon = atc - purchased
        // 只列入有流失（atc > 0、且至少 1 件未購）
        if (atc <= 0) continue
        cartAbandon.push({
          productId: id,
          productName: productNameMap.get(id) || `商品 #${id}`,
          addToCartCount: atc,
          purchaseCount: Math.min(purchased, atc),
          abandonCount: Math.max(abandon, 0),
          abandonRate: atc > 0 ? Math.max(0, Math.min(1, abandon / atc)) : 0,
        })
      }
      cartAbandon.sort((a, b) => b.abandonCount - a.abandonCount)
      const cartAbandonTop = cartAbandon.slice(0, 20)

      // ──────────────────────────────────────────────────────────────────
      // Section 5: Source × Device matrix
      // ──────────────────────────────────────────────────────────────────
      type SrcDevBucket = {
        source: string
        deviceType: string
        pageviews: number
        addToCarts: number
        purchases: number
      }
      const srcDevMap = new Map<string, SrcDevBucket>()
      const srcDevKey = (s: string, d: string) => `${s}||${d}`
      const ensureSrcDev = (s: string, d: string): SrcDevBucket => {
        const k = srcDevKey(s, d)
        let b = srcDevMap.get(k)
        if (!b) {
          b = { source: s, deviceType: d, pageviews: 0, addToCarts: 0, purchases: 0 }
          srcDevMap.set(k, b)
        }
        return b
      }
      for (const ev of events) {
        const s = ev.utmSource || '(direct)'
        const d = ev.deviceType || 'unknown'
        const b = ensureSrcDev(s, d)
        if (ev.eventType === 'pageview') b.pageviews += 1
        else if (ev.eventType === 'add_to_cart') b.addToCarts += 1
        else if (ev.eventType === 'purchase') b.purchases += 1
      }
      const sourceDeviceMatrix: SourceDeviceRow[] = Array.from(srcDevMap.values())
        .filter((r) => r.pageviews + r.addToCarts + r.purchases > 0)
        .map((r) => ({
          ...r,
          atcRate: r.pageviews > 0 ? r.addToCarts / r.pageviews : 0,
          purchaseRate: r.addToCarts > 0 ? r.purchases / r.addToCarts : 0,
        }))
        .sort((a, b) => b.pageviews - a.pageviews)
        .slice(0, 30)

      // ──────────────────────────────────────────────────────────────────
      // Section 6: Rule-based recommendations
      // ──────────────────────────────────────────────────────────────────
      const recs: Recommendation[] = []

      // R1: 整體 atc rate < 5% → 商品列表 / PDP 文案要強化
      const totalPv = funnel[0]?.sessions || 0
      const totalAtc = funnel[2]?.sessions || 0
      const overallAtcRate = totalPv > 0 ? totalAtc / totalPv : 0
      if (totalPv >= 100 && overallAtcRate < 0.05) {
        recs.push({
          id: 'low_atc_rate',
          severity: 'warn',
          title: '整站加購率偏低',
          body: `近 ${days} 天 ${totalPv.toLocaleString()} 個 session 進站，只有 ${(overallAtcRate * 100).toFixed(1)}% 觸發加購（業界基準 8-12%）。建議檢查商品列表縮圖點擊率、PDP 主圖品質、加入購物車按鈕對比度。`,
          metric: `${(overallAtcRate * 100).toFixed(1)}% (${totalAtc}/${totalPv})`,
        })
      } else if (totalPv >= 100 && overallAtcRate >= 0.12) {
        recs.push({
          id: 'high_atc_rate',
          severity: 'info',
          title: '整站加購率優於業界',
          body: `近 ${days} 天加購率 ${(overallAtcRate * 100).toFixed(1)}%，顯著高於業界 8-12% 基準。建議乘勝追擊加大廣告投放，並複製此 PDP 結構到新上架商品。`,
          metric: `${(overallAtcRate * 100).toFixed(1)}%`,
        })
      }

      // R2: ATC → checkout 流失率 > 70%（購物車到結帳的漏失）
      const totalCheckoutStart = funnel[3]?.sessions || 0
      const atcToCheckout = totalAtc > 0 ? totalCheckoutStart / totalAtc : 0
      if (totalAtc >= 30 && atcToCheckout < 0.3) {
        recs.push({
          id: 'cart_to_checkout_drop',
          severity: 'critical',
          title: '購物車到結帳流失嚴重',
          body: `${totalAtc} 個 session 加了購物車，但只有 ${totalCheckoutStart} 個（${(atcToCheckout * 100).toFixed(0)}%）進入結帳頁。常見原因：運費門檻不透明 / 必填欄位過多 / cart drawer CTA 顯眼度不夠。優先在 cart drawer 加上「免運倒數」、把「結帳」按鈕拉大。`,
          metric: `${(atcToCheckout * 100).toFixed(0)}% 進入結帳`,
        })
      }

      // R3: 結帳 → 完成購買流失率 > 50%
      const totalPurchase = funnel[4]?.sessions || 0
      const checkoutToPurchase =
        totalCheckoutStart > 0 ? totalPurchase / totalCheckoutStart : 0
      if (totalCheckoutStart >= 15 && checkoutToPurchase < 0.5) {
        recs.push({
          id: 'checkout_to_purchase_drop',
          severity: 'critical',
          title: '結帳完成率過低',
          body: `${totalCheckoutStart} 個 session 進入結帳頁，最後只有 ${totalPurchase} 個（${(checkoutToPurchase * 100).toFixed(0)}%）真的下單。可能是付款方式選項不足、信用卡 3DS 失敗、或運費突然出現嚇跑客人。建議檢查 ECPay 失敗率 + COD 是否被誤關。`,
          metric: `${(checkoutToPurchase * 100).toFixed(0)}% 完成購買`,
        })
      }

      // R4: 高加購但低購買的商品（庫存或定價問題）
      const top3Abandon = cartAbandonTop
        .filter((r) => r.addToCartCount >= 5 && r.abandonRate >= 0.7)
        .slice(0, 3)
      if (top3Abandon.length > 0) {
        recs.push({
          id: 'high_abandon_products',
          severity: 'warn',
          title: '高加購低購買的「燙手山芋」商品',
          body:
            `這 ${top3Abandon.length} 個商品被頻繁加購但很少結單（流失率 ≥ 70%）：` +
            top3Abandon
              .map((r) => `「${r.productName}」(${r.addToCartCount}加/${r.purchaseCount}買)`)
              .join('、') +
            '。常見原因是定價偏高、缺色/缺尺寸、運費攤不平。建議：(1) 檢查是否缺貨；(2) 加上「最後X件」標示製造急迫感；(3) 跑一波限時 95 折看會不會解鎖。',
        })
      }

      // R5: 短停留頁面（首屏沒抓住人）
      const shortDwellPages = topPages
        .filter((p) => p.views >= 30 && p.avgDwellSec < 10)
        .slice(0, 3)
      if (shortDwellPages.length > 0) {
        recs.push({
          id: 'short_dwell_pages',
          severity: 'warn',
          title: '進站秒跳的頁面',
          body:
            `這 ${shortDwellPages.length} 個頁面瀏覽量 ≥ 30 但平均停留 < 10 秒（首屏沒抓住人）：` +
            shortDwellPages
              .map((p) => `${p.pagePath}（${p.views}次/${p.avgDwellSec}s）`)
              .join('、') +
            '。建議檢查首屏是否要 hero image 過大、文案是否點題、CTA 是否一秒內看到。',
        })
      }

      // R6: 低 scroll depth 頁面（內容沒人滑下來）
      const lowScrollPages = topPages
        .filter((p) => p.views >= 50 && p.medianScrollPct > 0 && p.medianScrollPct < 30)
        .slice(0, 3)
      if (lowScrollPages.length > 0) {
        recs.push({
          id: 'low_scroll_pages',
          severity: 'info',
          title: '內容沒人滑下來的頁面',
          body:
            `這 ${lowScrollPages.length} 個頁面瀏覽量足但 scroll 中位數 < 30%：` +
            lowScrollPages.map((p) => `${p.pagePath}（${p.medianScrollPct}%）`).join('、') +
            '。建議：把最重要 CTA 從中段移到首屏；或重排首屏 hero 拉高轉化吸引力。',
        })
      }

      // R7: 單一來源高流量低轉換
      const lowConvSources = sourceDeviceMatrix
        .filter((r) => r.pageviews >= 200 && r.atcRate < 0.03 && r.source !== '(direct)')
        .slice(0, 3)
      if (lowConvSources.length > 0) {
        recs.push({
          id: 'low_conv_source',
          severity: 'warn',
          title: '高流量低轉換的廣告來源',
          body:
            `這些 source 帶進大量流量（≥200 PV）但加購率 < 3%：` +
            lowConvSources
              .map((r) => `${r.source}/${r.deviceType}（${(r.atcRate * 100).toFixed(1)}%）`)
              .join('、') +
            '。建議檢查廣告承諾跟 landing page 是否落差太大，或廣告受眾鎖太寬把不對的客群帶進來。',
        })
      }

      // R8: 行動裝置轉換劣勢
      const mobileSrc = sourceDeviceMatrix.filter((r) => r.deviceType === 'mobile')
      const desktopSrc = sourceDeviceMatrix.filter((r) => r.deviceType === 'desktop')
      const mobileAtcAvg =
        mobileSrc.length > 0
          ? mobileSrc.reduce((s, r) => s + r.atcRate, 0) / mobileSrc.length
          : 0
      const desktopAtcAvg =
        desktopSrc.length > 0
          ? desktopSrc.reduce((s, r) => s + r.atcRate, 0) / desktopSrc.length
          : 0
      if (mobileAtcAvg > 0 && desktopAtcAvg > 0 && mobileAtcAvg < desktopAtcAvg * 0.5) {
        recs.push({
          id: 'mobile_underperform',
          severity: 'warn',
          title: '行動裝置加購率僅桌機一半',
          body: `mobile 平均加購率 ${(mobileAtcAvg * 100).toFixed(1)}% vs desktop ${(desktopAtcAvg * 100).toFixed(1)}%。這通常是 PDP 在小螢幕上 CTA 被擠下首屏 / 圖片載太慢 / 字級太小。建議在 iPhone 上實際走一次購物流程找痛點。`,
          metric: `mobile ${(mobileAtcAvg * 100).toFixed(1)}% vs desktop ${(desktopAtcAvg * 100).toFixed(1)}%`,
        })
      }

      // R9: 沒人點的「死按鈕」
      const liveClickKeys = new Set(clickHotspots.map((c) => c.elementKey))
      const importantKeys = ['navbar-search', 'navbar-wishlist', 'navbar-login', 'navbar-cart']
      const deadKeys = importantKeys.filter((k) => !liveClickKeys.has(k))
      if (deadKeys.length >= 2 && totalPv >= 200) {
        recs.push({
          id: 'dead_navbar_buttons',
          severity: 'info',
          title: '導覽列功能未被使用',
          body: `${deadKeys.join('、')} 在 ${days} 天內 0 次點擊。可能是位置太邊緣、icon 含意不明，或這些功能不被需要。考慮把使用率高的功能往中間移、icon 加文字。`,
        })
      }

      // R10: 行動裝置 < 30% 流量（封測常見：自有名單以桌機為主）
      const totalMobilePv = mobileSrc.reduce((s, r) => s + r.pageviews, 0)
      const totalDesktopPv = desktopSrc.reduce((s, r) => s + r.pageviews, 0)
      const mobileShare =
        totalMobilePv + totalDesktopPv > 0
          ? totalMobilePv / (totalMobilePv + totalDesktopPv)
          : 0
      if (totalPv >= 200 && mobileShare > 0 && mobileShare < 0.4) {
        recs.push({
          id: 'low_mobile_share',
          severity: 'info',
          title: '行動流量比重偏低',
          body: `行動裝置只佔 ${(mobileShare * 100).toFixed(0)}% 流量（時尚/服裝產業 mobile 通常 70%+）。可能是廣告受眾偏 desktop，或 IG/FB 帶進的訪客被導去 desktop landing。建議檢查廣告受眾裝置設定。`,
          metric: `mobile ${(mobileShare * 100).toFixed(0)}%`,
        })
      }

      // R11: top click 元素也是 CTA candidate
      if (clickHotspots.length > 0 && clickHotspots[0].count >= 50) {
        const top = clickHotspots[0]
        recs.push({
          id: 'top_click_signal',
          severity: 'info',
          title: `「${top.elementKey}」是當前最熱按鈕`,
          body: `近 ${days} 天 ${top.count} 次點擊。${top.topPagePath ? `集中在 ${top.topPagePath}。` : ''}如果這條 CTA 通往的轉換頁不順暢，可能是巨大流失點；建議優先確認該動線。`,
        })
      }

      // R12: 沒有資料的提醒
      if (events.length < 50) {
        recs.push({
          id: 'insufficient_data',
          severity: 'info',
          title: '資料量還不足',
          body: `近 ${days} 天只收到 ${events.length} 筆行為事件。可能原因：(1) 流量本來就低；(2) 多數訪客沒點 cookie 同意；(3) BehaviorTracker 部署沒完成。建議檢查 cookie consent 接受率，或先把樣本拉到 ≥500 再做大決策。`,
        })
      }

      // ── shape ─────────────────────────────────────────────────────────
      return Response.json({
        generatedAt: new Date().toISOString(),
        windowDays: days,
        totals: {
          events: events.length,
          orders: orders.length,
        },
        funnel,
        topPages,
        clickHotspots,
        cartAbandonment: cartAbandonTop,
        sourceDeviceMatrix,
        recommendations: recs,
      })
    } catch (e) {
      req.payload.logger.error({ msg: 'consumer-insights failed', err: e })
      return Response.json(
        { error: 'Internal error', detail: e instanceof Error ? e.message : String(e) },
        { status: 500 },
      )
    }
  },
}
