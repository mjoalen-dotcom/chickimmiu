# 26 — 客服中心 v1 Phase 1A：Foundation Schema

**狀態**：草案，待 user 過目後開 PR
**Branch**：`feat/cs-phase1a-schema`
**估時**：1 個工作日（純 schema + migration + sidebar group，不含 UI）
**對應 master plan**：對話內 2026-04-28 拍板的 10-phase / ~40 PR 完整版

---

## Context

封測期間打造 Shopline 風格「一站式客服串接」中心，整合 LINE OA / FB Messenger / IG DM / Email / 站內 Web Chat 五個 channel + AI 輔助 + KB 自助。Phase 1 共 7 個 sub-PR（1A–1G），這份是 1A：把資料模型一次想完整、可 ALTER 加欄位的擴充式 schema，後續 phase 不破壞。

**現在 commit**：`88694c4` (PR #147 admin sidebar ⓪ 數據儀表 + lucide icons)
**Parent branch**：`main`
**架構決定（已 lock）**：

1. Schema-first：1A 一次把 priority / status / SLA / internal / audit 全做到位
2. Channel adapter pattern：每 channel 實作 `verifyWebhook / parseInbound / sendOutbound / mapAttachment` interface
3. External ID mapping：每 Message 存 channel 端原生 ID 用於 dedup + reply chain
4. Async job queue：webhook 立刻 ACK 200 → 入 queue → 背景處理
5. SSE + 30s polling 雙保險
6. YAGNI multi-tenant：不加 `merchant` 欄位
7. Audit log everything（ConversationActivities）
8. i18n boundary：文案從 widget 開始進 messages.json

---

## 評估筆記（schema 大小取捨）

User 在 1A 過目時問「47+22 欄位是否過厚」。評估結論：**全保留 + 用 Payload tabs 把 Conversations 切 6 個分頁**，理由：

| 取捨 | 砍 9 個 Phase 6/8 欄位 | 全保留（採用） |
|---|---|---|
| 現在工 | -5 行 schema | 0 |
| 未來工 | 9 個 ALTER ADD COLUMN migration ≈ 270 行 | 0 |
| Phase 6/8 實作 | 要先寫 schema migration、跑 prod migrate、再做功能 | 直接寫功能 |
| Admin form 雜訊 | 較少 | tabs 分頁解決 |
| Schema drift 風險 | 中（容易漏） | 0 |
| 客戶端衝擊 | 0（封測） | 0 |

Conversations 用 tabs 拆 6 個分頁，每 tab 約 5–13 欄：

| Tab | 欄位數 | 內容 |
|---|---|---|
| 基本 | 13 | ticketNumber + 客戶（5）+ channel（2）+ 狀態（3）+ subject + externalThreadId |
| 指派與關聯 | 7 | assignee + tags + category + 3 個 related + mergedInto |
| SLA | 5 | firstResponseAt + resolvedAt + lastMessageAt + slaDueAt + slaBreached |
| 內部備註 | 1 | internalNote（rich text） |
| 來源追蹤 | 4 | source + UTM 三欄 |
| AI 與 CSAT | 7 | aiSummary + sentiment + detectedLanguage + 3 個 csat 欄位（標 [Phase 6/8 接通]） |

Messages 22 欄不分頁（一般單則訊息編輯不會展開長表單；rawPayload 已 hidden:true）。

---

## Background — 既存資產與 gaps

### 要 deprecate（不刪資料）
**`CustomerServiceTickets`**（`src/collections/CustomerServiceTickets.ts`，slug `customer-service-tickets`，group `⑤ 互動體驗`）
- 太薄的 v0：messages 是 inline array、無 externalId、無 audit、無 webhook hook
- **處理**：Phase 1A 改 `admin.hidden: true`，從 sidebar 消失但表保留，後續 v2 寫 backfill 腳本搬資料到 Conversations + Messages
- 不從 `payload.config.ts` collections array 移除（FK 欄位避免 dangling）

### 要保留 + Phase 5A 擴充
**`MessageTemplates`**（`src/collections/MessageTemplates.ts`，group `④ 行銷推廣`）
- 完整的多管道行銷模板，含 segment / 信用分數 / 等級 variants
- Phase 1A **完全不動**
- Phase 5A 加：`channel.options` 補 `'web_chat'`、`category.options` 補 `'customer_service'`，slash `/template-slug` 命令在後台 inbox 載入

### 要複用
**Groq Llama 3.1 8B**（`src/lib/horoscope/groq.ts`）
- OpenAI-compatible endpoint `https://api.groq.com/openai/v1`
- env：`GROQ_API_KEY`（已在 prod 設好，horoscope 在用）
- Phase 1A **不動**
- Phase 6 把這檔 generalize 成 `src/lib/llm/groq.ts`，horoscope refactor 用之，customer service `src/lib/customer-service/ai.ts` 也用之

**Resend email adapter**（`src/payload.config.ts:118`）
- Phase 3 接 Email channel 直接用同個 Resend API key，加 Inbound Parse webhook 即可

### Sidebar group 歸屬
- 不新增 group，4 collection + 1 global 全進既有 `③ 會員與 CRM`
- 客服本質是 CRM 的延伸（客戶 360 視角的一部分），跟 Users / MembershipTiers / PointsTransactions / MemberSegments 同 group 邏輯通順
- memory `project_admin_sidebar_8_groups.md` 維持 ⓪–⑦ 8 group 不破壞

---

## Task — 4 collection + 1 global + Users 加欄位 + 1 migration

### 1. `src/collections/Conversations.ts`（新）

對話主檔。1 row = 1 個客服 thread（跨多訊息）。

> **⚠️ 實作注意（tabs 結構）**：spec 程式碼為了易讀展平所有欄位，**實作時必須包成 Payload tabs**（參考 Users.ts:176 / Products.ts / SiteThemes.ts pattern）。tab 切分依評估筆記表格：基本（13）/ 指派與關聯（7）/ SLA（5）/ 內部備註（1）/ 來源追蹤（4）/ AI 與 CSAT（7）。包法：
>
> ```ts
> fields: [
>   {
>     type: 'tabs',
>     tabs: [
>       { label: '基本', fields: [/* identity + customer + channel + status 13 欄 */] },
>       { label: '指派與關聯', fields: [/* assignee, tags, category, related*, mergedInto */] },
>       { label: 'SLA', fields: [/* firstResponseAt, resolvedAt, lastMessageAt, slaDueAt, slaBreached */] },
>       { label: '內部備註', fields: [/* internalNote */] },
>       { label: '來源追蹤', fields: [/* source, utm* */] },
>       { label: 'AI 與 CSAT', fields: [/* aiSummary, aiSummaryGeneratedAt, sentiment, detectedLanguage, csat* */],
>         description: 'Phase 6（AI）與 Phase 8（CSAT）接通後啟用，目前欄位先存資料用' },
>     ],
>   },
> ],
> ```

```ts
import type { CollectionConfig } from 'payload'
import { isAdmin } from '../access/isAdmin'

export const Conversations: CollectionConfig = {
  slug: 'conversations',
  labels: { singular: '對話', plural: '對話' },
  admin: {
    group: '③ 會員與 CRM',
    useAsTitle: 'ticketNumber',
    defaultColumns: ['ticketNumber', 'channel', 'customer', 'status', 'priority', 'assignee', 'lastMessageAt'],
    description: '所有 channel 的客服對話 thread（LINE/FB/IG/Email/Web Chat/Phone/Web Form）',
    listSearchableFields: ['ticketNumber', 'subject', 'externalThreadId'],
  },
  access: {
    read: isAdmin,
    create: isAdmin,
    update: isAdmin,
    delete: isAdmin,
  },
  timestamps: true,
  fields: [
    // 識別
    { name: 'ticketNumber', label: '工單編號', type: 'text', required: true, unique: true, index: true,
      admin: { description: '格式 CS-YYYY-NNNNN，beforeChange hook 自動產生' } },
    { name: 'externalThreadId', label: '外部 thread ID', type: 'text', index: true,
      admin: { description: 'LINE: source.userId / FB: senderPSID / IG: senderId / Email: thread Message-ID root' } },
    { name: 'subject', label: '主題', type: 'text',
      admin: { description: 'Email subject / 自動取首訊息前 30 字' } },

    // 客戶（兩種：登入會員 OR 匿名）
    { name: 'customer', label: '會員', type: 'relationship', relationTo: 'users', index: true },
    { name: 'anonId', label: '匿名 ID', type: 'text', index: true,
      admin: { description: 'Web chat 匿名訪客；登入後 customer relationship 補上、anonId 留著' } },
    { name: 'guestName', label: '訪客顯示名稱', type: 'text',
      admin: { description: '無登入時客戶輸入的暱稱，或 channel 端取得（LINE displayName / FB profile name）' } },
    { name: 'guestEmail', label: '訪客 Email', type: 'email' },
    { name: 'guestPhone', label: '訪客電話', type: 'text' },

    // Channel
    { name: 'channel', label: '管道', type: 'select', required: true,
      options: [
        { label: '站內 Web Chat', value: 'web' },
        { label: 'LINE OA', value: 'line' },
        { label: 'FB Messenger', value: 'fb' },
        { label: 'IG DM', value: 'ig' },
        { label: 'Email', value: 'email' },
        { label: '電話', value: 'phone' },
        { label: '網頁表單', value: 'web_form' },
      ],
      index: true },
    { name: 'channelMetadata', label: 'Channel metadata', type: 'json',
      admin: { description: 'Channel 端原始資訊（LINE channelId / FB pageId / IG igAccountId / Email mailbox）' } },

    // 狀態與生命週期
    { name: 'status', label: '狀態', type: 'select', required: true, defaultValue: 'open',
      options: [
        { label: '🟢 待回覆', value: 'open' },
        { label: '🟡 處理中', value: 'pending' },
        { label: '🔵 已解決', value: 'resolved' },
        { label: '⚫ 已關閉', value: 'closed' },
        { label: '🤖 AI 處理中', value: 'ai_handling' },
        { label: '⏳ 等客戶回應', value: 'awaiting_customer' },
        { label: '🚫 垃圾訊息', value: 'spam' },
      ],
      index: true },
    { name: 'priority', label: '優先度', type: 'select', defaultValue: 'normal',
      options: [
        { label: '低', value: 'low' },
        { label: '一般', value: 'normal' },
        { label: '高', value: 'high' },
        { label: '緊急', value: 'urgent' },
      ],
      index: true },
    { name: 'unread', label: '未讀', type: 'checkbox', defaultValue: true, index: true,
      admin: { description: '客戶端來新訊息 → true；staff 開過 → false' } },

    // 指派與分類
    { name: 'assignee', label: '指派客服', type: 'relationship', relationTo: 'users', index: true },
    { name: 'tags', label: '標籤', type: 'relationship', relationTo: 'message-tags', hasMany: true },
    { name: 'category', label: '分類', type: 'select',
      options: [
        { label: '訂單查詢', value: 'order_inquiry' },
        { label: '物流狀態', value: 'shipping_status' },
        { label: '退換貨', value: 'return_exchange' },
        { label: '尺寸建議', value: 'size_advice' },
        { label: '點數查詢', value: 'points_inquiry' },
        { label: '信用分數', value: 'credit_score' },
        { label: '商品推薦', value: 'product_recommendation' },
        { label: '優惠券查詢', value: 'coupon_inquiry' },
        { label: '等級升級', value: 'tier_upgrade' },
        { label: '客訴', value: 'complaint' },
        { label: '面交', value: 'meetup' },
        { label: '其他', value: 'other' },
      ] },

    // 關聯
    { name: 'relatedOrders', label: '相關訂單', type: 'relationship', relationTo: 'orders', hasMany: true },
    { name: 'relatedProducts', label: '相關商品', type: 'relationship', relationTo: 'products', hasMany: true },
    { name: 'relatedReturns', label: '相關退貨', type: 'relationship', relationTo: 'returns', hasMany: true },

    // 對話合併（同客戶跨 channel 多開時）
    { name: 'mergedInto', label: '合併到對話', type: 'relationship', relationTo: 'conversations',
      admin: { description: '此對話被合併到另一個 thread；mergedInto 有值的 conversation 不在 inbox 顯示' } },

    // SLA & 時序
    { name: 'firstResponseAt', label: '首回時間', type: 'date',
      admin: { description: '第一個 staff 訊息的時間，afterChange hook 寫入' } },
    { name: 'resolvedAt', label: '解決時間', type: 'date' },
    { name: 'lastMessageAt', label: '最後訊息時間', type: 'date', index: true,
      admin: { description: 'Messages.afterChange hook 同步' } },
    { name: 'slaDueAt', label: 'SLA 到期時間', type: 'date',
      admin: { description: '依 CustomerServiceSettings.sla 的 channel + priority 表格計算' } },
    { name: 'slaBreached', label: 'SLA 已逾時', type: 'checkbox', defaultValue: false, index: true },

    // CSAT（Phase 8 接）
    { name: 'csatScore', label: 'CSAT 評分', type: 'number', min: 1, max: 5 },
    { name: 'csatComment', label: 'CSAT 留言', type: 'textarea' },
    { name: 'csatAt', label: 'CSAT 提交時間', type: 'date' },

    // AI（Phase 6 接）
    { name: 'aiSummary', label: 'AI 摘要', type: 'textarea',
      admin: { description: '長對話 >20 訊息自動摘要，新增訊息後失效要重生' } },
    { name: 'aiSummaryGeneratedAt', label: 'AI 摘要產生時間', type: 'date' },
    { name: 'sentiment', label: '情緒', type: 'select',
      options: [
        { label: '😊 正面', value: 'positive' },
        { label: '😐 中立', value: 'neutral' },
        { label: '😟 負面', value: 'negative' },
        { label: '😡 憤怒', value: 'angry' },
      ] },
    { name: 'detectedLanguage', label: '偵測語言', type: 'text',
      admin: { description: 'BCP-47 語言代碼（zh-TW/en/ja...）；Phase 6 多語翻譯依此切' } },

    // 來源追蹤（行銷分析用）
    { name: 'source', label: '來源 URL', type: 'text',
      admin: { description: 'Web chat 觸發頁面 URL；其他 channel 留空' } },
    { name: 'utmSource', label: 'UTM source', type: 'text' },
    { name: 'utmMedium', label: 'UTM medium', type: 'text' },
    { name: 'utmCampaign', label: 'UTM campaign', type: 'text' },

    // 內部備註（rich text 給 staff 之間記事，**客戶看不到**）
    { name: 'internalNote', label: '內部備註', type: 'richText',
      admin: { description: '客戶絕對看不到。差異於 Messages.internal=true 是「對話流中的內部訊息」，這個是 thread-level pin' } },
  ],
  hooks: {
    beforeChange: [
      // ticketNumber 自動產生：CS-YYYY-NNNNN（YYYY 年度流水號）
      async ({ data, operation, req }) => {
        if (operation === 'create' && !data.ticketNumber) {
          const year = new Date().getFullYear()
          const result = await req.payload.find({
            collection: 'conversations',
            where: { ticketNumber: { like: `CS-${year}-%` } },
            sort: '-ticketNumber',
            limit: 1,
            depth: 0,
          })
          const last = result.docs[0]?.ticketNumber as string | undefined
          const lastNum = last ? parseInt(last.slice(-5), 10) : 0
          data.ticketNumber = `CS-${year}-${String(lastNum + 1).padStart(5, '0')}`
        }
        return data
      },
    ],
    afterChange: [
      // status / assignee / priority / tags 變更 → ConversationActivities 寫 audit log
      async ({ doc, previousDoc, operation, req }) => {
        if (operation !== 'update' || !previousDoc) return
        const changes: Array<{ field: string; from: unknown; to: unknown }> = []
        for (const field of ['status', 'priority', 'assignee', 'category', 'mergedInto'] as const) {
          if (doc[field] !== previousDoc[field]) {
            changes.push({ field, from: previousDoc[field], to: doc[field] })
          }
        }
        if (!changes.length) return
        await req.payload.create({
          collection: 'conversation-activities',
          data: {
            conversation: doc.id,
            actor: req.user?.id ?? null,
            actorType: req.user ? 'staff' : 'system',
            type: 'field_changed',
            payload: { changes },
          },
          req,
        })
      },
    ],
  },
}
```

### 2. `src/collections/Messages.ts`（新）

對話內每一則訊息。獨立 collection 不 inline，因為：
- Webhook race-safe（直接 `payload.create({collection:'messages'})`，不需先 read 整 thread）
- 可 query by `externalId` dedup
- 無 Payload array length 上限
- 可 index `(conversation, createdAt)` 翻頁快

```ts
import type { CollectionConfig } from 'payload'
import { isAdmin } from '../access/isAdmin'

export const Messages: CollectionConfig = {
  slug: 'messages',
  labels: { singular: '訊息', plural: '訊息' },
  admin: {
    group: '③ 會員與 CRM',
    useAsTitle: 'preview',
    defaultColumns: ['conversation', 'direction', 'sender', 'preview', 'createdAt'],
    description: '對話內每則訊息（雙向 inbound/outbound + 內部備註）',
    listSearchableFields: ['body', 'externalId'],
  },
  access: {
    read: isAdmin,
    create: isAdmin,
    update: isAdmin,
    delete: isAdmin,
  },
  timestamps: true,
  fields: [
    { name: 'conversation', label: '所屬對話', type: 'relationship', relationTo: 'conversations',
      required: true, index: true },
    { name: 'preview', label: '預覽', type: 'text', admin: { hidden: true },
      hooks: { beforeChange: [({ data, siblingData }) => {
        // 自動取 body 前 60 字當 preview（list view 顯示用）
        const body = (siblingData?.body as { root?: unknown } | string | undefined) ?? ''
        const text = typeof body === 'string' ? body : JSON.stringify(body).slice(0, 200)
        return text.replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim().slice(0, 60)
      }] } },

    // 方向 + 發送者
    { name: 'direction', label: '方向', type: 'select', required: true,
      options: [
        { label: '⬇️ 入站（客戶來訊）', value: 'in' },
        { label: '⬆️ 出站（我方回覆）', value: 'out' },
      ],
      index: true },
    { name: 'sender', label: '發送者類型', type: 'select', required: true,
      options: [
        { label: '客戶', value: 'customer' },
        { label: '客服人員', value: 'staff' },
        { label: 'AI', value: 'ai' },
        { label: '系統', value: 'system' },
      ] },
    { name: 'staffUser', label: '客服人員 user', type: 'relationship', relationTo: 'users',
      admin: { condition: (_, sib) => sib?.sender === 'staff' || sib?.sender === 'ai' } },

    // 內容
    { name: 'body', label: '內容', type: 'richText',
      admin: { description: '純文字 + 連結 + 簡單格式；附件用 attachments 欄' } },
    { name: 'attachments', label: '附件', type: 'array', fields: [
      { name: 'media', label: '檔案', type: 'upload', relationTo: 'media' },
      { name: 'caption', label: '說明', type: 'text' },
      { name: 'kind', label: '類型', type: 'select',
        options: [
          { label: '圖片', value: 'image' },
          { label: '影片', value: 'video' },
          { label: '音檔', value: 'audio' },
          { label: '貼圖', value: 'sticker' },
          { label: '檔案', value: 'file' },
          { label: '位置', value: 'location' },
        ] },
      { name: 'externalUrl', label: '外部 URL', type: 'text',
        admin: { description: 'Channel 端原始 URL（LINE contentProvider / FB attachment payload.url）；尚未下載時保留' } },
      { name: 'metadata', label: 'Metadata', type: 'json' },
    ] },

    // 內部備註（staff-only，客戶看不到，**Shopline 沒做好的關鍵差異化**）
    { name: 'internal', label: '內部備註', type: 'checkbox', defaultValue: false, index: true,
      admin: { description: '勾起來代表這則只給 staff 看，客戶端 widget / channel outbound 都不送' } },

    // 外部 ID（dedup + reply chain）
    { name: 'externalId', label: '外部訊息 ID', type: 'text', index: true,
      admin: { description: 'LINE messageId / FB mid / IG mid / Email Message-ID；inbound dedup' } },
    { name: 'replyToExternalId', label: '回覆對象外部 ID', type: 'text',
      admin: { description: 'Email In-Reply-To / LINE reply token / FB reply_to.mid' } },
    { name: 'quotedMessage', label: '引用訊息', type: 'relationship', relationTo: 'messages',
      admin: { description: '對話內顯示「引用了誰的訊息」' } },

    // 已讀狀態
    { name: 'readByCustomerAt', label: '客戶已讀時間', type: 'date',
      admin: { description: 'Web chat 即時；LINE/FB/IG 經 read receipt webhook 寫入' } },
    { name: 'readByStaffAt', label: 'Staff 已讀時間', type: 'date' },

    // 編輯與刪除（軟刪除）
    { name: 'editedAt', label: '編輯時間', type: 'date' },
    { name: 'deletedAt', label: '刪除時間', type: 'date',
      admin: { description: '軟刪除；UI 顯示「此訊息已撤回」，原文保留供 audit' } },

    // AI（Phase 6）
    { name: 'aiSuggestion', label: 'AI 回覆建議', type: 'json',
      admin: { description: '`{drafts: string[], confidence: number, generatedAt: ISO}`' } },
    { name: 'aiUsed', label: '採用 AI 建議', type: 'checkbox', defaultValue: false,
      admin: { description: 'Staff 點「套用」後標記，分析 AI 採用率' } },

    // Channel-specific raw payload（debug + replay 用）
    { name: 'rawPayload', label: '原始 payload', type: 'json',
      admin: { hidden: true, description: 'Channel webhook 原始 body，問題排查用' } },
  ],
  hooks: {
    afterChange: [
      // 1. 同步 Conversations.lastMessageAt + unread
      // 2. 首則 staff/ai 訊息 → 寫 firstResponseAt
      // 3. 觸發 SSE 推送給 admin
      async ({ doc, operation, req }) => {
        if (operation !== 'create') return
        const conv = await req.payload.findByID({
          collection: 'conversations',
          id: doc.conversation as string,
          depth: 0,
        })
        const updates: Record<string, unknown> = {
          lastMessageAt: doc.createdAt,
        }
        if (doc.direction === 'in' && !doc.internal) {
          updates.unread = true
          if (conv.status === 'resolved' || conv.status === 'closed') {
            updates.status = 'open' // 客戶再來訊自動 reopen
          }
        }
        if (doc.direction === 'out' && doc.sender !== 'system' && !conv.firstResponseAt) {
          updates.firstResponseAt = doc.createdAt
        }
        await req.payload.update({
          collection: 'conversations',
          id: doc.conversation as string,
          data: updates,
          req,
        })
        // SSE 廣播留待 1D 實作；此 hook Phase 1A 只負責資料
      },
    ],
  },
}
```

### 3. `src/collections/MessageTags.ts`（新）

可重複使用的 tag taxonomy。多階層支援。

```ts
import type { CollectionConfig } from 'payload'
import { isAdmin } from '../access/isAdmin'

export const MessageTags: CollectionConfig = {
  slug: 'message-tags',
  labels: { singular: '對話標籤', plural: '對話標籤' },
  admin: {
    group: '③ 會員與 CRM',
    useAsTitle: 'name',
    defaultColumns: ['name', 'parent', 'color', 'usageCount'],
    description: '客服對話分類標籤（多階層）',
  },
  access: {
    read: isAdmin,
    create: isAdmin,
    update: isAdmin,
    delete: isAdmin,
  },
  timestamps: true,
  fields: [
    { name: 'name', label: '標籤名稱', type: 'text', required: true, unique: true },
    { name: 'slug', label: '標籤代碼', type: 'text', required: true, unique: true, index: true,
      admin: { description: '英數加底線；自動指派規則的 keyword match 用' } },
    { name: 'parent', label: '父標籤', type: 'relationship', relationTo: 'message-tags',
      admin: { description: '留空 = 頂層；做出像「退換貨 > 尺寸不合 > 太大」的多階' } },
    { name: 'color', label: '顏色', type: 'select',
      options: ['gray', 'red', 'orange', 'yellow', 'green', 'blue', 'purple', 'pink'].map(
        (c) => ({ label: c, value: c })
      ) },
    { name: 'description', label: '說明', type: 'textarea' },
    { name: 'usageCount', label: '使用次數', type: 'number', defaultValue: 0,
      admin: { readOnly: true, description: '快取欄位；Conversations.tags 變動時遞增/遞減' } },
  ],
}
```

### 4. `src/collections/ConversationActivities.ts`（新，audit log）

每筆 assign / tag / status / merge / 編輯 / 刪除都進這。Shopline 最爛的就是沒這層；我們補完。

```ts
import type { CollectionConfig } from 'payload'
import { isAdmin } from '../access/isAdmin'

export const ConversationActivities: CollectionConfig = {
  slug: 'conversation-activities',
  labels: { singular: '對話活動記錄', plural: '對話活動記錄' },
  admin: {
    group: '③ 會員與 CRM',
    useAsTitle: 'type',
    defaultColumns: ['conversation', 'type', 'actor', 'createdAt'],
    description: 'Audit log：對話狀態 / 指派 / tag / 合併 / 編輯刪除全紀錄',
    hidden: false, // 給 admin 看 audit；如想藏起來改 true
  },
  access: {
    read: isAdmin,
    create: () => true, // 只允許 hook / API 寫入（前端不直接打）
    update: () => false,
    delete: isAdmin,
  },
  timestamps: true,
  fields: [
    { name: 'conversation', label: '對話', type: 'relationship', relationTo: 'conversations',
      required: true, index: true },
    { name: 'actor', label: '操作者', type: 'relationship', relationTo: 'users',
      admin: { description: 'null = 系統 / webhook / cron 自動操作' } },
    { name: 'actorType', label: '操作者類型', type: 'select', required: true, defaultValue: 'staff',
      options: [
        { label: '客服人員', value: 'staff' },
        { label: '客戶', value: 'customer' },
        { label: 'AI', value: 'ai' },
        { label: '系統', value: 'system' },
        { label: 'Webhook', value: 'webhook' },
      ] },
    { name: 'type', label: '活動類型', type: 'select', required: true, index: true,
      options: [
        { label: '對話開啟', value: 'conversation_opened' },
        { label: '欄位變更', value: 'field_changed' },
        { label: '指派變更', value: 'assignment_changed' },
        { label: '狀態變更', value: 'status_changed' },
        { label: 'Tag 加入', value: 'tag_added' },
        { label: 'Tag 移除', value: 'tag_removed' },
        { label: '對話合併', value: 'conversations_merged' },
        { label: '對話拆分', value: 'conversation_split' },
        { label: '訊息編輯', value: 'message_edited' },
        { label: '訊息刪除', value: 'message_deleted' },
        { label: '優先度升級', value: 'escalated' },
        { label: 'SLA 逾時', value: 'sla_breached' },
        { label: 'AI 自動回覆', value: 'ai_replied' },
        { label: 'CSAT 提交', value: 'csat_submitted' },
        { label: '客戶 reopen', value: 'reopened' },
      ] },
    { name: 'payload', label: '詳細', type: 'json',
      admin: { description: 'type-specific 結構，如 field_changed → `{changes: [{field, from, to}]}`' } },
    { name: 'note', label: '備註', type: 'text',
      admin: { description: '人工操作可選的補充說明' } },
  ],
}
```

### 5. `src/globals/CustomerServiceSettings.ts`（新 global）

業務時間、SLA 規則、自動回覆、anti-spam、預設指派人。

```ts
import type { GlobalConfig } from 'payload'
import { isAdmin } from '../access/isAdmin'

export const CustomerServiceSettings: GlobalConfig = {
  slug: 'customer-service-settings',
  label: '客服設定',
  admin: {
    group: '③ 會員與 CRM',
    description: '業務時間、SLA、自動回覆、anti-spam、預設指派人',
  },
  access: {
    read: isAdmin,
    update: isAdmin,
  },
  fields: [
    // 業務時間
    { name: 'businessHours', label: '業務時間', type: 'group', fields: [
      { name: 'timezone', label: '時區', type: 'text', defaultValue: 'Asia/Taipei' },
      { name: 'schedule', label: '每週時段', type: 'array', fields: [
        { name: 'dayOfWeek', label: '星期', type: 'select',
          options: [
            { label: '週一', value: '1' }, { label: '週二', value: '2' },
            { label: '週三', value: '3' }, { label: '週四', value: '4' },
            { label: '週五', value: '5' }, { label: '週六', value: '6' },
            { label: '週日', value: '0' },
          ] },
        { name: 'openTime', label: '開始（HH:mm）', type: 'text' },
        { name: 'closeTime', label: '結束（HH:mm）', type: 'text' },
      ] },
      { name: 'holidays', label: '假日', type: 'array', fields: [
        { name: 'date', label: '日期', type: 'date' },
        { name: 'reason', label: '原因', type: 'text' },
      ] },
      { name: 'offHourAutoReply', label: '離線自動回覆', type: 'textarea',
        defaultValue: '感謝您的訊息！目前是非營業時段，我們會在下次營業時間（週一至週五 10:00–18:00）盡快回覆您。' },
    ] },

    // SLA 規則
    { name: 'sla', label: 'SLA 規則', type: 'group', fields: [
      { name: 'firstResponseMinutes', label: '首回時限（分鐘）', type: 'array', fields: [
        { name: 'channel', label: 'Channel', type: 'select',
          options: ['web', 'line', 'fb', 'ig', 'email', 'phone', 'web_form'].map((c) => ({ label: c, value: c })) },
        { name: 'priority', label: '優先度', type: 'select',
          options: ['low', 'normal', 'high', 'urgent'].map((p) => ({ label: p, value: p })) },
        { name: 'minutes', label: '分鐘', type: 'number' },
      ] },
      { name: 'resolutionHours', label: '解決時限（小時）', type: 'array', fields: [
        { name: 'priority', label: '優先度', type: 'select',
          options: ['low', 'normal', 'high', 'urgent'].map((p) => ({ label: p, value: p })) },
        { name: 'hours', label: '小時', type: 'number' },
      ] },
      { name: 'breachAction', label: '逾時動作', type: 'select', defaultValue: 'notify_assignee',
        options: [
          { label: '通知指派人', value: 'notify_assignee' },
          { label: '升級優先度', value: 'escalate' },
          { label: '通知主管', value: 'notify_supervisor' },
        ] },
    ] },

    // 預設指派
    { name: 'defaultAssignee', label: '預設指派客服', type: 'relationship', relationTo: 'users',
      admin: { description: '新對話建立時自動指派；留空 = 不指派' } },
    { name: 'autoAssignMode', label: '自動指派策略', type: 'select', defaultValue: 'round_robin',
      options: [
        { label: '不自動指派', value: 'none' },
        { label: '輪流分配', value: 'round_robin' },
        { label: '依關鍵字', value: 'keyword' },
        { label: '依客戶等級', value: 'tier' },
      ] },

    // 開場 / 歡迎訊息
    { name: 'greeting', label: '歡迎訊息', type: 'group', fields: [
      { name: 'web', label: '站內 Web Chat', type: 'textarea',
        defaultValue: '哈囉！我是 CHIC KIM & MIU 的客服小幫手，請問需要什麼協助呢？' },
      { name: 'line', label: 'LINE OA', type: 'textarea' },
      { name: 'fb', label: 'FB Messenger', type: 'textarea' },
      { name: 'ig', label: 'IG DM', type: 'textarea' },
    ] },

    // Anti-spam
    { name: 'antiSpam', label: '防 Spam', type: 'group', fields: [
      { name: 'maxMessagesPerMinute', label: '單一 anonId 每分鐘上限', type: 'number', defaultValue: 5 },
      { name: 'blockedKeywords', label: '黑名單關鍵字', type: 'array',
        fields: [{ name: 'keyword', type: 'text' }] },
      { name: 'blockedAnonIds', label: '黑名單 anonId', type: 'array',
        fields: [{ name: 'anonId', type: 'text' }] },
      { name: 'blockedIPs', label: '黑名單 IP', type: 'array',
        fields: [{ name: 'ip', type: 'text' }] },
    ] },

    // CSAT
    { name: 'csat', label: 'CSAT 設定', type: 'group', fields: [
      { name: 'enabled', label: '啟用', type: 'checkbox', defaultValue: true },
      { name: 'sendDelayHours', label: '結案後幾小時寄出', type: 'number', defaultValue: 24 },
      { name: 'question', label: '評分問題', type: 'text',
        defaultValue: '您對這次客服體驗滿意嗎？（1–5 星）' },
    ] },
  ],
}
```

### 6. `src/collections/Users.ts`（修改）

加 `notificationPreferences` group 到既有 Tab 結構。**只動 fields，不動 auth 設定**。

```ts
// 加進現有 Users.ts 的 fields[]，建議放在 Tab 2 / Tab 3 之間獨立 group
{
  name: 'notificationPreferences',
  label: '客服通知偏好',
  type: 'group',
  admin: {
    description: '僅 staff（admin role）有效',
    condition: (data) => data?.role === 'admin',
  },
  fields: [
    { name: 'bellInAdmin', label: '後台鈴鐺通知', type: 'checkbox', defaultValue: true },
    { name: 'emailDigest', label: '每日 email digest', type: 'checkbox', defaultValue: false },
    { name: 'emailDigestTime', label: 'Email digest 寄出時間（HH:mm）', type: 'text', defaultValue: '09:00' },
    { name: 'channels', label: '訂閱 channel 通知', type: 'select', hasMany: true,
      defaultValue: ['web', 'line', 'fb', 'ig', 'email'],
      options: ['web', 'line', 'fb', 'ig', 'email', 'phone', 'web_form'].map(
        (c) => ({ label: c, value: c })
      ) },
    { name: 'quietHoursStart', label: '靜音時段開始', type: 'text',
      admin: { description: 'HH:mm；勿擾期間不發 push、bell 不亮，但 email digest 仍寄' } },
    { name: 'quietHoursEnd', label: '靜音時段結束', type: 'text' },
    { name: 'mobilePushToken', label: '手機 push token', type: 'text',
      admin: { description: '為將來 PWA push 預留欄位；Phase 5 暫不實作' } },
  ],
},
```

### 7. `src/migrations/20260428_120000_add_customer_service_v1.ts`（新）

PRAGMA 冪等 pattern，承襲 `20260418_220000_add_login_attempts.ts`。

```ts
import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-sqlite'

/**
 * 客服中心 v1 Phase 1A — Foundation Schema
 *   新增表：conversations / messages / messages_attachments / message_tags /
 *           conversation_activities + globals customer-service-settings
 *           加 users 欄位 notification_preferences_*
 *           加 conversations_rels / messages_rels（hasMany 關聯表）
 *
 * 對應 collection / global：
 *   - Conversations.ts
 *   - Messages.ts（含 attachments inline array）
 *   - MessageTags.ts
 *   - ConversationActivities.ts
 *   - CustomerServiceSettings.ts (global)
 *   - Users.ts notificationPreferences group
 *
 * 冪等：sqlite_master 判表存在 + PRAGMA 判欄位存在；可重複跑
 *
 * down：DROP 新表，不 ALTER 移除 users 欄位（SQLite DROP COLUMN 成本高）
 */

async function tableExists(db: any, table: string): Promise<boolean> {
  const res = await db.run(
    sql.raw(`SELECT name FROM sqlite_master WHERE type='table' AND name='${table}';`)
  )
  return ((res?.rows ?? res ?? []) as Array<unknown>).length > 0
}

async function columnExists(db: any, table: string, column: string): Promise<boolean> {
  const res = await db.run(sql.raw(`PRAGMA table_info('${table}');`))
  const rows = (res?.rows ?? res ?? []) as Array<{ name?: string }>
  return rows.some((r) => r.name === column)
}

export async function up({ db }: MigrateUpArgs): Promise<void> {
  // ─── conversations ──────────────────────────────────────
  if (!(await tableExists(db, 'conversations'))) {
    await db.run(sql`CREATE TABLE \`conversations\` (
      \`id\` integer PRIMARY KEY NOT NULL,
      \`ticket_number\` text NOT NULL UNIQUE,
      \`external_thread_id\` text,
      \`subject\` text,
      \`customer_id\` integer REFERENCES users(id),
      \`anon_id\` text,
      \`guest_name\` text,
      \`guest_email\` text,
      \`guest_phone\` text,
      \`channel\` text NOT NULL,
      \`channel_metadata\` text, -- JSON
      \`status\` text DEFAULT 'open' NOT NULL,
      \`priority\` text DEFAULT 'normal',
      \`unread\` integer DEFAULT 1,
      \`assignee_id\` integer REFERENCES users(id),
      \`category\` text,
      \`merged_into_id\` integer REFERENCES conversations(id),
      \`first_response_at\` text,
      \`resolved_at\` text,
      \`last_message_at\` text,
      \`sla_due_at\` text,
      \`sla_breached\` integer DEFAULT 0,
      \`csat_score\` integer,
      \`csat_comment\` text,
      \`csat_at\` text,
      \`ai_summary\` text,
      \`ai_summary_generated_at\` text,
      \`sentiment\` text,
      \`detected_language\` text,
      \`source\` text,
      \`utm_source\` text,
      \`utm_medium\` text,
      \`utm_campaign\` text,
      \`internal_note\` text, -- JSON richtext
      \`updated_at\` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
      \`created_at\` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL
    );`)
    for (const idx of [
      ['ticket_number'], ['external_thread_id'], ['customer_id'], ['anon_id'],
      ['channel'], ['status'], ['priority'], ['unread'], ['assignee_id'],
      ['last_message_at'], ['sla_breached'], ['updated_at'], ['created_at'],
    ]) {
      const name = `conversations_${idx.join('_')}_idx`
      await db.run(sql.raw(`CREATE INDEX \`${name}\` ON \`conversations\` (\`${idx.join('`, `')}\`);`))
    }
  }

  // conversations_rels（tags / related_orders / related_products / related_returns hasMany）
  if (!(await tableExists(db, 'conversations_rels'))) {
    await db.run(sql`CREATE TABLE \`conversations_rels\` (
      \`id\` integer PRIMARY KEY NOT NULL,
      \`order\` integer NOT NULL,
      \`parent_id\` integer NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
      \`path\` text NOT NULL,
      \`message_tags_id\` integer REFERENCES message_tags(id),
      \`orders_id\` integer REFERENCES orders(id),
      \`products_id\` integer REFERENCES products(id),
      \`returns_id\` integer REFERENCES returns(id)
    );`)
    await db.run(sql`CREATE INDEX \`conversations_rels_parent_id_idx\` ON \`conversations_rels\` (\`parent_id\`);`)
    await db.run(sql`CREATE INDEX \`conversations_rels_path_idx\` ON \`conversations_rels\` (\`path\`);`)
  }

  // ─── messages ───────────────────────────────────────────
  if (!(await tableExists(db, 'messages'))) {
    await db.run(sql`CREATE TABLE \`messages\` (
      \`id\` integer PRIMARY KEY NOT NULL,
      \`conversation_id\` integer NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
      \`preview\` text,
      \`direction\` text NOT NULL,
      \`sender\` text NOT NULL,
      \`staff_user_id\` integer REFERENCES users(id),
      \`body\` text, -- JSON richtext
      \`internal\` integer DEFAULT 0,
      \`external_id\` text,
      \`reply_to_external_id\` text,
      \`quoted_message_id\` integer REFERENCES messages(id),
      \`read_by_customer_at\` text,
      \`read_by_staff_at\` text,
      \`edited_at\` text,
      \`deleted_at\` text,
      \`ai_suggestion\` text, -- JSON
      \`ai_used\` integer DEFAULT 0,
      \`raw_payload\` text, -- JSON
      \`updated_at\` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
      \`created_at\` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL
    );`)
    for (const idx of [
      ['conversation_id'], ['direction'], ['internal'],
      ['external_id'], ['updated_at'], ['created_at'],
      // Compound for thread query：(conversation_id, created_at)
    ]) {
      const name = `messages_${idx.join('_')}_idx`
      await db.run(sql.raw(`CREATE INDEX \`${name}\` ON \`messages\` (\`${idx.join('`, `')}\`);`))
    }
    await db.run(sql`CREATE INDEX \`messages_conversation_created_idx\` ON \`messages\` (\`conversation_id\`, \`created_at\`);`)
  }

  // messages_attachments（inline array）
  if (!(await tableExists(db, 'messages_attachments'))) {
    await db.run(sql`CREATE TABLE \`messages_attachments\` (
      \`_order\` integer NOT NULL,
      \`_parent_id\` integer NOT NULL REFERENCES messages(id) ON DELETE CASCADE,
      \`id\` text PRIMARY KEY NOT NULL,
      \`media_id\` integer REFERENCES media(id),
      \`caption\` text,
      \`kind\` text,
      \`external_url\` text,
      \`metadata\` text -- JSON
    );`)
    await db.run(sql`CREATE INDEX \`messages_attachments_parent_id_idx\` ON \`messages_attachments\` (\`_parent_id\`);`)
  }

  // ─── message_tags ───────────────────────────────────────
  if (!(await tableExists(db, 'message_tags'))) {
    await db.run(sql`CREATE TABLE \`message_tags\` (
      \`id\` integer PRIMARY KEY NOT NULL,
      \`name\` text NOT NULL UNIQUE,
      \`slug\` text NOT NULL UNIQUE,
      \`parent_id\` integer REFERENCES message_tags(id),
      \`color\` text,
      \`description\` text,
      \`usage_count\` integer DEFAULT 0,
      \`updated_at\` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
      \`created_at\` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL
    );`)
    await db.run(sql`CREATE INDEX \`message_tags_slug_idx\` ON \`message_tags\` (\`slug\`);`)
    await db.run(sql`CREATE INDEX \`message_tags_parent_id_idx\` ON \`message_tags\` (\`parent_id\`);`)
  }

  // ─── conversation_activities ────────────────────────────
  if (!(await tableExists(db, 'conversation_activities'))) {
    await db.run(sql`CREATE TABLE \`conversation_activities\` (
      \`id\` integer PRIMARY KEY NOT NULL,
      \`conversation_id\` integer NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
      \`actor_id\` integer REFERENCES users(id),
      \`actor_type\` text DEFAULT 'staff' NOT NULL,
      \`type\` text NOT NULL,
      \`payload\` text, -- JSON
      \`note\` text,
      \`updated_at\` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
      \`created_at\` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL
    );`)
    await db.run(sql`CREATE INDEX \`conversation_activities_conversation_id_idx\` ON \`conversation_activities\` (\`conversation_id\`);`)
    await db.run(sql`CREATE INDEX \`conversation_activities_type_idx\` ON \`conversation_activities\` (\`type\`);`)
    await db.run(sql`CREATE INDEX \`conversation_activities_created_at_idx\` ON \`conversation_activities\` (\`created_at\`);`)
  }

  // ─── customer_service_settings (global) ─────────────────
  if (!(await tableExists(db, 'customer_service_settings'))) {
    await db.run(sql`CREATE TABLE \`customer_service_settings\` (
      \`id\` integer PRIMARY KEY NOT NULL,
      \`business_hours_timezone\` text DEFAULT 'Asia/Taipei',
      \`business_hours_off_hour_auto_reply\` text,
      \`sla_breach_action\` text DEFAULT 'notify_assignee',
      \`default_assignee_id\` integer REFERENCES users(id),
      \`auto_assign_mode\` text DEFAULT 'round_robin',
      \`greeting_web\` text,
      \`greeting_line\` text,
      \`greeting_fb\` text,
      \`greeting_ig\` text,
      \`anti_spam_max_messages_per_minute\` integer DEFAULT 5,
      \`csat_enabled\` integer DEFAULT 1,
      \`csat_send_delay_hours\` integer DEFAULT 24,
      \`csat_question\` text,
      \`updated_at\` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
      \`created_at\` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL
    );`)
    // 子表（businessHours.schedule / holidays / sla rules / blocked_* arrays）
    // Payload v3 array fields → 子表，這裡先建空骨架；CRUD 由 Payload 自管
    // 略：實際 generate:db 會自動建好，手寫 migration 只要保證主表 + 索引即可
  }

  // ─── users.notification_preferences_* ──────────────────
  for (const [col, type, def] of [
    ['notification_preferences_bell_in_admin', 'integer', '1'],
    ['notification_preferences_email_digest', 'integer', '0'],
    ['notification_preferences_email_digest_time', 'text', "'09:00'"],
    ['notification_preferences_quiet_hours_start', 'text', null],
    ['notification_preferences_quiet_hours_end', 'text', null],
    ['notification_preferences_mobile_push_token', 'text', null],
  ] as const) {
    if (!(await columnExists(db, 'users', col))) {
      const defaultClause = def != null ? ` DEFAULT ${def}` : ''
      await db.run(sql.raw(`ALTER TABLE \`users\` ADD \`${col}\` ${type}${defaultClause};`))
    }
  }
  // notification_preferences_channels 是 select hasMany → 子表 users_notification_preferences_channels
  if (!(await tableExists(db, 'users_notification_preferences_channels'))) {
    await db.run(sql`CREATE TABLE \`users_notification_preferences_channels\` (
      \`order\` integer NOT NULL,
      \`parent_id\` integer NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      \`value\` text,
      \`id\` text PRIMARY KEY NOT NULL
    );`)
    await db.run(sql`CREATE INDEX \`users_notification_preferences_channels_parent_id_idx\` ON \`users_notification_preferences_channels\` (\`parent_id\`);`)
  }

  // ─── payload_locked_documents_rels FK 欄位 ──────────────
  for (const slug of [
    'conversations',
    'messages',
    'message_tags',
    'conversation_activities',
  ]) {
    const col = `${slug}_id`
    if (!(await columnExists(db, 'payload_locked_documents_rels', col))) {
      await db.run(sql.raw(
        `ALTER TABLE \`payload_locked_documents_rels\` ADD \`${col}\` integer REFERENCES ${slug}(id);`
      ))
      await db.run(sql.raw(
        `CREATE INDEX \`payload_locked_documents_rels_${col}_idx\` ON \`payload_locked_documents_rels\` (\`${col}\`);`
      ))
    }
  }
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  for (const t of [
    'conversation_activities',
    'messages_attachments',
    'messages',
    'conversations_rels',
    'conversations',
    'message_tags',
    'customer_service_settings',
    'users_notification_preferences_channels',
  ]) {
    if (await tableExists(db, t)) {
      await db.run(sql.raw(`DROP TABLE \`${t}\`;`))
    }
  }
  // 不 DROP COLUMN users.notification_preferences_* 與 payload_locked_documents_rels.*_id（SQLite 成本高）
}
```

### 8. `src/migrations/index.ts`（修改）

加 import + push 進 array：

```ts
import * as migration_20260428_120000_add_customer_service_v1 from './20260428_120000_add_customer_service_v1';
// ... existing imports ...

export const migrations = [
  // ... existing entries ...
  {
    up: migration_20260428_120000_add_customer_service_v1.up,
    down: migration_20260428_120000_add_customer_service_v1.down,
    name: '20260428_120000_add_customer_service_v1',
  },
];
```

### 9. `src/payload.config.ts`（修改）

```ts
// imports（接在 PointsTransactions / MemberSegments / UserRewards 等 ③ collection imports 附近）
import { Conversations } from './collections/Conversations'
import { Messages } from './collections/Messages'
import { MessageTags } from './collections/MessageTags'
import { ConversationActivities } from './collections/ConversationActivities'
import { CustomerServiceSettings } from './globals/CustomerServiceSettings'

// collections array — append 到既有「③ 會員與 CRM」段落尾端（UserRewards 之後）
collections: [
  // ... ①, ② 不動 ...
  // ③ 會員與 CRM（既有 + 新增 4 個）
  Users,
  MembershipTiers,
  SubscriptionPlans,
  PointsRedemptions,
  CreditScoreHistory,
  PointsTransactions,
  MemberSegments,
  UserRewards,
  // ↓ 新增（保持在 ③ section 內）
  Conversations,
  Messages,
  MessageTags,
  ConversationActivities,
  // ... ④ ~ ⑦ 不動 ...
],

// globals array — append 到既有「③ 會員與 CRM」段落尾端（SegmentationSettings 之後）
globals: [
  // ... ① 不動 ...
  // ③ 會員與 CRM（既有 + 新增 1 個）
  LoyaltySettings,
  ReferralSettings,
  PointRedemptionSettings,
  CRMSettings,
  SegmentationSettings,
  CustomerServiceSettings, // ← 新增
  // ... ④ ~ ⑦ 不動 ...
],
```

### 10. `src/collections/CustomerServiceTickets.ts`（修改）

加 `admin.hidden: true`，從 sidebar 消失但表保留：

```ts
admin: {
  group: '⑤ 互動體驗',
  useAsTitle: 'ticketNumber',
  hidden: true, // ← 新增；v2 由 Conversations + Messages 取代
  description: 'AI + 真人客服工單（v0，已停用，由 Conversations + Messages 取代）',
  defaultColumns: ['ticketNumber', 'user', 'channel', 'status', 'priority', 'category', 'createdAt'],
},
```

---

## Verification

```bash
# 1. TypeScript
pnpm tsc --noEmit

# 2. Build
pnpm build

# 3. Local migrate（dev DB）
pnpm payload migrate

# 4. Dev server 起來
pnpm dev
# → /admin login → 確認左 sidebar「③ 會員與 CRM」group 內多出 4 collection + 1 global
# → 4 collection：對話 / 訊息 / 對話標籤 / 對話活動記錄（接在 UserRewards 之後）
# → 1 global：客服設定（接在 SegmentationSettings 之後）
# → 進「對話」按「+ 新建」→ 填 channel=web、guest_name=測試 → 儲存
# → ticketNumber 自動產生 CS-2026-00001
# → 進「訊息」按「+ 新建」→ conversation 選剛建的、direction=in、sender=customer、body 填字 → 儲存
# → 回對話 list view → lastMessageAt 更新、unread=true
# → 改 priority=high → 進「對話活動記錄」應有一筆 type=field_changed

# 5. CustomerServiceTickets 應從 sidebar ⑤ 消失（但 collection table 保留）

# 6. importmap regen（admin component 沒新加但建議跑一次防漏）
pnpm payload generate:importmap
git diff src/app/(payload)/admin/importMap.js
# → 應無 diff（沒加 admin.components.*）

# 7. payload-types regen
pnpm payload generate:types
git diff src/payload-types.ts
# → 應有 4 個新 collection + 1 global + Users 新欄位的 type 定義
```

---

## Commit & Push

```bash
git checkout -b feat/cs-phase1a-schema
git add \
  src/collections/Conversations.ts \
  src/collections/Messages.ts \
  src/collections/MessageTags.ts \
  src/collections/ConversationActivities.ts \
  src/collections/CustomerServiceTickets.ts \
  src/collections/Users.ts \
  src/globals/CustomerServiceSettings.ts \
  src/migrations/20260428_120000_add_customer_service_v1.ts \
  src/migrations/index.ts \
  src/payload.config.ts \
  src/payload-types.ts \
  docs/session-prompts/26-customer-service-phase1a.md

git commit -m "$(cat <<'EOF'
feat(cs): Phase 1A foundation schema for customer service hub

Add 4 collections + 1 global + Users notificationPreferences:
- Conversations (thread-level, 1 row per ticket, ticketNumber auto CS-YYYY-NNNNN)
- Messages (separate from Conversations for race-safe webhooks + externalId dedup)
- MessageTags (multi-level taxonomy)
- ConversationActivities (audit log — every assign/tag/status/merge/edit)
- CustomerServiceSettings global (business hours, SLA, anti-spam, CSAT, greetings)
- Users.notificationPreferences group (per-staff bell/email digest/quiet hours)

All new collections + global live in existing ③ 會員與 CRM group
(no new sidebar group; CS is treated as CRM extension).

Deprecate CustomerServiceTickets via admin.hidden:true (data preserved,
sidebar removed). v2 backfill script in Phase 1B will migrate any existing rows.

Migration 20260428_120000_add_customer_service_v1 follows PRAGMA-idempotent
pattern (sqlite_master + PRAGMA table_info checks; safe on dev push'd DB +
fresh prod DB + re-runs).

Phase 1A is schema-only; UI/widget/SSE come in 1B–1G.
EOF
)"

git push -u origin feat/cs-phase1a-schema
```

開 PR → 等 CI 綠 → merge 到 main。

---

## Prod Deploy

```bash
# SSH 到 prod
ssh root@5.223.85.14 /root/deploy-ckmu.sh
# 等於 (在 server 端):
#   cd /var/www/chickimmiu
#   git pull
#   pnpm install --frozen-lockfile
#   yes y | pnpm payload migrate    # ← Phase 1A migration 跑這裡
#   pnpm build
#   pm2 restart chickimmiu-nextjs

# 驗證
curl -sI https://pre.chickimmiu.com/admin | head -1   # → 200
# 開 https://pre.chickimmiu.com/admin → 確認 ③ 會員與 CRM group 多出 4 collection + 1 global
```

---

## Guardrails

1. **不要碰 `MessageTemplates.ts`** — Phase 5A 才動
2. **不要刪 `CustomerServiceTickets`** — 只加 `admin.hidden: true`，保留 collection 跟資料
3. **migration 一定要冪等** — 用 sqlite_master + PRAGMA 檢查；不能假設 fresh DB
4. **不開新 sidebar group** — 全部進既有 `③ 會員與 CRM`，append 到段落尾端（不破壞既有 8 group 結構）
5. **不要 `--no-verify` / `--force-push`** — 守 hooks
6. **不要動 `payload.config.ts` 既有 collection 順序** — 在 ③ 會員與 CRM 段落 `UserRewards` 之後 append；不重排其他 group
7. **importmap 不需要 regen**（Phase 1A 沒加 admin.components.*；1B 才需要）
8. **不寫 admin custom views** — Phase 1B 才開始 `/admin/conversations` UI
9. **不接 webhook**（Phase 2 起接）— 1A 只做資料模型
10. **不裝新 npm 套件**

---

## 後續 phase（提示備忘）

| Phase | PR Branch | Scope |
|---|---|---|
| 1B | `feat/cs-admin-inbox` | `/admin/conversations` 列表 + thread 雙欄 + 客戶側欄 |
| 1C | `feat/cs-web-widget` | 前台 floating chat widget（匿名 + 登入） |
| 1D | `feat/cs-realtime-sse` | SSE `/api/messages/stream` + 30s polling 備援 |
| 1E | `feat/cs-attachments` | 附件雙向（透過 Media + R2）+ 縮圖 |
| 1F | `feat/cs-internal-notes` | Internal note 在 thread UI 視覺差異化（黃底 + 「僅內部」標籤） |
| 1G | `feat/cs-activity-feed` | ConversationActivities 在 thread UI 顯示 audit timeline |

Phase 2（LINE OA）、3（Email）、4（FB/IG）、5（流程規則）、6（AI）、7（KB）、8（數據）、9（self-serve）、10（hardening）的子 prompt 之後分別寫到 `26B-cs-line-oa.md` ~ `26J-cs-hardening.md`。
