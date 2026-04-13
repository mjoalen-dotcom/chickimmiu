'use client'

import { signIn } from 'next-auth/react'
import Link from 'next/link'

export default function RegisterPage() {
  return (
    <main className="min-h-screen flex items-center justify-center px-4 py-16 bg-cream-50">
      <div className="w-full max-w-md space-y-8 bg-white rounded-2xl p-8 border border-cream-200 shadow-sm animate-fade-in">
        <div className="text-center">
          <h1 className="text-2xl font-serif mb-2">加入我們</h1>
          <p className="text-sm text-muted-foreground">
            註冊成為 CHIC KIM &amp; MIU 會員，享受專屬優惠
          </p>
        </div>

        <div className="space-y-3">
          <button
            onClick={() => signIn('google', { callbackUrl: '/' })}
            className="w-full flex items-center justify-center gap-3 px-4 py-3 border border-cream-200 rounded-xl text-sm hover:bg-cream-50 transition-colors"
          >
            <svg className="w-5 h-5" viewBox="0 0 24 24">
              <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" />
              <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
              <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
              <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
            </svg>
            使用 Google 註冊
          </button>
          <button
            onClick={() => signIn('facebook', { callbackUrl: '/' })}
            className="w-full flex items-center justify-center gap-3 px-4 py-3 border border-cream-200 rounded-xl text-sm hover:bg-cream-50 transition-colors"
          >
            <svg className="w-5 h-5" fill="#1877F2" viewBox="0 0 24 24">
              <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" />
            </svg>
            使用 Facebook 註冊
          </button>
          <button
            onClick={() => signIn('line', { callbackUrl: '/' })}
            className="w-full flex items-center justify-center gap-3 px-4 py-3 border border-cream-200 rounded-xl text-sm hover:bg-cream-50 transition-colors"
          >
            <svg className="w-5 h-5" fill="#06C755" viewBox="0 0 24 24">
              <path d="M24 10.314C24 4.943 18.615.572 12 .572S0 4.943 0 10.314c0 4.811 4.27 8.842 10.035 9.608.391.082.923.258 1.058.59.12.301.079.766.038 1.08l-.164 1.02c-.045.301-.24 1.186 1.049.645 1.291-.539 6.916-4.078 9.436-6.975C23.176 14.393 24 12.458 24 10.314" />
            </svg>
            使用 LINE 註冊
          </button>

          {/* Apple */}
          <button
            onClick={() => signIn('apple', { callbackUrl: '/' })}
            className="w-full flex items-center justify-center gap-3 px-4 py-3 border border-cream-200 rounded-xl text-sm hover:bg-cream-50 transition-colors"
          >
            <svg className="w-5 h-5" fill="#000000" viewBox="0 0 24 24">
              <path d="M17.05 20.28c-.98.95-2.05.88-3.08.4-1.09-.5-2.08-.48-3.24 0-1.44.62-2.2.44-3.06-.4C2.79 15.25 3.51 7.59 9.05 7.31c1.35.07 2.29.74 3.08.8 1.18-.24 2.31-.93 3.57-.84 1.51.12 2.65.72 3.4 1.8-3.12 1.87-2.38 5.98.48 7.13-.57 1.5-1.31 2.99-2.54 4.09zM12.03 7.25c-.15-2.23 1.66-4.07 3.74-4.25.29 2.58-2.34 4.5-3.74 4.25z" />
            </svg>
            使用 Apple 註冊
          </button>
        </div>

        <div className="relative">
          <div className="absolute inset-0 flex items-center">
            <div className="w-full border-t border-cream-200" />
          </div>
          <div className="relative flex justify-center text-xs">
            <span className="bg-white px-4 text-muted-foreground">或以 Email 註冊</span>
          </div>
        </div>

        <div className="space-y-4">
          <input
            type="text"
            placeholder="姓名"
            className="w-full px-4 py-3 rounded-xl border border-cream-200 text-sm focus:outline-none focus:ring-2 focus:ring-gold-400/40"
          />
          <input
            type="email"
            placeholder="Email"
            className="w-full px-4 py-3 rounded-xl border border-cream-200 text-sm focus:outline-none focus:ring-2 focus:ring-gold-400/40"
          />
          <input
            type="password"
            placeholder="密碼（至少 8 個字元）"
            className="w-full px-4 py-3 rounded-xl border border-cream-200 text-sm focus:outline-none focus:ring-2 focus:ring-gold-400/40"
          />
          <input
            type="text"
            placeholder="推薦碼（選填）"
            className="w-full px-4 py-3 rounded-xl border border-cream-200 text-sm focus:outline-none focus:ring-2 focus:ring-gold-400/40"
          />
          <button
            type="button"
            className="w-full py-3 bg-foreground text-cream-50 rounded-xl text-sm tracking-wide hover:bg-foreground/90 transition-colors"
          >
            註冊
          </button>
        </div>

        <p className="text-center text-xs text-muted-foreground leading-relaxed">
          註冊即表示您同意我們的{' '}
          <Link href="/terms" className="text-gold-600 hover:underline">服務條款</Link>
          {' '}與{' '}
          <Link href="/privacy" className="text-gold-600 hover:underline">隱私權政策</Link>
        </p>

        <div className="text-center pt-2 border-t border-cream-200">
          <p className="text-sm text-muted-foreground pt-4">
            已有帳號？
            <Link href="/login" className="text-gold-600 ml-1 hover:underline">
              立即登入
            </Link>
          </p>
        </div>
      </div>
    </main>
  )
}
