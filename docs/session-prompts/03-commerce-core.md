# 03 — 商業核心（庫存 / 購物車 / 結帳付款）

## 目標
- Orders 建單時 **原子鎖定**庫存（目前完全沒減，兩個人同時結帳會超賣）
- 購物車從純 localStorage → 登入後同步到 server（Users.cart JSON 欄位）
- 結帳付款至少接一個 gateway（ECPay 綠界優先；LINE Pay / Newebpay 留 scaffold）
- 運費規則統一（cart 說 1000 免運、checkout 卻列 1500 免運的矛盾）

## ▼▼▼ 以下整段貼到新 session ▼▼▼

```
# 03 — Commerce Core: 庫存鎖 + Cart 持久化 + Checkout Payment + 運費統一

## Context
- 專案：CHIC KIM & MIU Next.js 15 + Payload v3
- 本機路徑：`C:\Users\mjoal\ally-site\chickimmiu`
- 跑前先 `git log --oneline -10` + `preview_list`，確認沒有其他 session 同時在碰 commerce 檔

## Background — 已確認問題
1. **Orders.ts 沒減庫存**
   - `src/collections/Orders.ts` 的 hooks 沒有 `beforeValidate` 鎖 Products stock / variants[].stock
   - 風險：兩人同時下單會超賣
2. **Cart 只在 localStorage**
   - `src/stores/cartStore.ts` zustand + persist（localStorage）
   - 登入不 merge、換裝置/瀏覽器就空
3. **Checkout 付款是 UI-only**
   - `src/app/(frontend)/checkout/page.tsx` 有 PAYMENT_METHODS（ECPay, LINE Pay, Newebpay）陣列但送單 button 無 POST handler
4. **運費不一致**
   - `src/app/(frontend)/cart/page.tsx:28` 寫 `shippingFee: subtotal >= 1000 ? 0 : 60`
   - `src/app/(frontend)/checkout/page.tsx:31-60` SHIPPING_OPTIONS 列 6 個物流，滿額門檻 1500
   - 使用者在 cart 看 1000 免運、到 checkout 卻 1500 免運 → 客訴

## Your Task — 4 個 Task

### Task A: Orders 庫存原子扣減

讀 `src/collections/Orders.ts`，看現有 hooks 結構。加一個 `beforeValidate` 或 `beforeChange` hook（只在 create 時跑，非 update）：
```ts
hooks: {
  beforeChange: [
    async ({ data, operation, req }) => {
      if (operation !== 'create') return data
      // 逐 item 檢查 + 扣 Products.stock（variants 版略長，見下）
      for (const item of data.items ?? []) {
        const product = await req.payload.findByID({ collection: 'products', id: item.product, depth: 0 })
        if (!product) throw new Error(`Product ${item.product} not found`)
        // 若有 variant → 找 variant.stock；否則 product.stock
        if (item.variant) {
          const variant = (product.variants ?? []).find(v => v.id === item.variant || v.sku === item.variant)
          if (!variant) throw new Error(`Variant ${item.variant} not found`)
          if ((variant.stock ?? 0) < item.quantity) throw new Error(`${product.title} ${variant.size ?? ''} 庫存不足`)
          // 扣 variant stock
          const newVariants = product.variants.map(v => v.id === variant.id ? { ...v, stock: v.stock - item.quantity } : v)
          await req.payload.update({ collection: 'products', id: product.id, data: { variants: newVariants }, depth: 0 })
        } else {
          if ((product.stock ?? 0) < item.quantity) throw new Error(`${product.title} 庫存不足`)
          await req.payload.update({ collection: 'products', id: product.id, data: { stock: product.stock - item.quantity }, depth: 0 })
        }
      }
      return data
    },
  ],
  afterChange: [
    async ({ doc, operation, previousDoc, req }) => {
      // 取消訂單 → 還庫存
      if (operation === 'update' && doc.status === 'cancelled' && previousDoc.status !== 'cancelled') {
        for (const item of doc.items ?? []) {
          const product = await req.payload.findByID({ collection: 'products', id: typeof item.product === 'object' ? item.product.id : item.product, depth: 0 })
          if (item.variant) {
            const newVariants = (product.variants ?? []).map(v => v.sku === item.variant || v.id === item.variant ? { ...v, stock: (v.stock ?? 0) + item.quantity } : v)
            await req.payload.update({ collection: 'products', id: product.id, data: { variants: newVariants }, depth: 0 })
          } else {
            await req.payload.update({ collection: 'products', id: product.id, data: { stock: (product.stock ?? 0) + item.quantity }, depth: 0 })
          }
        }
      }
    },
  ],
}
```

SQLite 不支援 `SELECT ... FOR UPDATE`，Payload SQLite adapter 也沒 transaction API。**真正的原子鎖需要 Redis 或 Postgres**，但 SQLite 單進程下「先 check 再 update」在單一 Node process 內部是序列化的，**單機 SQLite 可以接受**。在 hook 頂加註解說明此限制，以及未來遷 Postgres 後換 FOR UPDATE。

### Task B: Server-side Cart

新建 collection `src/collections/Carts.ts`：
```ts
import type { CollectionConfig } from 'payload'
import { isAdminOrSelf } from '../access/isAdminOrSelf'
export const Carts: CollectionConfig = {
  slug: 'carts',
  admin: { useAsTitle: 'id', group: '商城' },
  access: {
    read: isAdminOrSelf,
    create: () => true,
    update: isAdminOrSelf,
    delete: ({ req }) => req.user?.role === 'admin',
  },
  fields: [
    { name: 'user', type: 'relationship', relationTo: 'users', required: true, index: true, unique: true },
    { name: 'items', type: 'json', defaultValue: [] },
    { name: 'updatedAt', type: 'date', admin: { readOnly: true } },
  ],
  timestamps: true,
}
```

在 `src/payload.config.ts` `collections` 陣列加入。

寫 migration（沿用 PRAGMA 冪等 pattern，參考 `src/migrations/20260417_100000_add_stored_value_balance.ts`）— **自動產生 migration**：
```
pnpm payload migrate:create carts_table
```
若失敗手寫。

改 `src/stores/cartStore.ts`：
- 保留 localStorage 當 guest fallback
- 加入 `syncToServer()` → POST `/api/cart/sync`（需建）
- 加入 `mergeFromServer()` → GET `/api/cart` 拉，與本地 merge（同 SKU 取較大 qty）
- 登入 event（auth layout 那層或 `useAuth` hook）觸發 merge

新建 `src/app/(frontend)/api/cart/route.ts`（GET + POST）：
- GET：由 payload.auth 判斷 user，回 `Carts.find({ where: { user: user.id } })`
- POST（sync）：upsert Carts where user = user.id

### Task C: Checkout 付款串接（ECPay 優先）

ECPay 綠界科技是台灣最常用。建 `src/lib/payment/ecpay.ts`：
```ts
// 綠界 AIO 介面 — 測試環境：https://payment-stage.ecpay.com.tw/Cashier/AioCheckOut/V5
// 正式：https://payment.ecpay.com.tw/Cashier/AioCheckOut/V5
import crypto from 'crypto'
type EcpayParams = {
  MerchantTradeNo: string   // 20 碼商店訂單編號
  TotalAmount: number
  TradeDesc: string
  ItemName: string          // 以 # 分隔
  ReturnURL: string         // server-to-server 付款結果
  ClientBackURL: string     // 使用者付款後導回
  // ... 更多欄位
}
export function buildEcpayForm(p: EcpayParams, merchantId: string, hashKey: string, hashIv: string) {
  // URL encode → sort alphabetically → add HashKey/HashIV → md5/sha256
  // 回傳 {action, fields}，前端 auto-submit form 到 action
  // ...
}
```

需寫 4 個檔：
1. `src/lib/payment/ecpay.ts` — 組 check-mac-value、build form params
2. `src/app/(frontend)/api/checkout/ecpay-init/route.ts` — POST 訂單 draft 建 Order(status=pending_payment) → 回 form HTML
3. `src/app/(frontend)/api/checkout/ecpay-callback/route.ts` — 接 ReturnURL 驗 CheckMacValue → 改 Order status + 發 afterChange hook
4. `src/app/(frontend)/checkout/complete/page.tsx` — ClientBackURL 使用者看到「付款成功」

`.env.example` 加：
```
ECPAY_MERCHANT_ID=<test: 3002607>
ECPAY_HASH_KEY=<test: pwFHCqoQZGmho4w6>
ECPAY_HASH_IV=<test: EkRm7iFT261dpevs>
ECPAY_MODE=stage  # or "prod"
```

LINE Pay / Newebpay 只留 scaffold：`src/lib/payment/linepay.ts` + `newebpay.ts` 含 `throw new Error('not implemented')` 的 stub + TODO 註解，checkout UI 暫 disable 這兩個選項但保留列表。

### Task D: 運費統一

新建 global `src/globals/ShippingSettings.ts`（沿用其他 global 結構）：
```ts
import type { GlobalConfig } from 'payload'
export const ShippingSettings: GlobalConfig = {
  slug: 'shipping-settings',
  admin: { group: '商城' },
  access: { read: () => true, update: ({ req }) => req.user?.role === 'admin' },
  fields: [
    { name: 'freeShippingThreshold', type: 'number', defaultValue: 1500, admin: { description: '滿此金額免運' } },
    { name: 'methods', type: 'array', fields: [
      { name: 'slug', type: 'text', required: true },
      { name: 'name', type: 'text', required: true },
      { name: 'fee', type: 'number', required: true },
      { name: 'etaDays', type: 'text' },
      { name: 'enabled', type: 'checkbox', defaultValue: true },
    ]},
  ],
}
```

`cart/page.tsx:28` 與 `checkout/page.tsx:31-60` 改用 `findGlobal({ slug: 'shipping-settings' })`。

`hooks.afterChange` 觸發 `revalidatePath('/cart', 'page')` + `revalidatePath('/checkout', 'page')`。

### 驗證 + push
```
pnpm tsc --noEmit
PAYLOAD_SECRET=dummy DATABASE_URI=file:./data/chickimmiu.db pnpm build
# 本機 dev：
pnpm dev -p 3002
# 打 /checkout → 點 ECPay → 應 submit 到 payment-stage.ecpay.com.tw，帶回 test callback
# 開兩個 tab 同時結帳 → 第二個應拿到「庫存不足」
```

branch + commit：
```
git checkout -b feat/commerce-core
git add -A   # Orders, Carts, ShippingSettings, cartStore, checkout, payment lib, env.example
git commit -m "$(cat <<'EOF'
feat(commerce): stock atomic decrement, server-side cart, ECPay init, unified shipping

- Orders beforeChange hook decrements Products.stock / variants[].stock
- Orders afterChange restores stock on status=cancelled
- New Carts collection + /api/cart GET/POST for authenticated users
- cartStore syncs to server on login (merge by SKU)
- ECPay AIO payment init + callback; LINE Pay + Newebpay stubs
- ShippingSettings global unifies free-shipping threshold across cart/checkout

Known limit: SQLite stock 'lock' is per-process serial. Postgres + FOR UPDATE
needed for multi-process deploy.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
git push -u origin feat/commerce-core
```

## Prod Deploy
```
cd /var/www/chickimmiu
git pull
pnpm install --frozen-lockfile
pnpm payload migrate   # 跑 Carts 新 table migration
pnpm build
pm2 restart chickimmiu-nextjs
```
**新 env 需設**：`ECPAY_MERCHANT_ID` + `ECPAY_HASH_KEY` + `ECPAY_HASH_IV` + `ECPAY_MODE=stage`

## Guardrails
- 不碰：`src/seed/**`（組 01）、`src/app/(frontend)/account/**`（組 02）、`src/app/(frontend)/{contact,size-guide,shipping,returns}/`（組 04）、`src/lib/recommendationEngine.ts`（組 05）、`next.config.mjs` headers（組 07）
- 不用 `git push --force`
- 不跳 pre-commit hook
- 若 ECPay callback 來不及做，至少把 init 做完 + 留 TODO；LINE Pay / Newebpay 本組就留 stub
```

---
