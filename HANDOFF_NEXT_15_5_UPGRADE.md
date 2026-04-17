# Next.js 15.4.11 → 15.5.15 Upgrade — Handoff

**Date:** 2026-04-18
**Branch:** `feat/next-15-5-upgrade`
**Head commit:** `ad12d5b` (chore: bump next + eslint-config-next to 15.5.15)
**Scope:** Option 2 from [HANDOFF_B5_DIAGNOSIS.md](HANDOFF_B5_DIAGNOSIS.md) (LTS backport, stay on 15.x branch).

---

## TL;DR

- Upgraded `next` and `eslint-config-next` from 15.4.11 → 15.5.15.
- **No source code changes needed.** `next.config.mjs`, `tsconfig.json`, and all `src/**` untouched.
- `tsc --noEmit` clean (0 errors).
- `pnpm build` clean (0 warnings, 0 errors).
- All 10 smoke-test routes return SSR 200.
- **B5 消失: YES** on fresh browser cache (see §B5 below).
- **One peer-dep warning carried forward**, see §Payload compatibility.

---

## B5 消失: **YES** ✅ (with caveat)

**Verification method:** launched the 15.5.15 dev server on a fresh port (3099)
to force the preview browser to load all chunks from scratch — no shared cache
with prior 15.4.11 sessions. Ran:

- Initial navigation to `/account/points` → `mounted=1, errCount=0` ✓
- 3 consecutive `location.reload()` → all `mounted=1, errCount=0` ✓
- HMR trigger via `touch src/app/(frontend)/account/points/page.tsx` → recompiled 2353 modules in 782ms, page still `mounted=1, errCount=0` ✓

**No webpack `Cannot read properties of undefined (reading 'call')` under any condition tested on the fresh cache.**

### Caveat — dev machines with polluted cache need Ctrl+Shift+R once

During diagnosis I reproduced the old B5 error on the existing `localhost:3001`
profile **even after** the upgrade. Root cause isolated:

```
fetch('/_next/static/chunks/app-pages-internals.js')  → 15.4.11 bytes (cached)
                                       + headers: Cache-Control: public, max-age=31536000, immutable
                                                  Date: Mon, 13 Apr 2026 21:02:00 GMT
fetch(same, {cache:'no-store'})         → 15.5.15 bytes (fresh, 24KB smaller)
```

The browser has a 1-year `immutable` cache entry for `app-pages-internals.js`
from a prior `pnpm start` / prod-mode session at `localhost:3001` (probably
the worktree experiment noted in `HANDOFF_B5_DIAGNOSIS.md`). Under
`Cache-Control: immutable`, the browser never re-validates until the year
expires, so it keeps serving 15.4.11 bytes to the 15.5.15 webpack runtime —
classic chunk-ID mismatch → `factory() is undefined` → B5.

The current dev server correctly serves chunks with
`Cache-Control: no-store, must-revalidate`, so **no new cache pollution will
happen going forward**.

### Action for developers after merging this PR

Run once to drop the stale cache:

- **Chrome/Edge:** open DevTools → Network tab → "Disable cache" checkbox, OR
  Ctrl+Shift+Del → clear "Cached images and files" scoped to `localhost`, OR
  Ctrl+Shift+R on `localhost:3001`.
- **Firefox:** Ctrl+F5 on `localhost:3001`.

One-time inconvenience. After that, B5 should not return.

### Why the Option-1 filter (commit `6833a2c`) is still useful

Two reasons to keep the filter in place for now (the user asked not to revert
it yet anyway):

1. Developers who haven't cleared their browser cache will still hit the same
   mismatch until they do. The filter is their safety net for that
   transitional period.
2. Similar chunk-ID mismatches can still happen during extremely long HMR
   sessions even on 15.5.15; the filter remains cheap insurance.

Revert consideration for a follow-up PR after 2–3 weeks of team usage on
15.5.15, once everyone has cleared caches and we've got a feel for the new
baseline.

---

## What changed

### Dependencies

```diff
  "dependencies": {
-   "next": "15.4.11",
+   "next": "15.5.15",
  },
  "devDependencies": {
-   "eslint-config-next": "15.4.11",
+   "eslint-config-next": "15.5.15",
  }
```

### `next.config.mjs`

**No changes.** Audited against the
[Next 15 upgrade guide](https://nextjs.org/docs/app/guides/upgrading/version-15)
and the [15.5 release notes](https://nextjs.org/blog/next-15-5):

| Area | Status |
|---|---|
| `serverExternalPackages` | Already using stable name (not `experimental.serverComponentsExternalPackages`). No change. |
| `experimental.reactCompiler: false` | Still a recognised experimental flag in 15.5. The dev-log `⨯ reactCompiler` message that appeared in 15.4 still appears in 15.5 — cosmetic, not an error. Keeping explicit `false` is harmless. |
| `images.qualities` | Not needed — we don't pass `quality={100}` anywhere, so no Next-16 deprecation warning. |
| `images.localPatterns` | Not needed — we don't pass query strings to local `<Image src>`. |
| `async headers()` / cache-control rules | Unchanged. Already correct for 15.5. |
| Turbopack | Kept on webpack per session directive. No `--turbopack` flag anywhere. |

### `src/**`

**No changes.** Async `cookies/headers/params/searchParams` migration was
already done in a prior 14 → 15 upgrade. No `useFormState`, no
`experimental-edge` runtime, no `@next/font`, no `legacyBehavior` Link — i.e.
none of the patterns that would require a rewrite in 15.x.

### Misc

- `node_modules/.pnpm/` had an orphaned `next@15.4.11_...` directory after
  the `pnpm up`; `pnpm prune` cleaned it up.
- `pnpm install` had to be forced once because the first `pnpm up` left
  `node_modules/.pnpm/@types+react@19.2.14/node_modules/@types/react/`
  empty (Windows/pnpm hydration quirk). `rm -rf` that directory +
  `pnpm install --force` fixed it. Subsequent runs are fine; not expected
  to repeat on fresh clones.

---

## Regression verified (10 routes)

All via SSR 200 with `curl`, plus in-browser verification of a subset on the
clean port 3099 (fresh cache):

| Route | SSR 200 | In-browser |
|---|---|---|
| `/` | ✓ (0.5s) | `mounted=1, err=0` |
| `/products` | ✓ (0.4s) | `mounted=1, err=0, title="全部商品｜CHIC KIM & MIU"` |
| `/products/[slug]` (`candace-straight-pants-dark`) | ✓ (0.4s) | — |
| `/cart` | ✓ (1.3s) | `mounted=1, err=0, title="購物車"` |
| `/checkout` | ✓ (1.9s) | — |
| `/account/subscription` | ✓ (2.9s) | `mounted=1, err=0, title="我的訂閱"` |
| `/account/points` | ✓ (2.4s) | `mounted=1, err=0, title="點數 / 購物金"` (3 reloads + HMR all clean) |
| `/account/orders` | ✓ (2.0s) | — |
| `/account/referrals` | ✓ (1.7s) | — |
| `/admin` | ✓ (14s first compile) | `err=0, title="Dashboard ｜CHIC KIM & MIU 後台"` |
| `/games` | ✓ (2.3s) | Compiled 5111 modules, 0 errors (browser nav ended on `/` due to game-select redirect, see server log) |

Server log on dev-mode compile for `/account/points`:
```
✓ Compiled /account/points in 2.1s (2353 modules)
Generating import map ... No new imports found
```

No errors, no warnings, no Fast Refresh full-reloads under normal navigation.

---

## Payload compatibility — peer-dep warning (carried forward)

`@payloadcms/next@3.82.1` declares:

```
peerDependencies: next '>=15.2.9 <15.3.0 || >=15.3.9 <15.4.0 || >=15.4.11 <15.5.0 || >=16.2.2 <17.0.0'
```

Every released 3.x version (checked up to `3.84.0-canary.1`) uses this same
range — Payload 3.x **intentionally skips 15.5.x** in its peer matrix,
reserving next-LTS support for Next 16.2+. Running 15.5.15 produces a
`pnpm install` warning:

```
✕ unmet peer next@"...": found 15.5.15
```

**Empirically functional**, verified by:
- `pnpm build` (includes Payload admin compile) — passes with zero warnings.
- `/admin` renders the Payload dashboard correctly — `mounted=1, err=0`,
  title `Dashboard ｜CHIC KIM & MIU 後台`.
- `pnpm tsc --noEmit` — zero errors across the full project (Payload types
  resolve fine).
- Payload's runtime `✓ Pulling schema from database` succeeds on dev boot.

**Risk assessment:** low but non-zero. The peer range is Payload's way of
saying "we didn't QA against 15.5.x." Known 15.5 surface area that *could*
interact with Payload:
- Node.js middleware runtime (now stable) — Payload doesn't use `middleware.ts`
  in this project, so N/A.
- Typed routes (now stable) — gated behind `typedRoutes: true`, which we
  don't set. N/A.
- `next lint` deprecation — purely a linter concern; we have
  `eslint.ignoreDuringBuilds: true` so it never runs in build. N/A.

**Mitigation:** if a runtime issue surfaces, the fastest revert is to
`pnpm up next@15.4.11 eslint-config-next@15.4.11` (single commit revert —
this PR is one commit). We explicitly kept Payload on 3.82.x per the "don't
bump Payload major" session directive.

---

## Not done (out of scope per session directive)

- ❌ React 19 → 20 upgrade (explicitly forbidden).
- ❌ Payload CMS 3 → 4 upgrade (explicitly forbidden).
- ❌ Turbopack production builds (`next build --turbopack`).
- ❌ Next 16.x (Option 3). 16.x brings `--turbopack` stable and more fixes
  but has a larger breaking-change surface (async `params`/`searchParams`
  enforcement gets stricter, middleware/RSC semantics shifted, AMP/
  `legacyBehavior` removed). Revisit for a future upgrade session.
- ❌ Revert of the `isChunkErr` regex filter (commit `6833a2c`). Per
  session directive: keep both safeguards for now. Schedule revert after
  2–3 weeks of team usage on 15.5.15.

---

## Rollback playbook

If a regression is found in prod after merging:

```bash
git revert ad12d5b       # reverts the version bump cleanly
pnpm install
```

Or pin-and-push:

```bash
pnpm up next@15.4.11 eslint-config-next@15.4.11
# commit + push
```

Because no source code or config changed, revert is a one-commit operation
with zero code-merge risk.

---

## Artefacts

- `.claude/launch.json` — a temporary `chickimmiu-next-155` (port 3099)
  config was added mid-session to bypass the preview browser's cached copy
  of `localhost:3001` chunks during B5 verification, then reverted before
  commit. Current `launch.json` is the original single-entry `chickimmiu-next`.
- No worktrees were created for this upgrade (the `HANDOFF_B5_DIAGNOSIS.md`
  mentions a `chickimmiu-b5test/` worktree — that's a separate artefact from
  the prior diagnostic session, still safe to `git worktree remove`).

---

## Sign-off checklist (for merger)

Before merging:

- [ ] Developer who reviews this PR should clear their browser cache for
      `localhost:3001` once after pulling the branch (per §B5 caveat).
- [ ] Re-run `pnpm build` locally to confirm no environment-specific issues.
- [ ] Optional: manually click through `/account/points`, `/account/subscription`,
      and the admin dashboard after cache-clear to spot-check.
- [ ] Remember: the Payload peer-dep warning will appear in `pnpm install`
      output. Expected, documented above.
