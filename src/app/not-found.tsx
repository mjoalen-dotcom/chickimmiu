import Link from 'next/link'
import { Home, Search } from 'lucide-react'
import './(frontend)/globals.css'

/**
 * 根層級 not-found.tsx。
 *
 * Next.js App Router 用了 (frontend) / (payload) 兩個 route group，各自在
 * layout.tsx 內自帶 <html><body>（"multiple root layouts" 官方模式）。這種
 * 架構下，(frontend)/not-found.tsx 只有在該 group 內已匹配的路由主動呼叫
 * notFound() 時才會生效（例如商品頁查無此 slug）；對完全不存在、任何
 * route 都匹配不到的網址（打錯字、舊書籤、外部壞連結），Next.js 找不到
 * 該用哪個 group 的 not-found，只能退回內建的純白 "404: This page could
 * not be found." 頁面 —— 這裡才是真正兜底的地方，缺了會讓多數真實 404
 * 情境都看不到品牌化頁面。因為沒有共用的父層 layout，這裡要自己補
 * <html><body>。
 */
export default function RootNotFound() {
  return (
    <html lang="zh-Hant-TW">
      <body className="font-sans antialiased">
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
      </body>
    </html>
  )
}
