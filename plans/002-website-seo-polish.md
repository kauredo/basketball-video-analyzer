# Plan 002: Website SEO polish — dedupe meta description, tailored homepage description, Twitter meta attributes, refresh stale TODO.md

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md`.
>
> **Drift check (run first)**:
> `cd website && git diff --stat 6c6cf68..HEAD -- src/layouts/BaseLayout.astro src/pages/index.astro`
> If either file changed since this plan was written, compare the "Current
> state" excerpts against the live code before proceeding; on a mismatch,
> treat it as a STOP condition.

## Status

- **Priority**: P2
- **Effort**: S
- **Risk**: LOW
- **Depends on**: none
- **Category**: dx / docs (SEO hygiene)
- **Planned at**: website repo commit `6c6cf68`, 2026-07-10

## Why this matters

The repo's `TODO.md` lists five "SEO Technical (Missing Basics)" items, but an
audit on 2026-07-10 found four of the five already done (sitemap live and
returning HTTP 200, AI crawlers allowed in robots.txt, OG tags complete, title
redundancy fixed via `fullTitle`). What actually remains is small: a duplicated
`<meta name="description">` in the layout, a homepage that falls back to the
generic default description instead of a tailored one, and Twitter meta tags
using `property=` where the Twitter/X spec expects `name=`. TODO.md itself is
badly stale and misleads anyone (human or agent) who reads it for direction —
refreshing it is part of this plan.

## Current state

**Website repo** (`website/`, its own git repo).

- `website/src/layouts/BaseLayout.astro:32-44` — the description meta appears
  **twice** (lines 34 and 40):
  ```astro
  <head>
    <meta charset="UTF-8" />
    <meta name="description" content={description} />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />

    <!-- Primary Meta Tags -->
    <title>{pageTitle}</title>
    <meta name="title" content={pageTitle} />
    <meta name="description" content={description} />
  ```
- `BaseLayout.astro:55-60` — Twitter tags use `property=`:
  ```astro
  <!-- Twitter -->
  <meta property="twitter:card" content="summary_large_image" />
  <meta property="twitter:url" content={canonicalURL} />
  <meta property="twitter:title" content={pageTitle} />
  <meta property="twitter:description" content={description} />
  <meta property="twitter:image" content={socialImage} />
  ```
- `BaseLayout.astro:9-23` — props: `title`, `fullTitle?`, `description?`
  (default: `'Free basketball video analysis tool. Cut, organize, and export
  game footage. Built by a coach, for coaches.'`), `image?`, `type?`.
- `website/src/pages/index.astro:21-24` — homepage passes no `description`:
  ```astro
  <BaseLayout
    title="Free Basketball Video Analysis Tool"
    fullTitle="Basketball Video Analyzer — Free Video Analysis Software for Coaches"
  >
  ```
- `TODO.md` at the **monorepo root** (`/…/basketball-video-analyzer/TODO.md` —
  NOT inside any git repo; just edit the file). Stale claims verified false on
  2026-07-10:
  - "Create sitemap.xml (currently 404)" — `@astrojs/sitemap` is registered in
    `website/astro.config.mjs` with `site` set;
    `https://basketballvideoanalyzer.com/sitemap-index.xml` returns 200.
  - "Add meta description to homepage" — BaseLayout emits a default; the real
    gap is only that the homepage doesn't pass a tailored one.
  - "Complete OG tags" — og:title/description/image/url/type/site_name all
    present (`BaseLayout.astro:48-53`).
  - "Fix title tag redundancy" — fixed via `fullTitle` (`index.astro:23`).
  - "Allow AI crawlers in robots.txt" — `website/public/robots.txt` already
    allows GPTBot, ChatGPT-User, ClaudeBot, Claude-Web, PerplexityBot,
    Google-Extended, Bytespider.
  - Under "Product": item 1 keyboard tagging — DONE (quick-tag keys 1-9 exist,
    `app/src/renderer/components/VideoPlayer.tsx:303-306`, listed in the app's
    ShortcutsModal); item 3 auto-naming — DONE (`Q1_MM:SS_Category` format,
    `app/src/renderer/App.tsx:453-456`); item 4 YouTube import — DONE
    (`download-youtube-video` handler in `app/src/main/main.ts:1686` +
    `YouTubeImport.tsx`); item 5 save/load sessions — mostly done
    (`save-session`/`load-session` handlers in `app/src/main/main.ts:1506/1582`
    plus UI in ClipLibrary export menu and ProjectSelector; remaining gap is
    covered by plans/006).

## Commands you will need

| Purpose | Command | Expected on success |
|---|---|---|
| Build | `cd website && npm run build` | exit 0 |
| Grep checks | see Done criteria | as stated |

## Scope

**In scope**:
- `website/src/layouts/BaseLayout.astro`
- `website/src/pages/index.astro`
- `TODO.md` (monorepo root)

**Out of scope** (do NOT touch):
- `website/public/robots.txt`, `website/astro.config.mjs` — already correct.
- The JSON-LD blocks in BaseLayout (`:70-119`) — correct as-is.
- The other pages (`film-breakdown`, `for-coaches`, `scouting`,
  `free-alternative`, `404`) — they already pass descriptions.
- The keywords meta tag — low value but harmless; leave it.
- Do not add new meta tags (theme-color, hreflang, etc.) — not requested.

## Git workflow

- Website repo: branch `fix/seo-polish` off `main`. Conventional commits
  (`fix: ...` / `docs: ...`).
- Do NOT push or open a PR unless the operator instructed it.
- Do not mention AI tools in commit messages and do not add AI co-author lines.

## Steps

### Step 1: Remove the duplicate description meta

In `BaseLayout.astro`, delete line 34
(`<meta name="description" content={description} />` — the one immediately
after `<meta charset="UTF-8" />`). Keep the one at line 40 inside the
"Primary Meta Tags" block.

**Verify**: `grep -c 'name="description"' website/src/layouts/BaseLayout.astro` → `1`

### Step 2: Twitter meta tags use `name=`

In `BaseLayout.astro:56-60`, change the five `property="twitter:*"` attributes
to `name="twitter:*"` (values unchanged).

**Verify**: `grep -c 'property="twitter' website/src/layouts/BaseLayout.astro` → `0` and `grep -c 'name="twitter' ...` → `5`

### Step 3: Tailored homepage description

In `index.astro`, add a `description` prop to the `<BaseLayout>` invocation:

```astro
description="Free, open-source basketball video analysis for coaches. Cut and tag clips with keyboard shortcuts, organize by category and player, draw on the film, and export — all offline, on Windows, macOS, and Linux."
```

(155–160 chars; if you adjust wording, stay under ~165 chars and keep it plain
factual — no marketing superlatives.)

**Verify**: `cd website && npm run build` → exit 0; then
`grep -o 'name="description" content="[^"]*"' dist/index.html | head -1` →
contains "open-source basketball video analysis".

### Step 4: Refresh TODO.md

Edit the monorepo-root `TODO.md`:

1. In "SEO Technical (Missing Basics)": mark all five checkboxes done
   (`- [x]`) and append a short parenthetical to the section title:
   `(verified done 2026-07-10 — sitemap live, robots.txt allows AI crawlers, OG complete, titles fixed via fullTitle)`.
2. In "Product": strike through items 1, 3, 4 the way item 2 already is
   (`### ~~1. Add keyboard tagging~~ ✅ DONE` etc.), each with a one-line note
   of where the feature lives (use the file references from "Current state"
   above). For item 5, note "remaining gap tracked in plans/006".
3. Update the "Last updated" line at the top to 2026-07-10.
4. Do not delete the SEO Roadmap / Growth sections — they are future work.

**Verify**: `grep -c "✅ DONE" TODO.md` → ≥ 5.

## Test plan

No test suite. The build plus the greps above are the gates. Optionally view
`dist/index.html` and confirm exactly one description meta and five
`name="twitter:*"` metas.

## Done criteria

- [ ] `cd website && npm run build` exits 0
- [ ] `grep -c 'name="description"' website/src/layouts/BaseLayout.astro` → 1
- [ ] `grep -c 'property="twitter' website/src/layouts/BaseLayout.astro` → 0
- [ ] Homepage `<BaseLayout>` has a `description` prop
- [ ] TODO.md updated per Step 4
- [ ] No files outside the in-scope list are modified (`git status`)
- [ ] `plans/README.md` status row updated

## STOP conditions

Stop and report back if:

- BaseLayout.astro's head no longer matches the excerpts (someone already
  fixed or restructured it) — report which steps are obsolete.
- The build fails for a reason unrelated to your edit.

## Maintenance notes

- Any future page must pass its own `description`; the BaseLayout default is a
  fallback, not a strategy.
- The next SEO work after this is content (see plans/003 and the SEO Roadmap
  section retained in TODO.md), not more meta-tag tuning.
