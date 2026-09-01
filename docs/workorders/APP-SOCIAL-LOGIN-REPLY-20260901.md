# App 第三方登入 — 網站端回覆（2026-09-01）

> 對應文件：Google Doc「App 第三方登入：需網站端處理的設定與問題發現」（2026-08-27，
> doc id `1H6fXTcpfS3OmcKa_t5VSSLdil3bkziI6`）
> 程式變更：commit `6e7a572`＋`1f77894`，已部署 pre。
> **2026-09-01 更新：Google Cloud Console 三組原生 OAuth 用戶端已建立完成**（client ID
> 見第二節），LINE Console 兩項仍待 Alan。

**先講結論**

| 節 | 事項 | 狀態 |
|---|---|---|
| 四 | 社群註冊沒有推薦綁定與註冊禮 | ✅ **已修復並驗證**（三條註冊路徑改用同一份實作） |
| 〇 | 三個欄位要能登記多組值 | ✅ **已支援**（同一格用逗號或換行分隔，免 migration） |
| 二 | Google `aud` 處理方式請確認 | ✅ **確認你們的方案正確**，後端不需新增 audience |
| 二 | 「Android Client ID 欄位比對 aud 不會成立」 | ✅ **你們是對的**，已改欄位說明為備查用途 |
| 三 | Apple 設定 | ✅ 已複核：後台 Bundle ID 已生效，網頁不受影響 |
| 二 | 建立 iOS／Android OAuth 用戶端 | ✅ **已建立三組**（iOS／Android release／Android debug），client ID 見第二節 |
| — | 軟刪除會員再次社群登入 | ✅ **已改為自動復原原帳號**（Alan 09-01 拍板，commit `1f77894`） |
| 一 | LINE channel 2009827245 啟用 Mobile app | ⛔ **需 Alan 到 LINE Console 操作**（見文末待辦） |
| 一 | LINE Email scope 是否已核准 | ⛔ **需 Alan 到 LINE Console 確認**（後端查不到；但不影響登入可用性，見一之三） |

---

## 四、推薦綁定與註冊禮 —— 已修復（本次主要工作）

你們的實測完全正確，感謝把對照組一起附上，根因很好定位：註冊禮與推薦綁定當初
**寫死在 `POST /api/customers/register` 這支 endpoint 裡**，社群註冊走的是另一條路，
自然兩者都沒有。

### 怎麼修的

新增 `lib/auth/newCustomerOnboarding.ts` 作為**唯一實作**，三條註冊路徑共用：

1. `POST /api/customers/register`（Email 註冊）— 改為呼叫它，行為不變
2. `POST /api/v1/auth/social`（App 原生 Google／Apple／LINE）— **新接上**
3. 網頁 NextAuth 社群登入 — **新接上**（該路徑同樣缺註冊禮）

流程固定為：推薦碼綁定 → 新會員註冊禮 → 推薦註冊獎勵。這樣「推薦獎勵與註冊禮不因
註冊方式而異」就不是靠人記得同步兩份程式，而是結構上只有一份。

### App 端要做的事：一個欄位

`POST /api/v1/auth/social` 現在接受 `referralCode`（欄位名與你們已經在送的一致，
不用改）：

```json
{ "provider": "apple", "idToken": "...", "nonce": "...",
  "name": "...", "referralCode": "Y9T5SEYD" }
```

新註冊時回應會多一段 `data.onboarding`，可直接拿來顯示「已獲得 100 點新會員禮」：

```json
{ "success": true, "data": {
    "token": "...", "expiresIn": 604800, "isNewUser": true,
    "onboarding": { "referralBound": true, "signupPoints": 100,
                    "signupCredit": 0, "referralRewardGranted": true },
    "user": { ... } } }
```

非新註冊（回訪登入）不會有 `onboarding` 欄位。

### ⚠️ 同時修正了 `isNewUser` 的語意（會影響你們的新手引導）

舊版的 `isNewUser` 是「這個 socialId 沒見過」→ **既有 Email 會員第一次改用社群登入
也會回 true**。那不是新註冊，卻會讓 App 誤跑新手引導；補上註冊禮之後，這個誤判更會
變成「老會員每次換登入方式就領一次註冊禮」。

現在 `isNewUser` = 真的新建了帳號。既有會員首次綁社群 → `isNewUser: false`、不發註冊禮。

### 順帶修掉的兩個既有缺陷

- **註冊禮改為「先寫帳本、後動餘額」**：冪等判定看的是 `points-transactions` 那筆
  `source='welcome'` 帳列，等於是這段的鎖。舊順序（先加點數再寫帳本）在帳本寫入失敗時
  會變成「點數已發、鎖沒建起來」，重試就重複發點。
- **註冊禮改增量入帳**（原本是絕對值寫入 `points = 100`）：萬一誤對既有會員呼叫，
  也只會加 100，不會把人家的餘額洗掉。

### 驗證

`scripts/verify-social-onboarding.ts`（可重跑），fresh DB 15 項斷言全過：

- 社群註冊新帳號 → `referredBy` 綁定 + 發 100 點 + 1 筆 welcome 帳列 ✅
- 重複呼叫 → 點數仍 100、帳列仍 1 筆（冪等）✅
- 既有會員（餘額 777）誤呼叫 → 877，不是被覆寫成 100 ✅
- 推薦碼查無／自我推薦 → 不綁定、不擋註冊 ✅
- `created` 旗標語意：新社群帳號 true／同 socialId 回訪 false／既有 email 會員首次綁 false ✅

另在 pre 以真 HTTP 跑 Email 註冊回歸測試（重構後仍正確綁定與發放），結果見文末。

### 兩個數字的來源（供你們顯示文案用）

- 註冊禮：後台 `loyalty-settings.signupReward`（目前：啟用、100 點、0 購物金）
- 推薦註冊獎勵：後台 `referral-settings.rewards`，發**雙方購物金**，且預設要求
  email 已驗證。社群註冊的帳號建立時即為已驗證，所以會即時發放。

---

### 關於你們提到的「customers 不允許硬刪除」

那是刻意的（會員被訂單、點數等稽核資料引用，硬刪會斷關聯），admin 回 403 不是權限
設定漏了。你們把測試帳號的 email 改名成 `retired-test-*@invalid.local` 再刪 —— 這個
做法是對的，而且剛好避開一個坑：**軟刪除的紀錄仍占用 email 唯一索引**，若沿用原本的
`apple_<sub>@noemail.invalid` placeholder 不改名就重測，下次同一個 Apple 帳號登入會
在建帳時撞唯一鍵。

延伸的既有行為（非本次變更造成）：**已被軟刪除的會員若再次社群登入，原本會建帳失敗**
（查詢會排除已刪除紀錄 → 走建新帳 → 撞 email 唯一鍵）。

**這條 Alan 已於 2026-09-01 拍板：改為自動復原原帳號**（commit `1f77894`）。現在的行為是
以同一個 social id 再次登入時，會連同已軟刪除的紀錄一起查，找到就把 `deletedAt` 清空、
沿用原本的會員（點數、訂單、推薦關係全部保留），並視為**回訪登入**（`isNewUser: false`、
不重發註冊禮）。你們測試時把帳號改名再刪的做法仍然有效，只是現在即使不改名也不會撞唯一鍵。

---

## 〇、三個欄位登記多組值 —— 已支援

`googleIosClientId`、`googleAndroidClientId`、`appleAppBundleId` 三欄改為
**同一格可填多組**，用逗號或換行分隔即可，後端會拆開逐一比對 `aud`。

沿用同一個欄位（型別 text → textarea，PostgreSQL 兩者同為 varchar）而不是改成陣列，
是為了免 migration、且既有單值設定原樣繼續有效。CKMU App 之後加入時，直接在同一格
加一行就好。

你們引用的 Google 官方建議（多個 client 共用同一後端時由後端自行比對 aud）正是這份
允許清單在做的事。

---

## 二、Google

### aud 的處理方式：確認你們的方案可行 ✅

「兩個平台都指定網站現有的 `googleClientId`（網頁類型）作為 server client ID」——
**這是對的，後端不必新增任何 audience**。網站現有的 Google Client ID 本來就在允許
清單裡（`socialCredentials.ts` 的 `nativeAudiences.google` 第一順位就是它）。

**你們對 Android 的提醒也完全正確**：Android 的 `id_token` 只會以 server client ID
作為 `aud`，Android client ID 不會出現在 `aud` 裡，所以後台那欄對 Android 這條路徑
不成立。已把欄位說明改成備查用途，避免下一個人照著填卻以為那是生效條件。

後台「Google iOS / Android Client ID（App 用）」兩欄，我**已經先幫你們填好了**（原本
說可以留空）。理由：留空只有在「iOS 端確實有設定 serverClientID」時才安全；填上去則
兩種寫法都會通過，而且填的都是同一個 Google 專案自己的 client ID，不會放寬到別人的
token。這樣你們 iOS 端要不要設 serverClientID 就變成純粹的實作選擇，不會踩到後端。

### OAuth 用戶端 —— 已建立完成 ✅

專案 `useful-figure-424117-s9`（與網站現有 Web client 同專案），2026-09-01 建立：

| 名稱 | 類型 | Client ID |
|---|---|---|
| KimLafayette iOS | iOS | `517050786415-7d71je3ehvsth70p21i3tj22cd8oie7l.apps.googleusercontent.com` |
| KimLafayette Android (release) | Android | `517050786415-oi1qjlm44j5eg2j8ru9g1mvo27la4n6a.apps.googleusercontent.com` |
| KimLafayette Android (debug) | Android | `517050786415-c0sgvm1l3okk6dkduo437d4kkvvvon0d.apps.googleusercontent.com` |
| CHIC KIM & MIU Web（既有，即 server client ID） | 網頁 | `517050786415-0vh6ftjdk15ckggqcob5ceivgsm8e82a.apps.googleusercontent.com` |

**iOS 端寫 Info.plist 用的 `REVERSED_CLIENT_ID`**：

```
com.googleusercontent.apps.517050786415-7d71je3ehvsth70p21i3tj22cd8oie7l
```

建立時填入的參數：iOS Bundle ID `com.jingshow.kimlafayette` ＋ Team ID `29793LNX3V`；
Android package `com.jingshow.kimlafayette`。

⚠️ **Android 一組 client 只吃一個 SHA-1**，所以正式與開發憑證各建一組（不是同一組填兩行）。
上架 Google Play 啟用 Play 應用程式簽署後，還要再建第三組（Google 簽署金鑰的 SHA-1）。

後端已把上表四個 client ID 全部登記為合法 `aud`，並在 pre 實際跑 `resolveSocialAuth()`
確認四個都在允許清單內。OAuth 同意畫面狀態為「實際運作中／外部」，只要 scope 停留在
`openid email profile`（非敏感範圍）就不需要送審，一般使用者可直接登入。

---

## 一、LINE

### channel 歸屬確認

已查證：**網站端目前使用的正是 channel `2009827245`**（與你們文件一致），憑證設定在
伺服器環境變數。你們「App 改用網站的 channel」的判斷我同意 —— LINE 的 userId 只在
同一個 Provider 內唯一，跨 Provider 會拿到不同 userId，那樣網頁與 App 就對不到同一人。

後端這側已經支援：LINE 的 `aud` 允許清單包含網站 channel id；若日後 App 真的需要
獨立 channel，也可用 `AUTH_LINE_NATIVE_CHANNEL_ID` 補登記（同樣支援多組）。

順序我們照你們寫的走：**先由網站端在 console 完成登記並通知，你們再把 App 的 channel
從 2008707491 換成 2009827245**。

### Email scope：後端查不到，但先給你們一個重要的實務資訊

LINE 沒有公開端點可以查詢某個 channel 的 email 權限核准狀態，這只能在 LINE Developers
Console 看（需 Alan）。我另外查了資料佐證，目前 pre 上 **LINE 登入會員 0 位**，所以也
沒有既有資料可以反推。

不過這件事**不會擋住 LINE 登入可用性**：我們的實作對「沒有 email 的 LINE 使用者」有
完整路徑 —— 會用 `line_<userId>@noemail.invalid` 這種保留網域的 placeholder 建帳，
之後使用者可在帳號設定用 `POST /api/customers/bind-email` 補綁真 email。所以
email scope 沒核准的情況下，登入照樣走得通，只是會員 email 是 placeholder。

---

## 三、Apple —— 已複核

- 後台「Apple App Bundle ID（App 用）」目前值 `com.jingshow.kimlafayette`，**已生效**
  （我直接查了資料庫確認）。那欄的說明沒寫錯，你們照著填是對的。
- 你們把 App ID 群組到 `com.chickimmiu.CKMUW` 底下、且沒有更動 Services ID
  `com.chickimmiu.web` 本身 —— 我複核過網頁端的 Apple 設定（Services ID／Team ID／
  私鑰）都在原處，網頁既有使用者不受影響。
- 該欄現在可填多組，CKMU App 之後加一行即可，不必取捨。

---

## ⛔ 還沒完成的事項

只剩 LINE Console 兩項。Google Cloud Console 三組用戶端已於 2026-09-01 建立完成（見第二節），
LINE Developers Console 因為需要 LINE Business ID 登入而無法代為操作。

### 1. LINE Developers Console — channel `2009827245`

「LINE Login」分頁啟用 Mobile app，填入：

| 平台 | 欄位 | 值 |
|---|---|---|
| iOS | Bundle identifier | `com.jingshow.kimlafayette` |
| Android | Package name | `com.jingshow.kimlafayette` |
| Android | Package signatures（同欄換行填兩行） | `80d9fb33f40a0ae96e5f3ea0d26833eb4e4c4591`<br>`c27f123ffba75b1c5dbe5c16cf74271fb22bbc33` |

第二行是 debug 憑證，不加的話 App 團隊無法用 debug 版測試。
**完成後請通知 App 團隊**，他們才會把 App 的 channel 切過來（順序不能顛倒，先切會斷線）。

### 2. LINE Developers Console — 確認 Email 權限

同一個 channel 確認 email 權限是否已核准（未申請的話需送出申請）。
不阻擋上線，但沒核准的話 LINE 會員的 email 會是 placeholder。

### ~~3. Google Cloud Console — 建立原生 OAuth 用戶端~~ ✅ 已完成

2026-09-01 建立 iOS／Android release／Android debug 共三組，client ID 與
`REVERSED_CLIENT_ID` 見第二節，後端允許清單已同步登記並驗證。

### 3. 上架 Google Play 後（提醒，非現在）

啟用 Play 應用程式簽署後，最終 APK 由 Google 的金鑰簽署，那組 SHA-1 也要補登記到
LINE 與 Google 兩邊，只登記本地上傳金鑰不夠 —— 你們文件裡已經寫到這點，我們同意。
LINE 那邊同欄位換行加入即可；**Google 那邊要再建一組新的 Android client**（一組只吃
一個 SHA-1），建好後告訴我，我補進後端允許清單。

---

## 附：pre 上的實測結果

（部署後於 pre 執行，測試帳號已刪除）

- Email 註冊（真 HTTP，帶推薦碼）→ `referredBy` 正確、`points` 100、welcome 帳列 1 筆
- 社群註冊上線流程（真 PostgreSQL）→ 15 項斷言全過

你們可以在 Apple 登入那條路徑上重跑一次原本的實測（同一組推薦碼、看 `referredBy`
與 `points`），這次應該與 Email 註冊一致。若有落差請把 App log 一起附上，我再追。
