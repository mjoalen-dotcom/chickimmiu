import type { HoroscopeContent, HoroscopeGenInput } from './types'
import type { HoroscopeGender, ZodiacSign } from './zodiac'

/**
 * Static fallback horoscopes — 12 signs × 2 genders = 24 entries.
 *
 * Used when:
 *   - HOROSCOPE_LLM_PROVIDER env var is unset or 'seed'
 *   - LLM call fails or times out (graceful degradation)
 *
 * Date-independence is intentional: this is just a stub. PR-B (Groq) replaces
 * the runtime call site; this file remains as the always-available fallback so
 * the dashboard never shows an empty horoscope card.
 *
 * Style keywords MUST come from STYLE_KEYWORDS_VOCAB (see ./types.ts).
 * Lucky colors are free-text (we don't query products by color directly).
 */

type SeedKey = `${ZodiacSign}_${HoroscopeGender}`

const SEED: Record<SeedKey, HoroscopeContent> = {
  // ─── 牡羊座 Aries ───
  aries_female: {
    workFortune: '今日衝勁十足，適合主動爭取新專案；同事的提議別急著反對，先聽完再決定。',
    relationshipFortune: '與閨蜜聚會能聊出意想不到的點子，適度展現你的熱情會贏得欣賞。',
    moneyFortune: '小額投資宜守，避免衝動下單高單價物品；午後可關注既有規劃。',
    cautionFortune: '說話速度放慢一些，避免因急性子讓對方覺得壓力大。',
    outfitAdvice: '今日宜以俐落剪裁配上一抹明亮色點綴，展現果決中帶柔的女性氣質。',
    luckyColors: ['磚紅', '象牙白'],
    styleKeywords: ['celebrity-style', 'jin-style'],
  },
  aries_male: {
    workFortune: '行動力滿格，適合推進卡關已久的提案；用簡報精準收尾比長篇大論更有效。',
    relationshipFortune: '主動釋出善意能化解小摩擦，朋友圈中你的決斷力備受信任。',
    moneyFortune: '理財宜攻守平衡，避免被一時熱潮帶走；長線標的優於短線跟風。',
    cautionFortune: '注意開車或騎車速度，下午有小擦傷或扭傷的可能。',
    outfitAdvice: '建議乾淨修身的版型搭配深色配件，用低調的銳利感表達自信。',
    luckyColors: ['深海藍', '黑色'],
    styleKeywords: ['brand-custom', 'host-style'],
  },

  // ─── 金牛座 Taurus ───
  taurus_female: {
    workFortune: '穩紮穩打的一天，適合處理需要細心比對的工作；下午會有貴人主動詢問你的進度。',
    relationshipFortune: '溫柔的傾聽會比熱情的回應更受好評，朋友間隱藏的小心事會浮現。',
    moneyFortune: '財運平穩，宜記帳檢視月支出；長期定存或基金可考慮加碼一筆。',
    cautionFortune: '注意飲食節制，下午容易被點心誘惑導致悶脹不適。',
    outfitAdvice: '柔軟材質與大地色系是今日加分項，用一件溫潤的洋裝凸顯你的優雅。',
    luckyColors: ['象牙白', '粉色'],
    styleKeywords: ['formal-dresses', 'celebrity-style'],
  },
  taurus_male: {
    workFortune: '專注力強，適合處理需要深度思考的決策；別讓臨時插隊的雜事打斷節奏。',
    relationshipFortune: '另一半希望被認真聆聽而非急著解決問題，先給予共鳴再給建議。',
    moneyFortune: '保守投資為主，可檢視保險或退休規劃；衝動消費今日要克制。',
    cautionFortune: '注意肩頸僵硬與久坐，安排短暫起身活動可避免下午無精打采。',
    outfitAdvice: '經典剪裁的素色襯衫配深色長褲，溫潤紳士感最契合你今日的氣場。',
    luckyColors: ['深海藍', '白色'],
    styleKeywords: ['brand-custom', 'jin-style'],
  },

  // ─── 雙子座 Gemini ───
  gemini_female: {
    workFortune: '靈感豐富，適合腦力激盪型會議；多元觀點能讓你脫穎而出。',
    relationshipFortune: '社交運活躍，新朋友會主動找你聊天；別忘了傾聽是最佳魅力。',
    moneyFortune: '財運起伏小，宜分散風險；訂閱費用建議今日盤點刪除冗餘。',
    cautionFortune: '注意言多必失，敏感話題下午過後再聊比較安全。',
    outfitAdvice: '輕盈飄逸的層次穿搭最能展現你的活潑，搭配一件亮色配件加分。',
    luckyColors: ['粉色', '黑色'],
    styleKeywords: ['rush', 'host-style'],
  },
  gemini_male: {
    workFortune: '溝通運佳，適合進行客戶簡報或跨部門協調；條理清晰是今日關鍵。',
    relationshipFortune: '幽默感是你的武器，但避開敏感議題以免一句玩笑造成誤會。',
    moneyFortune: '可關注短期波段機會，但設好停損；衝動跟單會吃虧。',
    cautionFortune: '留意網路訊息真偽，下午容易因誤信轉發資訊踩雷。',
    outfitAdvice: '層次感的休閒西裝配亮色 T 恤，自在中帶著正式感是今日上選。',
    luckyColors: ['深海藍', '象牙白'],
    styleKeywords: ['celebrity-style', 'brand-custom'],
  },

  // ─── 巨蟹座 Cancer ───
  cancer_female: {
    workFortune: '直覺準確，適合處理需要同理心的對外溝通；同事的求助別猶豫，幫一把會帶來機會。',
    relationshipFortune: '家人間的小事容易放大，給彼此一點空間，傍晚會自然修復。',
    moneyFortune: '宜守不宜攻，可整理發票申請發票對獎或回饋。',
    cautionFortune: '情緒起伏較大，避免在深夜做重要決定。',
    outfitAdvice: '柔美溫柔的洋裝配上珠光配件，適合展現你纖細的女性氣質。',
    luckyColors: ['象牙白', '粉色'],
    styleKeywords: ['formal-dresses', 'jin-style'],
  },
  cancer_male: {
    workFortune: '今日適合靜下心整理長期專案的進度，避免被臨時任務拉走主軸。',
    relationshipFortune: '伴侶或家人需要你的安全感，少給建議多給陪伴。',
    moneyFortune: '保守為宜，宜檢視月度開銷；房貸或保單可順手復盤。',
    cautionFortune: '腸胃較敏感，避免冰飲與重口味；早睡有助情緒穩定。',
    outfitAdvice: '溫和色系搭配舒適剪裁的針織衫，散發溫柔可靠的氣場。',
    luckyColors: ['白色', '深海藍'],
    styleKeywords: ['brand-custom', 'jin-style'],
  },

  // ─── 獅子座 Leo ───
  leo_female: {
    workFortune: '舞台運強，適合主導會議或上台簡報；自信是你今日最美的妝容。',
    relationshipFortune: '朋友圈會主動聚集到你身邊，記得分享榮耀也讓夥伴有光。',
    moneyFortune: '可考慮品牌單品的長期投資，但別因衝動買整套；先比較材質再下手。',
    cautionFortune: '注意過度自信導致忽略細節，重要文件再核對一次。',
    outfitAdvice: '一件大膽剪裁的洋裝就足以驚艷全場，金色配件能凸顯王者氣場。',
    luckyColors: ['磚紅', '象牙白'],
    styleKeywords: ['formal-dresses', 'celebrity-style'],
  },
  leo_male: {
    workFortune: '領導力突出，適合啟動新計畫；用願景說服團隊比細節說明更有效。',
    relationshipFortune: '展現你的關懷而非威嚴，伴侶今日希望感受到柔軟的你。',
    moneyFortune: '可投入有品牌價值的長期標的，但避免高槓桿；謹守風險上限。',
    cautionFortune: '別讓「面子」干擾判斷，需要時主動承認小錯反而會贏得尊重。',
    outfitAdvice: '剪裁俐落的西裝外套配深色內搭，散發成熟領袖氣息。',
    luckyColors: ['黑色', '磚紅'],
    styleKeywords: ['brand-custom', 'host-style'],
  },

  // ─── 處女座 Virgo ───
  virgo_female: {
    workFortune: '細節控的優勢今日盡顯，適合校對、報表、流程優化等任務。',
    relationshipFortune: '別把高標準套在朋友身上，多給一點寬容會讓關係更深。',
    moneyFortune: '理財運佳，適合做月度結算與下季預算規劃。',
    cautionFortune: '注意過度焦慮，給自己十分鐘冥想或散步能重整心情。',
    outfitAdvice: '簡約乾淨的線條配上一件質感配件，是你今日的優雅密碼。',
    luckyColors: ['白色', '象牙白'],
    styleKeywords: ['celebrity-style', 'brand-custom'],
  },
  virgo_male: {
    workFortune: '分析力強，適合處理需要邏輯推導的問題；避免陷入完美主義拖延進度。',
    relationshipFortune: '伴侶需要的不是建議而是肯定，先給情緒支持再給解法。',
    moneyFortune: '宜檢視訂閱與保單支出，不必要的小額消費累積起來可能驚人。',
    cautionFortune: '注意眼睛疲勞，下午多看遠方放鬆視神經。',
    outfitAdvice: '極簡風格的單色系穿搭，配上俐落皮鞋是你今日的最強組合。',
    luckyColors: ['深海藍', '黑色'],
    styleKeywords: ['brand-custom', 'jin-style'],
  },

  // ─── 天秤座 Libra ───
  libra_female: {
    workFortune: '協調力強，適合擔任會議主持或跨部門橋樑角色；保持中立會贏得信任。',
    relationshipFortune: '社交運高，朋友邀約多但別貪心，留時間給最在意的人。',
    moneyFortune: '財運中性，避免衝動跟單名牌限量；多比較三家後再決定。',
    cautionFortune: '別過度迎合導致自己心累，學會說「不」是今日課題。',
    outfitAdvice: '優雅平衡的剪裁與柔和色彩，能展現你獨有的女性魅力。',
    luckyColors: ['粉色', '象牙白'],
    styleKeywords: ['formal-dresses', 'celebrity-style'],
  },
  libra_male: {
    workFortune: '今日適合處理需要美感與品味的任務，視覺呈現會是加分關鍵。',
    relationshipFortune: '溫文的紳士特質會吸引異性目光，但別讓貼心變成曖昧。',
    moneyFortune: '可關注品牌單品的長期投資，但避免衝動消費；多看少買為宜。',
    cautionFortune: '猶豫不決會錯失機會，重要決定設定一個截止時間給自己。',
    outfitAdvice: '優雅平衡的搭配是你今日的關鍵，柔和色配深色配件最佳。',
    luckyColors: ['白色', '深海藍'],
    styleKeywords: ['brand-custom', 'jin-style'],
  },

  // ─── 天蠍座 Scorpio ───
  scorpio_female: {
    workFortune: '洞察力極強，適合處理需要看穿表象的工作；別怕揭露真相。',
    relationshipFortune: '深度交流比表面寒暄更值得，今日適合與摯友交心。',
    moneyFortune: '可評估有潛力的長期投資，但避免高風險短線操作。',
    cautionFortune: '注意嫉妒心或過度執著，放手才是真正的力量。',
    outfitAdvice: '神祕的深色系配上一抹大膽剪裁，最能展現你的危險美感。',
    luckyColors: ['黑色', '磚紅'],
    styleKeywords: ['celebrity-style', 'host-style'],
  },
  scorpio_male: {
    workFortune: '專注力強，適合深度研究或保密性高的任務；獨處能激發最佳產出。',
    relationshipFortune: '別把所有情緒藏起來，適度敞開心房會讓親密關係更穩。',
    moneyFortune: '今日適合長線佈局，避免短線追高；研究功課做足再下手。',
    cautionFortune: '別讓懷疑變成偏執，先核實事實再下結論。',
    outfitAdvice: '深色系的銳利剪裁與低調奢華配件，是你今日的氣場武器。',
    luckyColors: ['黑色', '深海藍'],
    styleKeywords: ['brand-custom', 'jin-style'],
  },

  // ─── 射手座 Sagittarius ───
  sagittarius_female: {
    workFortune: '冒險運強，適合提出新點子；上司今日對創意接受度高。',
    relationshipFortune: '直率是你的魅力，但今日記得多一點溫柔不會吃虧。',
    moneyFortune: '可關注海外或新興市場的標的，但避免一次性押注。',
    cautionFortune: '出門注意交通，匆忙趕路容易遺失隨身物品。',
    outfitAdvice: '自由奔放的層次穿搭最適合你，亮色配件能加強旅行感。',
    luckyColors: ['磚紅', '粉色'],
    styleKeywords: ['rush', 'celebrity-style'],
  },
  sagittarius_male: {
    workFortune: '視野開闊，適合進行市場分析或策略規劃；別被細節困住主軸。',
    relationshipFortune: '坦白是你的本色，但傳達方式可以更溫和；朋友會欣賞真誠的你。',
    moneyFortune: '可考慮多元配置，避免單押一檔；長線眼光優於短線投機。',
    cautionFortune: '注意承諾要守，別因熱情答應太多最後做不完。',
    outfitAdvice: '休閒中帶著精緻的層次穿搭，是你今日最佳的個性表達。',
    luckyColors: ['深海藍', '象牙白'],
    styleKeywords: ['brand-custom', 'host-style'],
  },

  // ─── 摩羯座 Capricorn ───
  capricorn_female: {
    workFortune: '今日是收割長期努力的好日子，適合提出加薪或升遷的對話。',
    relationshipFortune: '別讓工作壓力影響情緒，伴侶需要你今晚的專注陪伴。',
    moneyFortune: '財運穩定，可考慮長期定存或退休規劃加碼。',
    cautionFortune: '注意過度勞累，別把所有事都扛在自己身上。',
    outfitAdvice: '經典優雅的合身洋裝是你今日的最佳代言，低調奢華最對味。',
    luckyColors: ['黑色', '象牙白'],
    styleKeywords: ['formal-dresses', 'celebrity-style'],
  },
  capricorn_male: {
    workFortune: '責任感強的今日，適合接手需要長期規劃的專案；務實態度會被肯定。',
    relationshipFortune: '別只用工作成就證明自己，伴侶想看到你柔軟的一面。',
    moneyFortune: '保守理財為宜，可檢視長期投資組合是否符合風險偏好。',
    cautionFortune: '注意肩背痠痛，安排今晚伸展或熱敷會舒緩許多。',
    outfitAdvice: '深色系合身西裝配經典皮鞋，是你今日的最強氣場武裝。',
    luckyColors: ['黑色', '深海藍'],
    styleKeywords: ['brand-custom', 'jin-style'],
  },

  // ─── 水瓶座 Aquarius ───
  aquarius_female: {
    workFortune: '創新思維被肯定，適合提出與眾不同的點子；別怕被笑「太前衛」。',
    relationshipFortune: '保持獨立空間是你的常態，但記得偶爾主動聯絡才不會被誤解冷淡。',
    moneyFortune: '可關注科技或新興產業的長期投資，但別因炒作衝動跟單。',
    cautionFortune: '別過度理性，人際關係需要一點溫度。',
    outfitAdvice: '前衛剪裁配上一抹亮色配件，最能展現你的獨特品味。',
    luckyColors: ['深海藍', '粉色'],
    styleKeywords: ['celebrity-style', 'host-style'],
  },
  aquarius_male: {
    workFortune: '邏輯與創意兼具的一天，適合處理需要跨領域整合的任務。',
    relationshipFortune: '別總是用理性分析感情，今日適合純粹陪伴而不分析。',
    moneyFortune: '科技股或創新領域可關注，但仍以分散投資為主。',
    cautionFortune: '注意作息規律，熬夜會影響明日的判斷力。',
    outfitAdvice: '簡約幾何剪裁配深色基底，散發冷靜中帶創意的氣質。',
    luckyColors: ['黑色', '深海藍'],
    styleKeywords: ['brand-custom', 'jin-style'],
  },

  // ─── 雙魚座 Pisces ───
  pisces_female: {
    workFortune: '直覺敏銳，適合處理創意或藝術相關的任務；藝術品味是今日加分項。',
    relationshipFortune: '溫柔同理心是你的魅力，但別把別人的情緒全攬到自己身上。',
    moneyFortune: '財運平穩，宜避免衝動奢華消費；先列清單再購物。',
    cautionFortune: '注意過度感性導致決策延誤，深呼吸後再下決定。',
    outfitAdvice: '夢幻飄逸的洋裝最能展現你的浪漫氣質，珍珠配件加分。',
    luckyColors: ['粉色', '象牙白'],
    styleKeywords: ['formal-dresses', 'celebrity-style'],
  },
  pisces_male: {
    workFortune: '想像力強，適合處理需要創意發想的任務；別讓他人質疑打消你的點子。',
    relationshipFortune: '溫柔細膩是你的魅力，朋友今日會主動找你訴說心事。',
    moneyFortune: '財運中性，宜避免大額衝動消費；多比較三家後再決定。',
    cautionFortune: '注意情緒太容易受影響，獨處時間能幫你充電。',
    outfitAdvice: '柔和色系與舒適剪裁的針織衫，散發溫文紳士氣質。',
    luckyColors: ['白色', '深海藍'],
    styleKeywords: ['brand-custom', 'jin-style'],
  },
}

export function getSeedHoroscope(input: HoroscopeGenInput): HoroscopeContent {
  const key: SeedKey = `${input.sign}_${input.gender}`
  return SEED[key]
}
