# CKMU 後台結構與角色權限

> 更新：2026-08-15｜依據：CKMU-ADMIN-UI-001 Prompt E

## 角色設計

本專案的 `users` 同時承載後台人員、合作夥伴與一般顧客。因此保留安全預設
`customer`，並新增 `operator` 選項；若把預設改成 `operator`，一般網站註冊會
直接取得後台權限。後台角色只能由 admin 修改。

| 能力 | admin | operator | partner / customer |
|---|---:|---:|---:|
| 登入 Payload 後台 | ✅ | ✅ | partner 維持既有登入；customer ❌ |
| 商品、分類、尺寸、評價、進銷存：讀／新增／修改 | ✅ | ✅ | ❌ |
| 訂單、發票、退換貨、退款：讀／新增／修改 | ✅ | ✅ | 僅維持既有本人／推薦資料規則 |
| 兩站部落格、頁面、名人、Podcast、主題、媒體：讀／新增／修改 | ✅ | ✅ | 僅維持既有公開讀取規則 |
| 導覽、首頁、合集、商品列表、About、FAQ、政策、包裝內容設定 | ✅ | ✅ | ❌ 更新 |
| Users 管理／角色修改 | ✅ | ❌（側欄隱藏且 API access 不放寬） | ❌ |
| 系統設定 Globals | ✅ | ❌（後台隱藏） | ❌ |
| Collection 文件刪除 | 依原設定 | ❌（中央 deny，不能被單檔寬鬆規則繞過） | 依原設定 |

系統設定 Globals 包含：結帳、訂單、發票、稅務、會員回饋、CRM、客服、促銷引擎、
行銷自動化、推薦、廣告目錄、遊戲、全域設定與定價公式。隱藏只作用於後台 UI，
不改變前台讀取公開設定所需的既有 API 規則。

## 既有帳號盤點（pre，2026-08-15）

| Email | 現有角色 | 處置 |
|---|---|---|
| admin@chickimmiu.com | admin | 保留 admin |
| ckmu018@gmail.com | admin | 保留 admin |
| mjoalen@gmail.com | admin | 保留 admin |
| jin@chickimmiu.com | partner | 保留 partner，不擅自升權 |

資料庫角色總數：`admin=3`、`operator=0`、`partner=1`、`customer=10`。現有三個後台
管理帳號均已是 admin，不需資料 migration。一般顧客與 partner 不可因本次工作批次升權。

## 實作邊界

- operator 的日常權限由 `withOperatorManage`／`withOperatorGlobalUpdate` 集中套用。
- operator 的刪除拒絕由中央 wrapper 強制執行。
- 系統 Globals 用 `adminOnlyGlobal` 集中隱藏，避免逐檔漏網。
- `users.role` 仍由 field-level admin access 保護。
