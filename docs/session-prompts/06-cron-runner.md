# 06 — Cron Runner 接通自動化 + 修 awardGamePoints bug

## 目標
- 目前 `AutomationJourneys` / `MemberSegments` / 點數過期 / streak decay / CreditScore 都有 collection 但**無 runner**
- 建 4 個 protected cron endpoint + GitHub Actions workflow 每 X 分鐘打一次
- 順手修 `src/lib/games/gameActions.ts` `balanceAfter` 硬寫 0 的 bug（工作樹已有部分改動）

## 前置
- Wave 2 全部建議先 merge（組 02 email adapter，automation journeys 要發信）

## ▼▼▼ 以下整段貼到新 session ▼▼▼

```
# 06 — Cron Runner + awardGamePoints 修正

## Context
- CHIC KIM & MIU Next.js 15 + Payload v3
- 本機：`C:\Users\mjoal\ally-site\chickimmiu`

## Background
- **無 cron**：`payload.config.ts` 沒 `jobs` config；package.json 沒 node-cron/agenda/bullmq
- **Schemas 齊但 runner 缺**：
  - `src/collections/AutomationJourneys.ts` + `src/lib/crm/automationEngine.ts` 有 `triggerJourney()` 但沒排程
  - `src/collections/MemberSegments.ts` + `src/lib/crm/segmentationEngine.ts` 有 RFM×40%+... 公式但沒跑
  - Points FIFO expiry — `src/app/(frontend)/account/points/page.tsx` 算 expiring 點數（session 7 做的）但**沒人刪掉過期點**
  - Streak — `src/lib/games/gameEngine.ts` 有 `getTpeWeeklyKey`（session 7 修過）但斷 streak 需 cron 掃
- **awardGamePoints bug**：`src/lib/games/gameActions.ts` `balanceAfter` 硬寫 0（line ~54，工作樹已有部分改動，`git diff src/lib/games/gameActions.ts`）

## Your Task

### Task A: 修 awardGamePoints
讀 `src/lib/games/gameActions.ts`，找 `balanceAfter: 0` 或類似。改成：
```ts
const currentUser = await payload.findByID({ collection: 'users', id: userId, depth: 0 })
const newBalance = (currentUser.points ?? 0) + delta
// 先 create tx record 用 newBalance
await payload.create({
  collection: 'points-transactions',
  data: { user: userId, delta, balanceAfter: newBalance, reason: 'game_reward', ... },
})
// 再 update user.points
await payload.update({ collection: 'users', id: userId, data: { points: newBalance } })
```
注意並發：遊戲結算若兩場同時跑會 race；加 Payload 的 `depth: 0` + 後讀 user.points 前取當下 snapshot，或加一個 retry on conflict。SQLite 單進程暫可接受。

### Task B: CRON_SECRET

`.env.example` 加 `CRON_SECRET=<generate openssl rand -base64 24>`

### Task C: 建 4 個 cron endpoint

都在 `src/app/(frontend)/api/cron/*/route.ts`，每個都先驗 `Authorization: Bearer $CRON_SECRET`：

1. **`/api/cron/automations/route.ts`**
   - 掃 `automation-journeys` where `enabled=true`
   - 對每個 journey：
     - `schedule` 類（daily/weekly）→ 檢查今天是不是該跑
     - `event` 類（user_registered）→ 本 cron 不跑（這些由 Users afterChange hook 觸發）
     - `condition` 類（dormant_30d）→ 掃符合條件的 users + 觸發 action
   - Action：send_email（Resend）、send_line、send_sms（第三方）— 若組 02 email adapter 沒 merge，email action skip 加 log

2. **`/api/cron/segments/route.ts`**
   - 對所有 active users 跑 `segmentationEngine.recomputeSegment(user)` 更新 user.segmentId
   - 用 pagination 避免一次拉太多
   - 每 100 筆 log 一次進度

3. **`/api/cron/expire-points/route.ts`**
   - 找 `points-transactions` 365 天前 created、delta > 0、尚未全用完的
   - 對每個使用者計算剩餘過期點數，create 一筆 delta < 0、reason='expired' 的 tx
   - 更新 user.points -= expiredAmount

4. **`/api/cron/streak-decay/route.ts`**
   - 掃 Users where `streakDays > 0` AND `lastCheckinDate < (今天 TPE 0:00 - 1 天)`
   - 斷 streak → streakDays = 0 + create 一筆 streak-reset log

每個 endpoint 回 JSON `{ ok: true, processed: N, duration_ms: X }`。

### Task D: GitHub Actions workflow

`.github/workflows/cron.yml`：
```yaml
name: Scheduled Cron
on:
  schedule:
    - cron: '*/10 * * * *'   # automation + segments
    - cron: '0 3 * * *'      # expire-points daily @ 11am TPE (UTC+8)
    - cron: '0 16 * * *'     # streak-decay daily @ 00:00 TPE
  workflow_dispatch:
jobs:
  automations:
    if: github.event.schedule == '*/10 * * * *' || github.event_name == 'workflow_dispatch'
    runs-on: ubuntu-latest
    steps:
      - run: curl -fsS -X POST -H "Authorization: Bearer ${{ secrets.CRON_SECRET }}" https://pre.chickimmiu.com/api/cron/automations
      - run: curl -fsS -X POST -H "Authorization: Bearer ${{ secrets.CRON_SECRET }}" https://pre.chickimmiu.com/api/cron/segments
  expire-points:
    if: github.event.schedule == '0 3 * * *' || github.event_name == 'workflow_dispatch'
    runs-on: ubuntu-latest
    steps:
      - run: curl -fsS -X POST -H "Authorization: Bearer ${{ secrets.CRON_SECRET }}" https://pre.chickimmiu.com/api/cron/expire-points
  streak-decay:
    if: github.event.schedule == '0 16 * * *' || github.event_name == 'workflow_dispatch'
    runs-on: ubuntu-latest
    steps:
      - run: curl -fsS -X POST -H "Authorization: Bearer ${{ secrets.CRON_SECRET }}" https://pre.chickimmiu.com/api/cron/streak-decay
```

使用者需在 GitHub repo Settings → Secrets → `CRON_SECRET` 設相同值。寫到 `docs/session-prompts/06-github-secrets-setup.md`。

### Task E: 驗證 + push
```
pnpm tsc --noEmit
PAYLOAD_SECRET=dummy DATABASE_URI=file:./data/chickimmiu.db pnpm build
pnpm dev -p 3002
# 測未授權打 cron endpoint：
curl -s -w "%{http_code}\n" -X POST http://localhost:3002/api/cron/automations   # 應 401
curl -s -w "%{http_code}\n" -X POST -H "Authorization: Bearer bad" http://localhost:3002/api/cron/automations   # 401
# 有 token：
CRON_SECRET=test curl -s -w "%{http_code}\n" -X POST -H "Authorization: Bearer test" http://localhost:3002/api/cron/automations   # 200，JSON 回 processed: N
```

commit：
```
git checkout -b feat/cron-runner
git add src/lib/games/gameActions.ts src/app/\(frontend\)/api/cron/ .github/workflows/cron.yml .env.example docs/session-prompts/06-github-secrets-setup.md
git commit -m "$(cat <<'EOF'
feat(cron): protected cron endpoints + GitHub Actions scheduler + fix awardGamePoints

- 4 endpoints under /api/cron/* guarded by Bearer CRON_SECRET
  - automations: run schedule/condition journeys via automationEngine
  - segments: recompute all users' MemberSegment
  - expire-points: 365-day FIFO point expiry
  - streak-decay: reset stale streaks
- GitHub Actions workflow calls endpoints every 10min / daily
- awardGamePoints writes correct balanceAfter (was 0)

Without a real queue (bullmq/redis), cron endpoints serialize per request.
Acceptable for current scale; revisit if user count > 10k.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
git push -u origin feat/cron-runner
```

## Prod Deploy
```
cd /var/www/chickimmiu && git pull && pnpm install --frozen-lockfile && pnpm build && pm2 restart chickimmiu-nextjs
# 然後在 prod .env 加 CRON_SECRET=<與 GitHub secret 相同>
# 在 GitHub repo Settings → Secrets and variables → Actions 設 CRON_SECRET
# 最後 workflow_dispatch 手動觸發一次確認 200
```

## Guardrails
- 不碰：`src/seed/**`（組 01）、account/**（組 02）、Orders/cart（組 03）、`contact/size-guide/shipping/returns`（組 04）、`recommendationEngine.ts`（組 05）、next.config.mjs（組 07）
- 不用 force push
- cron endpoint 一定要驗 Bearer token，不然 DDoS 風險極高
- automation action 發信如果組 02 email adapter 沒 merge：log 而非 throw，避免整個 cron 爆
```

---
