# 01 — 🚨 EMERGENCY: 圖片 404 + 硬編密碼輪換

## 為什麼緊急
- Prod (`pre.chickimmiu.com`) 所有 `/media/*.webp` 回 404 → 首頁 hero、商品圖全部破圖。根因：`public/media/`（472MB，497 張圖）被 `.gitignore`，**從沒進 prod**。
- `PAYLOAD_SECRET` + admin 密碼硬編在 seed 註解裡、已 push 到 origin 公開 repo。需要輪換。
- **單人做，其他組開始前需等這組 merge 完**（改了 `.env.example`、seed 檔、可能改 payload.config）。

---

## ▼▼▼ 以下整段貼到新 session ▼▼▼

```
# 01 — 緊急修復圖片 404 + 輪換硬編密碼

## Context
- 專案：CHIC KIM & MIU 台灣女裝電商，Next.js 15.5.15 + Payload CMS v3 + SQLite
- 本機專案根：`C:\Users\mjoal\ally-site\chickimmiu`
- Prod：Hetzner CPX22 SIN at `pre.chickimmiu.com`，path `/var/www/chickimmiu`，跑 `pm2` 名稱 `chickimmiu-nextjs`，Next.js `standalone` build，SQLite at `data/chickimmiu.db`
- 本機 main 最新 commit 是 `ae3cd32`（2026-04-18），prod 跑的是 `fa1db25`

## Background — 已確認問題
1. **圖片 404**
   - `public/media/` 在 `.gitignore` 第 44-45 行 → 0 個檔 tracked（`git ls-files public/media/ | wc -l` = 0）
   - 本機 `du -sh public/media/` = 472 MB、497 檔
   - `curl https://pre.chickimmiu.com/media/hero-1.webp` → 404
   - `curl http://localhost:3001/media/hero-1.webp` → 200
2. **硬編秘密**
   - `src/seed/queryDB.ts:3` 註解：`PAYLOAD_SECRET=H2Ca1PcPtUMqKgAfJ0VEWbgN0hMMiX5g6SRniQdev01`
   - `src/seed/seedNecklaceImages.ts:3` 同上
   - `src/seed/resetAdmin.ts:31` 硬寫 `'CKMU2026!admin'`
   - R2 access key `74d908356510dce1fbdad700dc2e32df` 也在過去對話 log（需輪換）

## Your Task

### 第一階段 — code changes

1. **開 branch**
   ```
   git fetch origin
   git checkout main
   git pull --ff-only origin main
   git checkout -b fix/prod-media-secrets
   ```

2. **移除 seed 硬編密碼**
   - `src/seed/queryDB.ts`：把頂部註解的 `PAYLOAD_SECRET=H2Ca1PcPt...` 整行改成 `PAYLOAD_SECRET=<your-secret-from-env>`
   - `src/seed/seedNecklaceImages.ts`：同上
   - `src/seed/resetAdmin.ts:31`：`password: 'CKMU2026!admin'` → `password: process.env.ADMIN_RESET_PASSWORD ?? (() => { throw new Error('ADMIN_RESET_PASSWORD env required') })()`
   - 確認沒有其他 grep 漏：`grep -rn "H2Ca1PcPt\|CKMU2026!admin" --include="*.ts" --include="*.tsx" --include="*.md" .`

3. **`.env.example` 補註說明**
   - 讀 `.env.example`（若不存在建一個）
   - 加入 / 確保有：`PAYLOAD_SECRET=<generate with: openssl rand -base64 48>`、`ADMIN_RESET_PASSWORD=<set before running resetAdmin>`、`R2_ACCESS_KEY_ID=`、`R2_SECRET_ACCESS_KEY=`、`R2_BUCKET_NAME=`、`R2_ACCOUNT_ID=`、`R2_PUBLIC_URL=`

4. **tsc + build 驗證**
   ```
   pnpm tsc --noEmit
   pnpm build
   ```
   兩個都必須 0 error。若 build 需要 env，用 dummy 值：`PAYLOAD_SECRET=dummy DATABASE_URI=file:./data/chickimmiu.db pnpm build`。

5. **commit + push**
   ```
   git add src/seed/queryDB.ts src/seed/seedNecklaceImages.ts src/seed/resetAdmin.ts .env.example
   git commit -m "$(cat <<'EOF'
   security(seed): remove hardcoded PAYLOAD_SECRET + admin password

   Seeds had PAYLOAD_SECRET and admin password literal in comments/code,
   committed to public repo. Rotate and read from env.

   Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
   EOF
   )"
   git push -u origin fix/prod-media-secrets
   ```

### 第二階段 — prod 部署（人工 SSH 步驟）

這部分你**不能自動執行**（需 SSH 金鑰）。產出一份一行一行可複製的指令清單給使用者，檔案路徑：`docs/session-prompts/01-deploy-steps.sh`。內容：

```bash
#!/usr/bin/env bash
# EXECUTE ON USER'S LOCAL MACHINE, then SSH
set -euo pipefail

# --- FILL IN ---
PROD_HOST="root@<HETZNER_IP>"
PROD_PATH="/var/www/chickimmiu"

# 1) 本機打包 public/media (472MB)
cd C:/Users/mjoal/ally-site/chickimmiu
tar czf /tmp/ckmu-media.tgz public/media/

# 2) scp 到 prod
scp /tmp/ckmu-media.tgz "${PROD_HOST}:${PROD_PATH}/ckmu-media.tgz"

# 3) ssh 解壓 + 輪換 secrets + rebuild
ssh "${PROD_HOST}" bash <<'REMOTE'
set -euo pipefail
cd /var/www/chickimmiu

# 3a) 解圖
tar xzf ckmu-media.tgz
chown -R www-data:www-data public/media/
rm ckmu-media.tgz
ls public/media/ | wc -l   # 應 >= 497

# 3b) 輪換 PAYLOAD_SECRET
NEW_SECRET=$(openssl rand -base64 48 | tr -d '/+=' | cut -c1-48)
# 備份舊 .env，避免誤傷
cp .env .env.backup-$(date +%Y%m%d)
# 置換 PAYLOAD_SECRET 行
sed -i "s|^PAYLOAD_SECRET=.*|PAYLOAD_SECRET=${NEW_SECRET}|" .env
echo "New PAYLOAD_SECRET written"
echo "Note: All existing payload-token JWTs 會失效，使用者需重新登入一次。"

# 3c) 輪換 R2 keys（這步使用者先到 Cloudflare dashboard 撤銷舊 key + 建新 key）
echo ">>> 輪換 R2：前往 https://dash.cloudflare.com/?to=/:account/r2/api-tokens 刪除含 74d908356510... 的 token、建新 token、填回 .env R2_ACCESS_KEY_ID / R2_SECRET_ACCESS_KEY"
echo "完成後按 enter 繼續，若想先 skip，Ctrl+C"
read

# 3d) pull 新 code、rebuild、restart
git fetch origin
git checkout main  # 等這個 branch 被 merge 到 main 之後再做
git pull --ff-only origin main
pnpm install --frozen-lockfile
pnpm build
pm2 restart chickimmiu-nextjs
pm2 save

# 3e) smoke
sleep 3
curl -sI http://localhost:3000/ | head -1
curl -sI http://localhost:3000/media/hero-1.webp | head -1   # 應 200
REMOTE

echo "done — verify prod:"
echo "  curl -sI https://pre.chickimmiu.com/media/hero-1.webp"
echo "  open https://pre.chickimmiu.com/ and check hero image visible"
```

### 第三階段 — 產出 runbook 給使用者

寫 `docs/session-prompts/01-runbook.md` 含：
- 上方 bash 腳本要填的變數（HETZNER_IP）
- 輪換 R2 的 Cloudflare dashboard 步驟
- 新 admin 密碼怎麼設（`ADMIN_RESET_PASSWORD=xxx pnpm tsx src/seed/resetAdmin.ts`）
- 回滾步驟（pm2 restart with previous build, rename .env.backup-YYYYMMDD 回 .env）

commit 這些：
```
git add docs/session-prompts/01-deploy-steps.sh docs/session-prompts/01-runbook.md
git commit -m "docs(ops): runbook for prod media + secret rotation"
git push origin fix/prod-media-secrets
```

### 第四階段 — 等 merge + 告知使用者

- PR description 要寫明：「**merge 後使用者必須**跑 `docs/session-prompts/01-deploy-steps.sh` 才會修復圖片」
- 回報：完成後給使用者「複製這份 PR URL + 跑腳本順序」兩段文字

## Verification
- `pnpm tsc --noEmit` 0 err
- `pnpm build` 成功
- `grep -rn "H2Ca1PcPt\|CKMU2026!admin" --include="*.ts" --include="*.tsx" .` → 0 matches
- `docs/session-prompts/01-deploy-steps.sh` 可執行 (`chmod +x` 或 bash 能跑)
- branch pushed, PR 可從 GitHub 網頁手動建

## Guardrails
- **不要**真的 rsync / ssh prod（使用者要手動確認）
- **不要**把新 PAYLOAD_SECRET 寫進 repo
- **不要**用 `git push --force`
- **不要**碰以下檔案（留給其他組）：
  - `src/app/(frontend)/account/**`（組 02）
  - `src/collections/Orders.ts`、`src/stores/cartStore.ts`（組 03）
  - `src/app/(frontend)/{contact,size-guide,shipping}/`（組 04）
  - `src/lib/recommendationEngine.ts`（組 05）
  - `next.config.mjs` headers 區塊（組 07）
- **不要**自行跑 `pnpm tsx src/seed/resetAdmin.ts`（會動到本機 DB）
```

---
