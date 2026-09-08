# Plan 016: Use one product name everywhere

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result. If anything in "STOP
> conditions" occurs, stop and report. When done, update this plan's status row
> in `plans/README.md`.
>
> **Repo**: monorepo of separate git repos. This plan touches **`website/`
> only**. The screenshots that carry a fourth name are replaced separately in
> `plans/017-refresh-product-screenshots.md`.
>
> **Drift check (run first)**: from `website/`, run
> `git diff --stat fa4bc39..HEAD -- src/components/ui/Navbar.astro src/pages/vs-inbound-studio.astro`

## Status

- **Priority**: P2
- **Effort**: S
- **Risk**: LOW
- **Depends on**: none
- **Category**: tech-debt
- **Planned at**: commit `fa4bc39`, 2026-09-07
- **Executor's tool**: `/clarify`

## Why this matters

One product currently answers to four names:

1. **"Basketball Analyzer"**, the navbar wordmark on every route.
2. **"Basketball Video Analyzer"**, every `<title>`, the domain, and the app's
   own header.
3. **"This tool"**, the comparison table's own column header on
   `/vs-inbound-studio`.
4. **"Basketball Clip Cutter"**, the titlebar visible in every product
   screenshot on the home page.

A visitor comparing tools has to work out that these are one thing. The
comparison page is the worst of the four, because a table whose columns read
"Inbound Studio" and "This tool" makes the product anonymous at exactly the
moment it is being weighed against a named competitor.

The canonical name is **Basketball Video Analyzer**. It is what the domain,
the page titles, the GitHub repo and the app header already use.

## Current state

`src/components/ui/Navbar.astro:16`:

```astro
        <span class="font-display font-semibold text-lg">Basketball Analyzer</span>
```

`src/pages/vs-inbound-studio.astro:65`:

```astro
              <th class="py-3 px-4 font-display font-semibold text-warm-900">This tool</th>
```

`src/assets/screenshots/video-cutting-interface.png` and its four siblings show
a titlebar reading "Basketball Clip Cutter". Those are out of scope here and
handled by plan 017.

**Repo conventions.** Astro components, Tailwind utilities inline,
`font-display` is Space Grotesk.

**Length constraint.** The navbar is a fixed 56px bar (`h-14`) with the
wordmark on the left and a Download button on the right. At 393px the wordmark
and the button already fill it. "Basketball Video Analyzer" is six characters
longer than "Basketball Analyzer", so Step 1 must check the phone width rather
than assume it fits.

## Commands you will need

| Purpose | Command (run from `website/`) | Expected on success |
|---|---|---|
| Build | `npm run build` | exit 0 |
| Dev server | `npm run dev` | serves on port 4321 |

No test suite. `npm run build` is the gate.

## Scope

**In scope**:
- `src/components/ui/Navbar.astro`
- `src/pages/vs-inbound-studio.astro`

**Out of scope** (do NOT touch):
- `src/assets/screenshots/`. Plan 017 replaces those images.
- Page `<title>` tags and OG tags. They already use the canonical name.
- The app repo. Its header already says "Basketball Video Analyzer".
- The GitHub repo name and the domain. Both already match.

## Git workflow

- Branch: `fix/one-product-name`
- Commit style: conventional commits; check `git log --oneline -5` and match.
- Never mention AI tools in commit messages and never add AI co-author lines.

## Steps

### Step 1: Rename the navbar wordmark

In `src/components/ui/Navbar.astro:16`, change the span's text from
`Basketball Analyzer` to `Basketball Video Analyzer`.

Then check it at 393px. If the wordmark and the Download button collide or the
bar overflows, do **not** shorten the name. Instead reduce the wordmark to
`text-base` below the `sm` breakpoint by changing the class to
`font-display font-semibold text-base sm:text-lg`. If that is still not enough,
STOP and report rather than inventing an abbreviation.

**Verify**: at 393px in the browser device toolbar,
`document.documentElement.scrollWidth - document.documentElement.clientWidth`
is `0`, and both the wordmark and the Download button are fully visible.

Note: that measurement is only meaningful once
`plans/012-footer-overflow.md` has landed, because the footer contributes 17px
of overflow on its own. If plan 012 has not landed, measure the navbar's own
`scrollWidth` instead:
`document.querySelector('nav').scrollWidth <= 393`.

### Step 2: Name the product in the comparison table

In `src/pages/vs-inbound-studio.astro:65`, change the header cell text from
`This tool` to `Basketball Video Analyzer`.

Check the table at 393px afterwards. A two-column comparison with a long header
can force horizontal scrolling. If it does, wrap the table in an
`overflow-x-auto` container rather than shortening the name:

```astro
<div class="overflow-x-auto">
  <table ...>...</table>
</div>
```

**Verify**: `npm run build` → exit 0, and the page does not scroll sideways at
393px.

### Step 3: Sweep for any other variant

```
grep -rn "Basketball Analyzer\|Clip Cutter\|This tool" src/
```

**Verify**: the only remaining hits are inside `src/assets/` (binary
screenshots, out of scope) or none at all.

## Test plan

No test suite. Verify by hand:

- The navbar reads "Basketball Video Analyzer" on all seven routes plus 404.
- The comparison table names the product in its column header.
- Neither change introduces horizontal scroll at 393px, 640px or 1440px.

## Done criteria

ALL must hold:

- [ ] `npm run build` exits 0
- [ ] `grep -rn "Basketball Analyzer" src/ --include=*.astro` returns no
      matches for the standalone short name
- [ ] `grep -rn "This tool" src/pages/vs-inbound-studio.astro` returns no
      matches
- [ ] No horizontal scroll at 393px on `/` and `/vs-inbound-studio`
- [ ] `git status` shows only the two files modified
- [ ] `plans/README.md` status row updated

## STOP conditions

Stop and report if:

- The longer wordmark cannot be made to fit at 393px even at `text-base`.
  Report the measured widths; the answer is then a navbar layout change, which
  belongs with `plans/030-mobile-navigation.md`, not here.
- `grep` finds the short name in a fifth place not listed in Scope, such as the
  web manifest or a structured-data block. Report the locations before
  changing them, because `site.webmanifest` and JSON-LD affect how search
  engines and install prompts label the product.

## Maintenance notes

- `public/site.webmanifest` and the JSON-LD block in `src/pages/index.astro`
  (around line 350) also carry a product name. Confirm they use the canonical
  one while you are here, and report rather than silently changing them if they
  do not.
- A reviewer should look at the navbar on a real phone, not just a device
  emulator, since the wordmark is now close to the available width.
