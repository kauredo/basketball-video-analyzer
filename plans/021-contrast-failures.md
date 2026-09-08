# Plan 021: Fix the measured contrast failures on both surfaces

> **Executor instructions**: Follow every step, run each verification command.
> Stop and report on any STOP condition. Update this plan's row in
> `plans/README.md` when done.
>
> **Repo**: monorepo of separate git repos. Touches **`website/`** and
> **`app/`**. Two branches, two commits.
>
> **Drift check**: from `website/`, `git diff --stat fa4bc39..HEAD -- tailwind.config.cjs src/styles/global.css src/pages/index.astro`;
> from `app/`, `git diff --stat 9a863ed..HEAD -- src/renderer/styles/variables.css`

## Status

- **Priority**: P1
- **Effort**: M
- **Risk**: MED
- **Depends on**: `plans/018` and `plans/019`. Run **after** both.
  Recompute every ratio against the settled tokens, not the ones in the table
  below: settled by plan 027 on 2026-09-07: accent `#14A79A` teal (light face `#0A6E68`, dark face `#3ED0C2`), type Space Grotesk display + IBM Plex Sans interface + IBM Plex Mono numerals. Tokens in `website/docs/DESIGN.md`. White on `#0A6E68` measures 6.5:1 and passes; white on
  `#14A79A` measures 2.9:1 and fails, so the accent is never a fill behind
  white at that face.
- **Category**: bug
- **Planned at**: `website` `fa4bc39`, `app` `9a863ed`, 2026-09-07
- **Executor's tool**: `/harden`

## Why this matters

The label on the primary button fails WCAG AA on both surfaces, and one of
them is the control the app exists for. These are measured ratios, recomputed
independently from the sampled hexes on 2026-09-07:

| Ratio | Pair | Where |
|---|---|---|
| **2.85:1** | white on `#FF6B35` | the site's Download button label |
| **2.84:1** | white on `#4caf50` | the app's Export Clips, selected filter chips |
| **2.36:1** | white on `#66bb6a` | the app's **Mark In (Z)** button |
| **1.67:1** | `warm-200` on the court peach | the "1 / 2 / 3" step numerals |
| **2.21:1** | `#8B7355` on the darker court peach | the hero subhead |
| **2.96:1** | `warm-500` at 12px | the "Now in 11 languages" line |
| **4.34:1** | `warm-600` on `warm-50` | landing body copy, just under AA |

AA wants 4.5:1 for body text and 3:1 for large text. The step numerals at
1.67:1 are the only thing numbering the steps, and they cannot be read at all.

## Current state

**Site.** `website/tailwind.config.cjs` defines `primary.500` as `#FF6B35` and
the `warm` scale (`warm-50` `#FDFBF7` through `warm-950` `#1A1510`).
`website/src/styles/global.css:29-42` builds `.download-btn` on
`bg-primary-500 text-white`.

The step numerals and the hero subhead sit on top of the 3D court scene, whose
gradient runs roughly `#EDDFD5` to `#A55936`, so their effective background
varies across the element. That is why they measure worse than a flat-background
calculation would suggest.

**App.** `app/src/renderer/styles/variables.css:5-7` and `:11`:

```css
  --color-primary: #4caf50;
  --color-primary-light: #66bb6a;
  ...
  --color-success: #4caf50;
```

Mark In is styled from the light variant, which is the worst of the three.

## Commands you will need

| Purpose | Command | Expected |
|---|---|---|
| Build site | `npm run build` (from `website/`) | exit 0 |
| Build app | `npm run build` (from `app/`) | exit 0 |
| Run app | `npm start` (from `app/`) | window opens |

No test suites. The builds are the gates.

Contrast checking: compute ratios in the browser console rather than
eyeballing. Relative luminance per WCAG 2.1: linearise each sRGB channel
(`c <= 0.03928 ? c/12.92 : ((c+0.055)/1.055) ** 2.4`), then
`L = 0.2126R + 0.7152G + 0.0722B`, and the ratio is
`(Llighter + 0.05) / (Ldarker + 0.05)`.

## Scope

**In scope**:
- `website/tailwind.config.cjs` (the `primary` scale, if the button is fixed by
  darkening)
- `website/src/pages/index.astro` (the step numerals, the hero subhead, the
  "11 languages" line, the body-copy colour class)
- `app/src/renderer/styles/variables.css`

**Out of scope**:
- The `court` gradient itself. Changing the artwork to fix text contrast is
  backwards; move the text or change the text colour.
- The six sub-pages' body copy. It already measures 6.34:1 and passes.
- `--color-danger`, `--color-warning`, `--color-info`.
- Restructuring the hero. That is `plans/031-phone-hero.md`.

## Git workflow

- Branches: `fix/contrast-website` and `fix/contrast-app`.
- Conventional commits; check `git log --oneline -5` in each repo and match.
  Never mention AI tools and never add AI co-author lines.

## Steps

### Step 1: Fix the primary button label on the site

Two options; pick one and apply it consistently.

- **Darken the accent**: move `primary.500` to roughly `#D9481B`, which gives
  white a ratio of about 4.5:1. Regenerate the neighbouring steps so the ramp
  stays smooth.
- **Change the label colour**: keep `#FF6B35` and set the button text to
  `warm-900` (`#2C2418`), which measures about 5.2:1.

Prefer darkening if plan 018 has not run, so the accent stays a button colour
everywhere. If plan 018 has already moved the site to green, apply the same
choice to the new hex instead, and recompute rather than reusing these numbers.

**Verify**: compute the ratio for the button's actual foreground and background
in the browser console → at least 4.5.

### Step 2: Fix the app's action buttons

In `app/src/renderer/styles/variables.css`, darken the dark-theme
`--color-primary-light` so white on it reaches at least 4.5:1. `#66bb6a` at
2.36:1 is the worst pair in the product; `#2e7d32` measures 5.13:1.

If Mark In needs to stay visually lighter than Mark Out for the pairing to
read, keep the lighter fill and switch its label to a dark colour instead. Do
not leave white on a light green.

Check the light theme too. After `plans/019` lands, `--color-success` is
defined in both themes; verify white on each theme's success colour also
reaches 4.5:1.

**Verify**: `npm run build` → exit 0. Then in the running app's DevTools,
compute the ratio for the Mark In button's label against its background → at
least 4.5.

### Step 3: Make the step numerals readable

In `website/src/pages/index.astro`, the "1 / 2 / 3" numerals are
`text-5xl font-bold text-warm-200` over the court gradient. Move them to a
colour that holds against the darkest part of that gradient. `warm-700`
(`#6E5A42`) or `warm-900` (`#2C2418`) both clear 3:1 for large text across the
gradient's range.

They are large text (48px bold), so 3:1 is the bar, not 4.5:1.

**Verify**: compute the ratio against the darkest sampled background under each
numeral → at least 3.0.

### Step 4: Fix the hero subhead and the small print

- The hero subhead is `#8B7355` (`warm-600`) at 2.21:1 over the peach. Move it
  to `warm-800` or `warm-900`, or move it off the gradient.
- The "Now in 11 languages" line is `text-xs text-warm-500` at 2.96:1. Move it
  to `warm-700` (6.34:1) and consider `text-sm`; 12px at low contrast is the
  hardest text on the page to read.
- Landing body copy is `warm-600` at 4.34:1, just under AA. Move it to
  `warm-700`, which is what the six sub-pages already use, and which measures
  6.34:1. This also removes an inconsistency: the home page and the guides
  currently use two different browns for the same job.

**Verify**: `npm run build` → exit 0, and each of the three pairs computes at
4.5 or above.

### Step 5: Re-measure everything in the table

Walk the seven rows of the table in "Why this matters" and recompute each in
the browser or the running app.

**Verify**: every row is at or above its bar (4.5 for body and button labels,
3.0 for the large numerals).

## Test plan

No test suite. By hand:

- Recompute all seven ratios and record the new numbers in the PR description.
- Check both app themes, not just dark.
- Check the home page at 393px as well as 1440px; the gradient crops
  differently and the numerals sit over a different part of it.
- Confirm nothing that passed before now fails: darkening the accent changes
  every element built on it.

## Done criteria

- [ ] `npm run build` exits 0 in both repos
- [ ] White (or the chosen label colour) on the site's primary button ≥ 4.5:1
- [ ] The app's Mark In label against its fill ≥ 4.5:1, in both themes
- [ ] The step numerals ≥ 3.0:1 against the darkest background beneath them
- [ ] Hero subhead, the "11 languages" line and landing body copy all ≥ 4.5:1
- [ ] The PR description lists the before and after ratio for all seven pairs
- [ ] `plans/README.md` status row updated

## STOP conditions

- Darkening the accent to reach 4.5:1 makes it read as brown rather than
  basketball orange. Report the hex and the ratio; the answer is then the
  dark-label option from Step 1, not a compromise ratio.
- Any pair cannot reach its bar without changing the court artwork. Report it;
  moving the text off the gradient is in scope, repainting the gradient is not.

## Maintenance notes

- Record the final ratios in `website/docs/DESIGN.md`, which is currently
  stale and documents an older palette. A future change to the accent has to
  re-clear these bars.
- A reviewer should recompute at least the button label rather than trusting
  the diff. A hex that looks darker is not necessarily 4.5:1.

## Executor note, 2026-09-07 (app PR #14, website PR #7)

Three corrections to this plan, all found by measuring rather than reusing the
table above.

**Mark In was not at 2.36:1 on `--color-primary-light`.** It was on
`--color-success`, at 2.78:1. `--color-primary-light` is never used as a fill
anywhere in the app.

**The step numerals measured 1.06:1, not 1.67:1.**

**The six guide pages were excluded on a false premise.** This plan says they
"already measure 6.34:1 and pass". They used the same warm-600 body copy as the
landing page, at 4.34:1, as did the 404 page, the footer and the navbar. All
were fixed.

Two things the table could not show. Most of the site's below-fold failures
were structural: the court is a `fixed inset-0` layer behind the whole document
and the sections under the hero had translucent grounds, so terracotta showed
through behind body copy thousands of pixels down. Making those grounds opaque
fixed four rows at once. And the accent itself had to move again: `#0A6E68`
clears white at 6.10:1 but reads 2.85:1 against the app's graphite ground,
under the 3.0 bar for identifying a control. Shipped at `#0B7972`.

Still failing, and not planned: white on `--color-danger`, `--color-warning`
and `--color-info`, at 3.68:1, 2.16:1 and 3.12:1.
