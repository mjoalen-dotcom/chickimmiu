import type { Metadata } from 'next'
import { getPolicySettings, extractPolicySections, type PolicySection } from '@/lib/getPolicySettings'

const DEFAULT_SECTIONS: PolicySection[] = [
  { title: '一、接受條款', content: '歡迎使用 CHIC KIM & MIU 網站及相關服務。本服務條款構成您與靚秀國際有限公司之間的法律協議。您使用本網站、註冊會員或購買商品，即視為您已閱讀、瞭解並同意本條款全部內容。' },
  { title: '二、會員註冊與帳號', items: [{ text: '您必須年滿二十歲或已取得法定監護人同意方可註冊。' }, { text: '您同意提供真實、正確、完整的個人資料，並隨時更新。' }, { text: '本公司保留拒絕、暫停或終止異常帳號的權利。' }] },
  { title: '三、購物與訂單', items: [{ text: '商品價格以本網站公告為準，含稅但不含運費。' }, { text: '訂單成立後不得任意取消，退換貨請依本公司退換貨政策辦理。' }, { text: '綠界電子發票將於訂單確認後自動開立並寄送。' }] },
  { title: '四、會員權益與忠誠度', items: [{ text: '本公司提供會員等級、點數、信用分數、訂閱會員、推薦計畫等忠誠度機制。' }, { text: '點數有到期機制，信用分數會因退貨、棄單等行為扣分，嚴重者可能列入黑名單或停權。' }, { text: '所有獎勵以系統紀錄為準，本公司保留最終解釋權。' }] },
  { title: '五、智慧財產權', content: '本網站所有內容（文字、圖片、影片、設計、遊戲）均為本公司或授權人所有，未經書面同意不得使用、複製或公開傳播。' },
  { title: '六、責任限制', content: '本公司盡力提供穩定服務，但不保證完全無中斷或錯誤。對於因不可抗力、系統維護或第三人行為造成之損失，本公司不負賠償責任。' },
  { title: '七、準據法與管轄法院', content: '本條款以中華民國法律為準據法。因本條款所生之爭議，以台灣台北地方法院為第一審管轄法院。' },
  { title: '八、條款修改', content: '本公司保留隨時修改本條款之權利，修改後將於網站公告，繼續使用即視為同意新條款。' },
]

export async function generateMetadata(): Promise<Metadata> {
  const settings = await getPolicySettings()
  const data = extractPolicySections((settings?.terms || null) as Record<string, unknown> | null, DEFAULT_SECTIONS)
  return {
    title: data.seoTitle || '服務條款',
    description: data.seoDescription || 'CHIC KIM & MIU 服務條款 — 使用本網站及相關服務之法律協議。',
  }
}

export default async function TermsOfServicePage() {
  const settings = await getPolicySettings()
  const data = extractPolicySections((settings?.terms || null) as Record<string, unknown> | null, DEFAULT_SECTIONS)

  const pageTitle = data.pageTitle || '服務條款'
  const enTitle = data.enTitle || 'Terms of Service'
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
            {section.content && (
              <p className="text-[15px] text-[#2C2C2C]/80 leading-relaxed">{section.content}</p>
            )}
            {section.items && section.items.length > 0 && (
              <ol className="space-y-3 mt-2">
                {section.items.map((item, i) => (
                  <li key={i} className="flex items-start gap-3 text-[15px] text-[#2C2C2C]/80 leading-relaxed">
                    <span className="shrink-0 w-6 h-6 rounded-full bg-[#C19A5B] text-white flex items-center justify-center text-xs font-bold mt-0.5">{i + 1}</span>
                    <span>{item.text}</span>
                  </li>
                ))}
              </ol>
            )}
          </section>
        ))}
      </div>
    </main>
  )
}
