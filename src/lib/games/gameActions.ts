'use server'

import { getPayload } from 'payload'
import config from '../../payload.config'
import type { Where } from 'payload'
import {
  computeMBTI64,
  computeMBTIType,
  getResult,
  isAnswersComplete,
  type LifestyleAnswers,
  type MBTIAnswers,
} from './mbtiQuizEngine'
import { OCCASION_META } from './mbtiOccasions'
import { suggestPersonalityTypes, type ProductLikeForRecommend } from './mbtiAutoRecommend'

// ──────────────────────────────────────
// 點數相關操作
// ──────────────────────────────────────

/** 發放遊戲獎勵點數 */
export async function awardGamePoints(
  userId: number,
  points: number,
  gameSlug: string,
  description: string,
) {
  const payload = await getPayload({ config })

  // 檢查每日上限
  const gameSettings = await payload.findGlobal({ slug: 'game-settings' }) as unknown as Record<string, unknown>
  const dailyLimit = (gameSettings.globalDailyPointsLimit as number) || 500

  const today = new Date()
  today.setHours(0, 0, 0, 0)

  const where: Where = {
    user: { equals: userId },
    source: { equals: 'game' },
    createdAt: { greater_than: today.toISOString() },
  }

  const todayRecords = await payload.find({
    collection: 'points-transactions',
    where,
    limit: 0,
  })

  const todayTotal = (todayRecords.docs as unknown as Record<string, unknown>[]).reduce((sum: number, doc: Record<string, unknown>) => sum + ((doc.amount as number) || 0), 0)

  if (todayTotal >= dailyLimit) {
    return { success: false, reason: 'daily_limit', message: '今日遊戲點數已達上限' }
  }

  const actualPoints = Math.min(points, dailyLimit - todayTotal)

  // users.points 是 canonical 餘額，先讀再算 — 早期版本漏 update 導致一直 0
  const user = await payload.findByID({ collection: 'users', id: userId }) as unknown as Record<string, unknown>
  const prevBalance = (user.points as number) || 0
  const newBalance = prevBalance + actualPoints

  await (payload.create as Function)({
    collection: 'points-transactions',
    data: {
      user: userId,
      amount: actualPoints,
      type: 'earn',
      source: 'game',
      description: `[${gameSlug}] ${description}`,
      balance: newBalance,
    } as unknown as Record<string, unknown>,
  })

  await (payload.update as Function)({
    collection: 'users',
    id: userId,
    data: { points: newBalance } as unknown as Record<string, unknown>,
  })

  return { success: true, points: actualPoints }
}

// ──────────────────────────────────────
// 每日簽到
// ──────────────────────────────────────

export async function performDailyCheckin(userId: number) {
  const payload = await getPayload({ config })
  const gameSettings = await payload.findGlobal({ slug: 'game-settings' }) as unknown as Record<string, unknown>
  const checkinSettings = (gameSettings.dailyCheckin || {}) as unknown as Record<string, unknown>

  const today = new Date()
  today.setHours(0, 0, 0, 0)

  // 查看今天是否已簽到
  const where: Where = {
    user: { equals: userId },
    gameType: { equals: 'daily-checkin' },
    createdAt: { greater_than: today.toISOString() },
  }
  const todayRecord = await payload.find({
    collection: 'mini-game-records',
    where,
    limit: 1,
  })

  if (todayRecord.docs.length > 0) {
    return { success: false, message: '今天已經簽到囉！明天再來 ✨' }
  }

  // 查看連續簽到天數
  const yesterday = new Date(today)
  yesterday.setDate(yesterday.getDate() - 1)
  const yesterdayWhere: Where = {
    user: { equals: userId },
    gameType: { equals: 'daily-checkin' },
    createdAt: {
      greater_than: yesterday.toISOString(),
      less_than: today.toISOString(),
    },
  }
  const yesterdayRecord = await payload.find({
    collection: 'mini-game-records',
    where: yesterdayWhere,
    limit: 1,
  })

  const prevStreak = yesterdayRecord.docs.length > 0
    ? ((yesterdayRecord.docs[0] as unknown as Record<string, unknown>).streak as number || 0)
    : 0
  const currentStreak = prevStreak + 1
  const isDay7 = currentStreak % 7 === 0

  const day1to6 = (checkinSettings.day1to6Points as number) || 5
  const day7Bonus = (checkinSettings.day7BonusPoints as number) || 50
  const multiplier = (checkinSettings.streakBonusMultiplier as number) || 1.5

  let points = isDay7 ? day7Bonus : day1to6
  if (currentStreak > 7) {
    points = Math.floor(points * multiplier)
  }

  await (payload.create as Function)({
    collection: 'mini-game-records',
    data: {
      user: userId,
      gameType: 'daily-checkin',
      result: isDay7 ? 'day7_bonus' : 'checkin',
      pointsEarned: points,
      streak: currentStreak,
    } as unknown as Record<string, unknown>,
  })

  const award = await awardGamePoints(userId, points, 'daily-checkin', `連續簽到第 ${currentStreak} 天`)

  return {
    success: true,
    streak: currentStreak,
    points: award.points || points,
    isDay7,
    message: isDay7 ? `🎉 連續簽到第 ${currentStreak} 天！獲得 ${points} 點大獎！` : `✅ 簽到成功！連續 ${currentStreak} 天，獲得 ${points} 點`,
  }
}

// ──────────────────────────────────────
// 幸運轉盤
// ──────────────────────────────────────

export async function spinWheel(userId: number) {
  const payload = await getPayload({ config })
  const gameSettings = await payload.findGlobal({ slug: 'game-settings' }) as unknown as Record<string, unknown>
  const wheelSettings = (gameSettings.spinWheel || {}) as unknown as Record<string, unknown>

  const prizes = (wheelSettings.prizes as unknown as Array<Record<string, unknown>>) || []
  if (prizes.length === 0) {
    return { success: false, message: '轉盤暫未設定獎品' }
  }

  // 加權隨機選獎品
  const totalWeight = prizes.reduce((sum, p) => sum + ((p.weight as number) || 10), 0)
  let random = Math.random() * totalWeight
  let selectedPrize = prizes[0]

  for (const prize of prizes) {
    random -= (prize.weight as number) || 10
    if (random <= 0) {
      selectedPrize = prize
      break
    }
  }

  const prizeType = selectedPrize.prizeType as string
  const prizeAmount = (selectedPrize.prizeAmount as number) || 0

  let points = 0
  if (prizeType === 'points') {
    points = prizeAmount
  }

  await (payload.create as Function)({
    collection: 'mini-game-records',
    data: {
      user: userId,
      gameType: 'spin-wheel',
      result: selectedPrize.prizeName as string,
      pointsEarned: points,
      metadata: {
        prizeType,
        prizeAmount,
        couponCode: selectedPrize.couponCode || null,
      },
    } as unknown as Record<string, unknown>,
  })

  if (points > 0) {
    await awardGamePoints(userId, points, 'spin-wheel', `轉盤獲得 ${selectedPrize.prizeName}`)
  }

  return {
    success: true,
    prize: {
      name: selectedPrize.prizeName as string,
      type: prizeType,
      amount: prizeAmount,
    },
    points,
    message: prizeType === 'none'
      ? '😅 差一點點！下次一定中！'
      : `🎉 恭喜獲得 ${selectedPrize.prizeName}！`,
  }
}

// ──────────────────────────────────────
// 刮刮樂
// ──────────────────────────────────────

export async function playScratchCard(userId: number) {
  const payload = await getPayload({ config })
  const gameSettings = await payload.findGlobal({ slug: 'game-settings' }) as unknown as Record<string, unknown>
  const scratchSettings = (gameSettings.scratchCard || {}) as unknown as Record<string, unknown>

  const prizes = (scratchSettings.prizes as unknown as Array<Record<string, unknown>>) || []
  if (prizes.length === 0) {
    return { success: false, message: '刮刮樂暫未設定獎品' }
  }

  // 產生3格刮刮樂
  const cells: Array<{ name: string; type: string; amount: number }> = []
  for (let i = 0; i < 3; i++) {
    const totalWeight = prizes.reduce((sum, p) => sum + ((p.weight as number) || 10), 0)
    let random = Math.random() * totalWeight
    let selected = prizes[0]
    for (const prize of prizes) {
      random -= (prize.weight as number) || 10
      if (random <= 0) { selected = prize; break }
    }
    cells.push({
      name: selected.prizeName as string,
      type: selected.prizeType as string,
      amount: (selected.prizeAmount as number) || 0,
    })
  }

  // 三格相同 = 大獎
  const allSame = cells.every((c) => c.name === cells[0].name)
  const bestCell = allSame ? { ...cells[0], amount: cells[0].amount * 3 } : cells[0]
  const points = bestCell.type === 'points' ? bestCell.amount : 0

  await (payload.create as Function)({
    collection: 'mini-game-records',
    data: {
      user: userId,
      gameType: 'scratch-card',
      result: allSame ? `三連中！${bestCell.name}` : bestCell.name,
      pointsEarned: points,
      metadata: { cells, allSame },
    } as unknown as Record<string, unknown>,
  })

  if (points > 0) {
    await awardGamePoints(userId, points, 'scratch-card', allSame ? `三連中 ${bestCell.name}` : `刮中 ${bestCell.name}`)
  }

  return {
    success: true,
    cells,
    allSame,
    points,
    message: allSame ? `🎊 三連中！恭喜獲得 ${bestCell.name} x3！` : `刮中 ${cells[0].name}！`,
  }
}

// ──────────────────────────────────────
// 電影票抽獎
// ──────────────────────────────────────

export async function drawMovieTicket(userId: number) {
  const payload = await getPayload({ config })
  const gameSettings = await payload.findGlobal({ slug: 'game-settings' }) as unknown as Record<string, unknown>
  const movieSettings = (gameSettings.movieLottery || {}) as unknown as Record<string, unknown>

  const winRate = ((movieSettings.winRate as number) || 5) / 100
  const remaining = (movieSettings.remainingTickets as number) || 0
  const pointsCost = (movieSettings.pointsCostPerPlay as number) || 100

  if (remaining <= 0) {
    return { success: false, message: '本期電影票已全部抽完，敬請期待下一期！' }
  }

  const won = Math.random() < winRate

  await (payload.create as Function)({
    collection: 'mini-game-records',
    data: {
      user: userId,
      gameType: 'movie-lottery',
      result: won ? 'win' : 'lose',
      pointsEarned: won ? 0 : 0,
      metadata: { pointsCost, won, ticketType: movieSettings.ticketType },
    } as unknown as Record<string, unknown>,
  })

  if (won) {
    await (payload.updateGlobal as Function)({
      slug: 'game-settings',
      data: {
        movieLottery: {
          ...movieSettings,
          remainingTickets: remaining - 1,
        },
      } as unknown as Record<string, unknown>,
    })
    return {
      success: true,
      won: true,
      message: '🎬🎉 恭喜中獎！獲得威秀電影票一張！請至會員中心查看兌換碼。',
    }
  }

  return {
    success: true,
    won: false,
    message: '😢 很可惜沒中獎，再試一次吧！',
  }
}

// ──────────────────────────────────────
// 璀璨穿搭挑戰（AI 評分）
// ──────────────────────────────────────

export async function submitFashionChallenge(
  userId: number,
  selectedItems: string[], // product IDs
  timeTaken: number, // seconds
) {
  const payload = await getPayload({ config })
  const gameSettings = await payload.findGlobal({ slug: 'game-settings' }) as unknown as Record<string, unknown>
  const challengeSettings = (gameSettings.fashionChallenge || {}) as unknown as Record<string, unknown>

  // AI 評分模擬（實際可接 AI API）
  const baseScore = Math.min(selectedItems.length * 15, 60)
  const timeBonus = timeTaken <= 30 ? 20 : timeTaken <= 45 ? 10 : 0
  const varietyBonus = new Set(selectedItems).size >= 3 ? 20 : 10
  const totalScore = Math.min(baseScore + timeBonus + varietyBonus, 100)

  let rank: string
  let points: number
  if (totalScore >= 90) { rank = 'S'; points = (challengeSettings.rankSPoints as number) || 50 }
  else if (totalScore >= 70) { rank = 'A'; points = (challengeSettings.rankAPoints as number) || 30 }
  else if (totalScore >= 50) { rank = 'B'; points = (challengeSettings.rankBPoints as number) || 15 }
  else { rank = 'C'; points = (challengeSettings.rankCPoints as number) || 5 }

  await (payload.create as Function)({
    collection: 'mini-game-records',
    data: {
      user: userId,
      gameType: 'fashion-challenge',
      result: `${rank}級 (${totalScore}分)`,
      pointsEarned: points,
      metadata: { selectedItems, timeTaken, totalScore, rank },
    } as unknown as Record<string, unknown>,
  })

  await awardGamePoints(userId, points, 'fashion-challenge', `穿搭挑戰 ${rank}級`)

  return {
    success: true,
    score: totalScore,
    rank,
    points,
    message: `${rank === 'S' ? '👑' : rank === 'A' ? '🌟' : rank === 'B' ? '✨' : '💪'} ${rank}級！得分 ${totalScore}，獲得 ${points} 點！`,
  }
}

// ──────────────────────────────────────
// 抽卡片比大小
// ──────────────────────────────────────

export async function createCardBattleRoom(userId: number, referralCode?: string) {
  const payload = await getPayload({ config })
  const gameSettings = await payload.findGlobal({ slug: 'game-settings' }) as unknown as Record<string, unknown>
  const battleSettings = (gameSettings.cardBattle || {}) as unknown as Record<string, unknown>

  const card = Math.floor(Math.random() * 13) + 1 // 1-13
  const suits = ['♠️', '♥️', '♦️', '♣️'] as const
  const suit = suits[Math.floor(Math.random() * 4)]

  const battle = await (payload.create as Function)({
    collection: 'card-battles',
    data: {
      challenger: userId,
      challengerCard: card,
      challengerSuit: suit,
      status: 'waiting',
      referralCode: referralCode || undefined,
      expiresAt: new Date(Date.now() + ((battleSettings.roomExpiryHours as number) || 24) * 3600000).toISOString(),
    } as unknown as Record<string, unknown>,
  })

  return {
    success: true,
    battleId: battle.id,
    card,
    suit,
    message: '🃏 已抽牌！分享連結邀請好友對戰！',
  }
}

export async function joinCardBattle(userId: number, battleId: number) {
  const payload = await getPayload({ config })
  const gameSettings = await payload.findGlobal({ slug: 'game-settings' }) as unknown as Record<string, unknown>
  const battleSettings = (gameSettings.cardBattle || {}) as unknown as Record<string, unknown>

  const battle = await payload.findByID({ collection: 'card-battles', id: battleId }) as unknown as Record<string, unknown>

  if (!battle || battle.status !== 'waiting') {
    return { success: false, message: '對戰房間不存在或已結束' }
  }

  const opponentCard = Math.floor(Math.random() * 13) + 1
  const suits = ['♠️', '♥️', '♦️', '♣️'] as const
  const opponentSuit = suits[Math.floor(Math.random() * 4)]

  const challengerCard = battle.challengerCard as number
  let result: 'win' | 'lose' | 'draw'
  if (opponentCard > challengerCard) result = 'win'
  else if (opponentCard < challengerCard) result = 'lose'
  else result = 'draw'

  const hasReferral = Boolean(battle.referralCode)
  const bonus = hasReferral ? ((battleSettings.referralBonusPoints as number) || 20) : 0

  let winnerPoints: number, loserPoints: number
  if (result === 'draw') {
    const min = (battleSettings.drawPointsMin as number) || 20
    const max = (battleSettings.drawPointsMax as number) || 40
    winnerPoints = loserPoints = Math.floor(Math.random() * (max - min + 1)) + min
  } else {
    const wMin = (battleSettings.winnerPointsMin as number) || 30
    const wMax = (battleSettings.winnerPointsMax as number) || 80
    const lMin = (battleSettings.loserPointsMin as number) || 5
    const lMax = (battleSettings.loserPointsMax as number) || 15
    winnerPoints = Math.floor(Math.random() * (wMax - wMin + 1)) + wMin
    loserPoints = Math.floor(Math.random() * (lMax - lMin + 1)) + lMin
  }

  await (payload.update as Function)({
    collection: 'card-battles',
    id: battleId,
    data: {
      opponent: userId,
      opponentCard,
      opponentSuit: opponentSuit,
      status: 'completed',
      result: result === 'win' ? 'opponent_wins' : result === 'lose' ? 'challenger_wins' : 'draw',
    } as unknown as Record<string, unknown>,
  })

  const challengerId = battle.challenger as number
  if (result === 'win') {
    await awardGamePoints(userId, winnerPoints + bonus, 'card-battle', '抽卡對戰勝利')
    await awardGamePoints(challengerId, loserPoints, 'card-battle', '抽卡對戰落敗')
  } else if (result === 'lose') {
    await awardGamePoints(challengerId, winnerPoints + bonus, 'card-battle', '抽卡對戰勝利')
    await awardGamePoints(userId, loserPoints, 'card-battle', '抽卡對戰落敗')
  } else {
    await awardGamePoints(userId, winnerPoints + bonus, 'card-battle', '抽卡對戰平手')
    await awardGamePoints(challengerId, winnerPoints, 'card-battle', '抽卡對戰平手')
  }

  return {
    success: true,
    myCard: opponentCard,
    mySuit: opponentSuit,
    opponentCard: challengerCard,
    result,
    points: result === 'win' ? winnerPoints + bonus : result === 'draw' ? winnerPoints + bonus : loserPoints,
    hasReferralBonus: hasReferral,
    message: result === 'win'
      ? `🎉 你贏了！獲得 ${winnerPoints + bonus} 點！`
      : result === 'draw'
        ? `🤝 平手！各獲得 ${winnerPoints} 點！`
        : `😅 可惜輸了，但仍獲得 ${loserPoints} 點安慰獎！`,
  }
}

// ──────────────────────────────────────
// 穿搭 PK 對戰
// ──────────────────────────────────────

export async function submitStylePK(userId: number, imageUrl: string, caption: string) {
  const payload = await getPayload({ config })

  // 建立 UGC 投稿
  const post = await (payload.create as Function)({
    collection: 'ugc-posts',
    data: {
      user: userId,
      type: 'style_pk',
      caption,
      status: 'approved',
    } as unknown as Record<string, unknown>,
  })

  await (payload.create as Function)({
    collection: 'mini-game-records',
    data: {
      user: userId,
      gameType: 'style-pk',
      result: 'submitted',
      pointsEarned: 10,
      metadata: { postId: post.id, imageUrl },
    } as unknown as Record<string, unknown>,
  })

  await awardGamePoints(userId, 10, 'style-pk', '穿搭PK投稿')

  return {
    success: true,
    postId: post.id,
    message: '⚔️ 穿搭已提交！等待配對PK中...',
  }
}

export async function voteStylePK(userId: number, postId: number) {
  const payload = await getPayload({ config })
  const gameSettings = await payload.findGlobal({ slug: 'game-settings' }) as unknown as Record<string, unknown>
  const pkSettings = (gameSettings.stylePK || {}) as unknown as Record<string, unknown>
  const voterPoints = (pkSettings.voterPoints as number) || 3

  await awardGamePoints(userId, voterPoints, 'style-pk', '穿搭PK投票')

  return {
    success: true,
    points: voterPoints,
    message: `投票成功！獲得 ${voterPoints} 點`,
  }
}

// ──────────────────────────────────────
// 通用：記錄遊戲行為
// ──────────────────────────────────────

export async function recordGamePlay(
  userId: number,
  gameType: string,
  result: string,
  points: number,
  metadata?: Record<string, unknown>,
) {
  const payload = await getPayload({ config })

  await (payload.create as Function)({
    collection: 'mini-game-records',
    data: {
      user: userId,
      gameType,
      result,
      pointsEarned: points,
      ...(metadata ? { metadata } : {}),
    } as unknown as Record<string, unknown>,
  })

  if (points > 0) {
    await awardGamePoints(userId, points, gameType, result)
  }

  return { success: true, points }
}

// ──────────────────────────────────────
// MBTI 個性穿搭測驗 (15)
// ──────────────────────────────────────
//
// 使用點數買「專業 28 題測驗 + 個性穿搭分析 + 推薦商品」。
//   • 不發點數獎勵（玩家是消費點數換結果）
//   • 結果寫到 users.mbtiProfile（給商品推薦/廣告/AI DM 用）
//   • mini-game-records.metadata 記錄答題與分數（後台/分析用）

export async function playMBTIQuiz(
  userId: number,
  answers: MBTIAnswers,
  lifestyleAnswers: LifestyleAnswers = {},
) {
  const payload = await getPayload({ config })

  // 1. 取設定
  const gameSettings = await payload.findGlobal({ slug: 'game-settings' }) as unknown as Record<string, unknown>
  if (!gameSettings.enabled) {
    return { success: false as const, message: '遊戲系統暫時關閉' }
  }
  const gameList = (gameSettings.gameList || {}) as Record<string, boolean>
  if (!gameList.mbtiStyleEnabled) {
    return { success: false as const, message: 'MBTI 測驗目前未開放' }
  }
  const mbtiSettings = (gameSettings.mbtiStyle || {}) as Record<string, unknown>
  const pointsCost = (mbtiSettings.pointsCostPerPlay as number) ?? 50
  const dailyLimit = (mbtiSettings.dailyLimit as number) ?? 1

  // 2. 校驗答案完整性
  if (!isAnswersComplete(answers)) {
    return { success: false as const, message: '答案不完整，請完成所有題目' }
  }

  // 3. 終身限制（最重要）：除非 allowRetake，否則 user.mbtiProfile.mbtiType
  //    一旦寫入就拒絕重測（個性是穩定特質，重複測無意義）
  const user = await payload.findByID({ collection: 'users', id: userId }) as unknown as Record<string, unknown>
  const allowRetake = Boolean(mbtiSettings.allowRetake)
  const existingProfile = user.mbtiProfile as Record<string, unknown> | null | undefined
  const existingType = existingProfile?.mbtiType as string | null | undefined
  if (existingType && !allowRetake) {
    return {
      success: false as const,
      message: `你已測過 MBTI（${existingType}），個性測驗每位會員終身限 1 次。可至會員中心查看你的結果與推薦商品 ✨`,
    }
  }

  // 4. 每日上限（次要 — 即使 allowRetake 也擋日刷）
  if (dailyLimit > 0) {
    const start = new Date()
    start.setHours(0, 0, 0, 0)
    const todayPlays = await payload.find({
      collection: 'mini-game-records',
      where: {
        and: [
          { player: { equals: userId } },
          { gameType: { equals: 'mbti_quiz' } },
          { createdAt: { greater_than_equal: start.toISOString() } },
        ],
      } as Where,
      limit: 0,
      depth: 0,
    })
    if (todayPlays.totalDocs >= dailyLimit) {
      return { success: false as const, message: '今天已測過 MBTI 了，明天再來看看新的自己 ✨' }
    }
  }

  // 5. 檢查點數餘額
  const currentPoints = (user.points as number) ?? 0
  if (currentPoints < pointsCost) {
    return {
      success: false as const,
      message: `點數不足！需要 ${pointsCost} 點才能測驗（目前 ${currentPoints} 點）`,
    }
  }

  // 6. 扣點數 + 寫 points-transactions
  const newBalance = currentPoints - pointsCost
  await (payload.create as Function)({
    collection: 'points-transactions',
    data: {
      user: userId,
      amount: -pointsCost,
      type: 'spend',
      source: 'game',
      description: '[mbti-style] MBTI 個性穿搭測驗',
      balance: newBalance,
    } as unknown as Record<string, unknown>,
  })

  // 7. 計算 MBTI 結果（PR-Y：MBTI64 同時計算 primaryOccasion + sub-personality）
  const has32 = lifestyleAnswers && Object.keys(lifestyleAnswers).length > 0
  const compute = has32
    ? computeMBTI64(answers, lifestyleAnswers)
    : { ...computeMBTIType(answers), primaryOccasion: null, occasionScores: null, subResult: null }

  const { type, scores, dimensionScores } = compute
  const primaryOccasion = (compute as { primaryOccasion: 'urban' | 'vacation' | 'party' | 'cozy' | null }).primaryOccasion
  const occasionScores = (compute as { occasionScores: Record<string, number> | null }).occasionScores
  const subResult = (compute as { subResult: { subTagline: string; outfitTips: string[]; keyItems: string[]; paletteHint: string; collectionTags: string[] } | null }).subResult
  const resultDef = getResult(type)

  // 8. 更新 users（扣點數 + 寫 mbtiProfile + occasion）
  await (payload.update as Function)({
    collection: 'users',
    id: userId,
    data: {
      points: newBalance,
      mbtiProfile: {
        mbtiType: type,
        mbtiTakenAt: new Date().toISOString(),
        mbtiScores: dimensionScores,
        ...(primaryOccasion ? { primaryOccasion } : {}),
        ...(occasionScores ? { occasionScores } : {}),
      },
    } as unknown as Record<string, unknown>,
  })

  // 9. 寫 mini-game-records
  await (payload.create as Function)({
    collection: 'mini-game-records',
    data: {
      player: userId,
      gameType: 'mbti_quiz',
      result: {
        outcome: 'completed',
        prizeType: 'none',
        prizeAmount: 0,
        prizeDescription: `${type} ${resultDef.nickname}${primaryOccasion ? ` · ${OCCASION_META[primaryOccasion].label}` : ''}`,
      },
      pointsSpent: pointsCost,
      metadata: {
        answers,
        lifestyleAnswers,
        mbtiType: type,
        scores,
        dimensionScores,
        primaryOccasion,
        occasionScores,
      },
      status: 'completed',
    } as unknown as Record<string, unknown>,
  })

  // 10. 撈推薦商品 (personalityTypes 包含此 type 的已上架商品)
  let recommendedProducts: unknown[] = []
  try {
    const recRes = await payload.find({
      collection: 'products',
      where: {
        and: [
          { personalityTypes: { contains: type } },
          { status: { equals: 'published' } },
        ],
      } as Where,
      limit: 8,
      sort: '-createdAt',
      depth: 1,
    })
    recommendedProducts = recRes.docs
  } catch {
    // 推薦商品撈失敗不影響主流程
    recommendedProducts = []
  }

  return {
    success: true as const,
    mbtiType: type,
    nickname: resultDef.nickname,
    tagline: resultDef.tagline,
    personality: resultDef.personality,
    styleAnalysis: resultDef.styleAnalysis,
    styleKeywords: resultDef.styleKeywords,
    accentColor: resultDef.accentColor,
    scores,
    dimensionScores,
    // MBTI64 sub-personality 欄位
    ...(primaryOccasion
      ? {
          primaryOccasion,
          occasionLabel: OCCASION_META[primaryOccasion].label,
          occasionIcon: OCCASION_META[primaryOccasion].icon,
          subTagline: subResult?.subTagline,
          outfitTips: subResult?.outfitTips,
          paletteHint: subResult?.paletteHint,
          occasionScores,
        }
      : {}),
    recommendedProducts,
    pointsRemaining: newBalance,
    pointsSpent: pointsCost,
  }
}

/**
 * 後台「自動推薦個性類型」按鈕 server action wrapper。
 * 給 admin custom Field 用，回傳建議的 MBTI 類型陣列。
 */
export async function suggestProductPersonalityTypes(productData: ProductLikeForRecommend) {
  return { success: true as const, suggested: suggestPersonalityTypes(productData) }
}
