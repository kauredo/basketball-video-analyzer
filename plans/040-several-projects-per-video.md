# Plan 040: Let several projects share one video file

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report, do not improvise. When done, update the status row for this plan
> in `plans/README.md`, unless a reviewer dispatched you and told you they
> maintain the index.
>
> **Drift check (run first)**:
> `git diff --stat c5a1df5..HEAD -- src/main/database.ts src/main/main.ts src/main/preload.ts src/renderer/App.tsx src/i18n/locales`
> If any of those changed since this plan was written, compare the
> "Current state" excerpts against the live code before proceeding; on a
> mismatch, treat it as a STOP condition.

## Status

- **Priority**: P1
- **Effort**: M
- **Risk**: MED (rebuilds the `projects` table on every existing install)
- **Depends on**: none
- **Repo**: `app` (`kauredo/basketball-video-analyzer`)
- **Category**: direction
- **Planned at**: commit `c5a1df5`, 2026-11-09

## Why this matters

A coach scouting two teams from one game film needs two projects on the same
video: different categories, players and clips per opponent. Today the second
project is impossible. `projects.video_path` is `UNIQUE`, and opening a video
looks up "the" project for that path and reopens it. The workaround is copying
the video file, which costs gigabytes per copy.

Everything below `projects` already handles sharing: clips, categories,
players and annotations are all keyed by `project_id`, and clip files are
written into one global clips folder under generated names.

## Current state

### Files in play

| File | Role |
|---|---|
| `src/main/database.ts` | schema, migrations, project queries |
| `src/main/projectsMigration.ts` | **new**: the table rebuild, as a pure function |
| `src/main/projectsMigration.test.mts` | **new**: tests using `node:sqlite` |
| `src/main/main.ts` | IPC handlers `get-project`, `update-project-video-path` |
| `src/main/preload.ts` | `ElectronAPI` type and bridge (`src/types/global.d.ts` has another `ElectronAPI` with no project methods; leave it) |
| `src/renderer/App.tsx` | `handleLoadVideoByPath`, `handleSelectProject` |
| `src/renderer/components/VideoProjectChooser.tsx` | **new**: the chooser modal |
| `src/i18n/locales/*.json` | eleven locales, new keys under `app.projects` |

### The constraint, `src/main/database.ts:641-651` (`createTables`)

```ts
  db.exec(`
    CREATE TABLE IF NOT EXISTS projects (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      video_path TEXT NOT NULL UNIQUE,
      video_name TEXT NOT NULL,
      description TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      last_opened DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);
```

The same `CREATE TABLE IF NOT EXISTS projects` with `UNIQUE` appears in the
legacy migration at `database.ts:241-251` (`migrateDatabase`).
`createTables` also creates `idx_projects_video_path` (a plain index). Keep it.

### Startup order, `database.ts:113-128` (`setupDatabase`)

```ts
    db = new Database(dbPath);
    db.pragma("journal_mode = WAL");

    migrateDatabase();
    createTables();
    migrateClipColumns();
    migrateAnnotationColumns();
    insertDefaultCategories();
    migrateClipPaths();
```

### Foreign keys are ON

`better-sqlite3` enables `foreign_keys` by default, and `clips`, `annotations`,
`categories` and `players` all reference `projects(id) ON DELETE CASCADE`.
**A plain `DROP TABLE projects` with foreign keys on deletes every clip,
category, player and annotation in the database.** The rebuild must turn
foreign keys off first (outside any transaction, since the pragma is a no-op
inside one), and restore them after. This follows SQLite's documented
12-step "making other kinds of table schema changes" procedure.

### The lookup, `database.ts:919-927`

```ts
export const getProject = (videoPath: string): Project | null => {
  try {
    const stmt = db.prepare("SELECT * FROM projects WHERE video_path = ?");
    return (stmt.get(videoPath) as Project) || null;
  } catch (error) {
    console.error("Error getting project:", error);
    return null;
  }
};
```

Only one caller: `App.tsx:368`. IPC `get-project` at `main.ts:1358`, bridge
`getProject` at `preload.ts:78` (type) and `preload.ts:192` (impl).

### Opening a video, `App.tsx:361-391` (`handleLoadVideoByPath`)

```ts
      // Check if a project already exists for this video
      let project = await window.electronAPI.getProject(filePath);

      if (!project) {
        const projectName = videoName.replace(/\.[^/.]+$/, "");
        project = await window.electronAPI.createProject({
          name: projectName,
          video_path: filePath,
          video_name: videoName,
          description: `Project for ${videoName}`,
        });
      } else {
        await window.electronAPI.updateProjectLastOpened(project.id);
      }

      setCurrentProject(project);
      setVideoPath(filePath);
      ...
```

Callers: `handleSelectVideo` (file picker), and `ProjectSelector`'s
`onLoadVideoByPath` (YouTube import).

### Relinking a missing video, `App.tsx:405-455` (`handleSelectProject`)

When the project's video is missing, it confirms, opens the picker and calls
`window.electronAPI.updateProjectVideoPath(project.id, newPath, newName)`,
which runs `UPDATE projects SET video_path = ?, video_name = ? WHERE id = ?`
(`database.ts:961-975`, IPC at `main.ts:1393-1408`).

### Session import, `main.ts:1946-` (`load-session`)

Picks a video and calls `createProject(...)` with no lookup. Today it throws a
`UNIQUE constraint failed` when a project already uses that video. Dropping the
constraint fixes it with no code change here.

### Repo conventions to match

- Tests: `node --test`, `.test.mts` next to the module, importing the `.ts`
  file with its extension. Pattern: `src/main/youtubeUrl.test.mts`.
  `npm test` globs `src/main/*.test.mts src/shared/*.test.mts`.
- `better-sqlite3` is rebuilt for Electron and will not load under plain
  Node, so tests cannot import `database.ts`. Put the rebuild in a module that
  takes the database as a parameter, typed by a minimal interface both
  `better-sqlite3` and `node:sqlite`'s `DatabaseSync` satisfy (`.nvmrc` pins
  Node 22.17.1; `node:sqlite` is unflagged from 22.13).
- Migrations are idempotent functions in `database.ts` that check
  `sqlite_master` / `PRAGMA table_info` first (see `migrateClipColumns`,
  `database.ts:750`).
- Modals: copy the shell from `src/renderer/contexts/ConfirmContext.tsx`
  (overlay with `useFocusTrap`, `role`, `aria-modal`, Escape and backdrop
  close) and reuse `styles/ConfirmDialog.module.css` classes `overlay`,
  `dialog`, `header`, `closeButton`, `message`, `actions`, `cancelButton`,
  `confirmButton`.
- Every user-facing string goes through `t()` with keys in all eleven locale
  files; `npm run lint:locales` enforces parity.

## Commands you will need

| Purpose | Command | Expected |
|---|---|---|
| Unit tests | `npm test` | all pass |
| Typecheck main | `npx tsc --noEmit -p tsconfig.json` | no errors |
| Locale parity | `npm run lint:locales` | exit 0 |
| Renderer build | `npx webpack --mode=development` | compiles |

## Scope

In scope: the files in the table above.

Out of scope, do not touch:
- `getAnnotations` filtering by `video_path` as well as `project_id`
  (`database.ts:1312-1320`). After a relink, old annotations stop matching.
  That is a separate, pre-existing bug; note it in your report.
- `clips.video_path`. Relinking does not update it today; leave it.
- `ProjectSelector.tsx` layout. No "duplicate project" button.

## Steps

### Step 1: The rebuild as a pure, tested function

Create `src/main/projectsMigration.ts`:

```ts
export interface MigrationDb {
  exec(sql: string): unknown;
  prepare(sql: string): { get(): unknown; all(): unknown[] };
}

const NEW_PROJECTS_SQL = `
  CREATE TABLE projects_new (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    video_path TEXT NOT NULL,
    video_name TEXT NOT NULL,
    description TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    last_opened DATETIME DEFAULT CURRENT_TIMESTAMP
  )`;

/** Returns true when it rebuilt the table. */
export const dropProjectsVideoPathUnique = (db: MigrationDb): boolean
```

Behaviour:
1. Read `SELECT sql FROM sqlite_master WHERE type='table' AND name='projects'`.
   No row, or the SQL has no `UNIQUE` (case-insensitive) → return `false`.
   Then read `PRAGMA table_info(projects)`; if its column names are not exactly
   `id, name, video_path, video_name, description, created_at, last_opened`
   (any order), `console.warn` and return `false`, so an unexpected schema is
   left alone instead of losing a column.
2. Read `PRAGMA foreign_keys` (row `{ foreign_keys: 0|1 }`), then
   `db.exec("PRAGMA foreign_keys = OFF")`. Record
   `before = db.prepare("PRAGMA foreign_key_check").all().length`, so orphan
   rows that already existed never block the rebuild.
3. `db.exec("BEGIN")` before the `try` (so a failed `BEGIN` is not masked by a
   failed `ROLLBACK`). In `try`: create `projects_new`; `INSERT INTO projects_new (id,
   name, video_path, video_name, description, created_at, last_opened) SELECT
   the same columns FROM projects`; `DROP TABLE projects`; `ALTER TABLE
   projects_new RENAME TO projects`; `CREATE INDEX IF NOT EXISTS
   idx_projects_video_path ON projects(video_path)`; run `PRAGMA
   foreign_key_check` and if it returns more rows than `before`, throw
   `new Error("projects rebuild left dangling foreign keys")`; `COMMIT`.
4. In `catch`: `ROLLBACK`, rethrow.
5. In `finally`: restore `PRAGMA foreign_keys` to the value read in step 2.
6. Return `true`.

Create `src/main/projectsMigration.test.mts` using
`import { DatabaseSync } from "node:sqlite"` (foreign keys are on by default
there too). Build a fixture: `projects` with the old `UNIQUE` schema, plus a
`clips` table `(id INTEGER PRIMARY KEY, project_id INTEGER NOT NULL REFERENCES
projects(id) ON DELETE CASCADE, title TEXT)`. Insert two projects (ids 3 and
7, so id preservation is visible) and a clip for each. Tests:

- after the rebuild, two projects can share a `video_path` (insert succeeds);
- project ids 3 and 7 and all their columns survive unchanged;
- both clips still exist and point at 3 and 7;
- deleting project 3 still cascades to its clip (the FK reference survived);
- `PRAGMA foreign_keys` is back to 1;
- a second call returns `false` and changes nothing;
- a `projects` table with an extra column returns `false` and keeps the column;
- a pre-existing orphan clip (`project_id` 99, inserted with foreign keys off)
  does not stop the rebuild;
- on a database with no `projects` table it returns `false`;
- `sqlite_master` lists `idx_projects_video_path`.

**Inversions (required)**: temporarily delete the `PRAGMA foreign_keys = OFF`
line → the "clips survive" test must fail; restore. Temporarily make the
function return early without rebuilding → the "share a video_path" test must
fail; restore. Record both in your report.

Verify: `npm test` → all pass.

### Step 2: Wire it into the database

In `database.ts`:
- `import { dropProjectsVideoPathUnique } from "./projectsMigration";`
- Remove `UNIQUE` from `video_path` in both `CREATE TABLE ... projects`
  statements (lines ~244 and ~645).
- In `setupDatabase`, call it right after `createTables()`:
  `if (dropProjectsVideoPathUnique(db)) console.log("Dropped UNIQUE on projects.video_path");`
  Errors propagate to the existing `catch` in `setupDatabase`, which sets
  `dbInitError` and shows the existing startup banner. That is the wanted
  behaviour: the transaction rolled back, so the data is intact.
- Replace `getProject` with:

```ts
export const getProjectsByVideoPath = (videoPath: string): Project[] => {
  try {
    const stmt = db.prepare(
      "SELECT * FROM projects WHERE video_path = ? ORDER BY last_opened DESC",
    );
    return stmt.all(videoPath) as Project[];
  } catch (error) {
    console.error("Error getting projects by video path:", error);
    return [];
  }
};
```

- Replace `updateProjectVideoPath(projectId, ...)` with
  `relinkVideoPath(oldPath, newPath, newName): number` running
  `UPDATE projects SET video_path = ?, video_name = ? WHERE video_path = ?`
  and returning `result.changes`. Catch, log and rethrow like
  `updateProjectVideoPath` does today. A missing file is missing for every
  project that uses it, so relinking all of them is always right and needs no
  extra question.

Verify: `npx tsc --noEmit -p tsconfig.json` shows errors only in `main.ts`
(fixed next step). `tsconfig.json` covers the renderer too.

### Step 3: IPC and bridge

- `main.ts`: imports follow the renames. `get-project` becomes
  `get-projects-by-video-path` returning `getProjectsByVideoPath(videoPath)`.
  `update-project-video-path` becomes `relink-video-path` with args
  `(oldPath, newPath, newName)`, returning `changes > 0` and `false` on a
  caught error.
- `preload.ts`: type `getProjectsByVideoPath: (videoPath: string) =>
  Promise<any[]>` and `relinkVideoPath: (oldPath: string, newPath: string,
  newName: string) => Promise<boolean>`; replace the two old entries in both
  the type and the `contextBridge` object.

Verify: `npx tsc --noEmit -p tsconfig.json` → errors only at the two
`App.tsx` call sites (`getProject`, `updateProjectVideoPath`), fixed in Step 6.

### Step 4: Locale keys

Add under `app.projects` in all eleven files (translate each; English below):

| Key | English |
|---|---|
| `chooserTitle` | `This video is already in a project` |
| `chooserMessage` | `Open a project that uses "{{video}}", or start a new one on the same video.` |
| `chooserNewProject` | `New project for this video` |
| `chooserNameLabel` | `Project name` |
| `chooserCreate` | `Create project` |
| `chooserCreateError` | `Couldn't create the project. Please try again.` |

Verify: `npm run lint:locales` → exit 0.

### Step 5: The chooser modal

Create `src/renderer/components/VideoProjectChooser.tsx`:

```ts
interface VideoProjectChooserProps {
  videoName: string;
  projects: Project[];          // export the interface at ProjectSelector.tsx:22 and import it
  onOpen: (project: Project) => void;
  onCreate: (name: string) => void;
  onCancel: () => void;
}
```

Rendered only while open (parent mounts it conditionally). Layout, top to
bottom, inside the ConfirmDialog shell (`role="dialog"`, `aria-modal`,
`aria-labelledby` on the title, `useFocusTrap(true)`, Escape and backdrop call
`onCancel`, close button with `aria-label={t("app.buttons.close")}`):
- an `<h2 id="video-project-chooser-title">` with `chooserTitle` inside the
  `header` row (left of the close button; style it with a `.title` class in
  the new CSS module: `--font-size-lg`, `--text-primary`, margin 0), then the
  `chooserMessage` paragraph with the `message` class;
- one full-width button per project showing `project.name`, calling `onOpen`;
- a form: label `chooserNameLabel`, text input prefilled with
  `videoName` minus its extension, submit button `chooserCreate`
  (disabled when the trimmed name is empty), calling `onCreate(trimmed)`.

Styles: a new `styles/VideoProjectChooser.module.css` for the list and form
only, using tokens from `variables.css` (`--spacing-*`, `--radius-*`,
`--bg-*`, `--border-color`, `--focus-ring-*`), with `:focus-visible` rings on
every button and the input. Reuse `ConfirmDialog.module.css` for the shell.

### Step 6: Use it from App.tsx

- State: `const [chooser, setChooser] = useState<{ filePath: string; videoName: string; projects: Project[] } | null>(null);` (import `Project` from `ProjectSelector`).
- Extract the tail of `handleLoadVideoByPath` (from `setCurrentProject` to
  `setShowInstructions(false)`) into `openProject(project, filePath)`.
- `handleLoadVideoByPath`: call `getProjectsByVideoPath(filePath)`. Empty →
  create as today and `openProject`. Non-empty → `setChooser({...})` and
  return (the `finally` still clears loading).
- Chooser `onOpen`: `updateProjectLastOpened`, `openProject`, `setChooser(null)`.
- Chooser `onCreate(name)`: `setIsLoading(true)`; in try:
  `createProject({ name, video_path, video_name, description: \`Project for ${videoName}\` })`,
  `openProject`, `setChooser(null)`; in catch: log and
  `showError(t("app.projects.chooserCreateError"))`, leaving the chooser open;
  finally `setIsLoading(false)`.
- Chooser `onCancel`: `setChooser(null)` only.
- `handleSelectProject` relink: call
  `relinkVideoPath(project.video_path, newPath, newName)` instead of
  `updateProjectVideoPath`. Everything else stays.
- Render `{chooser && <VideoProjectChooser ... />}` directly **after**
  `<ProjectSelector>` in the JSX. Both overlays use `z-index: var(--z-modal)`,
  so DOM order puts the chooser on top when a YouTube import opens it while
  the selector is still showing.

Verify: `npx tsc --noEmit -p tsconfig.json` and
`npx webpack --mode=development` both clean; `npm test` passes.

### Step 7: Run it

Launch with `npm run dev`. Expected:
1. Open video A → new project, as before.
2. Open video A again → the chooser lists that project. Create "Team B" →
   empty project on the same video. Cut a clip.
3. Open video A again → chooser lists both, Team B first. Open the first
   project → its clips are there, Team B's are not.
4. Import a saved session (`Import project`) and pick video A → it imports
   as a third project with no error.
5. Rename video A on disk, open one of its projects, use "Locate video" → all
   three projects now point at the new path (reopen each from the selector, no
   missing badge).
6. An existing install with data keeps all projects and clips after upgrade
   (test against a copy of a real `clip-cutter.db` if you have one).

## Done when

- `npm test`, `npx tsc --noEmit -p tsconfig.json`, `npm run lint:locales` and
  `npx webpack --mode=development` all pass.
- Two projects can be created on one video path from the UI, and each keeps
  its own clips.
- Session import onto a video that already has a project succeeds.
- Relinking a missing video updates every project that used the old path.
- The migration test suite, including both inversions, passes.
- No remaining references: `grep -rnE "getProject\(|getProject:|get-project\"|updateProjectVideoPath|update-project-video-path" src` → no output.

## STOP conditions

- `PRAGMA foreign_key_check` reports rows on a real database you test with.
- `sqlite_master` for `projects` on a real database contains anything the
  new `CREATE TABLE` does not (an extra column or constraint).
- Any other code turns out to rely on one project per video path.

## Maintenance note

Any future change to the `projects` columns must update `NEW_PROJECTS_SQL`
and `createTables` together, or the rebuild will drop a column on old installs.

## Plan review

- Goldfish (approve-with-fixes) suggested carrying `sqlite_sequence` across the
  rebuild. Not done: reused ids belong to deleted projects whose children the
  cascade already removed, so a reused id collides with nothing.
