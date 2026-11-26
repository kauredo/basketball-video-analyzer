# Plan 048: Add Tag, Study and Scout layout presets to the header

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report, do not improvise. When done, update the status row for this plan
> in `plans/README.md`, unless a reviewer dispatched you and told you they
> maintain the index.
>
> **Drift check (run first)**:
> `git diff --stat afb5b80..HEAD -- src/renderer/App.tsx src/renderer/styles/App.module.css src/renderer/utils/storage.ts src/renderer/components/ClipLibrary.tsx src/i18n/locales`
> This plan is the fifth of five stacked PRs (044 to 048), so every one of
> those paths **will** show changes from plans 044 to 047. That is expected.
> What matters is that the excerpts under "Current state" still exist in the
> live code (the panel state at the top of `App`, the two resize handlers,
> `ensureSidePanelWidth`, the two header toggle buttons). If one of them is
> gone or reshaped beyond what 046 describes, treat it as a STOP condition.

## Status

- **Priority**: P2
- **Effort**: M
- **Risk**: LOW (renderer only, no schema, no IPC; new persisted pref with a safe default)
- **Depends on**: `plans/044-*.md`, `plans/045-*.md`, `plans/046-*.md`, `plans/047-*.md`
  (stacked; branch from 047's branch). Hard dependency on **046**: see Precondition.
- **Repo**: `app` (`kauredo/basketball-video-analyzer`)
- **Category**: direction
- **Planned at**: commit `afb5b80`, 2026-11-26
- **Design spec**: https://claude.ai/artifact/WQSZuvHz6cTgGYEVFcJCGg (workspace board, 1440x900, shows Scout active)

## Why this matters

A coach who scouts opponents asked for layout presets. Today the workspace has
four independent knobs: side panel width (drag), bottom panel height (drag) and
two show/hide toggles, plus, after plan 046, the bottom clip list width
(Narrow / Wide / Full). Switching from cutting clips to reviewing them to
watching an opponent means re-dragging two handles and flipping a control every
time. Three named presets in the header (Tag for cutting, Study for reviewing,
Scout for watching) set all of those in one click. A preset stays selected when
the coach then nudges a panel, shows a small "edited" mark, and a second click
on it puts its sizes back.

## Precondition (check before Step 1)

Plan 046 adds a bottom list width with three values, Narrow / Wide / Full.
046 creates `src/renderer/utils/clipList.ts` with
`export const LIST_WIDTHS = ["narrow", "wide", "full"] as const;` and
`export type ListWidth = (typeof LIST_WIDTHS)[number];`, and lifts the value
into `App` with a persisting setter. Default is `"narrow"`:

```ts
const [bottomListWidth, setBottomListWidth] = useState<ListWidth>(() => parseListWidth(loadPref(STORAGE_KEYS.BOTTOM_LIST_WIDTH, "narrow")));
const changeBottomListWidth = useCallback((width: ListWidth) => { /* sets state and savePref */ }, []);
// ...
<Timeline ... listWidth={bottomListWidth} onListWidthChange={changeBottomListWidth} />
```

Run `grep -n "ListWidth\|changeBottomListWidth\|BOTTOM_LIST_WIDTH" src/renderer/App.tsx src/renderer/utils/clipList.ts`.

- Expected: `clipList.ts` exports `ListWidth`; `App.tsx` declares
  `bottomListWidth` and `changeBottomListWidth` and passes
  `onListWidthChange={changeBottomListWidth}` to `<Timeline>`.
  `changeBottomListWidth` both sets the state and persists it; this plan calls
  it and never calls `setBottomListWidth` directly.
- **STOP** if the value lives only inside a child component (Timeline, a
  bottom-list component) with no way for `App` to set it. Report back; lifting
  it is 046's job, not this plan's.

## Current state (at `afb5b80`, before 044 to 047)

### Files in play

- `src/renderer/App.tsx` (1180 lines): owns panel state, the two resize
  handlers, the header, and the workspace layout.
- `src/renderer/styles/App.module.css` (802 lines): header, `.btn`, panel styles.
- `src/renderer/utils/storage.ts`: `STORAGE_KEYS`, `loadPref`, `savePref`
  (JSON in `localStorage`, wrapped in try/catch). This is the app's only UI
  pref mechanism; reuse it.
- `src/renderer/components/ClipLibrary.tsx`: asks `App` to widen the side
  panel when the coach switches to Table view. Not edited by this plan; read
  only.
- `src/i18n/locales/{en,pt,es,fr,de,it,sl,sr,lt,tr,el}.json`: eleven
  locales, key parity enforced by `npm run lint:locales`.

### Panel state, `App.tsx:89-92`

```ts
const [sidePanelWidth, setSidePanelWidth] = useState(() => loadPref(STORAGE_KEYS.SIDE_PANEL_WIDTH, 360));
const [isSidePanelCollapsed, setIsSidePanelCollapsed] = useState(() => loadPref(STORAGE_KEYS.SIDE_PANEL_COLLAPSED, true));
const [bottomPanelHeight, setBottomPanelHeight] = useState(() => loadPref(STORAGE_KEYS.BOTTOM_PANEL_HEIGHT, 300));
const [isBottomPanelCollapsed, setIsBottomPanelCollapsed] = useState(() => loadPref(STORAGE_KEYS.BOTTOM_PANEL_COLLAPSED, false));
```

All four are persisted. The two collapsed flags persist through effects at
`App.tsx:210-212` and `App.tsx:243-245`. The width and height persist only on
drag mouseup (below), not through an effect.

### Keyboard toggles, `App.tsx:214-241`

Cmd/Ctrl+1 toggles the side panel, Cmd/Ctrl+2 the bottom panel
(`setIsSidePanelCollapsed(v => !v)` / `setIsBottomPanelCollapsed(v => !v)`),
skipped while focus is in an input, textarea or contenteditable.

### Bottom resize, `App.tsx:280-316` (`startBottomResize`)

Clamps to 200..600 (`Math.min(Math.max(200, startHeight + deltaY), 600)`),
tracks `draggedHeight`, and in `handleMouseUp` calls
`savePref(STORAGE_KEYS.BOTTOM_PANEL_HEIGHT, draggedHeight)`.

### Side panel widen-on-Table, `App.tsx:318-330`

```ts
const ensureSidePanelWidth = useCallback((minimum: number) => {
  setSidePanelWidth(prev => {
    if (prev >= minimum) return prev;
    savePref(STORAGE_KEYS.SIDE_PANEL_WIDTH, minimum);
    return minimum;
  });
}, []);
```

Called by `ClipLibrary.changeViewMode` (`ClipLibrary.tsx:147-151`) with
`TABLE_MIN_PANEL_WIDTH = 822` (`ClipLibrary.tsx:97`) only at the moment the
coach switches to Table, never on mount. (The brief that commissioned this plan
said 790; the code says 822.)

### Side resize, `App.tsx:332-366` (`startSideResize`)

Clamps to **280..600** by drag (`Math.min(Math.max(280, startWidth + deltaX), 600)`),
and on mouseup saves `sideResizeRef.current.clientWidth`. The CSS allows up to
900px (`App.module.css:92-106`, `.sidePanel { min-width: 280px; max-width: 900px }`)
so that the Table view's 822px request fits. A drag can never exceed 600.

### Header, `App.tsx:699-758`

`<header className={styles.appHeader}>` with the title on the left and
`<div className={styles.headerActions}>` holding, in order: Select Project,
the side panel toggle, the bottom panel toggle, Stats (when a project is
open), Settings, and the `?` shortcuts icon button. The two toggles today:

```tsx
<button type="button" className={styles.btn} onClick={() => setIsSidePanelCollapsed(!isSidePanelCollapsed)}>
  <FontAwesomeIcon icon={faList} />{" "}
  {isSidePanelCollapsed ? t("app.buttons.showSidePanel") : t("app.buttons.hideSidePanel")}
</button>
<button type="button" className={styles.btn} onClick={() => setIsBottomPanelCollapsed(!isBottomPanelCollapsed)}>
  <FontAwesomeIcon icon={faLayerGroup} />{" "}
  {isBottomPanelCollapsed ? t("app.buttons.showBottomPanel") : t("app.buttons.hideBottomPanel")}
</button>
```

`.headerActions` (`App.module.css:467-472`) is `display:flex; gap: var(--spacing-md); flex-wrap: wrap`.
The window's minimum is 1280x700 (`src/main/main.ts:259-266`, with a comment:
"Below 1280 wide the header title wraps and its buttons spill out of the 60px
bar over the video"). The header is already near full at 1280, which is why
this plan shrinks the two toggles to icon buttons (Step 4).

### Layout, `App.tsx:761-871`

`<main className={styles.mainContent}>` > `.contentWithSidePanel` (flex row) >
`.videoContainer` (flex column: `.videoSection` then `.bottomPanel`) and
`.sidePanel`. Inline styles set `height: bottomPanelHeight` and
`width: sidePanelWidth` (or 0 when collapsed).

### Layout floors in CSS (these drive the clamp)

- `--header-height: 60px` (`variables.css:153`).
- `.videoSection { min-width: 300px; min-height: var(--video-section-min-height) }`
  where `--video-section-min-height: calc(var(--video-min-height) + var(--video-controls-max))`
  = 140 + 320 = **460px** (`variables.css:20-24`).
- `.bottomPanel { min-height: var(--bottom-panel-min-height) /* 140px */; max-height: 600px; flex-shrink: 1 }`.
  The panel yields before the film does when the window is short.

### Existing segmented control to model on, `ClipLibrary.module.css:904-946`

`.viewToggle` / `.viewToggleBtn`: a `role="group"` with `aria-label`, buttons
with `aria-pressed`, `border-left` between segments, focus ring
`outline: var(--focus-ring-width) solid var(--focus-ring-color); outline-offset: -2px`.
Its active state is a solid teal fill; this plan's control uses the **neutral
raised** active style instead (owner decision below), so do not copy
`.viewToggleActive`.

### Pure-module test pattern, `src/renderer/utils/projectPlayback.test.mts`

```ts
import assert from "node:assert/strict";
import { test } from "node:test";
import { activeRecordingKey, projectPlaybackKey } from "./projectPlayback.ts";
```

The module under test (`projectPlayback.ts`) imports nothing from React or
`localStorage`. Note the `.ts` extension in the test's import; the app's own
imports omit it (`import { loadPref } from "./utils/storage"`).

### Design constraints (owner decisions and tokens)

- Names are **Tag / Study / Scout**. (An earlier design ledger said
  "Tag / Review / Scout"; the owner renamed Review to Study. Use Study.)
- "One solid teal button per region; active segments of segmented controls use
  a neutral raised style": background `--bg-quaternary`, text
  `--text-primary`, a 1px `--border-color-hover` edge, a 2px
  `--color-accent-ink` bottom edge. (The design brief wrote these as
  `--border-hover` and `--accent-ink`; the real token names in
  `variables.css` are `--border-color-hover` (line 75) and
  `--color-accent-ink` (line 15). Use the real names.)
- A finish note from the design critique: "Active preset button must still
  read as active at a glance (outlined Scout is easy to miss)." The fill plus
  the 2px bottom edge is the answer; do not reduce it to an outline.
- Tokens only, never raw hex. Radii are 1px (`--radius-md`). No drop shadows
  (an inset box-shadow used as a border, as below, is how the board draws the
  raised edge without changing the segment's size).
- `:focus-visible` with the focus-ring tokens on every interactive element;
  `aria-label` on icon-only buttons.

### The board's header (copy layout, not markup)

From the design board at 1440x900, left to right: logo + title, then the
**Layout** group (`role` group, a 1px `--border-color-light` frame, a small
"Layout" caption in `--text-secondary` at `--font-size-xs`, then three
segments, each a 22x16 diagram + label), a flexible gap, Select Project, the
two panel toggles as a pair of 36px **icon buttons** framed together, Stats,
Settings, `?`. The board's three diagrams (stroke and fill `currentColor`,
stroke-width 1.5, the defining region filled at 0.45 opacity, at 0.55 in
`--color-accent-ink` when active):

```html
<!-- Tag: the side panel region filled -->
<svg width="22" height="16" viewBox="0 0 22 16" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true">
  <rect x="12" y=".75" width="9.25" height="14.5" fill="currentColor" fill-opacity=".45" stroke="none"/>
  <rect x=".75" y=".75" width="20.5" height="14.5"/><path d="M12 .75v14.5"/></svg>
<!-- Study: the bottom region filled, tall -->
<svg width="22" height="16" viewBox="0 0 22 16" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true">
  <rect x=".75" y="6.25" width="20.5" height="9" fill="currentColor" fill-opacity=".45" stroke="none"/>
  <rect x=".75" y=".75" width="20.5" height="14.5"/><path d="M.75 6.25h20.5"/></svg>
<!-- Scout: the video region filled, large; thin side and bottom strips -->
<svg width="22" height="16" viewBox="0 0 22 16" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true">
  <rect x=".75" y=".75" width="17" height="11.5" fill="currentColor" fill-opacity=".45" stroke="none"/>
  <rect x=".75" y=".75" width="20.5" height="14.5"/><path d="M17.75 .75v14.5M.75 12.25h17"/></svg>
```

The board's panel toggle icons (18x14, region filled at 0.35):

```html
<!-- side panel -->
<svg width="18" height="14" viewBox="0 0 18 14" fill="none" stroke="currentColor" stroke-width="1.3" aria-hidden="true">
  <rect x=".7" y=".7" width="16.6" height="12.6"/><path d="M12 .7v12.6"/><path d="M12 .7h5.3v12.6H12z" fill="currentColor" fill-opacity=".35"/></svg>
<!-- bottom panel -->
<svg width="18" height="14" viewBox="0 0 18 14" fill="none" stroke="currentColor" stroke-width="1.3" aria-hidden="true">
  <rect x=".7" y=".7" width="16.6" height="12.6"/><path d="M.7 9h16.6"/><path d="M.7 9h16.6v4.3H.7z" fill="currentColor" fill-opacity=".35"/></svg>
```

## The three presets, concretely

Geometry, in CSS px of the `<main>` element (the window's content area minus
the 60px header). Two reference sizes:

- **Board**: 1440x900 content, so main = 1440 x 840.
- **Small**: a 1280x800 window. With the default title bar the content is
  about 1280x772, so main is about 1280 x 712.

| Preset | Side panel width | Bottom panel height | Bottom list width | Both panels |
|---|---|---|---|---|
| **Tag** (cutting clips) | 520 | 240 | Narrow | shown |
| **Study** (reviewing clips) | 360 | 380 | Full | shown |
| **Scout** (watching an opponent) | 300 | 200 | Wide | shown |

Clamp, applied at click time against the live size of `<main>`:

- `bottom = clamp(preset.bottom, 200, max(200, mainHeight - 460))`, then capped at 600.
  460 is `--video-section-min-height`; 200 is the drag floor.
- `side = clamp(preset.side, 280, min(600, mainWidth - 640))`.
  280..600 is the drag range. 640 keeps the film column wide enough for a
  360px-tall 16:9 film plus 046's bottom list and timeline side by side.
  If `mainWidth - 640 < 280` the result is 280.

Resulting values:

| | Board (1440x840 main) | Small (1280x712 main) | Minimum window (1280x700, main about 612) |
|---|---|---|---|
| Tag | side 520, bottom 240, film column 920 | side 520, bottom 240, column 760 | side 520, bottom 200 |
| Study | side 360, bottom 380, column 1080 | side 360, bottom **252** (clamped), column 920 | side 360, bottom 200 |
| Scout | side 300, bottom 200, column 1140 | side 300, bottom 200, column 980 | side 300, bottom 200 |

Why these numbers:

- **Scout gets the biggest film.** The film is limited by the smaller of its
  column width x 9/16 and `mainHeight - bottom - transport`. The transport band
  is the same height in every preset, so the preset with the shortest bottom
  panel and the widest column wins on both counts. Scout has both: bottom 200
  (the drag floor) and side 300, so the column is 1140 on the board, 220px wider
  than Tag's and 60px wider than Study's. 300 rather than 280 leaves the card
  titles and 045's Filter button room. The list is Wide so the timeline stays
  beside it, as the board shows.
- **Tag** is cutting. The side panel is where the new clip lands and where 044's
  in-place title edit happens, so it is the widest of the three (520, which
  still leaves a 760px column at 1280). The bottom is short (240) but above the
  floor so three timeline tracks stay visible for finding the play to cut. The
  list is Narrow so the timeline gets most of the bottom row.
- **Study** is reviewing a clip list. The bottom panel is as tall as the board
  allows without squeezing the film below its floor (840 - 460 = 380), and the
  list is Full so titles and notes get the whole 1080px column. On a 1280x800
  window the clamp brings it to 252.
- At the 700px minimum height every preset's bottom clamps to 200, so the three
  differ only in side width and list width there. That is acceptable; the CSS
  already squeezes the bottom panel below 200 at that size regardless.
- Presets do not raise the side panel to the Table view's 822. A drag cannot
  reach 822 either (it stops at 600), so Table view in a preset behaves as it
  does after any manual drag today. Switching *to* Table while a preset is
  selected still widens the panel through `ensureSidePanelWidth`, and that
  counts as a manual change (the preset shows edited).

## Behaviour (state machine)

State: `{ selected: "tag" | "study" | "scout" | null, edited: boolean }`.
Default for every existing and new user: `{ selected: null, edited: false }`,
so nobody's layout changes on upgrade.

- **Apply preset P** (click a segment): set side width, bottom height, list
  width to P's clamped values, show both panels, persist all of them; state
  becomes `{ selected: P, edited: false }`. Clicking the already-selected,
  edited preset is the same action, so it restores its sizes and clears the
  mark. Clicking the selected, unedited preset re-applies (idempotent).
- **Manual change** (any of: side drag mouseup, bottom drag mouseup, side or
  bottom toggle by button or Cmd/Ctrl+1/2, the 046 list width control,
  `ensureSidePanelWidth` when it actually widens): if `selected` is set, state
  becomes `{ selected, edited: true }`; if `selected` is null, nothing changes.
- A window resize is not a manual change and does not re-clamp. The CSS flex
  rules already shrink panels when the window shrinks.
- The edited flag is an explicit flag, not derived by comparing current sizes
  to the preset, because the clamp target moves with the window size and a
  derived flag would flicker on resize.

## Commands you will need

| Purpose | Command | Expected on success |
|---|---|---|
| Install | `npm install` | exit 0 (the worktree may have no `node_modules` yet) |
| Unit tests | `npm test` | exit 0, all pass, including the new `layoutPresets` tests |
| Typecheck | `npx tsc --noEmit -p .` | exit 0 (one `tsconfig.json` covers `src/**`, renderer included; tests excluded) |
| Locale lint | `npm run lint:locales` | exit 0 |
| Renderer build | `npm run build:renderer` | exit 0 |
| Full build | `npm run build` | exit 0 (prebuild runs `lint:locales`, then `tsc`, then webpack) |
| Run the app | `npm run dev` | Electron window opens |

Shell rule: run each command as a plain program with arguments. No `bash -c`,
no `eval`. Copy with `/bin/cp -f`; `rm` is aliased to interactive here, use
`command rm`.

## Scope

**In scope** (the only files you may modify or create):

- `src/renderer/utils/layoutPresets.ts` (**create**): pure preset values, clamp, state reducer, pref parser
- `src/renderer/utils/layoutPresets.test.mts` (**create**)
- `src/renderer/utils/storage.ts`: one new key, `LAYOUT_PRESET: "layoutPreset"`
- `src/renderer/App.tsx`: preset state, apply handler, manual-change marking, header control, icon toggles
- `src/renderer/styles/App.module.css`: the preset group, segments, edited mark, icon toggle pair
- `src/i18n/locales/*.json` (all eleven): new `app.layout.*` keys
- `plans/README.md`: the coordinator already added this plan's row; change only its Status cell, last

**Out of scope** (do not touch):

- `src/renderer/components/ClipLibrary.tsx` and `TABLE_MIN_PANEL_WIDTH`. The
  Table view's widen request keeps working through `ensureSidePanelWidth`.
- The bottom list width control itself and its component (plan 046). This
  plan only calls 046's setter and marks edited from 046's change path.
- Drag clamps (280..600, 200..600) and the CSS floors. Presets live inside
  them.
- `ShortcutsModal.tsx`: Cmd/Ctrl+1/2 keep their meaning. No new shortcuts for
  presets (deferred, see Maintenance notes).
- Showing the project name in the header (the board shows "France v Serbia";
  that is a separate change).
- Website and README copy. Presets are a new feature, not a rename; a docs
  line can follow later.

## Git workflow

- Branch: `feat/layout-presets`, cut from plan 047's branch (stacked PR).
- Conventional commits, e.g. `feat(layout): add Tag, Study and Scout presets`.
  Recent style from `git log --oneline -5`: `feat(projects): add and switch game recordings (#85)`.
- Never mention AI tooling in commit messages; no AI co-author lines.
- Do not push or open a PR unless the operator asked for it.

## Steps

### Step 0: Install dependencies if missing

The worktree may have no `node_modules`. Run `ls node_modules/.bin/tsc`; if it
is missing, run `npm ci`.

**Verify**: `ls node_modules/.bin/tsc` → the path prints. `npm test` → exit 0
(the baseline, before any change).

### Step 1: Write the pure module and its tests

Create `src/renderer/utils/layoutPresets.ts`. No React, no `localStorage`, no
imports from `storage.ts`. Its only import is
`import type { ListWidth } from "./clipList";`. It must be `import type`, not
a plain `import`: `npm test` runs the `.mts` tests with Node's type stripping,
which deletes `import type` lines but keeps plain imports, and a plain import
of a name that exists only as a type fails at runtime because `clipList.ts`
exports no value called `ListWidth`. `tsconfig.json` also sets
`isolatedModules`, which wants type-only imports marked. The type-only import
also keeps this module from loading `clipList.ts` at runtime at all.

Exports, with exactly these names (the tests and Step 3 use them):

```ts
export type LayoutPresetId = "tag" | "study" | "scout";
export const LAYOUT_PRESET_IDS: readonly LayoutPresetId[] = ["tag", "study", "scout"];

export interface PresetLayout {
  sidePanelWidth: number;
  bottomPanelHeight: number;
  bottomListWidth: ListWidth;
}

export const LAYOUT_PRESETS: Record<LayoutPresetId, PresetLayout> = {
  tag:   { sidePanelWidth: 520, bottomPanelHeight: 240, bottomListWidth: "narrow" },
  study: { sidePanelWidth: 360, bottomPanelHeight: 380, bottomListWidth: "full" },
  scout: { sidePanelWidth: 300, bottomPanelHeight: 200, bottomListWidth: "wide" },
};

// Mirrors of CSS/handler limits; see the comment on each.
export const SIDE_MIN = 280, SIDE_MAX = 600;        // startSideResize clamp
export const BOTTOM_MIN = 200, BOTTOM_MAX = 600;    // startBottomResize clamp
export const VIDEO_SECTION_MIN_HEIGHT = 460;        // --video-section-min-height
export const MIN_FILM_COLUMN = 640;

export function presetLayoutFor(id: LayoutPresetId, main: { width: number; height: number }): PresetLayout;

export interface PresetState { selected: LayoutPresetId | null; edited: boolean }
export const INITIAL_PRESET_STATE: PresetState = { selected: null, edited: false };
export type PresetAction = { type: "apply"; id: LayoutPresetId } | { type: "manualChange" };
export function presetReducer(state: PresetState, action: PresetAction): PresetState;

export function parsePresetState(raw: unknown): PresetState; // junk -> INITIAL_PRESET_STATE
```

Rules for `presetLayoutFor`: use the two clamp formulas in "The three presets,
concretely". Non-finite or non-positive `main` sizes fall back to the preset's
unclamped values (clamped only to the drag ranges). `presetReducer` returns the
**same object** for a `manualChange` when `selected` is null or `edited` is
already true, so React skips a re-render. `parsePresetState` accepts only an
object whose `selected` is one of the three ids or null and whose `edited` is a
boolean; `edited: true` with `selected: null` normalises to `edited: false`.

Create `src/renderer/utils/layoutPresets.test.mts` modelled on
`projectPlayback.test.mts` (import with the `.ts` extension). Cases:

1. Each preset at the board size (1440x840) returns exactly its table values.
2. Study at 1280x712 returns bottom 252; Tag and Scout at 1280x712 are unchanged.
3. Every preset at 1280x612 returns bottom 200.
4. A narrow main (e.g. 900 wide) clamps Tag's side to 280 (900 - 640 = 260 < 280).
5. Scout's film column is the widest and its bottom the shortest of the three at both reference sizes (assert via `width - side` and `bottom`).
6. Invalid main size (`{width: 0, height: NaN}`) returns values inside the drag ranges.
7. Reducer: `apply` from initial selects with `edited: false`.
8. Reducer: `manualChange` after `apply` sets `edited: true` and keeps `selected`.
9. Reducer: `apply` of the same id after an edit clears `edited`.
10. Reducer: `apply` of a different id switches `selected` and clears `edited`.
11. Reducer: `manualChange` with nothing selected returns the same object (`assert.equal(next, prev)`).
12. `parsePresetState`: valid round-trip; `null`, `"scout"`, `{selected: "review"}`, `{selected: "tag", edited: "yes"}` all give the initial state; `{selected: null, edited: true}` gives `edited: false`.

**Verify**: `npm test` → exit 0, and the output lists the new tests as passing.
`npx tsc --noEmit -p .` → exit 0.

### Step 2: Add the storage key and the locale keys

In `storage.ts`, add `LAYOUT_PRESET: "layoutPreset",` to `STORAGE_KEYS`.

Add an `app.layout` object to all eleven locales (place it after
`app.buttons`; any position works for the linter, but keep it the same in
all eleven):

| Key | en | pt (European Portuguese, as the file uses) |
|---|---|---|
| `app.layout.label` | `Layout` | `Disposição` |
| `app.layout.tag` | `Tag` | `Marcar` |
| `app.layout.study` | `Study` | `Estudo` |
| `app.layout.scout` | `Scout` | `Scouting` |
| `app.layout.tagHint` | `Wide side panel for cutting clips` | `Painel lateral largo para cortar clips` |
| `app.layout.studyHint` | `Tall bottom panel for reviewing clips` | `Painel inferior alto para rever clips` |
| `app.layout.scoutHint` | `Biggest video for watching an opponent` | `Vídeo maior para observar um adversário` |
| `app.layout.edited` | `{{name}} (edited)` | `{{name}} (alterado)` |
| `app.layout.restoreHint` | `{{name}} (edited). Click to restore its sizes.` | `{{name}} (alterado). Clica para repor os tamanhos.` |

For es, fr, de, it, sl, sr, lt, tr, el, write machine translations and keep
`{{name}}` untouched. Keep the three preset names short (one word, about 8
characters at most) because they sit in the header; if a natural translation
is longer, use a shorter one. Mention in the PR description that the nine are
machine translations.

Two things the translations must respect:

- **Register.** Each locale already addresses the user one way. pt uses the
  informal European "tu" imperative ("Seleciona", "Clica"); match whatever the
  file's existing imperatives use (for example, look at how
  `app.buttons.getStarted` and the other "Click..." strings are phrased in
  that file) and do not switch between formal and informal.
- **Sentence terminators.** `scripts/lint-locales.mjs` counts `.`, `!`, `?`
  (and `;` in el, the Greek question mark) against en.json and fails when a
  translation loses one alongside a mid-string capital. `restoreHint` has two
  sentences in English; keep both full stops in every translation. It also
  rejects a dash joining clauses, so use none.

**Verify**: `npm run lint:locales` → exit 0.
`grep -c "\"restoreHint\"" src/i18n/locales/*.json` → `1` for each of the eleven files.

### Step 3: Wire preset state and manual-change marking in `App.tsx`

1. Add `useReducer` to the React import on `App.tsx:4`
   (`import React, { useState, useCallback, useRef, useEffect, useMemo, useReducer } from "react";`),
   and import `LAYOUT_PRESET_IDS`, `presetLayoutFor`, `presetReducer`,
   `parsePresetState` and the `LayoutPresetId` type from `./utils/layoutPresets`.
2. State, next to the panel state at `App.tsx:89-92`:
   ```ts
   const [presetState, dispatchPreset] = useReducer(presetReducer, undefined,
     () => parsePresetState(loadPref(STORAGE_KEYS.LAYOUT_PRESET, null)));
   useEffect(() => { savePref(STORAGE_KEYS.LAYOUT_PRESET, presetState); }, [presetState]);
   const markLayoutEdited = useCallback(() => dispatchPreset({ type: "manualChange" }), []);
   const mainRef = useRef<HTMLElement>(null);
   ```
   Put `ref={mainRef}` on `<main className={styles.mainContent}>`.
3. `applyPreset(id)`:
   ```ts
   const el = mainRef.current;
   const size = el ? { width: el.clientWidth, height: el.clientHeight }
                   : { width: window.innerWidth, height: window.innerHeight - 60 };
   const layout = presetLayoutFor(id, size);
   setSidePanelWidth(layout.sidePanelWidth);   savePref(STORAGE_KEYS.SIDE_PANEL_WIDTH, layout.sidePanelWidth);
   setBottomPanelHeight(layout.bottomPanelHeight); savePref(STORAGE_KEYS.BOTTOM_PANEL_HEIGHT, layout.bottomPanelHeight);
   changeBottomListWidth(layout.bottomListWidth); // 046's setter; it persists
   setIsSidePanelCollapsed(false);
   setIsBottomPanelCollapsed(false);
   dispatchPreset({ type: "apply", id });
   ```
   Measure `<main>` before un-collapsing: its size does not depend on the
   panels, so collapsed panels do not skew the clamp.
4. Call `markLayoutEdited()` at each manual-change point, **and nowhere that
   `applyPreset` also runs**:
   - `startBottomResize` → in `handleMouseUp`, only if `draggedHeight !== startHeight`
     (a click on the handle without moving is not an edit).
   - `startSideResize` → add `let draggedWidth = startWidth;` next to
     `startWidth`, set `draggedWidth = newWidth;` in `handleMouseMove` (the
     same way `startBottomResize` tracks `draggedHeight`), and in
     `handleMouseUp` call `markLayoutEdited()` only if
     `draggedWidth !== startWidth`. Do **not** compare the saved
     `sideResizeRef.current.clientWidth`: `clientWidth` excludes the panel's
     1px `border-left`, so it is always one less than the state value and
     every click on the handle would count as an edit. Leave the existing
     `savePref(... clientWidth ...)` line alone; changing what gets saved is
     out of scope.
   - The header side and bottom toggle `onClick`s.
   - The Cmd/Ctrl+1 and Cmd/Ctrl+2 branches of the keydown effect. That effect
     has `[]` deps; `markLayoutEdited` is stable (`useCallback` with `[]`), so
     add it to the deps array without changing behaviour.
   - 046's bottom list width control. Add, after `markLayoutEdited`:
     ```ts
     const onUserListWidthChange = useCallback((w: ListWidth) => {
       changeBottomListWidth(w);
       markLayoutEdited();
     }, [changeBottomListWidth, markLayoutEdited]);
     ```
     (`import type { ListWidth } from "./utils/clipList";`), and at `<Timeline>`
     change `onListWidthChange={changeBottomListWidth}` to
     `onListWidthChange={onUserListWidthChange}`. `applyPreset` keeps calling
     `changeBottomListWidth` directly, so a preset does not mark itself edited.
   - `ensureSidePanelWidth`: rewrite so the marking happens outside the state
     updater (updaters must stay pure):
     ```ts
     const ensureSidePanelWidth = useCallback((minimum: number) => {
       if (sidePanelWidth >= minimum) return;
       setSidePanelWidth(minimum);
       savePref(STORAGE_KEYS.SIDE_PANEL_WIDTH, minimum);
       markLayoutEdited();
     }, [sidePanelWidth, markLayoutEdited]);
     ```
     Keep the existing comment above it.

**Verify**: `npx tsc --noEmit -p .` → exit 0. `npm test` → exit 0.
`grep -c "markLayoutEdited()" src/renderer/App.tsx` → at least 7 (two drags,
two buttons, two shortcuts, ensure, plus 046's control).

### Step 4: Build the header control and shrink the panel toggles

In the header, insert the Layout group **after the title `<h1>`**, matching
the board (title, Layout, flexible gap, actions). `.appHeader` is
`justify-content: space-between`, which with three children would float the
Layout group to the middle; add `margin-left: auto` to `.headerActions` so the
gap opens before the actions and the Layout group sits next to the title.
Markup shape:

```tsx
<div className={styles.layoutPresets} role="group" aria-label={t("app.layout.label")}>
  <span className={styles.layoutPresetsCaption} aria-hidden="true">{t("app.layout.label")}</span>
  {LAYOUT_PRESET_IDS.map(id => {
    const active = presetState.selected === id;
    const edited = active && presetState.edited;
    const name = t(`app.layout.${id}`);
    return (
      <button key={id} type="button"
        className={`${styles.presetBtn} ${active ? styles.presetBtnActive : ""}`}
        aria-pressed={active}
        aria-label={edited ? t("app.layout.edited", { name }) : undefined}
        title={edited ? t("app.layout.restoreHint", { name }) : t(`app.layout.${id}Hint`)}
        onClick={() => applyPreset(id)}>
        <PresetDiagram id={id} />{name}
        {edited && <span className={styles.presetEditedMark} aria-hidden="true" />}
      </button>
    );
  })}
</div>
```

- `PresetDiagram({ id }: { id: LayoutPresetId })` is a small function
  component declared in `App.tsx`, above `App`, returning the three SVGs from
  "The board's header" with `stroke="currentColor"` and the filled rect at
  `fill="currentColor" fill-opacity=".45"`. When active, CSS turns the filled
  rect `--color-accent-ink` at 0.55 (give the rect a class, e.g.
  `styles.presetRegion`).
- Use `aria-pressed`, not `role="radio"`: radios need arrow-key roving focus,
  and a second click on a pressed button doing something (restore) fits a
  toggle button better. This matches the repo's `.viewToggle`.
- Unedited buttons get their accessible name from the visible label. The
  edited one gets "Scout (edited)" via `aria-label`.

Replace the two text toggles with an icon pair:

```tsx
<div className={styles.panelToggles}>
  <button type="button" className={`${styles.btn} ${styles.iconBtn}`}
    aria-pressed={!isSidePanelCollapsed}
    aria-label={isSidePanelCollapsed ? t("app.buttons.showSidePanel") : t("app.buttons.hideSidePanel")}
    title={/* same string */}
    onClick={() => { setIsSidePanelCollapsed(!isSidePanelCollapsed); markLayoutEdited(); }}>
    {/* side panel SVG from the board */}
  </button>
  {/* bottom panel twin */}
</div>
```

Keep the existing `app.buttons.show/hide*` keys as the labels. Remove the
`faList` and `faLayerGroup` imports **only** if nothing else in `App.tsx` uses
them (`grep -n "faList\b\|faLayerGroup" src/renderer/App.tsx`).

CSS in `App.module.css` (tokens only):

- `.layoutPresets`: `display:inline-flex; align-items:center; height: var(--button-height); border:1px solid var(--border-color-light); border-radius: var(--radius-md); margin-left: var(--spacing-md)`.
- `.layoutPresetsCaption`: `font-size: var(--font-size-xs); color: var(--text-secondary); padding: 0 var(--spacing-sm)`.
- `.headerActions`: add `margin-left: auto` (see above).
- `.presetBtn`: a standalone class, not composed with `.btn`. From `.btn` it keeps `display:inline-flex; align-items:center; font-size: var(--font-size-sm); font-weight: var(--font-weight-medium); cursor:pointer; white-space:nowrap; border-radius: var(--radius-md)`. It drops `.btn`'s `transform: translateY(-1px)` hover lift (a lifted segment breaks the shared frame) and `transition: all` (use `transition: background var(--transition-fast), color var(--transition-fast)`). Its own values: `height:100%`, `background: var(--bg-secondary)`, `color: var(--text-secondary)`, `border:0; border-left:1px solid var(--border-color-light)`, `position:relative`, `gap: var(--spacing-sm)`, `padding: 0 var(--spacing-sm)`.
- `.presetBtn:hover:not(.presetBtnActive)`: `background: var(--bg-tertiary); color: var(--text-primary)`.
- `.presetBtnActive`: `background: var(--bg-quaternary); color: var(--text-primary); box-shadow: inset 0 0 0 1px var(--border-color-hover), inset 0 -2px 0 var(--color-accent-ink)`.
- `.presetBtnActive .presetRegion`: `fill: var(--color-accent-ink); fill-opacity: .55`.
- `.presetEditedMark`: `position:absolute; top:4px; right:4px; width:6px; height:6px; border-radius: var(--radius-md); background: var(--color-accent-ink)`.
- `.panelToggles`: `display:inline-flex; border:1px solid var(--border-color-light)`; `.panelToggles .iconBtn + .iconBtn { border-left:1px solid var(--border-color-light) }`.
- `.iconBtn`: `width: var(--button-height); padding:0; justify-content:center`.
- `.iconBtn[aria-pressed="true"]`: `color: var(--color-accent-ink)` (the board shows a visible panel's toggle in accent ink).
- Focus: add `.presetBtn:focus-visible` (outline-offset `-2px`, as `.viewToggleBtn`) and make sure `.iconBtn` inherits `.btn:focus-visible`.
- Light theme: all the above are tokens that `variables.css` redefines for light, so no extra rules. Check it in the app (Test plan).
- The active-segment look duplicates 046's `.segmentOn` in `Timeline.module.css` (same background, text, edge tokens). This is deliberate: CSS Modules scope each file, the two controls differ in height (36 vs 30) and frame, and a shared module for two rules is more indirection than the copy. Keep the token values identical to 046's; if one changes, change both.

**PR description must say**, besides the machine-translation note:

- Hiding or showing a panel (button or Cmd/Ctrl+1/2) also marks the preset
  edited. The owner's wording was "resizes a panel by hand"; a toggle is a
  manual layout change too, and the preset no longer describes the screen.
- The side and bottom panel toggles became icon buttons because the Layout
  group needs the header width at 1280; their text is now the `aria-label`
  and tooltip.

**Verify**: `npx tsc --noEmit -p .` → exit 0. `npm run build:renderer` → exit 0.
`grep -n "#[0-9a-fA-F]\{3,6\}\b" src/renderer/styles/App.module.css` shows no
new lines from this step (compare against `git diff`).

### Step 5: Full build and manual run

**Verify**: `npm run build` → exit 0. `npm test` → exit 0. Then run the
manual checks in the Test plan with `npm run dev`.

## Test plan

**Automated** (`npm test`): the twelve cases in Step 1, in
`src/renderer/utils/layoutPresets.test.mts`.

**Manual, in `npm run dev`** (open a project with clips first):

1. First launch after the upgrade: no preset is pressed and the layout is
   exactly what it was before.
2. Click **Scout**: side panel 300px, bottom 200px, list Wide, both panels
   shown even if one was hidden. Scout reads as pressed at a glance (raised
   fill and teal bottom edge). Measure with DevTools: `.sidePanel` width 300.
3. Drag the side panel handle. Scout stays pressed and shows the dot; hover
   shows "Scout (edited). Click to restore its sizes."; the accessibility tree
   (DevTools > Accessibility) names the button "Scout (edited)".
4. Click **Scout** again: sizes return to 300/200/Wide, the dot disappears.
5. Press Cmd/Ctrl+1 to hide the side panel: dot appears. Click Scout: panel
   returns.
6. Click **Tag**, then **Study**: each applies its own values; the dot never
   carries over to the newly picked preset.
7. Change the bottom list width with 046's control while Study is selected:
   dot appears.
8. Switch the clip library to Table while Tag is selected: the panel widens
   to 822 and Tag shows the dot.
9. Quit and relaunch: the same preset is pressed with the same edited state,
   and the panel sizes match what was on screen at quit.
10. Resize the window to 1280x800 and click Study: bottom panel is about 252,
    not 380, and the film is not squeezed below its floor.
11. At 1280 wide, switch the language to **de** and then **el** (Settings):
    the header stays on one line inside 60px and no button overlaps the video.
12. Light theme: segments, active state and edited dot are all visible.
13. Keyboard: Tab reaches each preset and each icon toggle with a visible
    focus ring; Enter/Space activates; the icon toggles announce
    "Hide Side Panel"/"Show Side Panel" and their pressed state.

## Done criteria

- [ ] `npm test` exits 0 and `layoutPresets.test.mts` has at least 12 passing tests
- [ ] `npx tsc --noEmit -p .` exits 0
- [ ] `npm run lint:locales` exits 0
- [ ] `npm run build` exits 0
- [ ] `grep -c "\"restoreHint\"" src/i18n/locales/*.json` prints 1 for all eleven files
- [ ] `grep -n "LAYOUT_PRESET" src/renderer/utils/storage.ts` matches once
- [ ] `grep -n "app.buttons.showSidePanel" src/renderer/App.tsx` still matches (label kept, now as `aria-label`)
- [ ] `grep -rn "from \"react\"\|localStorage" src/renderer/utils/layoutPresets.ts` returns nothing
- [ ] `git status` shows changes only to the in-scope files
- [ ] Manual checks 1 to 13 pass
- [ ] The Status cell of the existing 048 row in `plans/README.md` is updated (do not add a row)
- [ ] `grep -n "import type { ListWidth }" src/renderer/utils/layoutPresets.ts` matches once
- [ ] `grep -n "onListWidthChange={onUserListWidthChange}" src/renderer/App.tsx` matches once

## STOP conditions

Stop and report back, do not improvise, if:

- The Precondition grep finds no `App`-level bottom list width state and setter from plan 046.
- 046 named its widths something other than three values, or added a fourth.
  The preset table needs a decision, not a guess.
- The header wraps or spills at 1280 wide in any locale even after the toggles
  became icon buttons. First try hiding `.layoutPresetsCaption` visually
  (keep the group's `aria-label`); if it still wraps, stop and report the
  locale and the measured header width.
- `ensureSidePanelWidth` or the resize handlers no longer look like the
  excerpts after 044 to 047 (for example, the side drag max moved off 600).
  The clamp constants mirror those numbers.
- Applying a preset leaves the film pane shorter than 460px at 1280x800 (the
  clamp mirrors `--video-section-min-height`; if 046 changed that variable or
  the bottom panel's contents, the constant is stale).
- A step's verification fails twice after a reasonable fix attempt.

## Maintenance notes

- `layoutPresets.ts` mirrors four numbers from elsewhere: the drag clamps in
  `startSideResize` (280..600) and `startBottomResize` (200..600), and
  `--video-section-min-height` (460) in `variables.css`. Changing any of them
  means changing the mirror. Each constant has a comment naming its source.
- New manual layout controls (a future panel, a new list width) must call
  `markLayoutEdited()` or presets will look clean after the coach has changed
  the layout. Reviewers: check that every setter of side width, bottom height,
  list width and the two collapsed flags is either inside `applyPreset` or
  paired with `markLayoutEdited()`.
- The table view's 822px width is deliberately not part of any preset. If
  coaches who live in Table view complain that Tag truncates the table, the
  fix is a Tag width of `max(520, 822)` when the view mode is Table, which
  needs the view mode lifted out of `ClipLibrary`.
- Deferred: keyboard shortcuts for presets (Cmd/Ctrl+3/4/5 are free today),
  user-defined presets, re-clamping on window resize.
- The neutral raised segment style now exists twice, here and in 046's
  `Timeline.module.css` `.segmentOn`. Kept as a copy on purpose (see Step 4);
  a third segmented control is the point to extract a shared module.

## Plan review

Review fixes applied 2026-11-26: type-only `ListWidth` import from 046's
`clipList.ts` with default `"narrow"` and `changeBottomListWidth`; side drag
edited-detection via a tracked `draggedWidth`; `.headerActions { margin-left: auto }`;
`onUserListWidthChange` at `<Timeline>`; tagHint reworded; locale register and
terminator rules; `useReducer` import; fixed export names and `.presetBtn`
property list; duplication note; PR notes on toggles; Step 0 `npm ci`;
README Status-only update.

No contests.
