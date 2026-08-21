import { randomBytes } from 'node:crypto'

import { createLocalReq, getPayload, type TypedUser } from 'payload'

import config from '../src/payload.config'

const DEMO_CUSTOMER_EMAIL = 'wall-demo@ckmu.invalid'
const DEMO_WIDGET_ID = 'kim-lafayette-demo'
const DEMO_HOST = 'blog.kimlafayette.com'

// merge 後 payload-types 對 customers 關聯是嚴格 number id —— 統一轉 number。
// update-by-id 的回傳 union（doc | BulkOperationResult）也靠這裡 narrow。
function idOf(value: unknown): number {
  return Number((value as { id: string | number }).id)
}

async function seed() {
  if (process.env.SOCIAL_WALL_DEMO_SEED !== '1') {
    throw new Error('拒絕執行：請明確設定 SOCIAL_WALL_DEMO_SEED=1')
  }

  const payload = await getPayload({ config })
  const admins = await payload.find({
    collection: 'users',
    where: { role: { equals: 'admin' } },
    limit: 1,
    depth: 0,
    overrideAccess: true,
  })
  const admin = admins.docs[0]
  if (!admin) throw new Error('找不到平台管理員，無法建立受控示範資料')

  const req = await createLocalReq({ user: admin as TypedUser }, payload)

  const existingCustomers = await payload.find({
    collection: 'customers',
    where: { email: { equals: DEMO_CUSTOMER_EMAIL } },
    limit: 1,
    depth: 0,
    overrideAccess: true,
    req,
  })
  const customer = existingCustomers.docs[0] ?? await payload.create({
    collection: 'customers',
    data: {
      name: 'Kim Lafayette 社群牆展示',
      email: DEMO_CUSTOMER_EMAIL,
      password: randomBytes(32).toString('base64url'),
      isGuest: false,
      signupSource: 'admin',
      _verified: true,
    },
    disableVerificationEmail: true,
    overrideAccess: true,
    req,
  })
  const owner = idOf(customer)

  const existingConnections = await payload.find({
    collection: 'social-wall-connections',
    where: {
      and: [
        { owner: { equals: owner } },
        { externalAccountId: { equals: DEMO_WIDGET_ID } },
      ],
    },
    limit: 1,
    depth: 0,
    overrideAccess: true,
    req,
  })
  const connectionData = {
    owner,
    provider: 'instagram' as const,
    externalAccountId: DEMO_WIDGET_ID,
    username: 'kimlafayette',
    displayName: 'Kim Lafayette',
    status: 'pending' as const,
    lastError: '等待 Meta 官方授權；封測期間使用站內示範內容。',
  }
  const connection = existingConnections.docs[0]
    ? await payload.update({
        collection: 'social-wall-connections',
        id: idOf(existingConnections.docs[0]),
        data: connectionData,
        overrideAccess: true,
        req,
      })
    : await payload.create({
        collection: 'social-wall-connections',
        data: connectionData,
        overrideAccess: true,
        req,
      })

  const existingWidgets = await payload.find({
    collection: 'social-wall-widgets',
    where: { publicId: { equals: DEMO_WIDGET_ID } },
    limit: 1,
    depth: 0,
    overrideAccess: true,
    req,
  })
  const widgetData = {
    owner,
    connection: idOf(connection),
    name: 'Kim Lafayette 社群牆',
    publicId: DEMO_WIDGET_ID,
    status: 'published' as const,
    appearance: {
      layout: 'grid' as const,
      columns: 3,
      gap: 12,
      radius: 16,
      theme: 'light' as const,
      showCaption: true,
      showStats: true,
    },
    maxPosts: 12,
    publishedAt: new Date().toISOString(),
  }
  const widget = existingWidgets.docs[0]
    ? await payload.update({
        collection: 'social-wall-widgets',
        id: idOf(existingWidgets.docs[0]),
        data: widgetData,
        overrideAccess: true,
        req,
      })
    : await payload.create({
        collection: 'social-wall-widgets',
        data: widgetData,
        overrideAccess: true,
        req,
      })

  const existingSubscriptions = await payload.find({
    collection: 'social-wall-subscriptions',
    where: { owner: { equals: owner } },
    limit: 1,
    depth: 0,
    overrideAccess: true,
    req,
  })
  const subscriptionData = {
    owner,
    plan: 'free' as const,
    status: 'active' as const,
    billingCycle: 'monthly' as const,
    priceTwd: 0,
    paymentProvider: 'manual' as const,
    cancelAtPeriodEnd: false,
  }
  const subscription = existingSubscriptions.docs[0]
    ? await payload.update({
        collection: 'social-wall-subscriptions',
        id: idOf(existingSubscriptions.docs[0]),
        data: subscriptionData,
        overrideAccess: true,
        req,
      })
    : await payload.create({
        collection: 'social-wall-subscriptions',
        data: subscriptionData,
        overrideAccess: true,
        req,
      })

  const existingLicenses = await payload.find({
    collection: 'social-wall-licenses',
    where: {
      and: [
        { widget: { equals: idOf(widget) } },
        { hostPattern: { equals: DEMO_HOST } },
      ],
    },
    limit: 1,
    depth: 0,
    overrideAccess: true,
    req,
  })
  const licenseData = {
    owner,
    widget: idOf(widget),
    hostPattern: DEMO_HOST,
    status: 'active' as const,
    issuedAt: existingLicenses.docs[0]?.issuedAt ?? new Date().toISOString(),
  }
  const license = existingLicenses.docs[0]
    ? await payload.update({
        collection: 'social-wall-licenses',
        id: idOf(existingLicenses.docs[0]),
        data: licenseData,
        overrideAccess: true,
        req,
      })
    : await payload.create({
        collection: 'social-wall-licenses',
        data: licenseData,
        overrideAccess: true,
        req,
      })

  const result = {
    msg: '社群牆封測資料已就緒',
    customerId: owner,
    connectionId: idOf(connection),
    widgetId: idOf(widget),
    subscriptionId: idOf(subscription),
    licenseId: idOf(license),
    publicId: DEMO_WIDGET_ID,
    host: DEMO_HOST,
  }
  process.stderr.write(`[seed-social-wall-demo] ${JSON.stringify(result)}\n`)
}

// Payload CLI 會在 script import 完成後結束程序；必須 top-level await，否則
// fire-and-forget Promise 會在 getPayload() 完成前被安靜中止。
await seed().catch((error) => {
  process.stderr.write(
    `[seed-social-wall-demo] ${error instanceof Error ? error.stack || error.message : String(error)}\n`,
  )
  process.exit(1)
})
