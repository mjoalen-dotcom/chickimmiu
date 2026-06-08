import type { Payload } from 'payload'

import { adjustWallet } from '../wallet/server'

/**
 * 推薦「註冊」獎勵發放（與 Orders.ts 的「首購」獎勵是不同案）。
 *
 * - 冪等：users.registrationReferralRewarded 旗標（先標記再發獎，防 afterChange 再進入重複發）。
 * - email 驗證 gating：ReferralSettings.antiAbuse.emailVerificationRequired（預設 true）→ 需
 *   user._verified === true 才發；未驗證先 defer（旗標不標），待之後驗證 + 登入再補發。
 * - 發 ReferralSettings.rewards.{referrerSignupReward, refereeSignupReward} 購物金給雙方。
 *
 * 由兩處呼叫（皆 best-effort，重複呼叫安全）：
 *   1. customerRegister endpoint —— 建帳 + signup reward 之後（控制 ordering，不被絕對值覆蓋）。
 *      涵蓋「免驗證」或「emailVerificationRequired=false」可立即發的情境。
 *   2. Users.afterLogin —— 首次登入（Payload 會擋未驗證登入，故能登入即已驗證）。
 *      涵蓋「先註冊、後驗證」情境的可靠補發。
 */

function refId(v: unknown): string | number | undefined {
  if (v === undefined || v === null) return undefined
  if (typeof v === 'object') return (v as Record<string, unknown>).id as string | number | undefined
  return v as string | number
}

export interface GrantResult {
  granted: boolean
  reason?: string
  referrerReward?: number
  refereeReward?: number
}

export async function grantRegistrationReferralReward(
  payload: Payload,
  userId: string | number,
): Promise<GrantResult> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const p = payload as any

  const user = (await p.findByID({ collection: 'users', id: userId, depth: 0 })) as
    | Record<string, unknown>
    | undefined
  if (!user) return { granted: false, reason: 'no_user' }
  if (user.registrationReferralRewarded === true) return { granted: false, reason: 'already' }

  const referrerId = refId(user.referredBy)
  if (referrerId === undefined) return { granted: false, reason: 'no_referrer' }
  if (String(referrerId) === String(user.id)) return { granted: false, reason: 'self_referral' }

  const settings = (await p.findGlobal({ slug: 'referral-settings', depth: 0 })) as
    | Record<string, unknown>
    | undefined
  const rewards = (settings?.rewards as Record<string, unknown>) || {}
  if (rewards.enabled === false) return { granted: false, reason: 'disabled' }

  const antiAbuse = (settings?.antiAbuse as Record<string, unknown>) || {}
  const needVerify = antiAbuse.emailVerificationRequired !== false // 預設 true
  if (needVerify && user._verified !== true) {
    return { granted: false, reason: 'awaiting_verification' }
  }

  const refereeReward = Math.max(0, Math.floor(Number(rewards.refereeSignupReward ?? 0)))
  const referrerReward = Math.max(0, Math.floor(Number(rewards.referrerSignupReward ?? 0)))

  // 先標旗標（防 afterChange / 並發再進入重複發），再發獎。
  // 取捨：發獎若 throw，旗標已標 → 寧可漏發不重發（雙重入帳對金流更糟）。
  await p.update({
    collection: 'users',
    id: user.id,
    data: { registrationReferralRewarded: true },
    overrideAccess: true,
  })

  if (refereeReward > 0) {
    await adjustWallet(payload, {
      userId: user.id as string | number,
      wallet: 'shoppingCredit',
      amount: refereeReward,
      type: 'earn',
      source: 'referral',
      description: '推薦註冊禮（被推薦人）',
    })
  }
  if (referrerReward > 0) {
    await adjustWallet(payload, {
      userId: referrerId,
      wallet: 'shoppingCredit',
      amount: referrerReward,
      type: 'earn',
      source: 'referral',
      description: '推薦註冊禮（您推薦的好友完成註冊）',
    })
  }

  return { granted: true, referrerReward, refereeReward }
}
