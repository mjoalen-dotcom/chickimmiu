import type { Metadata } from 'next'
import { getPayload } from 'payload'
import config from '@payload-config'
import { FAQPageClient } from './FAQPageClient'

function getMediaUrl(field: unknown): string | undefined {
  if (!field) return undefined
  if (typeof field === 'object' && field !== null && 'url' in field) {
    return (field as { url?: string }).url ?? undefined
  }
  return undefined
}

async function getFAQSettings() {
  if (!process.env.DATABASE_URI) return null
  try {
    const payload = await getPayload({ config })
    return (await payload.findGlobal({ slug: 'faq-page-settings', depth: 1 })) as unknown as Record<string, unknown>
  } catch {
    return null
  }
}

export async function generateMetadata(): Promise<Metadata> {
  const settings = await getFAQSettings()
  const seo = (settings?.seo || {}) as Record<string, unknown>
  return {
    title: (seo.title as string) || '常見問題 FAQ',
    description: (seo.description as string) || '關於 CHIC KIM & MIU 的訂購流程、付款方式、配送時間、退換貨政策等常見問題解答。',
  }
}

/* ── Default FAQ data ── */
const DEFAULT_CATEGORIES = [
  {
    icon: 'shopping-bag',
    title: '訂購相關',
    items: [
      { question: '如何下單購買？', answer: '瀏覽商品後選擇顏色與尺寸，加入購物車，進入結帳頁面填寫收件資訊與付款方式即可完成訂購。支援信用卡、LINE Pay、ATM 轉帳等多種付款方式。' },
      { question: '可以修改或取消訂單嗎？', answer: '訂單成立後若需修改或取消，請儘速透過 LINE 客服（@ckmu）聯繫我們。若訂單尚未出貨，我們將盡力協助處理；若已出貨則需等待收件後申請退貨。' },
      { question: '有提供預約試穿嗎？', answer: '是的！我們的工作室提供預約試穿服務。請透過 LINE 客服（@ckmu）提供想試穿的款式、顏色、尺寸，我們將依庫存為您安排專屬試穿時段。' },
      { question: '預購商品多久會到貨？', answer: '預購商品通常需要 7-14 個工作天（不含假日）。每件商品頁面會標示預估到貨時間，空運期間若遇天候因素可能略有延遲，我們會即時通知更新進度。' },
    ],
  },
  {
    icon: 'truck',
    title: '配送相關',
    items: [
      { question: '運費怎麼計算？', answer: '單筆訂單滿 NT$1,000 即享免運。未達免運門檻，宅配運費為 NT$100，超商取貨為 NT$70。部分特殊商品或離島地區可能另有費用，請參閱購物說明。' },
      { question: '有哪些配送方式？', answer: '目前提供宅配到府（黑貓/大榮）與超商取貨（7-11、全家、萊爾富、OK）兩種方式。結帳時可自行選擇偏好的配送方式。' },
      { question: '多久會出貨？', answer: '現貨商品於付款完成後 1-2 個工作天內出貨。預購商品依商品頁面標示的到貨時間為準。週末與國定假日順延。' },
      { question: '可以追蹤包裹進度嗎？', answer: '可以！商品出貨後我們會發送出貨通知（含追蹤碼），您也可以在會員中心的「我的訂單」頁面隨時查看物流狀態。' },
    ],
  },
  {
    icon: 'rotate-ccw',
    title: '退換貨相關',
    items: [
      { question: '可以退換貨嗎？', answer: '依照消保法規定，您享有收到商品後 7 天內的鑑賞期。商品須保持全新未穿著、吊牌完整、原包裝未拆封的狀態方可申請退換貨。' },
      { question: '如何申請退換貨？', answer: '請至會員中心的「退換貨」頁面提交申請，或透過 LINE 客服（@ckmu）聯繫。我們收到申請後將於 1-2 個工作天內回覆處理方式。' },
      { question: '退款多久會收到？', answer: '退貨商品經檢查確認無誤後，信用卡退款約 5-10 個工作天（依各銀行作業時間）；ATM/匯款退款約 3-5 個工作天入帳。' },
      { question: '哪些情況不能退貨？', answer: '已穿著洗滌、吊牌剪除、人為損壞、個人衛生用品（如內衣褲、泳裝）、客製化商品等，恕無法受理退貨。詳細說明請參閱退換貨政策頁面。' },
    ],
  },
  {
    icon: 'credit-card',
    title: '付款相關',
    items: [
      { question: '有哪些付款方式？', answer: '我們支援信用卡（VISA/Mastercard/JCB）、LINE Pay、Apple Pay、ATM 虛擬帳號轉帳、超商代碼繳費等多種付款方式。' },
      { question: '可以開立電子發票嗎？', answer: '所有訂單均開立電子發票。發票會自動存入您的會員帳戶，您可以在「電子發票」頁面查看、下載或列印。如需統一編號請在結帳時填寫。' },
      { question: '付款安全嗎？', answer: '我們使用符合 PCI-DSS 安全標準的第三方金流服務，所有交易資料均經 SSL 加密傳輸，不儲存任何信用卡資訊，請安心交易。' },
    ],
  },
  {
    icon: 'star',
    title: '會員制度',
    items: [
      { question: '如何加入會員？', answer: '點擊右上角的會員圖示即可免費註冊。支援 Google、Facebook、LINE 社群帳號快速登入，也可以使用 Email 註冊。新會員立即享有歡迎優惠！' },
      { question: '會員等級怎麼計算？', answer: '我們設有六大會員等級（一般/銅牌/銀牌/金牌/白金/鑽石），依據累積消費金額自動升等。每個等級享有不同的折扣、點數倍率、免運門檻等專屬福利。' },
      { question: '購物金/點數怎麼用？', answer: '消費即可累積購物點數，點數可在下次結帳時折抵現金。每 100 點 = NT$1。點數有效期限為 365 天，可在「點數/購物金」頁面查看餘額與到期時間。' },
      { question: '有生日禮嗎？', answer: '有！壽星月份會收到專屬生日禮，包含生日點數加倍、專屬折扣券、以及依會員等級不同的生日驚喜好禮。請確保帳戶中有填寫正確的生日日期。' },
    ],
  },
  {
    icon: 'gift',
    title: '其他問題',
    items: [
      { question: '商品尺寸怎麼選？', answer: '每件商品頁面都附有詳細尺寸表（胸圍、腰圍、肩寬、衣長等）。如果您不確定，歡迎透過 LINE 客服提供您的身高體重，我們可以為您推薦合適的尺寸。' },
      { question: '商品顏色會有色差嗎？', answer: '我們盡力讓商品照片呈現最真實的顏色，但因拍攝光線與螢幕顯示設定不同，實際商品可能會有些微色差，這屬正常現象，敬請理解。' },
      { question: '如何聯繫客服？', answer: '您可以透過 LINE 官方帳號（@ckmu）聯繫我們，服務時間為週一至週五 10:00-18:00。也歡迎在 Instagram（@chickimmiu）私訊留言，我們會盡快回覆。' },
    ],
  },
]

export default async function FAQPage() {
  const settings = await getFAQSettings()

  const hero = (settings?.hero || {}) as Record<string, unknown>
  const contactCta = (settings?.contactCta || {}) as Record<string, unknown>

  const heroImage = getMediaUrl(hero.image) || 'https://shoplineimg.com/559df3efe37ec64e9f000092/69ce99f6a88927d62e71333c/1296x.webp?source_format=png'
  const heroTitle = (hero.title as string) || '常見問題'
  const heroDesc = (hero.description as string) || '快速找到您需要的答案'

  const categories = (settings?.categories as Array<Record<string, unknown>>) || DEFAULT_CATEGORIES
  const ctaTitle = (contactCta.title as string) || '還是找不到答案？'
  const ctaDesc = (contactCta.description as string) || '歡迎直接聯繫我們的客服團隊，我們很樂意為您解答任何問題。'

  return (
    <FAQPageClient
      heroImage={heroImage}
      heroTitle={heroTitle}
      heroDesc={heroDesc}
      categories={categories.map((cat) => ({
        icon: (cat.icon as string) || 'help-circle',
        title: (cat.title as string) || '',
        items: ((cat.items as Array<Record<string, unknown>>) || []).map((item) => ({
          q: (item.question as string) || (item.q as string) || '',
          a: (item.answer as string) || (item.a as string) || '',
        })),
      }))}
      ctaTitle={ctaTitle}
      ctaDesc={ctaDesc}
    />
  )
}
