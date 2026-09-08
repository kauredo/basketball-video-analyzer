# Plan 012: Stop the footer link row overflowing the phone viewport

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving on. If
> anything in "STOP conditions" occurs, stop and report. When done, update this
> plan's status row in `plans/README.md`.
>
> **Repo**: monorepo of separate git repos. This plan touches **`website/`
> only**. Branch and commit inside `website/`.
>
> **Drift check (run first)**: from `website/`, run
> `git diff --stat fa4bc39..HEAD -- src/components/ui/Footer.astro`
> On a mismatch with the excerpt below, treat it as a STOP condition.

## Status

- **Priority**: P1
- **Effort**: S
- **Risk**: LOW
- **Depends on**: none
- **Category**: bug
- **Planned at**: commit `fa4bc39`, 2026-09-07
- **Executor's tool**: `/ship`

## Why this matters

Every route on the site scrolls sideways by 17px on a phone. Measured on an
iPhone 14 Pro profile (393 CSS px) against production on 2026-09-07:
`document.documentElement.scrollWidth` is 410 on all seven routes, and the
element clipped at the right edge is the footer's `Contact` link, cut by 17px.

The cause is one flex row in the shared footer holding six links that never
wrap. Measured live, that row's `scrollWidth` is 428px inside a 361px content
box.

This matters more than 17px normally would, because the footer is currently the
only navigation the site has on a phone. The navbar carries no links at that
width, so the six guide pages are reachable only from this row, and the row is
clipped at both ends.

## Current state

- `src/components/ui/Footer.astro`: the shared footer, rendered on every route
  through `src/layouts/BaseLayout.astro`.

`src/components/ui/Footer.astro:15-30` (the container and the offending row):

```astro
    <div class="flex flex-col sm:flex-row justify-between items-center gap-4 text-sm text-warm-600">
      <span>
        Made by <a ...>kauredo</a> &middot; <a ...>Built by Vasco Kaufmann</a>
      </span>

      <div class="flex items-center gap-6">
```

That inner `div` holds six links, in order: **Basketball Stats App**,
**GitHub**, **Issues**, **Releases**, **Donate**, **Contact** (lines 31-76).
The outer row already stacks on small screens (`flex-col sm:flex-row`), but the
inner row has no `flex-wrap`, so its six children stay on one line at every
width.

Note the guide nav directly above it, at line 7, already gets this right:

```astro
    <nav aria-label="Guides" class="flex flex-wrap gap-x-6 gap-y-2 mb-6 pb-6 border-b border-warm-200 text-sm text-warm-600">
```

Use that as the pattern. It is the exemplar in this same file.

**Repo conventions.** Tailwind utilities inline in `.astro` files. Responsive
prefixes (`sm:`) are used throughout. No custom CSS for layout.

## Commands you will need

| Purpose | Command (run from `website/`) | Expected on success |
|---|---|---|
| Install | `npm install` | exit 0 |
| Build | `npm run build` | exit 0 |
| Dev server | `npm run dev` | serves on port 4321 |

No test suite. `npm run build` is the verification gate.

## Scope

**In scope**:
- `src/components/ui/Footer.astro`

**Out of scope** (do NOT touch):
- The guide `<nav>` at line 7. It already wraps correctly.
- The set of six links. Do not remove any of them to make the row fit; wrapping
  is the fix.
- `src/components/ui/Navbar.astro`. The missing phone navigation is a separate,
  larger piece of work planned in `plans/030-mobile-navigation.md`.

## Git workflow

- Branch: `fix/footer-overflow`
- Commit style: conventional commits; check `git log --oneline -5` and match.
- Never mention AI tools in the commit message and never add AI co-author lines.

## Steps

### Step 1: Let the link row wrap

In `src/components/ui/Footer.astro:30`, change

```astro
      <div class="flex items-center gap-6">
```

to

```astro
      <div class="flex flex-wrap justify-center sm:justify-end items-center gap-x-6 gap-y-2">
```

`flex-wrap` lets the six links fall onto a second line on a phone.
`gap-x-6 gap-y-2` keeps the existing horizontal rhythm while giving wrapped
rows sensible vertical spacing, matching the guide nav at line 7.
`justify-center sm:justify-end` keeps the wrapped block tidy on a phone and
preserves the current right alignment from the `sm` breakpoint up.

**Verify**: `npm run build` → exit 0.

### Step 2: Measure the overflow at 393px

Run `npm run dev`. In a browser at a 393px viewport width (device toolbar,
iPhone 14 Pro), open the home page, scroll to the footer, and evaluate in the
console:

```js
document.documentElement.scrollWidth - document.documentElement.clientWidth
```

**Verify**: the result is `0`. Before the fix it was `17`.

Repeat on `/hudl-alternatives`, which is the tallest sub-page.

**Verify**: `0` there too.

### Step 3: Confirm nothing regressed at desktop width

At 1440px wide, check the footer still renders as two groups on one line, the
byline on the left and the six links on the right.

**Verify**: the six links sit on a single line, right-aligned, with the same
spacing as before.

## Test plan

No test suite. Check by hand at three widths on at least `/` and one sub-page:

- 393px: no horizontal scroll, all six links visible and readable, wrapped onto
  two lines.
- 640px (the `sm` breakpoint): the outer row goes horizontal; the link row
  still fits or wraps cleanly.
- 1440px: unchanged from today.

## Done criteria

ALL must hold:

- [ ] `npm run build` exits 0
- [ ] At 393px, `scrollWidth - clientWidth` is 0 on `/` and on
      `/hudl-alternatives`
- [ ] All six footer links are visible and none is clipped at 393px
- [ ] Desktop footer layout is visually unchanged at 1440px
- [ ] `git status` shows only `src/components/ui/Footer.astro` modified
- [ ] `plans/README.md` status row updated

## STOP conditions

Stop and report if:

- The overflow is still non-zero after Step 1. Something other than this row
  contributes, and the plan's diagnosis is incomplete. Report the measured
  value and the widest element found by walking `document.querySelectorAll('*')`
  for `getBoundingClientRect().right > 393`.
- The footer no longer contains a six-link row, meaning the file changed since
  planning.

## Maintenance notes

- Adding a seventh link to this row is now safe; it will wrap. Adding one to
  the navbar is not, and that is the subject of plan 030.
- A reviewer should check the footer at 393px specifically. The bug was
  invisible at every width above the `sm` breakpoint, which is why it shipped.
