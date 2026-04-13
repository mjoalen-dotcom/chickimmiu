import Link from 'next/link'
import { Home, Search } from 'lucide-react'

export default function NotFound() {
  return (
    <main className="bg-cream-50 min-h-screen flex items-center justify-center px-4">
      <div className="max-w-md text-center">
        <p className="text-6xl font-serif text-gold-500 mb-4">404</p>
        <h1 className="text-2xl font-serif mb-3">找不到此頁面</h1>
        <p className="text-sm text-muted-foreground mb-8 leading-relaxed">
          您所尋找的頁面可能已被移除、名稱已更改，或暫時無法使用。
        </p>
        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <Link
            href="/"
            className="inline-flex items-center justify-center gap-2 px-6 py-3 bg-foreground text-cream-50 rounded-full text-sm tracking-wide hover:bg-foreground/90 transition-colors"
          >
            <Home size={14} />
            回首頁
          </Link>
          <Link
            href="/products"
            className="inline-flex items-center justify-center gap-2 px-6 py-3 border border-foreground/20 text-foreground rounded-full text-sm tracking-wide hover:bg-foreground/5 transition-colors"
          >
            <Search size={14} />
            探索商品
          </Link>
        </div>
      </div>
    </main>
  )
}
