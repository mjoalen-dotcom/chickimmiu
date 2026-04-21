import type { Metadata } from 'next'
import { getPayload } from 'payload'
import config from '@payload-config'

export const metadata: Metadata = {
  title: '尺寸對照表 — CHIC KIM & MIU',
  description: '查看各品項的尺寸對照表，協助您找到最合適的尺寸。購買前可比對身形數據，或依照商品頁下方的尺寸建議選擇。',
}

type MeasureDef = { key: string; label: string }
type RowValue = { key: string; value: string }
type SizeRow = { size: string; values: RowValue[] }
type SizeChart = {
  id: string | number
  name: string
  slug?: string
  category?: string
  unit?: string
  measurements?: MeasureDef[]
  rows?: SizeRow[]
}

const CATEGORY_LABELS: Record<string, string> = {
  top: '上衣 Top',
  bottom: '下身 Bottom',
  dress: '洋裝 Dress',
  outerwear: '外套 Outerwear',
  jumpsuit: '連身褲 Jumpsuit',
  swimwear: '泳裝 Swimwear',
  innerwear: '內搭 Innerwear',
  accessory: '配件 Accessory',
  other: '其他 Other',
}

const CATEGORY_ORDER = [
  'top',
  'bottom',
  'dress',
  'outerwear',
  'jumpsuit',
  'swimwear',
  'innerwear',
  'accessory',
  'other',
]

async function getCharts(): Promise<SizeChart[]> {
  try {
    const payload = await getPayload({ config })
    const res = await payload.find({
      collection: 'size-charts',
      limit: 100,
      depth: 0,
      sort: 'name',
    })
    return (res.docs as unknown as SizeChart[]) ?? []
  } catch {
    return []
  }
}

function groupByCategory(charts: SizeChart[]): Record<string, SizeChart[]> {
  const grouped: Record<string, SizeChart[]> = {}
  for (const c of charts) {
    const cat = c.category || 'other'
    ;(grouped[cat] ??= []).push(c)
  }
  return grouped
}

function ChartTable({ chart }: { chart: SizeChart }) {
  const measurements = chart.measurements ?? []
  const rows = chart.rows ?? []
  const unit = chart.unit === 'inch' ? '英吋' : '公分'

  return (
    <div className="bg-white rounded-xl shadow-sm border border-cream-100 overflow-hidden">
      <div className="px-5 py-4 border-b border-cream-100">
        <div className="flex items-baseline justify-between gap-3 flex-wrap">
          <h3 className="text-base font-medium text-foreground">{chart.name}</h3>
          <span className="text-xs text-foreground/50">單位：{unit}</span>
        </div>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-cream-50 text-foreground/60">
              <th className="py-2.5 px-3 text-left text-xs tracking-wide">尺寸</th>
              {measurements.map((m) => (
                <th key={m.key} className="py-2.5 px-3 text-left text-xs tracking-wide">
                  {m.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, idx) => {
              const byKey = new Map(row.values?.map((v) => [v.key, v.value]))
              return (
                <tr key={`${row.size}-${idx}`} className="border-t border-cream-50">
                  <td className="py-2.5 px-3 text-foreground font-medium">{row.size}</td>
                  {measurements.map((m) => (
                    <td key={m.key} className="py-2.5 px-3 text-foreground/80">
                      {byKey.get(m.key) ?? '—'}
                    </td>
                  ))}
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}

export default async function SizeGuidePage() {
  const charts = await getCharts()
  const grouped = groupByCategory(charts)

  return (
    <main className="bg-cream-50 min-h-screen">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 py-16 sm:py-20">
        <div className="text-center mb-12">
          <p className="text-xs tracking-[0.3em] text-gold-600 mb-3">SIZE GUIDE</p>
          <h1 className="text-3xl sm:text-4xl font-light text-foreground">尺寸對照表</h1>
          <p className="mt-4 text-sm text-foreground/60 max-w-xl mx-auto leading-relaxed">
            選購前請參考下列尺寸表，並以實際身形量測數據比對。<br />
            若您仍不確定適合的尺寸，歡迎透過
            <a href="/contact" className="underline underline-offset-2 hover:text-gold-600 mx-1">
              客服表單
            </a>
            或 LINE 官方帳號詢問。
          </p>
        </div>

        {charts.length === 0 ? (
          <div className="bg-white rounded-xl p-12 shadow-sm border border-cream-100 text-center">
            <p className="text-sm text-foreground/60">尺寸表建置中，請稍後再回來查看。</p>
          </div>
        ) : (
          <div className="space-y-10">
            {CATEGORY_ORDER.filter((cat) => grouped[cat]?.length).map((cat) => (
              <section key={cat}>
                <h2 className="text-sm tracking-[0.2em] text-foreground/50 mb-4">
                  {CATEGORY_LABELS[cat] ?? cat}
                </h2>
                <div className="grid gap-4">
                  {grouped[cat].map((chart) => (
                    <ChartTable key={chart.id} chart={chart} />
                  ))}
                </div>
              </section>
            ))}
          </div>
        )}

        <div className="mt-16 bg-white rounded-xl p-6 shadow-sm border border-cream-100">
          <h2 className="text-sm font-medium text-foreground mb-3">量測小提醒</h2>
          <ul className="space-y-2 text-xs text-foreground/70 leading-relaxed list-disc pl-4">
            <li>穿著貼身衣物，放鬆站直，量尺保持水平，不要勒緊也不要鬆垮。</li>
            <li>胸圍 / 腰圍 / 臀圍請量最寬部位；衣長 / 裙長從肩或腰量到最下緣。</li>
            <li>平量為單邊數值（如肩寬）；圍度為整圈周長。尺寸表預設為平量。</li>
            <li>同樣 size 標示，不同版型落差可能達 2-3 公分；以實際數值為準。</li>
          </ul>
        </div>
      </div>
    </main>
  )
}
