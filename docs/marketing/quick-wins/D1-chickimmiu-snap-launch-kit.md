# D1：`@chickimmiu_snap` UGC 街拍副帳號 — Launch Kit

> **目標**：複製 Musinsa 街拍模式（11.8 萬粉），把客戶實穿照系統化成內容資產
> **時間表**：本週開帳 → 第一週累積 9 張投稿 → 上線 9 連格 feed → 主帳號宣傳投稿活動
> **成功指標**：30 天內 50+ 投稿、9 連格 feed 完整、首則「本週最佳」轉發進主帳號

---

## 1. 帳號設定

### Bio 文案（韓系極簡風）
```
@chickimmiu_snap
@chickimmiu 客人實穿街拍 ✿
投稿即享 5% 購物金 → 看精選↓
連結 → bit.ly/ckmu-snap
```

### 連結（Linktree 或 Beacons）
1. 投稿表單（chickimmiu.com/snap-submit）
2. 主帳號 @chickimmiu
3. 本週最佳穿搭（精選帖）
4. 加入 LINE 官方
5. 領 5% 購物金教學

### 視覺識別
- **頭像**：用主品牌同款 logo + 加 "SNAP" 字樣 / 或玫瑰金小相機 icon
- **highlight 封面**：6 個分類 — `本週最佳` / `投稿規則` / `穿搭情境` / `韓星同款` / `5% 教學` / `客人故事`
- **feed 風格**：所有投稿照前先過 LUT（Korean Cozy Beige：暖膚低飽和、陰影提亮、高光柔和），保持風格統一

---

## 2. 投稿活動規則（給客人看的版本）

### 公告文案（IG / 官網 / LINE 三處同步）

```
✿ 投稿你的 chickimmiu 穿搭，享 5% 購物金 ✿

— 怎麼參加 —
① 穿著 chickimmiu 任一單品拍一張穿搭
② 投稿到 → bit.ly/ckmu-snap（含 IG handle、商品 SKU）
③ 通過審核後，5% 購物金自動入帳（按該訂單金額計算）

— 額外回饋 —
✦ 入選「本週最佳穿搭」者再 +200 點數
✦ 連續 3 週入選者升級「金老佛爺 muse」並獲贈韓國快閃禮
✦ 月度第一名上 chickimmiu.com 首頁 + 1 件代言商品

— 規則 —
• 須為 chickimmiu 官網或合作通路購買的商品
• 須附訂單編號 / SKU 給審核
• 我們會以 @chickimmiu_snap 標註你的 IG，並保留刊登權
• 已含 fashion 模特或藝人合作則不重複給點

詳細規則：chickimmiu.com/snap-rules
```

---

## 3. 後台整合（最小可行版本）

### 階段 A：手動審核（封測期間，1-2 週驗證）
- Google Form 接收投稿（欄位：IG handle / Email / 訂單編號 / 商品 SKU / 照片上傳 / 授權 checkbox）
- 後台人員（你或團隊）每週掃一次：通過 → 手動加 5% 購物金到該會員 wallet
- 投稿照片每週六挑 1 張 post 進 @chickimmiu_snap + tag 客人 IG

### 階段 B：自動化（成立後 1-2 個月）
未來可在 chickimmiu 後台加：
- **新 collection**：`SnapSubmissions`（欄位：user / order / sku / imageUrl / status / createdAt）
- **新頁面**：`/admin/snap-submissions` 列表 + 一鍵核准（觸發 wallet 加值）
- **前台頁面**：`/snap-submit` 表單（會員登入後自動帶 user 與訂單清單）
- **公開頁面**：`/snap`（精選 grid，IG 風格，從 SnapSubmissions 拉資料）

> 階段 B 是程式變更，可獨立做成 PR；現階段先用 Google Form + 手動就能跑。

---

## 4. 第一週發文計畫（@chickimmiu_snap）

### Day 1（週一）— 開帳介紹
- 圖：金老佛爺自己穿一套 chickimmiu，街頭抓拍
- 文案：`@chickimmiu_snap 來了 ✿ 這裡是 chickimmiu 客人實穿街拍 — 第一張先放我自己 ;) 想知道怎麼一起來：bit.ly/ckmu-snap`
- 標籤：#chickimmiu #chickimmiusnap #台灣女裝 #韓系穿搭 #台北穿搭 #金老佛爺穿搭

### Day 2-3 — 投稿規則 carousel（10 張）
- 第 1 張：`✿ 投稿享 5% 購物金 ✿`（hero card）
- 第 2-4 張：3 步驟教學（拍 → 投 → 領）
- 第 5-7 張：3 個範例好照（金老佛爺自己穿的 3 套）
- 第 8 張：`連續 3 週入選 → 韓國快閃禮`
- 第 9 張：常見問答 FAQ
- 第 10 張：`連結在 bio ↑` CTA

### Day 4-5 — 第一張客人投稿
- 預先自己準備 3-5 張「種子內容」（朋友、員工、自己穿）
- 模擬「客人投稿」氛圍，第 1 週每天放 1 張，建立 feed 穩定感

### Day 6-7 — 「本週最佳」第一發
- 從 Day 4-5 種子內容挑 1 張作「本週最佳」
- 加 highlight 入「本週最佳」分類
- 主帳號 @chickimmiu 限動轉發 + 標 @chickimmiu_snap 互導

---

## 5. 主帳號 @chickimmiu 宣傳文案

### Reel（30 秒）
- 開頭：「我們開了第二個帳號」
- 中段：金老佛爺自己穿 chickimmiu 走街拍鏡頭，背景跳出 IG 通知「@chickimmiu_snap 邀請追蹤」
- 結尾：「你也想被我們轉發？投稿就有 5% 購物金 → bio 連結」

### 限動連 5 則
1. `這是什麼 ✿` + 帳號截圖
2. `怎麼投稿 →` + 3 步驟動圖
3. `誰可以參加 →` + 規則文字
4. `第一週要送出去的禮物 ✦` + 韓國快閃禮 sneak peek
5. `投稿連結 → bio` + sticker 倒數

---

## 6. 本週可執行 Checklist（你自己做）

- [ ] 開立 IG 帳號 `@chickimmiu_snap`（建議用 chickimmiu 主品牌 email + 兩步驗證）
- [ ] 設 bio + 連結（用 Linktree 或 Beacons 免費版）
- [ ] 準備 6 個 highlight 封面（白底 + 玫瑰金小 icon，可用 Canva 或 Figma）
- [ ] 拍 5-10 張「種子內容」穿搭照（自己 + 朋友 + 員工，3-4 個場景：街頭、咖啡、家居、夜景）
- [ ] 開 Google Form 投稿表單 + 設好欄位
- [ ] 寫 `/snap-rules` 頁面（chickimmiu 官網新頁，可放在 footer）
- [ ] 主帳號 reel + 5 則限動排程（建議週末發第一波）
- [ ] LINE 官方 + email newsletter 推一波

---

## 7. 第一個月 KPI

| 指標 | 目標 | 警戒值 |
|------|------|-------|
| 投稿總數 | 50+ | < 20 表示活動誘因不夠強 |
| @chickimmiu_snap 粉絲 | 1,500+ | < 800 表示主帳號導流不夠 |
| 「本週最佳」reel 互動率 | > 5% | < 2% 表示視覺需調整 |
| 5% 購物金實際發出筆數 | 30-40 | 與投稿數差距大 = 訂單比對流程有摩擦 |
| 二次投稿比率 | 20%+ | < 10% 表示誘因留存不夠 |

---

## 8. 風險 / 注意事項

- **照片授權**：投稿表單必須有「授權 chickimmiu 使用」checkbox，且要清楚說明用途（@chickimmiu_snap、官網、行銷素材、不轉售）
- **客人 IG 為私人帳號**：tag 不到，要在投稿欄位請她填 IG handle，並在審核時告知會 tag
- **5% 購物金濫用風險**：定 1 帳號 / 月最多 5 次，避免重複投稿同一商品；訂單編號驗證要確實
- **品質低照片**：制定下限（光線清楚、人完整入鏡、無嚴重模糊），不通過的禮貌通知並給拍攝建議
- **法律**：每張投稿照出現的他人臉孔需獲授權；投稿者承諾照片無侵權，chickimmiu 不負舉證
