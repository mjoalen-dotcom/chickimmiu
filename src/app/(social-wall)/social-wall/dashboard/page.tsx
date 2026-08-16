import type { Metadata } from 'next'
import Link from 'next/link'
import { ArrowUpRight, BarChart3, Code2, Globe2, LayoutGrid, Plus, ShieldCheck } from 'lucide-react'

import { SocialWallNav } from '@/components/social-wall/SocialWallNav'

export const metadata: Metadata = {
  title: '工作台',
}

export default function SocialWallDashboardPage() {
  return (
    <main className="sw-root sw-dashboard">
      <div className="sw-announcement"><span>預覽工作台</span>目前使用示範資料，尚未連結正式會員與付款</div>
      <SocialWallNav compact />
      <div className="sw-dashboard__shell">
        <aside className="sw-dashboard__menu">
          <strong>工作區</strong>
          <Link className="is-active" href="/social-wall/dashboard"><LayoutGrid size={18} />社群牆</Link>
          <Link href="/social-wall/studio"><Plus size={18} />新增社群牆</Link>
          <span>帳務與安全</span>
          <a href="#domains"><Globe2 size={18} />網域授權</a>
          <a href="#plan"><ShieldCheck size={18} />訂閱方案</a>
        </aside>
        <section className="sw-dashboard__content">
          <div className="sw-dashboard__heading">
            <div><span>2026 年 8 月 16 日</span><h1>晚上好，Alan</h1><p>這裡是 wall.ckmu.co 的本機產品預覽。</p></div>
            <Link className="sw-button" href="/social-wall/studio"><Plus size={17} /> 建立社群牆</Link>
          </div>

          <div className="sw-dashboard__stats">
            <article><span><LayoutGrid size={18} />社群牆</span><strong>1</strong><small>方案上限 3</small></article>
            <article><span><Globe2 size={18} />授權網域</span><strong>1</strong><small>方案上限 3</small></article>
            <article><span><BarChart3 size={18} />本月載入</span><strong>—</strong><small>部署後開始計算</small></article>
          </div>

          <div className="sw-dashboard__section-heading"><div><h2>我的社群牆</h2><p>管理設計、內容來源與網站安裝。</p></div><span>1 個項目</span></div>
          <article className="sw-widget-card">
            <div className="sw-widget-card__preview">
              {[20, 36, 40, 24, 32, 16].map((image) => (
                // eslint-disable-next-line @next/next/no-img-element
                <img alt="社群貼文預覽" key={image} src={`/images/about-legacy/${image}.png`} />
              ))}
            </div>
            <div className="sw-widget-card__body">
              <div className="sw-widget-card__title"><div><span className="sw-status-dot" />草稿</div><small>更新於剛剛</small></div>
              <h3>Kim Lafayette 社群牆</h3>
              <p>@kim_lafayette · 網格版型 · 3 欄</p>
              <div className="sw-widget-card__meta"><span><Globe2 size={15} />blog.kimlafayette.com</span><span><Code2 size={15} />kim-lafayette-demo</span></div>
              <div className="sw-widget-card__actions"><Link href="/social-wall/studio">繼續編輯</Link><Link href="/social-wall/embed-demo" target="_blank">驗證嵌入 <ArrowUpRight size={15} /></Link></div>
            </div>
          </article>

          <div className="sw-dashboard__columns">
            <article id="domains"><div><Globe2 size={20} /><span>網域授權</span></div><strong>blog.kimlafayette.com</strong><p>草稿授權；正式版會核發短效載入簽章。</p><Link href="/social-wall/studio">管理授權 →</Link></article>
            <article id="plan"><div><ShieldCheck size={20} /><span>目前方案</span></div><strong>Creator 封測</strong><p>3 個社群牆、3 個網域。尚未啟用扣款。</p><a href="/social-wall#pricing">查看方案 →</a></article>
          </div>
        </section>
      </div>
    </main>
  )
}
