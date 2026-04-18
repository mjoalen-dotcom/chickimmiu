import type { Metadata } from 'next'
import Link from 'next/link'
import { Ruler, Info, MessageCircle } from 'lucide-react'

export const metadata: Metadata = {
  title: '尺寸對照',
  description: 'CHIC KIM & MIU 尺寸對照表 — 上衣／裙褲／鞋類完整尺寸指南，含 TW / JP / US / EU 國際尺寸對照與量測方法。',
  alternates: {
    canonical: `${process.env.NEXT_PUBLIC_SITE_URL || 'https://chickimmiu.com'}/size-guide`,
  },
}

type Row = { size: string; values: (string | number)[] }

type Table = {
  name: string
  intro: string
  headers: string[]
  rows: Row[]
  note?: string
}

const TOPS: Table = {
  name: '上衣／洋裝',
  intro: '韓版剪裁通常偏合身，歐美線條較寬鬆。若喜歡寬鬆版型建議往上選一個尺寸。',
  headers: ['尺寸', '肩寬 (cm)', '胸圍 (cm)', '衣長 (cm)', '袖長 (cm)'],
  rows: [
    { size: 'XS', values: [35, 80, 56, 56] },
    { size: 'S', values: [36, 84, 58, 57] },
    { size: 'M', values: [38, 88, 60, 58] },
    { size: 'L', values: [40, 92, 62, 59] },
    { size: 'XL', values: [42, 96, 64, 60] },
    { size: 'F（均一）', values: ['36-40', '84-94', '58-62', '57-59'] },
  ],
  note: '為平量尺寸（將衣物平放量測），實際因版型或彈性布料可能有 ±1-2cm 誤差。',
}

const BOTTOMS: Table = {
  name: '裙／褲',
  intro: '褲裝以腰圍為主要參考。若介於兩碼之間建議選大碼。',
  headers: ['尺寸', '腰圍 (cm)', '臀圍 (cm)', '大腿圍 (cm)', '褲長 (cm)'],
  rows: [
    { size: 'XS (25)', values: [62, 88, 52, 94] },
    { size: 'S (26)', values: [66, 92, 54, 95] },
    { size: 'M (27)', values: [70, 96, 56, 96] },
    { size: 'L (28)', values: [74, 100, 58, 97] },
    { size: 'XL (29)', values: [78, 104, 60, 98] },
    { size: '2XL (30)', values: [82, 108, 62, 99] },
  ],
  note: '彈性布料（牛仔、羅紋）可能有 ±2-3cm 伸縮範圍；硬挺梭織布料誤差約 ±1cm。',
}

const SHOES: Table = {
  name: '鞋類',
  intro: '本表為腳長實際量測值，建議下午量測（腳部略腫脹）。',
  headers: ['TW', 'JP (cm)', 'EU', 'US (女)', '腳長範圍 (cm)'],
  rows: [
    { size: '35', values: ['22.0', '35', '5', '22.0-22.5'] },
    { size: '36', values: ['22.5', '36', '5.5', '22.5-23.0'] },
    { size: '37', values: ['23.0', '37', '6.5', '23.0-23.5'] },
    { size: '38', values: ['24.0', '38', '7.5', '23.5-24.0'] },
    { size: '39', values: ['24.5', '39', '8', '24.0-24.5'] },
    { size: '40', values: ['25.0', '40', '9', '24.5-25.0'] },
    { size: '41', values: ['25.5', '41', '9.5', '25.0-25.5'] },
  ],
  note: '涼鞋、穆勒鞋建議選大半號；包鞋及靴款可選原碼。',
}

const INTL_TOP: Table = {
  name: '國際尺寸對照 — 上衣／洋裝',
  intro: '一般對照供參考，實際仍依各品牌版型為準。',
  headers: ['TW', 'JP', 'US', 'EU', '胸圍範圍 (cm)'],
  rows: [
    { size: 'XS', values: ['5 / 34', '0 / XS', '32 / XS', '78-82'] },
    { size: 'S', values: ['7 / 36', '2 / S', '34 / S', '82-86'] },
    { size: 'M', values: ['9 / 38', '4 / M', '36 / M', '86-92'] },
    { size: 'L', values: ['11 / 40', '6 / L', '38 / L', '92-96'] },
    { size: 'XL', values: ['13 / 42', '8 / XL', '40 / XL', '96-102'] },
  ],
}

const INTL_BOTTOM: Table = {
  name: '國際尺寸對照 — 裙／褲',
  intro: '若您本身慣穿的褲裝尺碼在此表，可直接選取對應尺寸。',
  headers: ['TW', 'JP', 'US', 'EU', '腰圍範圍 (cm)'],
  rows: [
    { size: 'XS (25)', values: ['5', '0', '24', '60-64'] },
    { size: 'S (26)', values: ['7', '2', '25', '64-68'] },
    { size: 'M (27)', values: ['9', '4', '26-27', '68-72'] },
    { size: 'L (28)', values: ['11', '6', '28-29', '72-76'] },
    { size: 'XL (29)', values: ['13', '8', '30-31', '76-80'] },
  ],
}

const MEASURE_STEPS = [
  {
    title: '胸圍',
    desc: '穿著內衣，將皮尺繞過胸部最高點一圈（與地面平行），不勒緊也不鬆垮。',
  },
  {
    title: '腰圍',
    desc: '自然站立，皮尺繞過腰部最細處（肚臍上方約 2-3cm），深呼氣後測量。',
  },
  {
    title: '臀圍',
    desc: '雙腳併攏自然站立，皮尺繞過臀部最豐滿處一圈（與地面平行）。',
  },
  {
    title: '肩寬',
    desc: '放鬆站立，由左肩骨最外側量至右肩骨最外側（不含手臂）。',
  },
  {
    title: '袖長',
    desc: '手臂自然下垂，由肩骨外側沿手臂外緣量至手腕。',
  },
  {
    title: '腳長',
    desc: '靠牆站立，腳跟貼牆，量至最長腳趾頂端。建議下午量測。',
  },
]

function TableBlock({ table }: { table: Table }) {
  return (
    <section className="bg-white rounded-2xl shadow-sm overflow-hidden">
      <div className="p-6 md:p-8 border-b border-cream-100">
        <h3 className="text-lg font-bold text-[#2C2C2C] mb-1">{table.name}</h3>
        <p className="text-sm text-[#2C2C2C]/70 leading-relaxed">{table.intro}</p>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-[#C19A5B]/10 text-[#2C2C2C]">
            <tr>
              {table.headers.map((h) => (
                <th key={h} className="text-left px-4 py-3 font-medium whitespace-nowrap">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {table.rows.map((row) => (
              <tr key={row.size} className="border-t border-cream-100">
                <td className="px-4 py-3 font-medium text-[#2C2C2C] whitespace-nowrap">{row.size}</td>
                {row.values.map((v, i) => (
                  <td key={i} className="px-4 py-3 text-[#2C2C2C]/80 whitespace-nowrap">
                    {v}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {table.note && (
        <div className="px-6 md:px-8 py-4 bg-[#FDF8F3] border-t border-cream-100 flex items-start gap-2 text-xs text-[#2C2C2C]/60 leading-relaxed">
          <Info size={12} className="shrink-0 mt-0.5" />
          <span>{table.note}</span>
        </div>
      )}
    </section>
  )
}

export default function SizeGuidePage() {
  return (
    <main className="bg-[#FDF8F3] min-h-screen">
      {/* ── Header ── */}
      <section className="bg-gradient-to-b from-[#C19A5B]/10 to-[#FDF8F3] pt-16 pb-10">
        <div className="max-w-4xl mx-auto px-6 text-center">
          <p className="text-[#C19A5B] tracking-[0.3em] text-sm font-medium mb-3">CHIC KIM & MIU</p>
          <h1 className="text-3xl md:text-4xl font-bold text-[#2C2C2C] tracking-wide">尺寸對照</h1>
          <p className="text-[#2C2C2C]/50 text-sm mt-1">Size Guide</p>
          <div className="mt-4 w-16 h-[2px] bg-[#C19A5B] mx-auto" />
          <p className="mt-4 text-[#2C2C2C]/70 text-sm max-w-xl mx-auto leading-relaxed">
            本表為通用尺寸指南，個別商品頁面若標註「尺寸建議」將以該商品實際尺寸為準。
          </p>
        </div>
      </section>

      <div className="max-w-5xl mx-auto px-6 py-12 md:py-16 space-y-10">
        {/* ── Measuring Guide ── */}
        <section className="bg-white rounded-2xl shadow-sm p-6 md:p-10">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 rounded-xl bg-[#C19A5B]/10 flex items-center justify-center">
              <Ruler className="w-5 h-5 text-[#C19A5B]" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-[#2C2C2C]">量測方法</h2>
              <p className="text-sm text-[#2C2C2C]/60">How to measure</p>
            </div>
          </div>
          <div className="grid sm:grid-cols-2 gap-x-8 gap-y-5">
            {MEASURE_STEPS.map((step) => (
              <div key={step.title}>
                <h3 className="text-sm font-bold text-[#2C2C2C] mb-1">{step.title}</h3>
                <p className="text-sm text-[#2C2C2C]/70 leading-relaxed">{step.desc}</p>
              </div>
            ))}
          </div>
        </section>

        {/* ── Size Tables ── */}
        <div className="space-y-6">
          <div className="text-center">
            <p className="text-xs tracking-[0.3em] text-[#C19A5B] mb-2 uppercase">Size Tables</p>
            <h2 className="text-2xl font-bold text-[#2C2C2C]">尺寸表</h2>
            <div className="w-10 h-[2px] bg-[#C19A5B] mx-auto mt-2" />
          </div>
          <TableBlock table={TOPS} />
          <TableBlock table={BOTTOMS} />
          <TableBlock table={SHOES} />
        </div>

        {/* ── International ── */}
        <div className="space-y-6">
          <div className="text-center">
            <p className="text-xs tracking-[0.3em] text-[#C19A5B] mb-2 uppercase">International</p>
            <h2 className="text-2xl font-bold text-[#2C2C2C]">國際尺寸對照</h2>
            <div className="w-10 h-[2px] bg-[#C19A5B] mx-auto mt-2" />
          </div>
          <TableBlock table={INTL_TOP} />
          <TableBlock table={INTL_BOTTOM} />
        </div>

        {/* ── CTA ── */}
        <section className="bg-gradient-to-br from-[#2C2C2C] to-[#1a1a1a] rounded-2xl shadow-sm p-8 md:p-10 text-center">
          <MessageCircle className="w-10 h-10 text-[#C19A5B] mx-auto mb-4" />
          <h2 className="text-xl font-bold text-white mb-2">還是拿不定尺寸？</h2>
          <p className="text-white/70 text-sm max-w-lg mx-auto mb-6 leading-relaxed">
            告訴我們您的身高、體重、平常慣穿尺寸與喜好版型（合身／寬鬆），我們將提供個人化建議。
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
            <Link
              href="/contact?category=size_advice"
              className="inline-flex items-center gap-2 px-6 py-3 bg-[#C19A5B] hover:bg-[#A07A3B] text-white rounded-full text-sm font-medium transition-colors"
            >
              聯繫客服
            </Link>
            <a
              href="https://page.line.me/nqo0262k?openQrModal=true"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 px-6 py-3 bg-white/10 hover:bg-white/20 text-white rounded-full text-sm font-medium transition-colors border border-white/20"
            >
              LINE @ckmu
            </a>
          </div>
        </section>
      </div>
    </main>
  )
}
