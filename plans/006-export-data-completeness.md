# Plan 006: Include players and quarter in session files and CSV/JSON export

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md`.
>
> **Drift check (run first)**:
> `cd app && git diff --stat 717500b..HEAD -- src/main/main.ts src/main/database.ts`
> If either file changed since this plan was written, compare the "Current
> state" excerpts against the live code; on a mismatch, treat it as a STOP
> condition.

## Status

- **Priority**: P2
- **Effort**: S
- **Risk**: MED (file-format change; must stay backward compatible with v1 session files)
- **Depends on**: none
- **Category**: bug (data loss in round-trip)
- **Planned at**: app repo commit `717500b`, 2026-07-10

## Why this matters

Clips carry `players` (JSON array of player IDs) and `quarter` columns, and
coaches tag both. But the two data-export paths silently drop them:

1. **Session save/load** (`save-session` / `load-session`) — a coach who
   shares a session file with an assistant loses every player tag and quarter
   on import. Player-based filtering and per-player highlight reels are a core
   workflow, so the shared session is quietly worse than the original.
2. **CSV/JSON metadata export** (`export-clips-data`) — the spreadsheet a
   coach exports has no Quarter or Players columns, though both are in the DB.

This is a data-completeness bug, not a feature. The fix bumps the session
format to version 2 while still importing version 1 files.

## Current state

**App repo (`app/`).** Both handlers live in `src/main/main.ts`.

- Clips schema (`src/main/database.ts:649-665` via `createTables`, and the
  `Clip` interface at `database.ts:56-71`): `players?: string` ("JSON array of
  player IDs", column default `'[]'`), `quarter?: string | null`.
- Players table (`database.ts:637-644`): `id, name TEXT NOT NULL, number TEXT,
  project_id, created_at, UNIQUE(name, project_id)`. CRUD functions exist in
  database.ts and are IPC-exposed (`get-players`, `create-player`, … —
  `main.ts:1112-1155`); the exported functions you need are `getPlayers(projectId)`
  and `createPlayer({ name, number?, project_id })` — confirm exact signatures
  in database.ts before use.
- `createClip` (`database.ts:1249-1280`) — 12-column INSERT already accepting
  `players` and `quarter`:
  ```ts
  clip.players || "[]",
  clip.quarter || null,
  ```
- **save-session** (`main.ts:1506-1579`): builds `sessionData` with
  `version: 1`; `exportClips` (`:1536-1551`) maps each clip to
  `{ title, startTime, endTime, duration, categories: categoryNames, notes }`
  — **no players, no quarter**. Categories are exported by NAME (id→name map
  built at `:1514-1523`) so imports into a fresh DB work; players must use the
  same name-based approach.
- **load-session** (`main.ts:1582-1677`): validates
  `if (!sessionData.version || !sessionData.project || !sessionData.categories || !sessionData.clips)`
  (`:1597`) — note it does NOT pin `version === 1`, it only requires
  truthiness, so a v2 file passes validation in old app versions but silently
  drops the new fields there (acceptable). Flow: pick JSON → pick video →
  `createProject` → categories two-pass (parents `:1624-1635`, children
  `:1637-1650`) building `categoryNameToId` → clips loop (`:1652-1670`)
  calling `createClip({ ..., categories: JSON.stringify(categoryIds), notes })`
  — **no players/quarter passed**.
- **export-clips-data** (`main.ts:1418-1503`): CSV header at `:1447`:
  ```ts
  const header = "Title,Categories,Start Time,End Time,Duration,Notes,Created At";
  ```
  Row builder `:1463-1471` (uses a local `escapeCsv` with formula-injection
  guard `:1455-1461`); JSON branch `:1476-1494` writes
  `{ title, categories, start_time, end_time, duration, notes, created_at }`.
  A `categoryMap` (id→name) already exists in this handler's scope — check the
  lines just above `:1440` for how it's built and mirror that for players.

## Commands you will need

| Purpose | Command | Expected on success |
|---|---|---|
| Install | `cd app && npm install` | exit 0 |
| Build (typecheck + bundle) | `cd app && npm run build` | exit 0 |
| Run app | `cd app && npm run dev` | app opens |

## Scope

**In scope**:
- `src/main/main.ts` — the three handlers named above, nothing else.

**Out of scope** (do NOT touch):
- `src/main/database.ts` — schema and CRUD already support everything needed.
- Renderer code — the UI for save/load/export already exists
  (ClipLibrary export menu, ProjectSelector `loadSession`).
- The mp4 file export (`export-clips-by-category`).
- No new i18n keys (no UI strings change).

## Git workflow

- App repo: branch `fix/export-completeness` off `main`. Conventional commits
  (`fix: include players and quarter in session and data exports`).
- Do NOT push or open a PR unless the operator instructed it.
- Do not mention AI tools in commit messages and do not add AI co-author lines.

## Steps

### Step 1: save-session → version 2

In the `save-session` handler:

1. Fetch players: `const players = getPlayers(projectId);` (import from
   `./database` alongside the existing imports — check the import list at the
   top of main.ts; `getPlayers` may already be imported for the `get-players`
   handler).
2. Build a player id→name map (like the category map at `:1514-1523`).
3. Add to `sessionData`:
   - `version: 2`
   - `players: players.map(p => ({ name: p.name, number: p.number || "" }))`
   - each clip gains `quarter: clip.quarter || null` and
     `players: <names resolved via the map, unknown ids skipped>` (mirror the
     categories try/catch JSON.parse pattern at `:1537-1541` — `clip.players`
     is a JSON TEXT column).

### Step 2: load-session → import v1 AND v2

In the `load-session` handler:

1. After the categories two-pass, add a players pass (only when
   `Array.isArray(sessionData.players)`):
   ```ts
   const playerNameToId = new Map<string, number>();
   for (const p of sessionData.players ?? []) {
     const created = createPlayer({
       name: p.name,
       number: p.number || undefined,
       project_id: project.id as number,
     });
     if (created.id) playerNameToId.set(p.name, created.id);
   }
   ```
   Confirm `createPlayer`'s exact signature/return in database.ts first and
   match it.
2. In the clips loop, resolve `clip.players` (array of names in v2; absent in
   v1) to ids via `playerNameToId` (skip unknowns, same filter pattern as
   categories `:1654-1656`), and pass to `createClip`:
   ```ts
   players: JSON.stringify(playerIds),
   quarter: clip.quarter ?? null,
   ```
   For v1 files (`sessionData.players` undefined, clips without
   `players`/`quarter`) this degrades to `"[]"` / `null` — identical to
   today's behavior. Do not reject v1; do not require `version === 2`.

### Step 3: export-clips-data → add Quarter and Players

1. Build a player id→name map next to the existing `categoryMap`
   (call `getPlayers(projectId)` — the handler already receives `projectId`;
   verify the parameter name at `:1418`).
2. CSV: header becomes
   `"Title,Categories,Players,Quarter,Start Time,End Time,Duration,Notes,Created At"`;
   row gains `escapeCsv(playerNames.join("; "))` and
   `escapeCsv(clip.quarter || "")` in matching positions (player names resolved
   from `clip.players` JSON with the same try/catch pattern).
3. JSON: objects gain `players: playerNames` (array) and
   `quarter: clip.quarter || null`, placed after `categories`.

**Verify (after each step)**: `cd app && npm run build` → exit 0.

### Step 4: manual round-trip test

Run `npm run dev`:

1. In a project with ≥2 players and clips tagged with players + quarters,
   Export menu → Save Session → inspect the JSON file: `"version": 2`, a
   `players` array, clips carrying `players` (names) and `quarter`.
2. ProjectSelector → Load Session with that file + the same video → open the
   new project: player filter in ClipLibrary shows the players; clips keep
   quarter (visible in titles/stats by quarter).
3. Load an **old v1 session file** (create one by hand: take the v2 file,
   set `"version": 1`, delete the `players` array and each clip's
   `players`/`quarter` fields) → import succeeds, clips have no players/quarter,
   no errors in the console.
4. Export CSV → open it: Quarter and Players columns populated; a clip title
   containing a comma stays correctly quoted.

## Test plan

No test framework exists; the manual round-trip in Step 4 is the test. In your
report include the v2 JSON snippet (one clip) and the CSV header line as
evidence.

## Done criteria

- [ ] `cd app && npm run build` exits 0
- [ ] `grep -n '"version": 2\|version: 2' src/main/main.ts` → 1 match (save-session)
- [ ] `grep -c "Quarter" src/main/main.ts` ≥ 1 (CSV header)
- [ ] Step 4 round-trip performed: v2 round-trip preserves players+quarter; v1 file still imports
- [ ] No files outside the in-scope list are modified (`git status`)
- [ ] `plans/README.md` status row updated

## STOP conditions

Stop and report back if:

- `getPlayers` / `createPlayer` signatures in database.ts differ materially
  from what this plan assumes (e.g. async, different return shape).
- The save/load-session handlers no longer match the excerpts.
- You find yourself changing `database.ts` — the premise is that no schema
  change is needed; if that's false, stop.

## Maintenance notes

- Session format is now versioned in practice: v1 (no players) and v2. Any
  future format change must bump `version` and keep the loader accepting all
  prior versions. Consider extracting a `SESSION_VERSION` const if a v3 ever
  happens.
- Plan 008 (shot chart) adds `court_x`/`court_y` clip columns — when it lands,
  those belong in the session format (v3) and the CSV too. Note this in that
  plan's review.
- Old app versions importing a v2 file silently ignore players/quarter (their
  `createClip` defaults them) — acceptable, no migration needed.
