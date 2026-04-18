# Session 7 Handoff — 2026-04-17 / 18

**User:** Alan Miaou (mjoalen@gmail.com)
**Scope:** Phase 5.5.4 FIFO expiring points + Phase 5.5.5 B5 Fix-1 (webpack factory-undefined auto-recover regex)
**Commits this session:** `7d6d364`, `6833a2c` (+ parallel session `fbed814` A2 copy fix)
**State at end:** 3 commits ahead of `origin/main` (not pushed — user pushes manually). `.claude/launch.json` has uncommitted local tweak; `HANDOFF_B5_DIAGNOSIS.md` untracked (parallel session artefact).

---

## What this session shipped

### ✅ Phase 5.5.4 — `/account/points` expiringPoints FIFO aggregation (`7d6d364`)

Replaces the Phase 5.5 hardcoded `expiringPoints: 0` with real FIFO math.

- `computeExpiringPoints(txns, validityDays, windowDays)` inline in [src/app/(frontend)/account/points/page.tsx](src/app/(frontend)/account/points/page.tsx) (same style as `pickTierName`/`computeBadge`/`formatDate` — inline helpers, no new `src/lib/points/` dir yet, extract later if re-used).
- Added 6th entry to existing `Promise.all` pulling all user's `points-transactions` within last 730 days ASC with `pagination: false`. Separate from the 20-row history query (which stays as-is for UI).
- Admin-configurable via existing globals:
  - `LoyaltySettings.pointsConfig.pointsExpiryDays` (fallback 365, `0` = never expire)
  - `PointRedemptionSettings.expiryNotification.reminderDays[].days` max (fallback 30)
  - Respects `expiryNotification.enabled` + `showCountdown` flags
- Business rule (user confirmed 2026-04-17): **365-day validity derived from `createdAt + pointsExpiryDays`**. `PointsTransactions.expiresAt` field stays in schema but is **ignored** by the calculation (single source of truth).
- Verified: `tsc --noEmit` clean · SSR `GET /account/points` → 200 · 5/5 algorithm test cases pass (earn+fresh / FIFO spend / perpetual / no-window-batches / oversized-spend).

### ✅ Phase 5.5.5 — B5 Fix-1 (`6833a2c`)

Auto-recover regex extension for webpack factory-undefined crashes.

- [src/app/(frontend)/layout.tsx:255](src/app/(frontend)/layout.tsx#L255) — one-line regex widening: added `reading 'call'|'call' of undefined` to `isChunkErr()`.
- Covers modern V8 wording `Cannot read properties of undefined (reading 'call')` + legacy `Cannot read property 'call' of undefined`.
- Recon showed the bug: browser HTTP-caches non-versioned chunks (`app-pages-internals.js`, `app/(frontend)/layout.js`, `app/(frontend)/error.js`) across `next dev` recompiles; new `webpack.js` runtime has new module ID table; old cached chunks have old IDs; `__webpack_require__(OLD_ID)` gets `undefined` factory; `.call()` explodes. Existing regex didn't match this error, so `recover()` never fired and the BootBeacon fallback (`頁面載入失敗`) took over after 4s.
- Verified: cooldown `sessionStorage.__ckmu_chunk_reload_ts__` gets set on cold load of `/account/points` = `recover()` matched and ran. URL carries recover's own base36 cache-bust.
- Known limitation (documented in HANDOFF): **dev mode doesn't fully self-heal** because browser-cached non-versioned chunks persist across HTML reloads. Manual Ctrl+Shift+R still needed for full dev recovery. **Prod uses content-hashed filenames so auto-heal works end-to-end.**
- Parallel session (`fbed814`, A2) followed up by rewriting [src/app/global-error.tsx](src/app/global-error.tsx) copy to a neutral technical-error message (was misleadingly blaming browser privacy settings, causing CS to triage wrong root cause).

---

## Parallel session findings (`HANDOFF_B5_DIAGNOSIS.md`)

Another Claude session ran rigorous prod verification in a git worktree:

- ✅ **Prod (`pre.chickimmiu.com`) is NOT affected by B5.** All tested routes returned 200 with empty `__ckmuBootErr`, no fallback painted. Worktree `next build && next start` also clean.
- ✅ **B5 is dev-only** — the error originates in React Refresh/HMR runtime which is stripped from prod bundles.
- Upstream cause: Next.js 15.4.11 dev-HMR edge case (`originalFactory is undefined`, [vercel/next.js#43902](https://github.com/vercel/next.js/issues/43902)). 15.4 was the "Alpha Turbopack" release train; stability fixes went into 15.5.x backports.
- **Recommended follow-up work** (NOT done this session):
  - **Option 1 / Group C (15–30 min, low risk):** gate the 4-second beacon script + `window.addEventListener('error', ...)` to `process.env.NODE_ENV === 'production'` in [layout.tsx:283](src/app/(frontend)/layout.tsx#L283). Add a `rec()` filter that drops errors sourced from `/_next/static/chunks/webpack*.js`. Eliminates the dev-mode false positive. Parallel session left a fully-written prompt template at the bottom of `HANDOFF_B5_DIAGNOSIS.md` for this session.
  - **Option 2 (2–4 h, medium risk):** upgrade `15.4.11 → 15.5.15` (backport tag). Likely resolves B5 entirely.
  - **Option 3 (1–2 days, higher risk):** jump to Next 16.x. Breaking changes across params/searchParams + middleware/RSC.

---

## Prod verification done this session

| Check | Result |
|---|---|
| `curl -I https://pre.chickimmiu.com/` | 200, `Cache-Control: no-store` on HTML ✓ |
| Chunk filenames | All content-hashed (`webpack-3a9cd626d6412814.js`, etc.) — production build ✓ |
| `curl -I /_next/static/chunks/webpack-*.js` | 200, `Last-Modified` + `ETag` only, **no `Cache-Control` header** ⚠️ (minor perf issue, not correctness — hashed URLs are safe without long cache, just slower revalidation) |
| `grep "reading 'call'"` on prod HTML | 0 matches → **Fix-1 not yet deployed** (waiting for user's push + redeploy) |
| BootBeacon pipeline on prod | `__ckmuBootErr` + cooldown key + BootBeacon all present ✓ |

---

## Commits awaiting push

```
6833a2c fix(phase5.5.5): auto-recover catches webpack factory-undefined crashes
7d6d364 feat(phase5.5.4): /account/points expiringPoints FIFO aggregation
fbed814 fix(phase5.5-b5a): rewrite global-error copy for webpack runtime errors  ← parallel session
```

Origin still at `0503e18`. User pushes manually (Claude never pushes per standing rule).

---

## Next-session pickup menu

User's backlog (from session open):

- **A. B1** expiringPoints FIFO — ✅ DONE this session
- **B. B4** cloudflared + next dev autostart — Memory note: Hetzner prod is on Postgres+nginx (2026-04-17 prod move), so this is now local DX only, deprioritised
- **C. B5** BootBeacon hydration bug — ✅ recon + Fix-1 + A2 copy shipped. **Follow-up available:** Option 1 / Group C (see `HANDOFF_B5_DIAGNOSIS.md` bottom prompt) to gate beacon to prod-only + filter webpack noise. Safer than Option 2/3 upgrades.
- **D. B7** orphan gamification scope decision — NOT started. SpinWheel / ScratchCard / FashionChallenge / DailyCheckIn: still need business call on Modal surface vs delete.

### Cleanup loose ends

- [x] Push 3 commits (user action) — done post-session; origin/main now at `27fffdd`
- [x] Redeploy prod (user action — Hetzner SSH flow) — done ~14:05+ TPE 2026-04-18
- [x] `git worktree remove ../chickimmiu-b5test` — removed (not present in `git worktree list`)
- [x] `.claude/launch.json` — verified already tracked in Initial commit `6270e1a`, no uncommitted diff
- [x] `HANDOFF_B5_DIAGNOSIS.md` final home — **root** (consistent with HANDOFF_PHASE5.4/5.5.md + PHASE4_HANDOFF.md)

---

## Post-session addendum (2026-04-18 session 8 cleanup)

**Additional commits landed after session 7 close** (via parallel session following the Option 1 / Group C prompt in `HANDOFF_B5_DIAGNOSIS.md`):

```
bd1f5c0 feat(phase5.6-auth): wire email/pw login + register + forgot/reset (ISSUE-001/002/003)  ← active parallel session
183514d docs(qa): 2026-04-18 closed-beta QA report + 9 issues + PR #2 handoff
27fffdd docs(next-15-5): record rebase+FF merge of 15.5.15 upgrade into main
0e09ddb docs(next-15-5): handoff for Next.js 15.4.11 -> 15.5.15 upgrade
50624ed chore(next-15-5): bump next + eslint-config-next to 15.5.15
fa1db25 fix(phase5.5.6b): replace regex w/ indexOf in beacon rec() filter         ← Option 1-B (cleaner than stashed regex WIP)
2d12ec7 fix(phase5.5.6): gate boot beacon <script> to production only             ← Option 1-A
```

The `2d12ec7` + `fa1db25` pair **fully implements Option 1 / Group C** from Session 7's "Next-session pickup menu" — beacon now renders only when `process.env.NODE_ENV === 'production'`, and `rec()` drops errors sourced from `/_next/static/chunks/webpack*.js` via `indexOf` (cleaner than the regex in the superseded WIP stash). The layout.tsx variant I had stashed at session close is **obsolete**.

**Prod verification (2026-04-18 03:24 GMT curl)**

| Check | Result |
|---|---|
| `curl https://pre.chickimmiu.com/` → grep `indexOf` | present ✓ (fa1db25 deployed) |
| `curl …/` → grep `reading 'call'` | present ✓ (Fix-1 6833a2c deployed — resolves original regex gap) |
| `curl …/` → grep `__ckmuBootErr` | present ✓ (beacon pipeline rendering in prod as expected) |
| HTML `Cache-Control` header | `no-store, no-cache, must-revalidate, max-age=0` ✓ |

Prod is carrying the full B5 fix stack: `6833a2c` (Fix-1 regex extension) + `fbed814` (A2 copy) + `2d12ec7` (prod-gate) + `fa1db25` (indexOf filter).

**Lingering stashes (not dropped)**

```
stash@{0} on feat/next-15-5-upgrade: layout.tsx (obsolete WIP) + HANDOFF_SESSION7.md (this file, now committed)
stash@{1} on main: HANDOFF_B5_DIAGNOSIS.md (now committed)
```

Both stashes are **redundant** after this cleanup commit. User may drop with `git stash drop stash@{0}` + `git stash drop stash@{1}` at convenience. Kept because parallel session was active in the same working tree during cleanup (see reflog `HEAD: fa1db25 → 183514d → bd1f5c0` during a ~5-min window) and destructive stash ops were deferred.

**Branch `feat/next-15-5-upgrade`** — local-only, already FF-merged into main. Safe to `git branch -d feat/next-15-5-upgrade` when user confirms.

---

## Session rules observed

- No `git push` / `pull` / `merge` / `rebase` / `reset` (standing user instruction)
- `tsc --noEmit` clean after each commit
- Every commit bundles code + HANDOFF update with `(updates HANDOFF)` in subject
- Closed beta posture: admin-configurable params over hardcoded constants; conservative change radius; document trade-offs before shipping
- Parallel session coordination: `git log --oneline -10` + status check before starting work to avoid redoing finished batches

---

**Session closed:** 2026-04-18. Context usage approached but did not exceed user's ~60% warning threshold. No context compaction triggered.
