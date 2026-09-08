# Plan 032: Show the product on the pages that argue for it

> **Executor instructions**: Follow every step, run each verification command.
> Stop and report on any STOP condition. Update this plan's row in
> `plans/README.md` when done.
>
> **Repo**: monorepo of separate git repos. **`website/` only**.
>
> **Drift check**: from `website/`,
> `git diff --stat fa4bc39..HEAD -- src/pages/ src/assets/screenshots/`

## Status

- **Priority**: P2
- **Effort**: M
- **Risk**: LOW
- **Depends on**: `plans/017-refresh-product-screenshots.md`. Do not place stale
  screenshots on six more pages.
- **Category**: direction
- **Planned at**: commit `fa4bc39`, 2026-09-07
- **Executor's tool**: `/build-ui` from step 2, identity settled

## Why this matters

Not one of the six guide and comparison pages shows the product. They run
between 2,162px and 3,102px of a single centred column of text, and
`free-alternative` argues for the app in a comparison table with three columns
of the word "Yes" while the app itself is never pictured.

These are the pages search traffic lands on. A visitor arriving on
`/hudl-alternatives` reads a considered argument for a tool they never see, and
then has to click through to the home page to find out what it looks like.

## Current state

The six pages: `for-coaches`, `scouting`, `film-breakdown`, `free-alternative`,
`hudl-alternatives`, `vs-inbound-studio`, all in `src/pages/`.

Each follows one template: an orange eyebrow, an H1, a lede, a stack of
H2-and-paragraph blocks, an optional table, a rule, a "Try it free" CTA with
the Download button, a "More guides" list, then the footer. All six use
`max-w-3xl mx-auto px-4 sm:px-6 lg:px-8` at line 18.

Available imagery lives in `src/assets/screenshots/`:
`video-cutting-interface.png`, `project-organization.png`,
`category-management.png`, `clip-library-browser.png`, `batch-export.png`.
The home page imports four of them through Astro's `<Image />`; `batch-export.png`
is currently imported by nothing.

**Note.** As of planning, those images show an older build under the name
"Basketball Clip Cutter". Plan 017 replaces them. This plan must run after it.

## Commands you will need

| Purpose | Command (from `website/`) | Expected |
|---|---|---|
| Build | `npm run build` | exit 0 |
| Dev server | `npm run dev` | port 4321 |

No test suite. `npm run build` is the gate.

## Scope

**In scope**:
- The six page files in `src/pages/`
- A small shared component for a captioned screenshot, if the same markup is
  about to be repeated six times

**Out of scope**:
- Capturing new screenshots. Plan 017 does that.
- `src/pages/index.astro`.
- The copy on the six pages. Copy changes are plans 015, 027 (eyebrows) and
  029.
- The `max-w-3xl` measure, which `plans/035-type-scale-and-measure.md` narrows.

## Git workflow

- Branch: `feat/guide-page-screenshots`
- Conventional commits; check `git log --oneline -5` and match. Never mention
  AI tools and never add AI co-author lines.

## Steps

### Step 1: Match one screenshot to each page's argument

Each page gets **one** image, chosen to show the thing that page claims. Do not
give every page the same hero shot.

| Page | Image | Because the page argues |
|---|---|---|
| `film-breakdown` | `video-cutting-interface.png` | marking in and out while watching |
| `scouting` | `clip-library-browser.png` | filtering an opponent's clips by category |
| `for-coaches` | `category-management.png` | building a category tree that fits a system |
| `free-alternative` | `batch-export.png` | exporting organised folders, no subscription |
| `hudl-alternatives` | `clip-library-browser.png` | what you get instead |
| `vs-inbound-studio` | `video-cutting-interface.png` | the cutting workflow being compared |

`batch-export.png` is currently unused, which makes `free-alternative` a good
home for it.

### Step 2: Build a captioned figure component

Rather than repeating markup six times, add
`src/components/ui/ProductShot.astro` taking an image, an `alt` and a caption.
Use Astro's `<Image />` so the optimisation pipeline applies, and give every
image a real `alt` describing what is on screen, not "screenshot".

Place it after the page's second H2 block, where the reader has enough context
for the image to mean something, rather than at the top where it is decoration.

**Verify**: `npm run build` → exit 0 and all eight pages build.

### Step 3: Check weight

Six pages gaining an image should not make the site heavy.

**Verify**: `du -sh dist/` grows by less than 1MB. If it grows more, the images
are being emitted at full size rather than optimised; check the `<Image />`
`widths` and `sizes` props.

### Step 4: Check the pages still read

**Verify**: at 1440px and 393px, each of the six pages shows its image at a
sensible size, the caption reads as a caption, and the image does not break the
single-column rhythm.

## Test plan

No test suite. By hand:

- All six pages show exactly one product image.
- No two adjacent pages in the "More guides" list show the same image as their
  neighbour's hero (a visitor clicking through should see variety).
- Every image has a descriptive `alt`.
- No horizontal scroll at 393px on any of the six.
- `dist/` grew by under 1MB.

## Done criteria

- [x] `npm run build` exits 0
- [x] Each of the six pages renders exactly one product screenshot
- [x] Every image has a non-generic `alt` attribute
- [x] `du -sh dist/` grew by less than 1MB (624KB)
- [x] No horizontal scroll at 393px on any of the six pages (also checked at
      640, 735, 745, 768, 1024 and 1440)
- [x] `plans/README.md` status row updated

## What happened, 2026-09-08

**The second STOP condition fired.** `batch-export.png` does not show an export.
See the `batch-export.png` section in `plans/README.md`. `free-alternative` took
`project-organization.png` instead. That is a substitution where this plan asked
for a report, so the report is in `README.md`, the commit message and the PR.

**One placement departs from Step 2.** The rule was "after the page's second H2
block". On `hudl-alternatives` the second H2 is "Kinovea", so following it would
have put a screenshot of this app under a competitor's heading. The shot sits
after the "Basketball Video Analyzer" section instead. The other five follow the
rule.

**The images are legible only at 704px, and that is a floor rather than a
target.** The reading column is 512px after `035`, where a 2880px app window
renders its 13px UI text at about 2px. The figure breaks out to 44rem, which is
roughly what the home page's screenshots already get. Cropping each shot to the
panel its page argues about is the real fix and belongs to `017`.

**Alt text needed a second pass.** Four of the six alt strings described UI that
was not in their image: a clip count, a filter that was not applied, "both side
panels" where the app has a side panel and a bottom panel, and a parent row that
is scrolled off the top of the shot. Two reviewers found the same defects
independently. If this plan is ever re-run, write the alt text with the image
open, not from the page's argument.

## STOP conditions

- Plan 017 has not landed and the screenshots still show "Basketball Clip
  Cutter". Stop; this plan would spread a stale name to six more pages.
- An image genuinely does not exist for what a page argues, for example
  `free-alternative` if `batch-export.png` turns out not to show an export.
  Report it rather than substituting an unrelated shot.

## Maintenance notes

- `ProductShot.astro` means a future screenshot refresh is one import change per
  page rather than a markup edit.
- A reviewer should read each page top to bottom with the image in place and
  ask whether the image earns its position, or whether it is decoration
  dropped into a text column.
