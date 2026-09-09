# Plan 039: Make the clip list editable after the cut, as an opt-in table view

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report, do not improvise. When done, update the status row for this plan
> in `plans/README.md`, unless a reviewer dispatched you and told you they
> maintain the index.
>
> **Drift check (run first)**:
> `git diff --stat 728c7b4..HEAD -- src/main/database.ts src/renderer/components/ClipLibrary.tsx src/types/global.d.ts src/renderer/utils/storage.ts src/i18n/locales`
> If any of those changed since this plan was written, compare the
> "Current state" excerpts against the live code before proceeding; on a
> mismatch, treat it as a STOP condition.

## Status

- **Priority**: P1
- **Effort**: L
- **Risk**: MED (adds a column to `clips` and the first renderer caller of `updateClip`)
- **Depends on**: none
- **Repo**: `app` (`kauredo/basketball-video-analyzer`)
- **Category**: direction
- **Planned at**: commit `728c7b4`, 2026-09-08

## Why this matters

Today a clip is frozen the moment it is cut. `ClipLibrary` renders cards with
exactly two actions, Play and Delete, so a coach who mistypes a title, tags the
wrong category, or wants to add a note after watching the cut has to delete the
clip and cut it again. A competitor tool solves this with a spreadsheet of the
clips sitting next to the player: 48 rows, editable in place, multi-select, with
rows tinted by a keep-or-cut status. A coach who saw both said that listing is
simpler than what this app does.

The backend for editing already exists and has never been called. `updateClip`
runs from `src/main/database.ts:1356` through the `update-clip` IPC handler at
`src/main/main.ts:1334`, is bridged at `src/main/preload.ts:218`, and is typed at
`src/types/global.d.ts:144`. `grep -rn "updateClip" src/renderer/` returns
nothing. This plan is what finally uses it.

After this lands: a coach toggles the clip library to a table, fixes a title by
clicking it, retags three clips at once, and marks the ones worth showing the
team with a keep status. The card grid stays the default and stays untouched.

## Current state

### Files in play

- `src/main/database.ts`: SQLite access. Schema for `clips` at line 677, the
  idempotent column migration `migrateClipColumns()` at line 728, and
  `updateClip()` at line 1356.
- `src/main/main.ts`: IPC handlers. `update-clip` at line 1334, `delete-clip`
  just below it. No new handler is needed.
- `src/types/global.d.ts`: the shared `Clip` interface at line 28 and the
  `ElectronAPI` surface, `updateClip` at line 144.
- `src/renderer/components/ClipLibrary.tsx`: ~980 lines. Owns clip loading,
  filtering, sorting, export, and the card grid. Declares its **own** local
  `Clip` interface at line 57, duplicating the one in `global.d.ts`.
- `src/renderer/utils/storage.ts`: `STORAGE_KEYS` / `loadPref` / `savePref`,
  backed by `localStorage`. This is how the existing sort preference persists.
- `src/renderer/styles/variables.css`: the design tokens. Read the comments,
  they carry constraints (see "Design constraints" below).
- `src/i18n/locales/*.json`: eleven locale files.

### The clips schema, `src/main/database.ts:677`

```sql
CREATE TABLE IF NOT EXISTS clips (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  project_id INTEGER NOT NULL,
  video_path TEXT NOT NULL,
  output_path TEXT NOT NULL,
  thumbnail_path TEXT,
  start_time REAL NOT NULL,
  end_time REAL NOT NULL,
  duration REAL NOT NULL,
  title TEXT NOT NULL,
  categories TEXT NOT NULL,
  players TEXT DEFAULT '[]',
  quarter TEXT,
  court_x REAL,
  court_y REAL,
  notes TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (project_id) REFERENCES projects (id) ON DELETE CASCADE
)
```

`categories` and `players` hold JSON arrays of ids as TEXT, not relations.

### The migration pattern to copy, `src/main/database.ts:726-754`

```ts
// Idempotent migration: add players/quarter columns to pre-existing clips tables.
// SQLite backfills existing rows with the column default ('[]' / NULL).
const migrateClipColumns = () => {
  try {
    const columns = db.prepare("PRAGMA table_info(clips)").all() as Array<{
      name: string;
    }>;
    const has = (name: string) => columns.some((col) => col.name === name);

    if (!has("players")) {
      db.exec("ALTER TABLE clips ADD COLUMN players TEXT DEFAULT '[]'");
      console.log("Added players column to clips");
    }
    // ...quarter, court_x, court_y follow the same shape
  } catch (error) {
    console.error("Error migrating clip columns:", error);
  }
};
```

It is called from the init path at `src/main/database.ts:110`.

### `updateClip` as it stands, `src/main/database.ts:1356`

```ts
export const updateClip = (id: number, updates: Partial<Clip>): void => {
  try {
    const fields = Object.keys(updates).filter(
      (key) => key !== "id" && key !== "created_at",
    );
    const setClause = fields.map((field) => `${field} = ?`).join(", ");
    const values = fields.map((field) => updates[field as keyof Clip]);

    const stmt = db.prepare(`UPDATE clips SET ${setClause} WHERE id = ?`);
    stmt.run(...values, id);
  } catch (error) {
    console.error("Error updating clip:", error);
    throw error;
  }
};
```

Two defects that have never mattered because nothing calls it, and start
mattering in step 2 of this plan. Field names are interpolated into the SQL
string straight from an object that arrives over IPC from the renderer, so any
key the renderer sends becomes SQL. And an empty `updates` object builds
`UPDATE clips SET  WHERE id = ?`, which throws a syntax error rather than doing
nothing.

### The local Clip interface, `src/renderer/components/ClipLibrary.tsx:57`

```ts
interface Clip {
  id: number;
  video_path: string;
  output_path: string;
  thumbnail_path?: string;
  start_time: number;
  end_time: number;
  duration: number;
  title: string;
  categories: string; // JSON array of category IDs
  players?: string; // JSON array of player IDs
  quarter?: string | null;
  notes?: string;
  created_at: string;
}
```

This duplicates `src/types/global.d.ts:28`. **Both need the new field. Do not
merge them into one type**, that refactor is out of scope for this plan.

### The preference pattern, `src/renderer/utils/storage.ts`

```ts
export const STORAGE_KEYS = {
  SIDE_PANEL_WIDTH: "sidePanelWidth",
  // ...
  CLIP_SORT_BY: "clipSortBy",
  CLIP_SORT_ORDER: "clipSortOrder",
  // ...
} as const;
```

Read with `loadPref(KEY, fallback)`, written with `savePref(KEY, value)`. Both
swallow their own errors. `ClipLibrary.tsx:106-107` shows the read-in-useState
idiom to copy:

```ts
const [sortBy, setSortBy] = useState<"date" | "duration" | "title">(
  () => loadPref(STORAGE_KEYS.CLIP_SORT_BY, "date") as "date" | "duration" | "title");
```

### The header the toggle goes into, `ClipLibrary.tsx:473-489`

```tsx
<div className={styles.libraryActions}>
  <button type="button" onClick={() => setShowPresent(true)}
    disabled={sortedClips.length === 0} className={styles.presentBtn}>
    <FontAwesomeIcon icon={faPlayCircle} /> {t("app.present.present")}
  </button>
  <button type="button" onClick={openClipFolder} className={styles.folderBtn}>
    <FontAwesomeIcon icon={faFolder} /> {t("app.clips.openFolder")}
  </button>
  <div className={styles.exportDropdown} ref={exportMenuRef}>
```

### The card grid this table sits beside, `ClipLibrary.tsx:819`

```tsx
{/* Clips Grid */}
<div className={styles.clipsGrid}>
  {sortedClips.length === 0 ? ( /* empty state */ ) : (
    sortedClips.map(clip => { /* ...clipCard... */ })
  )}
</div>
```

`sortedClips` (line 165) is derived from `filteredClips` (line 144), which
applies the search term, the category filter and the player filter. The table
consumes `sortedClips` unchanged, so filters and search keep working in both
views for free.

### Repo conventions to match

- **CSS Modules with design tokens.** One `.module.css` per component in
  `src/renderer/styles/`. No hardcoded colours, spacing, or radii, every value
  comes from `variables.css`. `color-mix(in srgb, var(--token) N%, transparent)`
  is established, see `ContextualHint.module.css:8` and
  `ProjectSelector.module.css:278`.
- **Toasts and confirms, never `alert`/`confirm`.** `useToastContext()` gives
  `showSuccess / showError / showWarning / showInfo`; `useConfirm()` gives
  `confirm({ message, danger })`. Both are already imported in `ClipLibrary.tsx`
  (lines 27-28). `handleDeleteClip` at line 224 is the exemplar.
- **Errors.** `withCause(t("..."), error)` from `../utils/errors` wraps a
  translated message with the underlying cause. See `ClipLibrary.tsx:216`.
- **Accessibility is enforced by prior plans (022, 024).** Every interactive
  element takes `:focus-visible` with `var(--focus-ring)`; every icon-only
  button takes an `aria-label`.
- **Semantic table markup exists already**: `ShortcutsModal.tsx:67` uses a real
  `<table>`/`<tbody>`/`<tr>`/`<td>`. Follow that, do not build a div grid.

### Design constraints, quoted from `src/renderer/styles/variables.css`

These are not suggestions, they were measured. Lines 37-45:

```css
--color-danger: #d32f2f; /* white reads 4.98:1 */
--color-danger-ink: #ef9a9a; /* 6.79:1 on --bg-quaternary */
--color-success: #2e7d32;
--color-success-dark: #1b5e20;
--color-warning: #ff9800; /* border and rail only, never behind text */
--color-warning-ink: #ffb74d; /* 8.45:1 on --bg-quaternary */
```

So: `--color-warning` may be a row rail or a border and must never sit behind
text. Status **text** takes the `-ink` variants. The accent is
`--color-primary: #0b7972` (line 6), and `--color-accent-ink` (line 15) is what
draws the accent as text, because `#0b7972` only reaches 2.78:1 on the app's
lightest ground.

Other tokens you will need: `--spacing-xs/sm/md/lg/xl` (lines 91-95),
`--radius-sm/md/lg` (all 1px by deliberate choice, lines 102-104),
`--button-height: 36px` (line 159), `--focus-ring-width` (line 177),
`--font-mono` (line 184), and the `--bg-primary` through `--bg-quaternary`
grounds. The light theme redefines these from line 192 down, so **never write a
raw hex**; a hardcoded colour will be wrong in one of the two themes.

### The eleven locales

`src/i18n/locales/{de,el,en,es,fr,it,lt,pt,sl,sr,tr}.json`. `en.json` is the
base. `npm run prebuild` runs `scripts/lint-locales.mjs` before every build, and
it exits 1 on:

- a key present in `en.json` and missing from any other locale, or the reverse
- differing `{{placeholder}}` sets between a locale and English
- a differing newline count
- an exclamation mark, in any language
- an em dash or en dash joining clauses (a numeric range such as `(1–4)` passes)
- a sentence-terminator shortfall against English that suggests a lost full stop

Existing clip keys live under `app.clips.*` in each file. Put the new ones under
`app.clips.table.*`.

## Commands you will need

| Purpose | Command | Expected on success |
|---|---|---|
| Install | `npm install` | exit 0 |
| Typecheck (fast gate) | `npx tsc --noEmit` | exit 0, no errors |
| Locale lint | `npm run lint:locales` | exit 0, no errors listed |
| Full build | `npm run build` | exit 0 (runs lint:locales, then tsc, then webpack) |
| Run the app | `npm run dev` | Electron window opens |

**There is no test suite in this repo.** `npm run build` is the verification
gate, and manual checks in `npm run dev` cover the rest. Do not add a test
framework as part of this plan.

## Scope

**In scope** (the only files you may modify or create):

- `src/main/database.ts` (migration + `updateClip` hardening)
- `src/types/global.d.ts` (the `Clip` interface)
- `src/renderer/utils/storage.ts` (one new storage key)
- `src/renderer/components/ClipLibrary.tsx` (view toggle, wiring, status filter)
- `src/renderer/components/ClipTable.tsx` (**create**)
- `src/renderer/styles/ClipTable.module.css` (**create**)
- `src/renderer/styles/ClipLibrary.module.css` (toggle button styles only)
- `src/i18n/locales/*.json` (all eleven)
- `plans/README.md` (status row, last step)

**Out of scope** (do not touch, even though they look related):

- `src/renderer/components/ClipCreator.tsx`. Tagging at cut time keeps working
  exactly as it does; this plan adds editing after the cut, it does not move the
  tagging step.
- The card grid markup and `.clipCard*` styles in `ClipLibrary.module.css`. The
  grid is the default view and must render identically after this change.
- `src/main/main.ts`. `update-clip` and `delete-clip` already do what this plan
  needs. Adding a bulk IPC handler is not warranted for a project of tens of
  clips; the renderer loops the existing calls.
- Merging the duplicated `Clip` interfaces. Add the field to both, leave the
  duplication.
- `PresentMode.tsx`, `StatsDashboard.tsx`, the export paths.
- **Manual clip ordering / drag-to-reorder, duplicating a clip, and re-trimming
  a clip's in and out points.** These were considered and deliberately deferred;
  see "Maintenance notes". Do not build them, do not add schema for them.
- A `Diag` / diagram-indicator column. Annotations are keyed to a timestamp in
  the source video, not to a clip id (`src/main/database.ts:698`), so showing
  one per row needs a join that does not exist yet.

## Git workflow

- Branch: `feat/editable-clip-table`, cut from `main`.
- Conventional commits, one per step or logical unit. Recent examples from
  `git log --oneline -5`. Prefix `feat:` for the feature steps, `fix:` for the
  `updateClip` hardening.
- **Never mention AI tooling in a commit message, and never add an AI
  co-author line.**
- Do not push or open a PR unless the operator asked for it.

## Steps

### Step 1: Add the `status` column and thread the type through

1. In `src/main/database.ts`, inside `migrateClipColumns()` (line 728), add a
   fourth block matching the existing three:

   ```ts
   if (!has("status")) {
     db.exec("ALTER TABLE clips ADD COLUMN status TEXT");
     console.log("Added status column to clips");
   }
   ```

   NULL means "no status". Do not give the column a default.

2. Add `status TEXT` to the `CREATE TABLE IF NOT EXISTS clips` statement at line
   677, after `notes TEXT`, so a fresh install and a migrated one end up with
   the same schema.

3. Add the field to the `Clip` interface in `src/types/global.d.ts:28`, after
   `notes`:

   ```ts
   /** Review state a coach sets after watching the cut. null = unset. */
   status?: "keep" | "cut" | "review" | null;
   ```

4. Add the identical field to the local `Clip` interface in
   `src/renderer/components/ClipLibrary.tsx:57`.

**Verify**: `npx tsc --noEmit` → exit 0.

**Verify**: `npm run dev`, open a project that already has clips, confirm they
still load and the console prints `Added status column to clips` exactly once.
Quit and relaunch, confirm it does not print again.

### Step 2: Harden `updateClip` before the renderer can reach it

In `src/main/database.ts`, replace the body of `updateClip` (line 1356) so it
allowlists the columns a caller may set. Keep the exported signature identical.

```ts
/**
 * Columns the renderer may set. `updateClip` interpolates field names into the
 * SQL string, and its `updates` argument arrives over IPC, so the set of names
 * that can reach the query has to be closed here rather than trusted.
 */
const UPDATABLE_CLIP_COLUMNS = [
  "title",
  "categories",
  "players",
  "quarter",
  "notes",
  "status",
  "court_x",
  "court_y",
] as const;

export const updateClip = (id: number, updates: Partial<Clip>): void => {
  try {
    const fields = Object.keys(updates).filter((key) =>
      (UPDATABLE_CLIP_COLUMNS as readonly string[]).includes(key),
    );
    if (fields.length === 0) return;

    const setClause = fields.map((field) => `${field} = ?`).join(", ");
    const values = fields.map((field) => updates[field as keyof Clip]);

    const stmt = db.prepare(`UPDATE clips SET ${setClause} WHERE id = ?`);
    stmt.run(...values, id);
  } catch (error) {
    console.error("Error updating clip:", error);
    throw error;
  }
};
```

`start_time`, `end_time`, `duration`, `output_path` and `thumbnail_path` are
deliberately absent: changing any of them without re-cutting the file would put
the row out of step with the video on disk, which is the re-trim work this plan
defers.

**Verify**: `npx tsc --noEmit` → exit 0.

**Verify**: `grep -n "UPDATABLE_CLIP_COLUMNS" src/main/database.ts` → 2 matches
(the declaration and the filter).

### Step 3: Add the i18n keys to all eleven locales

Add this block under `app.clips` in `src/i18n/locales/en.json`:

```json
"table": {
  "viewGrid": "Cards",
  "viewTable": "Table",
  "columnTitle": "Clip",
  "columnCategory": "Category",
  "columnNotes": "Notes",
  "columnDuration": "Length",
  "columnStatus": "Status",
  "selectRow": "Select {{title}}",
  "selectAll": "Select all clips",
  "editTitle": "Edit title",
  "editNotes": "Edit notes",
  "editCategories": "Edit categories",
  "notesPlaceholder": "Add a note",
  "noNotes": "No note",
  "noCategories": "No category",
  "selectedCount": "{{count}} selected",
  "clearSelection": "Clear selection",
  "bulkDelete": "Delete",
  "bulkCategory": "Set category",
  "bulkStatus": "Set status",
  "confirmBulkDelete": "Delete {{count}} clips and their video files. This cannot be undone.",
  "bulkDeleteSuccess": "Deleted {{count}} clips",
  "bulkUpdateSuccess": "Updated {{count}} clips",
  "bulkPartialFailure": "Updated {{done}} of {{total}} clips, {{failed}} failed",
  "saveError": "Could not save the change",
  "statusNone": "None",
  "statusKeep": "Keep",
  "statusCut": "Cut",
  "statusReview": "Review",
  "filterByStatus": "Filter by status"
}
```

Then translate the same block into the other ten files, in the same position, so
key parity holds. Rules the linter enforces and will fail the build over:

- No exclamation marks in any language.
- No em dash or en dash joining clauses.
- Keep every `{{placeholder}}` exactly as it appears in English.
- Keep the sentence count. `confirmBulkDelete` is two sentences in English, so
  it should be two in each translation unless the language genuinely merges
  them.
- Match the register each file already uses. `pt` is informal (`o teu`,
  `Seleciona`), `es` is informal (`tú`, `Selecciona`), and the linter checks
  `pt`, `es`, `fr`, `it`, `de`. Read a few neighbouring strings in the file you
  are editing and match them.

**Verify**: `npm run lint:locales` → exit 0, no errors listed.

**Verify**:
`node -e "for (const l of ['de','el','en','es','fr','it','lt','pt','sl','sr','tr']) { const k = Object.keys(require('./src/i18n/locales/'+l+'.json').app.clips.table); console.log(l, k.length); }"`
→ eleven lines, every one reading `30`.

### Step 4: Add the view-mode preference and the header toggle

1. In `src/renderer/utils/storage.ts`, add to `STORAGE_KEYS`, after
   `CLIP_SORT_ORDER`:

   ```ts
   CLIP_VIEW_MODE: "clipViewMode",
   ```

2. In `ClipLibrary.tsx`, beside the existing sort state (line 106):

   ```ts
   const [viewMode, setViewMode] = useState<"grid" | "table">(
     () => loadPref(STORAGE_KEYS.CLIP_VIEW_MODE, "grid") as "grid" | "table");

   const changeViewMode = (mode: "grid" | "table") => {
     setViewMode(mode);
     savePref(STORAGE_KEYS.CLIP_VIEW_MODE, mode);
   };
   ```

   **`"grid"` is the fallback.** The card grid stays the default view for every
   existing user and every fresh install.

3. Render a two-button segmented control as the first child of
   `<div className={styles.libraryActions}>` (line 473), before the Present
   button. Use `faTableCells` for the grid and `faList` for the table from
   `@fortawesome/free-solid-svg-icons` (`faTable` is already imported at line
   22 and used by the export menu, pick names that do not collide). Each button
   carries `aria-pressed={viewMode === "grid"}` / `"table"` and a visible label
   from `t("app.clips.table.viewGrid")` / `t("app.clips.table.viewTable")`.

4. Style `.viewToggle` and `.viewToggleBtn` in `ClipLibrary.module.css` next to
   the existing `.presentBtn` rules, reusing that button's tokens. The pressed
   button takes `background: var(--color-primary)` with `var(--text-white)`.
   Both take `:focus-visible { outline: var(--focus-ring); }` matching the
   file's other buttons.

5. Swap the render at line 819: keep `<div className={styles.clipsGrid}>` and
   its contents for `viewMode === "grid"`, and render `<ClipTable ... />` for
   `viewMode === "table"`. The empty state stays shared, above the branch.

**Verify**: `npx tsc --noEmit` → exit 0.

**Verify**: `npm run dev`, toggle to Table and back, quit the app, relaunch.
The view you left it on is the one it opens with. Delete the key in DevTools
(`localStorage.removeItem("clipViewMode")`), reload, confirm it opens on Cards.

### Step 5: Build `ClipTable` as a read-only table first

Create `src/renderer/components/ClipTable.tsx`. Get it rendering correctly
before adding any editing, so a regression in step 6 is easy to localise.

Props:

```tsx
interface ClipTableProps {
  clips: Clip[];                 // already filtered and sorted by ClipLibrary
  categories: Category[];        // flat list, for name and colour lookup
  onPlay: (outputPath: string) => void;
  onUpdate: (id: number, updates: Partial<Clip>) => Promise<void>;
  onDeleteMany: (ids: number[]) => Promise<void>;
}
```

Export the `Clip` and `Category` interfaces from `ClipLibrary.tsx` and import
them here rather than declaring a third copy.

Markup: a real `<table>` following `ShortcutsModal.tsx:67`. Columns in order:
select checkbox, title, category, notes, length, status, play. Header cells are
`<th scope="col">`. The three sortable headers (title, length, and the created
date if you surface it) call the `toggleSort` handler `ClipLibrary` already owns
at line 187, passed down, and carry
`aria-sort={sortBy === field ? (sortOrder === "asc" ? "ascending" : "descending") : "none"}`.

Cells:

- **Title**: the clip title, plain text for now.
- **Category**: the clip's categories as coloured pills. Reuse the existing
  lookup: parse `clip.categories` as a JSON id array, resolve against
  `categories`, and colour each pill with the category's own `color` plus
  `inkOn(color)` from `../utils/contrast` for the text. `ClipLibrary.tsx:875-887`
  is the working example. `inkOn` picks black or white per colour, which is what
  keeps a coach-chosen colour readable, so do not substitute a fixed foreground.
- **Notes**: `clip.notes` or a muted `t("app.clips.table.noNotes")`.
- **Length**: `formatTime(clip.end_time - clip.start_time)`, drawn in
  `var(--font-mono)` so the column aligns. Lift `formatTime`
  (`ClipLibrary.tsx:200`) into `src/renderer/utils/` **only if** you need it in
  both files; otherwise pass it as a prop. Do not duplicate it.
- **Status**: read-only text for now, from the `statusKeep` / `statusCut` /
  `statusReview` keys, or the `statusNone` label when `clip.status` is null.
- **Play**: an icon button, `faPlay`, with
  `aria-label={t("app.clips.playClip")}`.

Create `src/renderer/styles/ClipTable.module.css`. Requirements:

- Dense rows. `padding: var(--spacing-xs) var(--spacing-sm)` on cells, row
  height around 32px, so 20+ rows are visible at once. That density is the
  point of the view.
- A sticky header: `position: sticky; top: 0;` on `thead th`, with
  `background: var(--bg-tertiary)` and a `z-index` below `--z-toast`.
- The table scrolls inside its own container, never the page.
- Row hover uses `var(--bg-quaternary)`. Zebra striping is not needed and the
  status rails in step 8 read better without it.
- Long titles and notes truncate with `text-overflow: ellipsis`, with the full
  value in a `title` attribute.
- Every colour, space, and radius from a token. No raw hex.

**Verify**: `npx tsc --noEmit` → exit 0.

**Verify**: `npm run dev` with a project of at least five clips. In Table view,
every clip in the card grid appears as one row, the category pills carry the
same colours the cards show, search and the category filter narrow the table the
same way they narrow the grid, and the sort buttons reorder the rows.

**Verify**: Tab through the table. Every button shows a visible focus ring.

### Step 6: Inline editing for title and notes

In `ClipTable.tsx`, hold one `editing` state, not one per row:

```ts
const [editing, setEditing] = useState<{ id: number; field: "title" | "notes" } | null>(null);
const [draft, setDraft] = useState("");
```

Behaviour:

- Clicking a title or notes cell swaps it for an `<input type="text">`,
  autofocused, seeded with the current value.
- Enter or blur commits: call `onUpdate(clip.id, { [field]: draft })`, then clear
  `editing`.
- Escape cancels without saving.
- Committing an unchanged value is a no-op, skip the call entirely.
- An empty title is rejected. Titles are how a clip is identified in the export
  filenames, so revert to the previous value rather than saving `""`. Notes may
  be emptied.
- Each cell is a `<button>` or carries `tabIndex={0}` with an Enter/Space
  handler, so the table is editable from the keyboard. The `ProjectSelector`
  cards (`ProjectSelector.tsx`) show the established pattern for making a
  non-button element operable.

In `ClipLibrary.tsx`, implement `handleUpdateClip` and pass it as `onUpdate`:

```ts
const handleUpdateClip = async (id: number, updates: Partial<Clip>) => {
  try {
    await window.electronAPI.updateClip(id, updates);
    setClips(prev => prev.map(c => (c.id === id ? { ...c, ...updates } : c)));
  } catch (error) {
    console.error("Error updating clip:", error);
    showError(withCause(t("app.clips.table.saveError"), error));
    await loadData();
  }
};
```

Update local state directly on success rather than calling `loadData()`. A full
reload on every keystroke-commit would refetch clips, categories and players
over IPC and make the table feel slow. The `loadData()` in the catch resyncs
after a failure, so the row never shows a value the database rejected.

**Verify**: `npx tsc --noEmit` → exit 0.

**Verify**: `npm run dev`. Rename a clip, press Enter, quit the app entirely,
relaunch, and confirm the new title is there. Do the same with a note. Press
Escape mid-edit and confirm the old value returns. Clear a title and press
Enter, confirm it reverts.

### Step 7: Category editing per row

Clicking the category cell opens a popover listing the project's categories with
checkboxes, reflecting the clip's current ids. Toggling one writes the whole
array back:

```ts
onUpdate(clip.id, { categories: JSON.stringify(nextIds) });
```

- Build the list from the `categories` prop. `ClipLibrary` fetches them with
  `getCategoriesHierarchical`, so entries may carry a `children` array; flatten
  parents and children into one list and indent the children by one step.
- Close the popover on Escape and on an outside click. `useDismissableMenu`
  (`../hooks/useDismissableMenu`, already used for the export menu at
  `ClipLibrary.tsx:113`) does both. Use it, do not write a new click-outside
  handler.
- The popover needs `role="dialog"` or `role="menu"` and a label from
  `t("app.clips.table.editCategories")`.
- A clip with no categories is valid, `[]` saves fine.

**Verify**: `npx tsc --noEmit` → exit 0.

**Verify**: `npm run dev`. Add a category to a clip, close the popover, switch
to Cards view, and confirm the card shows the new pill. Switch to the category
filter for that category and confirm the clip now appears under it.

### Step 8: The status column, the row rail, and the status filter

1. **Per-row control.** The status cell holds a `<select>` with four options:
   `statusNone` (value `""`), `statusKeep`, `statusCut`, `statusReview`.
   Changing it calls `onUpdate(clip.id, { status: value || null })`. It needs
   `aria-label={t("app.clips.table.columnStatus")}`. A native select is the
   right control here: it is keyboard-operable and screen-reader-labelled with
   no work, and four fixed options do not justify a custom popover.

2. **Row tint.** In `ClipTable.module.css`:

   ```css
   .rowKeep   { border-left: 3px solid var(--color-success); background: color-mix(in srgb, var(--color-success) 8%, transparent); }
   .rowCut    { border-left: 3px solid var(--color-danger);  background: color-mix(in srgb, var(--color-danger) 8%, transparent); }
   .rowReview { border-left: 3px solid var(--color-warning); background: color-mix(in srgb, var(--color-warning) 8%, transparent); }
   ```

   A rail plus a faint wash, not a saturated fill.
   `variables.css:43` says `--color-warning` is "border and rail only, never
   behind text", and an 8% wash keeps every cell's text on essentially the
   app's own ground. Status text, if you draw any, takes `--color-warning-ink`
   / `--color-danger-ink`, never the base token.

   Colour is not the only signal: the select in the status cell states the value
   in words, so a coach who cannot distinguish the rails still reads the status.

3. **Status filter.** In `ClipLibrary.tsx`, add
   `const [selectedStatus, setSelectedStatus] = useState<string | null>(null);`
   and one more clause in the `filteredClips` memo (line 144):

   ```ts
   const matchesStatus = !selectedStatus || clip.status === selectedStatus;
   ```

   Render the filter as a row of buttons in the existing
   `.categoryFilterSection` pattern (`ClipLibrary.tsx:695-728` is the player
   filter, copy its shape), labelled `t("app.clips.table.filterByStatus")`.
   Show it in both views, the status is real data whichever way the clips are
   drawn.

**Verify**: `npx tsc --noEmit` → exit 0.

**Verify**: `npm run dev`. Set one clip to Keep and one to Cut, confirm the two
rails differ, filter to Keep and confirm only that clip shows. Relaunch the app
and confirm both statuses persisted.

**Verify**: Switch to the light theme and confirm both rails and both washes are
still visible and no text lost contrast.

**Verify**: `grep -nE "#[0-9a-fA-F]{3,6}" src/renderer/styles/ClipTable.module.css`
→ no matches.

### Step 9: Multi-select and the bulk toolbar

1. **Selection state** in `ClipTable.tsx`:
   `const [selected, setSelected] = useState<Set<number>>(new Set());`

   - A checkbox per row, `aria-label={t("app.clips.table.selectRow", { title: clip.title })}`.
   - A header checkbox selecting or clearing every currently visible row,
     `aria-label={t("app.clips.table.selectAll")}`, with `indeterminate` set via
     a ref when the selection is partial.
   - Shift-click on a row checkbox selects the range from the last clicked row.
     Track the last index in a ref.
   - **Prune the selection when `clips` changes.** After a filter change or a
     delete, drop ids that are no longer in `clips`, otherwise a bulk action
     fires on rows the coach cannot see. Do this in a `useEffect` on `clips`.

2. **Bulk toolbar**, rendered above the table only when the selection is not
   empty. It shows `t("app.clips.table.selectedCount", { count })` and three
   actions: Delete, Set category, Set status. Plus a Clear button.

3. **Bulk delete.** Confirm first with the shared dialog:

   ```ts
   if (!(await confirm({
     message: t("app.clips.table.confirmBulkDelete", { count: ids.length }),
     danger: true,
   }))) return;
   ```

   Then in `ClipLibrary.tsx`:

   ```ts
   const handleDeleteMany = async (ids: number[]) => {
     const results = await Promise.allSettled(
       ids.map(id => window.electronAPI.deleteClip(id)));
     const failed = results.filter(r => r.status === "rejected").length;
     if (failed > 0) {
       showWarning(t("app.clips.table.bulkPartialFailure", {
         done: ids.length - failed, total: ids.length, failed }));
     } else {
       showSuccess(t("app.clips.table.bulkDeleteSuccess", { count: ids.length }));
     }
     await loadData();
   };
   ```

   `Promise.allSettled`, not `Promise.all`: one clip whose file has already been
   moved off disk must not abort the other 19 deletes. Report the partial
   result rather than claiming success. Bulk update follows the same shape
   against `updateClip` and reports with `bulkUpdateSuccess`.

4. Deleting a clip deletes its video file (`delete-clip` in `main.ts` removes
   the file), which is why the confirm text says so and why `danger: true`.

**Verify**: `npx tsc --noEmit` → exit 0.

**Verify**: `npm run dev` with at least six clips. Select three with the header
checkbox and clear one. Shift-click a range. Set all three to Review in one
action and confirm three rails appear. Bulk delete two, confirm the toast counts
two and both rows are gone after the reload.

**Verify**: Apply a category filter while rows are selected, and confirm the
selection drops the rows that filtered out.

### Step 10: Full build and a11y sweep

1. `npm run build` → exit 0. This runs the locale linter, then `tsc`, then
   webpack. Fix anything it reports.
2. Tab through the whole table with the keyboard only: the toggle, the select
   all, a row checkbox, a title cell, the category popover, the status select,
   the play button, the bulk toolbar. Every stop shows a visible focus ring, and
   nothing is reachable only by mouse.
3. Confirm the card grid is byte-for-byte unchanged in behaviour: cards render,
   Play works, Delete works, export works, Present works.
4. `git status` → only the in-scope files are modified.

**Verify**: `npm run build` → exit 0.

**Verify**: `git status --short` lists only files from the In scope list.

## Test plan

This repo has no test suite and this plan does not add one. Verification is the
build gate plus the manual checks in each step. Before calling the work done,
run this sequence in `npm run dev` against a project with at least six clips
across two categories:

1. Toggle Cards to Table and back. Both render the same clips.
2. Rename a clip in the table, relaunch the app, the name persisted.
3. Empty a title and commit, it reverts rather than saving blank.
4. Edit a note, relaunch, it persisted.
5. Add and remove a category, check the change shows on the card in Cards view.
6. Set Keep on one clip and Cut on another, check the two rails differ, in both
   the dark and the light theme.
7. Filter by status, only the matching clips show.
8. Select three rows, bulk-set a status, all three change.
9. Bulk delete two rows, the toast counts two, the files are gone from the clips
   folder.
10. Relaunch on an existing project created before this change, confirm the
    migration ran once and no clip lost data.

## Done criteria

All must hold:

- [ ] `npx tsc --noEmit` exits 0
- [ ] `npm run lint:locales` exits 0
- [ ] `npm run build` exits 0
- [ ] `grep -rn "updateClip" src/renderer/` returns at least one match (the
      backend path is finally used)
- [ ] `node -e "for (const l of ['de','el','en','es','fr','it','lt','pt','sl','sr','tr']) console.log(l, Object.keys(require('./src/i18n/locales/'+l+'.json').app.clips.table).length)"`
      prints `30` for all eleven
- [ ] `grep -nE "#[0-9a-fA-F]{3,6}" src/renderer/styles/ClipTable.module.css`
      returns no matches
- [ ] `loadPref(STORAGE_KEYS.CLIP_VIEW_MODE, "grid")` defaults to `"grid"`, so
      the card grid is what a fresh install opens on
- [ ] `git status --short` shows only files from the In scope list
- [ ] The ten manual checks in the test plan all pass
- [ ] The status row for plan 039 in `plans/README.md` is updated

## STOP conditions

Stop and report back, do not improvise, if:

- The drift check shows `src/main/database.ts` or `ClipLibrary.tsx` changed
  since `728c7b4` and the excerpts in "Current state" no longer match.
- `migrateClipColumns()` throws on an existing database, or clips stop loading
  after the migration. That is data loss territory; stop immediately.
- A `<select>` inside a table row cannot be styled to meet the design tokens
  without a custom popover. Report it rather than building a custom one; a
  plain unstyled select is the better trade and is a decision for the owner.
- `npm run lint:locales` reports a register or run-on error you cannot resolve
  in a language you do not read. Report the exact key and the linter message.
- Any step's verification fails twice after a reasonable fix attempt.
- The work appears to require touching `main.ts`, `ClipCreator.tsx`, or the card
  grid markup.
- You find that `window.electronAPI.updateClip` does not exist at runtime, which
  would mean the preload bridge at `src/main/preload.ts:218` is not what this
  plan read.

## Maintenance notes

For whoever owns this next:

- **`ClipLibrary.tsx` was already ~980 lines before this change.** The table
  went into its own component for that reason. If the next feature needs more
  state in the library, that is the moment to split the filter and sort logic
  into a hook rather than growing the file again.
- **The duplicated `Clip` interface is now duplicated in three places** once
  `ClipTable` imports it: `global.d.ts`, `ClipLibrary.tsx`, and whatever
  `ClipTable` re-exports. Collapsing them into one is a good small follow-up and
  was kept out of this plan to keep the diff reviewable.
- **`UPDATABLE_CLIP_COLUMNS` is the gate on what the renderer can write.** Any
  future field that should be editable has to be added there as well as to the
  schema, and anything left out of it fails silently rather than erroring. Watch
  for that in review.
- **What a reviewer should scrutinise**: that the card grid is untouched, that
  `loadPref` defaults to `"grid"`, that bulk actions use `allSettled` and report
  partial failure honestly, that the selection is pruned when the filter
  changes, and that no raw hex reached `ClipTable.module.css`.
- **Deliberately deferred, each worth its own plan:**
  - *Manual clip order.* A `sort_order` column, drag-to-reorder rows, and
    `PresentMode` playing that order instead of the sort. The competitor's
    `Orden` column is exactly this. It was cut here to keep this plan to one
    schema change.
  - *Duplicating a clip.* Cheap as a row that reuses the same `output_path`,
    expensive if it should copy the file. That question is unanswered.
  - *Re-trimming in and out points from the list.* The heaviest of the three:
    it means re-running ffmpeg against the source video, regenerating the
    thumbnail, and handling a source video that has moved. `UPDATABLE_CLIP_COLUMNS`
    deliberately excludes the time columns so nobody half-implements it by
    accident.
  - *A diagram indicator column.* Annotations are keyed to a timestamp in the
    source video rather than to a clip id, so a per-clip indicator needs a
    range query that does not exist yet.

---

## Executor notes (2026-09-08, PR #36)

What the plan got wrong, recorded next to the claim rather than deleted:

- **The plan said the table would live inside the existing side panel and
  listed only `ClipLibrary.module.css` for layout.** The panel opens at 360px
  and `App.module.css` capped it at 600px, while the table's own floor is
  755px. Below that the play calls truncate to `1...` and `2...`, which is the
  column the whole view exists for. The cap moved to 900px and `ClipLibrary`
  gained an `onRequestWidth` prop that `App` answers with
  `ensureSidePanelWidth`, so the Table toggle claims the room once. Anyone
  planning further work in this panel should budget width, not just height.

- **`updateClip` had a second defect the plan named but did not size.** As well
  as interpolating IPC-supplied field names into the SQL, an empty `updates`
  object built `UPDATE clips SET  WHERE id = ?` and threw. Both are handled by
  `UPDATABLE_CLIP_COLUMNS` plus an early return.

- **Bulk category was specified as "re-categorise" and shipped as "add".**
  Replacing a clip's tags in bulk destroys tags a coach set by hand, and no
  step of the plan justified that. The English key reads "Add category".

- **The status i18n block is 30 keys, not the 29 the plan's verify command
  claimed.** The command in the plan was corrected before execution.

Reviewers found two defects the plan's steps did not anticipate, both in the
shift-click range: a stored row index goes out of bounds when a filter or a
bulk delete shortens the list, and points at the wrong clip after a re-sort.
Anchoring on the clip id fixes both. A future plan that adds selection to any
list in this app should specify the anchor as an id from the start.

Still deferred, in the order they are worth doing: manual clip order, the CSV
export gaining a Status column, duplicating a clip, re-trimming in and out
points, and a diagram indicator column.

## Second pass (2026-09-09)

Two things the first pass shipped that thorough testing caught:

- **The count strings had one form each**, so a single-clip bulk action read
  "Delete 1 clips" in English and worse in the languages that inflect the
  participle. `app.projects.projectCount_one` / `_other` was already in the
  repo, so the shape existed and the plan simply did not think to use it.
  Four keys under `app.clips.table` now carry the pair. **Any future plan that
  adds a `{{count}}` string should specify the plural pair up front**, and the
  locale linter cannot catch this because both forms are structurally valid.

- **`build (windows-latest)` had been red on main since before this branch**,
  and the plan's verification section did not look at CI at all. The cause was
  `npm_config_build_from_source` in `.github/workflows/build.yml` forcing
  `lzma-native` to compile against a Windows SDK the runner no longer exposes
  to node-gyp. `release.yml` never had the problem because it runs a plain
  `npm ci`. Fixed on this branch. Worth knowing: a green release does not imply
  a green build workflow, they are separate and configured differently.

Testing was done by driving the running app over the Chrome DevTools Protocol,
since the repo has no test suite: 27 checks across editing, the category
popover, selection, bulk actions, filters, the two review regressions,
first-run defaults, panel width, Portuguese, and the empty-clip state. The
harness was scratch tooling and is not committed.

## Merged (2026-09-09)

Squashed to `d9ce7ad` on `main` and released as **v1.9.0**. This repo ships
straight from `main`, so a tag is a release to users: pushing `v1.9.0` built
all three platforms, published the GitHub release, submitted the macOS DMG for
notarization, and rebuilt the marketing site. Nothing was staged first.

No promotion checklist item. The `status` column is added by
`migrateClipColumns` on first launch of the new version, with no prod-side
command to run, and users on 1.8.2 and later get the update through
update.electronjs.org.

What the merge taught us, beyond the notes above: **the two CI workflows drift
apart silently.** `build.yml` had been red on Windows for long enough that the
red check stopped meaning anything, while `release.yml` stayed green because it
installs differently. If a check is expected to be red, it is not a check. The
next person to touch either workflow should diff them against each other first.

### Release, second attempt

The first `v1.9.0` tag failed. Not this feature: `scripts/lint-locales.mjs`
resolved its own directory with `new URL(...).pathname`, which on Windows
returns `/D:/a/...` with a leading slash before the drive letter, and
`readdirSync` cannot open that. Fixed with `fileURLToPath` in `8b79536`, tag
moved, released clean.

**The lesson is about the check, not the bug.** `v1.8.2` was tagged before the
locale linter existed, so `v1.9.0` was the first release ever to run the
`prebuild` hook. And `build.yml` called `build:main` and `build:renderer`
directly, which skips `prebuild`, so no PR check could have caught it on any
platform. `build.yml` now runs `npm run build`, the same command
`release.yml` runs.

Two workflows, two different commands, two different Node versions, and a red
Windows check nobody trusted. Anyone touching CI here should diff `build.yml`
against `release.yml` first and justify every difference that remains.

## Follow-ups closed (2026-09-09)

Both of the loose ends this plan left are done, each as its own PR off `main`.

- **[#37](https://github.com/kauredo/basketball-video-analyzer/pull/37), `978ed3e`.**
  Status reaches the CSV, the JSON and the Sportscode XML. Appended as the last
  CSV column so a spreadsheet keyed on column position survives. It also found a
  **third** `Clip` interface, `src/main/database.ts:75`, which this plan missed:
  the main process was compiling against a shape without a column its own
  `UPDATABLE_CLIP_COLUMNS` list already wrote. **When adding a field to a clip,
  there are three copies of the type to update**, in `types/global.d.ts`,
  `main/database.ts` and `renderer/components/ClipLibrary.tsx`.
- **[#38](https://github.com/kauredo/basketball-video-analyzer/pull/38), `8702c86`.**
  `release.yml` on Node 20 like `build.yml`; `build.yml` off `--omit=optional`
  and no longer reinstalling forge makers at 7.2.0 over the 7.8.1 in the
  lockfile, which had CI packaging with older makers than every release.

**Still unvalidated:** the Node 20 change to `release.yml` cannot be exercised
without pushing a tag. `build.yml` does the same install-build-make work on all
three platforms under Node 20, so the risk is low, but the next tag is the real
test. Cut it deliberately rather than discovering it during an urgent release.

Testing note for #37: the three export paths were driven end to end by attaching
to the Electron main process over `--inspect` and stubbing
`dialog.showSaveDialog` to a fixed path, then reading the files back. That is
the way to test anything gated behind a native dialog in this app. Do **not**
drive native dialogs with `osascript` keystrokes: System Events types into
whichever app is frontmost, which during this session was not Electron.
