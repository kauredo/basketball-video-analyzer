# Plan 003: Add two comparison pages — /vs-inbound-studio and /hudl-alternatives

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md`.
>
> **Drift check (run first)**:
> `cd website && git diff --stat 6c6cf68..HEAD -- src/pages/ src/data/guides.ts src/components/ui/RelatedGuides.astro`
> If `free-alternative.astro` or `guides.ts` changed since this plan was
> written, compare the "Current state" excerpts against the live code before
> proceeding; on a mismatch, treat it as a STOP condition.

## Status

- **Priority**: P1
- **Effort**: M
- **Risk**: MED (public-facing copy; factual claims about competitors must be verified)
- **Depends on**: none (002 recommended first but not required)
- **Category**: direction (funnel/SEO content)
- **Planned at**: website repo commit `6c6cf68`, 2026-07-10

## Why this matters

Comparison queries are the highest-intent searches this product can rank for:
someone searching "Hudl alternatives" or "Inbound Studio vs" is actively
shopping. The app was deliberately built to feature parity with Inbound Studio
(a paid competitor at ~€14.99/month; telestration, present mode, stats, player
tagging all shipped in 2026), but no page makes that comparison. The existing
`/free-alternative` page targets "free breakdown software / Hudl alternative"
narratively; these two new pages target the explicit comparison queries without
cannibalizing it.

## Current state

**Website repo** (`website/`, Astro + Tailwind, its own git repo).

- Existing pages in `website/src/pages/`: `index.astro`, `film-breakdown.astro`,
  `for-coaches.astro`, `scouting.astro`, `free-alternative.astro`, `404.astro`.
- **`free-alternative.astro` is the exemplar** for structure, voice, and
  JSON-LD. Its skeleton (all class strings verbatim from that file):
  - Frontmatter:
    ```astro
    ---
    import BaseLayout from '@/layouts/BaseLayout.astro';
    import { DownloadButton } from '@/components/features/DownloadButton';
    import RelatedGuides from '@/components/ui/RelatedGuides.astro';
    import { getCachedLatestRelease } from '@/utils/cache';
    import { fallbackReleaseData } from '@/utils/fallback';

    const release = (await getCachedLatestRelease()) ?? fallbackReleaseData;
    ---
    ```
  - `<BaseLayout title="..." fullTitle="..." description="..." type="article">`
  - `<article class="py-20 sm:py-28">` > `<div class="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">`
  - Kicker: `<p class="text-sm font-medium text-primary-600 mb-4">Comparison</p>`
  - H1: `<h1 class="font-display text-4xl sm:text-5xl font-bold text-warm-900 leading-[1.1] mb-6">`
  - Intro: `<p class="text-lg sm:text-xl text-warm-600 mb-12">`
  - H2s: `<h2 class="font-display text-2xl sm:text-3xl font-bold text-warm-900 mt-12 mb-4">`
  - Body: `<p class="text-warm-700 leading-relaxed mb-5">`
  - Comparison table: `<div class="overflow-x-auto my-8"><table class="w-full text-left border-collapse text-sm">` with
    `<tr class="border-b border-warm-200">`, header row `border-warm-300`,
    cells `py-3 px-4` (first column `py-3 pr-4 font-medium`).
  - CTA block: `<div class="mt-12 pt-8 border-t border-warm-200">` with an h2
    "Try it free", a short paragraph, and `<DownloadButton release={release} client:idle />`
  - After the article: `<RelatedGuides current="/free-alternative" />`
  - JSON-LD `<script type="application/ld+json">` with `@graph` of `FAQPage`
    (3 Questions) + `BreadcrumbList` (Home → page). A comment above it notes
    FAQPage is deliberate for FAQ rich results.
- Guides registry `website/src/data/guides.ts` — single source of truth used by
  Footer nav and RelatedGuides cross-links:
  ```ts
  export const guides: Guide[] = [
    { href: '/film-breakdown', label: 'How to break down game film' },
    { href: '/for-coaches', label: 'Film review for coaches' },
    { href: '/scouting', label: 'Scouting opponents from film' },
    { href: '/free-alternative', label: 'A free alternative to Hudl' },
  ];
  ```
- The 3D-basketball transparent-background gotcha applies **only to
  `index.astro` sections**; standalone article pages like these are unaffected.
- The app's real feature set (for honest tables — all shipped and verifiable in
  the app repo): cut/tag clips with keyboard shortcuts (mark in/out Z/M, quick-tag
  1-9), category system with sub-categories and presets, player tagging,
  per-quarter tagging, telestration (draw on video: arrows/lines/shapes/text,
  saved drawings, burned into exported clips), present mode (fullscreen
  sequential clip playback), stats dashboard, CSV/JSON export, session
  save/load, YouTube video import, 11 interface languages, fully offline —
  video never leaves the machine, free, open source (AGPL-3.0), Windows/macOS/Linux.
  Real limitations (state them honestly): no cloud hosting/sharing platform, no
  live capture, no automatic stat sync, no team accounts, desktop only.

### Voice rules (mandatory — the site's copy follows them, so must yours)

Model the tone on the `free-alternative.astro` body copy (read the whole file
first). Specifically:

- Honest and plain; concede competitors' strengths outright ("Those are real
  features. If you need them, pay for them.").
- No antithesis reflexes ("it's not X, it's Y"), no rule-of-three adjective
  stacks, no em-dash asides as connectors, no aphoristic section closers.
- Plain verbs: "is / has / does", never "boasts / offers a robust / seamless".
- Banned words include: leverage, robust, seamless, comprehensive, powerful,
  elevate, streamline, unleash, game-changing.
- Vary sentence length. Repeat the product's name rather than cycling synonyms
  ("the tool / the app / the platform").
- First person singular is used on this site ("I won't pretend it is") — the
  author is one person, a coach. Keep that.

## Commands you will need

| Purpose | Command | Expected on success |
|---|---|---|
| Build | `cd website && npm run build` | exit 0 |
| Dev preview | `cd website && npm run dev` (port 4321) | pages render |

## Scope

**In scope**:
- `website/src/pages/vs-inbound-studio.astro` (create)
- `website/src/pages/hudl-alternatives.astro` (create)
- `website/src/data/guides.ts` (add two entries)

**Out of scope** (do NOT touch):
- `free-alternative.astro` — it stays as-is; the new pages link to it via
  RelatedGuides automatically.
- `BaseLayout.astro`, `Footer.astro`, `RelatedGuides.astro` — no changes
  needed; registration happens via `guides.ts` only.
- `index.astro`.

## Git workflow

- Website repo: branch `content/comparison-pages` off `main` (the repo has
  used `content/…` branches for copy work before). Conventional commits
  (`feat: ...` or `content: ...` — check `git log --oneline -15` and match).
- Do NOT push or open a PR unless the operator instructed it.
- Do not mention AI tools in commit messages and do not add AI co-author lines.

## Steps

### Step 1: Verify competitor facts (REQUIRED before writing copy)

Fetch and read `https://inboundbasketballstudio.com` (pricing + features
pages). Record: current price and billing period, platform (web/desktop),
headline features (telestration, presentations, stats, tagging), free tier or
trial if any. As of 2026-06 it was €14.99/month; **verify, don't assume**.
For the Hudl page, verify from `https://www.hudl.com` that Hudl is
subscription-priced for teams (exact prices are quote-based; do not state a
number, say "team subscription, quote-based pricing").

If you cannot access the web: STOP condition — report that the pages need
competitor facts verified and cannot be written responsibly.

Every competitor claim on the pages must be something you verified this way,
and each page must carry a line like `Prices and features checked July 2026.`
near its table.

### Step 2: Create `/vs-inbound-studio`

Create `website/src/pages/vs-inbound-studio.astro` using the exemplar skeleton
from "Current state" (same frontmatter, same class strings).

- `title="Basketball Video Analyzer vs Inbound Studio"`,
  `fullTitle="Basketball Video Analyzer vs Inbound Studio — Free vs Paid Film Breakdown"`,
  `description` ~150 chars stating it's an honest comparison of a free
  open-source desktop tool with a paid product, `type="article"`.
- Content outline (write real prose per the voice rules; lengths are guides):
  1. Kicker "Comparison", H1 "Basketball Video Analyzer vs Inbound Studio".
  2. Intro paragraph: both tools do basketball film breakdown; Inbound Studio
     is paid, this one is free and open source; the honest question is what
     the subscription buys you.
  3. H2 "What both do": cutting and tagging clips, telestration, presenting
     breakdowns, basic stats. Short.
  4. H2 "Where they differ": comparison table (verified facts only). Rows to
     include: Price; Platform (desktop app vs whatever Inbound Studio is —
     verify); Telestration; Present mode / presentations; Stats; Player
     tagging; Works offline / film stays local; Open source; Languages.
  5. H2 "Which one fits you": honest steering — if the verified Inbound Studio
     capabilities include things this app lacks, say who needs them and that
     they should pay for it; the free tool fits coaches who mostly cut, tag,
     draw, and present from their own film.
  6. CTA block + `<RelatedGuides current="/vs-inbound-studio" />`.
  7. JSON-LD: FAQPage with 3 questions ("Is Basketball Video Analyzer really
     free?", "Do I need Inbound Studio if I use this?", "Does my film get
     uploaded anywhere?") + BreadcrumbList (Home → page), URLs
     `https://basketballvideoanalyzer.com/vs-inbound-studio`.
- Tone check: the page must read as fair to Inbound Studio. It is a legitimate
  product; the pitch is price and openness, not trash talk.

**Verify**: `cd website && npm run build` → exit 0; `ls dist/vs-inbound-studio/index.html` exists.

### Step 3: Create `/hudl-alternatives`

Create `website/src/pages/hudl-alternatives.astro`, same skeleton.

- `title="Hudl Alternatives for Basketball"`,
  `fullTitle="Hudl Alternatives for Basketball Coaches — Free and Paid Options"`,
  `description` ~150 chars, `type="article"`.
- This is a roundup, not a head-to-head. Cover, one H2 each with 1–2 honest
  paragraphs: Basketball Video Analyzer (free, open source — disclose that
  it's this site's own tool, first line of its section), Kinovea (free,
  general sport video analysis, no basketball-specific tagging), LongoMatch
  (open-source roots, paid pro version, general sports tagging), Nacsport
  (paid, professional analysis suite), and "doing it by hand in VLC" (free,
  the baseline everyone actually compares against). For each: what it is, what
  it costs (verify or say "paid, tiered" without inventing numbers), who it
  fits. Include a summary table (Tool / Price / Basketball-specific / Platform).
- End: honest paragraph that Hudl itself is the right answer for programs that
  need cloud hosting, live capture, and league-wide exchange; link the
  existing `/free-alternative` page inline in the prose
  (`<a href="/free-alternative" class="text-primary-600 hover:underline">`
  — check how inline links are styled on the other guide pages first and match).
- CTA block + `<RelatedGuides current="/hudl-alternatives" />`.
- JSON-LD: FAQPage (3 questions, e.g. "Is there a free alternative to Hudl for
  basketball?", "Can these tools replace Hudl completely?", "What's the best
  free option?") + BreadcrumbList.

**Verify**: build passes; `ls dist/hudl-alternatives/index.html` exists.

### Step 4: Register both in guides.ts

Append to the `guides` array:

```ts
{ href: '/vs-inbound-studio', label: 'Compared with Inbound Studio' },
{ href: '/hudl-alternatives', label: 'Hudl alternatives for basketball' },
```

This automatically adds them to the Footer nav and all RelatedGuides blocks.

**Verify**: `cd website && npm run build` → exit 0; `grep -c "vs-inbound-studio" dist/index.html` ≥ 1 (footer link present).

### Step 5: Sitemap check

**Verify**: `grep -o "vs-inbound-studio\|hudl-alternatives" dist/sitemap-0.xml | sort -u` → both slugs
(file may be `dist/sitemap-0.xml` or similar under dist/; find it with `ls dist/sitemap*`).

## Test plan

No test suite. Gates: build + greps above. Additionally run `npm run dev` and
read both pages top to bottom once, checking: no banned words (grep the two
new files for `robust\|seamless\|leverage\|comprehensive\|powerful\|boasts\|elevate`
→ 0 matches), tables scroll on narrow viewports (the `overflow-x-auto` wrapper
handles this), all internal links resolve.

## Done criteria

- [ ] `cd website && npm run build` exits 0
- [ ] Both pages exist in `dist/` and appear in the generated sitemap
- [ ] Both registered in `guides.ts` (footer shows them)
- [ ] Competitor facts carry a "checked <month year>" line and were verified in Step 1
- [ ] `grep -iE "robust|seamless|leverage|comprehensive|boasts" website/src/pages/vs-inbound-studio.astro website/src/pages/hudl-alternatives.astro` → 0 matches
- [ ] No files outside the in-scope list are modified (`git status`)
- [ ] `plans/README.md` status row updated

## STOP conditions

Stop and report back if:

- You cannot fetch the competitor sites to verify facts (Step 1).
- Inbound Studio's product has changed so much (e.g. discontinued, free now)
  that the page premise is wrong — report what you found instead of writing
  around it.
- `free-alternative.astro` or `guides.ts` no longer match the excerpts.

## Maintenance notes

- Competitor pricing drifts. Each page's "checked <date>" line is the signal
  for when to re-verify (suggest every ~6 months).
- If more comparison pages are added later (e.g. `/best-basketball-video-analysis-software`
  from TODO.md's SEO roadmap), keep the disclosure pattern ("this site's own
  tool") and the guides.ts registration step.
- These pages will read as stale if the app gains/loses features — the tables
  list specific capabilities; update them when plans 007/008 land.
