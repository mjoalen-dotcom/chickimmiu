# 交接：Shopline Parity 全面補完（2026-06-08）

> 給接手的新對話：先讀這份 + `docs/SHOPLINE_PARITY_ROADMAP.md`（執行清單/卡關清單）+ 記憶 topic `project_sysfeather_parity_phase2`。
> 開工前務必 `git log --oneline -10` 確認最新狀態（user 多 session 並行）。

## 0. 目標（user 設定，沿用）
> 讓網站功能 ≥ Shopline（Shopline 有的要有）+ 加上我們自建的；把未完成的開發補完；卡住的（缺外部憑證）整理出來之後處理。

## 1. 目前狀態（branch / 部署）
- **工作分支**：`feat/shopline-parity`（從 `hetzner/main` 開）。目前 HEAD = `96cb172`，**== hetzner/main == 已部署 prod**。
- **canonical git = hetzner**（GitHub 帳號停權中，**絕不 push origin**）。bare repo `ssh://root@5.223.85.14/srv/git/chickimmiu.git`。
- **prod**：`5.223.85.14`，`/var/www/chickimmiu`，pm2 `chickimmiu-nextjs`，SQLite `data/chickimmiu.db`，站台 `https://pre.chickimmiu.com`。
- 本機另有其他 session 的未提交改動，已 `git stash`（park-parallel-*）；prod 也有數個 stash（pre-*-deploy / 別 session 的 4 檔）——**不是我們的，別亂 pop**。

## 2. 本輪已完成並上線（7 commits，620af6b..96cb172）
1. `6565588` 推薦引擎接真實商品（`lib/recommendation/serverRecommend.ts` + `/api/recommendations`；5 元件改 fetch）+ totalSold 付款自動累加
2. `8247d35` **進銷存模組**：`InventoryTransactions`/`PurchaseOrders`(收貨自動入庫)/`StockTakes`(盤點校正) + `lib/inventory/server.ts` + Orders 寫 sale_out。migration `20260608_114946`（手寫冪等）
3. `ddd72e1` Affiliates 佣金付款自動累加（Orders paid hook → totalEarnings/pendingAmount）
4. `f3b83c7` 推薦首購獎勵（Orders paid hook，首單 → 推薦人+被推薦人購物金，寫錢包帳本）
5. `ba2f907` 生日 + 卡牌房間過期 cron 端點（`/api/cron/birthday`、`/api/cron/expire-card-battles`）
6. `e595741`/`96cb172` roadmap 文件回填

## 3. 🔴 最關鍵搶救：全站 cron 已復活
- 發現 GitHub Actions 停權 → **所有排程任務死了數週**（automations/segments/expire-points/streak-decay/生日/卡牌）。
- 已裝 **prod crontab fallback**：`/root/run-ckmu-crons.sh <job>`（從 .env 讀 CRON_SECRET、curl 端點、log `/var/log/ckmu-cron.log`）+ 6 條 `# [ckmu-outage-cron]` crontab。實測 `*/10` 已自動觸發。
- **⚠️ GitHub 帳號恢復後**：`crontab -l | grep -v '[ckmu-outage-cron]' | crontab -` 刪掉避免雙跑。

## 4. 部署 SOP（停權期，已驗證可用）
```bash
# 本機（在 feat/shopline-parity，已 commit）：
git fetch hetzner --quiet
git push hetzner feat/shopline-parity:main          # ff hetzner/main（分支須 descend 自 hetzner/main）
# prod：
ssh root@5.223.85.14 'cd /var/www/chickimmiu && \
  DIRTY=$(git diff --name-only HEAD); [ -n "$DIRTY" ] && git stash push -m pre-deploy -- $DIRTY; \
  git fetch hetzner-local --quiet && git merge --ff-only hetzner-local/main && \
  SKIP_GIT_RESET=1 NODE_OPTIONS=--max-old-space-size=2048 /root/deploy-ckmu.sh'
```
- **絕不**用沒帶 `SKIP_GIT_RESET=1` 的 `/root/deploy-ckmu.sh`（會 `git reset --hard origin/main` 殺掉一切）。
- **⚠️ 有新 migration 時**：deploy 內的 auto-migrate 會被 prod「dev-mode dirty schema (y/N)」prompt 擋住、**靜默跳過**（deploy 仍 OK 但表沒建）。deploy 後**務必手動**：
  ```bash
  ssh root@5.223.85.14 "cd /var/www/chickimmiu && yes y | pnpm payload migrate"
  # 再 migrate:status 確認全 Yes
  ```

## 5. 開發/驗證注意（踩過的雷）
- **本機 dev DB（`data/chickimmiu.db`）schema drift 嚴重**：push 建的、缺 users/products 多欄與子表 → 任何 Payload 讀 users/products（register/login/PDP）都炸。**驗證走乾淨 temp DB**：
  ```bash
  rm -f data/_x.db*; DATABASE_URI=file:./data/_x.db NODE_OPTIONS=--no-deprecation yes y | DATABASE_URI=file:./data/_x.db NODE_OPTIONS=--no-deprecation pnpm exec payload migrate
  DATABASE_URI=file:./data/_x.db NODE_OPTIONS=--no-deprecation pnpm exec payload run scripts/<verify>.ts   # 建 user 要 disableVerificationEmail:true 否則 Resend 403
  ```
- **migration 一律手寫冪等**（tableExists/columnExists guards，學 `20260604`/`20260608`）。**別用 `payload migrate:create`**：repo 用手寫 migration、Payload snapshot baseline 失準，會產出「重建整個 schema」的錯誤 migration（只能拿它算的單表 SQL 來手抄）。
- `cross-env` 不在 bash PATH → 直接 inline `NODE_OPTIONS=--no-deprecation`。
- tsc 偶報 `.next/types/validator.ts` 找不到 graphql route（prod 已移除）= stale 快取，`rm -rf .next/types` 再 tsc。
- 加 admin component 要 `pnpm payload generate:importmap`（本輪沒加 admin component）。
- **audit `docs/FEATURE_AUDIT_2026-06-03.md` 已部分過時**（平行 session 補了：festival-templates collection / 點數兌換 redeem / CSP fb 都已做）。施工前先 grep 確認別重做。

## 6. 卡關清單（等 user 處理）
- 🔴 **ECPay 線上金流（P0 最重要）**：需 MerchantID/HashKey/HashIV（測試 stage 即可）。沒接通 = checkout 只建單跳成功頁，不收錢。`checkout/page.tsx:704`。
- LINE 推播 channel token；SMS/OTP 供應商帳號。
- 原則：缺憑證的寫 env-gated（缺值 no-op），別擋現有流程（學 Meta CAPI token pattern）。

## 7. 建議下一步優先序
1. **ECPay 金流閉環**（拿到測試憑證後）— checkout → 綠界 AioCheckOut redirect + `/api/payment/ecpay/return`(前景) + `/api/payment/ecpay/notify`(webhook) → paid → 自動觸發既有發票/點數/升等 hook。發票欄位帶入（Orders schema 補 invoiceType/carrier/loveCode/buyerUBN）。
2. 無依賴中小項：Coupon 疊加/互斥、blog 分類獨立 collection、Podcast RSS feed、註冊推薦獎勵（需 email 驗證 gating + 一個 rewarded flag 欄+migration）、社交遊戲房間結算 `settleStyleRoom`（函式還沒寫）。
3. 大模組（需 user 拍板，別在 live 站自動 auto-pilot）：AI 客服真 LLM(Groq)+前台 web chat（會直接對客人講話，要先審 guardrails）、i18n 前台全面套用、POS 門市、直播購物。

## 8. 快速接手指令
```bash
cd /c/Users/mjoal/ally-site/chickimmiu   # 或 C:\Users\mjoal\ally-site\chickimmiu
git status && git log --oneline -8
git branch --show-current                 # 應為 feat/shopline-parity
# 讀 docs/SHOPLINE_PARITY_ROADMAP.md 的「剩餘未做」往下做
```
