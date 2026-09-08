# Plan 018: Decide one accent colour and carry it across both surfaces

> **Executor instructions**: This plan opens with a decision the operator must
> make. Read "The decision" first and do not start Step 1 until it is settled.
> Run every verification command. If anything in "STOP conditions" occurs, stop
> and report. When done, update this plan's status row in `plans/README.md`.
>
> **Repo**: monorepo of separate git repos. Depending on the decision this
> touches `app/`, `website/`, or both. Branch and commit separately in each.
>
> **Drift check (run first)**: from `app/`,
> `git diff --stat 9a863ed..HEAD -- src/renderer/styles/`; from `website/`,
> `git diff --stat fa4bc39..HEAD -- tailwind.config.cjs src/styles/global.css`

## Status

- **Priority**: P1
- **Effort**: M
- **Risk**: MED
- **Depends on**: `plans/027` DECIDED. settled by plan 027 on 2026-09-07: accent `#14A79A` teal (light face `#0A6E68`, dark face `#3ED0C2`), type Space Grotesk display + IBM Plex Sans interface + IBM Plex Mono numerals. Tokens in `website/docs/DESIGN.md`. Option C was taken: a
  third accent used only for actions, so neither surface's old colour wins and
  the category orange band stays untouched. Both repos change.
- **Category**: tech-debt
- **Planned at**: `app` `9a863ed`, `website` `fa4bc39`, 2026-09-07
- **Executor's tool**: `/improve plan` then `/ship`

## Why this matters

The two halves of one product share no accent. The site's primary action is
basketball orange `#FF6B35`; the app's is green `#4CAF50`. Both do the
identical job. A coach clicks an orange Download button and opens a green
program, and nothing carries across the gap.

Four of the five critics in the 2026-09-07 design audit reached this
independently, and it is the only defect in that audit that exists *between*
the two surfaces rather than inside one of them.

## The decision

There are three options, and one of them is worse than it looks.

**Option A: the app adopts the site's orange.** Attractive because the site's
warm palette is the more distinctive of the two systems.

**This option has a real conflict.** The app's category presets already own the
orange band. Seeded from `app/src/main/database.ts`, the Basketball preset
assigns: Offense `#FF5722`, Pick & Roll `#FF7043`, Isolation `#FF8A65`, Fast
Break `#FFAB91`, Post Up `#FFCCBC`. Five of the ten default categories are
orange. Making the primary action orange would put "act here" in the same hue
as "this clip is an offensive possession", on the same screen, in the timeline
and the filter chips. Do not choose Option A without also re-hueing the
category presets, which is `plans/023-category-colour-separation.md` and a
bigger change than this plan.

**Option B: the site adopts the app's green.** Cheaper and safer. The app's
green is already the action colour across 22 CSS modules; the site's orange
appears in a handful of places. The cost is that `#4CAF50` is the Material
Design 2014 swatch, taken unmodified, and the audit called both palettes
defaulted rather than chosen.

**Option C: pick one new accent for actions on both surfaces**, and keep it out
of the category palette. This is the answer the identity work in
`plans/027-identity-system.md` would produce if it runs.

**Recommendation**: if plan 027 is going to run, let it choose, and treat this
plan as its implementation. If 027 is not running soon, take Option B now. It
removes the cross-surface split this month at low risk, and it does not paint
the category system into a corner the way Option A would.

Ask the operator which option they want before Step 1. Record the answer at the
top of the branch's PR description.

## Current state

**Website.** `website/tailwind.config.cjs`:

```js
        primary: {
          50: "#FFF4ED",
          ...
          500: "#FF6B35",
          600: "#E55A2B",
          ...
        },
```

`website/src/styles/global.css:29-42` builds `.download-btn` on
`bg-primary-500` with `hover:bg-primary-600`, plus a hardcoded tinted shadow:

```css
    box-shadow: 0 4px 14px rgba(255, 107, 53, 0.25);
```

and on hover `0 8px 24px rgba(255, 107, 53, 0.35)`. Those two rgba values
duplicate `#FF6B35` outside the token system and will not follow a token change.

**App.** `app/src/renderer/styles/variables.css:5-7`:

```css
  --color-primary: #4caf50;
  --color-primary-dark: #45a049;
  --color-primary-light: #66bb6a;
```

and in the light theme block at line 119:

```css
  --color-primary: #2e7d32;
  --color-primary-dark: #1b5e20;
  --color-primary-light: #388e3c;
```

The app is well set up for this: almost everything reads the token. Auditing at
planning time found the accent centralised in `variables.css`, with category
colours held separately in the database.

**Related work.** `plans/019-split-primary-and-success.md` separates
`--color-primary` from `--color-success`, which are currently the same hex.
Land 019 first if both run, so this plan changes one token rather than two
things at once.

## Commands you will need

| Purpose | Command | Expected on success |
|---|---|---|
| Build app | `npm run build` (from `app/`) | exit 0 |
| Run app | `npm start` (from `app/`) | window opens |
| Build site | `npm run build` (from `website/`) | exit 0 |

No test suites. The two builds are the gates.

## Scope

Scope depends on the decision.

**Option B (site adopts green), in scope**:
- `website/tailwind.config.cjs`, the `primary` scale
- `website/src/styles/global.css`, the two hardcoded `rgba(255, 107, 53, ...)`
  shadows

**Out of scope in every option**:
- The category preset colours in `app/src/main/database.ts`. Changing them is
  plan 023 and it migrates existing user data.
- `--color-danger`, `--color-warning`, `--color-info`. Only the primary action
  colour is in question here.
- The `warm` neutral scale on the site. It stays whichever accent wins.
- The `court` colour tokens. They are imagery, not accent.

## Git workflow

- Branch: `refactor/single-accent` in whichever repo(s) the decision touches.
- Commit style: conventional commits; check `git log --oneline -5` and match.
- Never mention AI tools in commit messages and never add AI co-author lines.

## Steps

*(Written for Option B. If the operator picks A or C, STOP and report so the
plan can be rewritten for that choice, because Option A additionally requires
plan 023 and Option C requires plan 027 to have produced a colour.)*

### Step 1: Replace the site's primary scale

In `website/tailwind.config.cjs`, replace the nine `primary` steps with a scale
built around the app's `#4CAF50`. Generate the ramp rather than guessing:
`500` is `#4CAF50`, `600` is the app's `#45A049`, and the lighter and darker
steps interpolate from those. Keep the same nine keys, so no utility class
anywhere on the site breaks.

**Verify**: `grep -n "FF6B35" website/tailwind.config.cjs` returns no matches,
and `npm run build` → exit 0.

### Step 2: Fix the two hardcoded shadows

In `website/src/styles/global.css`, replace both
`rgba(255, 107, 53, ...)` values with the new accent's rgb triple at the same
alphas. Better still, express them against a CSS custom property so the next
change is one edit:

```css
:root { --accent-rgb: 76, 175, 80; }
```

then `box-shadow: 0 4px 14px rgba(var(--accent-rgb), 0.25);` and the hover
variant at `0.35`.

**Verify**: `grep -rn "255, 107, 53" website/src/` returns no matches.

### Step 3: Sweep for other hardcoded instances of the old accent

```
grep -rn "FF6B35\|ff6b35\|E55A2B\|e55a2b" website/src/ website/public/
```

**Verify**: no matches outside binary assets. If the favicon or OG image
carries the old orange, note it in the PR; regenerating those belongs with
plan 026 (the mark).

### Step 4: Look at every route

Run `npm run dev` and check all seven routes plus 404 at 1440px and 393px.

**Verify**: the CTA, the guide-link arrows, the feature icons and the focus
ring all render in the new accent, and nothing has become unreadable against
the warm neutrals. Note that white-on-`#4CAF50` measures 2.84:1, which fails
WCAG AA; fixing the button label contrast is
`plans/021-contrast-failures.md`, which should run straight after this one.

## Test plan

No test suite. Verify by hand:

- All eight built pages render with the new accent and no orange remains except
  in the `court` imagery tokens.
- The app is untouched under Option B; confirm `git status` in `app/` is clean.
- Side by side: open the site's download section and the app's workspace on one
  screen. The primary buttons should read as the same colour.

## Done criteria

ALL must hold:

- [ ] `npm run build` exits 0 in `website/`
- [ ] `grep -rn "FF6B35\|255, 107, 53" website/src/ website/tailwind.config.cjs`
      returns no matches
- [ ] The seven routes plus 404 render with one accent
- [ ] `git status` in `app/` is clean (Option B changes nothing there)
- [ ] The decision (A, B or C) is recorded at the top of the PR description
- [ ] `plans/README.md` status row updated

## STOP conditions

Stop and report if:

- The operator picks Option A or C. Both need a rewritten plan; A needs plan
  023 first and C needs plan 027 first.
- The new accent turns out to collide with the `warm` neutrals or the `court`
  imagery on any route, so that a CTA stops reading as a CTA.
- Any file outside `website/` needs to change under Option B. It should not.

## Maintenance notes

- After this lands, the accent lives in exactly two places: the Tailwind
  `primary` scale and `--accent-rgb`. Keep it that way; the two hardcoded
  rgba shadows are how it escaped last time.
- A reviewer should check the site and the app side by side rather than
  reviewing the diff alone. The diff cannot show whether the two surfaces now
  look like one product.

## Executor note, 2026-09-07 (app PR #12, website PR #6)

Option C was taken, so the Option B steps above were not followed.

The plan did not anticipate that `--color-primary` serves two jobs which pull
in opposite directions: a fill behind white text, and text on a dark ground. No
single hex clears 4.5:1 both ways, the crossover is around 4.1:1. Resolved by
keeping the fill white-legible in both themes and adding
`--color-accent-on-dark` for the two places that draw the accent as text over
video, Present mode and the telestration toolbar. Both are dark whatever the
theme, so a theme-dependent token was wrong for them.

The accent shipped as `#0B7972`, not the `#0A6E68` the direction hunt recorded.
See the note in plan 021.
