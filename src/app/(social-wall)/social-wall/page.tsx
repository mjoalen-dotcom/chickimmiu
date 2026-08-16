import Link from 'next/link'

import { DemoWall } from '@/components/social-wall/DemoWall'
import { SocialWallNav } from '@/components/social-wall/SocialWallNav'

const features = [
  {
    number: '01',
    title: '官方資料來源',
    body: '以 Meta 官方 API 為正式串接方向，內容歸屬、權限與更新狀態清楚可追。',
  },
  {
    number: '02',
    title: '繁中視覺編輯器',
    body: '格數、間距、圓角、配色與文案都能即時預覽，不必先懂程式。',
  },
  {
    number: '03',
    title: '網域授權',
    body: '每個小工具綁定允許的網站網域，以短效簽章驗證嵌入來源。',
  },
  {
    number: '04',
    title: '訂閱與用量',
    body: '方案額度、到期狀態、使用次數與授權數量集中管理，方便後續商業化。',
  },
]

const plans = [
  { name: '免費版', price: 'NT$0', note: '永久', widgets: '1 個社群牆', domains: '1 個授權網域', badge: '' },
  { name: '創作者', price: 'NT$590', note: '每月建議價', widgets: '3 個社群牆', domains: '3 個授權網域', badge: '最適合起步' },
  { name: '品牌版', price: 'NT$1,490', note: '每月建議價', widgets: '20 個社群牆', domains: '20 個授權網域', badge: '' },
  { name: '代理商', price: '專案洽談', note: '依使用量報價', widgets: '250 個社群牆', domains: '250 個授權網域', badge: '' },
]

export default function SocialWallHomePage() {
  return (
    <main className="sw-root">
      <div className="sw-announcement">
        <span>本機 MVP</span>
        Meta 串接、付款與正式訂閱尚未啟用
      </div>
      <SocialWallNav />

      <section className="sw-hero">
        <div className="sw-hero__copy">
          <div className="sw-eyebrow"><i /> 為台灣品牌打造的社群牆</div>
          <h1>
            讓社群內容，
            <span>在你的網站繼續發光。</span>
          </h1>
          <p>把 Instagram 專業帳號內容整理成漂亮、快速、可控的網站元件。繁中介面，五分鐘完成第一面牆。</p>
          <div className="sw-hero__actions">
            <Link className="sw-button" href="/social-wall/studio">開始設計社群牆 <span>→</span></Link>
            <Link className="sw-button sw-button--ghost" href="#preview">看看實際效果</Link>
          </div>
          <ul className="sw-checks" aria-label="產品特色">
            <li>免信用卡</li>
            <li>繁體中文介面</li>
            <li>一行程式碼嵌入</li>
          </ul>
        </div>

        <div className="sw-hero__visual" id="preview">
          <div className="sw-floating-card sw-floating-card--top">
            <span className="sw-status-dot" />
            內容已同步
            <small>剛剛</small>
          </div>
          <DemoWall />
          <div className="sw-floating-card sw-floating-card--bottom">
            <strong>+28%</strong>
            <span>網站停留時間</span>
            <small>示意數據</small>
          </div>
        </div>
      </section>

      <section className="sw-proof" aria-label="適用對象">
        <span>適合</span>
        <strong>個人品牌</strong>
        <i />
        <strong>電商品牌</strong>
        <i />
        <strong>餐旅門市</strong>
        <i />
        <strong>行銷代理商</strong>
      </section>

      <section className="sw-section" id="features">
        <div className="sw-section__heading">
          <div>
            <span>PRODUCT</span>
            <h2>從內容到授權，<br />一個工作台完成。</h2>
          </div>
          <p>先把最影響商業化的環節做紮實：資料來源、版型、租戶隔離、方案額度與網域授權。</p>
        </div>
        <div className="sw-feature-grid">
          {features.map((feature) => (
            <article className="sw-feature" key={feature.number}>
              <span>{feature.number}</span>
              <h3>{feature.title}</h3>
              <p>{feature.body}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="sw-editor-callout">
        <div className="sw-editor-callout__copy">
          <span>即時編輯</span>
          <h2>看到的，就是網站上呈現的。</h2>
          <p>不必反覆發布測試。調整欄數、間距、圓角和主題時，右側預覽立即更新。</p>
          <Link href="/social-wall/studio">開啟互動編輯器 →</Link>
        </div>
        <div className="sw-mini-controls" aria-hidden="true">
          <div><span>版型</span><strong>網格 Grid</strong></div>
          <div><span>桌面欄數</span><strong>3 欄</strong></div>
          <div><span>卡片圓角</span><strong>16 px</strong></div>
          <div className="sw-mini-colors"><span>主題</span><i /><i /><i /></div>
        </div>
      </section>

      <section className="sw-section sw-pricing" id="pricing">
        <div className="sw-section__heading">
          <div>
            <span>PRICING</span>
            <h2>先免費開始，<br />需要時再升級。</h2>
          </div>
          <p>以下為 MVP 商業模型建議價，只供產品驗證；尚未開放正式付款或自動續訂。</p>
        </div>
        <div className="sw-plan-grid">
          {plans.map((plan) => (
            <article className={`sw-plan ${plan.badge ? 'sw-plan--featured' : ''}`} key={plan.name}>
              {plan.badge && <span className="sw-plan__badge">{plan.badge}</span>}
              <h3>{plan.name}</h3>
              <strong>{plan.price}</strong>
              <small>{plan.note}</small>
              <ul>
                <li>{plan.widgets}</li>
                <li>{plan.domains}</li>
                <li>繁中視覺編輯器</li>
                <li>網域授權驗證</li>
              </ul>
              <Link href="/social-wall/studio">試用此方案</Link>
            </article>
          ))}
        </div>
      </section>

      <section className="sw-section sw-faq" id="faq">
        <div className="sw-section__heading">
          <div>
            <span>FAQ</span>
            <h2>開始前，先說清楚。</h2>
          </div>
        </div>
        <details open>
          <summary>可以直接抓任何 Instagram 帳號嗎？</summary>
          <p>正式版只會透過 Meta 核准的官方流程連結有管理權限的 Instagram 專業帳號，不會把第三方網頁爬取當作主資料來源。</p>
        </details>
        <details>
          <summary>網域授權能防止別人複製嗎？</summary>
          <p>嵌入程式會依精確網域取得短效簽章，未授權來源無法載入。這能阻止一般盜用，但不宣稱是不可破解的 DRM。</p>
        </details>
        <details>
          <summary>現在可以付款訂閱嗎？</summary>
          <p>還不行。目前是本機 MVP，付款、續訂通知、發票與退款流程會在沙盒驗證通過並取得部署授權後才開放。</p>
        </details>
      </section>

      <section className="sw-final-cta">
        <span>把分散的社群內容，聚成品牌資產。</span>
        <h2>今天先做出第一面牆。</h2>
        <Link className="sw-button sw-button--light" href="/social-wall/studio">免費試做 <span>→</span></Link>
      </section>

      <footer className="sw-footer">
        <div className="sw-brand sw-brand--footer">
          <span className="sw-brand__mark" aria-hidden="true"><i /><i /><i /><i /></span>
          <span><strong>牆聚</strong><small>WallGather</small></span>
        </div>
        <p>wall.ckmu.co · 繁中社群牆 SaaS MVP</p>
        <span>© 2026 CKMU</span>
      </footer>
    </main>
  )
}
