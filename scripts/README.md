# scripts/

維運腳本。各檔案首註解寫設計理由 + 用法。

## 部署相關

- **`deploy-prod.sh`** — `pre.chickimmiu.com` (Hetzner) 的 deploy 流程：
  `git fetch + reset --hard origin/main → pnpm install → payload migrate →
  rm -rf .next/cache → pnpm build → pm2 restart → orphan-kill → 6 paths health check`。
  退出碼 0 = OK / 1 = health fail / 2 = build fail / 3 = migrate fail。

  ### Prod 設定
  生產主機 `5.223.85.14` 上 `/root/deploy-ckmu.sh` 是 symlink → `/var/www/chickimmiu/scripts/deploy-prod.sh`，
  所以 `git pull` 同時更新 deploy 流程本身。修 deploy 邏輯 = 改這個檔 → 開 PR → merge，下次 deploy 自動套用。

  ### 觸發方式
  ```bash
  ssh root@5.223.85.14 /root/deploy-ckmu.sh
  ssh root@5.223.85.14 /root/deploy-ckmu.sh --update-lockfile  # 當 lockfile 確實改了
  ```

  ### 災難復原（symlink 不見）
  ```bash
  ssh root@5.223.85.14 'ln -sf /var/www/chickimmiu/scripts/deploy-prod.sh /root/deploy-ckmu.sh'
  ```

## Smoke Test

- **`smoke-storefront.ts`** — 前台 storefront smoke，約 30 個 HTTP case（PLP / PDP / Category / Auth / 404）。

  ```bash
  pnpm smoke:storefront                              # 本機 dev server (port 3006)
  BASE_URL=https://pre.chickimmiu.com pnpm smoke:storefront  # prod
  FAIL_FAST=1 pnpm smoke:storefront                 # 第一個 fail 立刻退出
  ```

  回傳 exit code 0 = all pass / 1 = ≥1 fail / 2 = script crash。
  `/category/*` 路徑在 PR-ε 未 merge 時自動 skip（不算 fail）。

## 一次性 / 維護

- `apply-phase1-migration.mjs`、`backfill-payload-migrations.mjs`、`pack-image-downloader.mjs` — 一次性遷移工具
- `install-git-hooks.mjs` — 把 `.githooks/*` 連到 `.git/hooks/`
- `seed-blog.ts`、`seed-cms-data.ts`、`seed-products.ts` — 新環境/開發機 seed 資料
- `test-user-rewards-scenarios.ts` — 點數/獎勵 scenario test runner
