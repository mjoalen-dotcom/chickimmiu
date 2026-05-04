/**
 * MBTI 28 題情境式測驗題庫
 * ─────────────────────────────────
 * 設計原則 (依 MBTI 認證 dichotomy theory)：
 *   • 4 維度 × 7 題 = 28 題（單側偏移最大 7 → 結果穩定不會 50/50 卡住）
 *   • 每題 2 選項，A/B 各對應一邊 axis（無中立選項，逼受測者選邊）
 *   • 題目融入 chickimmiu 目標族群（25-40 歲女性）的日常情境：
 *     - 穿搭決策、購物行為、社交場合、職場、戀愛、自我覺察、休閒娛樂
 *   • 避免 leading question 與性別 stereotype；A/B 兩邊呈現中性、不含價值判斷
 *   • 題目語氣輕鬆、生活化，貼近受眾不嚇跑
 */

export type MBTIAxis = 'E' | 'I' | 'S' | 'N' | 'T' | 'F' | 'J' | 'P'
export type MBTIDimension = 'EI' | 'SN' | 'TF' | 'JP'

export interface MBTIQuestion {
  id: string
  dimension: MBTIDimension
  text: string
  options: [
    { label: string; axis: MBTIAxis },
    { label: string; axis: MBTIAxis },
  ]
}

export const MBTI_QUESTIONS: MBTIQuestion[] = [
  // ─────────────── E vs I (外向 / 內向) ───────────────
  {
    id: 'q1',
    dimension: 'EI',
    text: '一個沒有計畫的週末，你比較想要：',
    options: [
      { label: '約三五好友逛街、喝下午茶、聊近況', axis: 'E' },
      { label: '待在家追劇、看書、做手作', axis: 'I' },
    ],
  },
  {
    id: 'q2',
    dimension: 'EI',
    text: '在剛開始的聚會場合，你通常：',
    options: [
      { label: '主動找人聊天、活絡氣氛', axis: 'E' },
      { label: '先觀察一下，等對方先打招呼', axis: 'I' },
    ],
  },
  {
    id: 'q3',
    dimension: 'EI',
    text: '一場熱鬧的派對結束後，你感覺：',
    options: [
      { label: '意猶未盡，還想找人續攤', axis: 'E' },
      { label: '能量耗盡，想立刻回家獨處充電', axis: 'I' },
    ],
  },
  {
    id: 'q4',
    dimension: 'EI',
    text: '思考一個重要的決定時，你比較傾向：',
    options: [
      { label: '找朋友聊一聊、邊講邊釐清', axis: 'E' },
      { label: '一個人靜靜想清楚再開口', axis: 'I' },
    ],
  },
  {
    id: 'q5',
    dimension: 'EI',
    text: '在工作或社群中，你比較自在的位置是：',
    options: [
      { label: '在團隊中央、被注意、被提問', axis: 'E' },
      { label: '在背後深耕、被信任、被需要', axis: 'I' },
    ],
  },
  {
    id: 'q6',
    dimension: 'EI',
    text: '逛街試穿時，你比較喜歡：',
    options: [
      { label: '跟朋友一起、互相給意見', axis: 'E' },
      { label: '自己慢慢試、不被打擾', axis: 'I' },
    ],
  },
  {
    id: 'q7',
    dimension: 'EI',
    text: '形容自己給陌生人聽，你會說：',
    options: [
      { label: '我活潑外放、很容易聊開', axis: 'E' },
      { label: '我內斂慢熟、相處久才會展現本色', axis: 'I' },
    ],
  },

  // ─────────────── S vs N (感官 / 直覺) ───────────────
  {
    id: 'q8',
    dimension: 'SN',
    text: '看到一件衣服，你最先注意：',
    options: [
      { label: '材質、做工、版型、實穿性', axis: 'S' },
      { label: '整體風格、能搭出什麼故事感', axis: 'N' },
    ],
  },
  {
    id: 'q9',
    dimension: 'SN',
    text: '安排一場旅行時，你習慣：',
    options: [
      { label: '列詳細行程表、訂好每個景點', axis: 'S' },
      { label: '訂好機票就走，現場再看心情決定', axis: 'N' },
    ],
  },
  {
    id: 'q10',
    dimension: 'SN',
    text: '學新事物時，你比較喜歡：',
    options: [
      { label: '一步一步照步驟、把基本功打穩', axis: 'S' },
      { label: '先抓大方向、自己摸索原理', axis: 'N' },
    ],
  },
  {
    id: 'q11',
    dimension: 'SN',
    text: '看劇時，你比較容易被什麼吸引：',
    options: [
      { label: '寫實的職場/家庭題材、貼近真實生活', axis: 'S' },
      { label: '懸疑/奇幻/科幻、有想像空間的世界觀', axis: 'N' },
    ],
  },
  {
    id: 'q12',
    dimension: 'SN',
    text: '朋友讚美你的穿搭時，你比較開心聽到：',
    options: [
      { label: '「這件好顯瘦/好顯氣色！」', axis: 'S' },
      { label: '「你今天看起來像走進雜誌大片」', axis: 'N' },
    ],
  },
  {
    id: 'q13',
    dimension: 'SN',
    text: '工作上遇到問題，你會：',
    options: [
      { label: '先看以前怎麼處理、用過往經驗', axis: 'S' },
      { label: '思考有沒有完全不同的解法', axis: 'N' },
    ],
  },
  {
    id: 'q14',
    dimension: 'SN',
    text: '理想中的家是：',
    options: [
      { label: '機能齊全、舒適好住、每樣東西都有用', axis: 'S' },
      { label: '有特色氛圍、能展現生活美學', axis: 'N' },
    ],
  },

  // ─────────────── T vs F (思考 / 情感) ───────────────
  {
    id: 'q15',
    dimension: 'TF',
    text: '朋友抱怨工作不順，你的第一反應：',
    options: [
      { label: '幫她分析問題、給具體建議', axis: 'T' },
      { label: '先抱抱她、感同身受、陪她難過', axis: 'F' },
    ],
  },
  {
    id: 'q16',
    dimension: 'TF',
    text: '買一件貴的衣服前，你會：',
    options: [
      { label: '比價、查評論、列實穿率與CP值', axis: 'T' },
      { label: '看眼緣、看心動程度、相信直覺', axis: 'F' },
    ],
  },
  {
    id: 'q17',
    dimension: 'TF',
    text: '處理人際衝突時，你比較傾向：',
    options: [
      { label: '就事論事、講道理、不繞彎', axis: 'T' },
      { label: '顧及對方感受、找折衷、緩和氣氛', axis: 'F' },
    ],
  },
  {
    id: 'q18',
    dimension: 'TF',
    text: '收到不太喜歡的禮物時，你會：',
    options: [
      { label: '誠實但委婉地讓對方知道', axis: 'T' },
      { label: '誇獎一下，不想讓對方失望', axis: 'F' },
    ],
  },
  {
    id: 'q19',
    dimension: 'TF',
    text: '評斷一個人，你比較看重：',
    options: [
      { label: '能力、邏輯、是否言行一致', axis: 'T' },
      { label: '溫度、善意、待人是否真誠', axis: 'F' },
    ],
  },
  {
    id: 'q20',
    dimension: 'TF',
    text: '同事做了一件你不認同的事，你：',
    options: [
      { label: '私下直接反應、把問題說清楚', axis: 'T' },
      { label: '先思考會不會傷感情、再決定要不要說', axis: 'F' },
    ],
  },
  {
    id: 'q21',
    dimension: 'TF',
    text: '看一部催淚電影，你比較常：',
    options: [
      { label: '理性看劇情、欣賞編導手法', axis: 'T' },
      { label: '入戲很深、跟著哭笑', axis: 'F' },
    ],
  },

  // ─────────────── J vs P (判斷 / 感知) ───────────────
  {
    id: 'q22',
    dimension: 'JP',
    text: '出門前你選衣服：',
    options: [
      { label: '前一晚就想好今天要穿什麼', axis: 'J' },
      { label: '早上看心情、看天氣再臨場決定', axis: 'P' },
    ],
  },
  {
    id: 'q23',
    dimension: 'JP',
    text: '行事曆在你手上是：',
    options: [
      { label: '排好排滿、清楚每天要做什麼', axis: 'J' },
      { label: '保留彈性、看狀況再插入安排', axis: 'P' },
    ],
  },
  {
    id: 'q24',
    dimension: 'JP',
    text: '要做一個重要選擇時，你：',
    options: [
      { label: '快點下決定、討厭懸著的感覺', axis: 'J' },
      { label: '能拖則拖、保留越多選項越好', axis: 'P' },
    ],
  },
  {
    id: 'q25',
    dimension: 'JP',
    text: '衣櫃理想狀態：',
    options: [
      { label: '依顏色/類型分區、隨時整齊', axis: 'J' },
      { label: '能找到就好、用順手的方式擺', axis: 'P' },
    ],
  },
  {
    id: 'q26',
    dimension: 'JP',
    text: '一個專案進行中你比較享受：',
    options: [
      { label: '計畫排好、依進度推進、按時收尾', axis: 'J' },
      { label: '邊做邊調整、保留發揮空間', axis: 'P' },
    ],
  },
  {
    id: 'q27',
    dimension: 'JP',
    text: '別人臨時改約，你的反應：',
    options: [
      { label: '有點不爽、覺得打亂節奏', axis: 'J' },
      { label: '沒差、本來就隨機應變', axis: 'P' },
    ],
  },
  {
    id: 'q28',
    dimension: 'JP',
    text: '購物節遇到限時優惠你會：',
    options: [
      { label: '事先列好購物清單、按計畫下單', axis: 'J' },
      { label: '邊逛邊看、跟著感覺走', axis: 'P' },
    ],
  },
]

export const TOTAL_QUESTIONS = MBTI_QUESTIONS.length // 28
