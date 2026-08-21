import assert from 'node:assert/strict'
import test from 'node:test'

import { evaluatePlanQuota, getPlanEntitlements, type SocialWallPlan } from './plan-entitlements'

test('publishes the agreed widget and domain limits for every plan', () => {
  const expected: Record<SocialWallPlan, { widgetLimit: number; domainLimit: number }> = {
    free: { widgetLimit: 1, domainLimit: 1 },
    creator: { widgetLimit: 3, domainLimit: 3 },
    pro: { widgetLimit: 20, domainLimit: 20 },
    agency: { widgetLimit: 250, domainLimit: 250 },
  }

  for (const [plan, limits] of Object.entries(expected) as Array<
    [SocialWallPlan, (typeof expected)[SocialWallPlan]]
  >) {
    assert.deepEqual(getPlanEntitlements(plan), { plan, ...limits })
  }
})

test('allows one more resource below a plan limit', () => {
  const now = new Date('2026-08-16T00:00:00.000Z')

  assert.deepEqual(
    evaluatePlanQuota({
      plan: 'creator',
      resource: 'widget',
      currentCount: 2,
      now,
      subscriptionEndsAt: new Date('2026-09-16T00:00:00.000Z'),
    }),
    {
      allowed: true,
      plan: 'creator',
      resource: 'widget',
      used: 2,
      limit: 3,
      reason: 'within_limit',
    },
  )
})

test('denies creation at both widget and domain boundaries', () => {
  const now = new Date('2026-08-16T00:00:00.000Z')

  assert.deepEqual(
    evaluatePlanQuota({ plan: 'free', resource: 'widget', currentCount: 1, now }),
    {
      allowed: false,
      plan: 'free',
      resource: 'widget',
      used: 1,
      limit: 1,
      reason: 'widget_limit_reached',
    },
  )
  assert.deepEqual(
    evaluatePlanQuota({
      plan: 'pro',
      resource: 'domain',
      currentCount: 20,
      now,
      subscriptionEndsAt: new Date('2026-09-16T00:00:00.000Z'),
    }),
    {
      allowed: false,
      plan: 'pro',
      resource: 'domain',
      used: 20,
      limit: 20,
      reason: 'domain_limit_reached',
    },
  )
})

test('treats a paid subscription as expired at the exact end instant', () => {
  const now = new Date('2026-08-16T00:00:00.000Z')

  assert.deepEqual(
    evaluatePlanQuota({
      plan: 'agency',
      resource: 'widget',
      currentCount: 0,
      now,
      subscriptionEndsAt: new Date('2026-08-16T00:00:00.000Z'),
    }),
    {
      allowed: false,
      plan: 'agency',
      resource: 'widget',
      used: 0,
      limit: 250,
      reason: 'subscription_expired',
    },
  )
})

test('keeps a paid subscription active until its end instant and Free does not require an end date', () => {
  const now = new Date('2026-08-16T00:00:00.000Z')

  assert.equal(
    evaluatePlanQuota({
      plan: 'agency',
      resource: 'domain',
      currentCount: 249,
      now,
      subscriptionEndsAt: new Date('2026-08-16T00:00:01.000Z'),
    }).allowed,
    true,
  )
  assert.equal(
    evaluatePlanQuota({ plan: 'free', resource: 'domain', currentCount: 0, now }).allowed,
    true,
  )
})

test('rejects negative usage instead of turning it into extra quota', () => {
  assert.throws(
    () =>
      evaluatePlanQuota({
        plan: 'creator',
        resource: 'widget',
        currentCount: -1,
        now: new Date('2026-08-16T00:00:00.000Z'),
        subscriptionEndsAt: new Date('2026-09-16T00:00:00.000Z'),
      }),
    /count|usage|negative|負/i,
  )
})

test('rejects unknown plans and invalid quota timestamps', () => {
  assert.throws(() => getPlanEntitlements('enterprise' as SocialWallPlan), /unknown|plan/i)
  assert.throws(
    () => evaluatePlanQuota({ plan: 'free', resource: 'widget', currentCount: 0, now: new Date('invalid') }),
    /time|invalid/i,
  )
})

test('paid plans fail closed when the subscription end is missing or invalid', () => {
  const now = new Date('2026-08-16T00:00:00.000Z')
  assert.equal(evaluatePlanQuota({ plan: 'creator', resource: 'widget', currentCount: 0, now }).reason, 'subscription_expired')
  assert.equal(
    evaluatePlanQuota({ plan: 'pro', resource: 'domain', currentCount: 0, now, subscriptionEndsAt: new Date('invalid') }).reason,
    'subscription_expired',
  )
})
