/**
 * pageTemplates.ts
 * ────────────────
 * 五種「活動一頁式網頁」快速樣板。
 *
 * 由 /admin/pages 列表上方的 PageTemplatePicker 觸發 →
 * POST /api/pages/from-template { templateId } → 後端 payload.create
 * → redirect 到 /admin/collections/pages/{id} 直接編輯。
 *
 * 每個樣板為 v3 Payload Pages collection 的合法 layout (blocks) 結構，
 * 預填中文文案；admin 進入後僅需替換圖片與細節即可發佈。
 *
 * 已知限制：
 *   - image-gallery.images[].image 為 required upload。API 端會在建立時
 *     用第一張 Media 補位（無 Media 時整個 image-gallery 區塊會被略過）。
 *   - countdown.endDate 為 required date。預設為「建立日 + 30 天」，
 *     admin 必須調整。
 *   - video.url 預填 YouTube 範例網址，admin 必須替換。
 *
 * 樣板差異化策略（10 個 block 類型在不同排列下表現各自風格）：
 *   1. section 排列順序與節奏
 *   2. hero overlay 強度（25 / 30 / 35 / 40 / 50）
 *   3. CTA style（primary / secondary / dark）
 *   4. divider style（line vs ornament）
 *   5. image-gallery layout（grid / masonry / carousel）
 *   6. product-showcase displayStyle（grid / carousel）
 *   7. 預填文案語氣（編輯體 / 宣言體 / 私房體 / 朋友體 / 典藏體）
 *   8. testimonial / faq 角色設定（編輯 / 粉絲 / VIP / 主編 / 城市女孩）
 *
 * 如需更貼近 Vogue / Cosmopolitan 等真實雜誌的版型（封面字 / 引述塊 /
 * KOL profile），需新增 block 類型，屬下一個 PR 範圍。
 */

/* ============================================================
   Lexical richText 小工具
   ============================================================ */

type LexicalText = {
  type: 'text'
  text: string
  format: number
  detail: number
  mode: 'normal'
  style: string
  version: 1
}

type LexicalParagraph = {
  type: 'paragraph'
  children: LexicalText[]
  direction: 'ltr'
  format: ''
  indent: 0
  version: 1
  textFormat: 0
}

type LexicalRoot = {
  root: {
    type: 'root'
    children: LexicalParagraph[]
    direction: 'ltr'
    format: ''
    indent: 0
    version: 1
  }
}

const text = (s: string): LexicalText => ({
  type: 'text',
  text: s,
  format: 0,
  detail: 0,
  mode: 'normal',
  style: '',
  version: 1,
})

const paragraph = (s: string): LexicalParagraph => ({
  type: 'paragraph',
  children: [text(s)],
  direction: 'ltr',
  format: '',
  indent: 0,
  version: 1,
  textFormat: 0,
})

/** 將純文字段落陣列轉為 Payload Lexical root 結構 */
const richText = (paragraphs: string[]): LexicalRoot => ({
  root: {
    type: 'root',
    children: paragraphs.map(paragraph),
    direction: 'ltr',
    format: '',
    indent: 0,
    version: 1,
  },
})

/* ============================================================
   型別
   ============================================================ */

type LayoutBlock = Record<string, unknown> & { blockType: string }

export interface PageTemplate {
  id: 'fashion-magazine' | 'vogue' | 'luxury' | 'kol-personal' | 'cosmopolitan'
  name: string
  description: string
  /** 卡片顯示用色（hex），呼應該樣板的視覺基調 */
  accent: string
  /** 卡片顯示用代表符號（純裝飾）*/
  emoji: string
  /** 預設標題（可被 admin 覆寫）*/
  defaultTitle: string
  /** slug 前綴（API 端會 append timestamp 確保唯一）*/
  slugPrefix: string
  /** Page layout（blocks）*/
  layout: LayoutBlock[]
  /** SEO 預設值 */
  seo: {
    metaTitle: string
    metaDescription: string
  }
}

/* ============================================================
   Template 1 — 時尚雜誌（Fashion Magazine）
   特色：編輯體、結構分明、留白整齊
   ============================================================ */

const fashionMagazine: PageTemplate = {
  id: 'fashion-magazine',
  name: '時尚雜誌',
  description: '編輯精選 × 主題策展。適合季度特刊、編輯選品專題。',
  accent: '#1A1F36',
  emoji: '📖',
  defaultTitle: '本季時尚特刊（編輯精選）',
  slugPrefix: 'fashion-issue',
  seo: {
    metaTitle: '本季時尚特刊 · 編輯精選',
    metaDescription: '本季最完整的時尚指南，由主編團隊精挑細選，帶你一次掌握當月趨勢、單品搭配與生活靈感。',
  },
  layout: [
    {
      blockType: 'hero-banner',
      heading: '本季時尚特刊',
      subheading: 'Editor’s Pick · 主編精選 · 本月封面故事',
      ctaText: '閱讀本期內容',
      ctaLink: '#editorial',
      overlay: 40,
    },
    {
      blockType: 'divider',
      style: 'line',
      height: 32,
    },
    {
      blockType: 'rich-content',
      content: richText([
        '《本期編輯的話》本月，我們將焦點放回最日常卻最被忽略的細節 — 質感從容是一種選擇，而非妥協。從清晨第一道光、到深夜書桌前的最後一杯茶，我們相信每一個瞬間都值得被認真對待。',
        '本期封面，我們邀請了三位風格人物分享她們的衣櫃、書架與餐桌。從她們的日常你會發現，所謂的時尚從來不只是穿在身上的東西，而是一種對自己的承諾 — 你願意花多少時間，去認識當下的自己。',
        '希望這本特刊能陪你度過接下來這一個月，無論是穿搭靈感、生活儀式，或單純翻閱時的片刻安靜。— 編輯部敬上',
      ]),
    },
    {
      blockType: 'image-gallery',
      layout: 'grid',
      images: [
        { caption: '主編精選 #1 · 封面拍攝花絮' },
        { caption: '主編精選 #2 · Look 1 · 早晨光影' },
        { caption: '主編精選 #3 · Look 2 · 都市午後' },
        { caption: '主編精選 #4 · Look 3 · 黃昏街道' },
        { caption: '主編精選 #5 · Look 4 · 夜晚輪廓' },
        { caption: '主編精選 #6 · 訪談現場' },
      ],
    },
    {
      blockType: 'divider',
      style: 'ornament',
      height: 48,
    },
    {
      blockType: 'product-showcase',
      heading: '本期主推 · 編輯精選',
      displayStyle: 'grid',
    },
    {
      blockType: 'rich-content',
      content: richText([
        '《主編後記》策展這件事，最難的不是挑出什麼該被看見，而是決定什麼可以暫時被擱置。本期的選物清單，我們花了將近一個月的時間反覆討論、試穿、淘汰 — 最終留下的，是我們真心願意推薦給好朋友的那幾件。',
        '如果你只能選擇一件帶回家，編輯部的共同建議是：選那件你會想穿很久的。風格會隨季節更迭，但好物永遠不退流行。',
      ]),
    },
    {
      blockType: 'testimonial',
      heading: '編輯們的話',
      testimonials: [
        {
          name: '主編 Lin',
          content: '這一期最讓我著迷的是封面那組光影層次，反覆看了三十次都不膩。',
          rating: 5,
        },
        {
          name: '時尚編輯 Wen',
          content: '本期主推的單品線索很完整，從材質到剪裁都能清楚感受到品牌的用心。',
          rating: 5,
        },
        {
          name: '視覺編輯 Yu',
          content: '版面節奏把日常瞬間放慢，讀完整本你會想喝一杯熱茶坐下來。',
          rating: 5,
        },
      ],
    },
    {
      blockType: 'faq',
      heading: '關於本期特刊',
      questions: [
        {
          question: '本期內容的更新頻率？',
          answer: richText([
            '《本季時尚特刊》每三個月發行一次，分春、夏、秋、冬四期。',
            '額外不定期推出「節日限定」與「主題策展」專刊，訂閱會員會優先收到通知。',
          ]),
        },
        {
          question: '主編精選的單品還會補貨嗎？',
          answer: richText([
            '本期主推為限量策展，售完將以「同質感替代品」於下一期推薦，不再原品補貨。',
            '若您看到喜歡的款式，建議盡早收藏。',
          ]),
        },
        {
          question: '可以投稿穿搭給編輯部嗎？',
          answer: richText([
            '歡迎！請至下方訂閱表單留下您的聯絡方式，我們每月會挑選 3 位讀者進行回覆。',
            '入選的穿搭故事將以匿名方式刊登於下一期特刊。',
          ]),
        },
      ],
    },
    {
      blockType: 'cta',
      heading: '訂閱新刊預告',
      description: '搶先收到下一期主編精選與獨家折扣碼，每月一封，安靜不擾人。',
      buttonText: '加入訂閱',
      buttonLink: '/account/subscription',
      style: 'secondary',
    },
  ],
}

/* ============================================================
   Template 2 — Vogue（風格宣言）
   特色：宣言體、強烈視覺、Full-bleed
   ============================================================ */

const vogue: PageTemplate = {
  id: 'vogue',
  name: 'Vogue 風格宣言',
  description: '大膽宣言 × 標誌性視覺。適合品牌大片、Campaign 揭露。',
  accent: '#000000',
  emoji: '🖤',
  defaultTitle: 'DEFINE YOUR ERA · 風格宣言',
  slugPrefix: 'vogue-era',
  seo: {
    metaTitle: 'DEFINE YOUR ERA · Vogue 風格宣言',
    metaDescription: '不追隨趨勢，定義時代。本季 Campaign 從一個宣言出發，重新探討衣著與身份的關係。',
  },
  layout: [
    {
      blockType: 'hero-banner',
      heading: 'DEFINE YOUR ERA',
      subheading: '不追隨趨勢 · 定義時代 · BY YOU, FOR YOU',
      ctaText: '進入本季 Campaign',
      ctaLink: '#manifesto',
      overlay: 50,
    },
    {
      blockType: 'rich-content',
      content: richText([
        'MANIFESTO ／ 風格從來不是規則。它是一種拒絕 — 拒絕被定義、拒絕被歸類、拒絕在他人的時間軸上長大。',
        '本季，我們把鏡頭對準三位拒絕「應該是這樣」的女人。她們的職業、年齡、城市都不同，但她們有一個共同點 — 她們不為了誰穿衣服，她們穿給自己看。',
        '這不是趨勢，這是宣言。歡迎你，加入這個沒有規則的時代。',
      ]),
    },
    {
      blockType: 'divider',
      style: 'ornament',
      height: 56,
    },
    {
      blockType: 'image-gallery',
      layout: 'masonry',
      images: [
        { caption: 'CAMPAIGN 01 · The Architect' },
        { caption: 'CAMPAIGN 02 · The Maker' },
        { caption: 'CAMPAIGN 03 · The Director' },
        { caption: 'BEHIND THE SCENES · 拍攝現場' },
        { caption: 'CAMPAIGN 04 · Studio Light' },
        { caption: 'CAMPAIGN 05 · After Hours' },
      ],
    },
    {
      blockType: 'video',
      url: 'https://www.youtube.com/watch?v=REPLACE_ME',
      caption: '本季 Campaign 微電影 · DEFINE YOUR ERA（請替換為實際影片網址）',
    },
    {
      blockType: 'product-showcase',
      heading: 'ICON COLLECTION · 標誌性單品',
      displayStyle: 'carousel',
    },
    {
      blockType: 'rich-content',
      content: richText([
        '本季的標誌性單品，我們將設計回歸最純粹的線條 — 一件好的 tailoring，不該需要任何解釋。',
        '從面料到剪裁，每一個細節都來自三十年以上經驗的匠人之手。我們相信，永恆從來不是被製造的，而是被認真對待後自然形成的。',
      ]),
    },
    {
      blockType: 'testimonial',
      heading: 'VOICES · 聲音',
      testimonials: [
        {
          name: 'Chloé · 建築師 · 35',
          content: '我穿這件外套去工地，也穿去開會。它讓我兩個身份都能被認真看待。',
          rating: 5,
        },
        {
          name: 'Sayaka · 影像導演 · 41',
          content: '不需要聲音的設計才是最大聲的設計。這個季度做到了。',
          rating: 5,
        },
        {
          name: 'Mira · 雕塑藝術家 · 29',
          content: '我把它穿了三個月幾乎每天，它沒有走樣。這就是答案。',
          rating: 5,
        },
      ],
    },
    {
      blockType: 'cta',
      heading: '成為下一個 ICON',
      description: '加入 ICON 會員，搶先收到 Campaign 預告、Look book 與限量釋出通知。',
      buttonText: '加入 ICON 會員',
      buttonLink: '/register',
      style: 'dark',
    },
  ],
}

/* ============================================================
   Template 3 — Luxury（私密典藏）
   特色：典藏體、金色點綴、留白寬廣
   ============================================================ */

const luxury: PageTemplate = {
  id: 'luxury',
  name: 'Luxury 私密典藏',
  description: '限量 × 典藏 × 邀請制。適合高單價發售、私密 VIP 活動。',
  accent: '#C19A5B',
  emoji: '✦',
  defaultTitle: 'PRIVATE COLLECTION · 限量典藏',
  slugPrefix: 'private-collection',
  seo: {
    metaTitle: 'PRIVATE COLLECTION · 限量典藏',
    metaDescription: '邀請制限量發售。每一件作品皆來自工坊匠人手作，全球流通數量不超過 30 件。',
  },
  layout: [
    {
      blockType: 'hero-banner',
      heading: 'PRIVATE COLLECTION',
      subheading: '限量典藏 · By Invitation Only · 全球僅 30 席',
      ctaText: '申請邀請函',
      ctaLink: '#invitation',
      overlay: 35,
    },
    {
      blockType: 'divider',
      style: 'ornament',
      height: 64,
    },
    {
      blockType: 'rich-content',
      content: richText([
        '《工坊敘事》本系列來自一座位於京都郊外的小型工坊。三位職人花了七年時間，反覆研磨同一道工序 — 我們相信，極致的工藝不是來自速度，而是來自對時間的敬意。',
        '這個系列僅生產 30 件。每一件皆有獨立編號、配置工坊主人手寫卡片，並附上完整的養護指南。',
        '我們不在通路販售，也不打折。如果這份美學對您有所觸動，請接受我們的邀請。',
      ]),
    },
    {
      blockType: 'countdown',
      heading: '限量發售倒數',
      description: '本系列僅開放預約 7 天，售完將永久封存。',
      endDate: '__TEMPLATE_END_DATE_30D__',
      ctaText: '立即預約',
      ctaLink: '#reservation',
    },
    {
      blockType: 'image-gallery',
      layout: 'masonry',
      images: [
        { caption: 'No. 01 · 工坊主匠的雙手' },
        { caption: 'No. 02 · 七年時間沉澱出的紋理' },
        { caption: 'No. 03 · 純手縫細節 · 每件需 38 小時' },
        { caption: 'No. 04 · 獨立編號刻印' },
        { caption: 'No. 05 · 京都工坊一角' },
        { caption: 'No. 06 · 手寫養護指南' },
      ],
    },
    {
      blockType: 'divider',
      style: 'ornament',
      height: 48,
    },
    {
      blockType: 'product-showcase',
      heading: 'Atelier Selection · 私密典藏',
      displayStyle: 'carousel',
    },
    {
      blockType: 'testimonial',
      heading: 'VIP 顧客的話',
      testimonials: [
        {
          name: 'Madame C. · 巴黎',
          content: '這是我擁有的第三件來自這個工坊的作品。每一件都讓我重新理解什麼叫做「值得」。',
          rating: 5,
        },
        {
          name: 'Mr. T. · 東京',
          content: '從預約到收到的兩個月裡，我收到了五封手寫信。這已經超越商品了。',
          rating: 5,
        },
        {
          name: 'Dr. L. · 香港',
          content: '我每年都會來一次京都拜訪工坊。這份關係，比我擁有的任何精品都更珍貴。',
          rating: 5,
        },
      ],
    },
    {
      blockType: 'faq',
      heading: '關於私密典藏',
      questions: [
        {
          question: '為什麼採用邀請制？',
          answer: richText([
            '工坊主匠堅持，他希望知道每一件作品的去處，並親自寫下祝福。',
            '邀請制不是門檻，而是一種對創作的尊重 — 我們不希望這份用心，落入轉售或冷落。',
          ]),
        },
        {
          question: '如何申請邀請函？',
          answer: richText([
            '請點擊頁面上方「申請邀請函」按鈕，留下您的聯絡方式與簡短自我介紹。',
            '我們會於 3 個工作天內由專人聯繫，安排線上一對一介紹會。',
          ]),
        },
        {
          question: '可以親自拜訪工坊嗎？',
          answer: richText([
            '可以。已收件 VIP 顧客可預約「年度工坊行」，由我們協助安排京都行程。',
            '工坊主匠會親自接待，並準備一頓由他妻子料理的午餐。',
          ]),
        },
        {
          question: '售後服務範圍？',
          answer: richText([
            '所有作品提供終身免費保養。每三年寄回工坊，會由原匠人重新打磨、細部修補。',
            '若您未來決定釋出，我們提供「典藏回購」服務，避免作品流入二級市場。',
          ]),
        },
      ],
    },
    {
      blockType: 'cta',
      heading: '獲得專屬邀請函',
      description: '本系列僅開放 30 位收藏者。請留下聯絡方式，我們將於 3 個工作天內由專人聯繫。',
      buttonText: '申請邀請函',
      buttonLink: '/contact?type=private-collection',
      style: 'dark',
    },
  ],
}

/* ============================================================
   Template 4 — KOL 個人風格（私房分享）
   特色：第一人稱、溫暖、像朋友的衣櫃
   ============================================================ */

const kolPersonal: PageTemplate = {
  id: 'kol-personal',
  name: 'KOL 個人風格',
  description: '第一人稱 × 私房分享。適合 KOL 聯名、個人選物專頁。',
  accent: '#E8B4B8',
  emoji: '✿',
  defaultTitle: '嗨，這是我的衣櫃 · 本月私藏',
  slugPrefix: 'kol-closet',
  seo: {
    metaTitle: '嗨，這是我的衣櫃 · KOL 本月私藏',
    metaDescription: '我把這個月真正穿到的、想推薦的，全部整理在這裡。沒有業配腔調，只有朋友之間會分享的真心話。',
  },
  layout: [
    {
      blockType: 'hero-banner',
      heading: '嗨，這是我的衣櫃',
      subheading: '本月真正穿到的、想推薦的，都在這裡 ✿',
      ctaText: '看本月私藏',
      ctaLink: '#closet',
      overlay: 25,
    },
    {
      blockType: 'rich-content',
      content: richText([
        '哈囉～我是 [請替換為您的名字]！這是我第二次跟 chickimmiu 合作策展，這次我把過去 30 天「真的穿到走出家門」的單品整理出來，沒挑沒選 — 你們看到的就是我衣櫃的真實樣子 ☕️',
        '這次特別想跟大家分享的是「複合穿法」 — 同一件外套我可以怎麼穿出三種感覺？同一條褲子白天上班、晚上聚會怎麼一鍵切換？我都拍下來放在下面的 Lookbook 裡，希望可以給你們一些靈感。',
        '如果你跟我一樣是「衣服不多但每件都要打很多份工」的女生，這次的私藏清單會很適合你。看完記得告訴我你最想入手哪一件！',
      ]),
    },
    {
      blockType: 'video',
      url: 'https://www.youtube.com/watch?v=REPLACE_ME',
      caption: '本月私藏開箱 · 5 分鐘看完我的衣櫃（請替換為實際影片網址）',
    },
    {
      blockType: 'image-gallery',
      layout: 'carousel',
      images: [
        { caption: 'Day 1 · 上班通勤 · 簡單俐落感' },
        { caption: 'Day 2 · 週末早午餐 · 慵懶但有型' },
        { caption: 'Day 3 · 聚餐約會 · 一件單品的兩種樣子' },
        { caption: 'Day 4 · 出差出國 · 一咖行李箱主義' },
        { caption: 'Day 5 · 雨天 outfits · 不狼狽的解法' },
        { caption: 'Day 6 · 居家舒適 · 但接快遞不尷尬' },
      ],
    },
    {
      blockType: 'product-showcase',
      heading: '我的私藏清單',
      displayStyle: 'grid',
    },
    {
      blockType: 'rich-content',
      content: richText([
        '《選物心得》這個月被問最多的就是「這件大衣會起毛球嗎？」 — 我直接告訴你，會。但只要照著我下面的養護方法，整個冬天結束後它還是好好的。',
        '另外想偷偷說一個小秘密 — 那條被我拍了三次的牛仔褲，其實是我合作前就買的私服，因為太愛才厚著臉皮跟品牌說想推。所以你看到的是「真的會被回購」的那種真誠推薦，請放心 ♡',
      ]),
    },
    {
      blockType: 'testimonial',
      heading: '粉絲們的回饋',
      testimonials: [
        {
          name: '@miumiu_2027',
          content: '上次跟著買了那件針織開襟，真的是冬天通勤神器！這次我先收藏一波 ♡',
          rating: 5,
        },
        {
          name: '@cathy_in_taipei',
          content: '從你開始追，已經第三次無腦下單了，每次都不踩雷！',
          rating: 5,
        },
        {
          name: '@yuni.style',
          content: '影片裡的那個圍巾打法我學起來了，謝謝你拯救我的冬天！',
          rating: 5,
        },
      ],
    },
    {
      blockType: 'faq',
      heading: '常被問到的問題',
      questions: [
        {
          question: '你會繼續推薦同一個品牌嗎？',
          answer: richText([
            '會的！只要這個品牌的東西我自己還在穿、還在喜歡，我就會繼續分享。',
            '但我不會為了業配硬推不喜歡的東西，這是我和粉絲們的約定。',
          ]),
        },
        {
          question: '你是怎麼決定要不要合作的？',
          answer: richText([
            '我會先把樣品穿一個月看看。如果穿不到 5 次，我就不會推。',
            '如果穿超過 10 次還想繼續穿，我就會跟品牌說：「這個我可以推。」',
          ]),
        },
        {
          question: '尺寸我該怎麼選？',
          answer: richText([
            '我都會在 IG 限動的 Q&A 開放尺寸詢問，每天會花 30 分鐘回大家。',
            '或是直接私訊我身高體重 + 平常穿 S/M/L，我都會一個一個回。',
          ]),
        },
      ],
    },
    {
      blockType: 'cta',
      heading: '追蹤我的下一波分享',
      description: '訂閱後我每兩週會寄一封小信給你，分享下一波選物清單與穿搭靈感 ♡',
      buttonText: '訂閱 ✿ 不錯過下一期',
      buttonLink: '/account/subscription',
      style: 'primary',
    },
  ],
}

/* ============================================================
   Template 5 — Cosmopolitan（城市女孩 Lifestyle）
   特色：朋友體、活潑、Lifestyle Mix
   ============================================================ */

const cosmopolitan: PageTemplate = {
  id: 'cosmopolitan',
  name: 'Cosmopolitan 城市女孩',
  description: '城市生活 × 趨勢 Mix。適合活動企劃、Lifestyle 主題策展。',
  accent: '#E84A6E',
  emoji: '🌆',
  defaultTitle: '本月 CITY GUIDE · 女孩們的下一場約會',
  slugPrefix: 'city-guide',
  seo: {
    metaTitle: '本月 CITY GUIDE · 城市女孩 Lifestyle',
    metaDescription: '本月城市最熱話題、必訪場所、必入單品一次看完。從穿搭到周末計畫，給你下班後的一百種可能。',
  },
  layout: [
    {
      blockType: 'hero-banner',
      heading: '本月 CITY GUIDE',
      subheading: '穿搭、地點、靈感一次到位 · 跟著女孩們玩遍城市',
      ctaText: '解鎖本月城市行程',
      ctaLink: '#guide',
      overlay: 30,
    },
    {
      blockType: 'rich-content',
      content: richText([
        '《本月主題：星期三的解法》週中總是最難 — 工作累、聚會懶、又不想浪費這一天。本月企劃我們找了 12 個女孩，問她們「最理想的星期三晚上長什麼樣子」？',
        '結果超乎預期 — 有人選擇戴上耳機去陶藝教室，有人去電影院看一部冷門紀錄片，有人在天台辦只有三個朋友的 wine night。我們把所有提案整理成「星期三的 12 種解法」，搭配適合的穿搭與地點清單，全部放在下面。',
        '這個月，讓我們一起讓星期三變成最期待的那一天 ✦',
      ]),
    },
    {
      blockType: 'divider',
      style: 'line',
      height: 32,
    },
    {
      blockType: 'image-gallery',
      layout: 'carousel',
      images: [
        { caption: 'OUTFIT 01 · 下班直接奔向陶藝教室' },
        { caption: 'OUTFIT 02 · 一個人的電影院 outfits' },
        { caption: 'OUTFIT 03 · 天台 wine night 三人組' },
        { caption: 'OUTFIT 04 · 中山站書店窩到關門' },
        { caption: 'OUTFIT 05 · 信義區音樂酒吧女子聚會' },
        { caption: 'OUTFIT 06 · 河堤夜跑 + 便利商店冰拿鐵' },
      ],
    },
    {
      blockType: 'product-showcase',
      heading: '趨勢精選 · Mix & Match 必入單品',
      displayStyle: 'grid',
    },
    {
      blockType: 'rich-content',
      content: richText([
        '本月編輯部走訪了 8 家城市選物店，從中挑出最值得收藏的 6 件單品 — 每一件都是「白天好搭、晚上加分」的雙身份單品，給你最大的穿搭彈性。',
        '小提醒 ♡ 趨勢精選的單品有不少限量款，喜歡的話建議盡早收藏！',
      ]),
    },
    {
      blockType: 'countdown',
      heading: '本月女孩聚會倒數',
      description: '本月最熱門的城市女孩聚會即將開始，限定名額先到先得 ✦',
      endDate: '__TEMPLATE_END_DATE_14D__',
      ctaText: '立刻報名',
      ctaLink: '#meetup',
    },
    {
      blockType: 'testimonial',
      heading: '她們都這麼穿',
      testimonials: [
        {
          name: 'Wendy · 廣告 AE · 27',
          content: '加入 chickimmiu CITY GUIDE 後，我每個月都期待週中的計畫。',
          rating: 5,
        },
        {
          name: 'Joyce · 設計師 · 30',
          content: '上次跟著推薦去了那家陶藝教室，現在已經去了 5 次了，根本回不來。',
          rating: 5,
        },
        {
          name: 'Tina · 行銷 · 25',
          content: '從來沒想過星期三可以這麼好玩。城市原來這麼大！',
          rating: 5,
        },
      ],
    },
    {
      blockType: 'cta',
      heading: '加入女孩們的下一場約會',
      description: '訂閱 CITY GUIDE，每月第一個星期一收到全新企劃 + 限量穿搭預告 ♡',
      buttonText: '加入 CITY GUIDE',
      buttonLink: '/account/subscription',
      style: 'primary',
    },
  ],
}

/* ============================================================
   Export
   ============================================================ */

export const pageTemplates: PageTemplate[] = [
  fashionMagazine,
  vogue,
  luxury,
  kolPersonal,
  cosmopolitan,
]

/** 由 id 取得樣板（API 端使用）*/
export const getTemplateById = (id: string): PageTemplate | undefined =>
  pageTemplates.find((t) => t.id === id)

/**
 * 將樣板的特殊佔位字串轉換成實際值（API 端使用前呼叫）。
 * 目前處理：
 *   - __TEMPLATE_END_DATE_30D__ → 建立日 + 30 天 ISO
 *   - __TEMPLATE_END_DATE_14D__ → 建立日 + 14 天 ISO
 */
export function hydrateTemplateLayout(
  layout: LayoutBlock[],
  options: { now?: Date; placeholderImageId?: string | number | null } = {},
): LayoutBlock[] {
  const now = options.now ?? new Date()
  const in30d = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000).toISOString()
  const in14d = new Date(now.getTime() + 14 * 24 * 60 * 60 * 1000).toISOString()
  const placeholder = options.placeholderImageId ?? null

  const result: LayoutBlock[] = []
  for (const block of layout) {
    // image-gallery: 若沒有 placeholder image 可填，整段移除
    if (block.blockType === 'image-gallery') {
      const images = (block.images as Array<Record<string, unknown>>) || []
      if (!placeholder) {
        // 沒任何 Media 可補位 → 略過此區塊
        continue
      }
      const hydratedImages = images.map((img) => ({ ...img, image: placeholder }))
      result.push({ ...block, images: hydratedImages })
      continue
    }

    // countdown: endDate 佔位字串轉換
    if (block.blockType === 'countdown') {
      const endDate = block.endDate as string | undefined
      let resolvedEnd = endDate
      if (endDate === '__TEMPLATE_END_DATE_30D__') resolvedEnd = in30d
      else if (endDate === '__TEMPLATE_END_DATE_14D__') resolvedEnd = in14d
      result.push({ ...block, endDate: resolvedEnd })
      continue
    }

    result.push(block)
  }
  return result
}
