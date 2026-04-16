import type { Metadata } from 'next'
import Link from 'next/link'
import { getPolicySettings, extractPolicySections, type PolicySection } from '@/lib/getPolicySettings'
import { RenderLexical } from '@/components/lexical/RenderLexical'

// 確保後台編輯後前台即時反映（不走 Next.js static cache）
export const dynamic = 'force-dynamic'

const DEFAULT_SECTIONS: PolicySection[] = [
  { title: '一、適用範圍', content: '本政策適用於 CHIC KIM & MIU 網站、APP、LINE 官方帳號及所有相關服務。' },
  { title: '二、收集的個人資料', content: '我們可能收集以下類型的個人資料：', items: [{ text: '基本資料：姓名、性別、生日、電話、Email、地址' }, { text: '會員資料：身高、體重、身形、偏好類別、尺寸、顏色' }, { text: '交易資料：訂單、發票、付款紀錄、退換貨紀錄' }, { text: '行為資料：瀏覽、購買、遊戲參與、UGC 內容' }, { text: '社群登入資料：LINE、Facebook、Google 授權資料' }, { text: '信用分數與標籤：系統自動產生之信用分數與行為標籤' }] },
  { title: '三、使用目的', content: '我們收集您的個人資料，用於以下目的：', items: [{ text: '提供購物／會員／客服／物流／發票等服務' }, { text: '進行 AI 個人化推薦／尺寸建議／智能加購' }, { text: '執行忠誠度計畫（點數、等級、推薦、信用分數）' }, { text: '行銷活動（生日、節慶、VIP 管家服務）' }, { text: '改善網站／分析行為／優化廣告' }] },
  { title: '四、資料分享', content: '我們僅在以下情況分享您的個人資料：', items: [{ text: '與綠界／金流／物流合作夥伴（必要時）' }, { text: '與 Meta／Google 等廣告平台（匿名化後）' }, { text: '法律要求或政府機關依法要求時' }] },
  { title: '五、您的權利', content: '依照個人資料保護法，您有查詢、閱覽、複製、補充、更正、停止處理、刪除等權利。' },
  { title: '六、Cookie 與追蹤技術', content: '我們使用 Cookie、Google Tag Manager、Meta Pixel 等技術。您可隨時在 Cookie Consent Banner 中調整設定。' },
  { title: '七、資料安全', content: '我們採用適當技術與管理措施保護您的個人資料。' },
  { title: '八、政策修改', content: '本公司保留修改本政策之權利，修改後將於網站公告。' },
]

export async function generateMetadata(): Promise<Metadata> {
  const settings = await getPolicySettings()
  const data = extractPolicySections((settings?.privacyPolicy || null) as Record<string, unknown> | null, DEFAULT_SECTIONS)
  return {
    title: data.seoTitle || '隱私權政策',
    description: data.seoDescription || 'CHIC KIM & MIU 隱私權政策 — 了解我們如何收集、使用及保護您的個人資料。',
  }
}

export default async function PrivacyPolicyPage() {
  const settings = await getPolicySettings()
  const data = extractPolicySections((settings?.privacyPolicy || null) as Record<string, unknown> | null, DEFAULT_SECTIONS)

  const pageTitle = data.pageTitle || '隱私權政策'
  const enTitle = data.enTitle || 'Privacy Policy'
  const effectiveDate = data.effectiveDate || '2026年4月12日'
  const version = data.version || '1.0'

  return (
    <main className="bg-[#FDF8F3] min-h-screen">
      <section className="bg-gradient-to-b from-[#C19A5B]/10 to-[#FDF8F3] pt-16 pb-10">
        <div className="max-w-4xl mx-auto px-6 text-center">
          <p className="text-[#C19A5B] tracking-[0.3em] text-sm font-medium mb-3">CHIC KIM & MIU</p>
          <h1 className="text-3xl md:text-4xl font-bold text-[#2C2C2C] tracking-wide">{pageTitle}</h1>
          <p className="text-[#2C2C2C]/50 text-sm mt-1">{enTitle}</p>
          <div className="mt-4 w-16 h-[2px] bg-[#C19A5B] mx-auto" />
          <p className="mt-4 text-[#2C2C2C]/60 text-sm">生效日期：{effectiveDate} ｜ 版本：{version}</p>
        </div>
      </section>

      <div className="max-w-4xl mx-auto px-6 py-16 space-y-8">
        {data.sections.map((section) => (
          <section key={section.title} className="bg-white rounded-2xl shadow-sm p-8 md:p-10">
            <h2 className="text-xl font-bold text-[#2C2C2C] mb-1">{section.title}</h2>
            <div className="w-10 h-[2px] bg-[#C19A5B] mb-5" />
            {section.richContent ? (
              <div className="text-[15px] text-[#2C2C2C]/80 leading-relaxed prose prose-sm max-w-none">
                <RenderLexical content={section.richContent} />
              </div>
            ) : section.content ? (
              <p className="text-[15px] text-[#2C2C2C]/80 leading-relaxed">{section.content}</p>
            ) : null}
            {section.items && section.items.length > 0 && (
              <ul className="mt-4 space-y-2">
                {section.items.map((item, i) => (
                  <li key={i} className="flex items-start gap-3 text-[15px] text-[#2C2C2C]/80 leading-relaxed">
                    <span className="mt-2 w-2 h-2 rounded-full bg-[#C19A5B] shrink-0" />
                    <span>{item.text}</span>
                  </li>
                ))}
              </ul>
            )}
          </section>
        ))}

        {/* ── Contact Section ── */}
        <section className="bg-gradient-to-br from-[#C19A5B]/10 to-[#C19A5B]/5 border border-[#C19A5B]/20 rounded-2xl p-8 md:p-10">
          <h2 className="text-xl font-bold text-[#2C2C2C] mb-1">九、聯絡我們</h2>
          <div className="w-10 h-[2px] bg-[#C19A5B] mb-5" />
          <div className="space-y-3 text-[15px] text-[#2C2C2C]/80">
            <p className="flex items-start gap-3">
              <span className="mt-2 w-2 h-2 rounded-full bg-[#C19A5B] shrink-0" />
              <span>LINE 官方帳號：<Link href="https://page.line.me/nqo0262k" target="_blank" rel="noopener noreferrer" className="text-[#C19A5B] underline underline-offset-2 hover:text-[#A07A3B] transition-colors">https://page.line.me/nqo0262k</Link></span>
            </p>
            <p className="flex items-start gap-3">
              <span className="mt-2 w-2 h-2 rounded-full bg-[#C19A5B] shrink-0" />
              <span>Email：<Link href="mailto:service@chickimmiu.com" className="text-[#C19A5B] underline underline-offset-2 hover:text-[#A07A3B] transition-colors">service@chickimmiu.com</Link></span>
            </p>
          </div>
        </section>
      </div>
    </main>
  )
}
