# 06 — GitHub Secrets + Prod Env Setup for Cron Runner

所有 `/api/cron/*` endpoint 由 `.github/workflows/cron.yml` 每 10 分鐘 / 每日觸發。
需要在 GitHub repo 與 prod server 雙邊設定相同的 `CRON_SECRET`。

## 1. 生成 secret（本機）

```bash
openssl rand -base64 24
# 輸出類似：Kj2l+PqR9...（不要貼文件裡）
```

## 2. GitHub repo secrets

1. Repo → **Settings** → **Secrets and variables** → **Actions** → **New repository secret**
2. Name: `CRON_SECRET`
3. Secret: 貼上第 1 步生成的字串
4. Save

## 3. Prod server (`/var/www/chickimmiu/.env`)

```bash
ssh root@pre.chickimmiu.com
cd /var/www/chickimmiu
# 編輯 .env，加入：
echo 'CRON_SECRET=<paste the same value>' >> .env
pm2 restart chickimmiu-nextjs
```

值必須與 GitHub secret 完全一致，否則 endpoint 會回 401。

## 4. 手動觸發驗證

GitHub → **Actions** → **Scheduled Cron** → 右上 **Run workflow** → 選 branch `main`。
三個 job 應該全部 green。每個 job 的 curl 應該回傳 `{ ok: true, ... }`。

若回 401：表示 GitHub secret 或 prod .env 沒設對。
若回 503 `cron_secret_not_configured`：prod .env 根本沒有 `CRON_SECRET`。

## 5. 排程時區速查

GitHub cron 使用 UTC；TPE = UTC+8。

| Schedule      | UTC          | TPE          | Jobs              |
| ------------- | ------------ | ------------ | ----------------- |
| `*/10 * * * *` | 每 10 分鐘    | 每 10 分鐘    | automations + segments |
| `0 3 * * *`   | 03:00 daily  | 11:00 daily  | expire-points     |
| `0 16 * * *`  | 16:00 daily  | 00:00 daily  | streak-decay      |

## 6. 排查（若 workflow 顯示失敗）

1. 在 GitHub Actions 檢視失敗的 job log — `curl -fsS` 失敗會印出 HTTP status。
2. 401 → 檢查 GitHub secret vs prod `.env` 值是否一致。
3. 500 → SSH prod 看 `pm2 logs chickimmiu-nextjs --lines 100`，找 `[cron/...]` 錯誤行。
4. Timeout → 該 endpoint 超過 `--max-time` 秒數。`segments` + `expire-points` 給 300 秒，如果還超表示 DB 太慢或 user 數暴增。

## 7. 停用某個 cron job

需要暫停 automations 但 segments 照跑：改 `.github/workflows/cron.yml`，把對應 `curl` step 前面加 `if: false` 或整個 step 刪掉，commit + push。GitHub Actions 下一輪自動生效。
