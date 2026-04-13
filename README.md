# CHIC KIM & MIU｜靚秀國際有限公司

> 融合高級極簡優雅（www.chickimmiu.com）與韓系可愛活力（hotping.co.kr）的台灣女裝品牌獨立電商網站

## 技術棧

| 類別 | 技術 |
| --- | --- |
| 框架 | Next.js 15 (App Router) + React 19 + TypeScript |
| 樣式 | Tailwind CSS + shadcn/ui + Framer Motion |
| CMS | **Payload CMS v3**（原生嵌入 Next.js，Admin + API + 前台同一專案） |
| 資料庫 | PostgreSQL（透過 `@payloadcms/db-postgres`） |
| 認證 | Payload Auth（後台） + NextAuth v5（前台社群登入，階段 2 啟用） |

## 專案結構

```
chickimmiu/
├── src/
│   ├── app/
│   │   ├── (frontend)/          # 前台頁面
│   │   └── (payload)/           # Payload Admin Panel + REST/GraphQL API
│   ├── payload.config.ts        # Payload 主設定
│   ├── collections/             # Payload Collections
│   ├── access/                  # RBAC 權限控制
│   ├── features/                # 業務功能模組
│   │   ├── affiliate/           # 階段 4：合作夥伴分潤
│   │   ├── gamification/        # 階段 5：小遊戲
│   │   ├── customer-support/    # 階段 4：客服整合
│   │   └── tracking/            # 階段 6：廣告追蹤
│   ├── components/ui/           # shadcn/ui 元件
│   └── lib/                     # 共用工具
└── public/                      # 靜態資源 + Payload media 上傳
```

## 角色權限 (RBAC)

| 角色 | 可進入 /admin | 可看什麼 |
| --- | --- | --- |
| `admin`    | ✅ | 後台全部內容 |
| `partner`  | ✅ | 只能看自己的分潤、對帳、報表（階段 4 實作 where filter） |
| `customer` | ❌ | 只能使用前台 |

## 開發階段

- **階段 1**（目前）：專案初始化 + Payload 後台骨架 + Users/Media + RBAC
- **階段 2**：商品管理 + 會員等級制度 + CSV/Excel 匯入匯出 + NextAuth 社群登入
- **階段 3**：首頁 + 商品列表 + 商品詳情 + 購物車 + 部落格
- **階段 4**：金流 + 合作夥伴分潤系統 + 客服 Widget
- **階段 5**：會員中心 + 小遊戲（轉盤／刮刮樂／簽到）
- **階段 6**：活動一頁式頁面 + 廣告追蹤 + 效能優化 + 部署

## 快速啟動

### 1. 前置需求

- Node.js 18.20.2+（建議 20 LTS）
- pnpm 9+（`npm i -g pnpm`）
- PostgreSQL 14+（本機、Docker、或 Supabase）

### 2. 安裝與設定

```bash
# 進入專案
cd chickimmiu

# 安裝套件（建議用 pnpm，也可用 npm / yarn）
pnpm install

# 複製環境變數
cp .env.example .env

# 編輯 .env，至少要填：
#   PAYLOAD_SECRET  ← 用 `openssl rand -base64 32` 產生
#   DATABASE_URI    ← 你的 PostgreSQL 連線字串
#   AUTH_SECRET     ← 同上產生方式
```

### 3. 啟動開發伺服器

```bash
pnpm dev
```

- 前台：<http://localhost:3000>
- 後台：<http://localhost:3000/admin>
- GraphQL Playground：<http://localhost:3000/api/graphql-playground>
- REST API：<http://localhost:3000/api/[collection-slug]>

首次進入 `/admin` 時，Payload 會引導你建立第一個 **Admin** 使用者。

### 4. 產出 TypeScript 型別

每次修改 collections 後執行：

```bash
pnpm generate:types       # 產出 src/payload-types.ts
pnpm generate:importmap   # 重新產出 admin import map（若有自訂元件時）
```

## 參考

- Payload v3 官方文件：<https://payloadcms.com/docs>
- Next.js 15 文件：<https://nextjs.org/docs>
- shadcn/ui：<https://ui.shadcn.com>
