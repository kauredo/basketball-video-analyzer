# Plan 034: Stop demoting four real features to a leftovers drawer

> **Executor instructions**: Follow every step, run each verification command.
> Stop and report on any STOP condition. Update this plan's row in
> `plans/README.md` when done.
>
> **Repo**: monorepo of separate git repos. **`website/` only**.
>
> **Drift check**: from `website/`,
> `git diff --stat fa4bc39..HEAD -- src/pages/index.astro`

## Status

- **Priority**: P2
- **Effort**: M
- **Risk**: LOW
- **Depends on**: `plans/017-refresh-product-screenshots.md` if the rebuilt
  section uses imagery
- **Category**: direction
- **Planned at**: commit `fa4bc39`, 2026-09-07
- **Executor's tool**: `/build-ui` from step 2, identity settled

## Why this matters

The home page section headed "Okay, a few more things." is a 2x2 grid of four
heading-and-paragraph blocks with no images, no rules and no size variation. It
holds present mode, telestration, player tagging and the stats dashboard.

Those are four real features. Three other features each got a full pinned
section with a screenshot immediately above. So the page gives a screenshot and
a section to cutting, categorising and exporting, and gives four comparable
features a paragraph each in a grid that reads as a leftovers drawer.

Present mode in particular is the feature a coach uses standing in front of a
team, and it currently gets one paragraph in a 2x2.

## Current state

`src/pages/index.astro`, the section order on desktop:

1. Hero (heading, lede, Download button, 3D ball)
2. Product screenshot plus a three-up feature row
3. "How it works", three pinned steps, each with a screenshot
4. **"Okay, a few more things."**, the 2x2
5. "Coaching guides" (see `plans/033`)
6. Final CTA
7. Footer

The section's opening line is one of the page's better strings and is worth
keeping: "The loop is still cut, tag, export. These just make the film room
easier."

Measured: the section appears at `home-desktop-5`, roughly y≈3600 on a 5,753px
desktop page.

**The site's voice, which any rewrite must match.** First person, plain,
specific, no marketing adjectives. "I got tired of scrubbing through game tapes
in VLC, so I built this." No em dashes.

## Commands you will need

| Purpose | Command (from `website/`) | Expected |
|---|---|---|
| Build | `npm run build` | exit 0 |
| Dev server | `npm run dev` | port 4321 |

No test suite. `npm run build` is the gate.

## Scope

**In scope**:
- `src/pages/index.astro`, the "Okay, a few more things." section

**Out of scope**:
- The three pinned "How it works" steps. They work.
- The hero. That is `plans/031`.
- The guides section. That is `plans/033`.
- Adding features to the app. This is about how existing features are presented.

## Git workflow

- Branch: `refactor/more-things-section`
- Conventional commits; check `git log --oneline -5` and match. Never mention
  AI tools and never add AI co-author lines.

## Steps

### Step 1: Decide which of the four deserves promotion

Not all four need a full section; the page is already 5,753px on desktop and
about 8,685 CSS px on a phone. Pick the one or two that most change a coach's
decision to download, and let the others stay as short entries.

Present mode is the strongest candidate: it is the only feature that describes
what happens in the room with the team, and it is the one the app names in its
own UI. The stats dashboard is the second, because it is the thing a
comparison-shopper looks for against paid tools.

Record the choice in the PR description.

### Step 2: Give the promoted feature a real section

Match the shape of the "How it works" steps: a heading, two or three sentences
that name the mechanism, and a screenshot. Take the screenshot from the app
rather than describing the feature in the abstract.

For present mode, the screenshot must be of the fixed full-screen version, so
`plans/010-present-mode-fullscreen.md` has to land first. A screenshot of the
current 359px strip would advertise the bug.

**Verify**: `npm run build` → exit 0.

### Step 3: Rework what is left

The remaining two or three features do not need a 2x2 of identical blocks. A
short list, or a single paragraph naming them, does the same work in less
space and stops the grid reading as filler.

Keep the section's opening line. It is honest about what these features are:
secondary to the core loop.

**Verify**: at 1440px, the section no longer presents four visually identical
cards.

### Step 4: Check the page did not just get longer

Promoting a feature adds height; simplifying the remainder should give it back.

**Verify**: `document.documentElement.scrollHeight` at 1440px has not grown by
more than 200px, and at 393px it has not grown at all.

## Outcome, 2026-09-08 (website #14)

- Promoted: **Present mode**, with a real capture. Stats stayed in the prose.
- 1440px: 5328 to 5489, **+161**, inside the 200px budget.
- 393px: 5603 to 5630, **+27**. **Misses** the zero-growth criterion. A real
  screenshot costs height that collapsing the 2x2 does not fully return. The
  27px is what remained after cutting the padding between the two sections that
  now read as one band, and folding a closing beat into the paragraph above it.
- The 2x2 section shrank from 667 to 422 at 1440, and from 965 to 449 at 393.
- Step 2's dependency on `010` is satisfied and was verified at runtime, not
  taken from the diff. See `plans/README.md`.
- One bug introduced and fixed inside the change: a new section with no ground
  gets the hero's terracotta behind its body copy. See `plans/README.md`.

## Test plan

No test suite. By hand:

- At 1440px and 393px, the promoted feature reads as a peer of the "How it
  works" steps.
- The remaining features are still mentioned; nothing was silently dropped from
  the page.
- The opening line "The loop is still cut, tag, export…" survives.
- No new copy uses an em dash, a rule of three, or a marketing adjective.
- Page height is within the bounds in Step 4.

## Done criteria

- [ ] `npm run build` exits 0
- [ ] The section is no longer a 2x2 of four identical heading-and-paragraph
      blocks
- [ ] At least one feature has been promoted to a full section with a real
      screenshot
- [ ] Every feature previously named is still named somewhere on the page
- [ ] Desktop page height grew by no more than 200px; phone height did not grow
- [ ] `plans/README.md` status row updated

## STOP conditions

- `plans/010` has not landed and the promoted feature is present mode. Stop; a
  screenshot of the broken overlay is worse than the current paragraph.
- Promoting a feature would require new copy claiming something the app does
  not do. Check the feature in the running app before writing about it.

## Maintenance notes

- The 2x2 grew because features were added to the page one at a time with no
  place to put them. The next feature will face the same question; the answer
  is a section or a line, not a fifth card.
- A reviewer should scroll the page as a first-time visitor and ask, at the 2x2,
  whether they now know what present mode is.
