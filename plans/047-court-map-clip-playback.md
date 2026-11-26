# Plan 047: Court map: click a dot and watch its clip inside Stats

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report, do not improvise. When done, set the Status column of this plan's
> row in `plans/README.md` (the coordinator already added the row; change
> only its Status).
>
> **Drift check (run first)**:
> `git diff --stat afb5b80..HEAD -- src/renderer/components/StatsDashboard.tsx src/renderer/components/Court.tsx src/renderer/styles/StatsDashboard.module.css src/renderer/styles/Court.module.css src/renderer/App.tsx src/shared/courtSvg.ts src/main/main.ts src/i18n/locales`
> Plans 044, 045 and 046 land before this one and are expected to change
> `src/i18n/locales/*.json` and possibly `src/renderer/App.tsx` (see
> "Depends on"), and 045 moves `formatDuration` into
> `src/renderer/utils/format.ts`. Those changes are fine. If `StatsDashboard.tsx`, `Court.tsx`,
> `courtSvg.ts`, the Stats modal block in `App.tsx`, or the `save-shot-chart`
> handler in `main.ts` changed, compare the "Current state" excerpts against
> the live code; on a mismatch, treat it as a STOP condition.

## Status

- **Priority**: P2
- **Effort**: M
- **Risk**: LOW (renderer only, plus two hardcoded strings in one main-process dialog; no schema, no new IPC)
- **Depends on**: plans/046 (stacked PR; branch from 046's branch). The stack is 044 card inline edit (`ClipLibrary.tsx`, locales), 045 sidebar filter popover (`ClipLibrary.tsx`, its CSS, locales; it also moves `formatDuration` out of `StatsDashboard.tsx` into `src/renderer/utils/format.ts`), 046 bottom clip list width (`Timeline.tsx` / `App.tsx` bottom panel, locales). 044 also makes `ClipLibrary`'s `handleUpdateClip` call `onClipsChanged()`, so a title edited in the sidebar shows up in Stats. None of them change `Court.tsx` or the court-map part of `StatsDashboard.tsx`; 045's only `StatsDashboard.tsx` edit is the `formatDuration` move.
- **Repo**: `app` (`kauredo/basketball-video-analyzer`)
- **Category**: direction
- **Planned at**: commit `afb5b80`, 2026-11-26
- **Design spec**: canvas https://claude.ai/artifact/WQSZuvHz6cTgGYEVFcJCGg, board "B · Shot chart". Everything the executor needs from it is copied into "Target design" below.

## Why this matters

A coach scouting an opponent tags each play with a spot on the court, then opens
Stats → Shot chart to see where the plays happen. Today the dots are dead ends:
`StatsDashboard.tsx:519-532` draws plain `<circle>`s with a `<title>` tooltip,
so to watch the play behind a dot the coach has to close Stats, find the clip in
the library by title and play it there. The coach asked to click a dot and see
its clip. The same coach tags turnovers, sets and pin-downs, not only shots, so
the owner renamed the feature "Court map" everywhere a user sees it.

After this plan, clicking or pressing Enter on a dot opens a detail column in
the Stats modal: the clip loops in a small player with Loop and 0.5x | 1x
controls, its title, category, "#7 · Q3 · 1:14:03–1:14:11" meta line and notes
sit under it, prev/next step through the other clips of that category on the
court, and "Open in main video" closes Stats and seeks the film to the clip.

## Current state

### Files in play

- `src/renderer/components/StatsDashboard.tsx` (547 lines): the Stats body. Tabs `overview` / `shotChart`, the filters, the court with dots, PNG save and the scouting-report export.
- `src/renderer/components/Court.tsx` (66 lines): the half-court SVG. Used in display mode here and in picker mode by `ClipCreator.tsx:499` (`<Court marker={courtPos} onSelect={setCourtPos} />`).
- `src/renderer/styles/StatsDashboard.module.css`, `src/renderer/styles/Court.module.css`.
- `src/renderer/App.tsx`: owns the Stats modal (lines 1091-1137) and `handleClipSelect` (line 442).
- `src/shared/courtSvg.ts`: court geometry plus `courtSvg()`, the standalone SVG string used for the PNG export and the PDF report. Only a comment mentions "shot chart"; its output has no title text.
- `src/shared/scoutingReport.ts`: builds the PDF HTML. The court section heading is `labels.shotChart` (line 117), filled from the i18n key `app.stats.tabShotChart` at `StatsDashboard.tsx:251`. Renaming the i18n value renames the PDF heading; nothing in this file needs to change.
- `src/main/main.ts:1863-1890`: `save-shot-chart` handler, with an English-only dialog title and default filename.
- `src/renderer/components/PresentMode.tsx`: the only other place that plays a cut clip file. Pattern to reuse, see below.
- `src/renderer/utils/paths.ts`: `formatVideoSrc(filePath)` turns a local path into the `clip-media://media/?path=...` URL the main process serves.

### The tab and the dots today, `StatsDashboard.tsx`

```tsx
// :72
const [tab, setTab] = useState<"overview" | "shotChart">("overview");
// :186-206  locatedClips = clips with court_x/court_y; chartClips = locatedClips
//           filtered by filterQuarter, filterCategory, filterPlayer
// :208-224
const chartOf = useCallback(
  (located: Clip[]) => {
    const legend = new Map<string, CourtLegendItem>();
    const dots: CourtDot[] = located.map(c => {
      const firstCat = parseCategoryIds(c)[0];
      const cat = firstCat != null ? flatCategories.find(fc => fc.id === firstCat) : undefined;
      const color = cat?.color || PRIMARY;
      if (cat) legend.set(String(cat.id), { color, label: cat.name });
      return { x: c.court_x as number, y: c.court_y as number, color, label: c.title };
    });
    return { dots, legend: [...legend.values()] };
  },
  [flatCategories]
);
// :351-359  the second tab button renders {t("app.stats.tabShotChart")}
// :517-541
<div className={styles.courtWrap}>
  <Court>
    {chart.dots.map((d, i) => (
      <circle key={chartClips[i].id} cx={d.x * COURT_VB_W} cy={d.y * COURT_VB_H}
        r={8} fill={d.color} fillOpacity={0.85} stroke="var(--bg-main)" strokeWidth={1}>
        <title>{d.label}</title>
      </circle>
    ))}
  </Court>
  {clips.length - locatedClips.length > 0 && (
    <p className={styles.unlocatedNote}>{t("app.stats.unlocatedCount", { count: ... })}</p>
  )}
</div>
```

There is no legend on screen today; the legend exists only in the exported PNG
and PDF. A dot takes its first category's colour, even when the Category filter
selects a different category of the same clip. `parseCategoryIds`,
`parsePlayerIds` (lines 31-47) are local functions in this file.
`formatDuration` (lines 49-59 at `afb5b80`, m:ss or h:mm:ss) is moved by plan
045 into `src/renderer/utils/format.ts`; import it from there. `PRIMARY =
"#0b7972"` (line 26) is the hex fallback colour for an uncategorised dot.

### `Court.tsx` hides its children from screen readers

```tsx
// Court.tsx:32-38
<svg className={styles.court} viewBox={`0 0 ${COURT_VB_W} ${COURT_VB_H}`}
  style={{ width: "100%", height: "auto", display: "block" }}
  onClick={onSelect ? handleClick : undefined}
  role={onSelect ? "button" : "img"}>
```

In display mode the `<svg>` has `role="img"`, and ARIA makes every child of
`role="img"` presentational. Focusable dots inside it would be announced as
nothing. `Court.module.css:1-4` caps the court at `max-width: 480px`.

### The Stats modal and clip select, `App.tsx`

```tsx
// :442
const handleClipSelect = (clip: Clip) => {
  if (videoPath && isSamePath(clip.video_path, videoPath)) {
    handleTimeSeek(clip.start_time);   // :273, calls videoPlayerRef.current.seekTo
    return;
  }
  const recording = recordings.find(video => isSamePath(video.video_path, clip.video_path));
  if (recording) void switchRecording(recording, clip.start_time);
};
// :1092-1101
{showStats && (
  <div ref={statsTrapRef} className={styles.modal} role="dialog" aria-modal="true"
    aria-labelledby="stats-title"
    onClick={(e) => { if (e.target === e.currentTarget) setShowStats(false); }}
    onKeyDown={(e) => { if (e.key === "Escape") setShowStats(false); }}>
// :1124-1132
    <StatsDashboard clips={...} categories={categories} videoDuration={...}
      showDistribution={...} recordingId={statsGame ?? undefined}
      recordings={recordings} projectId={currentProject?.id} />
```

`handleClipSelect` already handles a clip from another game in the project
(`switchRecording`), so "Open in main video" needs no new logic. What it does
in the edge cases, at `afb5b80`:

- The clip's game is loaded: seeks.
- Another game whose file exists: switches games and seeks.
- Another game whose file is missing: `switchRecording` (line 422) calls
  `locateRecording` (line 400), which shows the existing confirm dialog
  `app.projects.videoMissingMessage` ("The video file for this project is no
  longer at …. Would you like to locate it?") with a "Locate video" button.
  This happens after Stats closes, so the dialog is not hidden behind the
  modal. Errors there show the existing `app.projects.recordingError` toast.
- No recording matches the clip's `video_path`: nothing happens. A clip
  always belongs to one of the project's recordings, so this needs no new
  handling; the plan does not add a toast for it.
`statsTrapRef = useFocusTrap(showStats)` (line 106) restores focus to the
Stats header button when the modal closes.

### Keyboard shortcuts that would fire from a focused dot

`VideoPlayer.tsx:489-498` listens on `document` and ignores key presses whose
target is an input, textarea, `HTMLButtonElement` or contenteditable. A
`<g role="button">` is an `SVGGElement`, so Space on a focused dot would also
toggle the main video, Z / M / 1-9 would set marks or quick-tag, and Escape
would clear the marks (`VideoPlayer.tsx:513-515`, `onClearMarks()`).
`App.tsx:221-239` toggles the panels on Cmd/Ctrl+1 and Cmd/Ctrl+2 (it returns
early without a Cmd/Ctrl modifier) and also ignores only inputs, textareas and
contenteditable. React 18 attaches its handlers
at the root container, inside `document`, so `e.stopPropagation()` in a React
`onKeyDown` on the dot stops these `document` listeners.

### How PresentMode plays a cut clip, `PresentMode.tsx:67-74, 133-140`

```tsx
useEffect(() => {
  const video = videoRef.current;
  if (!video) return;
  video.load();
  video.play().catch(() => { /* Autoplay can be interrupted; ignore */ });
}, [currentIndex]);
...
<video ref={videoRef} className={styles.video}
  src={formatVideoSrc(currentClip.output_path)}
  onPlay={() => setIsPlaying(true)} onPause={() => setIsPlaying(false)}
  onEnded={handleEnded} autoPlay />
```

Category chips there use `style={{ backgroundColor: category.color, color: inkOn(category.color) }}`
with `inkOn` from `src/renderer/utils/contrast.ts`. Reuse both.

### Missing clip files

- Sessions imported from a file create clips with `output_path: ""` (`main.ts:2301`).
- A clip file deleted on disk: the media protocol answers 404 (`main.ts:394-396`), so the `<video>` fires `error`.
- Do **not** use the `check-paths-exist` IPC for this. Plan 043 step 2 restricts that handler to the `video_path` of saved projects, so it would answer `false` for every clip file. Detect a missing file as: `!clip.output_path` before rendering, or the `<video>` element's `onError` after.

### Every user-facing "shot chart" string

| Where | Today |
|---|---|
| `app.stats.tabShotChart` (all 11 locales, en.json:517) | "Shot chart"; also the PDF section heading |
| `app.stats.saveChartImageSuccess` | "Shot chart saved to {{path}}" |
| `app.stats.saveChartImageError` | "Could not save the shot chart" |
| `app.stats.noLocatedClips` | "No clips with a shot location yet. Set one in the clip editor." |
| `app.stats.reportNoLocated` | "No clip has a shot location." (PDF) |
| `app.clips.creator.shotLocation` (en.json:209) | "Shot location (optional)" |
| `main.ts:1878` | dialog title `"Save Shot Chart"` |
| `main.ts:1881` | default filename `` `${name}-shot-chart.png` `` |

Main-process dialog titles are English-only in this repo (`"Save Scouting Report"` at the next handler), so changing the literal is enough.

Internal identifiers stay: the `save-shot-chart` IPC channel, `saveShotChart` in `preload.ts` / `global.d.ts`, and `labels.shotChart` in `scoutingReport.ts`. Rename only the ones that are local and grep-clean: the i18n key `tabShotChart` → `tabCourtMap`, the tab state value `"shotChart"` → `"courtMap"`, the CSS class `.shotChart` → `.courtMap`, and the comment in `courtSvg.ts:2`.

### Repo conventions to match

- Design tokens in `src/renderer/styles/variables.css`; never raw hex in CSS. Radii are `var(--radius-md)` (1px), no shadows. Fonts: `var(--font-display)`, `var(--font-body)`, `var(--font-mono)`.
- Focus: `outline: var(--focus-ring-width) solid var(--focus-ring-color);` on `:focus-visible` (see `StatsDashboard.module.css:202-205`).
- Tokens this plan uses: `--bg-secondary`, `--bg-tertiary`, `--bg-quaternary`, `--border-color`, `--border-color-hover`, `--text-primary`, `--text-secondary`, `--text-tertiary`, `--text-muted`, `--color-primary`, `--color-primary-dark`, `--color-accent-ink`, `--text-white`, `--spacing-xs/sm/md/lg`, `--font-size-xs/sm/md/lg`, `--button-height`. The brief's "`--accent-ink`" and "`--border-hover`" are `--color-accent-ink` and `--border-color-hover` in this file.
- Owner rule: **one solid teal button per region.** In the detail column that is "Open in main video". The active segment of a segmented control is neutral and raised: `background: var(--bg-quaternary); color: var(--text-primary); border: 1px solid var(--border-color-hover); border-bottom: 2px solid var(--color-accent-ink);`. Do not copy `ClipLibrary.module.css:938` (`.viewToggleActive` is solid teal); that predates the rule.
- Pure logic goes in a module with a `.test.mts` next to it. `npm test` runs `src/renderer/utils/*.test.mts` with Node's type stripping and nothing from `node_modules`. Pattern: `src/renderer/utils/projectPlayback.test.mts` (imports `./projectPlayback.ts` with the `.ts` extension, `node:test` + `node:assert/strict`). The util must not import React, i18next or any value from `node_modules`; `import type` is fine.
- Locales: 11 files `src/i18n/locales/{en,pt,es,fr,de,it,sl,sr,lt,tr,el}.json`. `npm run lint:locales` enforces key parity, matching `{{placeholders}}`, sentence-end counts and register. Registers: pt informal (tu: "Define-a"), es / it / de informal, fr formal (vous). en and pt are hand-written; the other nine are machine translations, say so in the PR body.
- Times in ranges use an en dash: `1:14:03–1:14:11`.

## Target design (copied from the canvas board)

Layout of the Court map tab, top to bottom:

1. Filter row as today (Player, Quarter, Category selects; "Save as image" button on the right, secondary style, unchanged).
2. Body. **No dot selected**: the court alone, centred, up to 600px wide, legend row above it, and one muted line under the court: "Click a dot to watch its clip." **Dot selected**: two columns, detail on the left (about 520px), court on the right filling the rest. Under 1000px viewport width, stack: detail first, court under it.
3. Legend row (above the court, inside the court column): one item per row entry, `swatch + label + count`, in the order of the Category filter dropdown (`flatCategories` order), and at the far right `"14 of 16 on court"`. With no dot selected, swatches are filled. With a dot selected, the selected dot's category keeps a filled swatch and the others turn into hollow grey rings, matching the dots. Text: `--font-size-xs`, `--text-secondary`, count in `--text-primary`.
4. Dots. Filled in their category colour as today. With a dot selected: dots of the same category stay filled; every other dot becomes a hollow ring, `fill: none; stroke: var(--text-muted); stroke-width: 1.5`. The selected dot gets an extra ring, `r = 12`, `stroke: var(--text-primary)`, `stroke-width: 2`.

Detail column, top to bottom:

- Video, 16:9 box, `background: var(--bg-tertiary)`, `object-fit: contain`. A 2px progress line under it (`--color-primary` on `--border-color`), passive (no scrubbing).
- Control bar: play/pause icon button (aria-label "Pause"/"Play", reuse `app.buttons.pause` / `app.buttons.play`); mono time readout `0:03 / 0:08`; spacer; **Loop** toggle button with the repeat icon (`faRepeat`), `aria-pressed`, on by default; a segmented pair `0.5x | 1x` in a `role="group"` with aria-label "Playback speed", each segment `aria-pressed`, 1x by default.
- Title, `--font-display`, `--font-size-lg`.
- Meta line: category chip (solid category colour, ink from `inkOn`) then `#7 · Q3 · 1:14:03–1:14:11` in `--font-mono`, `--font-size-xs`, `--text-secondary`. Omit any missing part (no players with a number, no quarter); the time range is always there.
- Notes, plain text, `--text-secondary`, only when non-empty.
- Action row: **Open in main video** (icon `faArrowUpRightFromSquare`, solid teal: `background: var(--color-primary); color: var(--text-white)`, hover `--color-primary-dark`), with `title="Closes Stats and jumps the main video to 1:14:03"`. On the right, two square icon buttons, prev (`faChevronLeft`) and next (`faChevronRight`), aria-labels "Previous clip in Turnovers" / "Next clip in Turnovers", disabled at the ends.
- List heading: `"Turnovers on the court"` followed by the count in `--text-primary`.
- List: one row per same-category clip on the court, in game order. Row = category dot, title (ellipsis), quarter, duration (m:ss), mono for the last two. The playing row has `--bg-quaternary` background, a 2px `--color-accent-ink` left edge, bold title, and the word "Playing" in `--color-accent-ink` in place of the quarter. Rows are `<button>`s; clicking one selects that clip.
- A close icon button (×) at the top right of the column, aria-label "Close clip", clears the selection.

Missing clip file: the video box shows one plain line instead of the player, "The clip file is missing. It may have been moved or deleted." The control bar is hidden. Title, meta, notes, list, prev/next and "Open in main video" all still work.

Accessibility names, from the board:

- Dot: `"<title>, <category>"`, plus `", playing"` on the selected dot. Uncategorised (no category, or only ids of deleted categories): `"<title>, No Category"`.

Provenance: the Loop toggle, the 0.5x | 1x speed control, the legend with
per-category counts, the hollow grey rings and "N of M on court" all come from
the owner-picked board (ledger: "Shot chart direction is B", and round 1's
applied list: "out-of-scope dots as grey hollow rings; plain swatch legend in
filter order with '14 of 16 on court'; speed as 0.5x | 1x segments"). Build
them as specified; do not drop them as extras.

Defaults: Loop is on and speed is 1x each time the detail column opens. Both
survive prev/next and list clicks while the column stays open, and reset when
it closes (closing unmounts the component that holds them). Nothing is
persisted.
- Court svg in display mode: `role="group"`, aria-label "Court map".
- Detail column: `<section aria-label="Selected clip">`.

## Commands you will need

| Purpose | Command | Expected on success |
|---|---|---|
| Install (Step 0) | `npm ci` | exit 0 |
| Unit tests | `npm test` | `ℹ fail 0`; at `afb5b80` there are 101 tests, so expect 101 plus the new ones plus whatever 044–046 added |
| Typecheck | `npx tsc --noEmit -p .` | exit 0, no output |
| Locale lint | `npm run lint:locales` | last line `11 locale files, N keys each: clean` |
| Renderer bundle | `npm run build:renderer` | exit 0 |
| Full build | `npm run build` | exit 0 |
| Run the app | `npm run dev` | Electron window opens |

Shell rules: plain commands only, never `bash -c` or `eval`; copy with `/bin/cp -f`; delete with `command rm` (plain `rm` is aliased to prompt).

## Scope

**In scope** (the only files you may modify or create):

- `src/renderer/utils/courtMap.ts` (**create**) and `src/renderer/utils/courtMap.test.mts` (**create**)
- `src/renderer/components/CourtClipDetail.tsx` (**create**): the detail column
- `src/renderer/components/StatsDashboard.tsx`
- `src/renderer/styles/StatsDashboard.module.css`
- `src/renderer/components/Court.tsx` (the `ariaLabel` and `maxWidth` props only; `Court.module.css` stays unchanged)
- `src/renderer/App.tsx` (the Stats modal block only: one new prop on `<StatsDashboard>`, and `e.stopPropagation()` in the modal's Escape handler)
- `src/shared/courtSvg.ts` (comment on line 2 only)
- `src/main/main.ts` (the two literals in `save-shot-chart`, lines 1878 and 1881, only)
- `src/i18n/locales/*.json` (all eleven)
- `plans/README.md` (the Status column of the existing 047 row only)

**Out of scope** (do not touch):

- The `save-shot-chart` / `saveShotChart` IPC names and `labels.shotChart` in `scoutingReport.ts`. Renaming them crosses the process boundary for no user-visible gain.
- The exported PNG and PDF drawing in `courtSvg()` beyond the comment. The export keeps its own legend (no counts, no hollow rings); it already gets the new title through the i18n value.
- `check-paths-exist` (see "Missing clip files").
- `PresentMode.tsx`. Read it, do not refactor it into a shared player.
- Pausing the main video when Stats opens. `VideoPlayer`'s ref exposes only `seekTo`, `getOverlay`, `getClipDrawings`; adding `pause` is a separate change (see Maintenance notes).
- A hover callout label next to the selected dot (the board shows one). The `<title>` tooltip and the detail column carry that information; the callout is a follow-up.
- README, `llms.txt` and the website. List them in the PR body as follow-ups (see Maintenance notes).
- Removing the "Scouting report (PDF)" button from the tab row, which the board does not show. It stays.

## Git workflow

- Branch: `feat/047-court-map-clip-playback`, cut from plan 046's branch (stacked PR; base the PR on 046's branch, not `main`).
- Conventional commits, matching `git log --oneline` (for example `fix(projects): reopen projects with a missing game and validate imports (#87)`). Suggested: `feat(stats): play a court map dot's clip inside Stats` and `refactor(stats): rename shot chart to court map`.
- Never mention AI tooling in a commit message and never add an AI co-author line.
- Do not push or open a PR unless the operator asked for it.

## Steps

### Step 0: Install

If `node_modules` is missing in the worktree (`ls node_modules` fails), run `npm ci`.

**Verify**: `ls node_modules/.bin/tsc` → the file exists.

### Step 1: Rename "Shot chart" to "Court map"

1. In all 11 locale files, rename the key `app.stats.tabShotChart` to `app.stats.tabCourtMap` and set the values below. Change the values of `saveChartImageSuccess`, `saveChartImageError`, `noLocatedClips`, `reportNoLocated` and `shotLocation` (keys unchanged) so they say court map / court location instead of shot chart / shot location, keeping placeholders and the file's register.

   | Locale | `tabCourtMap` | `shotLocation` |
   |---|---|---|
   | en | Court map | Court location (optional) |
   | pt | Mapa do campo | Localização no campo (opcional) |
   | es | Mapa de pista | Ubicación en la pista (opcional) |
   | fr | Carte du terrain | Emplacement sur le terrain (facultatif) |
   | de | Spielfeldkarte | Position auf dem Spielfeld (optional) |
   | it | Mappa del campo | Posizione in campo (facoltativo) |
   | sl | Zemljevid igrišča | Lokacija na igrišču (neobvezno) |
   | sr | Mapa terena | Lokacija na terenu (opciono) |
   | lt | Aikštės žemėlapis | Vieta aikštėje (nebūtina) |
   | tr | Saha haritası | Saha konumu (isteğe bağlı) |
   | el | Χάρτης γηπέδου | Θέση στο γήπεδο (προαιρετικό) |

   en values for the rest: `"Court map saved to {{path}}"`, `"Could not save the court map"`, `"No clips with a court location yet. Set one in the clip editor."`, `"No clip has a court location."`. pt: `"Mapa do campo guardado em {{path}}"`, `"Não foi possível guardar o mapa do campo"`, `"Ainda não há clipes com localização no campo. Define-a no editor de clipes."`, `"Nenhum clip tem localização no campo."`.
2. `StatsDashboard.tsx`: tab state `"shotChart"` → `"courtMap"` (lines 72, 354-356), `t("app.stats.tabShotChart")` → `t("app.stats.tabCourtMap")` (lines 251 and 358), `styles.shotChart` → `styles.courtMap` (line 449), the comment at line 226 and the `console.error` text at line 305.
3. `StatsDashboard.module.css:212`: `.shotChart` → `.courtMap`.
4. `main.ts:1878`: `title: "Save Court Map"`. `main.ts:1881`: `` `${(project?.name || "court").replace(/[^a-zA-Z0-9]/g, "_")}-court-map.png` ``.
5. `courtSvg.ts:2`: "for the shot chart image" → "for the court map image".

**Verify**:
- `grep -rn -i -E "shot.?chart" src/i18n src/renderer` → exactly two lines, both in `StatsDashboard.tsx`: the report label key `shotChart: t("app.stats.tabCourtMap"),` (line ~251) and the IPC call `window.electronAPI.saveShotChart(` (line ~302). Line numbers may shift by a few after 045.
- `grep -n -i -E "shot.?chart" src/main/main.ts` → exactly two lines: the comment `// Save the shot chart the renderer drew…` (line ~1863; reword it to "court map" too if you like, then it is one line) and the channel string `"save-shot-chart",` (line ~1866). No `Save Shot Chart` and no `-shot-chart.png`.
- `grep -c '"tabCourtMap"' src/i18n/locales/*.json` → 1 in each of the 11 files.
- `npm run lint:locales` → clean. `npx tsc --noEmit -p .` → exit 0.

### Step 2: The pure court-map module, test first

Create `src/renderer/utils/courtMap.ts`. Move `parseCategoryIds` and `parsePlayerIds` out of `StatsDashboard.tsx` into it (exported; `StatsDashboard` imports them back), so there is one copy. `formatDuration` stays where plan 045 put it, `src/renderer/utils/format.ts`; `courtMap.ts` imports it as `import { formatDuration } from "./format.ts";` (format.ts imports nothing from `node_modules`, so the test runner can load it). If 045 has not moved it (no `formatDuration` export in `format.ts`), STOP. Use a structural type, not the app's `Clip`:

```ts
export interface CourtMapClip {
  id: number;
  title: string;
  start_time: number;
  end_time: number;
  duration: number;
  categories: string;          // JSON array of ids
  players?: string;            // JSON array of ids
  quarter?: string | null;
  video_path?: string;
}
export interface CourtMapCategory { id: number; name: string; color: string }
export interface CourtMapPlayer { id: number; number?: string | null }
export type CategoryFilter = number | "all";

export const parseCategoryIds: (clip: { categories: string }) => number[];
export const parsePlayerIds: (clip: { players?: string }) => number[];

/** The category a dot is drawn in: the filtered category when the Category
 *  filter is set and the clip has it, else the clip's first category id that
 *  exists in knownIds, else null. Ids of deleted categories never count, so a
 *  clip whose only ids are unknown is uncategorised (null). */
export const dotCategoryId: (
  clip: CourtMapClip, filter: CategoryFilter, knownIds: ReadonlySet<number>,
) => number | null;

/** Legend rows for the dots drawn. Filter "all": every category in the given
 *  order, zeros kept. A category filter: only that category. A final row with
 *  id null counts uncategorised dots (dotCategoryId null, including clips that
 *  carry only deleted category ids), present only when its count is > 0.
 *  knownIds is built from categories. Invariant: the counts sum to drawn.length. */
export const legendRows: (
  drawn: CourtMapClip[], categories: CourtMapCategory[], filter: CategoryFilter,
) => { id: number | null; count: number }[];

/** Clips drawn on the court that share the selected clip's dot category, in
 *  game order: by gameOrder(clip) (recording index, default 0), then
 *  start_time, then id. Includes the selected clip. Empty if selectedId is
 *  not among drawn. Uncategorised clips (null) group together: selecting one
 *  lists every uncategorised dot. Generic so callers get their own Clip type back. */
export const sameCategoryClips: <T extends CourtMapClip>(
  drawn: T[], selectedId: number, filter: CategoryFilter, knownIds: ReadonlySet<number>,
  gameOrder?: (clip: T) => number,
) => T[];

/** The id one step before (-1) or after (+1) currentId in list, or null at an end. */
export const stepClip: (list: CourtMapClip[], currentId: number, step: -1 | 1) => number | null;

/** ["#7, #11", "Q3", "1:14:03–1:14:11"] with missing parts left out. Player
 *  numbers come from players, in the clip's player order, skipping players
 *  with no number or not in the table. The range uses an en dash. */
export const clipMetaParts: (clip: CourtMapClip, players: CourtMapPlayer[]) => string[];
```

Then create `src/renderer/utils/courtMap.test.mts` (pattern: `projectPlayback.test.mts`) with these cases, written before the implementation and seen failing once:

1. `dotCategoryId`: first category with filter "all"; the filtered category when the clip is `[2, 5]` and the filter is 5; null for `"[]"` and for malformed JSON; `[99, 3]` with 99 unknown → 3; `[99]` with 99 unknown → null.
2. `legendRows` with filter "all": every category in input order, a zero row kept; an uncategorised clip adds a trailing `{ id: null }` row; a clip with only a deleted category id lands in that null row; the counts sum to `drawn.length` for a mixed set that includes a deleted-id clip (assert the invariant directly).
3. `legendRows` with a category filter: one row, its count equals `drawn.length` when every drawn clip has that category.
4. `legendRows` with no uncategorised clips has no null row.
5. `sameCategoryClips`: keeps only the selected clip's dot category; orders by `gameOrder`, then `start_time`, then `id`; includes the selected clip; returns `[]` for an id not drawn; under a category filter, a clip whose first category differs but has the filtered one is included; selecting an uncategorised clip returns every uncategorised clip (including one with only a deleted id) and nothing else.
6. `stepClip`: middle steps both ways; null before the first and after the last; null for an id not in the list.
7. `clipMetaParts`: full case → `["#7", "Q3", "1:14:03–1:14:11"]` for `start_time 4443, end_time 4451`; two numbered players → `"#7, #11"`; a player with no number is skipped; no players and no quarter → only the range; a sub-hour clip → `"4:03–4:11"`.

**Verify**: `npm test` → `ℹ fail 0`, and the new file's tests appear in the output (`npm test 2>&1 | grep -c "courtMap\|dotCategoryId\|legendRows"` is non-zero, or count the added `test(` calls against the `ℹ tests` total). `npx tsc --noEmit -p .` → exit 0.

### Step 3: Court accepts a label and a width

In `Court.tsx` add two optional props: `ariaLabel?: string` and `maxWidth?: number`. Render
`role={onSelect ? "button" : ariaLabel ? "group" : "img"}`, `aria-label={ariaLabel}`, and
merge `maxWidth` into the existing inline style: `style={{ width: "100%", height: "auto", display: "block", ...(maxWidth ? { maxWidth } : {}) }}`. An inline style beats the `.court { max-width: 480px }` rule in `Court.module.css` regardless of stylesheet order, so no CSS override is needed. `ClipCreator`'s call passes neither and renders as before.

**Verify**: `npx tsc --noEmit -p .` → exit 0. `git diff --stat src/renderer/components/ClipCreator.tsx` → empty.

### Step 4: Dots become buttons, colour by dot category, legend row

In `StatsDashboard.tsx`:

1. Build the category inputs once:

   ```ts
   const mapCategories = useMemo<CourtMapCategory[]>(
     () => flatCategories
       .filter((c): c is Category & { id: number } => c.id !== undefined)
       .map(c => ({ id: c.id, name: c.name, color: c.color })),
     [flatCategories]
   );
   const knownIds = useMemo(() => new Set(mapCategories.map(c => c.id)), [mapCategories]);
   ```

2. Change `chartOf` to take the category filter, and make every dot carry its clip id:

   ```ts
   const chartOf = useCallback(
     (located: Clip[], filter: CategoryFilter) => {
       const legend = new Map<string, CourtLegendItem>();
       const dots = located.map(c => {
         const catId = dotCategoryId(c, filter, knownIds);
         const cat = catId === null ? undefined : mapCategories.find(fc => fc.id === catId);
         const color = cat?.color || PRIMARY;
         if (cat) legend.set(String(cat.id), { color, label: cat.name });
         return { clipId: c.id, catId, x: c.court_x as number, y: c.court_y as number, color, label: c.title };
       });
       return { dots, legend: [...legend.values()] };
     },
     [mapCategories, knownIds]
   );
   const chart = useMemo(() => chartOf(chartClips, filterCategory), [chartOf, chartClips, filterCategory]);
   ```

   The extra `clipId` / `catId` fields are fine where a `CourtDot[]` is expected (`courtSvg` and the IPC ignore them; strip them with a `.map(({ x, y, color, label }) => ({ x, y, color, label }))` before `exportScoutingReport` if `tsc` or the main-process normaliser objects). The screen, the PNG and the legend now agree on each dot's colour. `handleSaveChartImage` keeps using `chart`. `handleExportReport` (line 233) calls `chartOf(locatedClips, "all")`: the report is unfiltered, so it keeps first-category colours. The export legend stays as built now (present categories, no counts).
3. Add `const [selectedId, setSelectedId] = useState<number | null>(null);` and derive `const selected = chartClips.find(c => c.id === selectedId) ?? null;`. No effect is needed: when a filter or the game scope removes the clip from `chartClips`, `selected` becomes null and the detail column closes.
4. Compute `const selectedCat = selected ? dotCategoryId(selected, filterCategory, knownIds) : undefined;` (`null` means uncategorised; `undefined` means nothing selected) and `const legend = legendRows(chartClips, mapCategories, filterCategory);`. A legend row or chip with `id: null` uses `app.categories.noCategory` and the hex `PRIMARY` (`#0b7972`), not a CSS variable, so `inkOn(PRIMARY)` can compute the chip's text colour.
5. Replace the `chart.dots.map((d, i) => …chartClips[i]…)` loop with a loop over `chart.dots` that looks clips up by `d.clipId` (a `Map<number, Clip>` from `chartClips`), never by index, because the draw order (end of this item) differs from `chartClips` order. Each dot becomes:

```tsx
<g
  key={clip.id}
  data-clip-id={clip.id}
  role="button"
  tabIndex={0}
  className={styles.dot}
  aria-label={dotLabel(clip)}            // "<title>, <category name or app.categories.noCategory>" + ", playing" when selected
  aria-pressed={clip.id === selectedId}
  onClick={() => setSelectedId(clip.id)}
  onKeyDown={e => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      setSelectedId(clip.id);
    }
    // Keep Space/Z/M/1-9/Cmd+1/Cmd+2 away from VideoPlayer's and App's document
    // listeners. Tab must move focus; Escape bubbles to the court-map body
    // handler (step 6) and then to App's modal handler, which stops it there.
    if (e.key !== "Tab" && e.key !== "Escape") e.stopPropagation();
  }}
>
  <circle cx={cx} cy={cy} r={14} className={styles.dotHit} />          {/* transparent hit area */}
  <circle cx={cx} cy={cy} r={8} ... filled, or hollow when selectedCat !== undefined && d.catId !== selectedCat />
  {clip.id === selectedId && <circle cx={cx} cy={cy} r={12} className={styles.dotSelected} />}
  <circle cx={cx} cy={cy} r={12} className={styles.dotFocus} />        {/* stroke shown only on :focus-visible */}
  <title>{clip.title}</title>
</g>
```

   Draw same-category dots after the others so the hollow rings never cover them (sort a copy of `chart.dots` with `d.catId === selectedCat` last; keys stay `clipId`).
6. Pass `ariaLabel={t("app.stats.tabCourtMap")}` and `maxWidth={600}` to `<Court>`.
7. Above the court, render the legend: a `<ul className={styles.legend}>` with one `<li>` per `legend` row (swatch span coloured by the category, hollow when a dot is selected and the row is not its category; label; count), then a final `<li className={styles.legendTotal}>` with `t("app.stats.onCourt", { shown: chartClips.length, total: filteredTotal })`, where `filteredTotal` is the number of clips in `clips` that pass the same Player / Quarter / Category filters with location ignored. Remove the `unlocatedNote` paragraph (lines 534-540) and its `.unlocatedNote` CSS; "14 of 16 on court" replaces it. Delete the `unlocatedCount` key from all 11 locales.
8. Under the court when nothing is selected: `<p className={styles.courtHint}>{t("app.stats.courtMapHint")}</p>`.
9. CSS in `StatsDashboard.module.css`: `.dot { cursor: pointer; outline: none; }`, `.dotHit { fill: transparent; }`, `.dotSelected { fill: none; stroke: var(--text-primary); stroke-width: 2; }`, `.dotFocus { fill: none; stroke: none; }`, `.dot:focus-visible .dotFocus { stroke: var(--focus-ring-color); stroke-width: 2.5; }`, `.dotHollow { fill: none; stroke: var(--text-muted); stroke-width: 1.5; }`, legend flex row with `flex-wrap: wrap; gap: var(--spacing-sm) var(--spacing-md);` and `.legendTotal { margin-left: auto; }`.

**Verify**: `npx tsc --noEmit -p .` → exit 0. `npm run build:renderer` → exit 0. `grep -c '"unlocatedCount"' src/i18n/locales/*.json` → 0 in every file (after step 6 removes it and step 5 of this plan adds the new keys, `npm run lint:locales` → clean; if you run lint before step 5, missing-key errors for the new keys are expected).

### Step 5: Locale keys for the detail column and legend

Add to `app.stats` in all 11 files (en / pt below; translate the other nine, keeping placeholders and the file's register):

| Key | en | pt |
|---|---|---|
| `onCourt` | `{{shown}} of {{total}} on court` | `{{shown}} de {{total}} no campo` |
| `courtMapHint` | `Click a dot to watch its clip.` | `Clica num ponto para ver o clip.` |
| `dotPlaying` | `{{label}}, playing` | `{{label}}, a reproduzir` |
| `selectedClip` | `Selected clip` | `Clip selecionado` |
| `closeClip` | `Close clip` | `Fechar clip` |
| `loop` | `Loop` | `Repetir` |
| `playbackSpeed` | `Playback speed` | `Velocidade de reprodução` |
| `openInMainVideo` | `Open in main video` | `Abrir no vídeo principal` |
| `openInMainVideoHint` | `Closes Stats and jumps the main video to {{time}}` | `Fecha as estatísticas e salta o vídeo principal para {{time}}` |
| `prevInCategory` | `Previous clip in {{category}}` | `Clip anterior em {{category}}` |
| `nextInCategory` | `Next clip in {{category}}` | `Clip seguinte em {{category}}` |
| `onCourtHeading` | `{{category}} on the court` | `{{category}} no campo` |
| `playing` | `Playing` | `A reproduzir` |
| `clipFileMissing` | `The clip file is missing. It may have been moved or deleted.` | `O ficheiro do clip não existe. Pode ter sido movido ou apagado.` |

Reuse existing keys rather than adding: `app.buttons.play`, `app.buttons.pause`, `app.categories.noCategory`. The dot label is `"<title>, <category>"` built in code with `", "`; wrap it with `dotPlaying` for the selected dot. The "0.5x" / "1x" segment labels are literal, not translated.

**Verify**: `npm run lint:locales` → clean. `npx tsc --noEmit -p .` → exit 0.

### Step 6: The detail column

Create `src/renderer/components/CourtClipDetail.tsx`:

```ts
interface CourtClipDetailProps {
  clip: Clip;                          // the selected clip
  categoryName: string;                // dot category name, or app.categories.noCategory
  categoryColor: string;               // dot category hex colour, or PRIMARY ("#0b7972") when uncategorised, so inkOn() works
  players: Player[];
  siblings: Clip[];                    // sameCategoryClips(...) result, includes clip
  onSelect: (id: number) => void;      // list rows and prev/next
  onClose: () => void;                 // × button; StatsDashboard clears the selection and focuses the dot
  onOpenInMainVideo?: (clip: Clip) => void;   // absent → no button
}
```

- Hold `loop` (default `true`) and `rate` (`0.5 | 1`, default `1`) in this component so they survive stepping between clips. They reset to Loop on / 1x each time the column opens, because closing unmounts this component. Do not persist them. Put the `<video>` and its error state in an inner component keyed by `clip.id` (`<ClipVideo key={clip.id} .../>`), so a missing file on one clip does not stick to the next.
- `ClipVideo`: if `!clip.output_path`, render the missing message at once. Otherwise `<video ref src={formatVideoSrc(clip.output_path)} autoPlay loop={loop} onError={() => setMissing(true)} onPlay onPause onTimeUpdate onLoadedMetadata />`. On `loadedmetadata` and whenever `rate` changes, set `video.playbackRate = rate` (a new `src` resets `playbackRate`, so the `loadedmetadata` assignment is needed). `play()` returns a promise that rejects when a pause interrupts it; catch and ignore, as `PresentMode.tsx:71` does.
- Controls as in "Target design". Speed segments: `<div role="group" aria-label={t("app.stats.playbackSpeed")}>` with two `<button aria-pressed>`; the active one gets the neutral raised style from "Repo conventions". The Loop button uses the same raised style when on.
- Meta line: chip + `clipMetaParts(clip, players).join(" · ")`.
- Prev/next: `stepClip(siblings, clip.id, -1 | 1)`; disabled when null. Focus: a disabled button drops focus to `<body>`, so after a click that lands on an end (the new clip is first or last), move focus to the other arrow if it is enabled. Keep refs to both buttons and do this in an effect on `clip.id` that runs only when the step came from an arrow (track it with a ref set in the click handler).
- Open in main video: `title={t("app.stats.openInMainVideoHint", { time: formatDuration(clip.start_time) })}`, `onClick={() => onOpenInMainVideo(clip)}`.
- The list: `<ul>` of `<li><button aria-current={id === clip.id ? "true" : undefined}>…</button></li>`.
- Root: `<section aria-label={t("app.stats.selectedClip")} className={styles.detail}>`. Styles go in `StatsDashboard.module.css` (import it here too); every interactive element gets the `:focus-visible` outline.

In `StatsDashboard.tsx`:

- New optional prop `onOpenClip?: (clip: Clip) => void`. Hide the "Open in main video" button when it is absent.
- `players` already loads at lines 78-90; pass it through.
- `siblings = sameCategoryClips(chartClips, selected.id, filterCategory, knownIds, c => recordings.findIndex(r => isSamePath(r.video_path, c.video_path)))`. It returns `Clip[]` because the function is generic.
- `categoryName` / `categoryColor`: from `mapCategories.find(c => c.id === selectedCat)`, or `t("app.categories.noCategory")` and `PRIMARY` when `selectedCat` is null.
- A helper `focusDot(id)` does `document.querySelector<SVGGElement>(`[data-clip-id="${id}"]`)?.focus()`. Run it after the state update (in a `requestAnimationFrame` or a `useEffect` keyed on a "return focus to" ref) so the dot exists when focused.
- `onClose` (the × button): `const id = selectedId; setSelectedId(null); focusDot(id)`.
- Layout: wrap the legend + court in a court column, and render `.courtMapBody` as a grid: one column centred when nothing is selected; `grid-template-columns: minmax(320px, 520px) minmax(0, 1fr)` with the detail first when a dot is selected; `@media (max-width: 1000px) { grid-template-columns: 1fr; }`.
- Escape: on the `.courtMapBody` wrapper, `onKeyDown={e => { if (e.key === "Escape" && selected) { e.stopPropagation(); const id = selected.id; setSelectedId(null); focusDot(id); } }}`. React's `stopPropagation` also stops the native event before it reaches `VideoPlayer`'s `document` listener, so the marks survive. A second Escape (nothing selected) bubbles to `App.tsx`'s modal handler and closes Stats. When the detail column opens from a dot, focus stays on the dot.

In `App.tsx`, in the Stats modal block only:

1. Make the modal's Escape handler stop the event, so Escape anywhere in Stats (a dot, a tab, the filters) never reaches `VideoPlayer`'s `document` listener and clears the marks:

   ```tsx
   onKeyDown={(e) => { if (e.key === "Escape") { e.stopPropagation(); setShowStats(false); } }}
   ```

2. On the `<StatsDashboard>` add:

   ```tsx
   onOpenClip={clip => { setShowStats(false); handleClipSelect(clip); }}
   ```

   Stats closes first, so the "Locate video" confirm that `handleClipSelect` → `switchRecording` → `locateRecording` shows for a game whose file is missing is not hidden behind the modal (see "The Stats modal and clip select"). No new toast.

I chose to stop Escape in App's modal handler, not to add an `onClose` prop to `StatsDashboard`: it is one line, it covers every focusable element in Stats and not only the dots, and `StatsDashboard` keeps no knowledge of the modal around it.

**Verify**: `npx tsc --noEmit -p .` → exit 0. `npm run build:renderer` → exit 0. `npm test` → `ℹ fail 0`. `git diff src/renderer/App.tsx` (against 046's branch) shows only the changed Escape handler and the added `onOpenClip` prop.

### Step 7: Manual check in the running app

`npm run dev`, open a project with at least two categories of located clips, one uncategorised located clip, and one unlocated clip. Then run the manual list in "Test plan". Fix and re-run until every item holds.

**Verify**: every manual item passes; `npm run build` → exit 0.

## Test plan

Unit (Step 2, `src/renderer/utils/courtMap.test.mts`, modelled on `projectPlayback.test.mts`): the eight groups listed there. The legend invariant (counts sum to dots drawn) is asserted directly, once with uncategorised clips and once under a category filter.

Manual, in `npm run dev`:

1. Stats header tab reads "Court map". In Settings, switch language to pt and back: tab reads "Mapa do campo".
2. "Save as image": dialog title "Save Court Map", default file name ends `-court-map.png`, success toast says "Court map saved to …".
3. "Scouting report (PDF)": the court section heading in the PDF reads "Court map".
4. Clip editor: the court picker label reads "Court location (optional)".
5. Legend: categories in the same order as the Category dropdown, zero counts shown, a "No Category" item when an uncategorised clip is on the court, and "N of M on court" at the end. Add up the counts: they equal the dots you can see. Change Player / Quarter / Category: counts and the total update; under a Category filter the legend shows that one category.
6. Tab from the filters into the court: each dot takes focus with a visible ring; a screen-reader name of "title, Category" (check with the Accessibility pane in DevTools). Press Enter, then Space on another dot: each opens that clip.
7. Set a mark-in point on the main video first (Z), then open Stats. With a dot focused, press Space, M, 1, Cmd/Ctrl+1, Cmd/Ctrl+2: the main video does not toggle, no mark-out is set, no clip is quick-tagged, and the side and bottom panels do not toggle. Then press Escape (with a dot selected, then again to close Stats): after Stats closes, the mark-in point is still set.
8. Click a dot: the detail column opens on the left, the clip plays and loops; other categories turn into grey rings in the court and in the legend; the clicked dot has a white ring.
9. Loop off: the clip stops at its end. 0.5x: playback slows; press next: the next clip also plays at 0.5x and with Loop still off.
10. Prev/next walk the same-category list in game order and stop at the ends (buttons disabled). Using the keyboard, press Enter on "next" until the last clip: focus lands on "previous", not on the page. The × button closes the column and focus returns to that clip's dot. Select an uncategorised dot: the list holds every uncategorised dot on the court, under "No Category on the court", with a teal chip. The list marks the playing row with "Playing" and the left edge; clicking a row plays it.
11. Change the Quarter filter so the selected clip drops out: the detail column closes and the court returns to one column.
12. Escape once: the detail column closes and focus is on the dot. Escape again: Stats closes.
13. "Open in main video": hover shows "Closes Stats and jumps the main video to …"; click closes Stats and the main video sits at the clip's start. In a project with two games, pick a clip from the game that is not loaded: the app switches games and seeks. Move that game's video file away and repeat: Stats closes and the existing "Locate video" confirm appears.
14. Delete one clip's file in Finder (or use an imported session, whose clips have no file), then click its dot: the video box says "The clip file is missing. It may have been moved or deleted."; the title, meta, notes, list and "Open in main video" still work; stepping to a clip whose file exists plays it.
15. Light theme (Settings): rings, chips, the teal button and the raised segments are all legible.
16. Narrow the window under 1000px: the detail column stacks above the court.
17. If the main video was playing when Stats opened, note whether both videos play sound at once. Report it in the PR body; do not change it here.

## Done criteria

- [ ] `npm test` exits 0 and includes the tests in `src/renderer/utils/courtMap.test.mts`
- [ ] `npx tsc --noEmit -p .` exits 0
- [ ] `npm run lint:locales` ends with `clean`
- [ ] `npm run build` exits 0
- [ ] `grep -rn -i -E "shot.?chart" src/i18n src/renderer` matches exactly two lines in `StatsDashboard.tsx`: the `shotChart:` report label key and the `saveShotChart(` IPC call
- [ ] `grep -n "Save Shot Chart\|shot-chart.png" src/main/main.ts` matches nothing
- [ ] `grep -c '"tabCourtMap"' src/i18n/locales/*.json` is 1 for each of the 11 files, and `grep -rn '"tabShotChart"\|"unlocatedCount"' src/i18n` matches nothing
- [ ] `grep -n "<circle" src/renderer/components/StatsDashboard.tsx` shows the circles only inside a `<g role="button" tabIndex={0}`
- [ ] `grep -rn "checkPathsExist" src/renderer/components/StatsDashboard.tsx src/renderer/components/CourtClipDetail.tsx` matches nothing
- [ ] `git diff --name-only <046 branch>..HEAD` lists only in-scope files
- [ ] All 17 manual checks pass
- [ ] The Status column of plan 047's existing row in `plans/README.md` is updated

## STOP conditions

Stop and report back (do not improvise) if:

- `StatsDashboard.tsx`, `Court.tsx` or the Stats modal in `App.tsx` no longer matches the excerpts above (an earlier plan in the stack changed them, or `main` moved).
- A focused SVG `<g tabIndex={0}>` does not take keyboard focus or does not match `:focus-visible` in the app's Electron/Chromium. Report it; the fallback (an HTML `<button>` per dot positioned over the SVG) changes the layout approach and needs a decision.
- `e.stopPropagation()` on the dot, the court-map body or App's modal Escape handler does not stop `VideoPlayer`'s `document` keydown listener (manual check 7 fails). Do not edit `VideoPlayer.tsx` to fix it.
- `src/renderer/utils/format.ts` has no `formatDuration` export when you start (plan 045 did not move it, or moved it elsewhere).
- A missing clip file does not fire the `<video>` `error` event (manual check 14 shows a blank or frozen player instead of the message).
- Plan 043 or another change removed or renamed `formatVideoSrc` or the `clip-media` scheme.
- `npm run lint:locales` rejects a translation for register or sentence count twice after rewording.
- The work appears to need a change to `main.ts` beyond the two literals, `preload.ts`, `global.d.ts`, `VideoPlayer.tsx` or `PresentMode.tsx`.

## Maintenance notes

- `courtMap.ts` is now the one place that decides a dot's category (`dotCategoryId`). The PNG export, the legend, the hollow rings and the same-category list all go through it; change it there or they will disagree. The legend invariant test guards the count.
- The exported PNG legend has no counts and no hollow rings on purpose: the export shows the filtered set, not a selection.
- Deferred, as follow-ups:
  - **Docs** (separate PRs). `README.md:132-136` ("Players, Court, and Stats") does not name the tab; add a bullet for the court map and dot playback. `website/public/llms.txt:13` and `:36` (the latter links "Shot charts from game film" at `/shot-chart/`). Website pages that say "shot chart": `src/pages/shot-chart.astro` (13 mentions), `scouting.astro`, `vs-hoopsalytics.astro`, `vs-once.astro`, `vs-kinovea.astro`, `vs-inbound-studio.astro`, `src/data/guides.ts`, `src/data/pageDates.ts`. Keep the `/shot-chart/` URL (people search for that term); change the copy where it names the tab to "Court map". Website repo: `/Users/kauredo/code/personal/basketball-video-analyzer/website`.
  - A callout label beside the selected dot (on the canvas board).
  - Pausing the main video while Stats plays a clip, which needs a `pause` method on `VideoPlayer`'s imperative handle.
  - Scrubbing in the detail player; the progress line is passive.
- Reviewer focus: the `onKeyDown` stop list on the dots (Tab and Escape must still pass), the legend total's definition (`filteredTotal` ignores location but applies all three filters), and that `onOpenClip` closes Stats before seeking so focus returns to the Stats button.

## Plan review

The first review asked for twelve fixes, and all of them are in this version. Two of its items let the planner choose, and I recorded the choice here:

- **Escape (item 3).** The review allowed either an `onClose` prop on `StatsDashboard` or `stopPropagation` in App's modal Escape handler. I took the App handler. It is one line, it covers every focusable element in Stats (tabs and filters as well as dots), and `StatsDashboard` stays unaware of the modal. App's scope widened to include that handler.
- **Open in main video with a missing game file (item 8).** The review offered "keep Stats open and show a toast" or "document what `handleClipSelect` does". I documented it and did not add a toast. `handleClipSelect` → `switchRecording` already shows the "Locate video" confirm and relinks the file. Keeping Stats open would put that confirm behind the modal. The one silent case is a clip that matches no recording, and the app never creates such a clip.
