# P0-B 收尾實作規格：Coupon Drop / Mystery Gift + 效果成本計入活動預算

> 來源：CHIC Commerce OS 工作單 §7.1 / §17。本文件由 2026-08-17 的四面向平行盤點收斂而成，
> 所有「證據」欄位都指向實際檔案行號。**動手前先讀 §0 的實測數字**，
> 那幾個數字推翻了盤點階段的兩個假設。

## 0. Alan 已拍板的參數（硬需求，設計不可違反）

| 項目 | 決定 | 日期 |
|---|---|---|
| Mystery Gift 發獎時機 | **付款成功後**才抽獎發獎（退款可經 orderReversal 回沖） | 2026-08-17 |
| Mystery Gift 獎池 | **保證有獎**、分級，獎池不含 `prizeType='none'` | 2026-08-17 |
| Coupon Drop 發放 | **限量先搶先贏**，總量上限，前台顯示真實剩餘量 | 2026-08-17 |
| 單人上限 | 兩者皆 **每人每檔活動 1 次** | 2026-08-17 |
| 成本歸屬 | 贈品／點數倍率／獎項成本 **計入 `budgetSpent`** | 2026-08-17 |

「保證有獎」的後果：期望成本顯著高於含銘謝惠顧的獎池，`budgetCap` 因此從保險絲
變成**主要成本閘門**。所以成本計入預算（第 5 項）是「保證有獎」能上線的前提，兩者不可拆。

## 0.1 實測數字（2026-08-17 於 pre 正式 DB，非推論）

```
商品成本覆蓋率：products.cost 55/1395 (4%)
                sourcing_cost_t_w_d 1219/1395 (87%)
                任一來源有值 1219/1395 (87%)，176 件完全沒有成本資料
→ 成本 fallback 鏈是必要條件而非優化：只讀 products.cost 的話
  fail-closed 會擋掉 96% 商品，贈品類規則等於不可用。

enum_user_rewards_state = unused, pending_attach, shipped, consumed, expired
→ 沒有 revoked。回沖用 expired + expiresAt=now，可省一支 ALTER TYPE。

enum_promotion_rules_effect_effect_type 現有 9 值，需再加 2
→ ALTER TYPE ADD VALUE 必須獨立一支 migration（PG16 同 transaction 內不可使用新值）

grant_reward 發獎路徑：**已確認從上線起一次都沒成功過**
  UserRewards.expiresAt required 但 grantIntentRewards 沒傳 → ValidationError
  被自家 catch 吞掉，granted 永遠 0。已於 commit b9bbd2d 修復並驗證冪等。
```

## 1. 判斷

難度中上但可控：Coupon Drop 與 Mystery Gift 本身都不難，真正的工作量在「補既有三個洞」——(a) evaluator.ts:541-547 讓 gift_item/points_multiplier/grant_reward 只設 groupsApplied=1 就跳過 8a/8b/8c 三道護欄，這是 Alan 第 5 條需求的根因；(b) 促銷成本沒有承載欄位（discountAmount 會被 pricing.ts:577-579 當真折扣扣掉訂單金額，不能借用），必須在 AppliedPromotion 與 PromotionApplications 兩側同時新開 budgetCostAmount，否則會出現「扣得到、退不回」的單向漏預算；(c) grantIntentRewards 建 UserRewards 時漏了 required 的 expiresAt（rewardOrchestrator.ts:91-105 vs UserRewards.ts:160-169），錯誤被自家 catch 吞掉——高信心但未實機驗證，實作前務必先驗，因為 Mystery Gift 會沿用同一條落地路徑。主要風險有五個：①PG enum ALTER TYPE ADD VALUE 是本專案第一次（migrations-pg 目前 0 支），payload migrate 把 up() 包在 transaction 內，PG16 可加值但同一 transaction 不能用新值，必須拆兩支 migration 且 down() 無解；②抽獎必須在付款後（evaluator 是純函式無隨機，evaluator.ts:5 的不變量），但預算預留在下單前（orderPricingHook beforeChange），兩個時點不一致，設計上用「下單預留保守上限、付款後用實際值差額修正」；③限量扣減若沿用 gameEngine.decrementPoolInventory（read-modify-write，gameEngine.ts:348-364）必超發，要全部換成 runSql 條件式 UPDATE + affectedRows===0；④訪客路徑（guest-order 走 local API，orderPricingHook.ts:56 直接 return）完全跳過預算預留與 quota 預留，且每筆訪客單都新建 isGuest 帳號，「每人 1 次」對訪客等於零約束——必須拍板「Coupon Drop / Mystery Gift 限登入會員」；⑤Coupon Drop 的發放時點四份定位都沒共識、Alan 也沒拍板，本規格拍板為「隨訂單付款成功後發券（下次可用）」，若 Alan 要的是「活動頁獨立領券」則步驟 10/11/13 要整段換成新的公開端點 + 限流，其餘不變。

## 2. 實作步驟

### [1] 先驗證兩個既有 bug 是否真的存在（不改碼，只跑驗證）

- **檔案**：`src/lib/promotions/rewardOrchestrator.ts`
- **為何**：整份規格的成本模型與落地路徑都建立在這兩個假設上：grant_reward 目前是死的、匯入商品 cost 是 null。定位結果標的是『高信心但未實機驗證』。若假設錯誤，步驟 9 與步驟 17 的優先序要調整。不先驗就動手等於把猜測寫進 migration。
- **改什麼**：

在 dev 環境用真 payload（不是 rewardOrchestrator.test.mjs:77-88 的 fakePayload）跑一次 grantIntentRewards，確認 payload.create({collection:'user-rewards'}) 是否因缺 expiresAt（UserRewards.ts:160-169 required:true、無 defaultValue、無 beforeChange 補值）被 ValidationError 擋下並被 :107-114 的 catch 吞掉。同時查 prod log 有無 '[rewardOrchestrator] grant_reward 發放失敗'。另外跑一次 SELECT count(*) FROM products WHERE cost IS NULL（以及 sourcing_cost_twd IS NOT NULL AND cost IS NULL 的交集），確認 fail-closed 一旦上線會擋掉多少商品。

### [2] DSL 型別層：新增兩個 effect variant、擴充 RewardIntent、AppliedPromotion 加成本欄位

- **檔案**：`src/lib/promotions/types.ts`
- **為何**：types.ts 是封閉 DSL，evaluator/snapshots 的 default 分支一律 fail closed，漏改任一處是靜默失效而非報錯。成本參數放在 effect 上而不是讓 evaluator 去查，是因為 evaluator.ts:5 的不變量規定純函式無 I/O、無 Date.now、無隨機——這條不變量同時也是 Mystery Gift 抽獎必須放在付款後的理由。budgetCostAmount 必須與 discountAmount 分開：pricing.ts:577-579 會把 discountAmount 加總成 promotionDiscount，再由 orderPricingHook.ts:159 寫進 data.discountAmount 真的扣掉訂單金額，把贈品成本記進去等於顧客白賺一筆折扣。
- **改什麼**：

①在 PromotionEffect union（:83-124）加兩個 variant：
  | { type: 'coupon_drop'; couponId: number|string; faceValueTwd: number|null; quantity: number }
  | { type: 'mystery_gift'; poolTag: string; excludePrizeTypes: string[]; maxPrizeValueTwd: number|null; fallbackPoolSlug: string|null }
  faceValueTwd / maxPrizeValueTwd 由 snapshots.ts 這個 I/O 層先查好餵進來，null = 算不出（fail closed 用）。
②gift_item variant 加 `unitCostTwd: number|null`（同理由 snapshots.ts 餵）。
③points_multiplier variant 加 `pointsPerDollar: number|null` 與 `pointsToCurrencyRate: number|null` 與 `costSafetyFactor: number`（預設 2.5）。
④RewardIntent.type（:315）union 擴成 5 值，加 'coupon_drop' | 'mystery_gift'；介面加 couponId?、poolTag?、claimKey?: string、costAmount?: number。
⑤AppliedPromotion（:281-300）新增 `budgetCostAmount: number`（非折扣、只進活動預算）。
⑥不新增 ReasonCode，缺成本一律沿用既有 'missing_cost_data'（types.ts:270）。

### [3] evaluator：抽出 NON_LINE_EFFECTS 常數、新增 resolveEffectCost、把三道護欄從 else 分支提出來共用

- **檔案**：`src/lib/promotions/evaluator.ts`
- **為何**：定位結果第 5 條已定位：8a/8b/8c 三段全在 :547 的 else 區塊內，gift_item/points_multiplier/grant_reward 直接跳到 :615 落地，這正是 Alan 說『等於免費』的精確機制，也讓這三型同時繞過 minimumGrossMarginPct 毛利護欄。free_shipping(:534-540) 同樣漏查預算，但它產生的 shippingDiscountAmount 在 orderPricingHook.ts:124 卻確實被計入預算扣款——現況是 evaluator 說可以、下單時條件式 UPDATE 才 rowsAffected=0 丟 409，顧客體驗是硬錯誤而非優雅降級，順手一起修。exhaustiveness check 讓下次加效果型別由 tsc 強制報錯，不再靠人工清單。
- **改什麼**：

①檔頭新增 `const NON_LINE_EFFECTS: ReadonlySet<PromotionEffect['type']> = new Set(['free_shipping','gift_item','points_multiplier','grant_reward','coupon_drop','mystery_gift'])`，把 :468-472 的四個硬編碼字串改成 `const isLineEffect = !NON_LINE_EFFECTS.has(rule.then.type)`。
②新增純函式 `resolveEffectCost(then: PromotionEffect, ctx: { orderSubtotal: number }): number | null`：gift_item → then.unitCostTwd == null ? null : unitCostTwd * quantity；coupon_drop → faceValueTwd == null ? null : faceValueTwd * quantity；mystery_gift → maxPrizeValueTwd（null 則 null）；points_multiplier → (rate==null||rate<=0||ppd==null) ? null : Math.ceil(orderSubtotal * ppd * (multiplier-1) / rate * costSafetyFactor)；其餘 → 0。
③把 :541-547 的 else-if 分支改成：`else if (NON_LINE_EFFECTS.has(rule.then.type)) { const c = resolveEffectCost(rule.then, { orderSubtotal }); if (c == null) { reject(rule, ['missing_cost_data']); pushProgress(rule, eligible, false); continue } budgetCostAmount = c; groupsApplied = 1 }`（free_shipping 保留既有 shippingDiscountAmount 計算，但也走進共用預算檢查）。
④把 8a maxBenefit(:558-566)／8b 預算(:568-582)／8c 毛利(:584-606)／zero_discount(:608-612) 從 `else {}` 區塊裡搬出來，放在 :613 之後、:615 落地之前，對所有分支共用；8b 的比較式改成 `discountAmount + shippingDiscountAmount + budgetCostAmount > remainingBudget`；zero_discount 判定改成 `discountAmount <= 0 && shippingDiscountAmount <= 0 && budgetCostAmount <= 0 && !NON_LINE_EFFECTS.has(rule.then.type)`（純獎勵型不因為沒折扣而被拒）。
⑤:623-647 的 rewardIntents push 鏈加兩段（coupon_drop / mystery_gift），帶 costAmount 與 claimKey=`${rule.ruleKey}`。
⑥:649-665 的 application 物件加 `budgetCostAmount`。
⑦在 push 鏈末尾加 `else { const _never: never = rule.then as never; void _never }` 做 exhaustiveness check。

### [4] snapshots：新增兩個 case、補 gift_item 成本、補點數換算率、default 加 warn

- **檔案**：`src/lib/promotions/snapshots.ts`
- **為何**：snapshots.ts 是唯一 I/O 層，成本資料必須在這裡查好再餵進純函式 evaluator。default 靜默 return null 是最容易漏的一處：後台 select 加了新 value、PG enum 也加了，但這裡沒加 case，規則存得進 DB、狀態顯示 active、evaluator 卻永遠收不到，完全沒有錯誤訊息（MEMORY 裡『PG select 欄位字面值稽核』踩過的同一類坑）。這一步同時是整份規格的 fail-closed 源頭：成本算不出來就讓 snapshot 帶 null，由 evaluator 統一拒絕。
- **改什麼**：

①ruleDocToSnapshot 的 switch（:133-199）加兩個 case：
  case 'coupon_drop'：relId(effectGroup.dropCoupon) 取 couponId，null → return null；再 payload.findByID coupons 取 discountType/discountValue/maxDiscountAmount，faceValueTwd = discountType==='fixed' ? discountValue : (maxDiscountAmount ?? null)（百分比券沒設上限 → null → 下游 fail closed）。
  case 'mystery_gift'：poolTag 固定 'order_mystery_gift'，excludePrizeTypes 固定 ['none']，maxPrizeValueTwd = 查 prize-pools（active、eligibleGames contains poolTag、時窗內）取 max(estimatedValue ?? estimatePrizeValueTwd(prizeType, amount))；**若任一 active 獎品的 estimatedValue 為空且 prizeType 不屬於 points/credit（可自動換算）→ 回 null**；fallbackPoolSlug 讀 effectGroup.fallbackPrizeSlug。
②case 'gift_item'（:178-183）在 relId 之後多一次 payload.findByID products，unitCostTwd = product.cost ?? variant.costOverride ?? sourcing.costTWD ?? null（與步驟 17 的 fallback 鏈一致），overrideAccess:true（Products.ts:939-950 的 cost 有 access.read: isLoggedInFieldLevel）。
③case 'points_multiplier'：從 loyalty-settings global 讀 pointsConfig.pointsPerDollar 與 pointsToCurrencyRate（LoyaltySettings.ts:37），塞進 effect；讀不到 → 兩者填 null。
④default（:197-198）與外層 catch（:288-290）加 payload.logger.warn，寫出 slug 與 effectType。

### [5] 後台：PromotionRules 加兩個 select option、參數欄位、beforeValidate 硬驗證

- **檔案**：`src/collections/PromotionRules.ts`
- **為何**：後台 select 的 9 個 value 目前與 types.ts union 100% 對得起來，要維持這個 1:1。beforeValidate 把 fail-closed 從『上線後靜默不發』提前到『存檔當下報錯』，這是本專案踩過最多次的坑類型。強制 perUserLimit=1 是把 Alan 的硬需求鎖進 schema 而不是靠 admin 記得填。
- **改什麼**：

①:355-371 的 options 加兩筆：{ label:'限量券包（先搶先贏）', value:'coupon_drop' }、{ label:'神秘禮物（付款後抽獎，保證有獎）', value:'mystery_gift' }，value 必須與 types.ts 同名。
②在 effect group（:350-518）內、仿 :459-467 的樣板加欄位（全部帶 admin.condition 判 siblingData.effectType）：
  coupon_drop：dropCoupon(relationship→coupons, required)、dropQuantity(number, default 1)。
  mystery_gift：fallbackPrizeSlug(text，指向 PrizePools.slug，必須是 inventoryUnlimited=true 的保底獎)。
  ⚠️ 欄位必須放在 effect group 內，放到 group 外 siblingData 抓不到 effectType，condition 永遠 false、欄位永久隱形。
③:32-73 的 beforeValidate 加驗證（仿 :46-70 的 throw 樣式）：
  - effectType==='coupon_drop' 時 dropCoupon 必填；且該 coupon 若是百分比折扣必須有 maxDiscountAmount（否則面額算不出 → fail closed，要在存檔當下就擋，不要讓 admin 上線後才發現規則靜默不生效）。
  - effectType==='coupon_drop' 時，campaign 必須設 commerceDropTotal（步驟 6 新增的欄位），否則『限量』無意義。
  - effectType==='mystery_gift' 時 fallbackPrizeSlug 必填，且用 req.payload 查該 slug 存在、active、inventoryUnlimited===true、prizeType!=='none'。
  - 兩者一律強制 guardrails.perUserLimit===1（Alan 需求 4），不是 1 就 throw。
  - 同一 campaign 下不得有第二條 active 的 coupon_drop 規則（因為 quota 計數掛在 campaign 上，見步驟 6）。
④注意 :74-100 的 beforeChange lock：規則一旦 status='active'，effect/guardrails 全被鎖，改參數要停用後另建新版本，而 ruleKey 帶 version、usage 計數以 ruleKey 為 key（snapshots.ts:449）會歸零——所以總量上限刻意不放在 rule 上。

### [6] 新 collection：PromotionDropClaims（每人每檔 1 次的 DB 級硬約束 + 回沖憑據）

- **檔案**：`src/collections/PromotionDropClaims.ts`（新增）（需 migration）
- **為何**：quota-atomicity 定位指出：evaluator 的 perUserLimit 只吃 usage snapshot（下單後才有的 promotion-applications count），是報價期的軟檢查、有 TOCTOU，不能當唯一防線；而 CouponRedemptions 完全沒有任何 unique 約束、usageCount 是 read-modify-write。專案裡唯一可靠的『每人 1 次』先例是 WishlistItems.ts:40-43 的 collection-level unique index，以及 PromotionApplications.ts:140-147 的單欄 unique idempotencyKey + 捕捉 UNIQUE 例外（orderPricingHook.ts:236 的 /UNIQUE|unique/i 慣例）。這張表同時是退款回沖時『這張單發過什麼』的唯一憑據——現有回沖完全不碰 user-rewards。⚠️ user 設 required 是刻意的：PG 的 unique 不擋 NULL，訪客若 user=NULL 則約束等於零，所以本功能限登入會員（見步驟 13）。
- **改什麼**：

新建 collection，slug 'promotion-drop-claims'，group 歸到促銷。欄位：idempotencyKey(text, required, unique, index)、campaign(relationship→marketing-campaigns)、rule(relationship→promotion-rules)、ruleKey(text, required, index)、user(relationship→customers, required, index)、order(relationship→orders)、effectType(text, required)、status(select: reserved|granted|reversed, default 'reserved')、budgetCostAmount(number, default 0)、quotaConsumed(checkbox, default false)、prizePool(relationship→prize-pools)、grantedReward(relationship→user-rewards)、coupon(relationship→coupons)、grantedAt(date)、reversedAt(date)、reversalReason(text)。access: read/create/update/delete 全部 isAdmin（前台一律走 overrideAccess 的伺服器路徑）。
idempotencyKey 組法：`${ruleKey}:u${userId}` —— 單欄 unique 就同時提供『每人每檔 1 次』與『重放冪等』兩件事，不必宣告複合 index。
最後在 src/payload.config.ts 的 collections 陣列註冊（位置決定後台側欄群組順序，不是字串排序）。

### [7] PG migration A：只做 ALTER TYPE ADD VALUE，什麼都不使用

- **檔案**：`src/migrations-pg/<timestamp>_p0b_drop_enums.ts`（新增）（需 migration）
- **為何**：@payloadcms/drizzle/dist/migrate.js:68-87 把 up() 包在 transaction 裡，PG16 允許 transaction 內 ALTER TYPE ADD VALUE，但新值在該 transaction commit 前不可被使用（此限制到 PG17 才放寬）；違反會噴 unsafe use of new value of enum type，而 migrate.js:94 是 process.exit(1)，部署當場硬死。migrations-pg 目前 0 支做過 ADD VALUE（既有 enum migration 全是 CREATE TYPE 新建，如 20260817_042534_p0b_reward_type.ts:5），這是本專案第一次走這條路，所以刻意拆成獨立一支、內容極簡。baseline 出處：20260816_023522_pg_baseline.ts:107（effect_effect_type enum）與 :178（eligible_games enum）。
- **改什麼**：

用 `pnpm payload migrate:create` 產生（drizzle-kit 0.31.7 的 AlterTypeAddValueConvertor 會自動吐出正確語句），內容只有三句：
  ALTER TYPE public.enum_promotion_rules_effect_effect_type ADD VALUE 'coupon_drop';
  ALTER TYPE public.enum_promotion_rules_effect_effect_type ADD VALUE 'mystery_gift';
  ALTER TYPE public.enum_prize_pools_eligible_games ADD VALUE 'order_mystery_gift';
這支 migration 內**絕對不可以**有任何 INSERT/UPDATE/CREATE TABLE DEFAULT 用到這三個新值。down() 人工改成 no-op 並加註解說明 PG 無 DROP VALUE，回滾只能靠還原 dump。跑完後 `pnpm payload generate:types` 更新 src/payload-types.ts（codegen 產物，手改會被蓋）。

### [8] PG migration B：新表 + 新欄位（與 A 分開部署）

- **檔案**：`src/migrations-pg/<timestamp>_p0b_drop_schema.ts`（新增）（需 migration）
- **為何**：budgetCostAmount 必須同時存在於快照（AppliedPromotion）與 DB 欄位（PromotionApplications）：預算預留讀快照（orderPricingHook.ts:124），但回沖讀的是 DB 欄位（orderPricingHook.ts:294）——只改快照不改 collection 會造成『扣得到、退不回』的單向漏預算。quota 計數放 marketing_campaigns 而不是 promotion_rules，是因為 PromotionRules.ts:74-100 的 active lock 會讓上線後無法加碼，而 marketing_campaigns 沒有這個 lock，且既有的原子預算 UPDATE 樣板（orderPricingHook.ts:128-138）就是打這張表，可以完全共用寫法。代價：一檔活動只能有一條限量 drop 規則（已在步驟 5 的 beforeValidate 擋住）。
- **改什麼**：

同樣用 migrate:create 產生，內容：
  CREATE TABLE promotion_drop_claims（含 unique index on idempotency_key、index on rule_key / user_id / order_id、三條 FK：campaign_id→marketing_campaigns、rule_id→promotion_rules、user_id→customers ON DELETE set null 等，照 baseline:5039 的 FK 樣板）
  ALTER TABLE marketing_campaigns ADD COLUMN commerce_drop_total numeric;
  ALTER TABLE marketing_campaigns ADD COLUMN commerce_drop_claimed numeric DEFAULT 0;
  ALTER TABLE promotion_applications ADD COLUMN budget_cost_amount numeric DEFAULT 0;
  ALTER TABLE promotion_rules ADD COLUMN effect_drop_coupon_id integer;（+FK→coupons+index）
  ALTER TABLE promotion_rules ADD COLUMN effect_drop_quantity numeric;
  ALTER TABLE promotion_rules ADD COLUMN effect_fallback_prize_slug varchar;
同步在 src/collections/MarketingCampaigns 加 commerceDropTotal / commerceDropClaimed(readOnly) 兩個欄位、在 src/collections/PromotionApplications.ts:130-131 旁加 budgetCostAmount(number, defaultValue 0, min 0)。注意 PromotionApplications.effectType 是 text（:112）不是 enum，加新效果型別不用動它。migrations-pg/index.ts 由 migrate:create 自動註冊。

### [9] gameEngine：drawPrize 加 options 參數支援排除獎項型別，並新增原子扣庫存函式

- **檔案**：`src/lib/games/gameEngine.ts`
- **為何**：drawPrize 目前沒有任何 prizeType 過濾（loadPoolPrizes 的條件只有 active / eligibleGames / 庫存 / 時窗 / weight>0），Alan 需求 2『獎池不含 none』必須靠程式硬過濾而不是靠 admin 記得不掛 none——後者是靠人不靠碼，而且機率公示頁 /games/terms 會照實列出。DrawnPrize 目前沒有 estimatedValue 欄位（:36-48），這正是遊戲 API 與月度金額上限只用 estimatePrizeValueTwd() 而完全不看 PrizePools.estimatedValue 的根因（api/games/route.ts:423 vs games/terms/page.tsx:226 兩種優先序不一致），補上才能讓成本入帳與法規公示頁用同一個數字。既有 decrementPoolInventory 註解自承『同時搶最後一個可能 oversell 1-2 個』，直接拿來做限量必超發。drawPrize 本身純讀取、不寫 mini-game-records、不扣點、不計 dailyLimit，在訂單情境呼叫是安全的。
- **改什麼**：

①drawPrize 簽名（:366-370）加第 4 參數：`opts?: { excludePrizeTypes?: string[]; excludePoolIds?: number[] }`，向下相容（既有 3 個呼叫端不傳 → 零行為變更）。
②loadPoolPrizes（:296-341）加同樣的 opts 並在 :340 的 filter 追加 `&& !(opts?.excludePrizeTypes ?? []).includes(p.prizeType) && !(opts?.excludePoolIds ?? []).includes(p.id)`；GAME_CONFIGS fallback 路徑（:424 的 map 之前）套同一個 filter。
③PoolPrize 介面（:275-285）與 DrawnPrize（:36-48）各加 `estimatedValue?: number`，並在 :326-340 的 map 補 `estimatedValue: typeof r.estimatedValue === 'number' ? r.estimatedValue : undefined`。
④新增並 export `atomicDecrementPoolInventory(payload, poolId): Promise<boolean>`，用 runSql 條件式 UPDATE：`UPDATE prize_pools SET inventory_remaining = COALESCE(inventory_remaining,0) - 1 WHERE id = ${Number(poolId)} AND inventory_unlimited = false AND COALESCE(inventory_remaining,0) > 0`，回傳 affectedRows(res) > 0。**不要改既有的 decrementPoolInventory**（:348-364），保留給遊戲路徑，避免動到已上線行為。
⑤新增 `restorePoolInventory(payload, poolId)`：`... + 1 WHERE id = $1 AND inventory_unlimited = false AND (inventory_total IS NULL OR COALESCE(inventory_remaining,0) < inventory_total)`，退款回沖用。

### [10] 新檔：付款後獎勵落地器（抽獎 + 發券 + 冪等 + 保底）

- **檔案**：`src/lib/promotions/paidRewardOrchestrator.ts`（新增）
- **為何**：抽獎絕對不能放進 evaluator（evaluator.ts:5 明文『無 Date.now / 無隨機』），只能吐 intent、由付款後的落地器抽——這正好符合 Alan 需求 1。落地點仿 grantIntentRewards 而非仿 pricing.ts:518 的贈品即時實體化（那是計價當下就發，不符需求 1）。冪等鍵改用 promotion-drop-claims.idempotencyKey，不用 rewardOrchestrator.ts:76-84 現行的 attachedToOrder+displayName——Mystery Gift 的 displayName 每次抽出來都不同，那個判重法必然失效，而且它是 find-then-create 非原子。expiresAt / requiresPhysicalShipping 兩項是踩既有坑：前者 required 但 grantIntentRewards 沒帶（rewardOrchestrator.ts:91-105 vs UserRewards.ts:160-169）；後者 defaultValue:true 而 Orders.ts:793-831 的 beforeChange 會把 unused + requiresPhysicalShipping=true 的獎自動塞進顧客下一張訂單當實體贈品寄出（Orders.ts:1614-1641），電子券被當實體寄是真實災難。
- **改什麼**：

新建，export 一支 `settlePaidPromotionRewards(payload, args: { userId, orderId, orderNumber?, tierSlug, creditScore, intents: RewardIntent[] }): Promise<{ granted: number; skipped: number; costDelta: Map<string, number> }>`。內部：
①對每個 type==='mystery_gift' 或 'coupon_drop' 的 intent，先 payload.find promotion-drop-claims by idempotencyKey，status==='granted' → skipped++ continue（第二層冪等；第一層是 Orders 的 paid 閘門）。
②mystery_gift：迴圈最多 5 次 —— drawPrize('order_mystery_gift', tierSlug, creditScore, { excludePrizeTypes: ['none'], excludePoolIds: 已試過的 })；抽到後若 inventoryUnlimited=false 則 atomicDecrementPoolInventory，回 false（被搶完）就把該 poolId 加進 excludePoolIds 重抽；5 次都失敗 → 用規則的 fallbackPoolSlug 撈保底獎（步驟 5 已強制它 inventoryUnlimited=true，必定成功）。**任何路徑都不得回傳無獎**，這是 Alan 需求 2『保證有獎』的硬保證。
③coupon_drop：不抽獎，直接把 intent.couponId 的券發給使用者——沿用 redemptionEngine.ts:247-269 的模式（payload.create coupons 動態產生一次性 code `CKMU-DROP-${orderId}-${userId}${rand}`、usageLimit:1、usageLimitPerUser:1，欄位值複製自模板券），再建 UserRewards 綁人。
④共用 `grantUserReward()`：rewardType 用 MiniGameRecords.ts:214-231 那份 prizeType→rewardType 對照表（抽成共用函式，不要寫第三份）；**必帶 expiresAt**（= now + (prize.expiryDays ?? 365) 天，算法對齊 MiniGameRecords.ts:226 與 redemptionEngine.ts:439）；**必明設 requiresPhysicalShipping**（依 deliveryMethod==='physical_shipping' || rewardType==='gift_physical' || rewardType==='movie_ticket_physical'，對照 MiniGameRecords.ts:228-231）；redemptionInstructions 沿用 redemptionEngine.ts:439 的文案結構。
⑤points/credit 型獎品不進 UserRewards（與 MiniGameRecords.ts 的既有語意一致），改直接入帳 customers.points / shoppingCredit 並寫 points-transactions ledger——把 gameEngine.recordGamePlay:537-599 的入帳那一半抽出來共用，**不要整包複用**（那個函式會同時建 mini-game-record）。
⑥每筆成功發放後 payload.update 該 claim → status:'granted', grantedAt, grantedReward/coupon/prizePool, budgetCostAmount = 實際成本（estimatedValue ?? estimatePrizeValueTwd()），並把「實際成本 − 下單時預留的估算成本」記進回傳的 costDelta（per campaign）。
⑦全程 try/catch 不拋出、回傳統計（維持 rewardOrchestrator 的既有契約）。

### [11] 修既有 grantIntentRewards 的 expiresAt / requiresPhysicalShipping 缺陷

- **檔案**：`src/lib/promotions/rewardOrchestrator.ts`
- **為何**：定位結果判定 grant_reward 這條路目前實際上是死的：create 被 ValidationError 擋下、錯誤被自家 catch 吞掉、測試用假 payload 所以沒抓到。Mystery Gift 若沿用同一條落地路徑會踩同一個坑，所以必須先修好再擴充。這是步驟 1 要先驗證的假設。
- **改什麼**：

在 :91-105 的 create data 補 `expiresAt`（預設 now + 365 天，與 MiniGameRecords.ts:226 對齊）與 `requiresPhysicalShipping: false`（grant_reward 發的是 'voucher'，客服履行）。冪等（:74-89）改成優先查 promotion-drop-claims 的 idempotencyKey，查不到才 fallback 到現行的 attachedToOrder+displayName（保留相容）。:107-114 的 catch 從 logger.error 升級成同時寫一筆 behavior-events 或至少加上 collection/data 摘要，避免下次又是靜默死亡。既有測試 rewardOrchestrator.test.mjs:77-88 的 fakePayload 要換成會跑必填驗證的 stub。

### [12] 下單時：預算含成本、quota 原子預留、每人 1 次 DB 級硬約束

- **檔案**：`src/lib/promotions/orderPricingHook.ts`
- **為何**：orderPricingHook.ts:126-138 是全 repo 唯一正確的『搶最後一份額度』樣板（條件式 UPDATE + affectedRows===0，而不是先 SELECT 再 UPDATE），Coupon Drop 的限量先搶先贏直接照抄它的形狀。evaluator 的 perUserLimit 只是報價期軟檢查（有 TOCTOU），DB 級 unique 才是真防線。步驟順序刻意是『先扣 quota、再建 claim』，這樣 UNIQUE 衝突時只要補償 quota 一筆，不會出現 claim 建了但 quota 沒扣的狀態。
- **改什麼**：

①:120-125 的 byCampaign 累加改成 `+ app.discountAmount + app.shippingDiscountAmount + (app.budgetCostAmount ?? 0)`。
②在 :126-138 的預算預留**之後**、覆寫金額欄位之前，新增 quota 原子預留（只對 evaluation.rewardIntents 裡 type==='coupon_drop' 的，且該 campaign 有 commerce_drop_total）：
```
const res = await runSql(req.payload, sql`UPDATE marketing_campaigns
  SET commerce_drop_claimed = COALESCE(commerce_drop_claimed, 0) + 1
  WHERE id = ${Number(campaignId)}
    AND (commerce_drop_total IS NULL OR COALESCE(commerce_drop_claimed,0) + 1 <= commerce_drop_total)`)
if (affectedRows(res) === 0) throw new APIError('限量券已被領完，請重新整理結帳頁', 409)
```
③每人 1 次硬約束：對每個 coupon_drop / mystery_gift intent，`payload.create({ collection:'promotion-drop-claims', data:{ idempotencyKey: `${intent.ruleKey}:u${userId}`, ... status:'reserved', quotaConsumed:true, budgetCostAmount: intent.costAmount ?? 0 } })`，catch 到 /UNIQUE|unique/i → throw APIError('此活動每人限領一次', 409)（並把剛剛加的 quota 減回去）。userId 為 null（訪客）→ 直接不套用該規則。
④:213-232 寫 promotion-applications 時帶上 `budgetCostAmount: Number(app.budgetCostAmount) || 0`。
⑤把 ①②③ 抽成一支可重用的 `reserveCampaignBudgetAndQuota(payload, evaluation, userId, orderId)`，export 給 guest-order 路徑（步驟 13）。
⑥import 照抄 :24-25：`import { sql } from '@payloadcms/db-sqlite'` + `import { affectedRows, runSql } from '../db/dialectSafeSql'`。**絕不可用 payload.db.drizzle.run()**（PG 沒有 run，dialectSafeSql.ts:39-47 記載這正是切 PG 後三個呼叫點靜默失效的原因）。識別字不加引號、不用 MAX()/GREATEST()（dialectSafeSql.ts:19-25）。

### [13] 付款成功：掛一支獨立的薄 hook，不要塞進既有大 hook

- **檔案**：`src/collections/Orders.ts`
- **為何**：『付款成功』的判定是 paymentStatus==='paid' && prev!=='paid'（Orders.ts:970-972 的既有慣例，2026 年從 status==='delivered' 搬過來避免 double-credit），不是 status。必須做成獨立 hook 而不是塞進 :897 那個大 hook：那個 hook 在 grantIntentRewards(:1146) 之前還有 payload.findByID(customers)、LoyaltySettings 讀取、customers.update、writePurchasePointsLedger，任何一步 throw 都會讓後面完全不執行（catch 在 :1300-1302）。mint 造型卡 hook（:1491-1512）是最貼近的先例：paid-gated 薄 hook 委派給 lib 模組、錯誤只 console.error 不阻斷。
- **改什麼**：

在 :1512（mint 造型卡 hook）之後、:1514（撤卡 hook）之前，新增一支 afterChange：
```
async ({ doc, previousDoc, req }) => {
  const paymentStatus = doc.paymentStatus as string
  const prev = previousDoc?.paymentStatus as string | undefined
  if (paymentStatus !== 'paid' || prev === 'paid') return
  try {
    const r = await settlePaidPromotionRewards(req.payload, { ... intents: readRewardIntents(doc) })
    // 用 costDelta 對活動預算做差額修正（實際成本 − 下單預留估算），
    // 走 runSql 條件式 UPDATE，正負都要處理
  } catch (err) { console.error('[Orders Hook] 促銷獎勵落地異常：', err) }
}
```
**訪客判定**：doc.customer 對應的 customers 若 isGuest===true → 直接 return 並記 log（本功能限登入會員）。

### [14] 退款 / 取消回沖：新增第 4 段（獎品、quota、claim、prize 庫存）

- **檔案**：`src/lib/commerce/orderReversal.ts`
- **為何**：現行取消還原（Orders.ts:1679-1715）只撈 state==='pending_attach' 的 user-rewards，而 grantIntentRewards 建的是 state:'unused'，查詢條件永遠不匹配——退款完全不回沖已發出的獎，這是 Alan 硬需求裡目前唯一沒有任何既有機制可沿用、必須新寫的部分。放在 orderReversal.ts 比放寬 Orders.ts:1679 的 where 乾淨（後者會誤傷 checkout 隨單寄出流程），且該檔已有終態閘門與冪等慣例。回沖三件事必須成套：quota、prize 庫存、活動預算，少一件就是單向漏。
- **改什麼**：

在既有三段（券額度 :107-133、分潤佣金 :135-183、點數 :185-250）之後新增第 4 段 `reversePromotionDropClaims`，沿用該檔 :99-101 的終態閘門（status==='cancelled'||'refunded' 且 prev 不是終態）：
①payload.find promotion-drop-claims where order===orderId AND status IN ('reserved','granted')。
②每筆：quotaConsumed=true → runSql `UPDATE marketing_campaigns SET commerce_drop_claimed = COALESCE(commerce_drop_claimed,0) - 1 WHERE id = $1 AND COALESCE(commerce_drop_claimed,0) > 0`（不用 GREATEST，用 WHERE 擋負數）。
③prizePool 有值 → restorePoolInventory(payload, poolId)（步驟 9 新增）。
④grantedReward 有值 → payload.update user-rewards 把 state 改成 'expired' 或新增 'revoked' 值（**如果 UserRewards.state 是 PG enum 則需要第三次 ALTER TYPE ADD VALUE，優先用既有的 'expired' 避免多一支 migration**），並把 expiresAt 設成 now。
⑤coupon 有值（動態產生的 drop 券）→ payload.update coupons 設 isActive:false。
⑥claim 標 status:'reversed' + reversedAt + reversalReason=`order_${status}`。
⑦**保留 idempotencyKey 不刪**——退款後不重新開放該使用者再領一次（否則『下單→退款→再領』可無限刷）。若 Alan 要求退款後恢復資格，改成刪除 claim，但那會製造刷單漏洞，需明確拍板。
另外 orderPricingHook.ts:294 的回沖金額改成 `discountAmount + shippingDiscountAmount + budgetCostAmount`（讀 DB 欄位，步驟 8 已新增）。

### [15] 訪客路徑：明確拒絕，並讓 guest-order 共用預留函式

- **檔案**：`src/app/(frontend)/api/checkout/guest-order/route.ts`
- **為何**：guest-order 走 local API，orderPricingHook.ts:53-56 對 local API 直接 return，整段活動預算原子預留在訪客路徑上完全不執行（全 repo runSql 只有三處，沒有一處在 guest-order）——一旦開檔就會出現『訪客單不吃預算上限』的超支，這是既有缺口不是本次引入，但 Alan 需求 5 落地時會被放大。而 guestCheckout.ts:15-20 每筆訪客單都新建一個 isGuest 臨時帳號（guest-order/route.ts:143-154），任何以 user id 為鍵的『每人 1 次』對訪客都是零約束——PG 的 unique index 也不擋 NULL。技術上做不到就要明講，不要默默留白。
- **改什麼**：

①在自行計價之後（:92-106 的 computeOrderPricing 之後、建單之前），呼叫步驟 12 抽出的 `reserveCampaignBudgetAndQuota(payload, evaluation, null, null)`——傳 userId=null，函式內部對 coupon_drop / mystery_gift intent 一律略過並記 log，但**活動預算預留（含 budgetCostAmount）照做**。
②同時把 :216-217 寫 promotion 快照的地方對齊步驟 12 的欄位。
③前台文案：Coupon Drop / Mystery Gift 活動一律標示『需登入會員』。

### [16] 前台真實剩餘量：一支唯讀 API + 顯示，不碰結帳鏈

- **檔案**：`src/app/(frontend)/api/promotions/drop-status/route.ts`（新增）
- **為何**：Alan 需求 3『前台顯示真實剩餘量』走 evaluator 那條路做不到：usage snapshot 的 totalApplied 來自 promotion-applications 的 count（snapshots.ts:457-464），那是下單後才有的資料，而且查詢失敗時 fail closed 設成 MAX_SAFE_INTEGER。真實剩餘量只能從 quota 計數欄位直接讀。rateLimit.ts:5-6 自述是 in-memory 單進程，pm2 多實例時會按實例數倍化，所以它只是輔助——真正防超發的是步驟 12 的 DB 原子扣減。
- **改什麼**：

新建 GET route，接 ?campaignId= 或 ?ruleKey=，回 `{ ok, total, claimed, remaining, perUserClaimed, soldOut }`：total/claimed 直接讀 marketing_campaigns.commerce_drop_total / commerce_drop_claimed（唯讀 find，不用 runSql），perUserClaimed 讀 promotion-drop-claims count by (ruleKey, userId)。加限流：`checkRateLimit(`drop-status:${clientIpForRateLimit(req)}`, 120, 60_000)`，參數對齊 pricing/quote/route.ts:43-57 的讀取型端點等級。回應加 `Cache-Control: no-store`。前台顯示改 src/components/campaign/CartCampaignProgress.tsx（:23-34 的 hintLabel 加兩種效果的文案）。

### [17] 成本資料 fallback：補 sourcing.costTWD 與 variant，否則 fail-closed 會擋掉大半商品

- **檔案**：`src/lib/promotions/pricing.ts`
- **為何**：Shopline XLSX 匯入器只寫 sourcing.costTWD 不寫 top-level cost（import-shopline-xlsx.ts:195-199、endpoints/shoplineXlsxImport.ts:297、shopline/xlsxParser.ts:25），而 pricing.ts 完全不 fallback——匯入商品在計價引擎眼中 cost=null。後台毛利 widget 早就做了這個 fallback（ProductMarginInsight.tsx:31-37）但計價引擎沒有，是兩套成本混亂的既有點。不補這條鏈，步驟 3 的 fail-closed 一上線就會把所有從 Shopline 搬過來的贈品規則全部擋掉（reasonCode missing_cost_data），Alan 會看到『活動全部不生效』。步驟 1 的 SQL 盤點就是為了先量化這個影響面。
- **改什麼**：

①:203-209 的 unitCost 取值鏈補第三段 fallback：`product.cost → variant.costOverride → product.sourcing?.costTWD → null`（注意 Products.ts:939-950 的 cost 有 access.read: isLoggedInFieldLevel，pricing.ts 走 overrideAccess:true 沒問題，但任何新寫的讀取路徑若沒有 overrideAccess，cost 會被剝掉靜默算成 0）。
②:557-569 伺服器注入的贈品行 snapshot.unitCost（:563）目前只讀 `p.cost`，套用同一條 fallback 鏈。
③步驟 4 的 snapshots.ts gift_item unitCostTwd 用同一支 helper，抽成 `resolveProductUnitCost(product, sku?)` 共用。
④**不要動** :617 的 total 計算式、:632-635 的 itemsCost / costDataComplete 語意（那是整車 COGS，不是活動成本，別拿來當 budgetSpent）。

### [18] 點數換算率接線（點數倍率成本的唯一缺口）

- **檔案**：`src/globals/LoyaltySettings.ts`
- **為何**：點數倍率是三種效果裡唯一『缺的東西小且明確』的：pointsToCurrencyRate 定義了但全 repo 零讀取（是死欄位），程式裡唯一的換算是 abuseDetection 硬編碼的 1 點=NT$1，比設定值高估 100 倍。增額點數的三個因子（orderTotal 定案、會員 tier、訂閱狀態）在 evaluator 純函式階段拿不齊，所以下單只能保守高估預留、付款後才是權威——這正好跟 Mystery Gift 的抽獎是同一個時間點，兩件事放同一支 hook。
- **改什麼**：

①新增 helper `getPointsToTwdRate(payload): Promise<number>` 讀 loyalty-settings.pointsConfig.pointsToCurrencyRate（LoyaltySettings.ts:37，預設 100 = 100 點兌 NT$1），fallback 100，放在 src/lib/loyalty/ 下。
②snapshots.ts 的 points_multiplier case 用它填 effect.pointsToCurrencyRate（步驟 4）。
③**abuseDetection.ts:43-61 的 `case 'points': return amount * 1` 先不要改**——那行註解寫『依 LoyaltySettings 預設』但實際差 100 倍，改它會同時改變 checkMonthlyValueCap 的行為（現有會員當月累計值瞬間縮 100 倍 = 風控門檻放寬 100 倍）與 /games/terms 機率公示頁上顯示的獎品價值（對外法規揭露文件）。列成獨立工單，需 Alan + 法規面拍板後再動。
④付款後 hook（步驟 13）用實際 pointsEarned（Orders.ts:1102-1108 的 basePoints × tier × 訂閱 × campaignMultiplier）換算實際成本，對預算做差額修正。

### [19] 法規公示：把 order_mystery_gift 納入機率公示頁

- **檔案**：`src/app/(frontend)/games/terms/page.tsx`
- **為何**：依消保法與公平會規範，贈獎活動的機率與獎項價值要公示。這一頁既有邏輯已經會自動算，只要讓新的 eligibleGames 值被涵蓋。⚠️ 需求不確定點：Mystery Gift 不是『遊戲』，要不要放在 /games/terms 這頁、或另開一頁，需 Alan（或法務）拍板；但『必須公示』本身沒有選擇餘地。
- **改什麼**：

把 eligibleGames 的 'order_mystery_gift' 納入公示清單（新增一個區塊標題如『訂單神秘禮物』），沿用既有的 weight/totalWeight 算機率 + 列剩餘庫存的邏輯，價值欄沿用 :226 的 `p.estimatedValue ?? estimatePrizeValueTwd(p.prizeType, p.amount)`。同時在該頁註明『本活動保證有獎、獎池不含銘謝惠顧』。

### [20] 測試：evaluator 純函式測試 + 落地器測試 + 並行壓測腳本

- **檔案**：`src/lib/promotions/evaluator.test.mjs`（新增）
- **為何**：既有測試用不驗證的假 payload，讓 grant_reward 的致命 bug 躺了整段時間沒被發現。新功能的核心保證（保證有獎、不超發、不重複發）都是併發與邊界行為，單靠純函式測試涵蓋不到，必須有真 DB 的並行腳本。
- **改什麼**：

①evaluator.test.mjs（既有 52 個 assert）補：兩個新效果走 non-line 分支不被 no_eligible_lines 拒；budgetCostAmount 正確計算；成本為 null → reasonCode 'missing_cost_data' 且不出現在 applications；預算不足時 budget_exhausted（含 costAmount 的加總）；perUserLimit=1 第二次 per_user_limit_reached。
②新 paidRewardOrchestrator.test.mjs：保證有獎（獎池全被搶完 → 走 fallback）、絕不抽到 prizeType='none'、重複呼叫同一 orderId 只發一次、grantUserReward 一定帶 expiresAt 且 requiresPhysicalShipping 依 deliveryMethod 決定。**fakePayload 必須模擬必填驗證**（現行 rewardOrchestrator.test.mjs:77-88 的 stub 不驗，正是漏掉 expiresAt bug 的原因）。
③新 scripts/verify-p0b-drop.ts：對 dev DB 跑並行壓測（見 verification 清單）。

## 3. 成本模型

### giftItem

可算，而且已經在算——只是沒接到預算。來源 products.cost（Products.ts:939-950）/ variants[].costOverride（Products.ts:1318-1327），pricing.ts:203-209 已有取值優先序，pricing.ts:632-635 已把贈品行納入 itemsCost（註解明寫『贈品是實打實的成本，不能因為售價 0 就不算』），伺服器注入的贈品行也帶 unitCost（pricing.ts:563）。成本 = unitCostTwd × quantity，由 snapshots.ts 在建 rule snapshot 時查好餵進 effect.unitCostTwd。唯一缺口：Shopline 匯入商品只有 sourcing.costTWD、pricing.ts 不 fallback（步驟 17 修）。⚠️ 不可把成本寫進 discountAmount：pricing.ts:577-579 會把它加總成 promotionDiscount、orderPricingHook.ts:159 寫進 data.discountAmount 真的扣掉訂單金額 = 顧客白賺一筆折扣。

### pointsMultiplier

現在算不出可信的 NT$，但缺的東西小且明確。唯一設定 LoyaltySettings.pointsConfig.pointsToCurrencyRate（LoyaltySettings.ts:37，預設 100 點 = NT$1）全 repo 零讀取，是死欄位；程式裡唯一實作是 abuseDetection.ts:49 硬編碼 `amount * 1`，比設定值高估 100 倍。賺點側 Orders.ts:1079-1080 消費 NT$1 得 1 點，配上 100 點=NT$1 → 1 點真實成本 NT$0.01。增額 = basePoints × tier × 訂閱 × (campaignMultiplier − 1)，三個因子在 evaluator 階段拿不齊（Orders.ts:1102-1108 才算得出）。做法：下單時用 orderSubtotal × pointsPerDollar × (multiplier−1) / rate × costSafetyFactor(2.5) 保守高估預留，付款後 hook 用實際 pointsEarned 換算做差額修正（正負都要處理）。abuseDetection 那行先不改（會同時改變月度金額上限風控與公示頁對外揭露價值，需另立工單）。

### grantReward

現在完全算不出，缺口最大，是三者中唯一需要新增 schema 的。grant_reward 的 DSL（types.ts:117-124）只有 rewardKey/quantity/rewardType，沒有任何金額或 prize-pool 關聯；UserRewards 也沒有 NT$ 價值欄位（UserRewards.ts:104-110 的 amount 既是張數又是面額，:70 的 pointsCostSnapshot 是兌換花掉的點數不是獎項價值）；PrizePools.estimatedValue 存在（PrizePools.ts:296-303）但**選填**且與促銷引擎零連結——根因是 DrawnPrize 型別（gameEngine.ts:36-48）沒帶 estimatedValue，所以遊戲 API（api/games/route.ts:423）與月度上限（abuseDetection.ts:101）只用 estimatePrizeValueTwd()，而公示頁（games/terms/page.tsx:226）用 `estimatedValue ?? estimatePrizeValueTwd()`，兩種優先序不一致。做法（Mystery Gift）：步驟 9 給 PoolPrize/DrawnPrize 補 estimatedValue 並在 gameEngine.ts:326-340 映射，落地端用與公示頁一致的 `estimatedValue ?? estimatePrizeValueTwd()`；下單預留用獎池 max 值（保守），付款後抽完用實際值差額修正。⚠️ estimatePrizeValueTwd 的 coupon 分支 `Math.min(amount*100, 5000)` 與 free_shipping 固定 80 都是拍腦袋常數，拿來當預算扣款依據會嚴重失真，所以 Mystery Gift 獎池一律要求填 estimatedValue（業務層必填，不改 collection 的 required 以免影響既有 100+ 筆遊戲獎品）。Coupon Drop 的成本 = 券面額最大曝險（固定額券 = discountValue；百分比券 = maxDiscountAmount，沒設上限就是算不出）。

### failClosedRule

統一在 snapshots.ts（I/O 層）把算不出的成本填 null，由 evaluator 的 resolveEffectCost() 回 null 時 `reject(rule, ['missing_cost_data'])` 並 continue——沿用既有 ReasonCode（types.ts:270），不新增值。觸發條件：①gift_item 的贈品商品 cost/costOverride/sourcing.costTWD 三段 fallback 全空；②coupon_drop 的券是百分比折扣且沒有 maxDiscountAmount；③mystery_gift 的獎池中任一 active 獎品 estimatedValue 為空且 prizeType 不屬於可自動換算的 points/credit；④points_multiplier 讀不到 pointsToCurrencyRate 或該值 <= 0。語意 = 『不套用這條規則、不發獎、不扣預算、記 reason』，與工作單規定的『成本缺失時 fail closed：不套折扣並記錄 reason』完全一致，也與既有 8c 毛利底線的 missing_cost_data 行為（evaluator.ts:587-592）同一形狀。⚠️ 兩項配套缺一不可：(a) 步驟 5 在 PromotionRules.beforeValidate 就擋下算不出成本的規則，讓 admin 在存檔當下報錯而不是上線後靜默不發（本專案踩過最多次的坑類型）；(b) 步驟 17 先補 sourcing.costTWD fallback，否則 fail-closed 一上線會把所有 Shopline 匯入商品的贈品規則全部擋掉。另外 fail-closed 一律套用（不只在活動有 budgetCap 時），理由是成本算不出 = 毛利無法稽核，這是 fba19e4 那個 commit 的原始意圖。

## 4. 不可動（違反即回退）

- src/lib/promotions/pricing.ts:617 的 total 計算式與 :577-589 的 promotionDiscount/couponDiscount/memberDiscount 加總語意 —— 已上線的唯一價格權威，成本欄位絕不可流進這條式子
- src/lib/promotions/pricing.ts:632-635 的 itemsCost / costDataComplete 語意 —— 那是整車 COGS（含顧客付錢買的商品），不是活動贈品成本；直接拿來當 budgetSpent 語意錯得離譜。要新開 budgetCostAmount
- src/collections/Orders.ts:897 起的大 afterChange hook —— 新的付款後落地邏輯不可塞進去。它裡面在 grantIntentRewards(:1146) 之前還有 findByID(customers)、LoyaltySettings、customers.update、writePurchasePointsLedger，任一步 throw 就整段不執行（catch 在 :1300-1302）
- src/lib/promotions/evaluator.ts:269-348 的 computeEffect 與 :277 的 switch —— 五種既有折扣效果的計算完全不動；兩個新效果不產生折扣金額，根本不進 computeEffect
- src/lib/games/gameEngine.ts:348-364 的既有 decrementPoolInventory、:225 checkDailyPlays、:505 recordGamePlay、GAME_CONFIGS fallback 路徑 —— 遊戲已上線，新增原子版函式，不改既有行為（drawPrize 的第 4 參數是可選，既有 3 個呼叫端不傳 = 零行為變更）
- src/lib/games/abuseDetection.ts:43-61 的 estimatePrizeValueTwd 常數（尤其 `case 'points': return amount * 1`）—— 改它會同時改變 checkMonthlyValueCap 的風控門檻（縮 100 倍 = 放寬 100 倍）與 /games/terms 對外法規揭露的獎品價值，是合規面，需另立工單
- src/collections/Coupons.ts 的 schema —— Coupon Drop 沿用 redemptionEngine.ts:247-269 的『動態建 Coupons row + usageLimit:1』模式，不加 assignedTo 欄位。（但 Coupons.ts:30-36 的 access.read: () => true 讓個人化券碼公開可列舉，是既有洩漏，建議獨立工單處理，不要混進 P0-B）
- src/collections/CouponRedemptions.ts:44-57 的 usageCount read-modify-write —— 既有缺陷，但那是既有券流程的路徑；本次的限量走全新的 marketing_campaigns.commerce_drop_claimed，不要順手重構券的計數（會動到已上線結帳鏈）
- src/migrations/（SQLite 舊目錄）—— PG 不吃這個目錄，migrationDir 是 payload.config.ts:641 指定的 './src/migrations-pg'
- 結帳前端與 cart/checkout 檔案 —— 依 CLAUDE.md AUTOPILOT 規定，步驟 11 前僅 BP-002 外包可動；本次前台只新增唯讀狀態 API 與 CartCampaignProgress 文案
- src/payload-types.ts —— codegen 產物，一律跑 `pnpm payload generate:types`，手改會被蓋掉
- 任何 `payload.db.drizzle.run()` 寫法 —— PG 上沒有 run()，一律走 dialectSafeSql.runSql()（dialectSafeSql.ts:39-47）
- 不要在 ALTER TYPE ADD VALUE 的同一支 migration 內 seed 任何用到新 enum 值的資料 —— PG16 在同 transaction 內不可使用新值，migrate.js:94 是 process.exit(1)，部署當場硬死
- www / Shopline / DNS / 正式金流 —— 依 CLAUDE.md，觸及即停止並回報

## 5. 驗證清單（含負向案例）

- [ ] 【前置】步驟 1 的兩項實測必須先有結論：(a) 真 payload 跑 grantIntentRewards 是否因缺 expiresAt 被 ValidationError 擋下；(b) `SELECT count(*) FROM products WHERE cost IS NULL` 與 `WHERE cost IS NULL AND sourcing_cost_twd IS NOT NULL` 的數字。沒有這兩個數字不要開始寫 migration。
- [ ] 【正向】Coupon Drop 全鏈：登入會員下單 → 結帳成功 → 付款 callback 轉 paid → 收到券（Coupons row 存在、UserRewards 綁人、expiresAt 有值、requiresPhysicalShipping=false）→ promotion-drop-claims 一筆 status='granted' → marketing_campaigns.commerce_drop_claimed +1 → commerce_budget_spent 增加了券面額（不是 0）。
- [ ] 【正向】Mystery Gift 全鏈：同上，且抽到的獎 prizeType 絕不是 'none'（跑 200 次抽獎腳本統計）→ 若是限量獎則 prize_pools.inventory_remaining -1 → UserRewards 的 requiresPhysicalShipping 與 PrizePools.deliveryMethod 一致 → budgetSpent 用實際 estimatedValue 做了差額修正（與下單時的 max 值預留不同）。
- [ ] 【負向 · 超發】並行壓測：commerce_drop_total=10，用 30 個不同會員同時打結帳（Promise.all，非序列），驗證 commerce_drop_claimed 最終恰好 =10、promotion-drop-claims 恰好 10 筆、第 11 個之後全部收到 409『限量券已被領完』且沒有半筆 claim 殘留。**必須真的並行**，序列跑不出 race condition。
- [ ] 【負向 · 超發】Mystery Gift 限量獎壓測：某獎 inventory_remaining=1、其餘獎品移出獎池、fallbackPrizeSlug 指向一個 unlimited 保底獎，20 筆訂單同時轉 paid → 該獎恰好發出 1 份，其餘 19 筆全部拿到保底獎（**零筆無獎**，這是 Alan 需求 2 的硬驗證），inventory_remaining 不得為負。
- [ ] 【負向 · 重複發】同一張訂單重複觸發 paid（模擬 callback 重送，或直接 payload.update 兩次讓 paymentStatus 從 unpaid→paid→（其他欄位改動）paid）→ UserRewards 只有一筆、promotion-drop-claims 只有一筆、budgetSpent 只扣一次。
- [ ] 【負向 · 每人 1 次】同一會員對同一檔活動下第二張單 → 結帳當下就被擋（409 或該規則不套用），promotion-drop-claims 的 idempotencyKey UNIQUE 有觸發，且第一次扣掉的 quota 沒有被重複扣。
- [ ] 【負向 · 退款回沖】已發獎的訂單改 status='refunded' → commerce_drop_claimed -1、prize_pools.inventory_remaining +1（且不超過 inventory_total）、commerce_budget_spent 減掉 discountAmount+shippingDiscountAmount+budgetCostAmount（三項齊全）、UserRewards 失效、動態產生的 drop 券 isActive=false、claim status='reversed'。再改一次 refunded（重複觸發）不得重複回沖。
- [ ] 【負向 · fail closed】把贈品商品的 cost/costOverride/sourcing.costTWD 全清空 → 該規則在 quote API 的 rejections 出現 reasonCode 'missing_cost_data'、不出現在 applications、budgetSpent 零變動。同樣測：百分比券沒設 maxDiscountAmount 的 coupon_drop、獎池有獎品缺 estimatedValue 的 mystery_gift。
- [ ] 【負向 · 後台守門】在 PromotionRules 存一條 coupon_drop 規則但 dropCoupon 留空、或 perUserLimit 填 2、或 mystery_gift 的 fallbackPrizeSlug 指向一個 inventoryUnlimited=false 的獎 → 存檔當下就報錯，不是存進去後才靜默失效。
- [ ] 【回歸 · 靜默失效稽核】新增效果型別後跑一次對照：types.ts union 的 type 字面值 ∪ PromotionRules select options 的 value ∪ snapshots.ts switch 的 case ∪ PG enum_promotion_rules_effect_effect_type 的值，四者必須完全相等（寫成一支斷言腳本，不要人工比對）。這是 MEMORY 裡『PG select 欄位字面值系統性稽核』踩過的坑。
- [ ] 【回歸 · 既有效果不受影響】evaluator.test.mjs 既有 52 個 assert 全綠；額外驗證把三道護欄從 else 提出來共用後，free_shipping 規則在預算不足時變成優雅拒絕（reasonCode budget_exhausted）而不是下單時丟 409 —— 這是順手修掉的既有體驗問題，要確認方向對且沒讓原本能套的免運被誤拒。
- [ ] 【回歸 · 訪客】訪客結帳（guest-order）帶著 active 的 coupon_drop / mystery_gift 活動 → 訂單成立、不發獎、不扣 quota、但活動預算的折扣部分**有**被預留（確認 reserveCampaignBudgetAndQuota 在 local API 路徑真的被呼叫了，這是既有缺口的修補）。
- [ ] 【migration】在 dev PG 上依序跑 migration A → B，確認 A 單獨 commit（不與任何使用新值的語句同 transaction）；跑完 `pnpm payload generate:types` 後 tsc 全綠；確認 down() 的無解狀況已寫進註解且部署 runbook 有記；**不要假設 down 能跑**。
- [ ] 【運維】部署前後各查一次 `SELECT commerce_budget_spent, commerce_drop_claimed FROM marketing_campaigns WHERE id=<測試活動>` 與 `SELECT count(*) FROM promotion_drop_claims GROUP BY status`，作為對帳基線。部署用既有流程（fetch hetzner-local + reset --hard + SKIP_GIT_RESET=1 deploy-ckmu.sh），且 migrate 必須用 NODE_ENV=production 跑。

## 6. 待拍板 / 存疑（動手前先確認）

- 【需 Alan 拍板 · 最大的空白】Coupon Drop 的發放時點四份定位都沒有共識，Alan 的 5 項參數也沒指定。本規格拍板為『綁在訂單上、付款成功後發券（供下次使用）』，理由是可完全複用 evaluator/預算/回沖/冪等四套既有機制、不新增公開寫入端點。但『Coupon Drop』一般語意是『活動頁限量搶券』——若 Alan 要的是後者，步驟 10/12/13/15 要整段換成一支獨立的 POST 領取端點（沿用 guest-order 的限流參數 5 次/10 分），quota 與 claim 的設計則完全不變。這一項必須先確認再動手。
- 【需 Alan 拍板】退款後是否恢復領取資格。本規格選擇『不恢復』（claim 保留、只標 reversed），否則『下單→退款→再領』可無限刷。若 Alan 要恢復，改成刪除 claim，但要接受刷單漏洞。
- 【證據不足 · 高信心未實機驗證】grantIntentRewards 因缺 expiresAt 而『目前完全發不出獎』是推論（rewardOrchestrator.ts:91-105 的 create data 沒有 expiresAt，UserRewards.ts:160-169 required:true 且無 defaultValue/無 beforeChange 補值，錯誤被 :107-114 catch 吞掉，測試 stub 不驗證）。步驟 1 要求先實測。若假設錯誤（例如 Payload 對 date required 有隱式行為），步驟 11 的優先序可降。
- 【表面矛盾 · 實為語意不同】cost-model 說『贈品成本已經在算』（pricing.ts:634 的 itemsCost 含贈品行），dsl-plumbing 說『三種效果成本完全不進預算』。兩者都對：itemsCost 是整車 COGS 快照（Orders.promotion.itemsCostSnapshot，有寫入端零讀取端），budgetSpent 是活動預算，兩者語意不同、不可互相替代。實作時最容易誤用 itemsCostSnapshot 當活動成本。
- 【證據不足】PrizePools.prizeType 有 8 種（PrizePools.ts:74-83），但 gameEngine.ts:12 的 PrizeType 只宣告 4 種（points/credit/coupon/none），loadPoolPrizes:332 用 `(r.prizeType as PrizeType)` 硬轉——型別是騙人的，執行期會拿到那 4 種以外的值。tsc 不會擋，但任何對 DrawnPrize.type 做 exhaustive switch 的新程式都會漏掉 movie_ticket/free_shipping/physical_gift/badge。建議順手把 PrizeType 補成 8 種，但這會讓既有遊戲程式碼冒出新的 tsc 錯誤，範圍要先評估。
- 【需確認】UserRewards.state 是否為 PG enum、有沒有 'revoked' 值。步驟 14 的回沖需要一個『作廢』狀態；本規格保守選用既有的 'expired' + 把 expiresAt 設成 now，避免多一支 ALTER TYPE ADD VALUE。若 state 其實是 text 或已有 revoked，改用語意更準的值。（未讀 UserRewards 的 PG 定義，標為不確定。）
- 【需確認 · 法規面】Mystery Gift 不是『遊戲』，但依消保法/公平會規範贈獎活動要公示機率與獎項價值。本規格把它塞進 /games/terms（沿用既有自動算機率的邏輯），但這頁標題與脈絡是遊戲。要不要另開一頁、文案怎麼寫，需 Alan 或法務拍板。『必須公示』本身沒有選擇餘地。
- 【既有洩漏 · 建議另立工單】Coupons.ts:30-36 的 access.read = () => true 讓 redemptionEngine 動態產生的個人券碼（CKMU-RDM-*）目前可被任何人分頁列舉並搶用（usageLimit:1 是先搶先贏，不綁人）。Coupon Drop 若沿用同一模式會擴大這個面。本規格靠 UserRewards 綁人 + claim 表擋『每人 1 次』，但券碼本身仍公開。建議在 P0-B 收尾前一併把 Coupons.read 收斂成不可列舉，但那會動到已上線的前台驗券路徑，需獨立驗證。
- 【設計取捨 · 已知代價】quota 計數掛在 marketing_campaigns（新增兩欄）而非新建 quota 表，代價是『一檔活動只能有一條限量 drop 規則』（已在 beforeValidate 擋住）。換來的是完全複用 orderPricingHook.ts:128-138 的既有原子 UPDATE 樣板與同一張表、少一次 CREATE TABLE。若之後需要一檔多池，要再開一張 promotion_quotas 表。
- 【已知不精確】points_multiplier 的下單預留用 costSafetyFactor=2.5 保守高估（涵蓋 tier 1.5x × 訂閱 1.5x），付款後再差額修正。這意味著預算在下單到付款之間會被過度佔用，高流量時可能提早觸發 budget_exhausted 拒絕後續訂單。偏商家安全但顧客會看到『活動預算已用完』。若 Alan 不接受，替代方案是點數倍率成本只在付款後扣（但那時已無法擋單，可能超支）。
