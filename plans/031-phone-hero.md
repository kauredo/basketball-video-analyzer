# Plan 031: Design the phone hero instead of deleting the desktop one

> **Executor instructions**: Follow every step, run each verification command.
> Stop and report on any STOP condition. Update this plan's row in
> `plans/README.md` when done.
>
> **Repo**: monorepo of separate git repos. **`website/` only**.
>
> **Drift check**: from `website/`,
> `git diff --stat fa4bc39..HEAD -- src/pages/index.astro src/components/3d/`

## Status

- **Priority**: P2
- **Effort**: M
- **Risk**: MED
- **Depends on**: none
- **Category**: tech-debt
- **Planned at**: commit `fa4bc39`, 2026-09-07
- **Executor's tool**: `/adapt`

## Why this matters

On desktop the hero is illustrated: a 3D basketball, faint court lines, display
type at 60px. On a phone the art is dropped and nothing replaces it. What is
left is a heading and a button on flat cream, with roughly 310px of empty space
above the heading and another 335px between the platform line and the first
screenshot.

The art has not been removed, only displaced. It reappears about 3000px down
the page, where body copy runs across the ball's dark seam. "One click exports
all your clips into category-based folders" sits over that seam and is close to
unreadable, and a lighter panel cuts the ball on a hard rectangular edge around
the "How it works" heading, so the art layer is not clipped to any section.

The home page runs 8,685 CSS px on a phone, about eleven screens, and roughly
900 of those are the dead bands around the hero.

## Current state

- `src/pages/index.astro`: the hero section and the section order.
- `src/components/3d/`: the Three.js basketball scene. It is a large chunk
  (~995KB) and is loaded on every viewport.
- The court gradient is painted by a `fixed inset-0 -z-10 w-full h-full`
  element, measured at 410px wide on a 393px viewport, which is why it appears
  in the overflow list even though the footer is the actual cause
  (`plans/012`).

Measured 2026-09-07 at 393px: home page height 5,790px in the audit capture and
8,685 CSS px including the art bands; desktop height 5,753px at 1440.

## Commands you will need

| Purpose | Command (from `website/`) | Expected |
|---|---|---|
| Build | `npm run build` | exit 0 |
| Dev server | `npm run dev` | port 4321 |

No test suite. `npm run build` is the gate.

## Scope

**In scope**:
- `src/pages/index.astro`, the hero section and the art layer's placement
- The wrapper that positions the 3D scene

**Out of scope**:
- The 3D scene's internals. Do not rewrite the Three.js code.
- Deleting the 3D scene from desktop. It works there.
- The section order below the hero. That is `plans/033` and `plans/034`.
- The footer overflow, which is `plans/012`.

## Git workflow

- Branch: `fix/phone-hero`
- Conventional commits; check `git log --oneline -5` and match. Never mention
  AI tools and never add AI co-author lines.

## Steps

### Step 1: Clip the art layer to the hero

The court gradient and the ball currently sit on a `fixed inset-0` layer that
spans the whole document, which is why they reappear behind body copy far down
the page. Scope the layer to the hero section: make it `absolute inset-0`
inside a `relative` hero container, so it cannot bleed past that section on any
viewport.

**Verify**: at 393px, scroll to the "How it works" section.
No part of the ball or the court gradient is visible behind the body copy, and
no rectangular cut edge appears around the heading.

### Step 2: Give the phone hero something in place of the ball

Do not simply delete the art and leave the gap. Options, in order of
preference:

1. Render the court lines only, at phone scale, behind the heading. Cheap, on
   brand, no Three.js on mobile.
2. Show the product screenshot in the hero on phone, since it is the strongest
   asset on the page and currently starts at y≈1078 on desktop and later on
   phone.

Whichever is chosen, the phone hero must not be a heading and a button on flat
cream.

**Verify**: at 393px the hero has a visual element besides type and the button.

### Step 3: Delete the dead bands

Remove the ~310px above the heading and the ~335px between the platform line
and the first screenshot. These are the desktop layout's spacing surviving into
a viewport a third the width.

**Verify**: the hero's total height at 393px is under 700px, so the first
screenshot is reachable within about one and a half screens.

### Step 4: Do not ship Three.js to phones

If option 1 was chosen in Step 2, the 3D scene is no longer used below `sm`.
Load it conditionally so a phone does not download a ~995KB chunk it never
renders. Astro's `client:media` directive is the mechanism:
`client:media="(min-width: 640px)"`.

**Verify**: in DevTools' network panel at 393px, the Three.js chunk is not
requested. At 1440px it is.

### Step 5: Re-measure the page

**Verify**: `npm run build` → exit 0, and at 393px the home page's
`document.documentElement.scrollHeight` has dropped by at least 800px from
8,685.

## Test plan

No test suite. By hand at 393px, 640px and 1440px:

- The hero has a designed visual at every width.
- No art appears behind body copy anywhere on the page.
- "One click exports all your clips into category-based folders" is fully
  readable at 393px.
- The desktop hero is unchanged.
- The Three.js chunk is not requested at 393px (if Step 4 applies).
- No horizontal scroll is introduced at any width.

## Done criteria

- [ ] `npm run build` exits 0
- [ ] At 393px, the hero is under 700px tall and contains a visual element
- [ ] No court gradient or ball is visible behind any section below the hero
- [ ] Home page `scrollHeight` at 393px is at least 800px shorter than before
- [ ] The desktop hero at 1440px is visually unchanged
- [ ] `plans/README.md` status row updated

## STOP conditions

- Clipping the art layer to the hero breaks the desktop composition, which
  currently relies on the gradient continuing into later sections. Report it
  with a screenshot; the answer is then per-section gradients, which is a
  larger composition change.
- `client:media` is unavailable in the installed Astro version. Check
  `package.json` (Astro `^5.13.9` at planning time supports it).

## Maintenance notes

- The art layer being `fixed inset-0` across the whole document is the root
  cause of both the bleed-through and the phantom 410px width. Keep it scoped.
- A reviewer should scroll the whole phone page slowly. The bleed-through is
  3000px down and invisible in a fold-only screenshot.
