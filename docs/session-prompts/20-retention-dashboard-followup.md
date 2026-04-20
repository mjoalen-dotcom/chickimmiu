# Session 20 — PR #76 merge + deploy + 接續 90 天回購策略

> **上 session 一行總結**：行銷討論「二手服交易 → 封測 90 天回購」轉向，決議執行順序 **(a) cohort dashboard → (c) drip 文案 → (b) SMTP → (d) 手工觸及版**。完成 (a)，PR #76 開好待 merge + prod deploy。

## 目前 SHA
- Local / branch `claude/nifty-haslett-5dc736`：PR #76 HEAD
- Origin main：`2a30f5c`（session 19 wrap-up）
- PR URL: https://github.com/mjoalen-dotcom/chickimmiu/pull/76

## PR #76 帶了什麼

**新功能**：`/admin/repeat-purchase` 90 天回購 cohort 儀表板（admin-only）
- KPI 4 格：首購會員總數 + D30/D60/D90
- 週 cohort 表：firstBuyers / AOV / D30/60/90 eligible+rate / 迄今
- 尚未回購行動名單：4 段 tab（Delight 0-14 / Discovery 15-45 / Conversion 46-90 / Reactivation 90+）

**架構**（沿用 PR #61 MemberAnalytics 模式）：
- `src/endpoints/repeatPurchaseAnalytics.ts` — GET /api/users/repeat-purchase
- `src/components/admin/RepeatPurchaseView.tsx` — server wrapper + DefaultTemplate
- `src/components/admin/RepeatPurchaseClient.tsx` — 'use client' 客端互動
- `src/components/admin/RepeatPurchaseNavLink.tsx` — 左側導覽
- `src/collections/Users.ts` — +1 endpoint
- `src/payload.config.ts` — +1 view + +1 navlink
- `src/app/(payload)/admin/importMap.js` — +2 entry

**未引入新依賴**（inline SVG/CSS 繪製，保持 bundle 不膨脹）。

## 驗證狀態

- ✅ `pnpm exec tsc --noEmit`：0 error
- ✅ `pnpm build`：clean，所有 route 編譯通過
- ⏭ **Browser 實測未完成** — 在 worktree 啟 dev server 時 SQLite WAL lock + 自動 schema push 勾纏，不影響本 PR 功能（只影響我本地驗證）。下 session 直接在 prod 看就好。

## 下 session 接手 checklist

### Step 1 — merge + prod deploy（10 分鐘）
```bash
# 1. code review PR #76（4 檔新元件 + 3 檔 wiring + 1 檔 launch.json）
gh pr view 76 --web

# 2. merge
gh pr merge 76 --squash --delete-branch

# 3. prod deploy（走慣例 script；不需要 migration）
ssh root@5.223.85.14 /root/deploy-ckmu.sh

# 4. 驗證 prod：
curl -sI https://pre.chickimmiu.com/admin/repeat-purchase  # 預期 200 or 3xx redirect to login
curl -s https://pre.chickimmiu.com/api/users/repeat-purchase  # 預期 401 Unauthorized (admin-only)
```

### Step 2 — admin UI 實測（5 分鐘）
使用者登入 `/admin` → 左側看「🔁 90 天回購分析」→ 點進去驗：
- [ ] KPI 4 格顯示（封測初期 D30/60/90 預期顯示「封測初期尚未成熟」）
- [ ] 週 cohort 表有週次（2026-04-19–04-25 應該有；看封測首張 paid 訂單時間）
- [ ] 「尚未回購行動名單」預設 tab 是 Delight 0-14，能點其他 tab
- [ ] 點任一會員卡片 → 跳至 /admin/collections/users/{id}

### Step 3 — 行銷計畫下一步：選一個推
使用者先前選的順序：**(a) ✅ done → (c) 文案 → (b) SMTP → (d) 手工觸及版**

建議下 session 推 **(c) 90 天 drip 文案腳本**（純策略產出，不碰 code）：

產出物：`docs/marketing/90-day-retention-drip.md`，內容：
- Day 0：訂單確認信
- Day 3：收貨 + 保養/穿搭建議（LINE push，不寄 email）
- Day 7：邀入封測 LINE 群 + 封測元老徽章通知
- Day 14：尺寸/版型回饋問卷（收到回饋給 50 點）
- Day 21：第一張 UGC 請求（客戶穿搭照 → 官方 IG repost 授權）
- Day 30：新品 push 鎖第一次購買品類
- Day 45：Wishlist 補貨通知 + 「再加 $300 免運」
- Day 60：等級升級誘因（「再消費 $XXX 升 XX 等」）+ 點數到期提醒
- Day 75：第二次購買專屬券（PR #64 Coupons 建卷）
- Day 90：生日/星座月加碼（如命中）

每節點附文案草稿（繁中）+ 觸發條件 + A/B 建議。

## 行銷策略 context（供本 session 接手者快速 onboarding）

使用者原問題：「穿過的二手服可以交易」— 評估後判定不適合（封測期、品牌分級、雙邊市場冷啟動、蠶食新品四個硬傷），改聚焦「封測客戶 90 天回購」。

3 段式框架：
- **Day 0-14 Delight** — 除焦慮、建歸屬，不賣
- **Day 15-45 Discovery** — 養渴望、養再訪，不下單
- **Day 46-90 Conversion** — 扣板機（升級/點數/券/生日）

封測期最大優勢：~100 人以下可以品牌主理人**親自一對一**觸及（每筆訂單手寫感謝、Day 30 未回購親自 LINE）。儀表板已幫 cohort by phase 準備好名單 — 主理人直接掃 tab 找目標。

## 技術 debt / 後續改善

- 端點 limit:50000 單次撈全部 paid 訂單；封測 OK，規模到 5 萬以上改分頁 + incremental aggregation
- 今天沒加 cohort 對比功能（例如「第 X 週 vs 第 Y 週的 D30」並排）；等 4+ 週累積再回來做
- actionable list 沒加「複製 email list」按鈕，方便 bulk send；SMTP 接上後再做
- 週 cohort 粒度是週日起 7 天（台灣習慣）；之後若要切月度或 ISO week，endpoint 加 `?granularity=` param

## 風險點備忘

- **Payload v3 RSC 陷阱**：`admin.components.Field` 裡面的元件必須 `'use client'`，但我們是 `admin.components.views`（獨立頁），不受此限。View 本身是 server component，client 呈現在 `RepeatPurchaseClient`，架構正確。
- **dev mode DB lock**：我在 worktree 啟 dev server 實測時踩到 SQLite WAL 鎖 + drizzle-kit 自動 push 想 prompt 改 schema，屬 worktree 環境問題不影響 prod。不要複製 main 的 db 到 worktree dev，會引發 schema diff prompt。
- **SMTP 尚未接**：`src/payload.config.ts` 有 `consoleFallbackEmailAdapter`，forgot-password / verify token 會 log 到 server console。想推 drip 需要先做 (b)。
