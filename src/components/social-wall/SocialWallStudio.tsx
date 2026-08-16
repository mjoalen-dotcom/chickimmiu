'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import {
  Check,
  ChevronLeft,
  Clipboard,
  Code2,
  Eye,
  Instagram,
  LayoutGrid,
  Monitor,
  Palette,
  Plus,
  Save,
  ShieldCheck,
  Smartphone,
} from 'lucide-react'

import { DemoWall, defaultDemoWallSettings, type DemoWallSettings } from './DemoWall'
import { normalizeAllowedHostPattern } from '@/lib/social-wall/domain-policy'

type StudioTab = 'design' | 'source' | 'license' | 'install'
type PreviewSize = 'desktop' | 'mobile'

const widgetId = 'kim-lafayette-demo'

export function SocialWallStudio() {
  const [activeTab, setActiveTab] = useState<StudioTab>('design')
  const [settings, setSettings] = useState<DemoWallSettings>(defaultDemoWallSettings)
  const [previewSize, setPreviewSize] = useState<PreviewSize>('desktop')
  const [domainInput, setDomainInput] = useState('')
  const [domains, setDomains] = useState(['blog.kimlafayette.com'])
  const [notice, setNotice] = useState('')

  const embedCode = useMemo(
    () => `<script async src="https://wall.ckmu.co/embed.js" data-widget="${widgetId}"></script>`,
    [],
  )

  const update = <K extends keyof DemoWallSettings>(key: K, value: DemoWallSettings[K]) => {
    setSettings((current) => ({ ...current, [key]: value }))
  }

  const copyEmbedCode = async () => {
    try {
      await navigator.clipboard.writeText(embedCode)
      setNotice('嵌入碼已複製')
    } catch {
      setNotice('瀏覽器未允許自動複製，請手動選取嵌入碼')
    }
  }

  const addDomain = () => {
    try {
      const normalized = normalizeAllowedHostPattern(domainInput, { environment: 'development' })
      if (!domains.includes(normalized)) setDomains((current) => [...current, normalized])
      setDomainInput('')
      setNotice(`已加入 ${normalized}`)
    } catch {
      setNotice('請輸入有效網域，例如 blog.kimlafayette.com')
    }
  }

  const saveDraft = () => {
    window.localStorage.setItem('wallgather-demo-settings', JSON.stringify({ settings, domains }))
    setNotice('設計草稿已儲存在這台裝置')
  }

  return (
    <main className="sw-studio">
      <header className="sw-studio__topbar">
        <div className="sw-studio__title">
          <Link href="/social-wall" aria-label="返回首頁"><ChevronLeft size={20} /></Link>
          <span className="sw-brand__mark sw-brand__mark--small" aria-hidden="true"><i /><i /><i /><i /></span>
          <div>
            <strong>Kim Lafayette 社群牆</strong>
            <small><span /> 草稿 · 尚未發布</small>
          </div>
        </div>
        <div className="sw-studio__actions">
          {notice && <span className="sw-studio__notice" role="status">{notice}</span>}
          <button className="sw-button sw-button--ghost sw-button--small" onClick={saveDraft} type="button">
            <Save size={16} /> 儲存草稿
          </button>
          <Link className="sw-button sw-button--small" href="/social-wall/dashboard">
            前往工作台
          </Link>
        </div>
      </header>

      <div className="sw-studio__workspace">
        <aside className="sw-studio__sidebar">
          <div className="sw-studio__tabs" role="tablist" aria-label="編輯器功能">
            <button className={activeTab === 'design' ? 'is-active' : ''} onClick={() => setActiveTab('design')} type="button"><Palette size={18} />設計</button>
            <button className={activeTab === 'source' ? 'is-active' : ''} onClick={() => setActiveTab('source')} type="button"><Instagram size={18} />內容</button>
            <button className={activeTab === 'license' ? 'is-active' : ''} onClick={() => setActiveTab('license')} type="button"><ShieldCheck size={18} />授權</button>
            <button className={activeTab === 'install' ? 'is-active' : ''} onClick={() => setActiveTab('install')} type="button"><Code2 size={18} />安裝</button>
          </div>

          <div className="sw-studio__panel">
            {activeTab === 'design' && (
              <>
                <div className="sw-panel-heading">
                  <span>視覺設定</span>
                  <h1>設計社群牆</h1>
                  <p>每項調整都會立即反映在右側預覽。</p>
                </div>

                <fieldset className="sw-control-group">
                  <legend>版型</legend>
                  <div className="sw-layout-options">
                    <button className={settings.layout === 'grid' ? 'is-selected' : ''} onClick={() => update('layout', 'grid')} type="button">
                      <LayoutGrid size={22} /><strong>網格</strong><span>整齊排列</span>
                    </button>
                    <button className={settings.layout === 'carousel' ? 'is-selected' : ''} onClick={() => update('layout', 'carousel')} type="button">
                      <span className="sw-carousel-icon">▯▯</span><strong>橫向滑動</strong><span>單列瀏覽</span>
                    </button>
                  </div>
                </fieldset>

                <label className="sw-range-control">
                  <span><strong>桌面欄數</strong><output>{settings.columns} 欄</output></span>
                  <input aria-label="桌面欄數" max="4" min="2" onChange={(event) => update('columns', Number(event.target.value))} type="range" value={settings.columns} />
                  <i><span>2</span><span>3</span><span>4</span></i>
                </label>

                <label className="sw-range-control">
                  <span><strong>卡片間距</strong><output>{settings.gap} px</output></span>
                  <input aria-label="卡片間距" max="28" min="0" onChange={(event) => update('gap', Number(event.target.value))} type="range" value={settings.gap} />
                </label>

                <label className="sw-range-control">
                  <span><strong>卡片圓角</strong><output>{settings.radius} px</output></span>
                  <input aria-label="卡片圓角" max="32" min="0" onChange={(event) => update('radius', Number(event.target.value))} type="range" value={settings.radius} />
                </label>

                <fieldset className="sw-control-group">
                  <legend>色彩主題</legend>
                  <div className="sw-theme-options">
                    {(['light', 'sand', 'dark'] as const).map((theme) => (
                      <button className={`${theme} ${settings.theme === theme ? 'is-selected' : ''}`} key={theme} onClick={() => update('theme', theme)} type="button" aria-label={`${theme} 主題`}>
                        {settings.theme === theme && <Check size={14} />}
                      </button>
                    ))}
                  </div>
                </fieldset>

                <div className="sw-toggle-row">
                  <div><strong>顯示貼文說明</strong><span>滑入圖片時顯示摘要</span></div>
                  <button aria-pressed={settings.showCaption} className={settings.showCaption ? 'is-on' : ''} onClick={() => update('showCaption', !settings.showCaption)} type="button"><i /></button>
                </div>
                <div className="sw-toggle-row">
                  <div><strong>顯示互動數</strong><span>顯示愛心數等公開資料</span></div>
                  <button aria-pressed={settings.showStats} className={settings.showStats ? 'is-on' : ''} onClick={() => update('showStats', !settings.showStats)} type="button"><i /></button>
                </div>
              </>
            )}

            {activeTab === 'source' && (
              <>
                <div className="sw-panel-heading"><span>內容來源</span><h1>Instagram 連結</h1><p>正式版將只使用 Meta 官方授權流程。</p></div>
                <div className="sw-source-card">
                  <div className="sw-source-card__icon"><Instagram /></div>
                  <div><strong>@kim_lafayette</strong><span>目前顯示本機示範資料</span></div>
                  <span className="sw-pill sw-pill--amber">尚未連線</span>
                </div>
                <button className="sw-button sw-button--wide" disabled type="button">等待 Meta App 核准後連結</button>
                <div className="sw-info-box"><ShieldCheck size={19} /><p>我們不會要求你提供 Instagram 密碼。正式連結會跳轉 Meta 官方授權頁。</p></div>
              </>
            )}

            {activeTab === 'license' && (
              <>
                <div className="sw-panel-heading"><span>網域授權</span><h1>允許嵌入的網站</h1><p>只有清單內的精確網域能取得短效載入簽章。</p></div>
                <label className="sw-text-control"><span>新增網域</span><div><input onChange={(event) => setDomainInput(event.target.value)} placeholder="例如：blog.kimlafayette.com" value={domainInput} /><button onClick={addDomain} type="button"><Plus size={17} /></button></div></label>
                <ul className="sw-domain-list">
                  {domains.map((domain) => <li key={domain}><span className="sw-status-dot" /><strong>{domain}</strong><small>已加入草稿</small></li>)}
                </ul>
                <div className="sw-info-box"><ShieldCheck size={19} /><p>正式環境預設不接受 localhost、全域萬用字元或未授權子網域。</p></div>
              </>
            )}

            {activeTab === 'install' && (
              <>
                <div className="sw-panel-heading"><span>安裝</span><h1>複製一行嵌入碼</h1><p>放在網站希望顯示社群牆的位置。</p></div>
                <label className="sw-code-control"><span>JavaScript 嵌入碼</span><textarea readOnly value={embedCode} /><button onClick={copyEmbedCode} type="button"><Clipboard size={16} /> 複製嵌入碼</button></label>
                <ol className="sw-install-steps"><li><span>1</span><p><strong>複製嵌入碼</strong><br />不需修改 widget ID。</p></li><li><span>2</span><p><strong>貼進網站</strong><br />支援一般 HTML 與常見 CMS。</p></li><li><span>3</span><p><strong>確認授權網域</strong><br />正式載入時自動核對來源。</p></li></ol>
              </>
            )}
          </div>
        </aside>

        <section className="sw-preview-area">
          <div className="sw-preview-toolbar">
            <div><Eye size={17} /><strong>即時預覽</strong><span>示範資料</span></div>
            <div className="sw-device-switcher">
              <button aria-label="桌面預覽" className={previewSize === 'desktop' ? 'is-active' : ''} onClick={() => setPreviewSize('desktop')} type="button"><Monitor size={17} /></button>
              <button aria-label="手機預覽" className={previewSize === 'mobile' ? 'is-active' : ''} onClick={() => setPreviewSize('mobile')} type="button"><Smartphone size={17} /></button>
            </div>
          </div>
          <div className={`sw-preview-frame sw-preview-frame--${previewSize}`}>
            <div className="sw-preview-site">
              <div className="sw-preview-site__header"><span>KIM LAFAYETTE</span><i /><i /><i /></div>
              <div className="sw-preview-site__intro"><span>FOLLOW ALONG</span><h2>生活風格日誌</h2><p>旅行、穿搭與每一個值得收藏的日常片刻。</p></div>
              <DemoWall settings={settings} />
            </div>
          </div>
          <div className="sw-preview-meta"><span><i className="sw-status-dot" /> 預覽已更新</span><span>Widget ID · {widgetId}</span></div>
        </section>
      </div>
    </main>
  )
}
