# 04 — 補齊缺失公開頁面

## 目標
- 4 個 prod 實測 404 / 內容缺的頁補上：
  - `/contact` 404（需含 contact form → CustomerServiceTickets collection）
  - `/size-guide` 404（PDP 有引用連結）
  - `/shipping` 404（checkout 引用）
  - `/returns`（目前只有 `/account/returns` 需登入，要補 `/returns` 公開政策頁）
- 確認 `/about` 實際有內容（curl 回 200 但不保證有東西）
- sitemap 補上

## ▼▼▼ 以下整段貼到新 session ▼▼▼

```
# 04 — 補齊公開頁面 contact / size-guide / shipping / returns

## Context
- 專案：CHIC KIM & MIU Next.js 15 + Payload v3
- 本機路徑：`C:\Users\mjoal\ally-site\chickimmiu`

## Background
- `curl https://pre.chickimmiu.com/contact` → 404
- `curl https://pre.chickimmiu.com/size-guide` → 404
- `curl https://pre.chickimmiu.com/shipping` → 404
- `curl https://pre.chickimmiu.com/returns` → 404（但 `/account/returns` 需登入 200）
- `/privacy-policy` 200、`/return-policy` 存在於 src 但未驗 prod、`/terms` 200 — 這些不動
- 有 `src/collections/Pages.ts`（若有）— CMS 驅動頁面，本組新頁面**優先接 Pages collection**；若缺 Pages 模型則走硬編 React component

## Your Task

### Task A: /contact（含表單）
1. 讀 `src/collections/CustomerServiceTickets.ts` 了解結構
2. 新建 `src/app/(frontend)/contact/page.tsx`（server component）+ `ContactForm.tsx`（client component）
3. 表單欄位：姓名、email、電話（optional）、主題（下拉）、訊息、勾選訂閱
4. 提交走 `src/app/(frontend)/api/contact/route.ts`：
   - 驗證 email、簡單 rate-limit（reuse 組 02 的 `lib/rateLimit.ts`，若組 02 未 merge 則直接 inline 一個簡版）
   - `payload.create({ collection: 'customer-service-tickets', data: { ... }, overrideAccess: true })`
   - 成功回 200；失敗 429/400
5. 頁面加 `generateMetadata()` title "聯絡我們"、description、canonical

### Task B: /size-guide
- CMS 驅動：若 `Pages` collection 存在，新增 page slug=`size-guide` 並在 `src/app/(frontend)/size-guide/page.tsx` 走 `payload.findGlobal / find` 抓
- 或直接硬編 React + Tailwind：size chart 表格 × 3（上衣 / 裙/褲 / 鞋）+ 量測指引 + 國際尺寸對照（TW / JP / US / EU）
- PDP 應該有 `<Link href="/size-guide">尺寸對照</Link>`，grep 一下確認 link 沒斷

### Task C: /shipping
- 公開運送政策頁：
  - 國內物流選項（引用 `shipping-settings` global — 若組 03 已建則讀 global，若沒則 hardcode）
  - 預計到貨天數
  - 運費門檻（滿 1500 免運 / 或由 global 讀）
  - 超商取貨說明
  - 偏遠地區加價
- 路徑：`src/app/(frontend)/shipping/page.tsx`

### Task D: /returns
- 公開退換貨政策（非會員操作頁）：
  - 7 天鑑賞期說明
  - 可退 / 不可退商品（內衣褲、配件等）
  - 退貨流程 3 步
  - 連結到 `/account/returns` 提醒登入後可直接申請
- 路徑：`src/app/(frontend)/returns/page.tsx`

### Task E: sitemap + header/footer 連結
- `src/app/(frontend)/sitemap.ts` 補 4 個新 URL
- 搜 `grep -rnE "/about|/privacy-policy|/faq|/terms" src/components src/app/(frontend)` 找 footer / header 有哪些連結 → 把 contact / size-guide / shipping / returns 加進去（footer 最實際）
- 更新 QA 測試：4 個 URL 都要回 200

### Task F: 驗證 + push
```
pnpm tsc --noEmit
PAYLOAD_SECRET=dummy DATABASE_URI=file:./data/chickimmiu.db pnpm build
pnpm dev -p 3002
# curl 四條路徑
for p in contact size-guide shipping returns; do curl -s -o /dev/null -w "$p -> %{http_code}\n" http://localhost:3002/$p; done
# 全 200 才算完成
# 測 contact 表單 POST
curl -X POST http://localhost:3002/api/contact -H 'content-type: application/json' -d '{"name":"a","email":"a@b.com","subject":"Q","message":"hi"}' -w "\n%{http_code}\n"
# 應 200 + 看 admin panel /admin 的 customer-service-tickets 有新筆
```

commit：
```
git checkout -b feat/cms-missing-pages
git add src/app/\(frontend\)/contact/ src/app/\(frontend\)/size-guide/ src/app/\(frontend\)/shipping/ src/app/\(frontend\)/returns/ src/app/\(frontend\)/api/contact/ src/app/\(frontend\)/sitemap.ts src/components/
git commit -m "$(cat <<'EOF'
feat(pages): add /contact /size-guide /shipping /returns public pages

- /contact with form wired to customer-service-tickets collection
- /size-guide with international size chart
- /shipping public policy (reads shipping-settings global when available)
- /returns public policy (complements /account/returns)
- Footer + sitemap include new URLs

Closes ISSUE-009 (sitemap gap).

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
git push -u origin feat/cms-missing-pages
```

## Prod Deploy
```
cd /var/www/chickimmiu
git pull
pnpm install --frozen-lockfile
pnpm build
pm2 restart chickimmiu-nextjs
# smoke
for p in contact size-guide shipping returns; do curl -s -o /dev/null -w "$p -> %{http_code}\n" https://pre.chickimmiu.com/$p; done
```

## Guardrails
- 不碰：`src/seed/**`、`src/app/(frontend)/account/**`、`src/collections/Orders.ts` `src/stores/cartStore.ts`、`src/lib/recommendationEngine.ts`、`next.config.mjs`
- 不用 `git push --force`
- 不跳 pre-commit
- 內容可以簡短但**不能空頁**（空頁還不如 404）
```

---
