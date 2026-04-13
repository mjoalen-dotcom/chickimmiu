'use client'

import Link from 'next/link'
import { useParams } from 'next/navigation'
import { CheckCircle, Package, ArrowRight, Home } from 'lucide-react'
import { motion } from 'framer-motion'
import { ThankYouRecommendations } from '@/components/recommendation/ThankYouRecommendations'

export default function CheckoutSuccessPage() {
  const params = useParams()
  const orderId = params.orderId as string

  return (
    <main className="bg-cream-50 min-h-screen flex items-center justify-center px-4 py-16">
      <motion.div
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        className="w-full max-w-lg text-center"
      >
        {/* Success icon */}
        <motion.div
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ delay: 0.2, type: 'spring', stiffness: 200 }}
          className="w-20 h-20 mx-auto mb-6 rounded-full bg-green-50 flex items-center justify-center"
        >
          <CheckCircle size={40} className="text-green-500" />
        </motion.div>

        <h1 className="text-2xl md:text-3xl font-serif mb-3">感謝您的訂購！</h1>
        <p className="text-muted-foreground text-sm mb-2">
          我們已收到您的訂單，將儘快為您處理。
        </p>

        {/* Order info card */}
        <div className="bg-white rounded-2xl border border-cream-200 p-6 mt-8 mb-8 space-y-4 text-left">
          <div className="flex items-center gap-3 pb-4 border-b border-cream-200">
            <Package size={20} className="text-gold-500" />
            <div>
              <p className="text-xs text-muted-foreground">訂單編號</p>
              <p className="text-sm font-medium font-mono">{orderId}</p>
            </div>
          </div>

          <div className="space-y-3 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">訂單狀態</span>
              <span className="text-gold-600">待處理</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">付款狀態</span>
              <span className="text-green-600">已付款</span>
            </div>
          </div>

          <p className="text-xs text-muted-foreground pt-2 border-t border-cream-200">
            訂單確認信已寄至您的信箱，您也可以在「我的帳戶」中查看訂單進度。
          </p>
        </div>

        {/* Actions */}
        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <Link
            href="/account/orders"
            className="inline-flex items-center justify-center gap-2 px-6 py-3 bg-foreground text-cream-50 rounded-full text-sm tracking-wide hover:bg-foreground/90 transition-colors"
          >
            查看訂單
            <ArrowRight size={16} />
          </Link>
          <Link
            href="/"
            className="inline-flex items-center justify-center gap-2 px-6 py-3 border border-foreground/20 text-foreground rounded-full text-sm tracking-wide hover:bg-foreground/5 transition-colors"
          >
            <Home size={16} />
            回首頁
          </Link>
        </div>

        {/* ── AI 智能推薦：感謝頁推薦 + 限時回購 ── */}
        <ThankYouRecommendations />

        {/* Purchase 事件已在 checkout/page.tsx 的 handleSubmit 中觸發 */}
      </motion.div>
    </main>
  )
}
