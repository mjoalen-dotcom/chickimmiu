'use client'

import { Download, FileText } from 'lucide-react'

interface Record_ {
  date: string
  orderNumber: string
  total: number
  rate: number
  commission: number
  status: string
  statusLabel: string
}

export function EarningsClient({ records }: { records: Record_[] }) {
  const handleExportCSV = () => {
    const header = ['日期', '訂單編號', '訂單金額', '佣金比例', '佣金金額', '狀態']
    const rows = records.map((r) => [
      r.date,
      r.orderNumber,
      String(r.total),
      `${r.rate}%`,
      String(r.commission),
      r.statusLabel,
    ])
    const csv = [header, ...rows]
      .map((row) => row.map((cell) => `"${cell.replace(/"/g, '""')}"`).join(','))
      .join('\r\n')
    // BOM 開頭讓 Excel 開啟時中文不亂碼
    const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `佣金明細-${new Date().toISOString().slice(0, 10)}.csv`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }

  return (
    <div className="bg-white rounded-2xl border border-cream-200 p-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-medium">推薦訂單明細</h3>
        <button
          onClick={handleExportCSV}
          disabled={records.length === 0}
          className="flex items-center gap-1.5 px-4 py-2 bg-white border border-cream-200 rounded-xl text-xs hover:bg-cream-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
        >
          <Download size={14} />
          匯出 CSV
        </button>
      </div>
      {records.length === 0 ? (
        <div className="py-10 text-center text-sm text-muted-foreground flex flex-col items-center gap-2">
          <FileText size={24} className="text-cream-300" />
          尚無推薦訂單
        </div>
      ) : (
        <div className="overflow-x-auto -mx-6 px-6">
          <table className="w-full text-sm min-w-[600px]">
            <thead>
              <tr className="border-b border-cream-200 text-xs text-muted-foreground">
                <th className="py-3 text-left font-medium">日期</th>
                <th className="py-3 text-left font-medium">訂單編號</th>
                <th className="py-3 text-right font-medium">訂單金額</th>
                <th className="py-3 text-right font-medium">比例</th>
                <th className="py-3 text-right font-medium">佣金</th>
                <th className="py-3 text-right font-medium">狀態</th>
              </tr>
            </thead>
            <tbody>
              {records.map((r) => (
                <tr key={r.orderNumber} className="border-b border-cream-100">
                  <td className="py-3 text-xs">{r.date}</td>
                  <td className="py-3 font-mono text-xs">{r.orderNumber}</td>
                  <td className="py-3 text-right text-xs">NT$ {r.total.toLocaleString()}</td>
                  <td className="py-3 text-right text-xs">{r.rate}%</td>
                  <td className="py-3 text-right text-xs text-green-600">NT$ {r.commission.toLocaleString()}</td>
                  <td className="py-3 text-right">
                    <span
                      className={`text-[10px] px-2 py-0.5 rounded-full ${
                        r.status === 'paid'
                          ? 'bg-green-50 text-green-600'
                          : r.status === 'confirmed'
                            ? 'bg-blue-50 text-blue-600'
                            : r.status === 'cancelled'
                              ? 'bg-red-50 text-red-500'
                              : 'bg-amber-50 text-amber-600'
                      }`}
                    >
                      {r.statusLabel}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
