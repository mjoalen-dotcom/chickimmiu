# Session 23 — ECPay 付款正式串接（組 A）

> **Parent plan**：封測前未完成工作 組 A（見 `21-post-session-2026-04-21.md` Option A）
> **Worktree**：`../ckmu-ecpay-payment` on branch `feat/ecpay-payment`
> **起點 SHA**：main 最新（`git fetch && git pull`，當前 ≥ `ef99d83`）
> **衝突可能**：與組 B（ECPay 電子發票）共改 `Orders.ts` afterChange，**組 A merge 後再開組 B**。與其他組（C 欄位審計、E 退換貨、F PayPal）零衝突，可平行。

---

## 目標

把目前 checkout `paymentMethod='ecpay'` 從 placeholder 變成真的能跑：使用者按結帳 → 跳轉 ECPay 付款頁 → 付款完成 → callback 把 Order.paymentStatus 從 `unpaid` flip 到 `paid` → 觸發既有的 invoice / wallet / credit-score afterChange hooks。

封測期間先用 ECPay **官方 sandbox**（`payment-stage.ecpay.com.tw`，公開 testmerchant creds 內建在 code 預設值），不用使用者拿 prod creds。等功能驗完再切 prod env。

---

## Non-goals（本組不做）

- ECPay 電子發票 API 真呼叫 → **組 B**（schema + `autoIssueInvoiceForOrder` hook 已就位，組 A 只負責讓 `paymentStatus='paid'` 觸發它）
- 藍新 NewebPay / LINE Pay / PayPal 真接 → 各自獨立 session
- 退款 API（ECPay refund endpoint）→ 組 E 退換貨後續
- ECPay 物流（7-11 / 全家門市選擇 API）→ 物流已經用內建 ShippingMethods，本組不動

---

## 現況偵察

✅ **已就位**（不要重做）：
- `Orders.ts` `paymentMethod` 已含 `ecpay` 選項（[Orders.ts:261](src/collections/Orders.ts:261)）
- `Orders.ts` `paymentStatus` 已含 `paid` 狀態（[Orders.ts:282-293](src/collections/Orders.ts:282)）
- `Orders.ts` `paymentTransactionId` 欄位已存在（[Orders.ts:295](src/collections/Orders.ts:295)）
- 3 個 `afterChange` hooks 已掛在 `paymentStatus: unpaid → paid` transition：
  - 自動開電子發票（`autoIssueInvoiceForOrder`，組 B 接 API）
  - 其他 2 個（line 611, 931，看起來是 wallet/credit-score）
- `/checkout` UI 已能 POST `/api/orders` 建單（PR #19 `3598299`），但 paymentStatus 留在 `'unpaid'`

❌ **缺什麼**：
- ECPay AioCheckOut 表單產生（CheckMacValue 計算）
- POST `/api/ecpay/aio-checkout` 把 cart 轉成 ECPay redirect form
- POST `/api/ecpay/callback` 接 ECPay ReturnURL，驗 CheckMacValue，flip paymentStatus
- `/checkout/payment-success` 與 `/checkout/payment-fail` 兩頁
- checkout client 端：`paymentMethod === 'ecpay'` 時，下單後自動 submit 到 AioCheckOut form 而非單純 redirect 訂單頁

---

## 檔案變更清單

### 新增

#### 1. `src/lib/ecpay/checkMacValue.ts`
ECPay CheckMacValue 計算（台灣特規 SHA256，URL-encode 大小寫敏感）：

```ts
import crypto from 'crypto'

/**
 * ECPay 台灣特規 URLEncode：
 * - 標準 URLEncode
 * - 但 -, _, ., !, *, (, ), ' 不編碼
 * - 然後再 lowercase（這步是 ECPay 規定，不是標準）
 */
export function ecpayUrlEncode(s: string): string {
  return encodeURIComponent(s)
    .replace(/!/g, '%21')
    .replace(/\*/g, '%2A')
    .replace(/'/g, '%27')
    .replace(/\(/g, '%28')
    .replace(/\)/g, '%29')
    .toLowerCase()
}

/**
 * 產生 CheckMacValue
 * @param params 不含 CheckMacValue 的所有 form 欄位
 * @param hashKey 商店 HashKey（測試環境：pwFHCqoQZGmho4w6）
 * @param hashIV 商店 HashIV（測試環境：EkRm7iFT261dpevs）
 */
export function generateCheckMacValue(
  params: Record<string, string | number>,
  hashKey: string,
  hashIV: string,
): string {
  // 1. key 字典序排序
  const sortedKeys = Object.keys(params).sort((a, b) => a.localeCompare(b, 'en', { sensitivity: 'base' }))
  // 2. 串成 HashKey=xxx&Key1=Value1&Key2=Value2&HashIV=yyy
  const queryString = sortedKeys.map((k) => `${k}=${params[k]}`).join('&')
  const raw = `HashKey=${hashKey}&${queryString}&HashIV=${hashIV}`
  // 3. URL encode（ECPay 規格）
  const encoded = ecpayUrlEncode(raw)
  // 4. SHA256 → 大寫 hex
  return crypto.createHash('sha256').update(encoded).digest('hex').toUpperCase()
}

/**
 * 驗 callback 的 CheckMacValue
 */
export function verifyCheckMacValue(
  body: Record<string, string>,
  hashKey: string,
  hashIV: string,
): boolean {
  const { CheckMacValue: provided, ...rest } = body
  if (!provided) return false
  const expected = generateCheckMacValue(rest, hashKey, hashIV)
  // timing-safe compare
  if (expected.length !== provided.length) return false
  return crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(provided))
}
```

#### 2. `src/lib/ecpay/aioCheckout.ts`
產生 AioCheckOut form payload：

```ts
import { generateCheckMacValue } from './checkMacValue'

export type AioCheckoutInput = {
  orderId: string           // 我方 Order.id
  orderNumber: string       // 我方 Order.orderNumber
  amount: number            // 整數新台幣
  itemName: string          // 商品名稱（多商品用 # 串接，最多 200 字）
  description?: string
}

export type EcpayConfig = {
  merchantId: string
  hashKey: string
  hashIV: string
  endpoint: string          // sandbox: https://payment-stage.ecpay.com.tw/Cashier/AioCheckOut/V5
  returnUrl: string         // 我方 callback URL（必須是公開 https，本機開發要 ngrok）
  clientBackUrl: string     // 付款完成跳轉的我方頁面（使用者瀏覽器跳）
  orderResultUrl?: string   // 付款結果頁
}

export function buildAioCheckoutPayload(input: AioCheckoutInput, cfg: EcpayConfig) {
  // ECPay 要求 yyyy/MM/dd HH:mm:ss
  const now = new Date()
  const pad = (n: number) => String(n).padStart(2, '0')
  const tradeDate = `${now.getFullYear()}/${pad(now.getMonth() + 1)}/${pad(now.getDate())} ${pad(now.getHours())}:${pad(now.getMinutes())}:${pad(now.getSeconds())}`

  // MerchantTradeNo 必須英數字 ≤ 20 字，且全站唯一
  // 用 orderNumber（CK20260424XXXX 之類）若超過 20 字 truncate
  const merchantTradeNo = input.orderNumber.replace(/[^A-Za-z0-9]/g, '').slice(0, 20)

  const params: Record<string, string | number> = {
    MerchantID: cfg.merchantId,
    MerchantTradeNo: merchantTradeNo,
    MerchantTradeDate: tradeDate,
    PaymentType: 'aio',
    TotalAmount: Math.round(input.amount),
    TradeDesc: input.description ?? '訂單付款',
    ItemName: input.itemName.slice(0, 200),
    ReturnURL: cfg.returnUrl,
    ChoosePayment: 'ALL',     // 全部支付方式都讓使用者選（信用卡/ATM/超商等）
    EncryptType: 1,           // 1 = SHA256
    ClientBackURL: cfg.clientBackUrl,
    OrderResultURL: cfg.orderResultUrl ?? cfg.clientBackUrl,
    NeedExtraPaidInfo: 'N',
  }

  const checkMacValue = generateCheckMacValue(params, cfg.hashKey, cfg.hashIV)

  return {
    endpoint: cfg.endpoint,
    fields: { ...params, CheckMacValue: checkMacValue },
  }
}
```

#### 3. `src/lib/ecpay/config.ts`
讀 env 出 cfg（fallback 到 sandbox testmerchant，封測期可用）：

```ts
import type { EcpayConfig } from './aioCheckout'

export function getEcpayConfig(): EcpayConfig {
  const env = process.env.ECPAY_ENV ?? 'stage'
  const isProd = env === 'prod'

  return {
    merchantId: process.env.ECPAY_MERCHANT_ID || (isProd ? '' : '3002607'),
    hashKey: process.env.ECPAY_HASH_KEY || (isProd ? '' : 'pwFHCqoQZGmho4w6'),
    hashIV: process.env.ECPAY_HASH_IV || (isProd ? '' : 'EkRm7iFT261dpevs'),
    endpoint: isProd
      ? 'https://payment.ecpay.com.tw/Cashier/AioCheckOut/V5'
      : 'https://payment-stage.ecpay.com.tw/Cashier/AioCheckOut/V5',
    // BASE_URL 從 NEXT_PUBLIC_SITE_URL 或 fallback
    returnUrl: `${process.env.NEXT_PUBLIC_SITE_URL || 'https://pre.chickimmiu.com'}/api/ecpay/callback`,
    clientBackUrl: `${process.env.NEXT_PUBLIC_SITE_URL || 'https://pre.chickimmiu.com'}/checkout/payment-success`,
  }
}

export function isEcpayConfigured(): boolean {
  // sandbox 有預設，prod 必須三項都設
  if (process.env.ECPAY_ENV === 'prod') {
    return Boolean(process.env.ECPAY_MERCHANT_ID && process.env.ECPAY_HASH_KEY && process.env.ECPAY_HASH_IV)
  }
  return true
}
```

#### 4. `src/app/(frontend)/api/ecpay/aio-checkout/route.ts`
POST endpoint 接 `{ orderId }`，回傳 ECPay form HTML（前端 auto-submit）：

```ts
import { NextRequest, NextResponse } from 'next/server'
import { headers as nextHeaders } from 'next/headers'
import { getPayload } from 'payload'
import config from '@payload-config'
import { buildAioCheckoutPayload } from '@/lib/ecpay/aioCheckout'
import { getEcpayConfig } from '@/lib/ecpay/config'

export async function POST(req: NextRequest) {
  const body = (await req.json().catch(() => null)) as { orderId?: string } | null
  if (!body?.orderId) {
    return NextResponse.json({ error: 'orderId required' }, { status: 400 })
  }

  const payload = await getPayload({ config })
  const headersList = await nextHeaders()
  const { user } = await payload.auth({ headers: headersList })
  // guest checkout 也要支援，所以不強制 user 登入

  const order = await payload.findByID({ collection: 'orders', id: body.orderId, depth: 0 }).catch(() => null)
  if (!order) return NextResponse.json({ error: 'order not found' }, { status: 404 })

  // 安全檢查：guest 訂單 customer=null 時放行；登入訂單必須是本人
  if ((order as { customer?: string }).customer && user && (order as { customer: string }).customer !== user.id) {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 })
  }
  if ((order as { paymentStatus: string }).paymentStatus === 'paid') {
    return NextResponse.json({ error: 'already paid' }, { status: 400 })
  }
  if ((order as { paymentMethod: string }).paymentMethod !== 'ecpay') {
    return NextResponse.json({ error: 'paymentMethod must be ecpay' }, { status: 400 })
  }

  const items = (order as { items: { productName: string; quantity: number }[] }).items ?? []
  const itemName = items.map((it) => `${it.productName} x ${it.quantity}`).join('#')

  const cfg = getEcpayConfig()
  const result = buildAioCheckoutPayload(
    {
      orderId: order.id as string,
      orderNumber: (order as { orderNumber: string }).orderNumber,
      amount: (order as { total: number }).total,
      itemName,
      description: 'CHIC KIM & MIU 訂單付款',
    },
    cfg,
  )

  // 回傳 form fields，前端組 hidden form submit
  return NextResponse.json({
    endpoint: result.endpoint,
    fields: result.fields,
  })
}
```

#### 5. `src/app/(frontend)/api/ecpay/callback/route.ts`
ECPay ReturnURL（伺服器對伺服器，看不到瀏覽器）：

```ts
import { NextRequest, NextResponse } from 'next/server'
import { getPayload } from 'payload'
import config from '@payload-config'
import { verifyCheckMacValue } from '@/lib/ecpay/checkMacValue'
import { getEcpayConfig } from '@/lib/ecpay/config'

export async function POST(req: NextRequest) {
  // ECPay POST 是 application/x-www-form-urlencoded
  const formData = await req.formData()
  const body: Record<string, string> = {}
  for (const [k, v] of formData.entries()) body[k] = String(v)

  const cfg = getEcpayConfig()
  const valid = verifyCheckMacValue(body, cfg.hashKey, cfg.hashIV)
  if (!valid) {
    console.error('[ecpay-callback] CheckMacValue mismatch', body)
    return new NextResponse('0|CheckMacValue Failed', { status: 400 })
  }

  const { MerchantTradeNo, RtnCode, RtnMsg, TradeNo, PaymentDate, PaymentType, PaymentTypeChargeFee } = body
  // RtnCode=1 表成功，其他都是失敗
  if (RtnCode !== '1') {
    console.warn('[ecpay-callback] payment failed', { MerchantTradeNo, RtnCode, RtnMsg })
    return new NextResponse('1|OK', { status: 200 }) // 一律回 1|OK 讓 ECPay 不重送
  }

  const payload = await getPayload({ config })
  // MerchantTradeNo 是 orderNumber 去除非英數字後的前 20 字 — 用 prefix 找
  const orders = await payload.find({
    collection: 'orders',
    where: { orderNumber: { contains: MerchantTradeNo } },
    limit: 1,
  })
  const order = orders.docs[0]
  if (!order) {
    console.error('[ecpay-callback] order not found', { MerchantTradeNo })
    return new NextResponse('1|OK', { status: 200 })
  }

  if ((order as { paymentStatus: string }).paymentStatus === 'paid') {
    // 重送，已處理過
    return new NextResponse('1|OK', { status: 200 })
  }

  await payload.update({
    collection: 'orders',
    id: order.id,
    data: {
      paymentStatus: 'paid',
      paymentTransactionId: TradeNo,
      // PaymentDate 格式 yyyy/MM/dd HH:mm:ss
      // 想存的話加欄位 paidAt（schema 已有？沒有就不存，TradeNo 夠 audit）
    },
  })

  return new NextResponse('1|OK', { status: 200 })
}

// ECPay GET 也會打（client redirect），forward 到 success 頁
export async function GET(req: NextRequest) {
  const url = new URL(req.url)
  return NextResponse.redirect(`${url.origin}/checkout/payment-success`)
}
```

#### 6. `src/app/(frontend)/checkout/payment-success/page.tsx`
單純頁面：

```tsx
import Link from 'next/link'

export const metadata = { title: '付款成功' }

export default function PaymentSuccessPage() {
  return (
    <div className="container mx-auto px-4 py-16 text-center">
      <h1 className="text-3xl font-bold mb-4">付款成功</h1>
      <p className="text-gray-600 mb-8">訂單已成立，確認信稍後寄達。</p>
      <div className="flex justify-center gap-4">
        <Link href="/account/orders" className="px-6 py-3 bg-black text-white rounded">查看我的訂單</Link>
        <Link href="/products" className="px-6 py-3 border rounded">繼續購物</Link>
      </div>
    </div>
  )
}
```

#### 7. `src/app/(frontend)/checkout/payment-fail/page.tsx`
類似 success，標題改「付款未完成」+ 「重試付款」按鈕（連回 /checkout）。

### 修改

#### 8. `src/app/(frontend)/checkout/CheckoutClient.tsx`（或對應 client 元件）
找到 `handleSubmit`：建單成功後，若 `paymentMethod === 'ecpay'`：

```tsx
const orderRes = await fetch('/api/orders', { method: 'POST', body: ... })
const order = await orderRes.json()

if (paymentMethod === 'ecpay') {
  // 拿 ECPay form payload
  const ecpayRes = await fetch('/api/ecpay/aio-checkout', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ orderId: order.id }),
  })
  if (!ecpayRes.ok) {
    setError('啟動付款失敗，請重試')
    return
  }
  const { endpoint, fields } = await ecpayRes.json()
  // 動態組 form 並 auto-submit（瀏覽器會跳 ECPay）
  const form = document.createElement('form')
  form.method = 'POST'
  form.action = endpoint
  Object.entries(fields).forEach(([k, v]) => {
    const input = document.createElement('input')
    input.type = 'hidden'
    input.name = k
    input.value = String(v)
    form.appendChild(input)
  })
  document.body.appendChild(form)
  form.submit()
  return
}

// 其他付款方式維持原 redirect /account/orders 邏輯
router.push('/account/orders')
```

#### 9. `next.config.mjs` CSP
ReturnURL 的 server-to-server POST 不受 CSP 影響，但 client redirect 跳 ECPay 的頁本身會載 ECPay 資源：
- `frame-src` 或 `form-action` 加 `https://payment-stage.ecpay.com.tw https://payment.ecpay.com.tw`

至少要加 `form-action` 才能 form.submit() 出去（CSP `form-action` 預設沿用 `default-src 'self'` 會擋）：

```js
// next.config.mjs CSP header
"form-action 'self' https://payment-stage.ecpay.com.tw https://payment.ecpay.com.tw"
```

#### 10. `.env.example`
加 4 行（封測期都可省略，prod 才必填）：

```
# ECPay（封測期可不填，code 會 fallback 到官方 sandbox testmerchant）
ECPAY_ENV=stage              # stage | prod
ECPAY_MERCHANT_ID=
ECPAY_HASH_KEY=
ECPAY_HASH_IV=
```

---

## Verification

### Local（封測站不接 callback，因 ECPay 要打回公開 URL）

1. `pnpm tsc --noEmit` 0 err
2. `pnpm build` 清
3. **Unit test**（建議寫 1 個 Jest/Vitest）：
   - 餵已知 `MerchantID=3002607`、`MerchantTradeNo=test123`、`HashKey=pwFHCqoQZGmho4w6`、`HashIV=EkRm7iFT261dpevs` → CheckMacValue 應該與 ECPay 文件範例一致
   - ECPay 官方範例：見 https://developers.ecpay.com.tw/?p=2902 「測試 CheckMacValue 計算結果」
4. **Curl 驗 form 產出**：
   ```bash
   # 先在 admin 手 build 一張 paymentMethod=ecpay 的測試訂單，記下 id
   curl -X POST http://localhost:3006/api/ecpay/aio-checkout \
     -H 'content-type: application/json' \
     -d '{"orderId":"<test-order-id>"}'
   # 應回 {"endpoint":"https://payment-stage.ecpay.com.tw/...", "fields":{...,CheckMacValue: ...}}
   ```

### Prod（封測站，pre.chickimmiu.com）

1. Deploy（必含 `pnpm build` + `pm2 restart`，無 schema 變動所以不需 migrate）
2. 後台手建一張小額測試訂單（NT$ 10），paymentMethod=ecpay
3. 前台 `/checkout` 走 happy path → 應跳 `payment-stage.ecpay.com.tw` 付款頁
4. 用 ECPay sandbox **測試卡號 `4311-9522-2222-2222`**（CVV 任三碼，到期日任未來日期）
5. 付款成功 → 應跳回 `/checkout/payment-success`
6. 後台檢查該訂單 `paymentStatus=paid`、`paymentTransactionId=<ECPay TradeNo>`
7. 確認 3 個 afterChange hooks 觸發了：
   - 自動開發票（組 B 接 API 之前先看 console log 有打 `autoIssueInvoiceForOrder`）
   - 訂單確認信（看 mail log 或 admin alert）
   - 其他 wallet/credit hook（看 PointsTransactions 有沒有新 row）

### Smoke 失敗情境

- CheckMacValue 故意改錯一個字 → callback 應回 `0|CheckMacValue Failed`
- 用已 `paid` 的訂單呼叫 `/api/ecpay/aio-checkout` → 應 400 `already paid`
- paymentMethod 不是 ecpay → 應 400

---

## Commit & Push

```bash
git add src/lib/ecpay/ \
        src/app/\(frontend\)/api/ecpay/ \
        src/app/\(frontend\)/checkout/payment-success \
        src/app/\(frontend\)/checkout/payment-fail \
        src/app/\(frontend\)/checkout/CheckoutClient.tsx \
        next.config.mjs \
        .env.example
git commit -m "feat(ecpay): AioCheckOut + callback + payment-success/fail pages

- src/lib/ecpay/ — CheckMacValue (SHA256 + 台灣特規 URLEncode) + AioCheckOut payload builder + env-driven config (sandbox fallback)
- POST /api/ecpay/aio-checkout — Order → ECPay form payload
- POST /api/ecpay/callback — verify CheckMacValue → flip paymentStatus to paid
- /checkout/payment-success + /payment-fail pages
- CSP form-action allowlist payment.ecpay.com.tw
- 封測站直接走 ECPay sandbox testmerchant（公開 creds）；prod 切換靠 ECPAY_ENV=prod + 三 env

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
git push -u origin feat/ecpay-payment
"/c/Program Files/GitHub CLI/gh.exe" pr create --title "feat(ecpay): AioCheckOut + callback + paymentStatus auto-flip" --body "..."
```

---

## Prod Deploy

```bash
ssh root@5.223.85.14 /root/deploy-ckmu.sh
# 預期 output 末尾：smoke green + 7/7 paths 200
```

無 migration、無 schema 變動。要 verify 的是 callback URL 真的可被 ECPay 從外網打到（pre.chickimmiu.com 已是 https + 公開，OK）。

---

## Guardrails

- **絕不**把 `ECPAY_HASH_KEY`/`ECPAY_HASH_IV` commit 到 repo（連 sandbox 也用 fallback in code，env 留空）
- 本組**只動 paymentStatus**，不要去改 invoice 真打 API（那是組 B）
- 不要去刪 `cash_cod` / `cash_meetup` 邏輯（COD 流程仍要保留）
- callback 一律回 `1|OK` 200（即使失敗也要回，不然 ECPay 會無限重送 5 次每次間隔 5 分鐘）
- 不要 `--no-verify`、不要 force push、不要動其他組檔案（Coupons / Tax / Returns / Cards 全不碰）
- 開工前 `git fetch && git log --oneline -5 origin/main` 確認沒被別 session 搶先

---

## 後續（給組 B 的訊息）

- 組 A merge 後，組 B 接 `autoIssueInvoiceForOrder` 真呼叫 ECPay 電子發票 API
- ECPay 發票 sandbox：`https://einvoice-stage.ecpay.com.tw/B2CInvoice/Issue`
- testmerchant 同一組 creds 適用，但開發票要的是另一組 `MerchantID + HashKey + HashIV`（ECPay 文件「電子發票測試環境」）
- Schema 已存在 `ecpayInvoiceSettings` global（grep `ecpayInvoiceSettings` 看欄位）

---

## 失敗回退

若 ECPay sandbox 卡關、cosmic bug：

1. 把 `paymentMethod=ecpay` 從 `Orders.ts` options 暫時隱藏（admin 看不到，前台 checkout fallback 到其他付款方式）
2. PR revert
3. 不影響其他付款方式（COD / 面交 / LINE Pay 都獨立）
