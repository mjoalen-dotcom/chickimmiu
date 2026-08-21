/**
 * 會員等級引擎
 * ─────────────────────────────────────
 * CHIC KIM & MIU 六層會員等級計算邏輯
 *
 * ⚠️ 前台介面、LINE、EDM、通知一律只顯示 frontName
 *    絕對不可出現 bronze / silver / gold 等金屬分級名稱
 *
 * 後台分級碼：ordinary → bronze → silver → gold → platinum → diamond
 * 前台稱號：優雅初遇者 → 曦漾仙子 → 優漾女神 → 金曦女王 → 星耀皇后 → 璀璨天后
 */

// ── Tier Code → Front Name 對照表 ──────────────────────

/** 後台分級碼 → 前台顯示稱號（⚠️ 前台絕不暴露 tier code） */
export const TIER_FRONT_NAMES: Record<string, string> = {
  ordinary: '優雅初遇者',
  bronze: '曦漾仙子',
  silver: '優漾女神',
  gold: '金曦女王',
  platinum: '星耀皇后',
  diamond: '璀璨天后',
}

/** 等級排序數值（用於比較高低） */
export const TIER_LEVELS: Record<string, number> = {
  ordinary: 0,
  bronze: 1,
  silver: 2,
  gold: 3,
  platinum: 4,
  diamond: 5,
}

/** 等級排序陣列（由低到高） */
const TIER_ORDER: string[] = ['ordinary', 'bronze', 'silver', 'gold', 'platinum', 'diamond']

export type TierThresholds = Record<string, { lifetime: number; annual: number }>

/** 硬編碼兜底門檻（membership-tiers 讀不到時用；正常路徑請走 loadTierThresholds） */
export const DEFAULT_TIER_THRESHOLDS: TierThresholds = {
  ordinary: { lifetime: 0, annual: 0 },
  bronze: { lifetime: 3000, annual: 1500 },
  silver: { lifetime: 10000, annual: 5000 },
  gold: { lifetime: 30000, annual: 15000 },
  platinum: { lifetime: 80000, annual: 40000 },
  diamond: { lifetime: 200000, annual: 100000 },
}

/**
 * 從 membership-tiers collection 載入升級門檻（Alan 2026-08-21 拍板：後台為權威）。
 *   - lifetime = minSpent（升級門檻 — 累計消費）
 *   - annual   = annualSpentThreshold > 0 ? 該值 : Infinity（未設定 = 該級不開年度快速通道，
 *                不 fallback 硬編碼的假想數字）
 * collection 查詢失敗或整張表為空 → 整組 fallback DEFAULT_TIER_THRESHOLDS。
 *
 * payload 型別放寬為 minimal find 介面，讓 cron / hook / script 都能直接傳。
 */
export async function loadTierThresholds(payload: {
  find: (args: {
    collection: 'membership-tiers'
    limit: number
    depth: number
    overrideAccess?: boolean
  }) => Promise<{ docs: unknown[] }>
}): Promise<TierThresholds> {
  try {
    const res = await payload.find({
      collection: 'membership-tiers',
      limit: 20,
      depth: 0,
      overrideAccess: true,
    })
    if (res.docs.length === 0) return DEFAULT_TIER_THRESHOLDS

    const out: TierThresholds = {}
    for (const doc of res.docs) {
      const d = doc as Record<string, unknown>
      const slug = typeof d.slug === 'string' ? d.slug : ''
      if (!slug) continue
      const lifetime =
        typeof d.minSpent === 'number' && Number.isFinite(d.minSpent)
          ? d.minSpent
          : (DEFAULT_TIER_THRESHOLDS[slug]?.lifetime ?? 0)
      const annualRaw = typeof d.annualSpentThreshold === 'number' ? d.annualSpentThreshold : 0
      out[slug] = {
        lifetime,
        annual: slug === 'ordinary' ? 0 : annualRaw > 0 ? annualRaw : Infinity,
      }
    }
    // 表內缺某級（資料不完整）時補 DEFAULT，避免 calculateTier 跳級誤判
    for (const slug of Object.keys(DEFAULT_TIER_THRESHOLDS)) {
      if (!out[slug]) out[slug] = DEFAULT_TIER_THRESHOLDS[slug]
    }
    return out
  } catch {
    return DEFAULT_TIER_THRESHOLDS
  }
}

// ── Core Functions ─────────────────────────────────────

/**
 * 取得等級前台顯示名稱
 *
 * @param tierCode - 後台分級碼（ordinary, bronze, silver, gold, platinum, diamond）
 * @returns 前台稱號（如「曦漾仙子」），若代碼不存在則回傳「會員」
 */
export function getFrontName(tierCode: string): string {
  return TIER_FRONT_NAMES[tierCode] ?? '會員'
}

/**
 * 取得下一等級資訊
 *
 * @param currentTierCode - 目前等級的後台分級碼
 * @returns 下一等級的 code、frontName 與升級所需累計消費門檻，若已是最高等級則回傳 null
 */
export function getNextTier(
  currentTierCode: string,
): { code: string; frontName: string; spendGap: number } | null {
  const currentLevel = TIER_LEVELS[currentTierCode]
  if (currentLevel === undefined || currentLevel >= 5) return null

  const nextCode = TIER_ORDER[currentLevel + 1]
  if (!nextCode) return null

  const threshold = DEFAULT_TIER_THRESHOLDS[nextCode]
  if (!threshold) return null

  return {
    code: nextCode,
    frontName: TIER_FRONT_NAMES[nextCode] ?? '會員',
    spendGap: threshold.lifetime,
  }
}

/**
 * 根據消費金額計算應得等級
 *
 * 只要 lifetime 或 annual 其中一項達標即可升級。
 * 由最高等級往下比對，回傳第一個符合條件的等級。
 *
 * @param lifetimeSpend - 歷史累計消費金額（TWD）
 * @param annualSpend - 本年度消費金額（TWD）
 * @returns 應得等級的後台分級碼
 */
export function calculateTier(
  lifetimeSpend: number,
  annualSpend: number,
  thresholds: TierThresholds = DEFAULT_TIER_THRESHOLDS,
): string {
  // 由最高等級往下比對
  for (let i = TIER_ORDER.length - 1; i >= 0; i--) {
    const tierCode = TIER_ORDER[i]
    if (!tierCode) continue
    const threshold = thresholds[tierCode] ?? DEFAULT_TIER_THRESHOLDS[tierCode]
    if (!threshold) continue

    if (lifetimeSpend >= threshold.lifetime || annualSpend >= threshold.annual) {
      return tierCode
    }
  }

  return 'ordinary'
}

/**
 * 計算距離下一等級的消費差額
 *
 * @param currentTierCode - 目前等級的後台分級碼
 * @param currentLifetimeSpend - 目前累計消費金額（TWD）
 * @returns 下一等級資訊與差額，若已是最高等級則回傳 null
 */
export function getTierUpgradeGap(
  currentTierCode: string,
  currentLifetimeSpend: number,
): { nextTierCode: string; nextTierFrontName: string; gapAmount: number } | null {
  const next = getNextTier(currentTierCode)
  if (!next) return null

  const gapAmount = Math.max(0, next.spendGap - currentLifetimeSpend)

  return {
    nextTierCode: next.code,
    nextTierFrontName: next.frontName,
    gapAmount,
  }
}

/**
 * 比較兩個等級的高低
 *
 * @param tierA - 第一個等級碼
 * @param tierB - 第二個等級碼
 * @returns 正數表示 A > B，0 表示相等，負數表示 A < B
 */
export function compareTiers(tierA: string, tierB: string): number {
  return (TIER_LEVELS[tierA] ?? 0) - (TIER_LEVELS[tierB] ?? 0)
}

/**
 * 檢查是否為高 VIP 等級（T4 星耀皇后 或 T5 璀璨天后）
 *
 * @param tierCode - 後台分級碼
 * @returns 是否為 platinum 或 diamond
 */
export function isHighVIP(tierCode: string): boolean {
  return tierCode === 'platinum' || tierCode === 'diamond'
}
