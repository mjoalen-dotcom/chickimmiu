# 31 — PR-E2：Audience Sync Engine + 手動觸發

**Status:** PR-E1 schema merged 後可開始
**Prereq:** PR-E1（AdAudiences collection）

---

## 0. PR-E2 目標

在 PR-E1 schema 基礎上，加入真正打 Meta Custom Audience API 的 sync engine，
讓 admin 可以在後台按「強制同步」按鈕，把 audience 定義推到 Meta Ads Manager。

---

## 1. 要做的事

### 1A — Sync Engine (`src/lib/ads/audienceSync.ts`)

核心函式 `syncAudience(audienceId: number)`:

1. 讀 `AdAudiences` doc（含 type / timeWindowDays / excludePurchasersDays / filterProducts）
2. 根據 type 組合查詢：
   - **viewers**: `ProductViewEvents` where `createdAt > now - timeWindowDays`，
     join `Users` 取 email，排除 `Orders.createdAt > now - excludePurchasersDays` 的人
   - **cart_abandoners**: 用 `Orders` 查 status='abandoned' / 'pending'
     在 timeWindowDays 內有加購但沒完成的 email，排除同期 Purchase
   - **purchasers**: `Orders` where status='completed' within timeWindowDays，取 email
   - **product_specific**: 同 viewers 但加 `product IN filterProducts`
3. Hash emails: `sha256(email.trim().toLowerCase())` — 複用 PR-C `sha256Lower()`
4. 過濾 `Users.marketingAccepted !== true` 的人（GDPR 合規）
5. 寫回 `estimatedSize` = unique user count

#### Meta API 呼叫

- **首次** (metaAudienceId 為空):
  ```
  POST /v25.0/act_441158936893428/customaudiences
  body: {
    name, description, subtype: 'CUSTOM',
    customer_file_source: 'USER_PROVIDED_ONLY',
  }
  ```
  回傳 `id` 寫入 `metaAudienceId`

- **加使用者**:
  ```
  POST /v25.0/{metaAudienceId}/users
  body: {
    payload: {
      schema: ["EMAIL_SHA256"],
      data: [["abc123..."], ["def456..."], ...]
    }
  }
  ```

- **移除使用者** (差異比對):
  記錄上次 sync 的 user set，這次不在的就 DELETE。
  MVP 可以先不做差異 — 每次全量 replace。

#### Token & Auth
- `process.env.META_CAPI_ACCESS_TOKEN`（已在 prod .env，scope 含 `ads_management`）
- fallback: `AdsCatalogSettings.meta.systemUserToken`（DB）

#### Error handling
- 非 fatal — try/catch，寫 syncError + syncStatus='error'
- 成功 → syncStatus='synced' + lastSyncAt=now + 清空 syncError

### 1B — Server Action / API endpoint

`src/app/(frontend)/api/ads/audiences/[id]/sync/route.ts`:
- POST, admin-only auth
- 呼叫 `syncAudience(id)`
- 回 JSON `{ success, audienceId?, estimatedSize?, error? }`

### 1C — Admin 「強制同步」按鈕

在 AdAudiences edit view sidebar 加一個 client component button:
- `src/components/admin/AudienceSyncButton.tsx` ('use client')
- 讀 doc id，POST 到 `/api/ads/audiences/{id}/sync`
- 顯示 loading spinner → 成功 toast → reload doc（看到 syncStatus 更新）
- 失敗 → 紅色 toast 顯示 syncError

在 `AdAudiences.ts` 的 sidebar 加 `admin.components.afterDocument`:
```ts
admin: {
  components: {
    edit: {
      // or afterDocument
    }
  }
}
```

---

## 2. 驗證 checklist

- [ ] 建 4 種 type 的 audience → 各按「強制同步」→ Meta Ads Manager 看到 4 個 audience
- [ ] audience 名稱 = admin 填的 name
- [ ] metaAudienceId 回寫 DB
- [ ] 再次同步 → 用 ADD users 不是重 CREATE
- [ ] 封測使用者少 (<100) → admin 警告 estimatedSize < 100
- [ ] marketingAccepted=false 的 user 被過濾
- [ ] Token 缺失 → 404 no-op 不炸（同 catalogBatchPusher 模式）

---

## 3. sha256Lower 位置

PR-C 已有：`src/lib/ads/pixelCapi.ts` → `sha256Lower()`
直接 import 或搬到 `src/lib/ads/utils.ts` 共用。

---

## 4. 風險

- **audience size < 100**: Meta 不投放，admin 要看到警告
- **rate limit**: custom audience API 1000 calls/hr，單次 sync 1-2 calls 不會觸頂
- **PII**: 只送 hashed email，不送明文
- **GDPR**: 過濾 marketingAccepted
