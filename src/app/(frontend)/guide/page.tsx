import type { Metadata } from 'next'
import Link from 'next/link'
import {
  ArrowRight, CalendarCheck, BookOpen, Gamepad2, ShoppingBag, Gift, Users,
  Crown, Coins, Sparkles, MessageCircle,
} from 'lucide-react'

export const metadata: Metadata = {
  title: '新手教學｜CHIC KIM & MIU',
  description: '第一次來？三分鐘搞懂網站怎麼玩：怎麼賺點數、會員等級福利、遊戲與測驗規則。',
}

/**
 * /guide 新手教學導覽（2026-08-22 需求 ①）
 * ────────────────────────────────────────
 * 靜態說明頁：網站怎麼玩 / 點數怎麼賺怎麼用 / 會員等級 / 遊戲規則重點。
 * 刻意不寫死會變動的數字（各遊戲消耗點數、簽到點數、每日上限都是
 * 後台 game-settings 可調），一律導去對應頁面看即時數字。
 * 購物流程細節已有 /shopping-guide、常見問題已有 /faq — 這頁只做
 * 「新手第一次來的地圖」，不重複。
 */

const EARN_WAYS = [
  { icon: CalendarCheck, label: '每日簽到', desc: '每天報到就送點數，連續 7 天有加碼', href: '/games/daily-checkin', cta: '去簽到' },
  { icon: Gamepad2, label: '玩遊戲', desc: '轉盤、刮刮樂、穿搭挑戰……每天都有免費次數', href: '/games', cta: '進遊戲大廳' },
  { icon: BookOpen, label: '看穿搭誌', desc: '閱讀文章也能賺點數，邊學穿搭邊累積', href: '/blog', cta: '看文章' },
  { icon: ShoppingBag, label: '購物回饋', desc: '消費依會員等級回饋點數，等級越高回饋越多', href: '/products', cta: '去逛逛' },
  { icon: Users, label: '推薦好友', desc: '好友透過你的連結註冊下單，兩人都拿獎勵', href: '/account/referrals', cta: '拿推薦連結' },
  { icon: Crown, label: '訂閱方案', desc: '訂閱會員每月固定送購物金與專屬禮遇', href: '/account/subscription', cta: '看方案' },
]

const STEPS = [
  { num: '01', title: '逛賣場', desc: '首頁封面點任何一張圖就會進到賣場，新品、熱銷、分類都在這裡。', href: '/home', cta: '進入賣場' },
  { num: '02', title: '加入會員', desc: '免費註冊就送見面禮，點數、購物金、遊戲全部解鎖。', href: '/register', cta: '免費註冊' },
  { num: '03', title: '賺點數', desc: '簽到、看文章、玩遊戲天天累積，點數可以折抵與兌換好禮。', href: '/games', cta: '開始賺點' },
  { num: '04', title: '下單購物', desc: '點數購物金直接折抵，超商取貨、宅配、多元付款都支援。', href: '/shopping-guide', cta: '購物說明' },
]

export default function GuidePage() {
  return (
    <main className="bg-white">
      {/* ── Header ── */}
      <section className="border-b border-cream-200">
        <div className="container py-16 md:py-24 text-center">
          <p className="text-[11px] tracking-[0.35em] text-neutral-400 mb-4 uppercase">Getting Started</p>
          <h1 className="text-3xl md:text-4xl font-serif mb-4">新手教學</h1>
          <p className="text-sm text-neutral-500 max-w-md mx-auto leading-6">
            第一次來？三分鐘搞懂這裡怎麼玩 —— 怎麼賺點數、會員有什麼福利、
            遊戲測驗怎麼不踩雷。
          </p>
        </div>
      </section>

      {/* ── 1. 網站怎麼玩：四步 ── */}
      <section id="how" className="py-16 md:py-24 scroll-mt-20">
        <div className="container">
          <SectionHeader tag="How It Works" title="網站怎麼玩" />
          <div className="grid grid-cols-1 md:grid-cols-4 gap-x-6 gap-y-10">
            {STEPS.map((s) => (
              <div key={s.num} className="border-l border-cream-200 pl-5">
                <p className="text-[10px] tracking-[0.3em] text-neutral-400 mb-3">{s.num}</p>
                <h3 className="text-base font-medium mb-2">{s.title}</h3>
                <p className="text-sm text-neutral-500 leading-6 mb-4">{s.desc}</p>
                <Link
                  href={s.href}
                  className="inline-flex items-center gap-1.5 text-[11px] tracking-[0.2em] uppercase text-neutral-600 hover:text-foreground border-b border-transparent hover:border-foreground pb-0.5 transition-colors"
                >
                  {s.cta} <ArrowRight size={12} />
                </Link>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── 2. 點數怎麼賺 ── */}
      <section id="points" className="py-16 md:py-24 bg-cream-50 scroll-mt-20">
        <div className="container">
          <SectionHeader tag="Earn Points" title="點數怎麼賺" />
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
            {EARN_WAYS.map((w) => {
              const IconComp = w.icon
              return (
                <Link
                  key={w.label}
                  href={w.href}
                  className="group bg-white border border-cream-200 p-6 hover:border-neutral-400 transition-colors"
                >
                  <IconComp size={20} className="text-gold-600 mb-4" />
                  <h3 className="text-sm font-medium mb-1.5">{w.label}</h3>
                  <p className="text-xs text-neutral-500 leading-5 mb-4">{w.desc}</p>
                  <span className="inline-flex items-center gap-1 text-[11px] tracking-[0.2em] uppercase text-neutral-500 group-hover:text-foreground transition-colors">
                    {w.cta} <ArrowRight size={11} />
                  </span>
                </Link>
              )
            })}
          </div>

          {/* 點數怎麼用 + 測驗前檢查提醒 */}
          <div className="mt-10 grid md:grid-cols-2 gap-4">
            <div className="bg-white border border-cream-200 p-6">
              <p className="flex items-center gap-2 text-sm font-medium mb-3">
                <Coins size={16} className="text-gold-600" /> 點數怎麼用
              </p>
              <ul className="text-sm text-neutral-500 leading-7 list-disc pl-5">
                <li>結帳折抵、兌換<Link href="/account/points" className="underline underline-offset-4 hover:text-foreground">專屬好禮</Link></li>
                <li>玩<Link href="/games/mbti-style" className="underline underline-offset-4 hover:text-foreground">MBTI 穿搭個性測驗</Link>，解鎖專屬人格卡與穿搭推薦</li>
                <li>抽獎類遊戲（電影抽獎、轉盤加場）的入場點數</li>
                <li>餘額與歷史紀錄在<Link href="/account/points" className="underline underline-offset-4 hover:text-foreground">會員中心 → 點數</Link></li>
              </ul>
            </div>
            <div className="bg-white border-2 border-neutral-900 p-6">
              <p className="flex items-center gap-2 text-sm font-medium mb-3">
                <Sparkles size={16} /> 測驗前先看點數
              </p>
              <p className="text-sm text-neutral-600 leading-7">
                測驗與抽獎類遊戲每次會扣點。每個遊戲頁最上方都會先顯示
                <strong className="font-medium">你的餘額、本次消耗、今日免費次數</strong>，
                確認扣得起再開始，不會玩到一半才發現點數不夠。
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ── 3. 會員等級 ── */}
      <section id="membership" className="py-16 md:py-24 scroll-mt-20">
        <div className="container">
          <SectionHeader tag="Membership" title="會員等級" />
          <div className="grid md:grid-cols-[1.2fr_1fr] gap-8 items-center">
            <div>
              <p className="text-sm text-neutral-600 leading-7 mb-4">
                消費累積自動升級，等級越高：購物回饋越多、遊戲每日免費次數越多、
                生日禮與專屬活動越豐富。等級與升級門檻都在會員中心看得到。
              </p>
              <div className="flex flex-wrap gap-3">
                <Link
                  href="/membership-benefits"
                  className="inline-flex items-center gap-1.5 text-xs tracking-[0.2em] uppercase border border-neutral-800 px-5 py-2.5 hover:bg-neutral-900 hover:text-white transition-colors"
                >
                  <Crown size={13} /> 完整等級福利
                </Link>
                <Link
                  href="/account/points"
                  className="inline-flex items-center gap-1.5 text-xs tracking-[0.2em] uppercase text-neutral-600 underline underline-offset-4 hover:text-foreground transition-colors py-2.5"
                >
                  看我目前的等級
                </Link>
              </div>
            </div>
            <div className="border border-cream-200 p-6">
              <p className="text-[10px] tracking-[0.3em] text-neutral-400 mb-3 uppercase">Tips</p>
              <ul className="text-sm text-neutral-500 leading-7 list-disc pl-5">
                <li>註冊就有見面禮，先領再逛</li>
                <li>訂閱會員另有每月購物金，跟等級福利可疊加</li>
                <li>推薦好友是升級外最快的賺點方式</li>
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* ── 4. 遊戲規則重點 ── */}
      <section id="games" className="py-16 md:py-24 bg-cream-50 scroll-mt-20">
        <div className="container">
          <SectionHeader tag="Game Rules" title="遊戲規則重點" />
          <div className="grid sm:grid-cols-2 md:grid-cols-4 gap-4">
            {[
              { icon: Gift, title: '每天有免費次數', desc: '多數遊戲每日提供免費次數，會員等級越高次數越多，用完才會扣點。' },
              { icon: Coins, title: '每日獲點有上限', desc: '遊戲點數每天有獲得上限，避免灌點；上限與各遊戲消耗以遊戲頁顯示為準。' },
              { icon: Gamepad2, title: '測驗類每次扣點', desc: 'MBTI 穿搭測驗等每次消耗點數，遊戲頁上方會先顯示餘額再開始。' },
              { icon: MessageCircle, title: '規範與條款', desc: '首次遊玩需同意遊戲規範，完整條款見遊戲條款頁。' },
            ].map((r) => {
              const IconComp = r.icon
              return (
                <div key={r.title} className="bg-white border border-cream-200 p-6">
                  <IconComp size={20} className="text-gold-600 mb-4" />
                  <h3 className="text-sm font-medium mb-1.5">{r.title}</h3>
                  <p className="text-xs text-neutral-500 leading-5">{r.desc}</p>
                </div>
              )
            })}
          </div>
          <div className="mt-8">
            <Link
              href="/games/terms"
              className="inline-flex items-center gap-1.5 text-[11px] tracking-[0.2em] uppercase text-neutral-500 underline underline-offset-4 hover:text-foreground transition-colors"
            >
              遊戲完整條款 <ArrowRight size={11} />
            </Link>
          </div>
        </div>
      </section>

      {/* ── 還有問題？ ── */}
      <section className="py-16 md:py-24 border-t border-cream-200">
        <div className="container max-w-2xl text-center">
          <p className="text-[11px] tracking-[0.35em] text-neutral-400 mb-4 uppercase">Need Help?</p>
          <h2 className="text-2xl md:text-3xl font-serif mb-6">還有問題嗎？</h2>
          <div className="flex flex-wrap items-center justify-center gap-3">
            <Link href="/faq" className="inline-flex items-center gap-1.5 text-xs tracking-[0.2em] uppercase border border-neutral-800 px-5 py-2.5 hover:bg-neutral-900 hover:text-white transition-colors">
              常見問題
            </Link>
            <Link href="/shopping-guide" className="inline-flex items-center gap-1.5 text-xs tracking-[0.2em] uppercase border border-neutral-800 px-5 py-2.5 hover:bg-neutral-900 hover:text-white transition-colors">
              購物說明
            </Link>
            <a
              href="https://page.line.me/nqo0262k"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 text-xs tracking-[0.2em] uppercase border border-neutral-800 px-5 py-2.5 hover:bg-neutral-900 hover:text-white transition-colors"
            >
              <MessageCircle size={13} /> LINE 客服
            </a>
          </div>
        </div>
      </section>
    </main>
  )
}

function SectionHeader({ tag, title }: { tag: string; title: string }) {
  return (
    <div className="mb-8 md:mb-12">
      <p className="text-[11px] tracking-[0.35em] text-neutral-400 mb-3 uppercase">{tag}</p>
      <h2 className="text-3xl md:text-4xl font-serif leading-tight">{title}</h2>
    </div>
  )
}
