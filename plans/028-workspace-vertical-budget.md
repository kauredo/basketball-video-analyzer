# Plan 028: Give the film more of the workspace

> **Executor instructions**: This plan changes layout, so it goes through
> `/build-ui` from step 2 rather than being a direct edit. Stop and report on
> any STOP condition. Update this plan's row in `plans/README.md` when done.
>
> **Repo**: monorepo of separate git repos. **`app/` only**.
>
> **Drift check**: from `app/`,
> `git diff --stat 9a863ed..HEAD -- src/renderer/App.tsx src/renderer/styles/App.module.css src/renderer/components/VideoPlayer.tsx`

## Status

- **Priority**: P1
- **Effort**: L
- **Risk**: MED
- **Depends on**: `plans/029-single-hint-line.md`, which removes one of the
  stacked bands this plan reclaims
- **Category**: tech-debt
- **Planned at**: commit `9a863ed`, 2026-09-07
- **Executor's tool**: `/build-ui` from step 2, identity settled

## Why this matters

`workspace.png` is the screen every user lives in, and the film gets 325px of a
900px window, about 36%. Below the video sit five separate full-width bands,
each with its own background and padding: the scrub bar, the transport row, a
hint banner, the mark-in/mark-out row, and the bottom panel header. The eye
crosses four horizontal edges to travel from the film to the clip list.

It gets worse in use. Pressing Z stacks a second hint banner, and the video
pane drops from 325px to 217px. One keystroke costs a third of the film height
and the whole layout jumps while the user is trying to watch a play.

The same cramped budget produces the truncated clip titles: "Corner three off
the wea" is cut at x=340 while the timeline to its right has room to spare.

## Current state

Measured from a 1440x900 capture on 2026-09-07, top to bottom:

| Band | Height | Source |
|---|---|---|
| Header | ~60px | `.appHeader`, `App.module.css:418` |
| Video pane | 325px | `VideoPlayer.tsx` |
| Scrub bar | ~20px | `VideoPlayer.tsx` |
| Transport row | ~56px | `VideoPlayer.tsx` |
| Hint banner | ~48px (x2 when marking) | `ContextualHint.tsx` |
| Mark row | ~56px | `App.tsx` |
| Bottom panel | ~300px default | `.bottomPanel`, `App.module.css:117` |

The panels are resizable and their sizes persist through `loadPref`/`STORAGE_KEYS`
(`App.tsx:74-77`), so any change has to respect a user's saved sizes rather
than forcing new ones.

**Repo conventions.** CSS Modules, tokens from `variables.css`, panel sizes in
`localStorage` via the `STORAGE_KEYS` helpers in `App.tsx`.

## Commands you will need

| Purpose | Command (from `app/`) | Expected |
|---|---|---|
| Install | `npm install --allow-git all` | exit 0 |
| Build | `npm run build` | exit 0 |
| Run | `npm start` | window opens |

No test suite. `npm run build` is the gate. If install scripts are blocked,
approve `better-sqlite3 electron ffmpeg-static`, reinstall, and revert the
`allowScripts` block from `package.json`.

## Scope

**In scope**:
- `src/renderer/App.tsx` (the band structure between the video and the bottom
  panel)
- `src/renderer/styles/App.module.css`
- `src/renderer/components/VideoPlayer.tsx` (transport and scrub bar)

**Out of scope**:
- Removing any control. This plan merges bands, it does not drop features.
  Every button in the transport and mark rows stays reachable.
- The keyboard shortcuts. Z, M, Escape and the arrow keys keep working exactly
  as they do.
- The bottom panel's internals (the clip list, the timeline). Only its
  container's share of the height changes.
- The side panel.

## Git workflow

- Branch: `refactor/workspace-vertical-budget`
- Conventional commits; check `git log --oneline -5` and match. Never mention
  AI tools and never add AI co-author lines.

## Steps

### Step 1: Merge the transport and mark rows into one control strip

The transport row (play, skip buttons, time display, jump-to-time, volume,
speed) and the mark row (Mark In, mark readouts, Mark Out, Clear Marks) are two
full-width bands doing one job: controlling playback and marking. Merge them
into a single strip.

Keep the mark buttons visually distinct, since they are the app's primary
action. Keep the mark readouts ("Mark In: --:--", "Mark Out: --:--",
"Duration: --:--") visible; they are how a user confirms a mark landed.

Target: one strip of roughly 64px replacing two bands totalling roughly 112px.

**Verify**: `npm run build` → exit 0, and every control present before is
present after. List them in the PR description.

### Step 2: Fold the scrub bar into the strip or the video pane

The scrub bar is a 20px band with its own background between the video and the
transport row. Attach it to the bottom edge of the video pane, which is where a
viewer expects it and where it stops being a separate horizontal edge.

**Verify**: scrubbing still works, and the playhead still tracks.

### Step 3: Give the reclaimed height to the video

With plan 029's single hint line and Steps 1 and 2, roughly 180px comes back.
Give it to the video pane by default, taking it from about 36% of the window to
roughly 55%.

Respect saved preferences: a user who has already resized their panels keeps
their sizes. Apply the new default only when no saved value exists.

**Verify**: on a fresh profile (delete the app's `localStorage` or use a clean
user-data directory), the video pane is at least 480px tall at a 900px window.
On a profile with saved sizes, those sizes are honoured.

### Step 4: Confirm the layout no longer jumps when marking

Press Z with the workspace open.

**Verify**: the video pane's height does not change. Before this work it
dropped by 108px.

### Step 5: Check the clip title truncation

With the extra room, confirm clip titles in the bottom panel are no longer cut
mid-word without an ellipsis. If they still are, that is a width problem in the
clip list rather than a height one; add `text-overflow: ellipsis` with a
`title` attribute carrying the full text, and note it in the PR.

**Verify**: no clip title is cut mid-word without an ellipsis.

## Test plan

No test suite. By hand, at 1440x900 and 1024x680:

- Every control from the old transport and mark rows is present and works.
- Z and M still mark; Escape still clears; arrows still step frames.
- The video pane does not resize when a mark lands.
- Panels are still resizable and their sizes still persist across a restart.
- A fresh profile gets the new default; an existing profile keeps its sizes.
- Both themes.

## Done criteria

- [ ] `npm run build` exits 0
- [ ] On a fresh profile at 900px window height, the video pane is ≥ 480px
- [ ] Pressing Z does not change the video pane's height
- [ ] Every control that existed before the change still exists and works
      (enumerated in the PR description)
- [ ] Saved panel sizes from an existing profile are honoured
- [ ] No clip title is cut mid-word without an ellipsis
- [ ] `plans/README.md` status row updated

## STOP conditions

- Merging the two rows means a control has to be hidden behind a menu. Stop and
  report; hiding the speed control or the jump-to-time field is a product
  decision, not a layout one.
- Any keyboard shortcut stops working after the restructure.
- The reclaimed height turns out to be less than about 120px, which would make
  the 55% target unreachable. Report the real number rather than shrinking the
  bottom panel to hit a percentage.

## Maintenance notes

- The bands grew one at a time, each reasonable on its own. Worth a comment in
  `App.module.css` recording the vertical budget so the next addition has to
  justify itself.
- A reviewer should press Z while watching the video pane's top edge. The jump
  is the clearest symptom and it is invisible in a static screenshot.

## BLOCKED, 2026-09-07: measured, and the target is unreachable as written

Measured at 1440x900 against a seeded project, not from a capture. Two of the
numbers in the band table above are wrong, and the diagnosis is wrong too.

| Band | Plan said | Measured |
|---|---|---|
| Video | 325px, 36% | **275px, 30.6%** |
| Scrub | ~20 | 8, plus a 16 margin |
| Transport row | ~56 | **90, because it wraps to two rows** |
| Hint | ~48 x2 | 41, and after plan 029 it can no longer double |
| Mark row | ~56 | 45 |
| Control block total | — | **265, of which only 143 is controls** |

### The real defect is not five stacked bands

It is that the transport row does not fit. Measured with the side panel open,
which is a normal working state:

- `controlsRow` content is **1243px** against **1048px** available, over by
  **195px**, so it wraps to two rows and costs 45px of height.
- With the side panel closed there is about 1408px available, so it fits on one
  row and the wrap disappears.

The widest children are the jump-to-time field at **208px**, the volume control
at **112px** and the time display at **104px**.

### Why this is a STOP and not a deferral

Closing a 195px overflow means a control gives way when the workspace is
narrow. This plan's own STOP condition covers that exactly:

> Merging the two rows means a control has to be hidden behind a menu. Stop and
> report; hiding the speed control or the jump-to-time field is a product
> decision, not a layout one.

Separately, the arithmetic does not reach the stated goal. Realistic reclaim
without removing a control is roughly 110 to 140px: about 45 from the wrap,
about 45 from merging the mark row, and the rest from the 122px this block
currently spends on padding and gaps. That takes the video from 275px to
roughly 385-415px, or **44%**. The plan asks for 480px and 55%, which is only
reachable by taking height from the bottom panel, and this plan forbids that.

### What this plan needs before it runs

1. **A product decision**: which control yields when the video area is under
   about 1100px wide. The candidates by width are jump-to-time, volume, speed.
2. **A restated target**: 44% is achievable, 55% is not without touching the
   bottom panel.
3. **The `/build-ui` pass it already asks for.** Merging the transport and mark
   rows is composition, not a token change, and should not be squeezed in
   behind a stack of bug fixes.

## Part 1 done, 2026-09-07 (app PR #22): the transport fits on one row

The operator chose to collapse volume and speed to icon popovers. Speed was
already a popover; only volume needed moving, which is 112px to 36px. That alone
left 119px of the 195px overflow, so two more changes were needed: the row gap
from 16px to 8px, and the jump-to-time field's fixed 200px floor replaced by a
180px basis.

**Transport 90px to 42px. Video 275px to 323px, 30.6% to 35.9%.**

Two CSS facts worth not rediscovering:

- `flex-wrap` decides a line break from each item's **hypothetical** size, before
  any shrinking. `flex-shrink` alone cannot prevent a second row, so making the
  search field shrinkable changed nothing until its basis came down.
- `flex-wrap: nowrap` stops the wrap but clips controls off the right edge at
  1180px and below, 971px of content in 632px. Wrapping is the safer failure.

## Part 2, still open: the video collapses at small windows

Found while measuring part 1, and **measured on the branch before the change to
confirm it is pre-existing**:

| Window | video height |
|---|---|
| 1440x900 | 323px |
| 1180x760 | 79px |
| **1024x680** | **0px** |

The bottom panel holds a fixed 300px and the control block 217px. At 680px of
window height there is nothing left for the film, so the app is unusable at that
size. This is more serious than the 36%-versus-55% question the plan was written
around, and it should be part 2's real subject.

Options, none chosen: give the video a min-height and let the bottom panel yield;
make the bottom panel's default proportional rather than a fixed 300px; or
collapse the bottom panel automatically below a window-height threshold. All
three interact with the saved panel sizes in `STORAGE_KEYS`, so whichever is
taken has to respect a user's existing preference.
