# Session 25B — 履約工作流（批次出貨 + 客戶物流追蹤）

> **Parent plan**：`docs/session-prompts/25-master-inventory-fulfillment-parallel-plan.md`
> **Worktree**：`../ckmu-fulfillment` on branch `feat/fulfillment`
> **起點 SHA**：main 最新（≥ `009845b`）
> **平行性**：與 25A + 25D + 25E 完全平行；不動 stock 邏輯

## 目標

兩條線並進：

1. **後台批次出貨**：admin 在 Orders list view 多選 N 張訂單 → 一鍵填託運單號（CSV 上傳對應 orderId↔trackingNumber，或單張 inline 編輯後批次套用）→ 自動 status='shipped' + 寄出貨通知信（既有 hook 接通）。
2. **客戶物流追蹤**：`/account/orders/[id]` 顯示 `trackingNumber`、`carrier`、附「查詢物流」連結（依 carrier 拼物流網站 URL）。

**為什麼價值高**：封測一週後 user 反饋「一張一張改 status 要瘋」+ 客戶最常問「我的包裹到哪了」。

## 已存在不需重做

- [Orders.ts:321](src/collections/Orders.ts:321) `carrier` 欄位（711 / family / hilife / ok / tcat / hct 等）
- [Orders.ts:337](src/collections/Orders.ts:337) `trackingNumber` 欄位
- [Orders.ts:846](src/collections/Orders.ts:846) `status='shipped'` 自動寄 sendOrderShippedEmail（OrderSettings.notifications.sendShippedEmail 開關）
- ShippingMethods 8 條完整 seed

所以本組是「組裝既有積木」，不寫新 schema。

## Non-goals（本組不做）

- 託運單 PDF 列印（複雜度高，需 carrier API 或畫 PDF；下一輪做，先靠 trackingNumber 文字）
- 自動同步物流商狀態 webhook（被動）
- 撿貨單 / 包裝單（封測量小用人腦）
- 退貨履約（25A 已涵蓋退貨入庫；退貨物流另案）

## 檔案變更清單

### 新增

#### 1. `src/components/admin/OrderBulkShipPanel.tsx` — admin Orders 列表上方面板

掛在 Orders.ts 的 `admin.components.beforeListTable`（參考現有 ProductBulkActions pattern）。

**UI**：
- 「批次出貨」按鈕 → 開 modal
- modal 內容：
  - 兩種模式 tab：
    - **A. 統一託運**：選 carrier、輸入 trackingNumber → 套用到所有勾選訂單
    - **B. CSV 上傳**：欄位 `orderNumber,carrier,trackingNumber`，預覽 → 確認 → 批次套用
  - 預覽表：列 N 個 orderNumber + 將套用的 carrier/trackingNumber + 當前 status → 預期 status=shipped
  - 「執行」按鈕 → call `/api/admin/orders/bulk-ship` POST

**state**：用 react-hook-form 或 useState 都可；因為是 admin 內部，簡單就好。

**怎麼讀勾選的列**：Payload v3 admin selection 透過 `useTableColumns` / `useDocumentInfo` 不直接給 row selection，建議改提供 input：admin 自己 copy 訂單號到 textarea（一行一個 orderNumber）；或 query string 過濾後全選。**最簡可行**：textarea + 解析「一行一個 orderNumber」。

#### 2. `src/app/(frontend)/api/admin/orders/bulk-ship/route.ts`（POST）

**權限**：`payload.auth({ headers: req.headers })` → 必 admin role，否則 401/403。

**Body**：
```ts
{
  mode: 'uniform' | 'mapping'
  // uniform 模式
  orderNumbers?: string[]
  carrier?: string
  trackingNumber?: string  // 注意：uniform 模式所有單同號其實只有預收單，**多家 711 才能；通常 CSV 模式才實用**
  // mapping 模式
  rows?: Array<{ orderNumber: string; carrier: string; trackingNumber: string }>
}
```

**邏輯**：
- 對每個 orderNumber：
  - `payload.find({ collection: 'orders', where: { orderNumber: { equals } } })`
  - 若不存在 / 已 shipped / 已 cancelled / 已 refunded → 收進 `skipped[]`，繼續
  - `payload.update({ collection: 'orders', id, data: { carrier, trackingNumber, status: 'shipped' } })`
  - Orders.ts 既有的 `afterChange status→shipped` hook 會自動寄信
  - 收進 `succeeded[]`
- 回傳：`{ succeeded: [{ orderNumber, status }], skipped: [{ orderNumber, reason }] }`

#### 3. `src/lib/shipping/trackingUrl.ts` — carrier → 物流追蹤 URL helper

```ts
export function getTrackingUrl(carrier: string | null, trackingNumber: string | null): string | null {
  if (!carrier || !trackingNumber) return null
  const num = encodeURIComponent(trackingNumber)
  switch (carrier) {
    case '711':
      return `https://eservice.7-11.com.tw/e-tracking/search.aspx?id=${num}`
    case 'family':
      return `https://famiport.com.tw/Web_Famiport/page/famiportt.aspx?inputno=${num}`
    case 'hilife':
      return `https://www.hilife.com.tw/serviceInfo_search_result.aspx?l1=${num}`
    case 'ok':
      return `https://www.okmart.com.tw/conveniencestore/search?keyword=${num}`
    case 'tcat':  // 黑貓
      return `https://www.t-cat.com.tw/Inquire/TraceDetail.aspx?BillID=${num}`
    case 'hct':   // 新竹
      return `https://www.hct.com.tw/Search/SearchGoods_Step1?CHK=${num}`
    case 'kerry': // 嘉里大榮
      return `https://www.kerrytj.com/ZH/search/search.aspx?qry=${num}`
    case 'post':  // 郵局
      return `https://postserv.post.gov.tw/pstmail/main_mail.html?id=${num}`
    default:
      return null  // unknown carrier，UI 顯示文字無連結
  }
}
```

URL 規則需現場驗一下（本檔列的是合理猜測，本地實測各 carrier 是否真接受 query param；不接受的退到 home page 即可）。

### 修改

#### 4. `src/collections/Orders.ts` — admin 元件掛載

在 `admin.components.beforeListTable` 陣列加：
```ts
{ path: '@/components/admin/OrderBulkShipPanel' }
```

（其他現有 panel 保留）

#### 5. `src/app/(frontend)/account/orders/[id]/page.tsx`（或對應 OrderDetailClient）

找到「物流」「出貨」相關區塊（若無則新增 section）：

```tsx
{order.trackingNumber && (
  <section>
    <h3>物流追蹤</h3>
    <p>物流商：{carrierLabel(order.carrier)}</p>
    <p>託運單號：{order.trackingNumber}</p>
    {trackingUrl ? (
      <a href={trackingUrl} target="_blank" rel="noopener noreferrer">查詢物流進度 →</a>
    ) : (
      <p className="text-sm text-gray-500">查詢請至物流商網站</p>
    )}
  </section>
)}
```

**`carrierLabel`** helper：把 `711` → `7-11 取貨`、`tcat` → `黑貓宅急便` 等，搬 ShippingMethods seed 的 label 來用。

`/account/orders` 列表頁也加 status badge + 託運號縮寫（如 `已出貨 · 黑貓 #1234*****`）。

### Migration

**無 migration**：所有欄位 (carrier, trackingNumber, status) 已存在。

## 測試計畫

### 本地

1. `pnpm tsc --noEmit` 0 err
2. `pnpm dev` →
   - `/admin/collections/orders` 看到列表上方多了「批次出貨」按鈕
   - 後台先建 3 張測試 Order（不同顧客，status='processing'）
   - 點批次出貨 → uniform 模式 → 輸入 3 個 orderNumber + carrier=tcat + trackingNumber=TEST123 → 執行
   - 預期：3 張單 status=shipped、carrier=tcat、trackingNumber=TEST123、3 封 shipped 信寄出（ResendDevConsole 看 / OrderSettings 關信則 skip）
   - 改 mapping 模式：再建 2 張 Order，CSV `orderNumber,carrier,trackingNumber\nORD-X,711,1234567\nORD-Y,family,9876543` 上傳 → 預覽 → 執行
3. 客戶端：用其中一張 shipped 訂單的 user 登入 → `/account/orders/<id>` → 應看到託運號 + 「查詢物流進度」連結；點開新分頁應導到對應物流網站
4. 不存在的 orderNumber → 進 skipped[]、不影響其他

### Prod Smoke Test

- 後台真出 1 張小額訂單（pre 環境真客戶）→ 套用真託運號 → 客戶 email 有收到出貨信
- `/account/orders/<id>` 連結點開 → 物流網真查得到

## 已知設計取捨

1. **不做 row selection UI**：Payload v3 list view 沒給穩定 hook 抓勾選列；用 textarea 解析 orderNumber 簡單可靠、admin 從 list 複製貼上不痛。未來想做 row selection 再升級。
2. **uniform 模式很少用**：實務上每張單號都不同；保留只是讓 admin「先全部 711、再個別填號」的兩段式流程（先 mark 711、再用 mapping 填號）。
3. **不擋退貨後再出**：碰到「已 shipped 改 cancelled 又 ship」的奇案，用 admin 直接編輯單張即可，bulk 不處理。
4. **carrier URL 沒接 webhook**：被動連結就好，主動同步狀態值不到工程量。

## Merge + Deploy Checklist

- [ ] PR 標題：`feat(fulfillment): bulk shipping panel + customer tracking UI`
- [ ] tsc/build 綠
- [ ] 4 條本地測試全 PASS
- [ ] Squash merge 到 main
- [ ] `ssh root@5.223.85.14 /root/deploy-ckmu.sh`
- [ ] Prod 真出一張單測通
- [ ] `docs/session-prompts/25B-post-fulfillment.md` 寫 5 行總結
- [ ] 更新 `MEMORY.md`「25B Fulfillment DONE — commit `<sha>`」

## Context-exhausted handoff 模板

```markdown
## Session N+1 handoff（25B 未完）

已完成：
- [x] OrderBulkShipPanel.tsx UI
- [x] /api/admin/orders/bulk-ship route
- [ ] trackingUrl.ts helper（差）
- [ ] /account/orders/[id] 客戶 UI（差）
- [ ] Orders.ts admin.components 掛載（差）

WIP commit: <sha> on feat/fulfillment
下 session 先：跑 dev → /admin/collections/orders 看 panel 是否出現；接做 trackingUrl + 客戶頁。
```
