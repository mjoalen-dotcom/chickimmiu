# Session 25E — 營運 Dashboard（admin 首頁）

> **Parent plan**：`docs/session-prompts/25-master-inventory-fulfillment-parallel-plan.md`
> **Worktree**：`../ckmu-dashboard` on branch `feat/admin-dashboard`
> **起點 SHA**：main 最新（≥ `009845b`）
> **平行性**：與 25A / 25B / 25C / 25D 完全平行；只讀，不動 schema

## 目標

擴充既有的 [`src/components/admin/Dashboard.tsx`](src/components/admin/Dashboard.tsx)（799 行，已 wired 為 admin 首頁，已含 8 KPI + 月份 stats + recent orders + revenue chart + 低庫存卡 + 補貨提醒連結）加入兩個缺口：

1. **本週熱賣 Top 10 表**
2. **待出貨訂單列表**（既有的只有 count，無明細）

**為什麼價值高**：團隊只有 1-2 人，每天問同樣問題（今天賣多少 ✅ 已有、有幾筆待處理 ✅ count 已有但無明細、什麼快沒貨 ✅ 已有、什麼最暢銷 ❌ 缺）；補完這 2 塊整個 dashboard 就完整。

## 現況盤點（動工前必讀）

`Dashboard.tsx` 已完成的部分（**勿重做**）：
- TodayStats：revenue / orders / visitors=0 / newMembers / pendingOrders / pendingTickets / returns / AOV
- MonthStats：revenue / orders / newMembers
- 低庫存商品 KPI（line 507）+ 連到 `/admin/collections/products?where[isLowStock][equals]=true`（line 691）
- DailyRevenue 圖表
- RecentOrder 列表
- 完整 brand color tokens（GOLD/CREAM/DARK/MUTED 等，WCAG AA 已調過）
- 已 wired in `payload.config.ts` 的 admin.components

本組要加的：
- 本週熱賣 Top 10 表
- 待出貨訂單明細列表（補既有 pendingOrders count 的詳細）

## Non-goals

- 互動式 BI / drill-down（資料量還小，圖表庫太重；用 server-rendered 卡片就夠）
- 自訂時間範圍（v1 固定四象限：今天 / 本週 / 本月 / 全期）
- 匯出報表 PDF（25D 訂單匯出夠用）
- 趨勢線圖 / 同期比（v2 加，v1 只給絕對數字）
- 即時更新（每次開頁拉新數據，不接 SSE/WS）

## 內容

### 2 張表（本組工作範圍）

**A. 本週熱賣 Top 10**：
- 欄位：商品名 / variants / 賣出數量 / 營收
- 來源：Orders.items aggregate 過去 7 天（status not in cancelled/refunded）
- 排序：賣出數量 DESC

**B. 待出貨訂單**：
- 欄位：訂單號 / 顧客 / 金額 / 建立時間 / 配送方式
- 來源：Orders where status='processing' AND paymentStatus='paid' ORDER BY createdAt ASC
- 上限 10 筆；下方一條「→ 查看全部」連到 list view

## 檔案變更清單

### 修改 `src/components/admin/Dashboard.tsx`（**唯一檔案**）

既有檔是 single 'use client' file 用 fetch + useState pattern（line 104-129 的 `safeJson` + `fetchOrdersInRange` 等 helpers 已有）。沿用同 pattern：

**1. 加 type interfaces**：
```ts
interface TopSeller {
  productId: string
  variantSku: string | null
  name: string
  qty: number
  revenue: number
}

interface PendingShipment {
  id: string
  orderNumber: string
  customer: string
  total: number
  createdAt: string
  shippingMethodLabel: string
}
```

**2. 加 fetch helpers**：
```ts
async function fetchTopSellers(): Promise<TopSeller[]> {
  const weekAgo = new Date(Date.now() - 7 * 86400 * 1000).toISOString()
  // 取過去 7 天非取消/退款 orders，depth=1 拿 items
  const res = await safeJson(
    `/api/orders?limit=500&depth=1` +
    `&where[createdAt][greater_than_equal]=${encodeURIComponent(weekAgo)}` +
    `&where[status][not_in][0]=cancelled&where[status][not_in][1]=refunded`
  )
  const docs = res?.docs ?? []
  // in-memory aggregate by SKU
  const map = new Map<string, TopSeller>()
  for (const o of docs) for (const item of o.items ?? []) {
    const productId = typeof item.product === 'object' ? item.product?.id : item.product
    const key = `${productId ?? 'unknown'}|${item.variantSku ?? ''}`
    const cur = map.get(key) ?? {
      productId: String(productId ?? ''),
      variantSku: item.variantSku ?? null,
      name: item.productSnapshot?.name ?? (typeof item.product === 'object' ? item.product?.name : '?'),
      qty: 0, revenue: 0,
    }
    cur.qty += item.quantity ?? 0
    cur.revenue += (item.priceAtOrder ?? 0) * (item.quantity ?? 0)
    map.set(key, cur)
  }
  return Array.from(map.values()).sort((a, b) => b.qty - a.qty).slice(0, 10)
}

async function fetchPendingShipments(): Promise<PendingShipment[]> {
  const res = await safeJson(
    `/api/orders?limit=10&depth=1&sort=createdAt` +
    `&where[status][equals]=processing&where[paymentStatus][equals]=paid`
  )
  return (res?.docs ?? []).map((o: any) => ({
    id: o.id,
    orderNumber: o.orderNumber,
    customer: o.user?.name ?? o.shippingAddress?.recipient ?? '訪客',
    total: o.total,
    createdAt: o.createdAt,
    shippingMethodLabel: o.shippingMethod?.label ?? o.shippingMethod?.code ?? '-',
  }))
}
```

**3. 加到既有 useEffect 並行 fetch 區**（搜「Promise.all」找 hook 起點）：
```ts
const [topSellers, setTopSellers] = useState<TopSeller[]>([])
const [pendingShipments, setPendingShipments] = useState<PendingShipment[]>([])
// 接到既有 Promise.all：
//   [todayStats, monthStats, recentOrders, dailyRevenue, overview, topSellers, pendingShipments]
```

**4. 加 2 個 section 到 JSX**（找既有「本月」三 column grid 區附近）：

```tsx
{/* 本週熱賣 Top 10 */}
<section style={{ marginTop: 24, background: CARD_BG, borderRadius: 8, border: `1px solid ${BORDER}`, padding: 20 }}>
  <h3>本週熱賣 Top 10</h3>
  {topSellers.length === 0 ? (
    <p style={{ color: MUTED }}>本週尚無銷售</p>
  ) : (
    <table style={{ width: '100%' }}>
      <thead>
        <tr><th>商品</th><th>SKU</th><th>數量</th><th>營收</th></tr>
      </thead>
      <tbody>
        {topSellers.map((t, i) => (
          <tr key={`${t.productId}-${t.variantSku}-${i}`}>
            <td>{t.name}</td>
            <td>{t.variantSku ?? '-'}</td>
            <td>{t.qty}</td>
            <td>{formatNTD(t.revenue)}</td>
          </tr>
        ))}
      </tbody>
    </table>
  )}
</section>

{/* 待出貨訂單 */}
<section style={{ marginTop: 24, background: CARD_BG, borderRadius: 8, border: `1px solid ${BORDER}`, padding: 20 }}>
  <h3>待出貨訂單（已付款待處理）</h3>
  {pendingShipments.length === 0 ? (
    <p style={{ color: MUTED }}>無待出貨訂單</p>
  ) : (
    <>
      <table style={{ width: '100%' }}>
        <thead>
          <tr><th>訂單號</th><th>顧客</th><th>金額</th><th>建立時間</th><th>配送</th><th></th></tr>
        </thead>
        <tbody>
          {pendingShipments.map(s => (
            <tr key={s.id}>
              <td>{s.orderNumber}</td>
              <td>{s.customer}</td>
              <td>{formatNTD(s.total)}</td>
              <td>{formatDate(s.createdAt)}</td>
              <td>{s.shippingMethodLabel}</td>
              <td><a href={`/admin/collections/orders/${s.id}`}>處理 →</a></td>
            </tr>
          ))}
        </tbody>
      </table>
      <a href="/admin/collections/orders?where[status][equals]=processing">查看全部 →</a>
    </>
  )}
</section>
```

**5. 沿用既有 brand tokens**（GOLD / CREAM / DARK / MUTED 已宣告，重用即可）

**無新檔、無 schema 變動、無 migration。**

## 測試計畫

### 本地

1. `pnpm tsc --noEmit` 0 err
2. `pnpm dev` →
   - `/admin` 應上方多了「營運駕駛艙」section + 4 卡 + 2 表
   - 4 卡數字非空（試一下沒訂單的全新 db 是否所有 0）
   - 過去 7 天若無訂單，Top sellers 表顯示「本週尚無銷售」空狀態
   - 點 pending shipments 「處理 →」連結 → 進對應 order edit page
3. 試在 dev 建一張新 Order（status=processing, paid）→ refresh dashboard → pending 表應出現
4. lighthouse 看 dashboard render 時間 < 1s（封測規模 < 1000 訂單肯定 OK）

### Prod Smoke Test

- 上 prod 看真數字
- 跟 admin 確認卡片數字是否合理（不是隨機）
- 開最大客戶 admin 帳號試（避免他下次發現「老闆，那個...今天賣多少這頁有 BUG」）

## 已知設計取捨

1. **沿用既有 client component pattern**：Dashboard.tsx 是 'use client' + fetch + useState，不要為了「server component 比較好」改寫；既有 800 行已 wired 不破壞
2. **in-memory aggregate Top sellers**：500 訂單 × 5 items = 2500 iteration 不痛；資料量到萬筆才需要 SQL aggregate endpoint
3. **不接 RecommendationSettings 的 personalized**：那是前台用的；admin dashboard 看絕對指標
4. **不接 RetentionDashboard**：那個是 user-level retention 分析，下層工具；本表是高層 KPI 補強
5. **「待出貨」=`processing` AND `paymentStatus=paid`**：[Orders.ts:246-248](src/collections/Orders.ts:246) status enum；只看 paid 因為 unpaid 還不該出貨

## Merge + Deploy Checklist

- [ ] PR 標題：`feat(admin): operations dashboard with KPIs and pending shipments`
- [ ] tsc/build 綠
- [ ] 本地 `/admin` 渲染正常
- [ ] Squash merge
- [ ] prod deploy
- [ ] prod `/admin` 真看一眼數字合理
- [ ] `docs/session-prompts/25E-post-dashboard.md`
- [ ] 更新 MEMORY「25E Dashboard DONE — commit `<sha>`」

## Context-exhausted handoff 模板

```markdown
## Session N+1 handoff（25E 未完）

已完成：
- [x] loadDashboardStats.ts
- [x] KpiCards + TopSellersTable
- [ ] PendingShipmentsTable（差）
- [ ] payload.config.ts beforeDashboard 掛載（差）
- [ ] 樣式對齊 Payload theme（差）

WIP commit: <sha> on feat/admin-dashboard
下 session 先：跑 dev 看 /admin 有無 render；對齊樣式。
```
