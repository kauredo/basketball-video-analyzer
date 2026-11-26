# Plan 046: The bottom clip list can widen, and its rows show whole titles and notes

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report, do not improvise. When done, update the status row for this plan
> in `plans/README.md`, unless a reviewer dispatched you and told you they
> maintain the index.
>
> **Drift check (run first)**:
> `git diff --stat afb5b80..HEAD -- src/renderer/components/Timeline.tsx src/renderer/styles/Timeline.module.css src/renderer/App.tsx src/renderer/utils/storage.ts src/i18n/locales`
> This branch stacks on 044 and 045, so `App.tsx` and the locales are
> expected to show their changes (see "Builds on"). `Timeline.tsx` and
> `Timeline.module.css` should show **nothing**: neither earlier plan touches
> them. If either changed, compare the "Current state" excerpts against the
> live code; on a mismatch, treat it as a STOP condition.

## Status

- **Priority**: P1
- **Effort**: M
- **Risk**: LOW (renderer only, one new localStorage key, no schema or IPC)
- **Depends on**: 044, 045 (stacked PRs; this one branches from 045)
- **Repo**: `app` (`kauredo/basketball-video-analyzer`)
- **Category**: direction
- **Planned at**: commit `afb5b80`, 2026-11-26
- **Design spec**: workspace board, https://claude.ai/artifact/WQSZuvHz6cTgGYEVFcJCGg

## Why this matters

A coach scouting opponents asked for a bottom clip list he can expand. Today the
list beside the timeline is a fixed 350px column holding a table whose own
column widths add up to about 690px (category 140, title 200, time 120,
duration 80, notes 150). Everything past the first column is clipped: titles
end in an ellipsis and notes are cut to 30 characters in code, so the one place
that lists a game's clips in order beside the film cannot be read.

The list also draws a clip once per category it carries. A clip tagged
Turnover and Transition shows as two rows, both highlight when it is selected,
and a count of rows is not a count of clips. The header has five columns, rows
with a category render six cells (a stray play button), and rows without one
render five, so the columns do not line up.

After this lands: a List width control (Narrow / Wide / Full) sits in the list
header, the choice survives a relaunch, each clip is one row with all its
category chips, and titles and notes wrap in full. Plan 048 (layout presets)
can set the width from `App`.

## Builds on

Five stacked PRs ship the coach's requests, each branched from the previous:

| Plan | What it does | Files it touches that you will see in this branch |
|---|---|---|
| 044 | Card inline edit; `ClipLibrary.handleUpdateClip` now calls `onClipsChanged()` | `ClipLibrary.tsx`, `ClipLibrary.module.css`, locales |
| 045 | Sidebar Filter button, popover, chips; creates `src/renderer/utils/clipFilters.ts` (with `parseIds`) and its test; moves `formatDuration` from `StatsDashboard.tsx` into `src/renderer/utils/format.ts` and adds `format.test.mts` | `ClipLibrary.tsx`, `ClipLibrary.module.css`, `StatsDashboard.tsx`, `utils/clipFilters.ts`, `utils/format.ts`, possibly `App.tsx`, locales |
| **046** | **this plan** | `Timeline.tsx`, `Timeline.module.css`, `App.tsx`, `storage.ts`, new `utils/clipList.ts` + test, `utils/clipFilters.ts` + test (one rule), `utils/format.test.mts` (cases only), locales |
| 047 | Court map dot click plays the clip in Stats | `StatsDashboard.tsx` and friends |
| 048 | Layout presets Tag / Study / Scout | `App.tsx`, reads the state this plan adds |

Because 044 makes edits reach `App`'s `clips`, a title edited in the side panel
shows up in this list without extra work. The List width control gets its own
styles in `Timeline.module.css` (step 4), whatever 045 did in
`ClipLibrary.module.css`; CSS Modules do not share classes across files and
this plan does not add a shared component.

From 045 this plan reuses two helpers instead of writing new ones:

- `formatDuration(seconds)` in **`src/renderer/utils/format.ts`**: `m:ss`
  under an hour, `h:mm:ss` from 3600, which is exactly the clock the board
  draws. 045 moved it there from `StatsDashboard.tsx:49-59` and tests it in
  `format.test.mts`. `Timeline.tsx` imports it from `../utils/format` for the
  list's Time and Dur. cells.
- `parseIds(json)` in **`src/renderer/utils/clipFilters.ts`**: tolerant JSON
  id-array parse, `[]` on bad JSON or a non-array. It mirrors
  `StatsDashboard.tsx:31-38` (`parseCategoryIds`). Step 1 tightens it to drop
  non-number elements. `Timeline.tsx` imports it from `../utils/clipFilters`.

**Tested utils cannot import other utils.** `npm test` runs `.mts` files with
Node's type stripping, which needs the `.ts` extension on a relative import,
and `tsc` rejects that extension. So `clipList.ts` imports nothing: no
formatting, no parsing. It deals in seconds and ids, and the component calls
`formatDuration` and `parseIds` itself.

Check both landed where expected:
`grep -n "export const formatDuration\|export function formatDuration" src/renderer/utils/format.ts`
and `grep -n "parseIds" src/renderer/utils/clipFilters.ts`. Each should
match. If either is missing, STOP.

## Current state

### Files in play

- `src/renderer/components/Timeline.tsx` (611 lines): the bottom panel. Left
  half is the clip list (`.clipsPanel`), right half the visual timeline tracks
  (`.timelinePanel`). Owns its own search box and category dropdown.
- `src/renderer/styles/Timeline.module.css` (784 lines).
- `src/renderer/App.tsx`: owns every panel preference and renders `Timeline`.
- `src/renderer/utils/storage.ts`: `STORAGE_KEYS`, `loadPref`, `savePref`
  (localStorage, both swallow their own errors).
- `src/renderer/utils/constants.ts`: `CLIP_STATUSES`, `statusLabelKey`.

### The panel width, `Timeline.module.css:65-75` and `609-636`

```css
.clipsPanel {
  width: 350px;
  min-width: 300px;
  max-width: 500px;
  ...
}
@media (max-width: 1200px) { .clipsPanel { width: 300px; min-width: 250px; } }
@media (max-width: 900px)  { .clipsPanel { width: 250px; min-width: 200px; } }
```

### Cells that truncate, `Timeline.module.css:238-282`

```css
.titleCell { width: 200px; max-width: 200px; }
.clipTitle { ... overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.timeCell { width: 120px; }
.durationCell { width: 80px; }
.notesCell { max-width: 150px; }
.notes { ... overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
```

`.categoryName` (line 216) also has `white-space: nowrap` and an ellipsis.

### Notes cut in code, `Timeline.tsx:365-373` (and again at 445-453)

```tsx
{clip.notes
  ? clip.notes.length > 30
    ? `${clip.notes.substring(0, 30)}...`
    : clip.notes
  : "-"}
```

### Header vs rows, `Timeline.tsx:303-465`

The header (lines 305-311) has five `<th>`: Category, Title, Time, Duration,
Notes. The body is `filteredClips.flatMap(...)`:

- A clip with no categories (lines 325-375) renders **one** row of **five**
  cells.
- A clip with categories (lines 387-465) renders **one row per category**,
  sorted parent-before-child by `categoryOrder` (lines 159-169), each with
  **six** cells: the five plus `.actionsCell` holding a play button
  (lines 454-462).

Time renders as a range, `formatTime(start) - formatTime(end)`, with
`formatTime` (lines 172-176) producing `m:ss`. A clip at 1h08m41s shows as
`68:41`.

### Row click, `Timeline.tsx:332-336` and `191-215`

```tsx
onClick={() =>
  handleClipClick(clip, { stopPropagation: () => {} } as React.MouseEvent)
}
```

`handleClipClick` calls `setSelectedClip(clip)` and `onClipSelect(clip)`, then
reads `event.currentTarget.getBoundingClientRect()` to seek to the clicked
point inside a timeline segment. The fake event has no `currentTarget`, so a
row click throws a `TypeError` after `onClipSelect` has already run. The seek
still happens because `App.handleClipSelect` (`App.tsx:442-449`) seeks to
`clip.start_time` (or switches recording first). The play button passes its
real event, so it seeks to the point in the clip matching where inside the
32px button you clicked. Neither path is what a list row should do.

### Status

The bottom list has no Status column today. Clips do carry one:
`status?: ClipStatus | null` in `src/types/global.d.ts:69`, with
`ClipStatus = "keep" | "cut" | "review"` (line 50). The labels exist as
`app.clips.table.statusKeep` / `statusCut` / `statusReview`, reached through
`statusLabelKey(status)` in `src/renderer/utils/constants.ts`. The header label
`app.clips.table.columnStatus` ("Status") exists too.

### Panel preferences, `App.tsx:89-92`

```ts
const [sidePanelWidth, setSidePanelWidth] = useState(() => loadPref(STORAGE_KEYS.SIDE_PANEL_WIDTH, 360));
const [isSidePanelCollapsed, setIsSidePanelCollapsed] = useState(() => loadPref(STORAGE_KEYS.SIDE_PANEL_COLLAPSED, true));
const [bottomPanelHeight, setBottomPanelHeight] = useState(() => loadPref(STORAGE_KEYS.BOTTOM_PANEL_HEIGHT, 300));
const [isBottomPanelCollapsed, setIsBottomPanelCollapsed] = useState(() => loadPref(STORAGE_KEYS.BOTTOM_PANEL_COLLAPSED, false));
```

`Timeline` is rendered at `App.tsx:827-834` with `clips={gameClips}`, which
`App.tsx:472` filters to the current recording.

### Tokens you will need (`src/renderer/styles/variables.css`)

`--bg-tertiary`, `--bg-quaternary`, `--text-primary/secondary/tertiary`,
`--border-color`, `--border-color-light`, **`--border-color-hover`** and
**`--color-accent-ink`** (the owner decision calls these `--border-hover` and
`--accent-ink`; those names do not exist, use these), `--font-mono`,
`--spacing-*`, `--radius-sm`, `--focus-ring-width`, `--focus-ring-color`.
Never a raw hex in CSS.

## Design spec (copied from the board)

The board draws the bottom panel as: list on the left, a vertical resize grip,
timeline on the right.

- **List header**, one 44px row: (left) the filter controls, then a spacer,
  then the caption "List width" in `--font-size-xs` `--text-tertiary`, then a
  three-segment group labelled "List width": Narrow, Wide, Full. Segments are
  30px tall, each `aria-pressed`. In this app the filter controls are the
  existing search box and category dropdown, so the row is: search, category
  select, spacer, List width. It wraps to two lines only when it runs out of
  room (Narrow), never by design.
- **Segmented style (owner decision)**: inactive segment on `--bg-primary`,
  `--text-secondary`. Active segment is neutral and raised, **not teal**:
  background `--bg-quaternary`, text `--text-primary`, a 1px
  `--border-color-hover` inset edge and a 2px `--color-accent-ink` bottom edge.
  The board draws the edges as `box-shadow: inset 0 0 0 1px ..., inset 0 -2px 0 ...`,
  which is an edge, not an elevation shadow, so it is allowed. One solid teal
  button per region, and this region has none.
- **Columns**: `# / Time / Category / Title / Notes / Dur. / Status`. `#` and
  Time and Dur. in IBM Plex Mono, Dur. right-aligned. Column header row on
  `--bg-tertiary`, `--font-size-xs`, `--text-secondary`.
- **Rows**: text top-aligned, wraps, row hairline `--border-color`, selected
  row a faint accent wash (the board uses the teal at ~8%:
  `color-mix(in srgb, var(--color-primary) 8%, transparent)`).
- **Category column hides** when the list shows exactly one category; **Status
  column hides** when no shown clip has a status. (Settled, round 1.)
- **Time** is the clip's start only, `h:mm:ss` past an hour (`1:08:41`), `m:ss`
  under it. Dur. is `m:ss` (`0:09`).
- **Wide** is drawn at 660px. **Full** gives the list the whole bottom panel.

Out of this plan, though on the board: the "now" line drawn between rows at the
playhead time, the Totals footer ("4 of 16 clips · 0:47"), the draggable grip
between list and timeline, and the "Show all 16" link that appears when the
list follows the side-panel filter. See "Maintenance notes".

## Decisions this plan makes

1. **Width state lives in `App`, passed to `Timeline` as a prop.** `App`
   already owns side width, bottom height and both collapsed flags with the
   same `loadPref`/`savePref` idiom, and plan 048's presets set all of those
   together. If `Timeline` owned the width, 048 would need a ref or an effect
   to reach in. `Timeline` gets `listWidth` and `onListWidthChange`; the
   setter in `App` persists. 048 will also need to know when the user changes
   the width by hand (its "edited" mark), and routing every change through
   `App` gives it that hook.
2. **Widths**: Narrow keeps today's 350px and its two media-query steps.
   Wide is `min(660px, 60%)` of the bottom panel so the timeline keeps at
   least 40% on a small window (bottom panel width is the window minus the
   side panel). Full is the whole panel and the timeline panel is **not
   rendered** until the width changes back. Default is **Narrow**, so nobody's
   layout changes on update.
3. **One row per clip, all its category chips in one cell.** Today's
   expansion makes a two-category clip two rows, double-highlights on select,
   breaks any count, and would give the `#` column duplicate numbers. The
   timeline **tracks** keep their per-category expansion
   (`expandClipsForCategories`, lines 72-110), because a track per category is
   the point of the tracks.
4. **The play button column goes.** Row click already selects and seeks, the
   button was the sixth cell that broke the column count, and its seek target
   depended on where in the button you clicked. Rows become keyboard-operable
   instead (step 5).
5. **Status column is added**, read-only text, matching the board. Editing
   status stays in the side panel's table view (plan 039).
6. **Narrow drops the Notes column** and draws the note as a second muted line
   under the title. Six-plus columns of wrapping text in 350px gives each
   column too little width to be readable; Wide and Full show Notes as its
   own column.
7. **`#` is the clip's position in the recording by start time**, 1-based,
   computed over all of `clips` before search or filter, so a clip keeps its
   number when the list narrows (the board shows 13-16 under a filter).
   Rows are ordered by start time.
8. **Category hides whenever the dropdown has a filter**, on purpose, because
   the task says "exactly one category is filtered" and the dropdown holds
   exactly one. A shown clip can carry other categories too; those chips are
   hidden while the filter is on, the same trade the board makes. The timeline
   tracks still show every category.
9. **Timeline tracks, ruler and the panel header keep `formatTime`.** Only the
   list switches to `formatDuration`. The marker tooltip on a track segment
   (`Timeline.tsx:565-567`) stays `"<title> (m:ss - m:ss)"` as today, so a
   clip past the hour still reads `68:41` there. Unifying those is a separate
   cleanup (see "Maintenance notes").

## Commands you will need

| Purpose | Command | Expected on success |
|---|---|---|
| Install (step 0) | `npm ci` | exit 0 |
| Typecheck | `npx tsc --noEmit -p .` | exit 0, no output |
| Unit tests | `npm test` | all tests pass, `# fail 0` |
| One test file | `node --experimental-strip-types --test src/renderer/utils/clipList.test.mts` | `# fail 0` |
| Locale lint | `npm run lint:locales` | exit 0 |
| Renderer build | `npm run build:renderer` | exit 0 |
| Full build | `npm run build` | exit 0 |
| Run the app | `npm start` | Electron window opens |

Shell rule: plain commands only, no `bash -c` or `eval`. Copy with
`/bin/cp -f`. `rm` is aliased to interactive on the owner's machine, use
`command rm`.

## Scope

**In scope** (the only files you may modify or create):

- `src/renderer/utils/clipList.ts` (**create**)
- `src/renderer/utils/clipList.test.mts` (**create**)
- `src/renderer/utils/clipFilters.ts` and `clipFilters.test.mts` (045's files:
  the one `parseIds` rule in step 1, nothing else)
- `src/renderer/utils/format.test.mts` (045's file: two extra
  `formatDuration` cases if missing; `format.ts` itself is not edited)
- `src/renderer/utils/storage.ts` (one key)
- `src/renderer/App.tsx` (state, setter, two props)
- `src/renderer/components/Timeline.tsx`
- `src/renderer/styles/Timeline.module.css`
- `src/i18n/locales/*.json` (all eleven)
- `plans/README.md` (status row, last step)

**Out of scope**:

- The timeline tracks, ruler, zoom and footer (`Timeline.tsx:473-607`) beyond
  not rendering them in Full. Do not refactor `expandClipsForCategories` or
  `organizeCategories`, and do not change their time formatting (decision 9).
- `ClipLibrary.tsx`, `ClipTable.tsx` and their styles (044/045 own them).
- Making the list follow the side-panel filter, the Totals footer, the
  playhead "now" line, a drag grip between list and timeline. Each is listed
  in "Maintenance notes".
- Editing status, title or notes from the bottom list.
- Layout presets (048).

## Git workflow

- Branch: `feat/bottom-list-width`, cut from the 045 branch (stacked PR). Use
  `gh stack` if the operator is stacking with it.
- Conventional commits, `feat(timeline): ...`. Never mention AI tooling in a
  commit, never add an AI co-author line.
- Do not push or open a PR unless the operator asked.

## Steps

### Step 0: Install

The worktree may have no `node_modules`. If `ls node_modules/.bin/tsc` fails,
run `npm ci`.

**Verify**: `ls node_modules/.bin/tsc` → the path prints.

### Step 1: Pure helpers with tests

Create `src/renderer/utils/clipList.ts`. **Import nothing from
`../../types/global` or any other module**: `npm test` runs files with Node's
type stripping and a runtime import of a `.d.ts` fails. Declare the small
structural types you need inline.

```ts
export const LIST_WIDTHS = ["narrow", "wide", "full"] as const;
export type ListWidth = (typeof LIST_WIDTHS)[number];

/** A stored value from an older build or a hand edit falls back to narrow. */
export const parseListWidth = (saved: unknown): ListWidth =>
  (LIST_WIDTHS as readonly unknown[]).includes(saved) ? (saved as ListWidth) : "narrow";

export type ListColumn = "number" | "time" | "category" | "title" | "notes" | "duration" | "status";

/** The one column list the header and every row render from. */
export const listColumns = (opts: {
  width: ListWidth;
  singleCategory: boolean;
  anyStatus: boolean;
}): ListColumn[] => {
  const cols: ListColumn[] = ["number", "time"];
  if (!opts.singleCategory) cols.push("category");
  cols.push("title");
  if (opts.width !== "narrow") cols.push("notes");
  cols.push("duration");
  if (opts.anyStatus) cols.push("status");
  return cols;
};

/** 1-based position of each clip by start time, ties broken by id. */
export const clipNumbers = (clips: { id: number; start_time: number }[]): Map<number, number> => { ... };
```

`ListWidth` is the exported type name, `"narrow"` the default, and plan 048
imports it with `import type { ListWidth } from "../utils/clipList"`. Keep
the name.

No clock formatter and no category parser here, and no import of either: a
tested util cannot import another util (see "Builds on"). The component uses
045's `formatDuration` from `src/renderer/utils/format.ts` and `parseIds` from
`src/renderer/utils/clipFilters.ts`. In `clipFilters.ts`, make `parseIds` drop
elements that are not finite numbers
(`ids.filter((id): id is number => typeof id === "number" && Number.isFinite(id))`),
so `"[3,\"x\",null,1]"` reads as `[3, 1]` and a stray string can never match
a category id. If `formatDuration` gets a case the list needs wrong, STOP
rather than writing a second formatter.

Create `src/renderer/utils/clipList.test.mts` following
`src/renderer/utils/projectPlayback.test.mts` (imports `node:assert/strict`,
`node:test`, and `./clipList.ts` with the extension). Cover:

- `parseListWidth`: each of the three values round-trips; `null`, `"Wide"`,
  `3`, `undefined` give `"narrow"`.
- `listColumns`: wide, no filter, some status gives all seven in board order;
  `singleCategory` drops only `category`; `anyStatus: false` drops only
  `status`; narrow drops only `notes`; full equals wide.
- `clipNumbers`: input out of order gets numbers by start time; equal start
  times order by id.

In `clipFilters.test.mts`, add: `parseIds("[3,\"x\",null,1]")` → `[3, 1]`;
`parseIds("")`, `parseIds(null)`, `parseIds("oops")`, `parseIds("{}")` → `[]`
(skip any 045 already covers). In `format.test.mts`, add
`formatDuration(4121) === "1:08:41"` and `formatDuration(9) === "0:09"` if
045's tests lack them.

**Verify**: `node --experimental-strip-types --test src/renderer/utils/clipList.test.mts src/renderer/utils/clipFilters.test.mts src/renderer/utils/format.test.mts` → `# fail 0`.

**Verify**: `npm test` → `# fail 0` (the glob already includes
`src/renderer/utils/*.test.mts`).

**Verify**: `npx tsc --noEmit -p .` → exit 0.

### Step 2: Locale keys

Add under `app.timeline` in `src/i18n/locales/en.json`:

```json
"listWidth": "List width",
"widthNarrow": "Narrow",
"widthWide": "Wide",
"widthFull": "Full",
"clipNumber": "Clip number"
```

`pt.json` by hand: `"Largura da lista"`, `"Estreita"`, `"Larga"`,
`"Completa"`, `"Número do clip"`. Translate the other nine (`es fr de it sl sr
lt tr el`) in the same position; these are machine translations, say so in the
PR description. No exclamation marks, no dashes joining clauses, no full stops
(English has none, and the linter compares terminator counts).

Remove `app.timeline.playClip` from all eleven files: step 5 deletes its only
caller (`Timeline.tsx:458`). Confirm first with
`grep -rn "timeline.playClip" src/renderer` → only that line.

Reuse, do not duplicate: `app.timeline.category`, `clipTitle`, `time`,
`durationHeader`, `notes`, and `app.clips.table.columnStatus`.

**Verify**: `npm run lint:locales` → exit 0.

**Verify**:
`node -e "for (const l of ['de','el','en','es','fr','it','lt','pt','sl','sr','tr']) { const t = require('./src/i18n/locales/'+l+'.json').app.timeline; console.log(l, ['listWidth','widthNarrow','widthWide','widthFull','clipNumber'].every(k => typeof t[k] === 'string'), 'playClip' in t); }"`
→ eleven lines, each `<locale> true false`.

### Step 3: State in App, prop into Timeline

1. `storage.ts`: add `BOTTOM_LIST_WIDTH: "bottomListWidth",` after
   `BOTTOM_PANEL_COLLAPSED`.
2. `App.tsx`, beside the panel prefs at lines 89-92:

   ```ts
   const [bottomListWidth, setBottomListWidth] = useState<ListWidth>(() =>
     parseListWidth(loadPref<unknown>(STORAGE_KEYS.BOTTOM_LIST_WIDTH, "narrow")));

   const changeBottomListWidth = useCallback((width: ListWidth) => {
     setBottomListWidth(width);
     savePref(STORAGE_KEYS.BOTTOM_LIST_WIDTH, width);
   }, []);
   ```

   Import `ListWidth` and `parseListWidth` from `./utils/clipList`. Leave a
   one-line comment that plan 048's presets call `changeBottomListWidth`.
3. Pass `listWidth={bottomListWidth}` and
   `onListWidthChange={changeBottomListWidth}` to `<Timeline>` (line 827).
4. In `Timeline.tsx`, add both to `TimelineProps` and the destructuring.

**Verify**: `npx tsc --noEmit -p .` → exit 0.

### Step 4: The List width control and the three widths

The list header (`Timeline.tsx:242-292`) becomes one row, per the board:
search box, category select, a spacer, then the caption and the group. Today
`.controls` (`Timeline.module.css` `.controls`) is `flex-direction: column`;
change it to `flex-direction: row; flex-wrap: wrap; align-items: center;` and
give `.searchBox` `flex: 1 1 160px` and `.categoryFilter`
`flex: 0 1 auto; width: auto; max-width: 200px` so the row only wraps when it
runs out of room (Narrow). Put the width control inside `.controls` as its
last child, with `margin-left: auto` on `.listWidthRow` acting as the spacer:

```tsx
<div className={styles.listWidthRow}>
  <span className={styles.listWidthLabel} id="timeline-list-width">{t("app.timeline.listWidth")}</span>
  <div role="group" aria-labelledby="timeline-list-width" className={styles.segmented}>
    {LIST_WIDTHS.map(w => (
      <button key={w} type="button" aria-pressed={listWidth === w}
        className={`${styles.segment} ${listWidth === w ? styles.segmentOn : ""}`}
        onClick={() => onListWidthChange(w)}>
        {t(`app.timeline.width${w[0].toUpperCase()}${w.slice(1)}`)}
      </button>
    ))}
  </div>
</div>
```

Give `.clipsPanel` a modifier class per width
(`styles.listNarrow` / `listWide` / `listFull`), and render the
`.timelinePanel` block (lines 474-607) only when `listWidth !== "full"`.

CSS in `Timeline.module.css`. These are the control's own styles; do not
import or reuse a class from another module:

- `.listWidthRow { display: flex; align-items: center; gap: var(--spacing-sm); margin-left: auto; }`
  and `.listWidthLabel { font-size: var(--font-size-xs); color: var(--text-tertiary); }`.
- `.clipsPanel`: drop `width`, `min-width`, `max-width` from the base rule.
- `.listNarrow { width: 350px; min-width: 300px; }`, and move the two media
  queries at lines 609-636 to target `.listNarrow` instead of `.clipsPanel`.
- `.listWide { flex: 0 0 min(660px, 60%); }`
- `.listFull { flex: 1; border-right: none; }`
- `.segmented`: inline-flex, 1px `--border-color-light` border,
  `--radius-sm`.
- `.segment`: height 30px, no border, `--bg-primary`, `--text-secondary`,
  `--font-size-xs`, padding `0 var(--spacing-sm)`, `cursor: pointer`.
  `.segment:focus-visible { outline: var(--focus-ring-width) solid var(--focus-ring-color); outline-offset: -2px; }`
  (the same shape as `ClipLibrary.module.css:943`).
- `.segmentOn`: `background: var(--bg-quaternary); color: var(--text-primary);
  box-shadow: inset 0 0 0 1px var(--border-color-hover), inset 0 -2px 0 var(--color-accent-ink);`

**Verify**: `npx tsc --noEmit -p .` → exit 0.

**Verify**: `npm start`, open a project with clips. Click Wide: the list grows
and the timeline shrinks but stays. Click Full: the timeline disappears and the
list spans the panel. Click Narrow: today's layout returns. Quit, relaunch: the
last choice is restored. In DevTools run
`localStorage.setItem("bottomListWidth", "\"huge\"")`, reload: Narrow.

### Step 5: One column definition, one row per clip

Replace the body of the list (`Timeline.tsx:303-468`):

1. Above the return, compute:

   ```ts
   const numbers = useMemo(() => clipNumbers(clips), [clips]);
   const shownClips = [...filteredClips].sort(
     (a, b) => a.start_time - b.start_time || a.id - b.id);
   const columns = listColumns({
     width: listWidth,
     singleCategory: filterCategory !== null,
     anyStatus: shownClips.some(c => c.status),
   });
   ```

   Use `parseIds` (from `../utils/clipFilters`) in place of the three inline
   `JSON.parse` try/catch blocks in this file (lines 60-65, 78-82, 317-322) so
   the parsing lives in one tested place. `allCategories` is built three times (lines 120-126,
   225-231, 379-385); build it once with `useMemo` over `categories` and use
   it in all three places.

2. Header: `<tr>{columns.map(col => <th key={col} scope="col" className={styles[`col_${col}`]}>{headerLabel(col)}</th>)}</tr>`.
   For `number` render `<abbr title={t("app.timeline.clipNumber")}>#</abbr>`;
   for `status` use `t("app.clips.table.columnStatus")`.

3. Rows: `shownClips.map(clip => <tr ...>{columns.map(col => <td key={col} className={styles[`col_${col}`]}>{cell(col, clip)}</td>)}</tr>)`,
   key `clip.id`. `cell` is a `switch` over `ListColumn`:
   - `number`: `numbers.get(clip.id)`, mono, `--text-tertiary`.
   - `time`: `formatDuration(clip.start_time)`, mono.
   - `category`: every category of the clip as a solid chip in
     `categoryOrder` (parent before child), background the category colour,
     text `inkOn(color)` from `../utils/contrast`, chips wrapping with a small
     gap. A subcategory chip keeps today's cue (`Timeline.tsx:418-425`): its
     label is a `<span>` at `--font-size-xs`, italic, prefixed `└ `. No
     categories: one chip in `DEFAULT_CATEGORY_COLOR` reading
     `t("app.categories.noCategory")`; an id with no match reads
     `t("app.categories.unknownCategory")`.
   - `title`: the full title. In Narrow, when the clip has a note, a second
     line `<span className={styles.rowNote}>{clip.notes}</span>` under it.
   - `notes`: the full note, or an empty cell (drop the `"-"`).
   - `duration`: `formatDuration(clip.end_time - clip.start_time)`, mono,
     right-aligned.
   - `status`: `clip.status ? t(statusLabelKey(clip.status)) : ""`.

4. Row behaviour. Add one handler and use it for click and keyboard:

   ```ts
   const selectFromList = (clip: Clip) => {
     setSelectedClip(clip);
     onClipSelect(clip); // App seeks to start_time, switching recording if needed
   };
   ```

   On the `<tr>`: `onClick={() => selectFromList(clip)}`, `tabIndex={0}`,
   `onKeyDown={e => onRowKey(e, clip)}`, and
   `aria-current={selectedClip?.id === clip.id ? "true" : undefined}`.
   `handleClipClick` stays for the timeline segments only.

   The keyboard handler has to keep keys away from the player.
   `VideoPlayer.tsx:489-557` listens on `document` and skips its shortcuts only
   when focus is in an input, textarea, button or contenteditable
   (lines 492-497). A focused `<tr>` is none of those, so without this, Space
   on a row would select the clip **and** toggle playback (line 510), Escape
   would clear the in/out marks (line 513), and an unmodified digit would
   quick-tag a clip (lines 542-553). React 18 listens at the root container,
   below `document`, so `e.stopPropagation()` in the row handler stops the
   native event before the player sees it.

   ```ts
   const onRowKey = (e: React.KeyboardEvent, clip: Clip) => {
     const plainDigit = /^[1-9]$/.test(e.key) && !e.metaKey && !e.ctrlKey && !e.altKey;
     if (e.key === "Enter" || e.key === " ") {
       e.preventDefault(); // Space would scroll the list
       e.stopPropagation();
       selectFromList(clip);
     } else if (e.key === "Escape" || plainDigit) {
       e.stopPropagation(); // keep marks and quick-tags out of a list row
     }
   };
   ```

   Arrow keys and the mark-in/mark-out keys still reach the player: seeking
   ±5s while reading the list is useful, and marking from a focused row does
   what it does from anywhere else. Cmd/Ctrl+digit still reaches `App`'s panel
   toggles because the guard only swallows unmodified digits.

5. Delete what this orphans: the play button, `.actionsCell`, the
   `.playBtn` rules (`Timeline.module.css:312-336`), the `faPlay` import.
   Keep `formatTime`: the ruler, the panel header and the segment tooltip
   still use it (decision 9).

6. CSS:
   - `.clipsTableElement`: `table-layout: auto`. `td`:
     `vertical-align: top`, `overflow-wrap: anywhere` so a long unbroken word
     cannot widen the table.
   - Delete the fixed widths and the `nowrap`/ellipsis in `.titleCell`,
     `.clipTitle`, `.timeCell`, `.durationCell`, `.notesCell`, `.notes`,
     `.categoryName`.
   - `.col_number, .col_time, .col_duration { white-space: nowrap; font-family: var(--font-mono); width: 1%; }`
     (the 1% makes auto layout shrink them to content);
     `.col_duration { text-align: right; }`; `.col_status { white-space: nowrap; min-width: 96px; }`.
   - `.col_category`: `min-width: 96px`, chips `display: flex;
     flex-wrap: wrap; gap: var(--spacing-xs)`.
   - Selected row: keep the `styles.selected` class on the row and replace the
     body of `.clipsTableElement tbody tr.selected` (`Timeline.module.css:189-192`,
     today `background: var(--bg-quaternary); border-color: var(--color-primary);`)
     with `background: color-mix(in srgb, var(--color-primary) 8%, transparent);`.
   - `tbody tr:focus-visible { outline: var(--focus-ring-width) solid var(--focus-ring-color); outline-offset: -2px; }`
   - `.rowNote`: block, `--font-size-xs`, `--text-tertiary`.

**Verify**: `npx tsc --noEmit -p .` → exit 0.

**Verify**: `grep -n "substring(0, 30)\|actionsCell\|playBtn\|faPlay" src/renderer/components/Timeline.tsx` → no matches.

**Verify**: `grep -n "<td[ >]\|<th[ >]" src/renderer/components/Timeline.tsx`
→ exactly two lines, one `<th` and one `<td`, both inside a `columns.map`
(the `[ >]` keeps `<thead>` out of the match).

**Verify**: `grep -n "stopPropagation" src/renderer/components/Timeline.tsx`
→ includes the two calls in `onRowKey`.

**Verify**: `grep -nE "#[0-9a-fA-F]{3,6}\b" src/renderer/styles/Timeline.module.css`
→ no matches (the file has none at `afb5b80`).

### Step 6: Full gate

**Verify**: `npm test` → `# fail 0`.

**Verify**: `npm run build` → exit 0 (locale lint, tsc, webpack).

**Verify**: `git status --short` lists only In scope files.

## Test plan

Unit: `src/renderer/utils/clipList.test.mts` (step 1) covers width parsing,
the column rules and numbering. `clipFilters.test.mts` gains the
non-number `parseIds` case, and `format.test.mts` any missing
`formatDuration` cases.

Manual, in `npm start`, against a project whose recording is longer than an
hour, with at least eight clips: two with two categories, one with none, one
with a long title and a note over 100 characters, and one with a status.

1. Each clip is one row. The two-category clips show two chips each, parent
   first. Selecting one highlights one row.
2. The long title and the long note wrap in full in Wide and Full, no
   ellipsis. In Narrow the note shows under the title.
3. Header and every row have the same number of cells (DevTools: each `tr`
   child count equals the `th` count).
4. Times past the hour read `1:08:41`, not `68:41`. `#`, Time and Duration
   line up in mono.
5. Pick one category in the dropdown: the Category column disappears, `#`
   values stay the same as before filtering. Back to All Categories: it
   returns.
6. Clear the one status (side panel table view): the Status column
   disappears from the bottom list. Set it again: it returns.
7. Click a row: the player seeks to that clip's start and the row highlights.
   The console shows no `TypeError` (today it does).
8. Tab to a row, press Enter: same as a click. Space does the same, does not
   scroll the list, and does **not** start or pause the video. With a mark-in
   set, focus a row and press Escape: the mark stays. Press `1` on a focused
   row: no clip is quick-tagged. Arrow Right still skips 5s. The focus ring is
   visible.
9. Narrow / Wide / Full each work, Full hides the tracks, and the choice
   survives a relaunch. With the window at about 1000px and the side panel
   open, Wide still leaves the timeline visible.
10. Click a segment on a timeline track: it still seeks to the clicked point
    inside the clip (unchanged behaviour).
11. Switch to the light theme: segments, chips and the selected row are
    legible.
12. Switch the app language to Portuguese: the control reads Largura da lista
    / Estreita / Larga / Completa.

## Done criteria

- [ ] `npm test` exits 0 and includes `clipList.test.mts`
- [ ] `npx tsc --noEmit -p .` exits 0
- [ ] `npm run lint:locales` exits 0
- [ ] `npm run build` exits 0
- [ ] `grep -n "substring(0, 30)" src/renderer/components/Timeline.tsx` returns nothing
- [ ] `grep -c "<td[ >]" src/renderer/components/Timeline.tsx` prints `1` and `grep -c "<th[ >]" src/renderer/components/Timeline.tsx` prints `1`
- [ ] `grep -n "BOTTOM_LIST_WIDTH" src/renderer/utils/storage.ts src/renderer/App.tsx` matches in both files
- [ ] `grep -rn "timeline.playClip" src` returns nothing
- [ ] `Timeline` receives `listWidth` and `onListWidthChange` from `App`
- [ ] The twelve manual checks pass
- [ ] The Status cell of plan 046's existing row in `plans/README.md` is
      updated (the coordinator already added the row; do not add another)

## STOP conditions

- `Timeline.tsx` or `Timeline.module.css` differ from `afb5b80` before you
  start (044 and 045 should not touch them).
- `npm test` fails on `clipList.test.mts` because of an import: the module
  must import nothing; do not work around it by adding a loader.
- With `table-layout: auto`, a long title still widens the table past the
  panel after `overflow-wrap: anywhere`. Report it with a screenshot rather
  than switching to fixed layout with hand-set widths.
- Wide at `min(660px, 60%)` leaves the timeline unusable on the owner's
  usual window size. Report the measured widths; the fraction is the owner's
  call.
- Any step's verification fails twice after a reasonable fix.
- The work seems to need changes in `ClipLibrary.tsx`, `ClipTable.tsx`, or
  the timeline tracks.

## Maintenance notes

- **Plan 048 sets the width** through `changeBottomListWidth` in `App`. If
  048 marks a preset "edited" on a manual change, the List width buttons are
  one of those manual changes, so 048 should wrap this setter, not call
  `setBottomListWidth` directly.
- **The column rules are in `listColumns`.** A new column goes there first,
  with a test, then into `cell()` and the header label. Header and rows cannot
  drift apart again as long as both map over that array.
- **The board items left out, in the order worth doing**: the Totals footer
  ("4 of 16 clips · 0:47"); the playhead "now" line between rows; a draggable
  grip between list and timeline (the three widths may be enough, wait for the
  coach); the list following the side-panel filter from 045 with a "Show all
  16" link. The last is open: the ledger's production notes assume the list
  follows the side-panel filter, while this list still has its own search and
  category dropdown. Settle with the owner before building it.
- **Reviewers should check**: one row per clip, the timeline tracks unchanged,
  Narrow still the default, no raw hex, and the row keyboard handler.
- `.categoryCount` in `Timeline.module.css` (line 233) has no user in
  `Timeline.tsx` today. It predates this plan; leave it or remove it in a
  cleanup PR.
- **Two clocks remain in `Timeline.tsx`.** The list uses `formatDuration`
  (h:mm:ss); the ruler, panel header and segment tooltip keep `formatTime`
  (m:ss, so `68:41`). Moving those to `formatDuration` is a small cleanup
  that was kept out to hold this diff to the list.
- **The row key handler is a local fix for a global problem.** Any other
  focusable non-button element in the app hits the same `VideoPlayer`
  shortcut leak. If a third one appears, widen the player's own guard
  (`VideoPlayer.tsx:492-497`) to skip events whose target is inside an
  element with `tabIndex >= 0`, and drop the per-component handlers.

## Plan review

Applied from the 2026-11-26 review: row key handler stops Enter, Space,
Escape and plain digits; grep patterns exclude `<thead>`; the selected rule
body is replaced in place; `<abbr>` for `#`; subcategory chips keep `└ ` and
italic; Status and Category `min-width: 96px`; `parseIds` drops non-numbers
with a test; one-row header; Category hiding recorded as deliberate; reuse of
045's helpers; segmented styles owned by `Timeline.module.css`; ruler and
tooltip formatting out of scope; `ListWidth` / `"narrow"` /
`changeBottomListWidth` named for 048; Step 0 install; README row is the
coordinator's.

Aligned with the final 045: `formatDuration` comes from
`src/renderer/utils/format.ts` (tested in `format.test.mts`), `parseIds` from
`src/renderer/utils/clipFilters.ts`. `clipList.ts` imports neither, because a
tested util cannot import another util, and `Timeline.tsx` does the
formatting and parsing. The earlier contest about where `formatDuration` lives
no longer applies.

Contests:

- **No new `parseCategoryIds`.** The review asked for `parseCategoryIds` to
  drop non-numbers with a test. 045 already adds `parseIds` with the same job,
  so this plan adds the non-number rule and its test to `parseIds` rather than
  shipping a second parser. Touching 045's file is the cost; `clipFilters.ts`
  and its test are now in scope for that one rule.
- **Arrow and mark keys pass through a focused row** on purpose (see step 5),
  while Escape and digits are stopped.
