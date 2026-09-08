# Plan 017: Replace the stale product screenshots

> **Executor instructions**: Follow this plan step by step. If anything in
> "STOP conditions" occurs, stop and report. When done, update this plan's
> status row in `plans/README.md`.
>
> **Repo**: monorepo of separate git repos. This plan touches **`website/`
> only**, but capturing the images requires running the app from `app/`.
>
> **Operator input required**: capturing real screenshots needs game footage
> the operator has the rights to publish. See "Operator input".
>
> **Drift check (run first)**: from `website/`, run
> `git diff --stat fa4bc39..HEAD -- src/assets/screenshots/ src/pages/index.astro`

## Status

- **Priority**: P2
- **Effort**: M
- **Risk**: LOW
- **Depends on**: `plans/016-one-product-name.md` (so the captured app header
  and the site agree on the name)
- **Category**: docs
- **Planned at**: `website` commit `fa4bc39`, 2026-09-07
- **Executor's tool**: the `screenshots` skill

## Why this matters

Every product screenshot on the home page shows an older build of the app under
a name the product no longer uses. The titlebar in
`src/assets/screenshots/video-cutting-interface.png` reads **"Basketball Clip
Cutter"**, and the header in that image has three buttons where the shipped app
has six.

These images are the site's only proof that the product exists. They currently
advertise a different, older product, and they undercut the page around them:
the copy says "Check the stats tab" while the screenshot beside it shows a
header with no Stats button.

## Current state

Five images, all imported by `src/pages/index.astro` (lines 10-13 plus one
more):

| File | Size | Used at |
|---|---|---|
| `src/assets/screenshots/video-cutting-interface.png` | 6.5M | `index.astro:64` (hero) |
| `src/assets/screenshots/project-organization.png` | 3.8M | `index.astro:167` |
| `src/assets/screenshots/category-management.png` | 230K | `index.astro:192` |
| `src/assets/screenshots/clip-library-browser.png` | 2.2M | `index.astro:217` |
| `src/assets/screenshots/batch-export.png` | 195K | not imported by `index.astro` |

`src/pages/index.astro:10-13`:

```astro
import videoCuttingImg from '@/assets/screenshots/video-cutting-interface.png';
import projectOrgImg from '@/assets/screenshots/project-organization.png';
import categoryMgmtImg from '@/assets/screenshots/category-management.png';
import clipLibraryImg from '@/assets/screenshots/clip-library-browser.png';
```

They are rendered through Astro's `<Image />` component, so replacing the files
in place keeps the imports and the optimisation pipeline working.

**What has changed in the app since these were taken.** The header now carries
six controls: Select Project, Show/Hide Side Panel, Show/Hide Bottom Panel,
Stats, Settings, and an icon-only help button. The clip library sits in a right
side panel with category and player filters. The timeline shows per-category
swimlanes. None of that is visible in the current images.

**Two known problems these images must not repeat.** First, the hero screenshot
is 6.5MB, which is heavy for an above-the-fold asset even after Astro's
optimisation. Second, the screenshots are the one place the site currently gets
the shortcut keys right, so whatever replaces them must still show the real
"Mark In (Z)" and "Mark Out (M)" buttons.

## Operator input

The app shows video. A screenshot of the app shows whatever game is loaded, so
the operator must supply footage they can publish: their own team's game film,
or footage with clearance. Do not capture with:

- Placeholder or colour-bar footage. It makes the product look like a demo.
- Broadcast footage or anything rights-encumbered.

If no publishable footage is available, STOP and report. Do not substitute
generated imagery for a product screenshot; a fake screenshot of a real product
is worse than a stale one.

## Commands you will need

| Purpose | Command | Expected on success |
|---|---|---|
| Build app | `npm run build` (from `app/`) | exit 0 |
| Run app | `npm start` (from `app/`) | app window opens |
| Build site | `npm run build` (from `website/`) | exit 0 |

`app/` install note: run `npm install --allow-git all`; if install scripts are
blocked, run `npm install-scripts approve better-sqlite3 electron ffmpeg-static`,
install again, and revert the `allowScripts` block added to `package.json`.

## Scope

**In scope**:
- `src/assets/screenshots/video-cutting-interface.png`
- `src/assets/screenshots/project-organization.png`
- `src/assets/screenshots/category-management.png`
- `src/assets/screenshots/clip-library-browser.png`
- `src/pages/index.astro`, only if an image's aspect ratio changes enough to
  need a class adjustment

**Out of scope** (do NOT touch):
- `src/assets/screenshots/batch-export.png`. Nothing imports it. Leave it;
  deleting unused assets is a separate cleanup.
- The copy around the images. Copy changes are plans 015, 016, 029 and 037.
- The app itself. Capture what ships; do not dress the app up for the photo.

## Git workflow

- Branch: `chore/refresh-screenshots`
- Commit style: conventional commits; check `git log --oneline -5` and match.
- Never mention AI tools in commit messages and never add AI co-author lines.
- Large binary files: check `git config core.bigFileThreshold` and confirm the
  repo does not use Git LFS before committing multi-megabyte PNGs. At planning
  time it does not.

## Steps

### Step 1: Invoke the `screenshots` skill

Use the `screenshots` skill to plan and capture. It knows this project's
conventions for framing and export. Give it:

- the four filenames above and what each one has to show,
- the app running from `app/` with the operator's footage loaded,
- a target window size of 1440x900, matching the audit captures.

### Step 2: Capture the four views

| File | What it must show |
|---|---|
| `video-cutting-interface.png` | The workspace with video playing, the transport row, and the mark row with **Mark In (Z)** and **Mark Out (M)** visible and legible |
| `project-organization.png` | The Select Project screen with at least two real projects listed |
| `category-management.png` | The category tree with nested subcategories, showing the `└` branch glyph and parent-coloured chips |
| `clip-library-browser.png` | The right side panel with the clip list, the category filter and the player filter, several clips visible with thumbnails |

Every capture must show the current six-button header and the current product
name.

### Step 3: Keep the files light

Export at 2x the rendered display width, not at raw retina size. The hero image
renders at roughly 1088px on desktop, so 2176px wide is enough.

**Verify**: `ls -la src/assets/screenshots/` shows no file above 1.5MB.

### Step 4: Confirm the page still lays out

**Verify**: `npm run build` from `website/` → exit 0. Then `npm run dev` and
check the home page at 1440px and at 393px. The four images sit where they did,
none is stretched, and the labels inside the hero image are legible at its
rendered size.

## Test plan

No test suite. Verify by hand:

- Open each new PNG at 100% and read the header. It must say "Basketball Video
  Analyzer" and show six controls.
- The hero image's "Mark In (Z)" and "Mark Out (M)" buttons are legible at the
  size the page renders it.
- The home page builds and lays out unchanged at 1440px, 768px and 393px.
- Total page weight has not grown. Compare `du -sh dist/` before and after.

## Done criteria

ALL must hold:

- [ ] `npm run build` exits 0 in `website/`
- [ ] None of the four images shows the string "Basketball Clip Cutter"
- [ ] Each of the four images shows the current six-control header
- [ ] No file in `src/assets/screenshots/` exceeds 1.5MB
- [ ] `du -sh dist/` is no larger than before the change
- [ ] `git status` shows only the four images (and possibly `index.astro`)
- [ ] `plans/README.md` status row updated

## STOP conditions

Stop and report if:

- The operator has no publishable footage. This plan cannot proceed on
  placeholder video.
- The app will not build or run locally. Report the error rather than
  screenshotting an old installed build, which would reintroduce the exact
  problem this plan fixes.
- A new capture is impossible at 1440x900 because a panel does not fit. That
  is a real layout finding and belongs with
  `plans/028-workspace-vertical-budget.md`.

## Maintenance notes

- These images go stale every time the app's chrome changes. Worth a note in
  the app repo's release checklist: if the header, the panels or the timeline
  change shape, reshoot.
- A reviewer should zoom to 100% on the hero image and read the header. That is
  the check that would have caught the stale set.
