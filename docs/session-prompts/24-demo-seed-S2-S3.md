# Demo Seed — S2 / S3（後台範例資料補完）

## Context（前情）

PR [#114](https://github.com/mjoalen-dotcom/chickimmiu/pull/114)（merged `7fd9885`）+
follow-up [#115](https://github.com/mjoalen-dotcom/chickimmiu/pull/115) +
[#116](https://github.com/mjoalen-dotcom/chickimmiu/pull/116) 已完成 S1：

✅ Returns / Exchanges / UGCPosts / UserRewards / AddOnProducts —
各 3-5 筆 demo，prod 已執行 `pnpm seed:demo` 寫入 DB。

腳本：`src/seed/seedDemoData.ts`，模式：
- 用 `[DEMO]` tag 標記在 `adminNote` / `displayName` / `name` 欄位
- 每次 reseed 先 wipe-by-tag 再 create（idempotent）
- 自動建一張 demo `Orders` 給 Returns/Exchanges 當 FK 標的
- ⚠️ **MUST be top-level await**（`payload run` 會在 import 完即 exit）— 看 seedCore.ts 註解

同 PR 也修了 admin 左 nav 跳動問題（N2：`aside.nav` 改 `position: fixed`、main 補 `margin-left: 240px`、`html { scrollbar-gutter: stable }`）。**已驗 prod CSS bundle 含 4 條規則**。

---

## S2 任務（建議下一個 session 接手）

擴充 `seedDemoData.ts` 加 8 個跟 S1 概念相鄰、後台缺資料的 collection：

| Collection | 建議筆數 | Tag 欄位 | 重點 |
|---|---|---|---|
| **GiftRules** | 3 | `name` 開頭 `[DEMO]` | 滿千送 / 滿萬送 / 第二件折扣 |
| **Bundles** | 3 | `name` 開頭 `[DEMO]` | 三件式套裝 / 配件組合 / 季節組 |
| **Refunds** | 3 | `adminNote` 開頭 `[DEMO]` | 對應 demo Returns 的退款記錄 |
| **ProductReviews** | 5 | `comment` 包 `[DEMO]` | 5 星好評 / 4 星 / 3 星附照 / 1 星抱怨 / 已回覆 |
| **Coupons** | 4 | `code` 開頭 `DEMO-` | 折扣券 / 滿千折百 / 首購券 / 生日券 |
| **CouponRedemptions** | 3 | `adminNote` 開頭 `[DEMO]` | 對應上面 3 張 Coupons |
| **PointsTransactions** | 5 | `note` 開頭 `[DEMO]` | 購物得點 / 簽到 / 兌換扣點 / 過期 / admin 調整 |
| **Invoices** | 3 | `invoiceNumber` 開頭 `INV-DEMO-` | 二聯式 / 三聯式 / 捐贈發票 |

**模式**：擴 `seedDemoData.ts` 同一支腳本（不要新建多支），加 `seedXxx()` async 函式分區，主流程依序 await。Wipe pattern 跟 S1 一致。

**前置**：跑 S2 前要先有 customer + product（已經有，prod customer #8 + 5 個 published products）。GiftRules / Bundles / Coupons 一些 FK 指向 product，沿用 `products[Math.min(N, products.length-1)]` pattern 防 OOB。

**驗證**：
1. local `npx tsc --noEmit` 看新 code 沒新 type 錯
2. `pnpm seed:demo:dry` 印出全部 14 個 collection 的 `[dry-run] would create...`
3. 推 PR → merge → prod deploy → `ssh root@5.223.85.14 "cd /var/www/chickimmiu && pnpm seed:demo"` 觀察每個區塊都有 ✓

**規模估**：約 +600 LOC、單 PR、1.5 小時。

---

## S3 任務（S2 之後的 session）

剩餘沒 seed 的 ~20 個 collection — 拆 2 個 PR。

### S3a — 遊戲 / 收集（PR）
- StyleGameRooms / StyleSubmissions / StyleVotes / StyleWishes（4）
- CollectibleCardEvents / CollectibleCardTemplates / CollectibleCards（3）
- CardBattles
- MiniGameRecords（2-3 筆 win 觸發 UserRewards 建立 chain）
- DailyHoroscopes（7 天 12 星座 = 84 筆，建議只塞 3 天 ×4 星座 = 12 筆 demo）

### S3b — 行銷 / CRM / 客服（PR）
- MarketingCampaigns / MarketingExecutionLogs（2）
- AutomationJourneys / AutomationLogs（2）
- BirthdayCampaigns
- FestivalTemplates
- MemberSegments
- MessageTemplates
- CreditScoreHistory
- CustomerServiceTickets / ConciergeServiceRequests（2）
- Affiliates
- SizeCharts
- BlogPosts
- LoginAttempts（純記錄類，可能不需要 demo）

**注意**：
- 一些 collection（MiniGameRecords、PointsRedemptions）有 afterChange hook 自動建子記錄。Seed 時要確認 hook 不會 throw（例如建 mini-game-record win 觸發 user-rewards create）。
- DailyHoroscopes 有 unique constraint on `date + zodiac`，wipe-pattern 要查那 2 欄組合
- LoginAttempts 通常 read-only by hook；可能不適合 demo（建議 skip）

---

## 啟動 prompt（複製給下一 session）

```
我要做後台 demo seed S2 — 擴充 src/seed/seedDemoData.ts 加 8 個 collection
（GiftRules / Bundles / Refunds / ProductReviews / Coupons / CouponRedemptions
/ PointsTransactions / Invoices）。請先 git log --oneline -5 + preview_list
確認沒並行 session，然後讀 docs/session-prompts/24-demo-seed-S2-S3.md 完整
context（PR #114/#115/#116 是 S1 已 merged）。

驗證流程：tsc → seed:demo:dry → 推 PR → merge → 部署 → ssh prod 跑
pnpm seed:demo 看 all-green。Prod ssh: root@5.223.85.14, deploy script
/root/deploy-ckmu.sh，跑 yes y | bash 避過 migrate prompt。
```
