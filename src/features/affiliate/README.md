# Affiliate 合作夥伴分潤模組

此資料夾為階段 4 開發範圍。

## 責任範圍
- 合作夥伴推廣連結生成 (`/api/affiliate/track?code=...`)
- 佣金計算 (hook 進 Orders collection)
- 對帳報表 (月結)
- CSV / PDF 匯出
- 提款申請流程

## 相關 Payload Collections（階段 4 會建立）
- `affiliate-partners`：夥伴基本資料、分潤比例
- `affiliate-links`：短網址、點擊追蹤
- `affiliate-commissions`：每筆訂單產生的佣金紀錄
- `affiliate-payouts`：提款申請

## RBAC
- Partner 角色只能看到 `req.user.id === partnerId` 的資料
- 使用 `@/access/isAdminOrPartner` + 自訂 where filter
