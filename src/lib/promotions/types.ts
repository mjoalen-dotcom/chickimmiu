/**
 * Promotion Engine V1 — 受限 DSL 型別（CHIC Commerce OS P0-B）
 *
 * 設計原則（見 docs/adr/ADR-20260813-campaign-engine-v1.md）：
 * - 條件與效果都是受限型別聯集，後台永遠不能輸入任意程式碼。
 * - Evaluator 是無 I/O 純函式：輸入全部是 snapshot，同輸入同版本必得同輸出。
 * - 金額一律為 TWD 整數（NT$）。百分比一律用 percentOff（8 折 = percentOff 20）。
 * - 護欄資料不足（缺成本、預算未知）一律 fail closed：不套折扣並記 reason code。
 */

// ─────────────────────────────────────────────────────────────────────────────
// 範圍（scope）：哪些商品行參與此規則
// ─────────────────────────────────────────────────────────────────────────────

export interface PromotionScope {
  /** 指定商品 id；空陣列/未填 = 不以商品白名單限制 */
  includeProducts?: Array<number | string>
  excludeProducts?: Array<number | string>
  /** 指定分類 id */
  includeCategories?: Array<number | string>
  excludeCategories?: Array<number | string>
  /** 商品標籤（Products.tags 字串） */
  includeTags?: string[]
  excludeTags?: string[]
  /** 排除贈品行 / 加價購行 / Bundle 子行（預設 true：這些行不算 eligible） */
  excludeGiftLines?: boolean
  excludeAddOnLines?: boolean
  excludeBundleLines?: boolean
}

// ─────────────────────────────────────────────────────────────────────────────
// 條件（when）：全部成立（all）才 eligible
// ─────────────────────────────────────────────────────────────────────────────

export type PromotionCondition =
  | { type: 'eligible_item_quantity_gte'; value: number }
  | { type: 'eligible_subtotal_gte'; value: number }
  | { type: 'order_subtotal_gte'; value: number }
  | { type: 'member_tier_in'; values: string[] }
  | { type: 'member_tier_not_in'; values: string[] }
  | { type: 'member_segment_in'; values: string[] }
  | { type: 'member_segment_not_in'; values: string[] }
  | { type: 'is_member'; value: boolean }
  | { type: 'first_purchase'; value: boolean }
  | { type: 'channel_in'; values: Array<'web' | 'app' | 'line'> }
  /**
   * 買 A + B：eligible 行必須「同時」出現這裡列的每一個 productId。
   * 用 eligible 行（scope 篩過的）判定，所以跟 scope 是 AND 關係——
   * 被 scope 排除的商品不算數，語意上「這條規則看得到的商品裡要湊齊這些」。
   * 這是 scope include 清單做不到的事：include 是 OR，買 2×A 也會過。
   */
  | { type: 'cart_contains_all_products'; values: Array<number | string> }
  /** 回購：已有成立訂單（與 first_purchase 互補） */
  | { type: 'repeat_purchase'; value: boolean }
  /** 生日月：會員生日的月份 == 下單當下（台北時區）的月份 */
  | { type: 'birthday_month'; value: boolean }
  /**
   * KOL / 推薦歸因：values 空 = 只要求「有帶任何推薦碼」；
   * values 有值 = 推薦碼必須是其中之一（大小寫不敏感）。
   */
  | { type: 'referral_attributed'; values?: string[] }

// ─────────────────────────────────────────────────────────────────────────────
// 效果（then）
// ─────────────────────────────────────────────────────────────────────────────

/** 折扣分攤到哪些行 */
export type AllocationMode = 'proportional_to_eligible_lines'

/** 湊組時挑哪些單件（僅 percent_discount_nth_unit / percent_discount_per_group 用） */
export type UnitSelection = 'cheapest_first' | 'most_expensive_first'

/** UserRewards.rewardType 的合法值（與 collections/UserRewards.ts 同步，勿自行擴充） */
export type UserRewardType =
  | 'free_shipping_coupon'
  | 'movie_ticket_physical'
  | 'movie_ticket_digital'
  | 'coupon'
  | 'gift_physical'
  | 'badge'
  | 'voucher'

/**
 * 訂單神秘禮物專屬的獎池標籤（對應 PrizePools.eligibleGames 的一個值）。
 *
 * 刻意與遊戲獎池分開：遊戲獎池的機率是營運日常在調的，訂單發獎若共用同一個池，
 * 改遊戲機率就會連帶改到訂單發獎的期望成本，而後者是計入活動預算的。
 */
export const MYSTERY_GIFT_POOL_TAG = 'order_mystery_gift'

export type PromotionEffect =
  /** 任選 N 件現折 X 元（72H 主打：groupSize 2、amount 1000） */
  | {
      type: 'fixed_discount_per_group'
      groupSize: number
      amount: number
      /** once_per_order：每單一次；every_full_group：每滿 N 件重複折 */
      repeatMode: 'once_per_order' | 'every_full_group'
      allocation: AllocationMode
    }
  /** 任選 N 件打 X 折（整組都折） */
  | {
      type: 'percent_discount_per_group'
      groupSize: number
      percentOff: number
      repeatMode: 'once_per_order' | 'every_full_group'
      unitSelection: UnitSelection
    }
  /** 第 N 件折（每組只折組內最便宜那件；percentOff 100 = 第 N 件免費） */
  | {
      type: 'percent_discount_nth_unit'
      groupSize: number
      percentOff: number
      repeatMode: 'once_per_order' | 'every_full_group'
    }
  /** 滿額折（搭配 eligible_subtotal_gte / order_subtotal_gte 條件） */
  | { type: 'order_fixed_discount'; amount: number; allocation: AllocationMode }
  | { type: 'order_percent_discount'; percentOff: number; maxAmount?: number; allocation: AllocationMode }
  /** 免運 */
  | { type: 'free_shipping' }
  /** 滿額贈（不折價，產生 reward intent，由 Reward Orchestrator 落地） */
  | {
      type: 'gift_item'
      productId: number | string
      quantity: number
      /**
       * 這件贈品的單位成本（NT$）。由 snapshots.ts（唯一 I/O 層）查好餵進來——
       * evaluator 是純函式，不可自己去查。
       * null = 查不到成本 → evaluator 會 fail closed 拒絕這條規則
       *（工作單 §10.1「成本缺失時 fail closed：不套折扣並記錄 reason」）。
       */
      unitCostTwd: number | null
    }
  /** 點數倍率（reward intent；實際發點仍走 points ledger） */
  | {
      type: 'points_multiplier'
      multiplier: number
      /** 每消費 1 元發幾點（LoyaltySettings.pointsConfig.pointsPerDollar） */
      pointsPerDollar: number | null
      /** 幾點折抵 1 元（LoyaltySettings.pointsConfig.pointsToCurrencyRate） */
      pointsToCurrencyRate: number | null
      /**
       * 下單當下無法得知最終發點倍率（會員等級 × 訂閱權益都在付款時才確定），
       * 所以預留時用這個係數保守高估，付款後再依實際發點差額修正。
       * 偏商家安全：寧可先多佔預算，也不要事後超支。
       */
      costSafetyFactor: number
    }
  /** 發 XP / Mystery Key 等（reward intent；P1 Member Economy 接手落地） */
  | {
      type: 'grant_reward'
      rewardKey: string
      quantity: number
      /** 對齊 UserRewards.rewardType 的封閉 enum；未指定時落地為 'voucher' */
      rewardType?: UserRewardType
    }
  /**
   * 限量券包（先搶先贏）。付款成功後發一張「下次可用」的券給顧客。
   * 總量上限掛在 marketing_campaigns.commerceDropTotal（不掛規則，因為規則
   * status=active 後 effect 被鎖，上線後要加碼就動不了）。
   */
  | {
      type: 'coupon_drop'
      /** 模板券 doc id；落地時複製欄位動態產生一次性券碼 */
      couponId: number | string
      /**
       * 這張券的最大曝險面額（NT$）：固定額券 = discountValue；
       * 百分比券 = maxDiscountAmount，沒設上限就是算不出。
       * 由 snapshots.ts 查好餵進來，null = fail closed。
       */
      faceValueTwd: number | null
      quantity: number
    }
  /**
   * 神秘禮物（付款成功後抽獎，保證有獎）。
   * 抽獎不可放進 evaluator（本檔開頭的不變量：純函式、無隨機、無 Date.now），
   * 所以這裡只產生 intent，由 paidRewardOrchestrator 在付款後抽。
   */
  | {
      type: 'mystery_gift'
      /** 對應 PrizePools.eligibleGames 的值 */
      poolTag: string
      /** 硬排除的獎項型別；Alan 拍板獎池不含 'none'（銘謝惠顧） */
      excludePrizeTypes: string[]
      /**
       * 獎池中最高的獎項價值（NT$），下單時用它保守預留預算，
       * 付款後抽完再用實際 estimatedValue 做差額修正。
       * null = 獎池有獎品缺 estimatedValue 且無法自動換算 → fail closed。
       */
      maxPrizeValueTwd: number | null
      /**
       * 保底獎的 PrizePools.slug（必須 inventoryUnlimited=true）。
       * 「保證有獎」的最後一道保證：限量獎全被搶完時發這個。
       */
      fallbackPoolSlug: string | null
    }

// ─────────────────────────────────────────────────────────────────────────────
// 疊加與護欄
// ─────────────────────────────────────────────────────────────────────────────

/** 規則的利益類別：疊加判斷用 */
export type BenefitClass = 'item_promo' | 'order_promo' | 'shipping' | 'coupon' | 'member_tier'

export interface PromotionStacking {
  /** 同一 exclusiveGroup 只會套用優先序最前的一條 */
  exclusiveGroup?: string
  /**
   * 可與哪些利益類別共存：'all' = 不額外限制（僅受 exclusiveGroup 約束）。
   * 陣列時做雙向檢查：B 要疊上已套用的 A，需 B.stackableWith 含 A.class 且
   * A.stackableWith 含 B.class（'all' 視為包含）。
   */
  stackableWith: 'all' | BenefitClass[]
  /** 此規則單筆訂單最高總折抵（含重複折的加總）；undefined = 不封頂 */
  maxBenefitPerOrder?: number
}

export interface PromotionGuardrails {
  /**
   * 最低毛利率 %（對受影響 eligible 行折後計算）。
   * 設了此值但任一 eligible 行缺 unitCost → fail closed（missing_cost_data）。
   */
  minimumGrossMarginPct?: number
  /** 每人可套用次數上限（跨訂單累計，由呼叫端提供 usage snapshot） */
  perUserLimit?: number
  /** 全活動可套用總次數上限 */
  totalUsageLimit?: number
}

// ─────────────────────────────────────────────────────────────────────────────
// 規則 snapshot（evaluator 的輸入單位；由 PromotionRules collection 或 Coupon adapter 產生）
// ─────────────────────────────────────────────────────────────────────────────

export interface PromotionRuleSnapshot {
  /** 穩定識別：`${campaignId}:${slug}:v${version}` 由呼叫端組 */
  ruleKey: string
  /** PromotionRules doc id（coupon adapter 產生時為 null） */
  ruleDocId: number | string | null
  campaignId: number | string | null
  slug: string
  version: number
  source: 'campaign_rule' | 'coupon'
  /** coupon 來源時記 coupon code / doc id，回寫 redemption 用 */
  couponId?: number | string
  couponCode?: string
  benefitClass: BenefitClass
  /** 數字小的先評估（doc §7.3 的階段內排序） */
  priority: number
  scope: PromotionScope
  when: PromotionCondition[]
  then: PromotionEffect
  stacking: PromotionStacking
  guardrails: PromotionGuardrails
  /** 活動排程（server 權威時間；evaluator 只比對 now） */
  startAt?: string | null
  endAt?: string | null
}

// ─────────────────────────────────────────────────────────────────────────────
// 購物車 / 會員 snapshot
// ─────────────────────────────────────────────────────────────────────────────

export interface CartLineSnapshot {
  /** 行識別（product-variant 組合鍵；allocation 回寫用） */
  lineId: string
  productId: number | string
  variantKey?: string | null
  /** 單價（伺服器讀出的現價，不信 client） */
  unitPrice: number
  quantity: number
  /** 單件成本；毛利護欄用。可缺，但缺值時任何設了 margin floor 的規則都不會套用 */
  unitCost?: number | null
  categoryIds: Array<number | string>
  tags: string[]
  /** 特殊行標記：贈品 / 加價購 / Bundle 子行（預設不參與 eligible 計算） */
  isGiftLine?: boolean
  isAddOnLine?: boolean
  bundleId?: number | string | null
}

export interface MemberSnapshot {
  userId: number | string | null
  tierSlug?: string | null
  segmentSlugs: string[]
  isFirstPurchase?: boolean
  blocked?: boolean
  /** 歷史成立訂單數；repeat_purchase 條件用（isFirstPurchase 是它的補集） */
  orderCount?: number
  /** 生日月份 1-12（UTC 取月，與 memberAnalytics/birthdayEngine 同一套算法）；未填生日 = null */
  birthdayMonth?: number | null
}

export interface UsageSnapshot {
  /** ruleKey → 此使用者歷史已套用次數 */
  perUserApplied: Record<string, number>
  /** ruleKey → 全活動已套用次數 */
  totalApplied: Record<string, number>
  /** campaignId(string) → 活動剩餘預算（NT$)；null = 該活動沒設預算上限 */
  budgetRemaining: Record<string, number | null>
}

export interface EvaluationInput {
  /** ISO 時間（server now；evaluator 不呼叫 Date.now） */
  now: string
  channel: 'web' | 'app' | 'line'
  lines: CartLineSnapshot[]
  member: MemberSnapshot | null
  /** 原始運費（免運效果的抵扣基準） */
  shippingFee: number
  rules: PromotionRuleSnapshot[]
  usage: UsageSnapshot
  /**
   * 本次結帳帶到的推薦碼（來源：?ref= 存的 30 天 cookie，伺服器端讀）。
   * referral_attributed 條件用。null/undefined = 無歸因。
   */
  referralCode?: string | null
  /**
   * 下單當下的月份 1-12（台北時區，由呼叫端算好傳入）。
   * birthday_month 條件用；evaluator 不自己算時區。
   */
  currentMonth?: number
}

// ─────────────────────────────────────────────────────────────────────────────
// 輸出
// ─────────────────────────────────────────────────────────────────────────────

/** 機器可讀拒絕/說明碼（分析與客服可解釋性） */
export type ReasonCode =
  | 'applied'
  | 'not_started'
  | 'ended'
  | 'no_eligible_lines'
  | 'condition_not_met'
  | 'member_blocked'
  | 'exclusive_group_conflict'
  | 'stacking_conflict'
  | 'per_user_limit_reached'
  | 'total_usage_limit_reached'
  | 'budget_exhausted'
  | 'budget_unknown'
  | 'missing_cost_data'
  | 'margin_floor_violation'
  | 'zero_discount'
  | 'invalid_rule'

export interface LineAllocation {
  lineId: string
  /** 此行分攤到的折抵（整數，加總 = discountAmount） */
  amount: number
}

export interface AppliedPromotion {
  ruleKey: string
  ruleDocId: number | string | null
  campaignId: number | string | null
  slug: string
  version: number
  source: 'campaign_rule' | 'coupon'
  couponId?: number | string
  couponCode?: string
  benefitClass: BenefitClass
  effectType: PromotionEffect['type']
  /** 商品折抵金額（免運時為 0，運費抵在 shippingDiscount） */
  discountAmount: number
  /** 免運抵扣金額 */
  shippingDiscountAmount: number
  /**
   * 這條規則佔用的**活動預算成本**（NT$），與折扣完全分開。
   *
   * 為什麼不能借用 discountAmount：pricing.ts 會把 discountAmount 加總成
   * promotionDiscount 並真的從訂單金額扣掉。把贈品成本記進去等於白送顧客
   * 一筆等額折扣。這一欄只進 marketing_campaigns.commerce_budget_spent，
   * 不影響顧客付多少。
   *
   * 也不可與 Orders.promotion.itemsCostSnapshot 混用——那是整車 COGS
   *（含顧客自己付錢買的商品），語意完全不同。
   */
  budgetCostAmount: number
  allocations: LineAllocation[]
  /** 套用了幾組（every_full_group 時 >1） */
  groupsApplied: number
  reasonCodes: ReasonCode[]
}

export interface RejectedPromotion {
  ruleKey: string
  campaignId: number | string | null
  slug: string
  version: number
  source: 'campaign_rule' | 'coupon'
  couponCode?: string
  reasonCodes: ReasonCode[]
}

export interface RewardIntent {
  ruleKey: string
  campaignId: number | string | null
  type: 'gift_item' | 'points_multiplier' | 'grant_reward' | 'coupon_drop' | 'mystery_gift'
  productId?: number | string
  quantity?: number
  multiplier?: number
  rewardKey?: string
  rewardType?: UserRewardType
  /** coupon_drop：模板券 doc id */
  couponId?: number | string
  /** mystery_gift：對應 PrizePools.eligibleGames */
  poolTag?: string
  /** mystery_gift：限量獎全被搶完時的保底獎 slug */
  fallbackPoolSlug?: string
  /** mystery_gift：抽獎時要排除的獎項型別（Alan 拍板不含 'none'） */
  excludePrizeTypes?: string[]
  /**
   * 「每人每檔活動 1 次」與重放冪等共用的鍵（落地端組成
   * `${claimKey}:u${userId}` 寫進 promotion-drop-claims.idempotencyKey）。
   */
  claimKey?: string
  /** 下單當下預留的估算成本（NT$）；付款後用實際值做差額修正 */
  costAmount?: number
}

/** 前台 Cart Progress 用的提示（0/2 → 1/2 → UNLOCKED） */
export interface ProgressHint {
  ruleKey: string
  campaignId: number | string | null
  slug: string
  kind: 'quantity' | 'subtotal'
  current: number
  target: number
  remaining: number
  unlocked: boolean
  /** 解鎖後可得的效果描述參數（前台顯示用） */
  effectType: PromotionEffect['type']
  effectAmount?: number
  effectPercentOff?: number
}

export interface EvaluationResult {
  applications: AppliedPromotion[]
  rejections: RejectedPromotion[]
  rewardIntents: RewardIntent[]
  progress: ProgressHint[]
  /** 商品折抵總額（不含運費抵扣） */
  discountTotal: number
  /** 運費抵扣總額（≤ shippingFee） */
  shippingDiscountTotal: number
  /** eligible 行小計（除錯/對帳用） */
  eligibleSubtotalByRule: Record<string, number>
}
