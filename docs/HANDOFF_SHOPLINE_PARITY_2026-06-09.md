# 交接：Shopline Parity 第二輪（2026-06-09）

> 接手先讀：本份 + `docs/SHOPLINE_PARITY_ROADMAP.md`（含「★★ 第二輪」進度）+ 記憶 topic `project_sysfeather_parity_phase2`。
> **部署 SOP / cron fallback 機制 / dev DB drift 注意事項皆未變 → 見 `docs/HANDOFF_SHOPLINE_PARITY_2026-06-08.md` 第 3-5 節**（仍 100% 適用，不重複）。
> 開工前 `git log --oneline -10`（user 多 session 並行）。

## 1. 目前狀態
- 分支 `feat/shopline-parity`，**HEAD = `8c75632` == hetzner/main == 已部署 prod**（pm2 `chickimmiu-nextjs` online）。
- canonical git = **hetzner**（GitHub 帳號停權中，絕不 push origin）。
- prod `5.223.85.14:/var/www/chickimmiu`，SQLite `data/chickimmiu.db`，站台 `https://pre.chickimmiu.com`。

## 2. 本輪完成（8 commits 89b142d..8c75632，3 次部署）
「無外部依賴」清單**全清空**。每批乾淨 temp DB 驗證（scripts/verify_batch*.ts），結帳另做 preview 瀏覽器實測。
1. **5 個缺漏 cron**（settleStyleRoom/expireOpenWishes/leaderboard top3/星座預熱/商品限時上下架）— 25/25。已註冊 prod crontab。
2. **推薦註冊獎勵** — 14/14。既有會員 grandfather 不回溯。
3. **CRM 旅程執行器**（add/remove_tag/assign_coupon/condition_check/持久化 wait）— 15/15。
4. **Podcast RSS+JSON-LD（12/12）+ Blog 分類 collection + 修分類過濾 bug（8/8）**。
5. **Coupon 疊加/互斥**（多券結帳 + per-coupon 兌換）— 11/11 + 瀏覽器實測全過。
> 6 個新 migration（皆冪等 PRAGMA）已在 prod 手動 migrate 完成、columns 實查確認。

## 3. 🔴 卡關（等 user 給憑證才能接，程式多已 env-gated）
- **ECPay 線上金流（P0 最重要）**：缺 MerchantID/HashKey/HashIV（測試 stage 即可）。沒接 = checkout 只建單跳成功頁不收錢。拿到憑證後優先做（見 06-08 handoff 第 7 節閉環設計）。
- **LINE 推播 channel token**：automationEngine `send_line` 仍 stub。
- **SMS 供應商帳號**：`send_sms` 仍 stub + 會員手機 OTP。
- **Google Ads dev token**：審核中（見 memory）。

## 4. 🏗️ 未動（需 user 拍板，別在 live 站自動 auto-pilot）
- **AI 客服真 LLM(Groq) + 前台 web chat**：會直接對客人講話，要先審 guardrails。
- **i18n 前台全面套用**：字典已有，前台 hardcoded 中文；URL prefix + hreflang。
- **POS 門市 / 直播購物**：需實體店 / 商業決策。

## 5. ⚠️ 待辦小事
- **GitHub Actions 恢復後**刪 prod crontab 11 條 `[ckmu-outage-cron]` 避免雙跑：`ssh root@5.223.85.14 "crontab -l | grep -v '\[ckmu-outage-cron\]' | crontab -"`（同時可刪 `/root/run-ckmu-crons.sh`）。並確認 GitHub repo secret `CRON_SECRET` = prod `.env` 值。
- **Podcast 上架前**：在 GlobalSettings 放一張 ≥1400×1400 方形圖到 ogImage（目前 feed 封面 fallback ogImage/logo 可能 < 1400，Apple 會退件）。
- **importMap.js**：本機有別 session 未提交的 `BulkDeleteProductsView` admin component（我 generate:types 時被帶進 importMap diff，未 commit）；那 session 自理。
- **excludeSaleItems**（coupon 特價商品不適用）：欄位未加，需 checkout 傳每品項特價旗標才有意義，留後續。

## 6. 快速接手
```bash
cd /c/Users/mjoal/ally-site/chickimmiu
git log --oneline -10 && git branch --show-current   # feat/shopline-parity @ 8c75632
# 驗證單一 batch（乾淨 temp DB）：
rm -f data/_v.db*; yes y | DATABASE_URI=file:./data/_v.db NODE_OPTIONS=--no-deprecation pnpm exec payload migrate
DATABASE_URI=file:./data/_v.db NODE_OPTIONS=--no-deprecation pnpm exec payload run scripts/verify_batch1.ts
```
