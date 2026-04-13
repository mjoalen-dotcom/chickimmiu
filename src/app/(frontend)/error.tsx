'use client'

import Link from 'next/link'
import { AlertTriangle, Home, RefreshCw } from 'lucide-react'

export default function Error({
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  return (
    <main className="bg-cream-50 min-h-screen flex items-center justify-center px-4">
      <div className="max-w-md text-center">
        <div className="w-16 h-16 mx-auto mb-6 rounded-full bg-red-50 flex items-center justify-center">
          <AlertTriangle size={28} className="text-red-400" />
        </div>
        <h1 className="text-2xl font-serif mb-3">發生了一些問題</h1>
        <p className="text-sm text-muted-foreground mb-8 leading-relaxed">
          很抱歉，頁面載入時發生錯誤。請重新整理頁面或返回首頁。
        </p>
        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <button
            onClick={reset}
            className="inline-flex items-center justify-center gap-2 px-6 py-3 bg-foreground text-cream-50 rounded-full text-sm tracking-wide hover:bg-foreground/90 transition-colors"
          >
            <RefreshCw size={14} />
            重新整理
          </button>
          <Link
            href="/"
            className="inline-flex items-center justify-center gap-2 px-6 py-3 border border-foreground/20 text-foreground rounded-full text-sm tracking-wide hover:bg-foreground/5 transition-colors"
          >
            <Home size={14} />
            回首頁
          </Link>
        </div>
      </div>
    </main>
  )
}
