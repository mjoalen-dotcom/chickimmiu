# 01 — Runbook: 修復 prod 圖片 404 + 輪換硬編密碼

## 背景

Prod (`pre.chickimmiu.com`) 所有 `/media/*.webp` 回 404。根因：`public/media/` 在 `.gitignore`，從未進 prod。
同時，舊 `PAYLOAD_SECRET` + admin 密碼硬編在 seed 檔內、已 push 到公開 repo，需輪換。

PR：[`fix/prod-media-secrets`](https://github.com/mjoalen-dotcom/chickimmiu/pull/new/fix/prod-media-secrets)

## 順序總覽

1. Review + merge PR `fix/prod-media-secrets` → main
2. 到 Cloudflare dashboard 撤銷舊 R2 token、建新 token（不必現在填，script 會暫停讓你輸入）
3. 編輯 `docs/session-prompts/01-deploy-steps.sh` 把 `PROD_HOST="root@<HETZNER_IP>"` 換成真實 IP
4. `chmod +x docs/session-prompts/01-deploy-steps.sh && ./docs/session-prompts/01-deploy-steps.sh`
5. 驗證
6. （選配）重設 admin 密碼到自己記得的新值

---

## Step 1 — Merge PR

```
gh pr create --title "security: rotate hardcoded secrets + env-ify seed passwords" ...
```

（此 repo 未裝 gh CLI — 從 GitHub 網頁 URL 手動建 PR + merge）

PR 網址會在 `git push` 輸出顯示：
`https://github.com/mjoalen-dotcom/chickimmiu/pull/new/fix/prod-media-secrets`

---

## Step 2 — Cloudflare R2 token 輪換

1. 登入 https://dash.cloudflare.com/
2. Workers & Pages → R2 → **Manage API tokens**
3. 找到含 access key id `74d908356510dce1fbdad700dc2e32df` 的 token → **Revoke**
4. **Create API token**
   - Permissions: `Object Read & Write`
   - Specify bucket: `chickimmiu-media`（或你實際 bucket 名）
   - TTL: 視政策決定；建議 1 年
5. 複製下來：
   - `Access Key ID`
   - `Secret Access Key`
6. 先不必立刻寫進 prod — script 跑到 Step 3c 會停下來讓你貼

> 若你目前沒在執行 offsite backup cronjob，可以先 skip 這步，等 backup 設定時再做。

---

## Step 3 — 跑 deploy script

### 3.1 編輯變數

打開 `docs/session-prompts/01-deploy-steps.sh`：

```
PROD_HOST="root@<HETZNER_IP>"       # 換成真實 IP，例如 root@1.2.3.4
PROD_PATH="/var/www/chickimmiu"     # 若路徑不同請改
LOCAL_REPO="/c/Users/mjoal/ally-site/chickimmiu"   # Git Bash 風格路徑
```

### 3.2 執行

```
cd /c/Users/mjoal/ally-site/chickimmiu
chmod +x docs/session-prompts/01-deploy-steps.sh
./docs/session-prompts/01-deploy-steps.sh
```

腳本會做：

1. 本機 tar `public/media/`（~472 MB、497 張圖）
2. scp 上傳到 prod `/var/www/chickimmiu/ckmu-media.tgz`
3. ssh 進 prod：
   - 解壓 → `chown www-data`
   - 產生新 `PAYLOAD_SECRET`（`openssl rand -base64 48`）寫進 `.env`，備份舊 `.env`
   - **停下來**等你在 Cloudflare 建完新 R2 token、手動編輯 `.env` 填 `R2_ACCESS_KEY_ID` + `R2_SECRET_ACCESS_KEY`
   - `git pull origin main`（確認含本次 security commit `8b124f0`）
   - `pnpm install --frozen-lockfile && pnpm build && pm2 restart chickimmiu-nextjs`
   - smoke test: `curl http://localhost:3000/` + `curl http://localhost:3000/media/hero-1.webp`

### 3.3 如果在 R2 暫停那步想放棄

Ctrl+C → 當下 media 已解壓 + PAYLOAD_SECRET 已輪換，但還沒重 build。可手動在 prod 跑：

```
cd /var/www/chickimmiu
pnpm install --frozen-lockfile
pnpm build
pm2 restart chickimmiu-nextjs
```

R2 輪換另找時間做，別忘了。

---

## Step 4 — 驗證

### 4.1 從本機

```
curl -sI https://pre.chickimmiu.com/media/hero-1.webp   # 應 200 + Content-Type: image/webp
curl -sI https://pre.chickimmiu.com/ | head -3           # 應 200
```

### 4.2 瀏覽器

- https://pre.chickimmiu.com/ — hero 圖必須出現（清 cache Ctrl+Shift+R）
- https://pre.chickimmiu.com/products — 商品列表圖必須出現
- 用管理者帳號登入 https://pre.chickimmiu.com/admin — 舊 session 會失效，需用 admin@chickimmiu.com + 新密碼（見 Step 5）重新登入一次

---

## Step 5 — 重設 admin 密碼（選配）

Security fix 後 `queryAdmin.ts` + `resetAdmin.ts` 會 throw 除非 `ADMIN_RESET_PASSWORD` 有值。

在 prod（或本機）跑：

```
cd /var/www/chickimmiu
ADMIN_RESET_PASSWORD='<pick-a-strong-one>' pnpm tsx src/seed/resetAdmin.ts
```

建議：
- 至少 20 字元、隨機
- 用 password manager 記錄
- **不要**像舊版一樣放進 seed 檔或 commit

---

## Rollback

如果 build 失敗或站爆了：

```bash
ssh root@<HETZNER_IP> bash <<'ROLLBACK'
cd /var/www/chickimmiu

# 把 .env 還原
LATEST_BACKUP=$(ls -1 .env.backup-* | tail -1)
cp "${LATEST_BACKUP}" .env
echo "Restored: ${LATEST_BACKUP}"

# git checkout 上一個可跑 build
git log --oneline -5
# git reset --hard <previous-good-sha>   # 謹慎！只在確認的狀況下做

pnpm install --frozen-lockfile
pnpm build
pm2 restart chickimmiu-nextjs
ROLLBACK
```

> **注意**：rollback 到前一個 SHA 會退回到 `public/media/` 都在的狀態嗎？不會，因為 `/public/media` 在 `.gitignore`，revert commit 不影響解壓出來的檔。若 media 本身被誤刪才要再跑 Step 3 的 tar/scp 部分。

---

## 後續項目

- [ ] 把 `public/media/` 從 `.gitignore` 移掉嗎？**不建議** — 472 MB 進 git repo 會爆。改用 Git LFS 或 R2 作為正式 media host 才是長期解。
- [ ] 修 build-time 檢查：若 `public/media/` 為空、CI 給 warning
- [ ] 補 deploy pipeline：下次 deploy 自動把 media 同步（rsync / R2 pull）

---

## 驗收 checklist

- [ ] PR `fix/prod-media-secrets` 已 merge 進 main
- [ ] Cloudflare R2 舊 token 已 revoke、新 token 已建
- [ ] Prod `.env` 裡 `PAYLOAD_SECRET` 已換
- [ ] Prod `.env` 裡 `R2_ACCESS_KEY_ID` + `R2_SECRET_ACCESS_KEY` 已換
- [ ] `curl -sI https://pre.chickimmiu.com/media/hero-1.webp` 回 200
- [ ] 瀏覽器打開首頁 hero 圖可見
- [ ] Admin 用新密碼可登入
- [ ] `pm2 list` 顯示 `chickimmiu-nextjs` online
