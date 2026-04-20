# CHIC KIM & MIU — 90 天回購 Drip 腳本（封測期）

> **這份文件的用途**：當封測期第一位客戶完成首購，主理人可以照著這份腳本，
> 在 Day 0 → Day 90 的 10 個觸點依序接觸該客戶，把「90 天回購率」這個 LTV
> 最強預測指標從 0 拉到 25–35% 的 fashion 行業基準。
>
> **當下定位**：純內容／策略。不碰 code。未來工程介面包括 Payload
> `message-templates` collection、`automation-journeys` collection、`/admin/repeat-purchase`
> 儀表板 actionable list — 所有節點的 templateSlug 與 phase 已對齊方便後續自動化。

---

## TL;DR

| # | 天 | 階段 | 管道 | 目的 | 目前可執行？ |
|---|----|------|------|------|--------------|
| 0 | D0 | Delight | Email（已通）+ 包裹 | 訂單確認 + 手寫卡 | ✅ 現在就能做 |
| 1 | D3 | Delight | LINE push | 收貨 + 保養/穿搭說明 | ✅ 手工 LINE |
| 2 | D7 | Delight | LINE push | 邀入封測 LINE 群 + 元老徽章 | ✅ 手工 LINE |
| 3 | D14 | Delight | LINE + 點數 50 | 尺寸/版型回饋問卷 | ✅ 手工 LINE |
| 4 | D21 | Discovery | LINE DM + 購物金 100 | UGC 穿搭照邀請 | ✅ 手工 LINE |
| 5 | D30 | Discovery | LINE + Email（需 SMTP） | 個人化新品 push | 🟡 LINE OK、Email 等 (b) |
| 6 | D45 | Discovery | LINE | Wishlist 補貨 + 免運門檻 | ✅ 手工 LINE |
| 7 | D60 | Conversion | LINE + Email | 等級升級 + 點數到期 | 🟡 LINE OK、Email 等 (b) |
| 8 | D75 | Conversion | LINE + Email + 券 | 第二次購買專屬券（PR #64） | ✅ 券系統已通 |
| 9 | D90 | Conversion/Reactivation | LINE + 主理人親信 | 生日/星座加碼 or Win-back | ✅ 手工 LINE |

**解讀**：D0、D3、D7、D14、D21、D45、D75、D90 **現在全部能手工做**。D30、D60 的 Email 管道要等 (b) SMTP
接上才能自動化；LINE 版本隨時能發。

---

## 設計原則

1. **前段不賣，後段才賣** — Day 0–21 純關係建立，Day 30 開始引導，Day 45 才有第一個隱性轉換訊號，Day 60 才正式觸發。**太早推折扣 = 把新客訓練成等折扣才買的低 LTV 客戶**。
2. **個人化勝過量化** — 一封「根據你第一次買的米白色針織衫，幫你配了同色系的裙子」勝過十封「新品上市！」。所有節點 copy 都要有 token（`{{first_product_name}}`、`{{first_product_category}}`、`{{tier_front_name}}`、`{{tier_gift_points}}`、`{{next_tier_threshold_ntd}}` 等）。
3. **管道分工** — LINE 做「親密／即時／貼身」觸點（D3/D7/D14/D21/D45），Email/EDM 做「資訊密度高／可保存」內容（D30 新品 push、D60 升級誘因、D75 券）。不要用 Email 發 D3 的「收到了嗎？」，也不要用 LINE 發 D30 的 10 款新品 lookbook。
4. **封測期手工 > 自動化** — <100 首購人的規模，主理人親自發 LINE 的回覆率會是自動化 drip 的 5–10 倍。**這份腳本是給主理人每天開 `/admin/repeat-purchase` → 看 Delight tab → 照文案發 LINE 用的**。等 AOV 穩定、封測結束再抽成 automation-journeys。
5. **失敗優雅** — 沒回應的客戶不是生氣，大多是忙。同一節點不要發兩次，但後續節點不要停。
6. **品牌承諾：優雅不打擾** — 整個 drip 全程不超過 10 個主動訊息，低於業界 fashion drip 的 15–20 個。頻率克制是品牌差異化。

---

## 品牌聲線 11 條（所有節點 copy 必守）

1. **對象稱呼**：會員 > 客戶 > 您（第二順位）。避免「親愛的」「寶寶」「小仙女」等溫度過高詞。
2. **簽名統一**：`— 翩翩｜CHIC KIM & MIU 主理人` 或 `— CHIC KIM & MIU 客服小編`（依節點誰發）。
3. **稱號性別化**：提及會員等級時走 `frontNameMale` fallback `frontName`（男會員：溫雅學者、雋永騎士；女會員：翩翩紳士對女名等）— 呼叫 `pickTierName(user.gender, tier)` 的結果塞 token。
4. **單句長度**：LINE ≤ 25 字；Email 主旨 ≤ 20 字（避免 iPhone 行動裝置截字）。
5. **emoji 克制**：整個 drip 9 個 emoji 總額度，以主體為準 — ✨ 🌿 💌 🤍 🎁 🗞 🔁 🌸 🏷️。不要混用花哨系（🎉🥳🔥）。
6. **不用「折扣」、「特價」、「便宜」**：用「會員禮遇」、「封測元老專屬」、「回禮」替代。
7. **CTA 動詞**：「看看」「留言告訴我們」「輕點打開」 > 「立即購買」、「趕快搶」。
8. **價格**：用 `NT$` + 千分位逗號（`NT$ 1,280`），不用 `$`、`元`。
9. **時間語**：用「這週」、「月底前」，避免「48 小時限定」、「倒數」的緊迫感行銷。
10. **未命中個人化 token**：退回「這一季」「我們精選」的中性 fallback，**絕不出現 `{{first_product_name}}` 或 `null` 穿幫**。
11. **錯字／漏字零容忍**：封測期所有模板主理人親自審一次；日後 automation 前加 QA checklist。

---

## 3 段式框架對照

```
 D0 ─ D14  Delight    — 消除買後焦慮、建立歸屬感。不賣。
 D15 ─ D45  Discovery — 養渴望、養回訪。還沒到下單時機，但開始引導相關商品。
 D46 ─ D90  Conversion — 扣板機：等級升級、點數到期、第二次券、生日禮。

 > D90       Reactivation — 出腳本範圍。進 winback 流（另寫）。
```

`/admin/repeat-purchase` 儀表板的 4 段 tab 與此對齊：`d0_14 / d15_45 / d46_90 / beyond_90`。主理人每日開 tab 找目標客戶，照對應節點文案發訊。

---

## Day-by-day 節點腳本

下列每個節點固定 9 項欄位：**目的 / 觸發 / 停止條件 / 管道 / 主旨或標題 / 內文草稿 / CTA / 成功指標 / A/B 建議**。
每節點尾附 `templateSlug`（未來 seed 進 `message-templates` collection 用）。

---

### Day 0 — 訂單確認 `ckmu-retention-d0-order-confirmation`

- **目的**：把「交易成立」的焦慮立刻清掉。設定期待（出貨時程、運送夥伴）。不是行銷 — 是基礎信任。
- **觸發**：`orders.paymentStatus` 變成 `paid`（已在 Orders.ts afterChange hook 觸發 `sendOrderConfirmationEmail`）。
- **停止**：訂單取消／退款 — 改寄取消通知（另腳本）。
- **管道**：Email（已上線，`src/lib/email/orderConfirmation.ts`）+ 包裹內**手寫感謝卡**（封測規模做得到）。
- **主旨**：`訂單 {{orderNumber}} 已確認 — 感謝您`
- **內文草稿**（Email）：

> {{customerName}}，您好
>
> 我們收到您的訂單 **{{orderNumber}}**，非常感謝您在封測期間加入 CHIC KIM & MIU。
>
> 我們的同事正在為您包裝商品，預計在 **{{estimatedShipDate}}** 之前交給物流。出貨後您會收到含追蹤號碼的通知。
>
> — 訂單明細 —
> {{itemsTable}}
> 商品小計 NT$ {{subtotal}}　運費 NT$ {{shippingFee}}
> **應付總額 NT$ {{total}}**
>
> 如果您對這筆訂單有任何疑問，隨時可以在 LINE（@ckmu）或 email（service@chickimmiu.com）找我們。
>
> — 翩翩｜CHIC KIM & MIU 主理人
>
> _P.S. 包裹裡會有一張小卡，那是我親手寫的。_

- **內文草稿**（手寫卡內容，每張 2-3 句）：

> 謝謝您選了 CHIC KIM & MIU。
> 您選的 {{first_product_name}} 是我們自己也很喜歡的一件。
> 穿得開心，有任何想法都想聽。
> — 翩翩 🤍

- **CTA**：無主動 CTA（這封信是**建立信任**，不是導流）。被動 CTA：LINE ID、客服 email。
- **成功指標**：Email open rate ≥ 65%（transactional benchmark）。
- **A/B 建議**：封測期 N 太小不做 A/B。先把基準拉起來。

---

### Day 3 — 收貨確認 + 商品保養 `ckmu-retention-d3-arrival-care`

- **目的**：確認商品安全送達；沒收到的立刻介入。同步給**第一份「有價值的非促銷內容」**（保養／穿搭指南），建立「這個品牌不只會賣東西」的印象。
- **觸發**：`orders.status === 'delivered'` 後 1 天；或 `orders.status === 'shipped'` 後 3 天（取先發生者）。封測期手工：主理人每日掃 Delight tab，挑 D3 左右的發。
- **停止**：已回覆「有問題」已進客服流程；或該會員已有 2nd paid order（升級到 Discovery 流）。
- **管道**：LINE push（主管道，封測已通）。
- **標題**：`{{customerName}}，{{first_product_name}} 還好嗎？`
- **內文草稿**（LINE）：

> 您好 ✨
>
> 看系統您的 {{first_product_name}} 在 {{deliveryDate}} 送到了，穿起來還喜歡嗎？
>
> 這裡附上它的保養小抄，讓它陪您更久：
> 🌿 {{careTip1}}
> 🌿 {{careTip2}}
> 🌿 {{careTip3}}
>
> 如果哪裡不合身、色差明顯或有任何瑕疵，現在告訴我最快處理。
>
> — 翩翩｜CHIC KIM & MIU

> 💡 **token 資料源**：`careTipN` 從 Products.careInstructions 拆解；若無，用品類通用 fallback（針織：冷水手洗、平攤陰乾、避免陽光；雪紡：分開洗、低溫熨燙…）。

- **CTA**：被動。客戶回覆「還好」「很喜歡」本身就是 winning signal；回覆「有問題」立刻手工介入。
- **成功指標**：LINE push delivery ≥ 95%；回覆率 ≥ 20%（封測期親切感）。
- **A/B 建議**：保養抄 vs 穿搭抄二選一 — 實驗哪個回覆率高。

---

### Day 7 — 封測 LINE 社群邀請 + 元老徽章 `ckmu-retention-d7-beta-community`

- **目的**：從「單點購買者」升級為「品牌社群成員」。封測期獨有的優勢：只有這群人進得了群，這本身就是 status。
- **觸發**：Day 3 訊息發出後 +4 天（或 Day 7 一起排）。
- **停止**：客戶已拒絕加入群；客戶已 unsub。
- **管道**：LINE push。
- **標題**：`您是我們的封測元老 🌿`
- **內文草稿**：

> {{customerName}}
>
> 想邀請您加入「CHIC KIM & MIU 封測元老」LINE 群 — 裡面只有 100 位不到的創始會員：
>
> • 新品上架前 48 小時先預告（封測元老專屬）
> • 尺寸／版型第一手討論（我們穿過、您也穿過）
> • 每週一晚 9 點「主理人上線時段」— 我親自回訊
>
> 進群連結：{{betaLineGroupUrl}}
>
> 加入後，您的會員頁會出現「🌸 封測元老」徽章 — 之後也會有實體週年禮。
>
> — 翩翩

- **CTA**：點連結加入 LINE 群。
- **成功指標**：進群率 ≥ 35%（封測期高意圖基底）。
- **A/B 建議**：第一句 hook，「封測元老」身份牌 vs 「主理人上線時段」獨家內容 — 哪個 pull 更強。
- **工程依賴**：「🌸 封測元老」徽章需在 Users collection 加 badge 欄位（或沿用 Treasure Box）+ 前台 /account 顯示。MVP 版可先不做徽章，只發 LINE 訊息。

---

### Day 14 — 尺寸／版型回饋問卷 `ckmu-retention-d14-size-feedback`

- **目的**：取得「客戶對商品實穿感受」的第一手資料 — 是之後**個人化推薦的黃金 token**。交換誘因是 50 點（≈ NT$ 50 等值）。
- **觸發**：Day 7 發出後 +7 天；或首購後 14 天（取先發生者）。
- **停止**：已 2nd paid order；已退貨流程中。
- **管道**：LINE push → 表單連結（Google Form 或 Tally，封測期 MVP）；未來轉 `/account/feedback`。
- **標題**：`{{customerName}}，花 2 分鐘幫我們？`
- **內文草稿**：

> {{customerName}}
>
> 想聽聽您對 {{first_product_name}} 的實穿感受 — 3 題，2 分鐘：
> 1. 版型合不合身（偏小／剛好／偏大）
> 2. 布料手感符不符合您預期
> 3. 穿出門的場合／會不會再買類似款
>
> 填完送您 **50 點**，1 點折 NT$ 1，購物結帳時自動抵。
>
> 連結：{{feedbackFormUrl}}
>
> 您的答案會幫我們選品更準 — 下次您進站看到的推薦都會更像您。
>
> — 翩翩

- **CTA**：填表單。
- **成功指標**：完成率 ≥ 30%；每筆至少 1 題開放式文字（質性資料比量化更值錢）。
- **A/B 建議**：誘因測試 — 50 點 vs 購物金 NT$ 30 vs 未來 8 折券（三擇一）。
- **工程 follow-up**：MVP 用 Google Form；之後做 `/account/feedback` 內嵌收 → 寫回 `users.preferences.sizeFitFeedback` + `orders.fitFeedback`。

---

### Day 21 — UGC 穿搭照邀請 `ckmu-retention-d21-ugc-invite`

- **目的**：讓客戶從「購買」升級到「共創」。被品牌官方 repost 的客戶複購率比未 UGC 客戶高 2.5×（Vogue Business 2024）。情感綁定最強。
- **觸發**：Day 14 發出後 +7 天。
- **停止**：已 2nd paid order（進另外的 VIP UGC 流）；已拒絕。
- **管道**：LINE DM（**個人對個人**語氣，非群發感）。
- **標題**：`想把您穿 {{first_product_name}} 的樣子放上 IG`
- **內文草稿**：

> {{customerName}}
>
> 冒昧問一句：方便拍一張您穿 {{first_product_name}} 的照片傳給我嗎？
> 不用很精緻，用手機、在家、隨意抓一張都可以。
>
> 如果您願意授權，我會在我們的 IG（@chickimmiu）repost，並附您的 IG @。
> 當作回禮，會送您 **購物金 NT$ 100**（可直接折抵下一次結帳）。
>
> 如果覺得鏡頭前不自在，完全不勉強 — 這是邀請不是作業 🤍
>
> — 翩翩

- **CTA**：傳照片到 LINE。
- **成功指標**：照片回傳率 ≥ 15%（一般電商 UGC 邀請平均 3-8%，封測溫度應高）。
- **A/B 建議**：誘因「購物金 100」vs「限量手機殼／托特袋」— 實物 vs 虛擬的 pull 比較。
- **後續流程**：收到照片 → 主理人審 → 徵詢授權 → 排進 IG 發文 → 發購物金 → 客戶被 tag 後會自動分享給朋友（免費擴散）。

---

### Day 30 — 個人化新品 push `ckmu-retention-d30-new-arrivals`

- **目的**：第一次**引導式回訪**。不是賣，是「有符合您上次喜好的新東西」。這是整個 drip 中資訊密度最高的一封，適合 Email/EDM 而非 LINE。
- **觸發**：首購 +30 天；或 Day 21 發出後 +9 天。
- **停止**：已 2nd paid order；已 unsub 行銷通訊。
- **管道**：Email（需 (b) SMTP）+ LINE 一句 teaser 導流。
- **主旨**：`{{customerName}}，這週我們上架了一些您可能喜歡的`
- **Email 內文草稿**：

> {{customerName}}
>
> 您上次買的是 {{first_product_category}}（{{first_product_name}}），這週我們的新品有 5 件跟它搭起來會好看：
>
> [3-5 個商品卡 — 圖 + 名 + 價 + 一句搭配語]
> 1. {{product1.name}} — NT$ {{product1.price}}
>    _「跟您的 {{first_product_name}} 同色系，可以疊穿也可以單穿」_
> 2. {{product2.name}} — NT$ {{product2.price}}
>    _「同一個版型師設計，剪裁相似」_
> [ ... ]
>
> 想先看預覽請用這個連結：{{personalizedCatalogUrl}}
>
> — 翩翩｜CHIC KIM & MIU

- **LINE teaser**（同日發）：

> {{customerName}} 這週新品有 5 件跟您上次買的 {{first_product_name}} 特別搭：
> {{personalizedCatalogUrl}}

- **CTA**：點連結逛商品列表（**不是直接買**）。
- **成功指標**：Email open ≥ 35%、click ≥ 12%；LINE click ≥ 18%。
- **A/B 建議**：主旨「這週上架的 5 件」vs 「想到您就為您留下來了」— 資訊 vs 情感。
- **工程依賴**：推薦引擎要能輸出「基於 user 首購的 category+color 的 5 個新 SKU」— `src/globals/RecommendationSettings.ts` 已有設定檔，Query 邏輯要實作。MVP 可以暫時主理人手工挑 5 個放模板。

---

### Day 45 — Wishlist 補貨 + 免運門檻 `ckmu-retention-d45-wishlist-nudge`

- **目的**：第一次**隱性轉換訊號**。靠兩個心理觸發：(1) 已收藏的缺貨品補貨 = 稀缺性；(2) 免運門檻差額誘導加購。不打折。
- **觸發**：首購 +45 天；AND (有 wishlist 項目補貨 OR 最接近免運門檻的加購值 ≤ NT$ 500)。
- **停止**：已 2nd paid order；已無有效 wishlist 且距離免運門檻 > NT$ 500。
- **管道**：LINE push。
- **標題**：依觸發分支
  - Wishlist 補貨：`{{wishlistItem.name}} 回來了 🏷️`
  - 免運誘導：`再 NT$ {{needed}} 就免運喔`
- **內文草稿**（Wishlist 補貨分支）：

> {{customerName}}
>
> 您之前收藏的 **{{wishlistItem.name}}** 剛補到貨：
>
> • 現貨尺寸：{{availableSizes}}
> • 顏色：{{availableColors}}
> • 上次賣完的速度約 {{historicalSelloutDays}} 天
>
> 要搶在賣完之前？{{productUrl}}
>
> — 翩翩

- **內文草稿**（免運誘導分支）：

> {{customerName}}
>
> 您的購物車還有 {{cartItems}}（總 NT$ {{cartTotal}}）— 再加 NT$ {{needed}} 就達免運門檻 NT$ {{freeShippingThreshold}}。
>
> 建議可以配這些（都是 NT$ {{needed}} 左右）：
> [2-3 個商品卡]
>
> 直接結帳：{{checkoutUrl}}
>
> — 翩翩

- **CTA**：點連結進商品／購物車。
- **成功指標**：CTR ≥ 25%；轉單率 ≥ 8%。
- **A/B 建議**：僅發 wishlist 補貨 vs wishlist + 免運雙訊號（看哪個不會太打擾）。
- **工程依賴**：Wishlist collection `/src/collections/UGCPosts.ts` 實際要 check 是否有 Wishlist 欄位；補貨判斷 = `products.stock` 由 0 → >0 的 transition（Products afterChange hook 可發事件）。

---

### Day 60 — 等級升級誘因 + 點數到期提醒 `ckmu-retention-d60-tier-points`

- **目的**：封測期第一次**正式轉換訊號**。兩個訊號綁在一起：(1) 「再消費 $XXX 升一等解鎖 XX% 折扣／每筆 XX 倍點數」；(2) 「您有 XX 點將在 XXX 天後到期」。前者是誘因，後者是稀缺。
- **觸發**：首購 +60 天；AND （距離下一等的 threshold ≤ 當前客單價的 1.5 倍 OR 有 ≥ 30 天內到期的點數）。
- **停止**：已 2nd paid order；已達頂級等級 + 無到期點數。
- **管道**：LINE push（短版）+ Email（長版、需 SMTP）。
- **LINE 標題**：`離 {{next_tier_front_name}} 只差 NT$ {{threshold_needed}}`
- **LINE 內文草稿**：

> {{customerName}}
>
> 您目前是 **{{current_tier_front_name}}**，再消費 NT$ {{threshold_needed}} 就能升級到 **{{next_tier_front_name}}** — 解鎖：
>
> 🎁 升級即贈 {{tier_gift_points}} 點
> 🏷️ 每筆訂單 {{next_tier_multiplier}}× 點數
> 🌸 {{next_tier_exclusive_benefit}}
>
> {{#if expiring_points}}
> 順帶提醒：您有 **{{expiring_points}} 點**將在 {{expiring_date}} 到期，記得用掉。
> {{/if}}
>
> 逛逛：{{storeUrl}}
>
> — 翩翩

- **Email 內文**：同 LINE 但加入「升等門檻換算表」（current tier benefits vs next tier benefits 對照），以及搭配本季新品視覺 lookbook。
- **CTA**：點連結逛商品。
- **成功指標**：CTR ≥ 22%；轉單率 ≥ 10%。
- **A/B 建議**：純升等誘因 vs 升等 + 點數到期 組合 — 驗證兩個信號疊加會不會 overload。
- **工程依賴**：
  - `pickTierName(user.gender, tier)` 取用 `frontNameMale` fallback `frontName`（已實作於 Phase 5.5 memory）。
  - 計算 `threshold_needed` = 下一等 threshold - `users.annualSpend`。tierEngine 已有 `TIER_LEVELS`；加 `getNextTierThreshold(tierSlug)` helper。
  - `expiring_points` 查 `points-transactions` 30 天內到期餘額（`/account/points` 5.5.4 的 FIFO 邏輯可重用）。

---

### Day 75 — 第二次購買專屬券 `ckmu-retention-d75-second-order-coupon`

- **目的**：臨門一腳。時間有限、條件客製、敘事包裝成「封測老朋友禮遇」而非「拜託快買」。
- **觸發**：首購 +75 天；未 2nd paid order；有效券系統（PR #64 Coupons 已合併）。
- **停止**：已 2nd paid order；已 unsub；已領取過本券（Coupons 有防重發）。
- **管道**：LINE（通知 + 券碼）+ Email（同內容，長版+ lookbook）。
- **管道優先**：LINE 先發；未點擊 72 小時再發 Email reminder。
- **LINE 標題**：`一張專屬您的券，14 天內有效 💌`
- **LINE 內文草稿**：

> {{customerName}}
>
> 您成為 CHIC KIM & MIU 會員已經 75 天了 — 感謝陪我們過封測期。
>
> 做了一張 **{{coupon_code}}** 送您：
>
> 🏷️ 滿 NT$ 1,000 折 NT$ 150（或 {{coupon_discount}}）
> 🌸 只能用於第二次訂單（您這是第一張券）
> ⏳ {{coupon_expiry_date}} 前有效（14 天）
>
> 結帳時貼上代碼自動折抵：{{storeUrl}}
>
> 我們最近有幾件特別想推薦給您的：{{personalizedCatalogUrl}}
>
> — 翩翩

- **Email 版**：同內文 + 展示「券可配這些商品」的 4-6 個商品區塊 + 券券面視覺（可作為截圖存在 LINE album 裡）。
- **CTA**：結帳時用券碼。
- **成功指標**：券領取率 ≥ 45%；使用率（領取→成交）≥ 20%；整體 D75→D90 轉單貢獻 ≥ 8% 絕對值拉升。
- **A/B 建議**：折抵形式 —「滿 NT$ 1,000 折 NT$ 150（15%）」vs「9 折全館」vs「NT$ 200 購物金」。同樣 NT$ 預算下哪個轉化最高。
- **工程依賴**：`Coupons` 發券 API + `coupon_redemptions` 追蹤。客戶端 UI 的券輸入區已於 PR #64 通。可以直接用。

---

### Day 90 — 生日/星座加碼 OR 主理人親信（反 churn）`ckmu-retention-d90-birthday-or-winback`

- **目的**：最後一次機會。根據條件分兩條路：
  - **A 路徑**：客戶生日月或星座月落在 D75–D105 → 生日禮／星座月特典加碼（迭加 D75 的券，並給額外 100 點）。
  - **B 路徑**：沒有生日條件 → 主理人親筆風格的**個人信**。從 IP/地理、首購品類、點過的商品衍生一兩句真人 insight。這封 **最不自動、最有溫度** 的訊息是反 churn 最後一擊。
- **觸發**：首購 +90 天；未 2nd paid order。
- **停止**：已 2nd paid order。
- **管道**：A 路徑 LINE + Email；B 路徑 LINE（主理人帳號親發）。
- **A 路徑標題**：`{{birthday_or_zodiac_label}}，有件事想告訴您 🌸`
- **A 路徑內文**：

> {{customerName}}
>
> 這個月是您的 {{birthday_or_zodiac_label}}（{{match_type: "生日月" | "星座月" "{{zodiac_name}}"}}），我們想多送您兩樣：
>
> 🎁 **100 點**已入帳（1 點折 NT$ 1，結帳自動抵）
> 🏷️ 券 {{coupon_code}}（滿 NT$ 1,500 折 NT$ 300，可與 D75 的券疊加）
>
> 點數明細：{{pointsPageUrl}}
>
> 這個月特別想推薦給 {{zodiac_name}} 的：{{zodiacCuratedCollectionUrl}}
>
> — 翩翩
>
> _P.S. 您的 D75 券 `{{previous_coupon_code}}` 還剩 {{days_left}} 天，兩張一起用最划算。_

- **B 路徑標題**：`冒昧打擾 — 想問一下`
- **B 路徑內文**（LINE，主理人帳號發）：

> {{customerName}}
>
> 是翩翩。打擾了。
>
> 翻到您三個月前買的那張訂單 {{orderNumber}} — 您選的 {{first_product_name}} 我到現在都還記得當時封測期第一批出貨有這件。
>
> 沒有要推您什麼。就是想問：
> {{personalInsightQuestion}}
> _（範例：「那件 {{first_product_name}} 穿得順手嗎？」「您上次點過 XX 兩次沒買，是尺寸問題還是價格？」「有沒有想看、但我們還沒進的品類？」）_
>
> 想到我，隨時回 LINE。
>
> — 翩翩

- **CTA**：A 路徑 — 點連結領禮；B 路徑 — 被動（回覆本身就是 winning）。
- **成功指標**：
  - A 路徑：券領取率 ≥ 55%（生日加碼本來就高）；使用率 ≥ 30%。
  - B 路徑：回覆率 ≥ 25%（只要有回覆就有 insight，未來一對一可延續）。
- **A/B 建議**：A 路徑不做 A/B（生日是 N-of-1）；B 路徑 開頭第一句「冒昧打擾」vs「突然想到您」— 測哪個降防備。
- **風險控制**：B 路徑**一定要主理人親自發**。不要用 automation-journeys 自動發「個人信」模板 — 假感被拆穿的破壞力會比不發還大。

---

## 統一停止條件（所有節點共用）

任一條件觸發 → 中止 drip 剩餘所有節點（D 當前 + 之後）：

1. **客戶 2nd paid order** — 升級成 repeat buyer，進 post-purchase VIP 流（另腳本）。
2. **客戶 unsubscribe marketing** — 只保留 Day 0 transactional，其餘全停。
3. **進行中退貨／客訴** — 全停，交由客服介入；結案後視情況重啟 D45 以後節點。
4. **帳號刪除／封鎖** — 全停。
5. **重複 bounce 3 次**（email hard bounce / LINE block） — 該管道全停；換管道（LINE block → email；email bounce → 主理人手工 SMS 或放棄）。

---

## 品牌聲線測試題（每份新 copy 必過）

下列 5 題每題都要答「是」才能發送：

- [ ] 第一句主詞不是「我們」或「CHIC KIM & MIU」
- [ ] 沒出現「立即」、「馬上」、「搶」、「限時」、「倒數」
- [ ] 至少有一個個人化 token 或具體細節（商品名／購買日／品類）
- [ ] 用零個或至多兩個 emoji，都在 brand emoji allowlist
- [ ] 結尾署名統一（— 翩翩｜CHIC KIM & MIU 主理人 或 — CHIC KIM & MIU 客服小編）

---

## 每節點 → templateSlug → channel → category 對照表

未來 seed `message-templates` collection 用：

| Slug | Channel | Category | Subject/Title |
|------|---------|----------|---------------|
| `ckmu-retention-d0-order-confirmation` | email | transactional | 訂單 {{orderNumber}} 已確認 |
| `ckmu-retention-d3-arrival-care` | line | lifecycle | {{customerName}}，{{first_product_name}} 還好嗎？ |
| `ckmu-retention-d7-beta-community` | line | lifecycle | 您是我們的封測元老 🌿 |
| `ckmu-retention-d14-size-feedback` | line | lifecycle | {{customerName}}，花 2 分鐘幫我們？ |
| `ckmu-retention-d21-ugc-invite` | line | lifecycle | 想把您穿 {{first_product_name}} 的樣子放上 IG |
| `ckmu-retention-d30-new-arrivals` | email | lifecycle | {{customerName}}，這週我們上架了一些您可能喜歡的 |
| `ckmu-retention-d30-new-arrivals-teaser` | line | lifecycle | {{customerName}} 這週新品有 5 件特別搭 |
| `ckmu-retention-d45-wishlist-nudge-restock` | line | lifecycle | {{wishlistItem.name}} 回來了 🏷️ |
| `ckmu-retention-d45-wishlist-nudge-shipping` | line | lifecycle | 再 NT$ {{needed}} 就免運喔 |
| `ckmu-retention-d60-tier-upgrade` | line | tier_upgrade | 離 {{next_tier_front_name}} 只差 NT$ {{threshold_needed}} |
| `ckmu-retention-d60-tier-upgrade-email` | email | tier_upgrade | — 同上，長版 |
| `ckmu-retention-d75-second-order-coupon` | line | promotional | 一張專屬您的券，14 天內有效 💌 |
| `ckmu-retention-d75-second-order-coupon-email` | email | promotional | — 同上，長版 |
| `ckmu-retention-d90-birthday-boost` | line | lifecycle | {{birthday_or_zodiac_label}}，有件事想告訴您 🌸 |
| `ckmu-retention-d90-winback-personal` | line | winback | 冒昧打擾 — 想問一下 |

---

## 後續實作優先順序（建議）

按 ROI × 工程成本算：

1. **馬上做（0 code）**：主理人每日開 `/admin/repeat-purchase` → 把當日 D3/D7/D14/D21 客戶用本腳本手工發 LINE。
2. **(b) SMTP 接起來**（下一個工程項目）：解鎖 D30、D60、D75 的 Email 版本 + 解封 `/forgot-password` 已存在缺口。
3. **Seed `message-templates`**：把本腳本 15 個 templateSlug 的 copy 先 seed 進 collection。UI 上主理人可以直接編輯、不用改 code。
4. **`automation-journeys` seed 4 條**：Delight / Discovery / Conversion / Reactivation（對應 phase），每條綁 D 觸發點、讀 template by slug、發訊息。用 `triggerJourney()` 機制（Orders afterChange hook 已示範）。
5. **推薦引擎實裝 D30 的「5 件搭配」查詢**：需要 `products.embedding` 或至少 category+color 過濾的簡易實作。可延後到 automation 上線後。
6. **/account/feedback 內嵌表單**（取代 D14 的 Google Form）。

---

## 相關檔案 / 下游影響

- `/admin/repeat-purchase` 儀表板（PR #76） — 本腳本的執行介面
- `src/lib/email/orderConfirmation.ts` — Day 0 已在此觸發
- `src/collections/MessageTemplates.ts` — templateSlug 寄存處（未 seed）
- `src/collections/AutomationJourneys.ts` — journey 綁 templates（未 seed）
- `src/globals/LoyaltySettings.ts` — `pointsConfig.pointsExpiryDays`（Day 60 點數到期邏輯）
- `src/globals/PointRedemptionSettings.ts` — `expiryNotification.reminderDays`（Day 60 提醒邏輯）
- `src/collections/Coupons.ts`（PR #64）— Day 75、Day 90 的券發放
- `src/globals/ReferralSettings.ts` — Day 90 若是 referral 首購，可疊加推薦人禮

---

## 一句版
>
> **D0 建信任、D7 建社群、D14 拿資料、D21 養擁護、D30 開始引導、D45 給第一個信號、D60 給第一個理由、D75 給第一張券、D90 要麼加碼要麼說一句人話。**
