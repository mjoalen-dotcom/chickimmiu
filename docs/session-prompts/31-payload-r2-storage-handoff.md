# PR-31: Payload Media → Cloudflare R2 cloudStorage adapter

**Created**: 2026-05-10
**Trigger**: 5/8 Shopline 商品圖匯入把 `/public/media` 灌成 21G → 2026-05-10 prod 磁碟 100% 滿。砍備份+改 backup script v2 救火，但根本問題（active media 在本機）未解。
**Status**: Plan confirmed, ready to implement in fresh session
**Branch suggestion**: `feat/payload-r2-storage`
**Estimated effort**: ~2 hours (5 phases)

---

## Context (狀況背景)

### 今日已完成 (2026-05-10)
- ✅ 磁碟救火：75/75 (100%) → 30/75 (42%)
- ✅ Backup script v2 上線 (`/root/backup-chickimmiu.sh`)：media 改 `tar -czf - | rclone rcat` 直送 R2，本機不落地。30 day DB retention + 14 day media R2 retention
- ✅ 5/10 完整快照在 R2: `chickimmiu-20260510-053357.db.gz` (8.8M) + `media-20260510-053357.tar.gz` (22.16G)
- ✅ Memory 更新 (`project_prod_hetzner_deployment.md` 含 v2 backup details)
- ✅ Codex 自動化「商品搬移」暫停（避免再爆磁碟）

### 未解的根本問題
- 🔴 `/var/www/chickimmiu/public/media/` 本機仍佔 21G (16,480 個檔案，多為 `shopline-<id>.png/gif`)
- 🔴 Payload Media collection 寫入路徑仍是 `public/media/`，每次新上傳吃本機磁碟

---

## 已確認決策 (Q&A from 2026-05-10)

| Q | A |
|---|---|
| Q1 Bucket | 新 bucket `chickimmiu-media`（與 `chickimmiu-backups` 分開） |
| Q2 Custom domain | `media.chickimmiu.com`（含 DNS + Cloudflare R2 connection） |
| Q3 Variants | rclone copy `/media` wholesale；現在也沒 variants 在用，不會壞 |
| Q4 Env naming | `R2_MEDIA_*` (`_BUCKET`, `_ENDPOINT`, `_ACCESS_KEY`, `_SECRET_KEY`, `_PUBLIC_URL`) |
| Q5 PR 風格 | 一個 PR 包到底（不拆 dev/prod） |

---

## 關鍵 codebase 偵察結果 (2026-05-10 完成，不用再 explore)

### Media collection
- **檔案**: `src/collections/Media.ts:28-209`
- **Static dir**: `path.resolve(dirname, '../../public/media')` (line 125)
- **Image sizes**: 4 變體 — thumbnail (400×400)、card (768×1024)、tablet (1024w)、desktop (1920w) (lines 139-162)
- **MIME**: jpeg/png/webp/gif/mp4/m4a/mp3/pdf
- **Size limits**: image 8MB、video 50MB、audio 50MB、pdf 10MB (lines 93-96)
- **Hooks**: beforeValidate (auto alt)、beforeChange (MIME + size + path traversal validation)、afterChange/afterDelete (revalidateMedia)
- **Access**: read 公開、create/update 須登入、delete 限 admin

### payload.config.ts
- **檔案**: `src/payload.config.ts:170-402`
- **無** cloudStorage / storage-s3 plugin（要新加）
- Sharp 已配置 (line 400)
- Media 在 collections array (line 336)
- serverURL 用 `NEXT_PUBLIC_SERVER_URL` env

### Frontend URL helper（**關鍵**）
- **檔案**: `src/lib/media-url.ts`
- 函式 `getMediaUrl()` 會把 `/api/media/file/*` rewrite 為 `/media/*`（避 Cloudflare Tunnel binary response 問題）
- ⚠️ **Migration 後必改**：加 same-origin 判斷，否則 R2 URL 會被誤 rewrite 成 `/media/*`

### 18 collections 引用 Media
Products / BlogPosts / UGCPosts / Users (avatar) / ProductReviews / Returns / Pages / Categories / Bundles / FestivalTemplates / MembershipTiers / MessageTemplates / ConciergeServiceRequests / StyleSubmissions / StyleWishes / Podcasts / PointsRedemptions / Messages

### CSP 已就緒
- `next.config.mjs` line 55 `img-src` 已 allow `https://*.r2.cloudflarestorage.com`
- 用 custom domain `media.chickimmiu.com` 要再加進 CSP（Phase 2 動）

### 依賴
- ❌ `@payloadcms/storage-s3` 未裝（Phase 2 加）
- ❌ `@aws-sdk/client-s3` 未裝（會被 storage-s3 帶進來）
- ✅ `sharp` v0.33.5 已裝
- ✅ `payload` v3.83.0

---

## Plan: 5 Phases

### Phase 1: R2 setup (30 min, no code)

1. **Cloudflare Dashboard → R2 → 建 bucket** `chickimmiu-media`
2. **設 CORS** (Bucket Settings → CORS Policy)：
   ```json
   [
     {
       "AllowedOrigins": ["https://pre.chickimmiu.com", "http://localhost:3000"],
       "AllowedMethods": ["GET", "PUT", "POST", "DELETE", "HEAD"],
       "AllowedHeaders": ["*"],
       "ExposeHeaders": ["ETag"],
       "MaxAgeSeconds": 3600
     }
   ]
   ```
3. **接 custom domain `media.chickimmiu.com`**：
   - R2 bucket → Settings → Custom Domains → Connect Domain → 輸入 `media.chickimmiu.com`
   - Cloudflare DNS 自動加 CNAME（chickimmiu.com 必須在同一個 Cloudflare account）
   - 等 SSL provision (~5 min)
4. **建 R2 API token** (R2 → Manage R2 API Tokens)：
   - Permissions: Object Read & Write
   - 限 bucket: `chickimmiu-media`
   - TTL: 永不過期 (或 1 year + 設提醒)
   - 記下 Access Key ID + Secret Access Key
5. **本機測 rclone**（驗證）：
   ```bash
   rclone config   # 加 remote 名 r2-media，access_key_id/secret/endpoint 填上
   rclone ls r2-media:chickimmiu-media   # 應回空（空 bucket）
   echo "test" | rclone rcat r2-media:chickimmiu-media/test.txt
   curl https://media.chickimmiu.com/test.txt   # 應回 "test"
   rclone delete r2-media:chickimmiu-media/test.txt
   ```

### Phase 2: 安裝 + Config (30 min, code)

1. `pnpm add @payloadcms/storage-s3`
2. `src/payload.config.ts` 加 plugin：
   ```typescript
   import { s3Storage } from '@payloadcms/storage-s3'

   // 在 buildConfig 內 plugins array
   plugins: [
     // ...existing plugins,
     s3Storage({
       collections: { media: true },
       bucket: process.env.R2_MEDIA_BUCKET!,
       config: {
         endpoint: process.env.R2_MEDIA_ENDPOINT!,
         credentials: {
           accessKeyId: process.env.R2_MEDIA_ACCESS_KEY!,
           secretAccessKey: process.env.R2_MEDIA_SECRET_KEY!,
         },
         region: 'auto',
       },
     }),
   ]
   ```
3. **`.env`** (local + prod) 加：
   ```bash
   R2_MEDIA_BUCKET=chickimmiu-media
   R2_MEDIA_ENDPOINT=https://<account-id>.r2.cloudflarestorage.com
   R2_MEDIA_ACCESS_KEY=...
   R2_MEDIA_SECRET_KEY=...
   R2_MEDIA_PUBLIC_URL=https://media.chickimmiu.com
   ```
4. **改 `src/collections/Media.ts`**：
   - cloudStorage adapter 文件確認後決定是否移除 `staticDir` (通常保留作為 dev fallback)
   - 加 `disablePayloadAccessControl: true` 在 cloud storage config 內，讓 R2 URL 公開可讀（避免每張圖過 Payload access check）
5. **改 `src/lib/media-url.ts`**：
   ```typescript
   export function getMediaUrl(media: { url?: string | null }): string {
     const url = media?.url ?? ''
     if (!url) return ''
     // R2 URL 已是絕對路徑，直接回
     if (url.startsWith('http')) return url
     // local /api/media/file/ rewrite 邏輯保留給 dev / fallback
     return url.replace('/api/media/file/', '/media/')
   }
   ```
6. **改 `next.config.mjs`** CSP `img-src`：加 `https://media.chickimmiu.com`
7. **Local dev 測**：
   - `pnpm dev`
   - 進 admin 上傳一張測試圖
   - 看 R2 dashboard 有沒有出現該檔
   - 看前台商品/blog/avatar render 是否正常
   - 看 admin 縮圖能否顯示

### Phase 3: Sync 現有 16k 檔到 R2 (20 min, prod)

1. SSH prod，rclone batch copy：
   ```bash
   ssh root@5.223.85.14
   # 確認 r2-media remote 已配置
   rclone listremotes
   # 跑 batch copy（用 --progress 看實時進度）
   rclone copy /var/www/chickimmiu/public/media r2-media:chickimmiu-media \
     --transfers 8 --progress --checksum
   ```
2. 驗證 count：
   ```bash
   ls /var/www/chickimmiu/public/media | wc -l   # 應 16,480
   rclone ls r2-media:chickimmiu-media | wc -l    # 應一致
   ```
3. 抽樣 curl：
   ```bash
   # 隨便挑一張
   sample=$(ls /var/www/chickimmiu/public/media | head -5 | tail -1)
   curl -I "https://media.chickimmiu.com/$sample"   # 應 200 OK
   ```

### Phase 4: Cutover (30 min, prod)

1. **(可選) maintenance mode**：擋 admin 上傳 5 min（避免 race condition）
2. **prod deploy**：
   ```bash
   ssh root@5.223.85.14
   cd /var/www/chickimmiu
   git pull
   pnpm install --frozen-lockfile
   NODE_OPTIONS=--max-old-space-size=2048 pnpm build
   # .env 已先填 R2_MEDIA_*
   pm2 restart chickimmiu-nextjs --update-env
   ```
3. **DB 不需要 migration script**：Payload S3 adapter 在 read 時動態組 url；DB 紀錄的 filename 不變。
   - **但建議 dry-run 確認**：寫 `scripts/checkMediaUrls.ts` 跑 read-only，看有沒有 Media doc 的 `url` 欄位 hardcode 成 `/api/media/file/` 或 `/media/` 字串需要 patch
4. **抽樣驗證 5 個關鍵頁**：
   - `/products` 商品列表（首屏看商品圖）
   - `/products/<sample-slug>` PDP gallery
   - `/account` avatar
   - `/admin/collections/products` admin 縮圖
   - `/blog`（如果有 blog post）+ blog post 內文圖
5. **觀察**：
   - `pm2 logs chickimmiu-nextjs --lines 100`
   - 開 prod browser DevTools Network 看 `media.chickimmiu.com` 回應
   - 5-10 min 沒新 error 才放心

### Phase 5: Cleanup (24h 後)

1. 確認 24h 沒有 image broken issue（自己掛幾頁、查 sentry / pm2 logs）
2. **預備 rollback path**：先 mv 不刪
   ```bash
   mv /var/www/chickimmiu/public/media /var/www/chickimmiu/public/media.old
   df -h   # 應該降到 ~10G
   ```
3. **觀察 24h**：自己再走幾頁、確認沒有意外 fallback 路徑
4. **真砍**：
   ```bash
   rm -rf /var/www/chickimmiu/public/media.old
   df -h   # ~10G/75G (13%)
   ```

---

## 風險清單

| 風險 | 可能性 | 影響 | Mitigation |
|---|---|---|---|
| 前端某處硬寫 `/media/<path>` 而非走 `getMediaUrl()` | 中 | 部分商品圖 broken | Phase 4 抽樣驗證 5+ 頁面，grep `/media/` 找硬寫 |
| `getMediaUrl()` rewrite 把 R2 URL 也 rewrite 成 `/media/*` | 高 | 全站圖 broken | Phase 2 改 helper：only rewrite same-origin |
| R2 CORS 沒設好 → admin 上傳 fail | 中 | admin 無法上傳新圖 | Phase 1 設 CORS、Phase 2 dev 測 |
| Custom domain SSL/DNS 沒就緒 | 低 | 圖 fail to load | Phase 1 完整 curl 測後再進 Phase 2 |
| Payload S3 adapter 變體生成 race condition | 低 | 偶發 variant 缺失 | 不擋路，後續另案 |
| sync 中斷 → R2 部分缺檔 | 低 | 少數圖 404 | rclone copy 可重複跑（idempotent） |

---

## Open prompt (paste into fresh session)

```
這是 PR-31 Payload Media → R2 cloudStorage adapter 工作。
讀 docs/session-prompts/31-payload-r2-storage-handoff.md 了解完整 plan + 已確認決策（Q1-Q5）。
從 Phase 1 開始：先教我 Cloudflare R2 bucket 建立 + custom domain 設定流程，
我邊做你邊指導。R2 setup 都好之後再進 Phase 2 寫 code。
```

---

## 後續 (PR-31 完成後另案)

1. **Codex 自動化「商品搬移」重啟前要改造**：
   - 圖直接寫 R2（不走本機 → Payload 流程）
   - 用 SKU/product ID 匹配，不要 name match
   - 加 idempotency
   - 分類 mapping table 明確
2. **R2 access key rotation**（4/18 開始 pending：`74d908356510dce1fbdad700dc2e32df` 在 conversation log 曝過）
3. **商品圖匯入加壓縮**（webp 80%，可省 50-70% 儲存）
