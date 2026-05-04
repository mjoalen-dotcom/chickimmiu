/**
 * MBTI 16 型結果定義 — 性格 + 穿搭風格分析
 * ──────────────────────────────────────────
 * 每型 6 個欄位：
 *   - nickname: 中文暱稱（沿用 MBTI 經典命名 + 在地化）
 *   - tagline: 一句話穿搭風格 slogan
 *   - personality: 性格描述（4-6 句，由 MBTI 認證理論為基礎，避免絕對化）
 *   - styleAnalysis: 穿搭風格分析（4-6 句，貼合 chickimmiu 商品調性）
 *   - styleKeywords: 風格關鍵詞（給結果頁 chip 顯示用）
 *   - recommendedCollectionTags: 對應 Products.collectionTags 的 enum value
 *   - accentColor: Tailwind gradient class（結果頁 hero 漸層用）
 */

export type MBTIType =
  | 'INTJ' | 'INTP' | 'ENTJ' | 'ENTP'
  | 'INFJ' | 'INFP' | 'ENFJ' | 'ENFP'
  | 'ISTJ' | 'ISFJ' | 'ESTJ' | 'ESFJ'
  | 'ISTP' | 'ISFP' | 'ESTP' | 'ESFP'

export const MBTI_TYPE_LIST: MBTIType[] = [
  'INTJ', 'INTP', 'ENTJ', 'ENTP',
  'INFJ', 'INFP', 'ENFJ', 'ENFP',
  'ISTJ', 'ISFJ', 'ESTJ', 'ESFJ',
  'ISTP', 'ISFP', 'ESTP', 'ESFP',
]

export interface MBTIResultDef {
  type: MBTIType
  nickname: string
  tagline: string
  personality: string
  styleAnalysis: string
  styleKeywords: string[]
  /** 對應 src/collections/Products.ts collectionTags enum value */
  recommendedCollectionTags: string[]
  /** Tailwind gradient e.g. 'from-slate-700 to-indigo-900' */
  accentColor: string
}

export const MBTI_RESULTS: Record<MBTIType, MBTIResultDef> = {
  INTJ: {
    type: 'INTJ',
    nickname: '建築師',
    tagline: '冷靜俐落的極簡知性派',
    personality: '你思緒清晰、計畫嚴謹，習慣為長遠目標投資。對自己要求高，對選擇有獨立判斷，不容易隨波逐流。看似冷淡，其實內心對在意的事情有很深的熱情。',
    styleAnalysis: '你的衣櫃像一座精心設計的圖書館——每一件都有理由、每一件都耐穿。偏好結構性剪裁、單色系（黑白灰駝）、材質精良的基本款。極簡不等於無聊，細節才是重點：一個利落的肩線、一條剛好的褲長，就足以撐起整套造型。',
    styleKeywords: ['極簡', '結構', '知性', '單色', '正式', '都會'],
    recommendedCollectionTags: ['formal-dresses', 'brand-custom'],
    accentColor: 'from-slate-700 to-indigo-900',
  },
  INTP: {
    type: 'INTP',
    nickname: '邏輯學家',
    tagline: '低調文藝的中性實穿派',
    personality: '你充滿好奇心、喜歡鑽研感興趣的領域，對形式主義保持距離。獨立思考是你的本能，社交雖不是強項，但與懂的人聊起來能滔滔不絕。',
    styleAnalysis: '你不為別人穿搭，只為自己舒服。中性色系、寬鬆剪裁、好穿好洗的材質是首選。喜歡帶點書卷氣的單品——針織開襟、棉麻襯衫、卡其褲——重點是不被衣服綁架。整體偏鬆弛、有思考感，意外耐看。',
    styleKeywords: ['中性', '實穿', '書卷', '低調', '寬鬆', '舒適'],
    recommendedCollectionTags: ['brand-custom'],
    accentColor: 'from-stone-500 to-zinc-700',
  },
  ENTJ: {
    type: 'ENTJ',
    nickname: '指揮官',
    tagline: '氣場全開的 Power Dressing',
    personality: '你天生有領導力、目標導向、決斷迅速，習慣把事情推進到位。對效率與成果的標準很高，遇到挑戰反而興奮。你不怕被看見，並樂於承擔責任。',
    styleAnalysis: '你的穿搭是名片。剪裁俐落、肩線分明、線條乾脆——西裝套裝、結構洋裝、有份量的配件，都是你的武器。色系偏沉穩（黑、深藍、酒紅），但你會用一個亮色細節讓整個畫面立刻聚焦。氣場 > 流行。',
    styleKeywords: ['權威', '剪裁', 'Power dressing', '俐落', '正式', '商務'],
    recommendedCollectionTags: ['formal-dresses', 'brand-custom'],
    accentColor: 'from-rose-700 to-slate-900',
  },
  ENTP: {
    type: 'ENTP',
    nickname: '辯論家',
    tagline: '混搭玩味的個性派',
    personality: '你思考靈活、樂於辯論、不愛被定義。對新點子有強烈好奇心，永遠在尋找下一個有趣的可能。你討厭重複，喜歡用幽默打破嚴肅。',
    styleAnalysis: '你的穿搭哲學是「不照規矩來」。復古遇上街頭、正式撞休閒、撞色撞圖騰你都試。一件西裝外套裡可以搭印 T，一條優雅長裙可以踩運動鞋。你的造型總有一個「咦？」的細節，讓人忍不住多看一眼。',
    styleKeywords: ['混搭', '復古', '玩味', '個性', '撞色', '不羈'],
    recommendedCollectionTags: ['host-style', 'celebrity-style'],
    accentColor: 'from-amber-500 to-fuchsia-600',
  },
  INFJ: {
    type: 'INFJ',
    nickname: '提倡者',
    tagline: '詩意層次的莫蘭迪派',
    personality: '你細膩、敏感、有深度同理心，常在意義與理想中尋找方向。看似安靜，內心其實對世界有強烈的見解。你重視深度連結，而非熱鬧。',
    styleAnalysis: '你的衣櫃像一首有節奏的詩。莫蘭迪色系、層次堆疊、有質感的材質——羊毛大衣、絲質襯衫、長版針織——每一件都有故事。剪裁柔和但不鬆垮，整體優雅得像畫，卻不刻意。',
    styleKeywords: ['詩意', '層次', '莫蘭迪', '優雅', '柔和', '有故事感'],
    recommendedCollectionTags: ['brand-custom', 'celebrity-style'],
    accentColor: 'from-stone-400 to-rose-300',
  },
  INFP: {
    type: 'INFP',
    nickname: '調停者',
    tagline: '浪漫文藝的波西米亞派',
    personality: '你內心住著一個夢想家，相信美好、相信感受、相信獨一無二。看似柔和，但對自己堅信的事情很有韌性。你熱愛藝術、文字、自然中的小細節。',
    styleAnalysis: '你的穿搭像隨手拍的詩。寬擺長裙、印花上衣、編織配件、流蘇圍巾，都能輕易出現在你身上。色彩柔和但不單調，常有一抹意外的鮮明。你不追潮流，你穿的是自己的世界觀。',
    styleKeywords: ['浪漫', '波西米亞', '文藝', '印花', '柔和', '自然'],
    recommendedCollectionTags: ['celebrity-style'],
    accentColor: 'from-rose-300 to-violet-400',
  },
  ENFJ: {
    type: 'ENFJ',
    nickname: '主人公',
    tagline: '溫暖知性的優雅甜美派',
    personality: '你是天生的暖心連結者，對人有深刻的關懷與洞察。表達能力強、共感力高，能讓人感到被看見。你習慣為團體著想，常成為大家信賴的支柱。',
    styleAnalysis: '你的穿搭就像你的人——溫暖又有質感。優雅的洋裝、柔順的針織、剪裁合宜的襯衫加A字裙，都很適合你。色系偏溫柔（米、奶茶、藕粉、淡藍），整體甜而不膩、得體又有溫度。',
    styleKeywords: ['優雅', '甜美', '知性', '溫柔', '得體', '社交'],
    recommendedCollectionTags: ['host-style', 'celebrity-style'],
    accentColor: 'from-pink-300 to-orange-300',
  },
  ENFP: {
    type: 'ENFP',
    nickname: '競選者',
    tagline: '活力滿點的色彩故事派',
    personality: '你充滿熱情、好奇心旺盛、隨時在發掘新可能。能讓周圍的氣氛變亮，是團體中的能量發電機。你重視自由、重視意義，討厭被框住。',
    styleAnalysis: '你的衣櫃像一場色彩派對。鮮豔印花、復古洋裝、有故事感的單品——蕾絲、刺繡、特殊版型你都不怕嘗試。重點是「能不能講出我今天想講的故事」。穿在你身上的不是衣服，是一個情緒。',
    styleKeywords: ['活潑', '印花', '故事感', '色彩', '復古', '派對'],
    recommendedCollectionTags: ['celebrity-style', 'host-style'],
    accentColor: 'from-orange-400 to-pink-500',
  },
  ISTJ: {
    type: 'ISTJ',
    nickname: '物流師',
    tagline: '經典恆久的品質派',
    personality: '你務實、可靠、重承諾。對細節有耐心、對品質不妥協、習慣用時間累積實力。看似低調，但你做的每件事都站得住腳。',
    styleAnalysis: '你的衣櫃是一座品質博物館——少量、精選、耐穿。喜歡經典款式（白襯衫、卡其褲、駝色大衣、小黑裙），不追潮流但永遠不會錯。你願意為一件對的衣服投資，因為你知道它會陪你十年。',
    styleKeywords: ['經典', '品質', '耐穿', '俐落', '正式', '基本款'],
    recommendedCollectionTags: ['formal-dresses', 'brand-custom'],
    accentColor: 'from-stone-600 to-neutral-800',
  },
  ISFJ: {
    type: 'ISFJ',
    nickname: '守衛者',
    tagline: '溫柔舒適的甜美日常派',
    personality: '你溫柔、體貼、擅長照顧人，常默默把細節做好。對熟悉的事物有安全感，對在乎的人有極強的忠誠。你的好被低估，但被看見的人會永遠記得。',
    styleAnalysis: '你的穿搭是日常的擁抱。柔軟材質、舒適剪裁、甜美版型——蓬袖洋裝、針織背心、奶茶色長裙，都是你的本命。配色溫柔（粉、米、奶白、淺灰藍），整體甜美又不過度，看起來舒服又親切。',
    styleKeywords: ['溫柔', '甜美', '舒適', '日常', '柔軟', '韓系'],
    recommendedCollectionTags: ['celebrity-style', 'host-style'],
    accentColor: 'from-rose-200 to-amber-200',
  },
  ESTJ: {
    type: 'ESTJ',
    nickname: '總經理',
    tagline: '專業俐落的商務通勤派',
    personality: '你有條理、有效率、重視秩序與規則。能在團隊中迅速建立流程，是被信任的執行者。你對承諾說到做到，對拖泥帶水沒耐心。',
    styleAnalysis: '你的穿搭精準對焦「上班拿得出手」。合身西裝、結構洋裝、俐落襯衫加直筒褲，都是你的標配。色系偏沉穩（黑、海軍藍、米駝），加上一條好皮帶或精緻耳環，整體乾淨、權威、不囉嗦。',
    styleKeywords: ['專業', '俐落', '商務', '通勤', '正式', '秩序'],
    recommendedCollectionTags: ['formal-dresses', 'brand-custom'],
    accentColor: 'from-slate-600 to-blue-900',
  },
  ESFJ: {
    type: 'ESFJ',
    nickname: '執政官',
    tagline: '親和流行的社交派',
    personality: '你熱情、體貼、善於連結人。對潮流敏感、對人際關係用心，是聚會中那個讓大家都覺得舒服的角色。你重視傳統、重視儀式感、重視被珍惜。',
    styleAnalysis: '你緊跟流行但不盲從，懂什麼場合該穿什麼。日常選甜美韓系、約會選浪漫洋裝、上班選優雅套裝。色彩偏柔和但有亮點，配件用心、髮型整齊，整體就像「最會穿衣的鄰家女孩」。',
    styleKeywords: ['親和', '流行', '社交', '甜美', '韓系', '得體'],
    recommendedCollectionTags: ['celebrity-style', 'host-style'],
    accentColor: 'from-pink-400 to-rose-400',
  },
  ISTP: {
    type: 'ISTP',
    nickname: '鑑賞家',
    tagline: '機能極簡的街頭派',
    personality: '你冷靜、實際、動手能力強。喜歡探索事物如何運作、不愛被規則綁住。話不多，但每一句都到位。你享受獨處與自由。',
    styleAnalysis: '你的穿搭是「能動的極簡」。機能材質、運動剪裁、街頭單品——卡其長褲、廓形外套、運動風洋裝、酷帽、平底鞋——都是你的日常。色系偏冷靜（黑、灰、軍綠、卡其），看似簡單卻很有態度。',
    styleKeywords: ['機能', '街頭', '極簡', '運動', '休閒', '酷感'],
    recommendedCollectionTags: ['brand-custom'],
    accentColor: 'from-zinc-600 to-emerald-800',
  },
  ISFP: {
    type: 'ISFP',
    nickname: '探險家',
    tagline: '自然復古的藝術派',
    personality: '你溫柔、敏銳、有獨特的美感。喜歡用感官體驗世界——光線、音樂、材質、氣味。看似安靜，但對美的事物有強烈直覺。',
    styleAnalysis: '你的穿搭像一張底片照。復古剪裁、自然色系、不規則細節——亞麻洋裝、復古印花、寬擺長裙、帆布鞋——你能把這些隨手組合成詩。整體偏溫潤、不張揚、像是從一個有陽光的午後走出來。',
    styleKeywords: ['自然', '復古', '藝術', '溫潤', '度假', '低彩度'],
    recommendedCollectionTags: ['celebrity-style'],
    accentColor: 'from-amber-400 to-stone-500',
  },
  ESTP: {
    type: 'ESTP',
    nickname: '企業家',
    tagline: '大膽性感的潮流前線',
    personality: '你充滿活力、敢冒險、擅長即時反應。在當下最自在、不愛預演太久。喜歡刺激、喜歡贏、喜歡讓事情發生。',
    styleAnalysis: '你不怕被看見，反而希望被看見。緊身剪裁、深 V、皮革、亮色、動物紋——這些別人不敢的元素你能輕鬆駕馭。今天可以穿西裝套裝去開會，晚上換身禮服就直奔派對。整體性感、自信、有 edge。',
    styleKeywords: ['大膽', '性感', '潮流', '前衛', '派對', '夜晚'],
    recommendedCollectionTags: ['celebrity-style', 'host-style'],
    accentColor: 'from-red-500 to-violet-700',
  },
  ESFP: {
    type: 'ESFP',
    nickname: '表演者',
    tagline: '鮮豔奪目的舞台派',
    personality: '你熱情外放、感染力強、活在當下。是天生的氣氛擔當，能讓任何場合變熱鬧。你重視體驗、重視快樂、重視被愛。',
    styleAnalysis: '你的穿搭就是一場 show。鮮豔色彩、亮片刺繡、誇張版型、有聲音的配件——這些你都能 hold 住。日常也不甘平淡，一條珠飾項鏈、一個亮色包、一抹紅唇就能讓整身發光。你穿的是節慶感。',
    styleKeywords: ['鮮豔', '奪目', '舞台感', '派對', '亮片', '熱鬧'],
    recommendedCollectionTags: ['celebrity-style', 'host-style'],
    accentColor: 'from-fuchsia-500 to-yellow-400',
  },
}
