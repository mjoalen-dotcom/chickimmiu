# /admin 保護 — Cloudflare Access 設定指南

封測期 `/admin` 雙層鎖的兩條路徑擇一：

- **BasicAuth middleware**（code 內，env `ADMIN_BASIC_USER` + `ADMIN_BASIC_PW`）— 見 [src/middleware.ts](../src/middleware.ts)。設 env 後自動啟用。
- **Cloudflare Access**（本文件）— 零 code 變動，email 白名單 + SSO + 稽核紀錄。**推薦**，除非暫時不打算開 Cloudflare Zero Trust。

兩者**不要同時啟**（BasicAuth prompt 會跳在 Access 登入前，體驗很糟）。

---

## Cloudflare Access 設定流程

### 前置條件
- `pre.chickimmiu.com` 已掛在 Cloudflare（Proxy 打勾）。
- 有 Cloudflare 帳號的 Zero Trust 權限（免費方案可 50 users）。

### 步驟

1. 登入 Cloudflare → 側欄 **Zero Trust**（若無先 follow 引導建立 team domain，例如 `chickimmiu.cloudflareaccess.com`）。
2. **Access → Applications → Add an application**
   - Type：**Self-hosted**
   - Application name：`CHIC KIM & MIU Admin`
   - Session Duration：`24 hours`
   - Application domain：`pre.chickimmiu.com`，Path：`/admin`
   - （可選）再加一條 `/api/users/login` 同規則，防未授權者透過 API 探測帳號。
3. **Add policy**
   - Policy name：`Admin allowlist`
   - Action：`Allow`
   - Rule：
     - Include → **Emails** → 列出管理員 email（逐個加）
     - 或 Include → **Email domain** → `@chickimmiu.com`（若有 workspace domain）
4. （選配）Require：
     - **Country** not in 你不營運的區域（降低機器人誤觸）
     - **Purpose Justification**：要求使用者登入時輸入理由（稽核用）
5. **Identity providers**：預設 one-time PIN（email OTP）即可；有 Google Workspace / GitHub 可綁 SSO。
6. **Save application**。

### 驗證

```bash
# 無 cookie 應 302 到 Cloudflare Access 登入
curl -sI https://pre.chickimmiu.com/admin | head -5
# 預期 location 是 https://<team>.cloudflareaccess.com/cdn-cgi/access/...
```

---

## 二選一：若走 Cloudflare Access

- **不要** 在 Hetzner 的 `.env` 設 `ADMIN_BASIC_USER` / `ADMIN_BASIC_PW`，middleware 會 no-op。
- Payload 自身的 admin login 保留（雙重密碼才進得去）。

## 二選一：若走 BasicAuth middleware

- `.env` 加：
  ```env
  ADMIN_BASIC_USER=admin
  ADMIN_BASIC_PW=<>=24chars-random
  ```
- `pm2 restart chickimmiu-nextjs`
- 驗證：
  ```bash
  curl -s -o /dev/null -w "%{http_code}\n" https://pre.chickimmiu.com/admin          # 401
  curl -s -o /dev/null -w "%{http_code}\n" -u admin:<pw> https://pre.chickimmiu.com/admin  # 200 or 302
  ```

## 事故處理
- 自己鎖在門外：ssh 進 Hetzner → `cd /var/www/chickimmiu` → 暫時把 `ADMIN_BASIC_USER/PW` 從 `.env` 拿掉 → `pm2 restart`。
- Cloudflare Access 壞掉：Zero Trust dashboard → Applications → 找到那條 → Disable policy（policy 一停整個 app 變 open，**等於完全不保護**，務必只在緊急時用）。
