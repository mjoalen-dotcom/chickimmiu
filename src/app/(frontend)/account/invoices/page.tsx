'use client'

import { useState } from 'react'
import Link from 'next/link'
import { FileText, Download, ChevronDown, ChevronUp, Receipt, Building2 } from 'lucide-react'

// Demo data — in production, fetch from Payload API
const DEMO_INVOICES = [
  {
    id: 'inv-001',
    invoiceNumber: 'AB-12345678',
    date: '2026-04-01',
    orderNumber: 'CKM-20260401-A1B2',
    invoiceType: 'b2c_personal' as const,
    status: 'issued' as const,
    totalAmount: 2580,
    buyerName: '王小明',
    carrierType: null,
    loveCode: null,
    items: [
      { name: '優雅蝴蝶結針織上衣', variant: '米白 / M', quantity: 1, price: 1280 },
      { name: '韓系高腰A字裙', variant: '黑色 / S', quantity: 1, price: 1300 },
    ],
  },
  {
    id: 'inv-002',
    invoiceNumber: 'CD-87654321',
    date: '2026-04-03',
    orderNumber: 'CKM-20260403-C3D4',
    invoiceType: 'b2c_carrier' as const,
    status: 'issued' as const,
    totalAmount: 980,
    buyerName: '王小明',
    carrierType: '手機條碼 /ABC+123',
    loveCode: null,
    items: [
      { name: '柔軟羊毛混紡圍巾', variant: '駝色', quantity: 1, price: 980 },
    ],
  },
  {
    id: 'inv-003',
    invoiceNumber: 'EF-11223344',
    date: '2026-04-05',
    orderNumber: 'CKM-20260405-E5F6',
    invoiceType: 'b2b' as const,
    status: 'pending' as const,
    totalAmount: 15800,
    buyerName: '美麗時尚有限公司',
    carrierType: null,
    loveCode: null,
    items: [
      { name: '法式小香風外套', variant: '粉色 / L', quantity: 5, price: 1680 },
      { name: 'Quincy 氣質裹身微開衩洋裝', variant: '白色 / M', quantity: 5, price: 1480 },
    ],
  },
  {
    id: 'inv-004',
    invoiceNumber: 'GH-55667788',
    date: '2026-03-20',
    orderNumber: 'CKM-20260320-G7H8',
    invoiceType: 'donation' as const,
    status: 'issued' as const,
    totalAmount: 1680,
    buyerName: '王小明',
    carrierType: null,
    loveCode: '7568',
    items: [
      { name: 'Serene 名媛蕾絲層次洋裝', variant: '黑色 / M', quantity: 1, price: 1680 },
    ],
  },
  {
    id: 'inv-005',
    invoiceNumber: 'IJ-99001122',
    date: '2026-03-15',
    orderNumber: 'CKM-20260315-I9J0',
    invoiceType: 'b2c_personal' as const,
    status: 'void' as const,
    totalAmount: 780,
    buyerName: '王小明',
    carrierType: null,
    loveCode: null,
    items: [
      { name: 'Y2K個性橢圓墨鏡', variant: '黑框', quantity: 1, price: 780 },
    ],
  },
]

const INVOICE_TYPE_MAP: Record<string, { label: string; icon: typeof FileText }> = {
  b2c_personal: { label: '個人二聯式', icon: FileText },
  b2c_carrier: { label: '載具歸戶', icon: Receipt },
  b2b: { label: '公司三聯式', icon: Building2 },
  donation: { label: '捐贈發票', icon: Receipt },
}

const STATUS_MAP: Record<string, { label: string; color: string; bg: string }> = {
  pending: { label: '待開立', color: 'text-yellow-600', bg: 'bg-yellow-50' },
  issued: { label: '已開立', color: 'text-green-600', bg: 'bg-green-50' },
  void: { label: '已作廢', color: 'text-red-600', bg: 'bg-red-50' },
  allowance: { label: '已折讓', color: 'text-blue-600', bg: 'bg-blue-50' },
  failed: { label: '開立失敗', color: 'text-red-600', bg: 'bg-red-50' },
}

export default function InvoicesPage() {
  const [expandedId, setExpandedId] = useState<string | null>(null)

  const statusCounts = DEMO_INVOICES.reduce<Record<string, number>>((acc, inv) => {
    acc[inv.status] = (acc[inv.status] || 0) + 1
    return acc
  }, {})

  return (
    <main className="space-y-8 animate-fade-in">
      {/* Header */}
      <div>
        <p className="text-xs tracking-[0.3em] text-gold-500 mb-2">INVOICES</p>
        <h1 className="text-2xl font-serif">我的電子發票</h1>
      </div>

      {/* Summary Card */}
      <div className="bg-white rounded-2xl border border-cream-200 p-5">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-full bg-cream-100 flex items-center justify-center text-gold-500">
            <Receipt size={18} />
          </div>
          <div>
            <p className="text-sm font-medium">發票總覽</p>
            <p className="text-xs text-muted-foreground">共 {DEMO_INVOICES.length} 張發票</p>
          </div>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {Object.entries(STATUS_MAP).map(([key, st]) => {
            const count = statusCounts[key] || 0
            if (count === 0) return null
            return (
              <div key={key} className={`rounded-xl px-4 py-3 ${st.bg}`}>
                <p className={`text-lg font-semibold ${st.color}`}>{count}</p>
                <p className="text-xs text-muted-foreground">{st.label}</p>
              </div>
            )
          })}
        </div>
      </div>

      {/* Invoice List */}
      <div className="space-y-4">
        {DEMO_INVOICES.map((invoice) => {
          const status = STATUS_MAP[invoice.status] || STATUS_MAP.pending
          const typeInfo = INVOICE_TYPE_MAP[invoice.invoiceType] || INVOICE_TYPE_MAP.b2c_personal
          const TypeIcon = typeInfo.icon
          const isExpanded = expandedId === invoice.id

          return (
            <div
              key={invoice.id}
              className="bg-white rounded-2xl border border-cream-200 overflow-hidden"
            >
              {/* Header Row */}
              <div className="flex items-center justify-between p-5">
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 rounded-full bg-cream-100 flex items-center justify-center text-gold-500">
                    <TypeIcon size={18} />
                  </div>
                  <div>
                    <p className="text-sm font-medium font-mono">{invoice.invoiceNumber}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {invoice.date}・{invoice.orderNumber}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <div className="text-right">
                    <p className="text-sm font-medium">NT$ {invoice.totalAmount.toLocaleString()}</p>
                    <div className="flex items-center gap-2 justify-end mt-0.5">
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${status.color} ${status.bg}`}>
                        {status.label}
                      </span>
                      <span className="text-xs text-muted-foreground">{typeInfo.label}</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex items-center gap-2 px-5 pb-4">
                <button
                  onClick={() => setExpandedId(isExpanded ? null : invoice.id)}
                  className="flex items-center gap-1.5 text-xs text-gold-600 hover:text-gold-700 transition-colors"
                >
                  {isExpanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                  {isExpanded ? '收合' : '展開明細'}
                </button>
                {invoice.status === 'issued' && (
                  <Link
                    href={`/api/invoices/${invoice.id}/pdf`}
                    className="flex items-center gap-1.5 text-xs text-gold-600 hover:text-gold-700 transition-colors ml-4"
                  >
                    <Download size={14} />
                    下載 PDF
                  </Link>
                )}
              </div>

              {/* Expanded Details */}
              {isExpanded && (
                <div className="px-5 pb-5 border-t border-cream-200">
                  <div className="pt-4 grid grid-cols-2 gap-3 text-sm mb-4">
                    <div>
                      <p className="text-xs text-muted-foreground">買受人</p>
                      <p className="font-medium">{invoice.buyerName}</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">發票類型</p>
                      <p className="font-medium">{typeInfo.label}</p>
                    </div>
                    {invoice.carrierType && (
                      <div>
                        <p className="text-xs text-muted-foreground">載具類型</p>
                        <p className="font-medium">{invoice.carrierType}</p>
                      </div>
                    )}
                    {invoice.loveCode && (
                      <div>
                        <p className="text-xs text-muted-foreground">愛心碼</p>
                        <p className="font-medium">{invoice.loveCode}</p>
                      </div>
                    )}
                  </div>
                  <div className="border-t border-cream-100 pt-3 space-y-2">
                    <p className="text-xs text-muted-foreground mb-2">商品明細</p>
                    {invoice.items.map((item, i) => (
                      <div key={i} className="flex items-center justify-between text-sm">
                        <div>
                          <p className="font-medium">{item.name}</p>
                          <p className="text-xs text-muted-foreground">
                            {item.variant} x {item.quantity}
                          </p>
                        </div>
                        <p>NT$ {(item.price * item.quantity).toLocaleString()}</p>
                      </div>
                    ))}
                    <div className="flex items-center justify-between pt-3 border-t border-cream-100 text-sm">
                      <span className="text-muted-foreground">合計</span>
                      <span className="font-medium text-gold-600">
                        NT$ {invoice.totalAmount.toLocaleString()}
                      </span>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )
        })}
      </div>

      {/* Note */}
      <div className="bg-cream-50 rounded-2xl border border-cream-200 p-5 text-sm text-muted-foreground space-y-2">
        <p className="font-medium text-foreground">電子發票說明</p>
        <ul className="space-y-1 list-disc list-inside">
          <li>電子發票將於付款完成後自動開立</li>
          <li>如需統一編號，請於結帳時填寫公司資訊</li>
          <li>載具歸戶發票將自動存入您的載具中</li>
          <li>捐贈發票將以愛心碼捐贈予指定單位</li>
          <li>如需作廢或折讓，請聯繫客服處理</li>
        </ul>
      </div>
    </main>
  )
}
