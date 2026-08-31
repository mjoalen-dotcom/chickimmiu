# ADR：Facebook 會員登入與 Meta Horizon 擴充邊界

日期：2026-08-31

狀態：網站端已實作；Meta App 啟用與真實帳號驗收待完成

## 決策

1. Facebook Login 只作為 CKMU 會員的一種登入方式。訂單、點數、等級、收藏與會員權益仍以 `customers.id` 為唯一真相源。
2. 對 Web／App／未來空間體驗提供版本化的會員參照 `ckmu:customer:<id>`。它是內部識別，不是密碼、存取權杖或公開 DID。
3. Facebook user ID 是 App-scoped。資料庫同時保存 Facebook App ID；換 App 時不得把相同數字自動視為同一人。
4. Facebook 不提供可供本案安全合併會員的 email 驗證聲明，所以登入流程不索取或採信 Facebook email。既有會員必須先登入，再從帳號設定主動連結 Facebook。
5. Meta Horizon／Quest 帳號與 Facebook Login 分開。需要 VR／MR 功能時再增加 `external-identities` 關係、Horizon org-scoped ID、撤銷狀態及必要權限；未取得使用者同意前不收集。

## 本版資料最小化與安全措施

- Facebook 權限只要求 `public_profile`；不要求 email、朋友名單、貼文或廣告權限。
- 授權碼流程驗證 `state`；Graph API 請求使用固定 HTTPS 主機、Bearer header 與 `appsecret_proof`。
- 連結動作要求現有 CKMU cookie session、同源 POST、10 分鐘簽章意圖、相同 Facebook App 與資料庫唯一索引。
- OAuth 會員解析失敗即拒絕登入；不再發出只有社群 session、卻沒有對應 CKMU 會員的半成功狀態。
- 公開提供 `/facebook-data-deletion`，讓 Meta App 可登記資料刪除說明網址。

## Meta App 啟用清單（pre 限定）

- 類型：Consumer；用途：Facebook Login。
- Valid OAuth Redirect URI：`https://pre.chickimmiu.com/api/auth/callback/facebook`
- App Domains：`pre.chickimmiu.com`
- Privacy Policy：`https://pre.chickimmiu.com/privacy-policy`
- Data Deletion Instructions：`https://pre.chickimmiu.com/facebook-data-deletion`
- 首輪權限：`public_profile`；不得加入 email／朋友／廣告權限。
- App ID＋App Secret 必須來自同一個 App，再寫入 pre 後台或伺服器環境。本輪不修改 www、SHOPLINE、DNS 或金流；未來切換網域後另行登記回呼。
- App 恢復、上線模式、App Secret 寫入及第一次真實 Facebook 授權後，再驗收登入、既有會員連結與新會員建檔。

## 未來空間體驗的接入方式

現有 `/api/v1/me` 已提供 `identity.subject` 與登入方式狀態，其他資料仍走既有會員、遊戲、收藏及點數 API；網頁跨站登入沿用 `/api/sso/authorize` 與 PKCE，原有 Kim 部落格契約不變。`identity.subject` 只能作資料關聯，呼叫 API 仍須合法的 cookie／Bearer token。

若投入 Meta Horizon／Quest，再建立獨立的 Meta 開發者應用程式、org-scoped ID 對應、必要的權限審查與明確同意。若投入瀏覽器 3D／WebXR，場景服務只領取必要的公開暱稱、角色素材及權益，不傳送地址、訂單內容或完整會員文件。兩條路都不替換 `customers`，也不將既有購物金改造成加密資產。

尚未實作：Horizon 帳號連結、Meta Avatars、3D 場景、多人同步、WebXR 體驗及任何 NFT／鏈上錢包。新增這些功能前，需要具體用途、資料權限及預算批准。

## 核對來源

- [Auth.js Facebook 設定與回呼路徑](https://authjs.dev/getting-started/providers/facebook)
- [Meta Horizon 帳號連結：org-scoped ID](https://developers.meta.com/horizon/documentation/spatial-sdk/ps-account-linking/)
- [Meta Horizon 身分驗證與權限](https://developers.meta.com/horizon/essentials/horizon-os-authentication/)
- 本輪對 Graph API v25.0 `/me` 無權杖讀取得到預期 400，回應頭 `facebook-api-version: v25.0`；只證明版本端點存在，不是登入成功。
