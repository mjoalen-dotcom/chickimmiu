/**
 * Seed CMS Data Script
 * ────────────────────
 * Populates all CMS globals and MembershipTiers with default data
 * matching the frontend fallback content.
 *
 * Usage: npx tsx scripts/seed-cms-data.ts
 */

import { createRequire } from 'module'
import path from 'path'

const require2 = createRequire(import.meta.url)
const DB_PATH = 'file:./data/chickimmiu.db'

function uid() {
  return Math.random().toString(36).slice(2, 10)
}

async function main() {
  const libsqlPath = path.resolve(
    'node_modules/.pnpm/@libsql+client@0.14.0/node_modules/@libsql/client',
  )
  const { createClient } = require2(libsqlPath)
  const db = createClient({ url: DB_PATH })
  const now = new Date().toISOString()

  console.log('🌱 Seeding CMS data...\n')

  // ══════════════════════════════════════════
  // 1. MembershipTiers
  // ══════════════════════════════════════════
  console.log('📊 Creating MembershipTiers...')
  const tiers = [
    { name: '普通會員', slug: 'ordinary', frontName: 'T0 優雅初遇者', frontSubtitle: '歡迎加入 CHIC KIM & MIU 大家庭', level: 0, minSpent: 0, annualSpentThreshold: 0, nextTierSlug: 'bronze', nextTierFrontName: '曦漾仙子', upgradeGiftPoints: 0, discountPercent: 0, pointsMultiplier: 1, freeShippingThreshold: 2000, lotteryChances: 0, birthdayGift: '生日贈點 100 點', color: '#9E9E9E' },
    { name: '銅牌會員', slug: 'bronze', frontName: 'T1 曦漾仙子', frontSubtitle: '您的時尚之旅正式展開', level: 1, minSpent: 3000, annualSpentThreshold: 0, nextTierSlug: 'silver', nextTierFrontName: '優漾女神', upgradeGiftPoints: 50, discountPercent: 3, pointsMultiplier: 1, freeShippingThreshold: 1500, lotteryChances: 1, birthdayGift: '生日贈點 200 點 + NT$50 購物金', color: '#CD7F32' },
    { name: '銀牌會員', slug: 'silver', frontName: 'T2 優漾女神', frontSubtitle: '優雅是您最美的代名詞', level: 2, minSpent: 10000, annualSpentThreshold: 5000, nextTierSlug: 'gold', nextTierFrontName: '金曦女王', upgradeGiftPoints: 100, discountPercent: 5, pointsMultiplier: 1.2, freeShippingThreshold: 1000, lotteryChances: 2, birthdayGift: '生日贈點 300 點 + NT$100 購物金 + 生日月 9 折', color: '#C0C0C0' },
    { name: '金牌會員', slug: 'gold', frontName: 'T3 金曦女王', frontSubtitle: '金色光芒照耀您的每一天', level: 3, minSpent: 30000, annualSpentThreshold: 15000, nextTierSlug: 'platinum', nextTierFrontName: '星耀皇后', upgradeGiftPoints: 200, discountPercent: 8, pointsMultiplier: 1.5, freeShippingThreshold: 500, lotteryChances: 3, birthdayGift: '生日贈點 500 點 + NT$200 購物金 + 生日月 85 折 + 專屬禮盒', color: '#FFD700' },
    { name: '白金會員', slug: 'platinum', frontName: 'T4 星耀皇后', frontSubtitle: '星光閃耀，尊榮非凡', level: 4, minSpent: 80000, annualSpentThreshold: 40000, nextTierSlug: 'diamond', nextTierFrontName: '璀璨天后', upgradeGiftPoints: 500, discountPercent: 10, pointsMultiplier: 2, freeShippingThreshold: 0, lotteryChances: 5, birthdayGift: '生日贈點 1000 點 + NT$500 購物金 + 生日月 8 折 + 專屬禮盒 + VIP 管家服務', color: '#E5E4E2' },
    { name: '鑽石會員', slug: 'diamond', frontName: 'T5 璀璨天后', frontSubtitle: '最尊貴的時尚女王', level: 5, minSpent: 200000, annualSpentThreshold: 100000, nextTierSlug: '', nextTierFrontName: '', upgradeGiftPoints: 1000, discountPercent: 15, pointsMultiplier: 2.5, freeShippingThreshold: 0, lotteryChances: 10, birthdayGift: '生日贈點 2000 點 + NT$1000 購物金 + 生日月 75 折 + 精品禮盒 + 專屬 VIP 管家 + 優先搶購', color: '#B9F2FF' },
  ]

  for (const t of tiers) {
    await db.execute({
      sql: `INSERT OR REPLACE INTO membership_tiers (name, slug, front_name, front_subtitle, level, min_spent, annual_spent_threshold, next_tier_slug, next_tier_front_name, upgrade_gift_points, discount_percent, points_multiplier, free_shipping_threshold, lottery_chances, birthday_gift, color, exclusive_coupon_enabled, updated_at, created_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      args: [t.name, t.slug, t.frontName, t.frontSubtitle, t.level, t.minSpent, t.annualSpentThreshold, t.nextTierSlug, t.nextTierFrontName, t.upgradeGiftPoints, t.discountPercent, t.pointsMultiplier, t.freeShippingThreshold, t.lotteryChances, t.birthdayGift, t.color, 0, now, now],
    })
  }
  console.log('  ✅ 6 tiers created\n')

  // ══════════════════════════════════════════
  // 2. NavigationSettings
  // ══════════════════════════════════════════
  console.log('🧭 Seeding NavigationSettings...')
  await db.execute({ sql: `DELETE FROM navigation_settings_main_menu_children`, args: [] })
  await db.execute({ sql: `DELETE FROM navigation_settings_main_menu`, args: [] })
  await db.execute({ sql: `DELETE FROM navigation_settings_footer_sections_links`, args: [] })
  await db.execute({ sql: `DELETE FROM navigation_settings_footer_sections`, args: [] })
  await db.execute({ sql: `DELETE FROM navigation_settings`, args: [] })

  await db.execute({
    sql: `INSERT INTO navigation_settings (id, updated_at, created_at, announcement_bar_enabled, announcement_bar_text, announcement_bar_style)
          VALUES (1, ?, ?, 1, ?, 'default')`,
    args: [now, now, '全館滿 $1,000 免運費 ♥ 新會員註冊即享 9 折'],
  })

  // Main menu items
  const mainMenu = [
    { label: '全部商品', href: '/products', children: [] },
    { label: '新品上市', href: '/products?tag=new', children: [] },
    { label: '熱銷推薦', href: '/products?tag=hot', children: [] },
    { label: '限時優惠', href: '/products?tag=sale', children: [] },
    { label: '主題精選', href: '#', children: [
      { label: '金老佛爺 Live', href: '/collections/jin-live' },
      { label: '金金同款專區', href: '/collections/jin-style' },
      { label: '主播同款專區', href: '/collections/host-style' },
      { label: '品牌自訂款', href: '/collections/brand-custom' },
      { label: '婚禮洋裝/正式洋裝', href: '/collections/formal-dresses' },
      { label: '現貨速到 Rush', href: '/collections/rush' },
      { label: '藝人穿搭', href: '/collections/celebrity-style' },
    ]},
    { label: '穿搭誌', href: '/blog', children: [] },
  ]

  for (let i = 0; i < mainMenu.length; i++) {
    const m = mainMenu[i]
    const mid = uid()
    await db.execute({
      sql: `INSERT INTO navigation_settings_main_menu (_order, _parent_id, id, label, href) VALUES (?, 1, ?, ?, ?)`,
      args: [i + 1, mid, m.label, m.href],
    })
    for (let j = 0; j < m.children.length; j++) {
      const c = m.children[j]
      await db.execute({
        sql: `INSERT INTO navigation_settings_main_menu_children (_order, _parent_id, id, label, href) VALUES (?, ?, ?, ?, ?)`,
        args: [j + 1, mid, uid(), c.label, c.href],
      })
    }
  }

  // Footer sections
  const footerSections = [
    { title: 'Help', links: [
      { label: '購物說明', href: '/shopping-guide' },
      { label: '商店介紹', href: '/about' },
      { label: '商品包裝', href: '/packaging' },
      { label: '服務條款', href: '/terms' },
      { label: '隱私權政策', href: '/privacy-policy' },
      { label: '退換貨政策', href: '/return-policy' },
      { label: '常見問題', href: '/faq' },
    ]},
    { title: '購物 / 會員', links: [
      { label: '全部商品', href: '/products' },
      { label: '新品上市', href: '/products?tag=new' },
      { label: '熱銷推薦', href: '/products?tag=hot' },
      { label: '穿搭誌', href: '/blog' },
      { label: '好運遊戲', href: '/games' },
      { label: '會員中心', href: '/account' },
      { label: '訂單查詢', href: '/account/orders' },
      { label: '訂閱方案', href: '/account/subscription' },
      { label: '推薦好友', href: '/account/referrals' },
    ]},
  ]

  for (let i = 0; i < footerSections.length; i++) {
    const s = footerSections[i]
    const sid = uid()
    await db.execute({
      sql: `INSERT INTO navigation_settings_footer_sections (_order, _parent_id, id, title) VALUES (?, 1, ?, ?)`,
      args: [i + 1, sid, s.title],
    })
    for (let j = 0; j < s.links.length; j++) {
      const l = s.links[j]
      await db.execute({
        sql: `INSERT INTO navigation_settings_footer_sections_links (_order, _parent_id, id, label, href) VALUES (?, ?, ?, ?, ?)`,
        args: [j + 1, sid, uid(), l.label, l.href],
      })
    }
  }
  console.log('  ✅ NavigationSettings seeded\n')

  // ══════════════════════════════════════════
  // 3. HomepageSettings
  // ══════════════════════════════════════════
  console.log('🏠 Seeding HomepageSettings...')
  await db.execute({ sql: `DELETE FROM homepage_settings_hero_banners`, args: [] })
  await db.execute({ sql: `DELETE FROM homepage_settings_quick_menu`, args: [] })
  await db.execute({ sql: `DELETE FROM homepage_settings_service_highlights`, args: [] })
  await db.execute({ sql: `DELETE FROM homepage_settings`, args: [] })

  await db.execute({
    sql: `INSERT INTO homepage_settings (id, updated_at, created_at,
      new_products_section_tag, new_products_section_title, new_products_section_href, new_products_section_limit, new_products_section_visible,
      hot_products_section_tag, hot_products_section_title, hot_products_section_href, hot_products_section_limit, hot_products_section_visible,
      brand_banner_visible, brand_banner_tagline, brand_banner_title, brand_banner_subtitle, brand_banner_cta_text, brand_banner_cta_link,
      style_journal_section_visible, style_journal_section_tag, style_journal_section_title, style_journal_section_href, style_journal_section_mode, style_journal_section_limit,
      ugc_section_visible, ugc_section_max_items,
      newsletter_section_visible, newsletter_section_tag, newsletter_section_title, newsletter_section_subtitle, newsletter_section_placeholder, newsletter_section_button_text,
      seo_meta_title, seo_meta_description)
    VALUES (1, ?, ?,
      'NEW IN', ?, '/products?tag=new', 8, 1,
      'BEST SELLERS', ?, '/products?tag=hot', 8, 1,
      1, 'SPECIAL EVENT', ?, ?, ?, '/products?tag=sale',
      1, 'STYLE JOURNAL', ?, '/blog', 'latest', 3,
      1, 12,
      1, 'STAY CONNECTED', ?, ?, 'your@email.com', ?,
      'CHIC KIM & MIU | 韓系女裝品牌', ?)`,
    args: [
      now, now,
      '新品上市',
      '熱銷推薦',
      '專屬你美好的\n時尚優雅', '精選百件春夏商品限時特惠，搶購你的命定單品！', '立即搶購',
      '穿搭誌',
      '訂閱最新消息', '搶先收到新品上市、限時優惠與專屬會員好禮通知', '訂閱',
      '融合極簡優雅與韓系活力的女裝品牌，精選韓國空運直送服飾。',
    ],
  })

  // Quick menu
  const quickMenu = [
    { label: '新品上市', href: '/products?tag=new', icon: 'Sparkles', color: 'text-gold-500' },
    { label: '訂閱方案', href: '/account/subscription', icon: 'Crown', color: 'text-purple-500' },
    { label: '好運遊戲', href: '/games', icon: 'Gamepad2', color: 'text-pink-500' },
    { label: '推薦好友', href: '/account/referrals', icon: 'Gift', color: 'text-green-500' },
  ]
  for (let i = 0; i < quickMenu.length; i++) {
    const q = quickMenu[i]
    await db.execute({
      sql: `INSERT INTO homepage_settings_quick_menu (_order, _parent_id, id, label, href, icon, color) VALUES (?, 1, ?, ?, ?, ?, ?)`,
      args: [i + 1, uid(), q.label, q.href, q.icon, q.color],
    })
  }

  // Service highlights
  const highlights = [
    { label: '滿額免運', desc: '一般會員滿 $2,000 免運費', icon: 'Truck' },
    { label: '7 天鑑賞期', desc: '不滿意可退換貨', icon: 'RefreshCw' },
    { label: '安全付款', desc: '多元金流加密保護', icon: 'Shield' },
    { label: '會員好禮', desc: '註冊即享專屬優惠', icon: 'Sparkles' },
  ]
  for (let i = 0; i < highlights.length; i++) {
    const h = highlights[i]
    await db.execute({
      sql: `INSERT INTO homepage_settings_service_highlights (_order, _parent_id, id, label, "desc", icon) VALUES (?, 1, ?, ?, ?, ?)`,
      args: [i + 1, uid(), h.label, h.desc, h.icon],
    })
  }
  console.log('  ✅ HomepageSettings seeded\n')

  // ══════════════════════════════════════════
  // 4. AboutPageSettings
  // ══════════════════════════════════════════
  console.log('📖 Seeding AboutPageSettings...')
  await db.execute({ sql: `DELETE FROM about_page_settings_brand_values`, args: [] })
  await db.execute({ sql: `DELETE FROM about_page_settings_timeline`, args: [] })
  await db.execute({ sql: `DELETE FROM about_page_settings_contact_cta_buttons`, args: [] })
  await db.execute({ sql: `DELETE FROM about_page_settings`, args: [] })

  const brandStory = `CHIC KIM & MIU（亦稱 CKMU）創立於對時尚與品質的熱情。品牌名稱蘊含三層意義：Chic（時尚優雅）、Kind（溫柔善良）、Mindful（用心講究），這正是我們希望傳遞給每一位女性的穿搭理念。

我們的商品主要與韓國及台灣優質廠商合作，透過自製、採購、研發等方式，從首爾空運直送台灣。每一件服飾都經過嚴格篩選，確保版型、質感與細節能完美呈現韓系穿搭的精緻風格。

從一間小小的網路商店到如今的品牌規模，CKMU 始終堅持初心 — 讓每位女性都能輕鬆擁有高品質的日韓時裝，在生活中展現專屬的自信與魅力。`

  await db.execute({
    sql: `INSERT INTO about_page_settings (id, updated_at, created_at,
      hero_subtitle, hero_title, hero_description,
      brand_story_title, brand_story_content_fallback,
      contact_cta_title, contact_cta_description,
      seo_title, seo_description)
    VALUES (1, ?, ?,
      'About Us', ?, ?,
      ?, ?,
      ?, ?,
      ?, ?)`,
    args: [
      now, now,
      '商店介紹', 'Chic, Kind & Mindful — 為每位女性打造優雅與可愛兼具的穿搭風格',
      '品牌故事', brandStory,
      '與我們聯繫', '無論是商品諮詢、合作洽談、還是穿搭建議，歡迎隨時透過以下方式聯繫我們。',
      '商店介紹 | CHIC KIM & MIU', '認識 CHIC KIM & MIU — 融合極簡優雅與韓系活力的女裝品牌',
    ],
  })

  // Brand values
  const brandValues = [
    { icon: 'sparkles', title: '精選品質', description: '每一件商品皆經過嚴格篩選，與韓國及台灣優質廠商合作，確保質感與細節達到最高標準。' },
    { icon: 'globe', title: '韓國直送', description: '商品主要由韓國空運直送台灣，緊跟首爾最新流行趨勢，讓您第一時間穿上當季款式。' },
    { icon: 'heart', title: '貼心服務', description: '提供工作室預約試穿、專屬客服、LINE 即時諮詢，打造溫暖且專業的購物體驗。' },
    { icon: 'users', title: '會員經營', description: '六大會員等級制度，從購物金、生日禮到專屬優惠，每一位顧客都是我們珍視的家人。' },
    { icon: 'shield', title: '安心保障', description: '完善退換貨機制、電子發票系統、信用卡安全交易，讓您安心購物沒有後顧之憂。' },
    { icon: 'truck', title: '快速到貨', description: '現貨商品最快隔日出貨，預購商品清楚標示到貨時間，讓等待也成為期待的一部分。' },
  ]
  for (let i = 0; i < brandValues.length; i++) {
    const v = brandValues[i]
    await db.execute({
      sql: `INSERT INTO about_page_settings_brand_values (_order, _parent_id, id, icon, title, description) VALUES (?, 1, ?, ?, ?, ?)`,
      args: [i + 1, uid(), v.icon, v.title, v.description],
    })
  }

  // Timeline
  const timeline = [
    { year: '2018', title: '品牌創立', description: '從一間小小的網路商店開始，以「讓每位女性都能輕鬆擁有韓系質感穿搭」為初心出發。' },
    { year: '2019', title: '工作室開設', description: '於台北開設品牌工作室，提供預約試穿服務，讓顧客親身感受衣物質感。' },
    { year: '2020', title: '品牌升級', description: '推出會員制度與訂閱方案，建立更完整的品牌體驗與顧客回饋系統。' },
    { year: '2022', title: '跨境合作', description: '與更多韓國設計師品牌及優質工廠建立直接合作關係，拓展商品線。' },
    { year: '2024', title: '全新官網', description: '全面升級官方網站，導入 AI 穿搭推薦、互動遊戲、CRM 會員經營等創新功能。' },
  ]
  for (let i = 0; i < timeline.length; i++) {
    const t = timeline[i]
    await db.execute({
      sql: `INSERT INTO about_page_settings_timeline (_order, _parent_id, id, year, title, description) VALUES (?, 1, ?, ?, ?, ?)`,
      args: [i + 1, uid(), t.year, t.title, t.description],
    })
  }

  // Contact CTA buttons
  const ctaButtons = [
    { label: 'LINE 客服 @ckmu', url: 'https://page.line.me/nqo0262k?openQrModal=true', style: 'line', external: 1 },
    { label: '購物說明', url: '/shopping-guide', style: 'outline', external: 0 },
    { label: 'Instagram', url: 'https://www.instagram.com/chickimmiu/', style: 'outline', external: 1 },
  ]
  for (let i = 0; i < ctaButtons.length; i++) {
    const b = ctaButtons[i]
    await db.execute({
      sql: `INSERT INTO about_page_settings_contact_cta_buttons (_order, _parent_id, id, label, url, style, external) VALUES (?, 1, ?, ?, ?, ?, ?)`,
      args: [i + 1, uid(), b.label, b.url, b.style, b.external],
    })
  }
  console.log('  ✅ AboutPageSettings seeded\n')

  // ══════════════════════════════════════════
  // 5. FAQPageSettings
  // ══════════════════════════════════════════
  console.log('❓ Seeding FAQPageSettings...')
  await db.execute({ sql: `DELETE FROM faq_page_settings_categories_items`, args: [] })
  await db.execute({ sql: `DELETE FROM faq_page_settings_categories`, args: [] })
  await db.execute({ sql: `DELETE FROM faq_page_settings`, args: [] })

  await db.execute({
    sql: `INSERT INTO faq_page_settings (id, updated_at, created_at,
      hero_title, hero_description,
      contact_cta_title, contact_cta_description,
      seo_title, seo_description)
    VALUES (1, ?, ?,
      ?, ?,
      ?, ?,
      ?, ?)`,
    args: [
      now, now,
      '常見問題', '快速找到您需要的答案',
      '還是找不到答案？', '歡迎直接聯繫我們的客服團隊，我們很樂意為您解答任何問題。',
      '常見問題 FAQ | CHIC KIM & MIU', '關於訂購、配送、退換貨、付款、會員等常見問題解答',
    ],
  })

  const faqCategories = [
    { icon: 'shopping-bag', title: '訂購相關', items: [
      { q: '如何下單購買？', a: '瀏覽商品後選擇顏色與尺寸，加入購物車，進入結帳頁面填寫收件資訊與付款方式即可完成訂購。支援信用卡、LINE Pay、ATM 轉帳等多種付款方式。' },
      { q: '可以修改或取消訂單嗎？', a: '訂單成立後若需修改或取消，請儘速透過 LINE 客服（@ckmu）聯繫我們。若訂單尚未出貨，我們將盡力協助處理；若已出貨則需等待收件後申請退貨。' },
      { q: '有提供預約試穿嗎？', a: '是的！我們的工作室提供預約試穿服務。請透過 LINE 客服（@ckmu）提供想試穿的款式、顏色、尺寸，我們將依庫存為您安排專屬試穿時段。' },
      { q: '預購商品多久會到貨？', a: '預購商品通常需要 7-14 個工作天（不含假日）。每件商品頁面會標示預估到貨時間，空運期間若遇天候因素可能略有延遲，我們會即時通知更新進度。' },
    ]},
    { icon: 'truck', title: '配送相關', items: [
      { q: '運費怎麼計算？', a: '單筆訂單滿 NT$1,000 即享免運。未達免運門檻，宅配運費為 NT$100，超商取貨為 NT$70。部分特殊商品或離島地區可能另有費用，請參閱購物說明。' },
      { q: '有哪些配送方式？', a: '目前提供宅配到府（黑貓/大榮）與超商取貨（7-11、全家、萊爾富、OK）兩種方式。結帳時可自行選擇偏好的配送方式。' },
      { q: '多久會出貨？', a: '現貨商品於付款完成後 1-2 個工作天內出貨。預購商品依商品頁面標示的到貨時間為準。週末與國定假日順延。' },
      { q: '可以追蹤包裹進度嗎？', a: '可以！商品出貨後我們會發送出貨通知（含追蹤碼），您也可以在會員中心的「我的訂單」頁面隨時查看物流狀態。' },
    ]},
    { icon: 'rotate-ccw', title: '退換貨相關', items: [
      { q: '可以退換貨嗎？', a: '依照消保法規定，您享有收到商品後 7 天內的鑑賞期。商品須保持全新未穿著、吊牌完整、原包裝未拆封的狀態方可申請退換貨。' },
      { q: '如何申請退換貨？', a: '請至會員中心的「退換貨」頁面提交申請，或透過 LINE 客服（@ckmu）聯繫。我們收到申請後將於 1-2 個工作天內回覆處理方式。' },
      { q: '退款多久會收到？', a: '退貨商品經檢查確認無誤後，信用卡退款約 5-10 個工作天（依各銀行作業時間）；ATM/匯款退款約 3-5 個工作天入帳。' },
      { q: '哪些情況不能退貨？', a: '已穿著洗滌、吊牌剪除、人為損壞、個人衛生用品（如內衣褲、泳裝）、客製化商品等，恕無法受理退貨。詳細說明請參閱退換貨政策頁面。' },
    ]},
    { icon: 'credit-card', title: '付款相關', items: [
      { q: '有哪些付款方式？', a: '我們支援信用卡（VISA/Mastercard/JCB）、LINE Pay、Apple Pay、ATM 虛擬帳號轉帳、超商代碼繳費等多種付款方式。' },
      { q: '可以開立電子發票嗎？', a: '所有訂單均開立電子發票。發票會自動存入您的會員帳戶，您可以在「電子發票」頁面查看、下載或列印。如需統一編號請在結帳時填寫。' },
      { q: '付款安全嗎？', a: '我們使用符合 PCI-DSS 安全標準的第三方金流服務，所有交易資料均經 SSL 加密傳輸，不儲存任何信用卡資訊，請安心交易。' },
    ]},
    { icon: 'star', title: '會員制度', items: [
      { q: '如何加入會員？', a: '點擊右上角的會員圖示即可免費註冊。支援 Google、Facebook、LINE 社群帳號快速登入，也可以使用 Email 註冊。新會員立即享有歡迎優惠！' },
      { q: '會員等級怎麼計算？', a: '我們設有六大會員等級（一般/銅牌/銀牌/金牌/白金/鑽石），依據累積消費金額自動升等。每個等級享有不同的折扣、點數倍率、免運門檻等專屬福利。' },
      { q: '購物金/點數怎麼用？', a: '消費即可累積購物點數，點數可在下次結帳時折抵現金。每 100 點 = NT$1。點數有效期限為 365 天，可在「點數/購物金」頁面查看餘額與到期時間。' },
      { q: '有生日禮嗎？', a: '有！壽星月份會收到專屬生日禮，包含生日點數加倍、專屬折扣券、以及依會員等級不同的生日驚喜好禮。請確保帳戶中有填寫正確的生日日期。' },
    ]},
    { icon: 'gift', title: '其他問題', items: [
      { q: '商品尺寸怎麼選？', a: '每件商品頁面都附有詳細尺寸表（胸圍、腰圍、肩寬、衣長等）。如果您不確定，歡迎透過 LINE 客服提供您的身高體重，我們可以為您推薦合適的尺寸。' },
      { q: '商品顏色會有色差嗎？', a: '我們盡力讓商品照片呈現最真實的顏色，但因拍攝光線與螢幕顯示設定不同，實際商品可能會有些微色差，這屬正常現象，敬請理解。' },
      { q: '如何聯繫客服？', a: '您可以透過 LINE 官方帳號（@ckmu）聯繫我們，服務時間為週一至週五 10:00-18:00。也歡迎在 Instagram（@chickimmiu）私訊留言，我們會盡快回覆。' },
    ]},
  ]

  for (let i = 0; i < faqCategories.length; i++) {
    const cat = faqCategories[i]
    const catId = uid()
    await db.execute({
      sql: `INSERT INTO faq_page_settings_categories (_order, _parent_id, id, icon, title) VALUES (?, 1, ?, ?, ?)`,
      args: [i + 1, catId, cat.icon, cat.title],
    })
    for (let j = 0; j < cat.items.length; j++) {
      const item = cat.items[j]
      await db.execute({
        sql: `INSERT INTO faq_page_settings_categories_items (_order, _parent_id, id, question, answer) VALUES (?, ?, ?, ?, ?)`,
        args: [j + 1, catId, uid(), item.q, item.a],
      })
    }
  }
  console.log('  ✅ FAQPageSettings seeded\n')

  // ══════════════════════════════════════════
  // 6. PolicyPagesSettings
  // ══════════════════════════════════════════
  console.log('📋 Seeding PolicyPagesSettings...')
  await db.execute({ sql: `DELETE FROM policy_pages_settings_terms_sections_items`, args: [] })
  await db.execute({ sql: `DELETE FROM policy_pages_settings_terms_sections`, args: [] })
  await db.execute({ sql: `DELETE FROM policy_pages_settings_privacy_policy_sections_items`, args: [] })
  await db.execute({ sql: `DELETE FROM policy_pages_settings_privacy_policy_sections`, args: [] })
  await db.execute({ sql: `DELETE FROM policy_pages_settings_return_policy_sections_items`, args: [] })
  await db.execute({ sql: `DELETE FROM policy_pages_settings_return_policy_sections`, args: [] })
  await db.execute({ sql: `DELETE FROM policy_pages_settings_shopping_guide_sections_items`, args: [] })
  await db.execute({ sql: `DELETE FROM policy_pages_settings_shopping_guide_sections`, args: [] })
  await db.execute({ sql: `DELETE FROM policy_pages_settings`, args: [] })

  await db.execute({
    sql: `INSERT INTO policy_pages_settings (id, updated_at, created_at,
      terms_page_title, terms_en_title, terms_effective_date, terms_version, terms_seo_title, terms_seo_description,
      privacy_policy_page_title, privacy_policy_en_title, privacy_policy_effective_date, privacy_policy_version, privacy_policy_seo_title, privacy_policy_seo_description,
      return_policy_page_title, return_policy_en_title, return_policy_effective_date, return_policy_version, return_policy_seo_title, return_policy_seo_description,
      shopping_guide_page_title, shopping_guide_en_title, shopping_guide_effective_date, shopping_guide_version, shopping_guide_seo_title, shopping_guide_seo_description)
    VALUES (1, ?, ?,
      ?, 'Terms of Service', '2026年4月12日', '1.0', ?, ?,
      ?, 'Privacy Policy', '2026年4月12日', '1.0', ?, ?,
      ?, 'Return & Exchange Policy', '2026年4月12日', '1.1', ?, ?,
      ?, 'Shopping Guide', '2026年4月12日', '1.0', ?, ?)`,
    args: [
      now, now,
      '服務條款', '服務條款 | CHIC KIM & MIU', 'CHIC KIM & MIU 服務條款 — 會員權益、購物規範、智慧財產權等完整說明',
      '隱私權政策', '隱私權政策 | CHIC KIM & MIU', 'CHIC KIM & MIU 隱私權政策 — 個人資料收集、使用、保護之完整說明',
      '退換貨政策', '退換貨政策 | CHIC KIM & MIU', 'CHIC KIM & MIU 退換貨政策 — 退貨條件、換貨流程、退款說明',
      '購物說明', '購物說明 | CHIC KIM & MIU', 'CHIC KIM & MIU 購物說明 — 商品來源、工作室試穿、配送與預購資訊',
    ],
  })

  // ── Terms sections ──
  const termsSections: { title: string; content?: string; items?: string[] }[] = [
    { title: '一、接受條款', content: '歡迎使用 CHIC KIM & MIU 網站及相關服務。本服務條款構成您與靚秀國際有限公司之間的法律協議。您使用本網站、註冊會員或購買商品，即視為您已閱讀、瞭解並同意本條款全部內容。' },
    { title: '二、會員註冊與帳號', items: [
      '您必須年滿二十歲或已取得法定監護人同意方可註冊。',
      '您同意提供真實、正確、完整的個人資料，並隨時更新。',
      '本公司保留拒絕、暫停或終止異常帳號的權利。',
    ]},
    { title: '三、購物與訂單', items: [
      '商品價格以本網站公告為準，含稅但不含運費。',
      '訂單成立後不得任意取消，退換貨請依本公司退換貨政策辦理。',
      '綠界電子發票將於訂單確認後自動開立並寄送。',
    ]},
    { title: '四、會員權益與忠誠度', items: [
      '本公司提供會員等級、點數、信用分數、訂閱會員、推薦計畫等忠誠度機制。',
      '點數有到期機制，信用分數會因退貨、棄單等行為扣分，嚴重者可能列入黑名單或停權。',
      '所有獎勵以系統紀錄為準，本公司保留最終解釋權。',
    ]},
    { title: '五、智慧財產權', content: '本網站所有內容（文字、圖片、影片、設計、遊戲）均為本公司或授權人所有，未經書面同意不得使用、複製或公開傳播。' },
    { title: '六、責任限制', content: '本公司盡力提供穩定服務，但不保證完全無中斷或錯誤。對於因不可抗力、系統維護或第三人行為造成之損失，本公司不負賠償責任。' },
    { title: '七、準據法與管轄法院', content: '本條款以中華民國法律為準據法。因本條款所生之爭議，以台灣台北地方法院為第一審管轄法院。' },
    { title: '八、條款修改', content: '本公司保留隨時修改本條款之權利，修改後將於網站公告，繼續使用即視為同意新條款。' },
  ]

  await seedPolicySections(db, 'terms', termsSections)

  // ── Privacy Policy sections ──
  const privacySections: { title: string; content?: string; items?: string[] }[] = [
    { title: '一、適用範圍', content: '本政策適用於 CHIC KIM & MIU 網站、APP、LINE 官方帳號及所有相關服務。' },
    { title: '二、收集的個人資料', content: '我們可能收集以下類型的個人資料：', items: [
      '基本資料：姓名、性別、生日、電話、Email、地址',
      '會員資料：身高、體重、身形、偏好類別、尺寸、顏色',
      '交易資料：訂單、發票、付款紀錄、退換貨紀錄',
      '行為資料：瀏覽、購買、遊戲參與、UGC 內容',
      '社群登入資料：LINE、Facebook、Google 授權資料',
      '信用分數與標籤：系統自動產生之信用分數與行為標籤',
    ]},
    { title: '三、使用目的', content: '我們收集您的個人資料，用於以下目的：', items: [
      '提供購物／會員／客服／物流／發票等服務',
      '進行 AI 個人化推薦／尺寸建議／智能加購',
      '執行忠誠度計畫（點數、等級、推薦、信用分數）',
      '行銷活動（生日、節慶、VIP 管家服務）',
      '改善網站／分析行為／優化廣告',
    ]},
    { title: '四、資料分享', content: '我們僅在以下情況分享您的個人資料：', items: [
      '與綠界／金流／物流合作夥伴（必要時）',
      '與 Meta／Google 等廣告平台（匿名化後）',
      '法律要求或政府機關依法要求時',
    ]},
    { title: '五、您的權利', content: '依照個人資料保護法，您有查詢、閱覽、複製、補充、更正、停止處理、刪除等權利。' },
    { title: '六、Cookie 與追蹤技術', content: '我們使用 Cookie、Google Tag Manager、Meta Pixel 等技術。您可隨時在 Cookie Consent Banner 中調整設定。' },
    { title: '七、資料安全', content: '我們採用適當技術與管理措施保護您的個人資料。' },
    { title: '八、政策修改', content: '本公司保留修改本政策之權利，修改後將於網站公告。' },
  ]

  await seedPolicySections(db, 'privacy_policy', privacySections)

  // ── Return Policy sections ──
  const returnSections: { title: string; content?: string; items?: string[] }[] = [
    { title: '一、適用範圍', content: '適用於 CHIC KIM & MIU 官方網站完成之網路訂單。門市、工作室等非通訊交易方式購買之商品，原則上不適用本網站之通訊交易退貨權益。' },
    { title: '二、退貨權益說明', items: [
      '依消保法，收受商品次日起 7 日內可解除契約。',
      '另提供 14 天安心退貨服務。',
      '以物流送達／超商取貨／簽收之次日起算。',
    ]},
    { title: '三、退貨／換貨申請方式', content: '請聯繫客服提供以下資訊：訂單編號、收件人姓名、聯絡電話、退貨／換貨原因、瑕疵照片／影片。\n⚠️ 未經客服確認即自行寄回者得不受理。' },
    { title: '四、可受理退貨／換貨之條件', items: [
      '商品為全新狀態。',
      '原包裝／吊牌／標籤／配件／贈品／發票完整。',
      '無人為污損／異味。',
      '未經修改／裁剪。',
    ]},
    { title: '五、以下情形恕不受理退換貨', items: [
      '超過 14 天安心退貨期限。',
      '福利品／出清品（購買時已註明不退換）。',
      '泳衣／貼身衣物（基於衛生考量）。',
      '鞋類已於室外穿著或鞋底已磨損。',
      '吊牌已拆除或遺失。',
      '已使用／已下水洗滌。',
      '反覆退貨／棄單之異常行為帳號。',
      '於實體場域（工作室）確認後購買之商品。',
      '其他經客服判定不符退換貨條件之情形。',
    ]},
    { title: '六、非瑕疵範圍說明', content: '以下情況屬正常範圍，不視為瑕疵：', items: [
      '尺寸誤差在合理範圍內（約 1-3 cm）。',
      '螢幕色差（因不同螢幕顯示略有差異）。',
      '線頭／輕微壓痕（運送過程中可能產生）。',
      '新品氣味（新製品可能帶有輕微味道，清洗後即消退）。',
      '極輕微細節差異（手工製品之自然特性）。',
    ]},
    { title: '七、瑕疵商品或寄錯商品', content: '收貨後請儘速聯繫客服，建議 48 小時內提供照片／影片。經客服確認後，將協助換貨／補寄／退款處理。' },
    { title: '八、換貨說明', content: '請先聯繫客服確認庫存，換貨以同款有現貨為限。若無庫存則改以退款方式處理。' },
    { title: '九、退款說明', items: [
      '收到退回商品確認後，依原付款方式退款。',
      '信用卡付款將退回原信用卡帳戶。',
      '使用折扣／贈品／優惠後退貨，可能重新計算退款金額。',
      '不符退貨條件者，商品將退回寄件人，並酌收運費。',
    ]},
  ]

  await seedPolicySections(db, 'return_policy', returnSections)

  // ── Shopping Guide sections ──
  const shoppingSections: { title: string; content?: string; items?: string[] }[] = [
    { title: '商品來源', content: '我們的服飾商品主要和台灣與韓國廠商合作分成、自製、採購、研發，主要韓國直接空運來台，於每項商品頁面中也會註明來源。', items: [
      '為了不耽誤您的重要時刻及精緻形象，我們提供了工作室的專屬試穿服務，讓您可以實際體驗服飾質感。',
      '如您有試穿需求歡迎聯繫客服 Line / @ckmu，提供想試穿『款式、顏色、尺寸』，將依工作室庫存為主為您預約專屬服務哦。',
    ]},
    { title: '工作室資訊', content: '臺北市信義區基隆路一段68號9樓(京華大樓)', items: [
      '一三五：10:00-12:00、13:30-16:30',
      '二五：13:30-16:30',
      '此服務項目須先預約，請先向客服申請試穿款式及時段，請勿自行前往。',
    ]},
    { title: '交通方式', content: '捷運、公車、開車、YouBike 均可到達。', items: [
      '捷運板南線（藍線）：搭至市政府站（出口3），步行約 8-10 分鐘。',
      '捷運松山新店線（綠線）：搭至南京三民站（出口3），步行約 10-12 分鐘。',
      '公車「基隆路口二」或「東興路」下車：藍10、612、277、279、46、藍26。',
      '開車：國道 1 號 → 建國高架道路 → 基隆路出口下交流道。',
      '停車場：日月亭台泥基隆路場（步行約 2 分鐘）、正氣橋下停車場（步行約 2 分鐘）。',
      'YouBike：東興路口站（步行約 5 分鐘）。',
    ]},
    { title: '預購時間', items: [
      '預購商品正常追加時間為 7-14 天（不含假日）。',
      '預購商品如遇到原物料缺貨或者其他不可控制因素導致交期延後發生，請見諒。',
      '由於韓國換貨速度很快，若遇斷貨狀況，實在很抱歉，我們會主動聯繫您，若三天內未回覆，商品金額將轉為購物金，若需退款請找客服中心聯絡，我們會盡快處理退款事宜。',
    ]},
  ]

  await seedPolicySections(db, 'shopping_guide', shoppingSections)

  console.log('  ✅ PolicyPagesSettings seeded\n')

  // ── 7. Update admin user role ──
  console.log('👤 Ensuring admin user role...')
  await db.execute("UPDATE users SET role='admin' WHERE id=1")
  const user = await db.execute("SELECT id, email, role FROM users WHERE id=1")
  if (user.rows.length > 0) {
    console.log(`  ✅ User: ${(user.rows[0] as any).email} → role: ${(user.rows[0] as any).role}\n`)
  }

  console.log('🎉 Seed complete!')
  process.exit(0)
}

async function seedPolicySections(
  db: any,
  prefix: string,
  sections: { title: string; content?: string; items?: string[] }[],
) {
  const sectionsTable = `policy_pages_settings_${prefix}_sections`
  const itemsTable = `policy_pages_settings_${prefix}_sections_items`

  for (let i = 0; i < sections.length; i++) {
    const s = sections[i]
    const sid = uid()
    await db.execute({
      sql: `INSERT INTO ${sectionsTable} (_order, _parent_id, id, title, content) VALUES (?, 1, ?, ?, ?)`,
      args: [i + 1, sid, s.title, s.content || ''],
    })
    if (s.items) {
      for (let j = 0; j < s.items.length; j++) {
        await db.execute({
          sql: `INSERT INTO ${itemsTable} (_order, _parent_id, id, text) VALUES (?, ?, ?, ?)`,
          args: [j + 1, sid, uid(), s.items[j]],
        })
      }
    }
  }
}

main().catch((e) => {
  console.error('❌ Seed failed:', e)
  process.exit(1)
})
