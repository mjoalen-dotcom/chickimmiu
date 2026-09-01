import type { Payload } from 'payload'

import { recordWalletTxn } from '../wallet/server'
import { grantRegistrationReferralReward } from '../referral/registrationReward'

/**
 * 新會員上線流程（推薦碼綁定 → 註冊禮 → 推薦註冊獎勵）
 * ═══════════════════════════════════════════════════
 * 「推薦獎勵與註冊禮不應因註冊方式而異」——App 團隊 2026-08-27 實測回報：
 * 同一組推薦碼走 POST /api/customers/register 會綁推薦人 + 發 100 點，走
 * POST /api/v1/auth/social（社群註冊）兩者都沒有。根因是註冊禮與推薦綁定寫死在
 * customerRegister endpoint 裡，社群路徑（App 原生 + 網頁 NextAuth）沒有這段。
 *
 * 這支檔案把那段邏輯抽成三條路徑共用的唯一實作：
 *   1. POST /api/customers/register     （Email 註冊）
 *   2. POST /api/v1/auth/social         （App 原生 Google / Apple / LINE）
 *   3. NextAuth signIn callback         （網頁社群登入）
 *
 * 全程 best-effort：任何一步失敗都只記 log，不擋註冊/登入。
 *
 * ⚠️ 只能對「這次真的新建的帳號」呼叫（social 路徑請用 linkOrCreateSocialUser
 * 回傳的 created 旗標判斷）——既有會員第一次改用社群登入時也會「第一次出現這個
 * socialId」，那不是新註冊，不該再發一次註冊禮。本檔另有兩道防線：
 *   ‧ 註冊禮以「已有 source='welcome' 的點數帳列」判定是否發過（冪等）
 *   ‧ 點數/購物金一律增量入帳（不是絕對值覆寫）——萬一誤呼叫也不會把
 *     既有會員的餘額洗成 100
 */

type LooseRecord = Record<string, unknown>

export interface OnboardingResult {
  /** 這次綁定的推薦人（原本就有或查無推薦碼 → undefined） */
  referredBy?: string | number
  signupPoints: number
  signupCredit: number
  /** grantRegistrationReferralReward 是否真的發了雙方購物金 */
  referralRewardGranted: boolean
  notes: string[]
}

function refId(v: unknown): string | number | undefined {
  if (v === undefined || v === null) return undefined
  if (typeof v === 'object') return (v as LooseRecord).id as string | number | undefined
  return v as string | number
}

/**
 * 推薦碼 → 推薦人 id。查無不是錯誤（不擋註冊，只是不連推薦關係），
 * 與 customerRegister 既有語意一致。
 */
export async function resolveReferrerId(
  payload: Payload,
  referralCode: string | null | undefined,
): Promise<string | number | undefined> {
  const code = (referralCode || '').trim()
  if (!code) return undefined
  try {
    const res = await payload.find({
      collection: 'customers',
      where: { referralCode: { equals: code } },
      limit: 1,
      pagination: false,
      depth: 0,
      overrideAccess: true,
    })
    return res.docs.length > 0 ? (res.docs[0].id as string | number) : undefined
  } catch {
    return undefined
  }
}

/** 已經發過註冊禮？以 points-transactions(source='welcome') 為準（冪等防線） */
async function alreadyGotSignupReward(payload: Payload, userId: string | number): Promise<boolean> {
  try {
    const res = await payload.count({
      collection: 'points-transactions',
      where: {
        and: [{ user: { equals: userId } }, { source: { equals: 'welcome' } }],
      } as never,
      overrideAccess: true,
    })
    return res.totalDocs > 0
  } catch {
    // 查不到就當沒發過（寧可補發也不要讓正常註冊漏發；重複風險由呼叫端的
    // created 旗標把關）
    return false
  }
}

/**
 * 對「剛建立的新會員」跑完整上線流程。
 *
 * @param referralCode 邀請人的推薦碼（選填）。已在 create 時寫過 referredBy 的
 *                     路徑（customerRegister）可不傳，本函式會沿用既有值。
 */
export async function onboardNewCustomer(
  payload: Payload,
  args: { userId: string | number; referralCode?: string | null },
): Promise<OnboardingResult> {
  const { userId } = args
  const result: OnboardingResult = {
    signupPoints: 0,
    signupCredit: 0,
    referralRewardGranted: false,
    notes: [],
  }

  // ── 1. 推薦碼綁定（referredBy 尚未設定時才綁；禁自我推薦）──
  try {
    const user = (await payload.findByID({
      collection: 'customers',
      id: userId,
      depth: 0,
      overrideAccess: true,
    })) as unknown as LooseRecord | undefined

    const existingReferrer = refId(user?.referredBy)
    if (existingReferrer !== undefined) {
      result.referredBy = existingReferrer
    } else {
      const referrerId = await resolveReferrerId(payload, args.referralCode)
      if (referrerId !== undefined && String(referrerId) !== String(userId)) {
        await payload.update({
          collection: 'customers',
          id: userId,
          data: { referredBy: referrerId } as never,
          overrideAccess: true,
        })
        result.referredBy = referrerId
      } else if (referrerId !== undefined) {
        result.notes.push('self_referral_ignored')
      } else if ((args.referralCode || '').trim()) {
        result.notes.push('referral_code_not_found')
      }
    }
  } catch (err) {
    result.notes.push('referral_bind_failed')
    console.error(
      '[onboarding] referral bind failed:',
      err instanceof Error ? err.message : String(err),
    )
  }

  // ── 2. 新會員註冊禮（LoyaltySettings.signupReward）──
  try {
    if (await alreadyGotSignupReward(payload, userId)) {
      result.notes.push('signup_reward_already_granted')
    } else {
      const loyalty = (await payload.findGlobal({
        slug: 'loyalty-settings',
        depth: 0,
      })) as unknown as
        | {
            signupReward?: {
              enabled?: boolean
              points?: number
              shoppingCredit?: number
              description?: string
            }
          }
        | undefined
      const reward = loyalty?.signupReward
      const rewardPoints = Math.max(0, Math.floor(Number(reward?.points ?? 0)))
      const rewardCredit = Math.max(0, Math.floor(Number(reward?.shoppingCredit ?? 0)))

      if (reward?.enabled !== false && (rewardPoints > 0 || rewardCredit > 0)) {
        const desc = (reward?.description || '新會員註冊禮').trim()

        // 增量入帳（讀現值再加）——新帳號現值為 0，結果與舊版絕對值寫入相同，
        // 但誤對既有會員呼叫時不會把餘額洗掉。
        const fresh = (await payload.findByID({
          collection: 'customers',
          id: userId,
          depth: 0,
          overrideAccess: true,
        })) as unknown as LooseRecord
        const curPoints = Number(fresh?.points ?? 0) || 0
        const curCredit = Number(fresh?.shoppingCredit ?? 0) || 0

        // ⚠️ 順序：先寫帳本、後動餘額。
        // 上面的冪等判定是「有沒有 source='welcome' 的帳列」，所以帳本那筆同時是
        // 這段的鎖。若反過來先加餘額，帳本寫入失敗時就會變成「點數已發、鎖沒建起來」
        // → 下次呼叫再發一次。現在的順序下，帳本失敗 = 整筆不發（可安全重試），
        // 餘額失敗 = 帳本有記錄可對帳，且不會重複發 —— 與 registrationReward
        // 「寧可漏發不重發」的取捨一致。
        if (rewardPoints > 0) {
          await payload.create({
            collection: 'points-transactions',
            data: {
              user: userId,
              type: 'earn',
              amount: rewardPoints,
              balance: curPoints + rewardPoints,
              source: 'welcome',
              description: desc,
            } as never,
            overrideAccess: true,
          })
          result.signupPoints = rewardPoints
        }

        if (rewardCredit > 0) {
          await recordWalletTxn(payload, {
            userId,
            wallet: 'shoppingCredit',
            amount: rewardCredit,
            type: 'earn',
            source: 'signup',
            description: desc,
            balanceOverride: curCredit + rewardCredit,
          })
          result.signupCredit = rewardCredit
        }

        await payload.update({
          collection: 'customers',
          id: userId,
          data: {
            ...(rewardPoints > 0 ? { points: curPoints + rewardPoints } : {}),
            ...(rewardCredit > 0 ? { shoppingCredit: curCredit + rewardCredit } : {}),
          } as never,
          overrideAccess: true,
        })
      }
    }
  } catch (err) {
    result.notes.push('signup_reward_failed')
    console.error(
      '[onboarding] signup reward failed:',
      err instanceof Error ? err.message : String(err),
    )
  }

  // ── 3. 推薦註冊獎勵（雙方購物金）──
  // 必須排在註冊禮之後：helper 內走 adjustWallet 增量入帳，先跑會被上面的
  // 餘額寫入覆蓋（customerRegister 原始註解即載明此 ordering）。
  if (result.referredBy !== undefined) {
    try {
      const granted = await grantRegistrationReferralReward(payload, userId)
      result.referralRewardGranted = granted.granted
      if (!granted.granted && granted.reason) result.notes.push(`referral_reward_${granted.reason}`)
    } catch (err) {
      result.notes.push('referral_reward_failed')
      console.error(
        '[onboarding] registration referral reward failed:',
        err instanceof Error ? err.message : String(err),
      )
    }
  }

  return result
}
