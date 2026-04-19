# 交接 — 15 寶物箱完整兌換流程（4c 後續）

## 起源

2026-04-19 對話 11 完成 4 個會員後置體驗功能（branch `feat/post-order-experience`）：

- **1a** Orders.ts pending→processing 寄訂單確認信
- **2b** PolicyPagesSettings.accountReturnsNotice + /account/returns 接通
- **3b** Users.invoiceProfiles array（多筆公司發票，造型師代買情境）
- **4a** /account/treasure 純查詢頁，讀 `mini-game-records` 顯示中獎清單

當時使用者選 4a 先做，**備註 4c 完整版本後續做**。本文是 4c 的完整 spec。

---

## 4c 範圍

「完整兌換」= 寶物箱不只是查詢，要能**真正 attach 到下次訂單**：

1. **庫存模型**：每筆獎項 = 一個 inventory 單位（state: unused / pending_attach / shipped / consumed / expired）
2. **/account/treasure UI**：可勾選「下次訂購自動隨單出貨」
3. **Checkout 自動 attach**：結帳時，所有實體獎項自動加入該 order；UI 顯示「將隨單寄出」
4. **Order schema**：order.gifts array，紀錄哪些寶物箱獎項隨此單寄出
5. **訂單狀態回流**：order delivered → 寶物箱 inventory 標記 shipped；order cancelled → inventory 復活成 unused
6. **電子券（電影券）兌換碼**：產生唯一兌換碼，使用者可手動使用 OR 隨單寄出實體
7. **過期機制**：admin 設定每種獎項的有效期；過期自動標 expired

---

## 建議實作架構

### 新 collection — `UserRewards`

跟 `MiniGameRecords` 分離（後者是「事件 log」，前者是「庫存」）。Source-of-truth 為 UserRewards，MiniGameRecords win → afterChange hook 自動建一筆 UserRewards。

```ts
{
  slug: 'user-rewards',
  fields: [
    { name: 'user', type: 'relationship', relationTo: 'users', required: true, index: true },
    { name: 'sourceRecord', type: 'relationship', relationTo: 'mini-game-records' },
    {
      name: 'rewardType',
      type: 'select',
      required: true,
      options: [
        { label: '免運券', value: 'free_shipping_coupon' },
        { label: '電影券（實體）', value: 'movie_ticket_physical' },
        { label: '電影券（電子）', value: 'movie_ticket_digital' },
        { label: '優惠券', value: 'coupon' },
        { label: '贈品（實體）', value: 'gift_physical' },
        { label: '徽章', value: 'badge' },
        // 注意：點數 / 購物金不進寶物箱（已直接寫入 user.points / shoppingCredit）
      ],
    },
    { name: 'displayName', type: 'text', required: true },        // 「2026 春季電影券」
    { name: 'amount', type: 'number' },                            // 數量 / 面額（電影券張數 / 優惠券折扣 NTD）
    { name: 'couponCode', type: 'text', unique: true },            // 電子券兌換碼
    { name: 'redemptionInstructions', type: 'textarea' },          // 兌換方式（影城名稱、有效期等）
    {
      name: 'state',
      type: 'select',
      required: true,
      defaultValue: 'unused',
      options: [
        { label: '未使用', value: 'unused' },
        { label: '預定隨下單寄出', value: 'pending_attach' },
        { label: '已寄出 (附隨訂單)', value: 'shipped' },
        { label: '已使用 (用券)', value: 'consumed' },
        { label: '已過期', value: 'expired' },
      ],
    },
    { name: 'attachedToOrder', type: 'relationship', relationTo: 'orders' },
    { name: 'shippedAt', type: 'date' },
    { name: 'consumedAt', type: 'date' },
    { name: 'expiresAt', type: 'date', required: true },
    { name: 'requiresPhysicalShipping', type: 'checkbox', defaultValue: true,
      admin: { description: '實體獎項需隨單寄出；電子券可關掉' } },
  ],
  hooks: {
    beforeRead: [
      // 讀取時 lazy 標 expired
      ({ doc }) => {
        if (doc.state === 'unused' && doc.expiresAt && new Date(doc.expiresAt) < new Date()) {
          return { ...doc, state: 'expired' }
        }
        return doc
      },
    ],
  },
}
```

### Migration

新增 `user_rewards` table（不是 user array sub-table，因為要 unique couponCode + 自己的 access pattern）。

### Orders.ts schema 補

```ts
{
  name: 'gifts',
  type: 'array',
  fields: [
    { name: 'reward', type: 'relationship', relationTo: 'user-rewards', required: true },
    { name: 'rewardType', type: 'text' },           // snapshot
    { name: 'displayName', type: 'text' },          // snapshot
    { name: 'amount', type: 'number' },
  ],
  admin: {
    description: '此訂單隨單寄出的寶物箱獎項（自動附加，不影響 total）',
  },
}
```

### Orders.ts afterChange hook 補

```ts
// status: pending → processing：把 attachedToOrder=this.id 的 UserRewards 標 pending_attach
// status: → shipped：標 shipped + shippedAt
// status: → cancelled：把這張單 attach 的 UserRewards state 還原 unused
```

### Checkout 整合

`/api/orders` POST handler 接到請求時：

1. 讀 `payload.find({ collection: 'user-rewards', where: { user: userId, state: 'unused', requiresPhysicalShipping: true, expiresAt: { greater_than: now } } })`
2. UI 上若使用者沒手動 opt-out，全部自動 attach
3. 寫 order.gifts array，同時 update UserRewards.attachedToOrder = newOrderId

Checkout UI 加區塊：「您的寶物箱有 N 件實體獎項將隨此單寄出」+ 列表 + 個別 toggle。

### /account/treasure UI 升級

- 每筆加 state badge（未使用 / 即將出貨 / 已寄出 / 已使用 / 已過期）
- 未使用實體獎項：「下次訂購自動隨單寄出」說明
- 電子券：「複製兌換碼」+「標記為已使用」按鈕
- 過期項目灰階顯示

### Admin

- UserRewards collection admin group「會員系統」
- 後台可手動建獎項（client 線下兌換 / 客服補償）
- LoginAttempts 樣板：list 加 filter by state / user

---

## 驗證計畫

1. tsc + build
2. seed 一筆 mini-game-records win，確認 user-rewards 自動建立
3. /account/treasure 顯示
4. checkout 下單 → 確認 order.gifts populate + user-rewards.state → pending_attach
5. order → shipped → user-rewards.state → shipped
6. order → cancelled → user-rewards.state → unused
7. 電子券：couponCode unique 衝突保護

---

## Scope 控制 — 建議拆 3 PR

依照 memory line「scope-control」教訓（對話 10 6 檔被 revert）：

- **PR-A** schema：UserRewards collection + migration + orders.gifts schema 補 + MiniGameRecords afterChange hook 自動建 reward。**不動 UI**。
- **PR-B** /account/treasure UI 升級：state badge / 操作按鈕 / 過期顯示。
- **PR-C** Checkout 整合：/api/orders 自動 attach + checkout UI 顯示 + Order afterChange hook 同步狀態。

每 PR 一個 worktree，每 PR 獨立可 revert。

---

## 不在 4c 範圍

- 點數 / 購物金獎項（已直接寫入 user，不需 inventory）
- 徽章成就系統（另案）
- 兌換碼防偽 / 二次驗證（PCI 層級，先不做）
- 實體獎項庫存控管（admin 端先靠人工，未來再做 inventory_warehouse）

---

## Guardrails

- ❌ 不要把 UserRewards 跟 PointsTransactions 混。前者是「實物 / 兌換碼」庫存；後者是「點數帳本」流水。
- ❌ 不要在 MiniGameRecords 上新增 `redeemedAt` 欄位（4b 的妥協方案）。要做 inventory 就建獨立 collection。
- ✅ 所有 UserRewards 寫入都要帶 expiresAt（無預設過期 → admin 必須勾選「永久有效」並設遠未來日期）。
- ✅ 電子券 couponCode 用 cuid2 / nanoid，**不要**用 timestamp + 隨機字串（碰撞風險）。
