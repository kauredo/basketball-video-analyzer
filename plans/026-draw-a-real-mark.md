# Plan 026: Draw a mark that belongs to this product

> **Executor instructions**: This is a design plan, not a code change. It ends
> with chosen artwork and a critique, not a merged feature. Stop and report on
> any STOP condition. Update this plan's row in `plans/README.md` when done.
>
> **Repo**: monorepo of separate git repos. When the mark ships it touches
> **`website/`** (navbar SVG, favicon set) and **`app/`** (`assets/icon.png`).
>
> **Drift check**: from `website/`,
> `git diff --stat fa4bc39..HEAD -- src/components/ui/Navbar.astro public/`

## Status

- **Priority**: P2
- **Effort**: L
- **Risk**: MED
- **Depends on**: `plans/027` DECIDED, Scorebook. The mark is drawn in that
  direction's grammar: 1px hairline construction, no fills or shadows, legible
  as a single colour so the navbar's `currentColor` works. settled by plan 027 on 2026-09-07: accent `#14A79A` teal (light face `#0A6E68`, dark face `#3ED0C2`), type Space Grotesk display + IBM Plex Sans interface + IBM Plex Mono numerals. Tokens in `website/docs/DESIGN.md`.
- **Category**: direction
- **Planned at**: `website` `fa4bc39`, 2026-09-07
- **Executor's tool**: `ui-ux-pro-max:design` for the exploration, then
  `/critique` on the result

## Why this matters

The 2026-09-07 audit scored the mark **2/10** and returned a verdict of START
OVER. All three failure conditions apply at once: it is assembled from an
icon-set glyph and a typeface, it is illegible at 16px, and it is the generic
mark for its category.

Concretely, the navbar mark is a 24x24 viewBox at `stroke-width: 1.5`, one
circle path plus three seam arcs, which is the standard construction of a stock
basketball icon, set beside "Basketball Analyzer" in Space Grotesk Semibold.
Downsampled to 16px the seams merge into the rim and it renders as a grey
smudge with a vertical bar.

Worse, the product ships **two different basketballs at the same time**. The
navbar shows a thin outline ball; the browser tab beside it shows a heavy
filled one, because `app/assets/icon.png`, `website/public/favicon.png` and
`website/public/images/icon.png` are the same heavy filled glyph.

The category failure is the "stock cutlery" one. The product cuts film into
categorised clips; the mark says "basketball" and stops there. It would sit
equally well on a league scheduler, a scores app or a shoe store.

## Current state

`website/src/components/ui/Navbar.astro:9-15` holds the inline SVG:

```astro
        <svg class="w-6 h-6" viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <path d="M3.33946 16.9997C6.10089 21.7826 12.2168 23.4214 16.9997 20.66C..." stroke="currentColor" stroke-width="1.5"/>
          <path d="M16.9498 20.5732C16.9498 20.5732 16.0108 13.982 14.0005 10.5C..." stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
          <path d="M21.8638 12.5803C16.4528 11.3933 9.05903 16.348 7.57739 20.8177" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
          <path d="M16.4141 3.20884C14.9262 7.6299 7.67443 12.5122 2.28877 11.4515" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
        </svg>
```

The raster set: `website/public/favicon.png`, `favicon-16x16.png`,
`favicon-32x32.png`, `apple-touch-icon.png`, `public/images/icon.png`, and
`app/assets/icon.png`.

## The brief

**What the mark has to carry.** The product's own gesture, not its category
noun. The audit's keep-list names the material:

- **Z and M bracketing a moment.** The two keys are printed into the controls
  themselves ("Mark In (Z)", "Mark Out (M)") and into the in-app hint. This is
  the product's actual vocabulary.
- **The in/out bracket.** A green Mark In pin and a red Mark Out pin enclosing
  a span of time. That shape is what the app does, drawn.
- **The `└` branch glyph** used in category chips, if a secondary device is
  wanted.

**Hard constraints.**

- Must hold at **16px**. Two heavy forms survive that size; thin seam arcs do
  not. Test at 16px before anything else.
- Must hold at **512px** for the app icon and the store listings.
- One asset, used by the navbar, the favicon set and the Electron app icon.
  Shipping two basketballs again is the failure this plan exists to end.
- Must work in a single colour, since the navbar renders it with
  `currentColor`.
- Must not depend on the accent, because
  `plans/018-single-accent-across-surfaces.md` may change it.

**What to avoid.** A basketball. A play button. A film strip. A pair of
scissors. Each is the category default for a neighbouring category, and the
audit's whole point is that the current mark is a category default.

## Steps

### Step 1: Explore

Invoke `ui-ux-pro-max:design` with the brief above. Ask for several distinct
directions, not variations on one idea, and require each to be shown at 16px,
32px and 512px in the same sheet.

### Step 2: Test at 16px first

Reject anything that does not read at 16px, before judging it at any other
size. That is the constraint the current mark fails, and it is the one most
easily lost in a review that looks at the large version.

**Verify**: each surviving candidate is recognisable in a 16x16 PNG, viewed at
100%, not scaled up.

### Step 3: Critique from outside

Run `/critique` on the shortlist. Give the critic the rendered marks and
nothing else: no rationale, no brief, no account of what the shapes mean. A
mark that needs its story explained has failed.

Ask specifically: cover the wordmark; can you name the product's category? Can
you tell it apart from the other candidates at 16px?

### Step 4: Produce the asset set

Once a direction is chosen, produce:

- an inline SVG for `website/src/components/ui/Navbar.astro`, single-path where
  possible, using `currentColor`
- `favicon-16x16.png`, `favicon-32x32.png`, `favicon.png`, `apple-touch-icon.png`
- `website/public/images/icon.png`
- `app/assets/icon.png` at 512px, plus whatever sizes `forge.config.js`
  requires for the Windows and Linux builds

**Verify**: all raster sizes derive from the same source, and the navbar SVG
and the favicon are visibly the same mark.

### Step 5: Ship it in both repos

Two branches, two commits. Confirm the Electron build picks up the new icon:
`npm run package` from `app/` and check the produced app's icon.

**Verify**: `npm run build` exits 0 in both repos; the packaged app shows the
new icon; the site's tab shows the new favicon.

## Done criteria

- [ ] One mark, used by the navbar, every favicon size and the app icon
- [ ] The mark is legible at 16x16 viewed at 100%
- [ ] `/critique` on the shortlist did not identify the chosen mark as a
      category default
- [ ] `npm run build` exits 0 in both repos
- [ ] `npm run package` from `app/` produces a build carrying the new icon
- [ ] No file still contains the old four-path basketball SVG
- [ ] `plans/README.md` status row updated

## STOP conditions

- Every candidate fails at 16px. Report the sheet; the answer is a simpler,
  heavier construction, not a compromise on the size test.
- The chosen direction needs the accent colour to work. Report it; the mark has
  to survive a single-colour render because the navbar uses `currentColor`.
- `forge.config.js` needs icon formats (`.icns`, `.ico`) that the exploration
  did not produce. Generate them from the same source rather than substituting.

## Maintenance notes

- Keep the source file (the vector original) in the repo, not just the exports.
  The current mark's problem is partly that nobody can regenerate it.
- A reviewer should look at the browser tab and the app's dock icon side by
  side. Two different basketballs is the exact failure being fixed.
