import { getPayload } from 'payload'
import config from '@payload-config'
import type { Where } from 'payload'
import { recordGamePlay, updateLeaderboard, checkAndAwardBadges } from './gameEngine'

// ── Types ──

type StyleTag = 'casual' | 'elegant' | 'street' | 'office' | 'romantic' | 'sporty' | 'bohemian' | 'minimal' | 'vintage' | 'glamour'
type Category = 'top' | 'bottom' | 'outer' | 'accessories' | 'shoes'
type ColorFamily = 'neutral' | 'warm' | 'cool' | 'earth' | 'pastel' | 'bold'

interface FashionItem {
  id: string
  name: string
  category: Category
  image: string
  style: StyleTag[]
  colorFamily: ColorFamily
}

interface ChallengeSession {
  challengeId: string
  theme: string
  items: FashionItem[]
  timeLimit: number // seconds
  createdAt: string
}

interface ChallengeResult {
  score: number
  rank: 'S' | 'A' | 'B' | 'C'
  pointsReward: number
  breakdown: {
    styleCoherence: number
    themeMatch: number
    categoryCompleteness: number
    colorHarmony: number
  }
}

interface ShareCardData {
  theme: string
  score: number
  rank: 'S' | 'A' | 'B' | 'C'
  itemsUsed: FashionItem[]
  userId: string
  challengeId: string
  shareBonus: number
}

// ── Fashion Items Pool ──

const FASHION_ITEMS: FashionItem[] = [
  // Tops
  { id: 'top_01', name: '白色方領泡泡袖上衣', category: 'top', image: '/images/games/items/top_01.webp', style: ['romantic', 'elegant'], colorFamily: 'neutral' },
  { id: 'top_02', name: '黑色短版T恤', category: 'top', image: '/images/games/items/top_02.webp', style: ['casual', 'street'], colorFamily: 'neutral' },
  { id: 'top_03', name: '米色針織背心', category: 'top', image: '/images/games/items/top_03.webp', style: ['minimal', 'office'], colorFamily: 'earth' },
  { id: 'top_04', name: '粉色荷葉邊雪紡衫', category: 'top', image: '/images/games/items/top_04.webp', style: ['romantic', 'elegant'], colorFamily: 'pastel' },
  { id: 'top_05', name: '條紋水手領上衣', category: 'top', image: '/images/games/items/top_05.webp', style: ['casual', 'sporty'], colorFamily: 'cool' },
  { id: 'top_06', name: '藍色牛仔襯衫', category: 'top', image: '/images/games/items/top_06.webp', style: ['casual', 'street'], colorFamily: 'cool' },
  { id: 'top_07', name: '白色OL襯衫', category: 'top', image: '/images/games/items/top_07.webp', style: ['office', 'minimal'], colorFamily: 'neutral' },
  { id: 'top_08', name: '亮片派對上衣', category: 'top', image: '/images/games/items/top_08.webp', style: ['glamour', 'elegant'], colorFamily: 'bold' },

  // Bottoms
  { id: 'bot_01', name: '高腰直筒牛仔褲', category: 'bottom', image: '/images/games/items/bot_01.webp', style: ['casual', 'street'], colorFamily: 'cool' },
  { id: 'bot_02', name: '黑色A字裙', category: 'bottom', image: '/images/games/items/bot_02.webp', style: ['office', 'elegant'], colorFamily: 'neutral' },
  { id: 'bot_03', name: '米色寬褲', category: 'bottom', image: '/images/games/items/bot_03.webp', style: ['minimal', 'casual'], colorFamily: 'earth' },
  { id: 'bot_04', name: '碎花長裙', category: 'bottom', image: '/images/games/items/bot_04.webp', style: ['romantic', 'bohemian'], colorFamily: 'pastel' },
  { id: 'bot_05', name: '黑色西裝褲', category: 'bottom', image: '/images/games/items/bot_05.webp', style: ['office', 'minimal'], colorFamily: 'neutral' },
  { id: 'bot_06', name: '白色百褶裙', category: 'bottom', image: '/images/games/items/bot_06.webp', style: ['elegant', 'romantic'], colorFamily: 'neutral' },
  { id: 'bot_07', name: '運動短褲', category: 'bottom', image: '/images/games/items/bot_07.webp', style: ['sporty', 'casual'], colorFamily: 'neutral' },

  // Outer
  { id: 'out_01', name: '駝色風衣', category: 'outer', image: '/images/games/items/out_01.webp', style: ['elegant', 'office'], colorFamily: 'earth' },
  { id: 'out_02', name: '牛仔外套', category: 'outer', image: '/images/games/items/out_02.webp', style: ['casual', 'street'], colorFamily: 'cool' },
  { id: 'out_03', name: '黑色皮衣', category: 'outer', image: '/images/games/items/out_03.webp', style: ['street', 'glamour'], colorFamily: 'neutral' },
  { id: 'out_04', name: '粉色針織開衫', category: 'outer', image: '/images/games/items/out_04.webp', style: ['romantic', 'casual'], colorFamily: 'pastel' },
  { id: 'out_05', name: '白色西裝外套', category: 'outer', image: '/images/games/items/out_05.webp', style: ['office', 'minimal'], colorFamily: 'neutral' },

  // Accessories
  { id: 'acc_01', name: '金色項鏈', category: 'accessories', image: '/images/games/items/acc_01.webp', style: ['elegant', 'glamour'], colorFamily: 'warm' },
  { id: 'acc_02', name: '編織草帽', category: 'accessories', image: '/images/games/items/acc_02.webp', style: ['bohemian', 'casual'], colorFamily: 'earth' },
  { id: 'acc_03', name: '黑色腰帶', category: 'accessories', image: '/images/games/items/acc_03.webp', style: ['office', 'minimal'], colorFamily: 'neutral' },
  { id: 'acc_04', name: '珍珠耳環', category: 'accessories', image: '/images/games/items/acc_04.webp', style: ['elegant', 'romantic'], colorFamily: 'neutral' },
  { id: 'acc_05', name: '太陽眼鏡', category: 'accessories', image: '/images/games/items/acc_05.webp', style: ['casual', 'street'], colorFamily: 'neutral' },
  { id: 'acc_06', name: '絲巾', category: 'accessories', image: '/images/games/items/acc_06.webp', style: ['elegant', 'vintage'], colorFamily: 'warm' },

  // Shoes
  { id: 'sho_01', name: '白色小白鞋', category: 'shoes', image: '/images/games/items/sho_01.webp', style: ['casual', 'minimal'], colorFamily: 'neutral' },
  { id: 'sho_02', name: '黑色高跟鞋', category: 'shoes', image: '/images/games/items/sho_02.webp', style: ['elegant', 'office'], colorFamily: 'neutral' },
  { id: 'sho_03', name: '涼鞋', category: 'shoes', image: '/images/games/items/sho_03.webp', style: ['casual', 'bohemian'], colorFamily: 'earth' },
  { id: 'sho_04', name: '馬丁靴', category: 'shoes', image: '/images/games/items/sho_04.webp', style: ['street', 'vintage'], colorFamily: 'neutral' },
  { id: 'sho_05', name: '芭蕾平底鞋', category: 'shoes', image: '/images/games/items/sho_05.webp', style: ['romantic', 'elegant'], colorFamily: 'pastel' },
]

// ── Challenge Themes ──

interface ThemeDefinition {
  name: string
  matchingStyles: StyleTag[]
}

const CHALLENGE_THEMES: ThemeDefinition[] = [
  { name: '約會穿搭', matchingStyles: ['romantic', 'elegant'] },
  { name: '辦公OL風', matchingStyles: ['office', 'minimal'] },
  { name: '街頭韓系', matchingStyles: ['street', 'casual'] },
  { name: '優雅晚宴', matchingStyles: ['elegant', 'glamour'] },
  { name: '休閒週末', matchingStyles: ['casual', 'sporty'] },
  { name: '海邊度假', matchingStyles: ['bohemian', 'casual'] },
  { name: '閨蜜下午茶', matchingStyles: ['romantic', 'casual'] },
]

// ── Color Harmony Rules ──

const COLOR_HARMONY: Record<ColorFamily, ColorFamily[]> = {
  neutral: ['neutral', 'warm', 'cool', 'earth', 'pastel', 'bold'], // Neutral goes with everything
  warm: ['neutral', 'warm', 'earth'],
  cool: ['neutral', 'cool', 'pastel'],
  earth: ['neutral', 'warm', 'earth'],
  pastel: ['neutral', 'cool', 'pastel'],
  bold: ['neutral', 'bold'],
}

// ── Helpers ──

function shuffleArray<T>(arr: T[]): T[] {
  const shuffled = [...arr]
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]]
  }
  return shuffled
}

// ── 1. startChallenge ──

export async function startChallenge(userId: string): Promise<ChallengeSession> {
  const payload = await getPayload({ config })

  // Pick a random theme
  const theme = CHALLENGE_THEMES[Math.floor(Math.random() * CHALLENGE_THEMES.length)]

  // Select 12-16 random items, ensuring at least 2 from each category
  const itemsByCategory: Record<Category, FashionItem[]> = {
    top: shuffleArray(FASHION_ITEMS.filter((i) => i.category === 'top')),
    bottom: shuffleArray(FASHION_ITEMS.filter((i) => i.category === 'bottom')),
    outer: shuffleArray(FASHION_ITEMS.filter((i) => i.category === 'outer')),
    accessories: shuffleArray(FASHION_ITEMS.filter((i) => i.category === 'accessories')),
    shoes: shuffleArray(FASHION_ITEMS.filter((i) => i.category === 'shoes')),
  }

  const selected: FashionItem[] = []
  // At least 2 from each main category
  for (const cat of ['top', 'bottom', 'outer', 'accessories', 'shoes'] as Category[]) {
    const catItems = itemsByCategory[cat]
    selected.push(...catItems.slice(0, 2))
  }

  // Fill the rest randomly up to 14 items
  const remaining = FASHION_ITEMS.filter((i) => !selected.find((s) => s.id === i.id))
  const shuffledRemaining = shuffleArray(remaining)
  const needed = Math.min(shuffledRemaining.length, 14 - selected.length)
  selected.push(...shuffledRemaining.slice(0, Math.max(0, needed)))

  const challengeItems = shuffleArray(selected)
  const challengeId = `fc_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`

  // Store the challenge session in a game record
  await (payload.create as Function)({
    collection: 'mini-game-records',
    data: {
      player: userId,
      gameType: 'fashion_challenge' as never,
      result: {
        outcome: 'completed',
        prizeType: 'none',
        prizeAmount: 0,
      },
      status: 'active',
      metadata: {
        challengeId,
        theme: theme.name,
        themeStyles: theme.matchingStyles,
        items: challengeItems,
        timeLimit: 60,
        phase: 'in_progress',
        selectedItems: [],
        score: null,
        rank: null,
      },
    } as never,
  })

  return {
    challengeId,
    theme: theme.name,
    items: challengeItems,
    timeLimit: 60,
    createdAt: new Date().toISOString(),
  }
}

// ── 2. submitChallenge ──

function scoreOutfit(
  selectedItemIds: string[],
  themeStyles: StyleTag[],
): ChallengeResult {
  const items = selectedItemIds
    .map((id) => FASHION_ITEMS.find((i) => i.id === id))
    .filter(Boolean) as FashionItem[]

  if (items.length === 0) {
    return {
      score: 0,
      rank: 'C',
      pointsReward: 5,
      breakdown: { styleCoherence: 0, themeMatch: 0, categoryCompleteness: 0, colorHarmony: 0 },
    }
  }

  // 1. Style Coherence (0-30): how many items share style tags
  const allStyles = items.flatMap((i) => i.style)
  const styleCounts: Record<string, number> = {}
  for (const s of allStyles) {
    styleCounts[s] = (styleCounts[s] || 0) + 1
  }
  const maxStyleCount = Math.max(...Object.values(styleCounts), 0)
  const styleCoherence = Math.min(30, Math.round((maxStyleCount / Math.max(items.length, 1)) * 30))

  // 2. Theme Match (0-30): items that have style tags matching the theme
  const themeMatchCount = items.filter((item) =>
    item.style.some((s) => themeStyles.includes(s)),
  ).length
  const themeMatch = Math.min(30, Math.round((themeMatchCount / Math.max(items.length, 1)) * 30))

  // 3. Category Completeness (0-20)
  const categories = new Set(items.map((i) => i.category))
  let categoryCompleteness = 0
  if (categories.has('top') && categories.has('bottom')) categoryCompleteness += 10
  else if (categories.has('top') || categories.has('bottom')) categoryCompleteness += 5
  if (categories.has('shoes')) categoryCompleteness += 4
  if (categories.has('accessories')) categoryCompleteness += 3
  if (categories.has('outer')) categoryCompleteness += 3
  categoryCompleteness = Math.min(20, categoryCompleteness)

  // 4. Color Harmony (0-20)
  const colors = items.map((i) => i.colorFamily)
  let harmonyScore = 0
  let pairCount = 0
  for (let i = 0; i < colors.length; i++) {
    for (let j = i + 1; j < colors.length; j++) {
      pairCount++
      if (COLOR_HARMONY[colors[i]]?.includes(colors[j])) {
        harmonyScore++
      }
    }
  }
  const colorHarmony = pairCount > 0 ? Math.min(20, Math.round((harmonyScore / pairCount) * 20)) : 10

  const score = styleCoherence + themeMatch + categoryCompleteness + colorHarmony

  let rank: 'S' | 'A' | 'B' | 'C'
  let pointsReward: number
  if (score >= 80) {
    rank = 'S'
    pointsReward = 50
  } else if (score >= 60) {
    rank = 'A'
    pointsReward = 30
  } else if (score >= 40) {
    rank = 'B'
    pointsReward = 15
  } else {
    rank = 'C'
    pointsReward = 5
  }

  return {
    score,
    rank,
    pointsReward,
    breakdown: { styleCoherence, themeMatch, categoryCompleteness, colorHarmony },
  }
}

export async function submitChallenge(
  userId: string,
  challengeId: string,
  selectedItems: string[],
): Promise<{ success: boolean; result?: ChallengeResult; error?: string }> {
  const payload = await getPayload({ config })

  // Find the challenge session
  const sessions = await payload.find({
    collection: 'mini-game-records',
    where: {
      and: [
        { player: { equals: userId } },
        { gameType: { equals: 'fashion_challenge' } },
        { 'metadata.challengeId': { equals: challengeId } },
        { status: { equals: 'active' } },
      ],
    } as Where,
    limit: 1,
  })

  if (sessions.docs.length === 0) {
    return { success: false, error: '找不到此挑戰或已結束' }
  }

  const session = sessions.docs[0] as unknown as Record<string, unknown>
  const meta = (session.metadata as unknown as Record<string, unknown>) || {}

  if (meta.phase !== 'in_progress') {
    return { success: false, error: '此挑戰已提交過了' }
  }

  const themeStyles = (meta.themeStyles as StyleTag[]) || []
  const challengeResult = scoreOutfit(selectedItems, themeStyles)

  // Update the session record
  await (payload.update as Function)({
    collection: 'mini-game-records',
    id: session.id as unknown as string,
    data: {
      status: 'completed',
      result: {
        outcome: challengeResult.rank === 'S' || challengeResult.rank === 'A' ? 'win' : 'completed',
        prizeType: 'points',
        prizeAmount: challengeResult.pointsReward,
        prizeDescription: `穿搭挑戰 ${challengeResult.rank} 級 - ${challengeResult.score} 分`,
      },
      metadata: {
        ...meta,
        phase: 'completed',
        selectedItems,
        score: challengeResult.score,
        rank: challengeResult.rank,
        breakdown: challengeResult.breakdown,
      },
    } as never,
  })

  // Award points to user
  const user = await payload.findByID({ collection: 'users', id: userId })
  const userData = user as unknown as Record<string, unknown>
  const currentPoints = (userData.points as number) || 0
  await (payload.update as Function)({
    collection: 'users',
    id: userId,
    data: { points: currentPoints + challengeResult.pointsReward } as never,
  })

  // Update leaderboard
  const isWin = challengeResult.rank === 'S' || challengeResult.rank === 'A'
  await updateLeaderboard(userId, challengeResult.pointsReward, isWin)

  // Check for new badges
  await checkAndAwardBadges(userId)

  return { success: true, result: challengeResult }
}

// ── 3. generateShareCard ──

export async function generateShareCard(
  userId: string,
  challengeId: string,
): Promise<{ success: boolean; data?: ShareCardData; error?: string }> {
  const payload = await getPayload({ config })

  const sessions = await payload.find({
    collection: 'mini-game-records',
    where: {
      and: [
        { player: { equals: userId } },
        { gameType: { equals: 'fashion_challenge' } },
        { 'metadata.challengeId': { equals: challengeId } },
        { status: { equals: 'completed' } },
      ],
    } as Where,
    limit: 1,
  })

  if (sessions.docs.length === 0) {
    return { success: false, error: '找不到已完成的挑戰' }
  }

  const session = sessions.docs[0] as unknown as Record<string, unknown>
  const meta = (session.metadata as unknown as Record<string, unknown>) || {}
  const selectedItemIds = (meta.selectedItems as string[]) || []
  const itemsUsed = selectedItemIds
    .map((id) => FASHION_ITEMS.find((i) => i.id === id))
    .filter(Boolean) as FashionItem[]

  // Award share bonus: 10 points
  const shareBonus = 10
  const user = await payload.findByID({ collection: 'users', id: userId })
  const userData = user as unknown as Record<string, unknown>
  const currentPoints = (userData.points as number) || 0

  // Only award share bonus once (check metadata)
  if (!meta.shareAwarded) {
    await (payload.update as Function)({
      collection: 'users',
      id: userId,
      data: { points: currentPoints + shareBonus } as never,
    })

    await (payload.update as Function)({
      collection: 'mini-game-records',
      id: session.id as unknown as string,
      data: {
        metadata: { ...meta, shareAwarded: true },
      } as never,
    })
  }

  return {
    success: true,
    data: {
      theme: meta.theme as string,
      score: meta.score as number,
      rank: meta.rank as 'S' | 'A' | 'B' | 'C',
      itemsUsed,
      userId,
      challengeId,
      shareBonus: meta.shareAwarded ? 0 : shareBonus,
    },
  }
}
