# Plan 008: Shot chart — capture court position on clips, render per-player/category chart in Stats

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md`.
>
> **Drift check (run first)**:
> `cd app && git diff --stat 717500b..HEAD -- src/main/database.ts src/main/main.ts src/main/preload.ts src/types/global.d.ts src/renderer/components/ClipCreator.tsx src/renderer/components/StatsDashboard.tsx src/renderer/App.tsx`
> If any in-scope file changed since this plan was written, compare the
> "Current state" excerpts against the live code; on a mismatch, treat it as
> a STOP condition.

## Status

- **Priority**: P2
- **Effort**: L
- **Risk**: MED (schema migration + a param threaded through the IPC chain)
- **Depends on**: none. Plans 005/006/007 touch neighboring files — whatever
  lands first, re-run the drift check. Plan 006's maintenance note assigns the
  session-format follow-up to THIS plan's reviewer (see Maintenance notes).
- **Category**: direction (feature — turns tagged clips into scouting output)
- **Planned at**: app repo commit `717500b`, 2026-07-10

## Why this matters

Clips already carry category, player, and quarter — everything needed for a
shot chart except where the shot came from. A half-court click at tagging time
(one optional click) plus a chart tab in the existing Stats dashboard turns the
clip library into per-player scouting output ("where does #7 score from"),
which is the kind of artifact coaches share and other tools charge for. The
capture must stay optional so it never slows the core tagging loop.

## Current state

**App repo (`app/`).**

- Clips schema: `src/main/database.ts:649-665` (`createTables`), and the
  idempotent migration pattern to copy — `migrateClipColumns`
  (`database.ts:696-716`):
  ```ts
  const columns = db.prepare("PRAGMA table_info(clips)").all() as Array<{ name: string }>;
  const has = (name: string) => columns.some((col) => col.name === name);
  if (!has("players")) { db.exec("ALTER TABLE clips ADD COLUMN players TEXT DEFAULT '[]'"); ... }
  ```
- `Clip` interface `database.ts:56-71` (has `players?: string`,
  `quarter?: string | null`, etc.). A mirror interface exists in
  `src/types/global.d.ts` — find it and keep the two in sync.
- `createClip` (`database.ts:1249-1280`) — explicit 12-column INSERT:
  ```ts
  INSERT INTO clips (project_id, video_path, output_path, thumbnail_path, start_time,
    end_time, duration, title, categories, players, quarter, notes) VALUES (?, ... ?)
  ```
  Adding columns means extending BOTH the column list and the `stmt.run(...)`
  argument list, in order. `updateClip(id, updates: Partial<Clip>)` is at
  `database.ts:1282` — read it; if it builds its SET clause dynamically from
  `updates` keys, no change is needed there.
- IPC param chain for clip creation, `src/types/global.d.ts:64-75`:
  ```ts
  cutVideoClip: (params: {
    inputPath: string; startTime: number; endTime: number; title: string;
    categories: number[]; players?: number[]; quarter?: string | null;
    notes?: string; projectId: number; overlayImage?: string;
  }) => Promise<any>;
  ```
  Handler: `ipcMain.handle("cut-video-clip", ...)` at `src/main/main.ts:621`;
  it eventually calls `createClip(clipData)` near `main.ts:873`. Read the
  handler to see where params become `clipData` and thread the new fields the
  same way `quarter` flows.
- ClipCreator (`src/renderer/components/ClipCreator.tsx`): loads players (`:54`
  `const [players, setPlayers] = useState<Player[]>([]);`), has a quarter
  selector `role="group"` at `:426`, and passes `selectedPlayers` /
  `currentQuarter` into the create call around `:288-289`. Read the component
  before editing; add the court picker as a sibling section to the quarter
  selector.
- StatsDashboard (`src/renderer/components/StatsDashboard.tsx`, 239 lines):
  ```ts
  interface StatsDashboardProps { clips: Clip[]; categories: Category[]; videoDuration: number; }
  ```
  All aggregations are `useMemo`s (`flatCategories` `:45-52`, `summary`,
  `byCategory`, `byQuarter`, `distribution`). Mounted from
  `src/renderer/App.tsx:844-848`:
  ```tsx
  <StatsDashboard clips={clips} categories={categories} videoDuration={duration} />
  ```
  Styles: `src/renderer/styles/StatsDashboard.module.css` (design tokens,
  `var(--color-…)`).
- Players IPC: `window.electronAPI.getPlayers(projectId)` exists
  (`main.ts:1112`).
- Quick-tag path (`App.tsx:431-476`) creates clips with NO court position —
  by design (speed); do not add capture there.
- i18n: 11 locales, keys under `app`, en+pt below, translate the rest.
- **No court-position code exists anywhere** (verified by search) — you are
  adding the first.

## Commands you will need

| Purpose | Command | Expected on success |
|---|---|---|
| Install | `cd app && npm install` | exit 0 |
| Build (typecheck + bundle) | `cd app && npm run build` | exit 0 |
| Run app | `cd app && npm run dev` | app opens |

## Scope

**In scope**:
- `src/main/database.ts` (migration + interface + createClip; updateClip only if not dynamic)
- `src/main/main.ts` (cut-video-clip param threading)
- `src/main/preload.ts` (only if params are explicitly re-typed there — check)
- `src/types/global.d.ts`
- `src/renderer/components/Court.tsx` (create — shared SVG court)
- `src/renderer/components/ClipCreator.tsx`
- `src/renderer/components/StatsDashboard.tsx`
- `src/renderer/App.tsx` (pass `projectId` to StatsDashboard)
- `src/renderer/styles/Court.module.css` (create),
  `src/renderer/styles/StatsDashboard.module.css` (tab styles)
- `src/i18n/locales/*.json` (all 11)

**Out of scope** (do NOT touch):
- Quick-tag capture, Timeline, ClipLibrary, session format
  (`save-session`/`load-session`) and CSV export — session/CSV inclusion of
  court coords is explicitly deferred (see Maintenance notes).
- No charting library. The chart is the court SVG + positioned dots.
- Editing court position on existing clips after creation.

## Git workflow

- App repo: branch `feat/shot-chart` off `main` (past feature branches used
  `feat/…`). Conventional commits, one per logical step.
- Do NOT push or open a PR unless the operator instructed it.
- Do not mention AI tools in commit messages and do not add AI co-author lines.

## Data model (already decided — implement as stated)

Two nullable REAL columns on `clips`: `court_x`, `court_y`, normalized 0–1
relative to a half-court with **the baseline at the top**: `court_x` runs
left→right across the court width, `court_y` runs baseline→half-court line.
NULL means "no location recorded". Camel-case `courtX`/`courtY` in IPC params,
snake_case `court_x`/`court_y` on the DB row and `Clip` interface — exactly
like the existing `startTime`/`start_time` split.

## Steps

### Step 1: schema + createClip

In `database.ts`:
1. Extend `migrateClipColumns` with two more `has()` checks adding
   `court_x REAL` and `court_y REAL` (no defaults — NULL is correct).
2. Also add both columns to the canonical `CREATE TABLE clips` in
   `createTables` (`:649-665`) so fresh installs match migrated ones.
3. `Clip` interface: `court_x?: number | null; court_y?: number | null;`
   (mirror in `global.d.ts`'s Clip).
4. `createClip`: add the two columns to the INSERT list and
   `clip.court_x ?? null, clip.court_y ?? null` to `stmt.run`.
5. Read `updateClip` (`:1282`) — if it iterates `updates` keys dynamically,
   done; if it whitelists columns, add the two.

**Verify**: `cd app && npm run build` → exit 0. Then launch (`npm run dev`)
once and check the main-process console has no migration errors; quit.
`sqlite3` check if available:
`sqlite3 ~/Library/Application\ Support/basketball-video-analyzer/*.db "PRAGMA table_info(clips);" | grep court` → two rows (macOS path; skip if sqlite3 unavailable).

### Step 2: IPC threading

`global.d.ts` `cutVideoClip` params: add `courtX?: number | null; courtY?: number | null;`.
In `main.ts`'s `cut-video-clip` handler, thread the two into the `clipData`
passed to `createClip` (find where `quarter` is mapped and do the same:
`court_x: params.courtX ?? null`, `court_y: params.courtY ?? null`). Check
`preload.ts` — the invoke passthrough usually needs no change, but if the
params type is restated there, extend it.

**Verify**: `cd app && npm run build` → exit 0.

### Step 3: Court component

Create `src/renderer/components/Court.tsx` — a schematic half-court used by
both the picker and the chart:

```tsx
interface CourtProps {
  marker?: { x: number; y: number } | null;      // picker mode: current selection
  onSelect?: (pos: { x: number; y: number }) => void; // picker mode; omit = display-only
  children?: React.ReactNode;                     // chart mode: dot elements
}
```

- SVG `viewBox="0 0 500 470"`, `width="100%"`, baseline at top. Schematic, not
  regulation-exact: outer boundary rect; hoop `circle cx=250 cy=52 r=7.5`;
  backboard `line x1=220 y1=40 x2=280 y2=40`; paint `rect x=170 y=2 width=160
  height=190`; free-throw circle `circle cx=250 cy=192 r=60`; three-point
  corner lines `x=30` and `x=470` from `y=2` to `y=92`; arc
  `M 30 92 A 225 225 0 0 0 470 92` — render it and if the arc bulges toward
  the baseline instead of away, flip the sweep flag to `1`. All strokes
  `var(--text-secondary)`-ish via a CSS-module class; fill none; lines
  `strokeWidth 2`, `vectorEffect="non-scaling-stroke"`.
- Picker mode: when `onSelect` is set, the SVG gets a click handler converting
  the click to normalized coords (`getBoundingClientRect` math → x/500, y/470
  of the viewBox point — use `svg.getScreenCTM().inverse()` or manual ratio;
  manual ratio is fine since the viewBox fills the element), plus
  `role="button"` semantics on a transparent overlay `rect` with keyboard
  support NOT required (document: pointer-only input, the field is optional).
  Show `marker` as a crosshair circle.
- Display mode: renders `children` inside the same scaled coordinate space
  (children use viewBox units: `cx={x * 500} cy={y * 470}`).

**Verify**: `cd app && npm run build` → exit 0.

### Step 4: capture in ClipCreator

Read `ClipCreator.tsx` fully first. Add a "Shot location (optional)" section
after the quarter selector block (`:426` area): a collapsed-by-default
disclosure (`<button aria-expanded>` toggling local state) containing
`<Court marker={courtPos} onSelect={setCourtPos} />` and a small "Clear"
button (`setCourtPos(null)`). `const [courtPos, setCourtPos] = useState<{x:number;y:number}|null>(null);`
reset alongside the component's existing reset logic (find where
`selectedPlayers` resets). Pass `courtX: courtPos?.x ?? null, courtY: courtPos?.y ?? null`
into the create call at `:288-289`'s param object. Match the section styling
of the quarter selector (same CSS module patterns, focus-visible rings,
i18n labels).

**Verify**: `cd app && npm run build` → exit 0.

### Step 5: chart tab in StatsDashboard

1. `App.tsx:844-848`: add `projectId={currentProject?.id}` to the
   StatsDashboard element; extend the props interface accordingly
   (`projectId?: number`).
2. StatsDashboard: add a two-tab toggle at the top — `t("app.stats.tabOverview")`
   / `t("app.stats.tabShotChart")` — buttons with `aria-pressed`, existing
   button styling patterns from the file's CSS module. Overview tab = current
   content unchanged.
3. Shot-chart tab:
   - Load players once: `useEffect` → `window.electronAPI.getPlayers(projectId)`
     when `projectId` set; store in state.
   - Filters row: three `<select>`s — player (All + each player), quarter
     (All, Q1–Q4, OT + any custom values found in clips), category (All +
     `flatCategories`). Each with a visible `<label>` or `aria-label`.
   - `const located = clips.filter(c => c.court_x != null && c.court_y != null)`
     then apply filters (players/categories parse the JSON TEXT columns —
     reuse the `parseCategoryIds` pattern `:16-23` for a `parsePlayerIds`).
   - Render `<Court>` with a dot per clip:
     `<circle cx={c.court_x * 500} cy={c.court_y * 470} r={8} fill={categoryColor} fillOpacity={0.85}><title>{c.title}</title></circle>`
     where `categoryColor` = color of the clip's first category from
     `flatCategories` (fallback `var(--color-primary)`).
   - Below the court: `t("app.stats.unlocatedCount", { count: clips.length - located.length })`
     when > 0, and an empty-state message when `located.length === 0`
     (pattern: the existing empty state at `:138`).

**Verify**: `cd app && npm run build` → exit 0.

### Step 6: i18n (all 11 locales)

New keys — en / pt:
- `app.clips.shotLocation` — "Shot location (optional)" / "Localização do lançamento (opcional)"
- `app.clips.clearLocation` — "Clear location" / "Limpar localização"
- `app.stats.tabOverview` — "Overview" / "Resumo"
- `app.stats.tabShotChart` — "Shot chart" / "Mapa de lançamentos"
- `app.stats.filterPlayer` — "Player" / "Jogador"
- `app.stats.filterQuarter` — "Quarter" / "Período"
- `app.stats.filterCategory` — "Category" / "Categoria"
- `app.stats.allOption` — "All" / "Todos"
- `app.stats.unlocatedCount` — "{{count}} clip(s) have no location" / "{{count}} clipe(s) sem localização"
- `app.stats.noLocatedClips` — "No clips with a shot location yet. Set one in the clip editor." / "Ainda não há clipes com localização. Defina-a no editor de clipes."

Translate into the other 9 locales; verify with the parity script (plan 001
Step 7).

### Step 7: manual verification

`npm run dev`:
1. Create a clip via ClipCreator with a court click → row has court_x/court_y
   (check via the chart, or sqlite3).
2. Create one WITHOUT location → chart's unlocated count increments; no errors.
3. Stats → Shot chart: dots where clicked (baseline at top matches where you
   clicked in the picker), colored by category; filters narrow correctly;
   tooltips show titles.
4. Quick-tag still works and never asks for a location.
5. Old project created before this change opens fine (migration ran, NULLs).

## Test plan

No test framework. Step 7 is the gate — report each item. Evidence to include:
a screenshot or a described dot-position check (picker click top-left → dot
top-left of chart).

## Done criteria

- [ ] `cd app && npm run build` exits 0
- [ ] `grep -n "court_x" src/main/database.ts` shows: migration, CREATE TABLE, interface, createClip
- [ ] `grep -n "courtX" src/types/global.d.ts src/main/main.ts` shows the threaded param
- [ ] `Court.tsx` exists and is used by BOTH ClipCreator and StatsDashboard
- [ ] i18n: 10 new keys in all 11 locales
- [ ] Step 7 manual pass performed (or explicitly reported as not run)
- [ ] No files outside the in-scope list are modified (`git status`)
- [ ] `plans/README.md` status row updated

## STOP conditions

Stop and report back if:

- `updateClip` requires column whitelisting AND touching it breaks other
  callers (read its call sites before changing).
- The `cut-video-clip` handler's param→clipData mapping is materially
  different from the `quarter` pattern (e.g. params validated against a
  schema that rejects unknown keys).
- ClipCreator's structure has drifted so the quarter-selector anchor
  (`:426`) doesn't exist.
- You're tempted to add a charting library or capture position in quick-tag —
  both out of scope by decision.

## Maintenance notes

- Session format & CSV: court coords are NOT in the v2 session format or the
  CSV export. When this plan lands, file the follow-up (session v3 + two CSV
  columns) — plan 006 established the versioning pattern to copy.
- The chart colors by *first* category; clips with multiple categories could
  be revisited (e.g. made/missed pairs) — deferred until real usage shows how
  coaches categorize shots.
- Retro-editing a clip's location (in ClipLibrary's edit flow) is the obvious
  next ask; `updateClip` + Court picker make it small once this lands.
- The court is schematic. If a regulation FIBA/NBA-accurate court is ever
  wanted, only `Court.tsx`'s SVG internals change — coordinates stay
  normalized 0–1.
