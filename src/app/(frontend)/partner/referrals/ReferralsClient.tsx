'use client'

import { useState, useEffect } from 'react'
import { Link2, Copy, Check, ShoppingBag } from 'lucide-react'

interface ReferralOrder {
  orderNumber: string
  date: string
  customer: string
  total: number
  status: string
}

export function ReferralsClient({
  referralCode,
  referralOrders,
}: {
  referralCode: string
  referralOrders: ReferralOrder[]
}) {
  const [copied, setCopied] = useState<string | null>(null)
  const [baseUrl, setBaseUrl] = useState('')

  useEffect(() => {
    setBaseUrl(window.location.origin)
  }, [])

  const links = [
    { label: '首頁連結', url: `${baseUrl}/?ref=${referralCode}` },
    { label: '全部商品', url: `${baseUrl}/products?ref=${referralCode}` },
    { label: '新品頁面', url: `${baseUrl}/products?tag=new&ref=${referralCode}` },
    { label: '限時優惠', url: `${baseUrl}/products?tag=sale&ref=${referralCode}` },
  ]

  const copyToClipboard = (text: string, key: string) => {
    navigator.clipboard.writeText(text)
    setCopied(key)
    setTimeout(() => setCopied(null), 2000)
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <h2 className="text-xl font-serif">推廣連結</h2>

      <div className="bg-gradient-to-r from-gold-500/10 to-cream-100 rounded-2xl border border-gold-500/20 p-6">
        <p className="text-xs text-muted-foreground mb-2">您的專屬推薦碼</p>
        <div className="flex items-center gap-3">
          <span className="text-xl font-mono font-medium text-gold-600">{referralCode}</span>
          <button
            onClick={() => copyToClipboard(referralCode, 'code')}
            className="p-2 rounded-lg bg-white/80 hover:bg-white transition-colors"
          >
            {copied === 'code' ? <Check size={14} className="text-green-500" /> : <Copy size={14} />}
          </button>
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-cream-200 p-6">
        <h3 className="font-medium mb-4 flex items-center gap-2">
          <Link2 size={16} className="text-gold-500" />
          推廣連結
        </h3>
        <div className="space-y-3">
          {links.map((link) => (
            <div key={link.label} className="flex items-center gap-3 p-3 bg-cream-50 rounded-xl">
              <div className="flex-1 min-w-0">
                <p className="text-xs font-medium mb-1">{link.label}</p>
                <p className="text-[10px] text-muted-foreground truncate font-mono">{link.url}</p>
              </div>
              <button
                onClick={() => copyToClipboard(link.url, link.label)}
                className="shrink-0 px-3 py-1.5 bg-white border border-cream-200 rounded-lg text-xs hover:bg-cream-50 transition-colors flex items-center gap-1"
              >
                {copied === link.label ? (
                  <><Check size={12} className="text-green-500" /> 已複製</>
                ) : (
                  <><Copy size={12} /> 複製</>
                )}
              </button>
            </div>
          ))}
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-cream-200 p-6">
        <h3 className="font-medium mb-4 flex items-center gap-2">
          <ShoppingBag size={16} className="text-gold-500" />
          我的推薦訂單
        </h3>
        {referralOrders.length === 0 ? (
          <p className="text-sm text-muted-foreground py-6 text-center">尚無推薦訂單</p>
        ) : (
          <div className="overflow-x-auto -mx-6 px-6">
            <table className="w-full text-sm min-w-[500px]">
              <thead>
                <tr className="border-b border-cream-200 text-xs text-muted-foreground">
                  <th className="py-3 text-left font-medium">訂單編號</th>
                  <th className="py-3 text-left font-medium">日期</th>
                  <th className="py-3 text-left font-medium">顧客</th>
                  <th className="py-3 text-right font-medium">金額</th>
                  <th className="py-3 text-right font-medium">狀態</th>
                </tr>
              </thead>
              <tbody>
                {referralOrders.map((order) => (
                  <tr key={order.orderNumber} className="border-b border-cream-100">
                    <td className="py-3 font-mono text-xs">{order.orderNumber}</td>
                    <td className="py-3 text-xs">{order.date}</td>
                    <td className="py-3 text-xs">{order.customer}</td>
                    <td className="py-3 text-right text-xs">NT$ {order.total.toLocaleString()}</td>
                    <td className="py-3 text-right">
                      <span
                        className={`text-[10px] px-2 py-0.5 rounded-full ${
                          order.status === 'confirmed'
                            ? 'bg-green-50 text-green-600'
                            : 'bg-amber-50 text-amber-600'
                        }`}
                      >
                        {order.status === 'confirmed' ? '已確認' : '待確認'}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
