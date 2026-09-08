# Plan 027: Settle one identity and carry it across both surfaces

> **Executor instructions**: This is the audit's headline verdict. It is a
> design effort, not a single code change, and it sets decisions that several
> other plans implement. Stop and report on any STOP condition. Update this
> plan's row in `plans/README.md` when done.
>
> **Repo**: monorepo of separate git repos. Outputs land in **`website/`** and
> **`app/`**.
>
> **Drift check**: from `website/`, `git diff --stat fa4bc39..HEAD -- src/ tailwind.config.cjs`;
> from `app/`, `git diff --stat 9a863ed..HEAD -- src/renderer/styles/`

## Status

- **Priority**: P2
- **Effort**: L
- **Risk**: MED
- **Depends on**: none. **Blocks** the final choices in
  `plans/018-single-accent-across-surfaces.md` and
  `plans/026-draw-a-real-mark.md` if the operator wants the direction hunt to
  decide them.
- **Category**: direction
- **Planned at**: `website` `fa4bc39`, `app` `9a863ed`, 2026-09-07
- **Executor's tool**: `/build-ui` from step 1, direction hunt included

## Why this matters

The 2026-09-07 audit returned the verdict **rebrand the product**, under the
rule that the mark verdict was START OVER and the product has only a few early
users, which is the window where a new look costs nothing.

Read "rebrand" narrowly. The expensive, genuinely broken parts are the mark and
the fact that the two surfaces share no accent, no typeface and no name. The
site's typography and its writing are the two best things in the audit and are
on the keep-list below. This plan is not a licence to start from a blank page.

Scores that produced the verdict: Mark 2/10, Brand 4/10, Colour 4/10,
Type 6/10, Composition 5/10, Copy 7/10, Interaction 4/10, States 4/10.

## The keep-list, and it is binding

A rebrand that carries these forward beats one that starts from nothing, and a
result that drops any of them is a regression. Seed the direction hunt with
them.

- **Z and M as a two-key vocabulary**, printed into the controls: "Mark In (Z)",
  "Mark Out (M)", and the hint "Press Z to mark the start of a clip, M to mark
  the end."
- **The `└` branch glyph in category chips**: `└ Pick & Roll`, `└ Zone Defense`,
  each outlined in its parent's colour.
- **Per-category timeline swimlanes**, one lane per category with coloured
  markers.
- **The quarter row in Create Clip**: Q1 Q2 Q3 Q4 OT, with "Shot location
  (optional)" beneath.
- **The voice.** "I got tired of scrubbing through game tapes in VLC, so I
  built this. Mark plays, organize clips, export folders. That's it."
  "This isn't a Hudl replacement, and I won't pretend it is."
  "Those are real features. If you need them, pay for them."
  "A couple of rows say 'check their feature list' where I couldn't confirm the
  current state from the outside, and I'd rather say that than guess."
- **"This relies on YouTube's service and may not always work."**
- **Space Grotesk on warm paper.** The site's type pairing is a real choice.
- **The Select Project screen**: dashed green create affordance, solid card for
  import, muted card for YouTube. The app's best colour work.

## Current state

The two surfaces share nothing:

| | Website | Desktop app |
|---|---|---|
| Accent | `#FF6B35` (`tailwind.config.cjs`, `primary.500`) | `#4CAF50` (`src/renderer/styles/variables.css:5`) |
| Neutrals | warm browns, `warm-50` `#FDFBF7` to `warm-950` | pure greys, `#1a1a1a` to `#ccc` |
| Display face | Space Grotesk Variable | none declared |
| Body face | DM Sans Variable | platform default (`src/renderer/index.html:11`) |
| Name | "Basketball Analyzer" | "Basketball Video Analyzer" |
| Mark | thin outline basketball (inline SVG) | heavy filled basketball (`assets/icon.png`) |

There is also a stale spec. `website/docs/DESIGN.md` documents a palette that
no longer matches either surface; it names `#ff6b35` as primary alongside
"court wood" secondaries and pure-grey neutrals. Treat it as a historical
document, not a source of truth, and rewrite it as an output of this plan.

## What this plan produces

Not code. Four artefacts:

1. **A direction**, chosen from a hunt of several, with the keep-list carried
   forward.
2. **One accent decision**, resolving `plans/018`. Note the constraint that
   plan documents: the app's default category presets already own the orange
   band (Offense `#FF5722`, Pick & Roll `#FF7043`, Isolation `#FF8A65`, Fast
   Break `#FFAB91`, Post Up `#FFCCBC`), so an orange action colour collides
   with category identity unless `plans/023` re-hues the presets first.
3. **One type decision**, applying across both surfaces. The app currently has
   no typeface at all, so this is additive there; `plans/020` implements it.
4. **A rewritten `website/docs/DESIGN.md`** recording the accent, the neutral
   scale, the type scale, the radius and the focus ring, with the measured
   contrast ratios from `plans/021`.

## Steps

### Step 1: Run the direction hunt

Invoke `/build-ui` from step 1. Give it:

- the keep-list above, verbatim, as material to carry forward
- the current-state table above
- the constraint that whatever is chosen has to work in a dense desktop tool
  with a video pane, a timeline and two side panels, as well as on a marketing
  page. The app is the harder constraint; direction hunts that only look good
  on a landing page will fail here.
- the audit report at `website/docs/design-audit-2026-09-07.md` for context

### Step 2: Test the direction against the app, not the site

The site is one page and forgiving. The app is a 1440x900 window with a video
pane, five stacked control bands, a timeline with per-category swimlanes and
two panels. Apply the candidate direction to `workspace.png` and
`clip-creator.png` before applying it to the landing page.

**Verify**: the direction survives the workspace without making the timeline
harder to scan. If it does not, it is the wrong direction regardless of how the
landing page looks.

### Step 3: Record the decisions

Rewrite `website/docs/DESIGN.md` with what was chosen. It must state:

- the accent hex and the one job it does
- the neutral scale
- the two typefaces and the size scale
- the focus ring construction
- which colours are reserved for category identity and therefore unavailable to
  the UI
- the measured contrast ratio for the primary button label

**Verify**: `DESIGN.md` no longer describes a palette that neither surface uses.

### Step 4: Hand off to the implementing plans

The decisions here feed:

- `plans/018` (accent), which currently defaults to Option B if this plan does
  not run
- `plans/020` (typefaces)
- `plans/021` (contrast, which must be recomputed against the new accent)
- `plans/026` (the mark)
- `plans/023` (category colours, if the accent decision requires it)

Update each of those plans' "Depends on" line and note the decision.

## Done criteria

- [ ] A direction is chosen and recorded
- [ ] Every item on the keep-list is present in the chosen direction, or its
      absence is explicitly justified in writing
- [ ] The direction has been applied to the app's workspace, not only to the
      landing page
- [ ] `website/docs/DESIGN.md` describes what the product actually uses
- [ ] Plans 018, 020, 021, 023 and 026 have been updated with the decisions
- [ ] `plans/README.md` status row updated

## STOP conditions

- The direction hunt produces something that drops the voice or the Z/M
  vocabulary. Those are the product's only distinctive assets; a direction that
  loses them is worse than the current one.
- The chosen accent collides with the category palette and the operator does
  not want `plans/023` to run. Report the conflict rather than shipping an
  action colour that means "offensive possession" on the same screen.
- The operator's answer on user numbers changes from "a few" to "daily". The
  verdict rule that produced this plan depends on it, and with daily users the
  audit's own guidance is to fix rather than rebrand.

## Maintenance notes

- Whatever is decided has to survive Windows and Linux, where the app currently
  renders in Segoe UI and Roboto. Roughly half the app's downloads are Windows.
- A reviewer should ask to see the app and the site side by side. That is the
  defect this plan exists to close, and no diff shows it.
