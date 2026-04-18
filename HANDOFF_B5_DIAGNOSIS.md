# B5 Diagnosis — webpack `Cannot read properties of undefined (reading 'call')`

**Date:** 2026-04-18
**Session:** B5 dev-only investigation (no src/ changes)
**HEAD tested:** `7d6d364` (Phase 5.5.4)
**Next.js version:** `15.4.11` (deployed + local)

---

## TL;DR

**B5 is a dev-only HMR / React Refresh bug.** Clean prod build works correctly on every affected route. No code bisect needed. Stop-the-bleeding is the right posture; upgrading Next.js is the real fix but not urgent.

The "prod affected?" question previously looked ambiguous because port 3002 was serving a zombie prod server whose `.next/` had been overwritten by a later dev-server restart. Once tested in isolation (git worktree, fresh build, separate port), prod is completely clean.

---

## B1 — Is prod affected? **NO** ✅

### Evidence

| Environment | Route | Outcome |
|---|---|---|
| Live prod (`pre.chickimmiu.com`) | `/` | ✅ 200, no `bootErr`, no fallback |
| Live prod (`pre.chickimmiu.com`) | `/account/subscription` | ✅ 200, title `我的訂閱`, no `bootErr`, no fallback |
| Live prod (`pre.chickimmiu.com`) | `/login` | ✅ 200, no errors |
| Worktree prod (`7d6d364`, port 3005) | `/` | ✅ 200, chunks all 200 |
| Worktree prod (`7d6d364`, port 3005) | `/account/subscription` | ✅ `T:我的訂閱 H:我的帳戶 F:false E:0` |
| Worktree prod (`7d6d364`, port 3005) | `/account/orders` | ✅ `T:我的帳號 F:false E:0` |
| Worktree prod (`7d6d364`, port 3005) | `/account/points` SSR | ✅ HTTP 200 (redirects to /login client-side when unauthenticated) |
| Worktree prod (`7d6d364`, port 3005) | `/account/referrals` SSR | ✅ HTTP 200 |
| Worktree prod (`7d6d364`, port 3005) | webpack chunk | ✅ `/_next/static/chunks/webpack-1e740c0be1439423.js` → 200 |

Key signals on HEAD prod: `window.__ckmuBootErr` remained `[]`, no `[ckmu-recover]` console warnings, no `頁面載入失敗` fallback rendered, all JS chunks 200.

### Red-herring: port 3002

Port 3002 was running a **stale prod server from an earlier build** whose chunks (e.g. `webpack-1dfbac4c0c4ae064.js`) no longer existed in `.next/static/chunks/` — because the dev server on 3001 had since overwritten `.next/` with dev artefacts. All 45 chunk requests returned **503**. This was NOT the real B5 bug; it was a local-only artefact of dev/prod sharing `.next/`. Ignore.

### Root cause (suspected)

The stack trace the user saw — `/_next/static/chunks/webpack.js:704` inside a **React Refresh interceptor** — only exists in dev. React Refresh is stripped from prod bundles. In dev:

1. `window.addEventListener('error', …)` in [layout.tsx:283](src/app/(frontend)/layout.tsx#L283) catches an unhandled `TypeError: Cannot read properties of undefined (reading 'call')` from webpack's HMR wrapper.
2. React never reaches `BootBeaconCleanup`, so `window.__ckmuMounted` stays `0`.
3. After 4s the inline beacon script paints `頁面載入失敗` full-screen.

So the beacon fallback **is working as designed** — but the HMR error it's reacting to never happens in prod.

---

## B2 — First bad commit: **N/A** (skipped)

Not run — prod is clean, so there's no "bad commit" to find in prod terms. The dev-only symptom started manifesting on multiple account pages after Phase 5.5.4, but those are server-component changes that wouldn't affect webpack HMR; the more likely trigger is cumulative module count crossing a Next 15.4.11 dev-HMR threshold. Not worth bisecting for a dev-only cosmetic issue.

---

## B3 — Next.js 15.4.11 vs current

### Version landscape

```
Current project:  15.4.11
Latest stable:    16.2.4   (6 majors ahead)
15.x last patch:  15.3.9   (next-15-3 tag)
backport tag:     15.5.15
```

**15.4.11 is NOT on any long-term-support dist-tag.** 15.4 was the "Alpha Turbopack" release train; most stability fixes were backported to 15.5.x, not 15.4.x. Staying on 15.4.11 = stuck on a dev-HMR codebase that the Next team has moved past.

### Relevant upstream issues

| Issue | Title | Relevance | Status |
|---|---|---|---|
| [#43902](https://github.com/vercel/next.js/issues/43902) | `originalFactory is undefined` on client components | **High** — exact dev-mode error pattern | Closed via #44011 (pre-13.0.7); regressions re-observed in 14/15 |
| [#74167](https://github.com/vercel/next.js/issues/74167) | Turbopack: module factory not available on HMR | Medium — Turbo-only, we use webpack dev | Open, Turbopack team tracking |
| [#70703](https://github.com/vercel/next.js/issues/70703) / [#78122](https://github.com/vercel/next.js/issues/78122) | Stale client assets after deployment | Not us — prod-only, different symptom | Open |
| [#61995](https://github.com/vercel/next.js/issues/61995) | 14.1.0 `(reading 'call')` in prod | Similar wording, different cause | Partial fix in canary |
| [#79385](https://github.com/vercel/next.js/issues/79385) | React Compiler broken since 15.3.1 | Not us (`reactCompiler: false`) | Closed via #79479 |

The pattern across these is: when the webpack chunk graph / HMR boundary gets complex, the dev runtime occasionally serves a module factory that hasn't finished loading yet, so the `__webpack_require__(id).call(…)` call blows up. It's been a long-running paper-cut in Next 13→15 webpack dev; 15.5+ and 16.x rewrote much of the HMR runtime.

### Also in dev log: `⨯ reactCompiler`

Despite `experimental.reactCompiler: false` in [next.config.mjs:22-24](next.config.mjs#L22), Next 15.4 still logs `⨯ reactCompiler` at boot. This is just Next complaining that the key is recognised as experimental — it does NOT mean React Compiler is running. Not relevant to the bug. (It goes away in 15.5+ where `reactCompiler` is promoted to stable.)

---

## Recommended fixes (Group C)

### Option 1 — Suppress the dev-only beacon false positive (LOW RISK, FAST)

Gate the 4-second inline beacon script to `process.env.NODE_ENV === 'production'` in [layout.tsx:283](src/app/(frontend)/layout.tsx#L283). Optionally also make the `window.addEventListener('error', …)` capture ignore errors sourced from `/_next/static/chunks/webpack*.js` (since React Refresh errors there are recoverable).

- **Risk:** minimal — pure dev UX cleanup. Prod behaviour unchanged.
- **Effort:** 15–30 min + manual dev-mode smoke test.
- **Downside:** Doesn't fix the underlying HMR error; devs still see the red overlay, just not the beacon. But today's symptom (devs thinking pages are broken) goes away.

### Option 2 — Upgrade Next.js 15.4.11 → 15.5.15 (backport tag) (MEDIUM RISK, MEDIUM EFFORT)

Stay on the 15.x branch but move to the LTS-style backport release that has 15.5's HMR stability fixes.

- **Risk:** moderate. 15.5 promoted `reactCompiler` config shape, tweaked `experimental` keys, and has some changes to `after()` / dynamic routes. All documented in https://nextjs.org/docs/app/guides/upgrading/version-15.
- **Effort:** 2–4 h including smoke-test of admin, checkout, wishlist, games.
- **Expected outcome:** B5 likely disappears.

### Option 3 — Upgrade to Next.js 16.x (HIGHER RISK, BIGGER EFFORT)

Jump to the current stable. Bigger payoff (Turbopack production builds, caching improvements) but bigger migration surface.

- **Risk:** high. Breaking changes documented at https://nextjs.org/docs/app/guides/upgrading/version-16 — params/searchParams are async, some middleware/RSC semantics changed. Needs regression sweep across every Payload admin panel + frontend page.
- **Effort:** 1–2 days.
- **Expected outcome:** B5 fixed, plus broader dev-experience wins.

### Option 4 — Do nothing (NOT RECOMMENDED but valid)

B5 only reproduces in `pnpm dev` on some page loads. Closed-beta customers hit prod, which is fine. If no dev is blocked, the bug is purely cosmetic.

- **Downside:** erodes confidence in the beacon fallback (cried wolf), wastes dev sessions investigating ghost issues. Will come back next time HMR graph shifts.

### Suggested plan

Do **Option 1** now in a small PR (kills the false-positive), then schedule **Option 2** for the next quiet week. Reserve Option 3 for when we're ready to adopt Turbopack production builds.

---

## Next step — prompt template for Group C session

Open a fresh session with:

> 你是 CHIC KIM & MIU 的前端工程師。B5 bug 的診斷報告在 HANDOFF_B5_DIAGNOSIS.md，
> 結論是 **dev-only**。請執行 **Option 1（Group C 低風險止血）**：
>
> 1. 讀 HANDOFF_B5_DIAGNOSIS.md 理解 context。
> 2. 編輯 src/app/(frontend)/layout.tsx 第 283 行的 inline `<script>`：
>    - 用 `process.env.NODE_ENV === 'production'` 包住「4 秒 beacon」段
>      以及 `window.addEventListener('error', ...)` 的 capture。
>    - 或者保留 error capture，但在 `rec(m, s)` 內加一個
>      `if (/\/_next\/static\/chunks\/webpack[-.]/.test(s)) return;`
>      把 webpack-runtime 的錯誤濾掉（避免誤報，但保留其他錯誤捕捉）。
>    - 建議兩者都做：error 過濾 + 4 秒 beacon 只在 prod 起。
> 3. 改完後：
>    - `pnpm dev` → 訪 /account/subscription + /account/points，
>      確認 console 仍有 webpack 錯誤但 **不再出現「頁面載入失敗」全屏 fallback**，
>      `window.__ckmuMounted === 1`。
>    - `pnpm build` → `pnpm start -p 3006`（用 3006 避開殘留 server），
>      訪同樣路由確認 prod 行為不變。
> 4. commit: `fix(phase5.5.5): gate boot-beacon fallback to prod only + filter webpack dev-HMR noise`
>
> 禁止觸碰其他檔案。禁止做 Next.js 升級（那是 Option 2，另案）。
>
> 交付：commit hash + 一行驗證結果。

---

## Artefacts kept

- `/c/Users/mjoal/ally-site/chickimmiu-b5test/` — git worktree at `7d6d364`, built & tested prod. **Safe to remove** with `git worktree remove chickimmiu-b5test` once Group C session confirms findings.
- `.claude/launch.json` — `chickimmiu-prod` config (port 3004) added but never used (3005 was used directly via Bash). Safe to leave or remove.

## Working-tree changes this session

- `.claude/launch.json` — added `chickimmiu-prod` entry (port 3004).
- Files not touched: `src/**`, `next.config.mjs`, `PHASE4_HANDOFF.md`, `package.json`.
- Did not touch `src/app/(frontend)/layout.tsx` (other session owns it).
