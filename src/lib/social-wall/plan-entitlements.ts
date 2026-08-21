export type SocialWallPlan = 'free' | 'creator' | 'pro' | 'agency'

export type SocialWallQuotaResource = 'widget' | 'domain'

export interface SocialWallPlanEntitlements {
  plan: SocialWallPlan
  widgetLimit: number
  domainLimit: number
}

export interface EvaluatePlanQuotaInput {
  plan: SocialWallPlan
  resource: SocialWallQuotaResource
  currentCount: number
  now: Date
  subscriptionEndsAt?: Date | null
}

export type PlanQuotaReason =
  | 'within_limit'
  | 'widget_limit_reached'
  | 'domain_limit_reached'
  | 'subscription_expired'

export interface PlanQuotaDecision {
  allowed: boolean
  plan: SocialWallPlan
  resource: SocialWallQuotaResource
  used: number
  limit: number
  reason: PlanQuotaReason
}

const PLAN_ENTITLEMENTS: Readonly<Record<SocialWallPlan, SocialWallPlanEntitlements>> = {
  free: { plan: 'free', widgetLimit: 1, domainLimit: 1 },
  creator: { plan: 'creator', widgetLimit: 3, domainLimit: 3 },
  pro: { plan: 'pro', widgetLimit: 20, domainLimit: 20 },
  agency: { plan: 'agency', widgetLimit: 250, domainLimit: 250 },
}

/** Returns the immutable resource limits for a public Social Wall plan. */
export function getPlanEntitlements(_plan: SocialWallPlan): SocialWallPlanEntitlements {
  const entitlements = PLAN_ENTITLEMENTS[_plan]
  if (!entitlements) throw new Error('Unknown social wall plan')
  return { ...entitlements }
}

/** Decides whether one more widget or licensed domain may be created. */
export function evaluatePlanQuota(_input: EvaluatePlanQuotaInput): PlanQuotaDecision {
  if (!Number.isSafeInteger(_input.currentCount) || _input.currentCount < 0) {
    throw new Error('Current usage count must be a non-negative integer')
  }
  if (Number.isNaN(_input.now.getTime())) throw new Error('Invalid quota evaluation time')

  const entitlements = getPlanEntitlements(_input.plan)
  const limit = _input.resource === 'widget'
    ? entitlements.widgetLimit
    : entitlements.domainLimit
  const base = {
    plan: _input.plan,
    resource: _input.resource,
    used: _input.currentCount,
    limit,
  }

  if (_input.plan !== 'free') {
    const endsAt = _input.subscriptionEndsAt?.getTime()
    if (endsAt === undefined || Number.isNaN(endsAt) || endsAt <= _input.now.getTime()) {
      return { ...base, allowed: false, reason: 'subscription_expired' }
    }
  }

  if (_input.currentCount >= limit) {
    return {
      ...base,
      allowed: false,
      reason: _input.resource === 'widget' ? 'widget_limit_reached' : 'domain_limit_reached',
    }
  }

  return { ...base, allowed: true, reason: 'within_limit' }
}
