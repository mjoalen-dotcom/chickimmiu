'use client'

import { DollarSign, Download, FileText } from 'lucide-react'

const EARNINGS = [
  { month: '2024-12', orders: 8, revenue: 18500, commission: 1850, status: 'pending' },
  { month: '2024-11', orders: 12, revenue: 32000, commission: 3200, status: 'confirmed' },
  { month: '2024-10', orders: 5, revenue: 12800, commission: 1280, status: 'paid' },
  { month: '2024-09', orders: 10, revenue: 25000, commission: 2500, status: 'paid' },
  { month: '2024-08', orders: 8, revenue: 18000, commission: 1800, status: 'paid' },
]

const DETAILED_RECORDS = [
  { date: '2024-12-20', orderNumber: 'CKM-20241220-A1B2', total: 2580, rate: 10, commission: 258, status: 'pending' },
  { date: '2024-12-18', orderNumber: 'CKM-20241218-C3D4', total: 980, rate: 10, commission: 98, status: 'pending' },
  { date: '2024-12-15', orderNumber: 'CKM-20241215-E5F6', total: 3680, rate: 10, commission: 368, status: 'pending' },
  { date: '2024-11-28', orderNumber: 'CKM-20241128-G7H8', total: 4500, rate: 10, commission: 450, status: 'confirmed' },
  { date: '2024-11-20', orderNumber: 'CKM-20241120-I9J0', total: 1200, rate: 10, commission: 120, status: 'confirmed' },
]

export default function EarningsPage() {
  const handleExportCSV = () => {
    console.log('[Partner] Exporting earnings CSV...')
    // In production: generate and download CSV
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-serif">佣金明細</h2>
        <div className="flex gap-2">
          <button
            onClick={handleExportCSV}
            className="flex items-center gap-1.5 px-4 py-2 bg-white border border-cream-200 rounded-xl text-xs hover:bg-cream-50 transition-colors"
          >
            <Download size={14} />
            匯出 CSV
          </button>
          <button className="flex items-center gap-1.5 px-4 py-2 bg-white border border-cream-200 rounded-xl text-xs hover:bg-cream-50 transition-colors">
            <FileText size={14} />
            下載 PDF
          </button>
        </div>
      </div>

      {/* Monthly summary */}
      <div className="bg-white rounded-2xl border border-cream-200 p-6">
        <h3 className="font-medium mb-4">月度摘要</h3>
        <div className="overflow-x-auto -mx-6 px-6">
          <table className="w-full text-sm min-w-[500px]">
            <thead>
              <tr className="border-b border-cream-200 text-xs text-muted-foreground">
                <th className="py-3 text-left font-medium">月份</th>
                <th className="py-3 text-center font-medium">成交筆數</th>
                <th className="py-3 text-right font-medium">推薦業績</th>
                <th className="py-3 text-right font-medium">佣金</th>
                <th className="py-3 text-right font-medium">狀態</th>
              </tr>
            </thead>
            <tbody>
              {EARNINGS.map((row) => (
                <tr key={row.month} className="border-b border-cream-100">
                  <td className="py-3 text-xs">{row.month}</td>
                  <td className="py-3 text-center text-xs">{row.orders} 筆</td>
                  <td className="py-3 text-right text-xs">NT$ {row.revenue.toLocaleString()}</td>
                  <td className="py-3 text-right text-xs font-medium text-gold-600">NT$ {row.commission.toLocaleString()}</td>
                  <td className="py-3 text-right">
                    <span className={`text-[10px] px-2 py-0.5 rounded-full ${
                      row.status === 'paid' ? 'bg-green-50 text-green-600'
                        : row.status === 'confirmed' ? 'bg-blue-50 text-blue-600'
                          : 'bg-amber-50 text-amber-600'
                    }`}>
                      {row.status === 'paid' ? '已發放' : row.status === 'confirmed' ? '已確認' : '待確認'}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Detailed records */}
      <div className="bg-white rounded-2xl border border-cream-200 p-6">
        <h3 className="font-medium mb-4 flex items-center gap-2">
          <DollarSign size={16} className="text-gold-500" />
          逐筆佣金明細
        </h3>
        <div className="overflow-x-auto -mx-6 px-6">
          <table className="w-full text-sm min-w-[600px]">
            <thead>
              <tr className="border-b border-cream-200 text-xs text-muted-foreground">
                <th className="py-3 text-left font-medium">日期</th>
                <th className="py-3 text-left font-medium">訂單編號</th>
                <th className="py-3 text-right font-medium">訂單金額</th>
                <th className="py-3 text-right font-medium">分潤 %</th>
                <th className="py-3 text-right font-medium">佣金</th>
                <th className="py-3 text-right font-medium">狀態</th>
              </tr>
            </thead>
            <tbody>
              {DETAILED_RECORDS.map((r) => (
                <tr key={r.orderNumber} className="border-b border-cream-100">
                  <td className="py-3 text-xs">{r.date}</td>
                  <td className="py-3 text-xs font-mono">{r.orderNumber}</td>
                  <td className="py-3 text-right text-xs">NT$ {r.total.toLocaleString()}</td>
                  <td className="py-3 text-right text-xs">{r.rate}%</td>
                  <td className="py-3 text-right text-xs font-medium text-gold-600">NT$ {r.commission.toLocaleString()}</td>
                  <td className="py-3 text-right">
                    <span className={`text-[10px] px-2 py-0.5 rounded-full ${
                      r.status === 'confirmed' ? 'bg-blue-50 text-blue-600' : 'bg-amber-50 text-amber-600'
                    }`}>
                      {r.status === 'confirmed' ? '已確認' : '待確認'}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
