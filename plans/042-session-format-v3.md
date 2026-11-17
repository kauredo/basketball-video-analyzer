# Plan 042: Session format version 3, an atomic load, and re-cutting loaded clips

> **Executor instructions**: Follow this plan one step at a time. Each step is
> its own branch, its own pull request and its own squash commit. Run every
> check in a step before you open its PR. If anything in "STOP conditions"
> happens, stop and report; do not improvise. When a step merges, tick it in
> the step table and update this plan's row in `plans/README.md`.
>
> **Drift check (run first, and again before each step)**:
> `git diff --stat 4c31697..HEAD -- src/main/main.ts src/main/database.ts src/main/preload.ts src/renderer/components/ProjectSelector.tsx src/renderer/components/ClipLibrary.tsx`
> If the `save-session` or `load-session` handlers changed, compare the
> "Current state" section against the live code before going on.

## Status

- **Priority**: P2
- **Effort**: L (four steps, S to M each)
- **Repo**: app
- **Audit ids**: BVA-C11, BVA-I1, BVA-I6
- **Decision**: D12 in the 2026-11 portfolio audit. Zip export and the
  scouting report shipped first; the session format waits for this plan
  because a format change touches every session file coaches have saved.

| Step | What | Done |
|---|---|---|
| 1 | Load a session in one transaction, and validate it before writing | [ ] |
| 2 | Write version 3: court position, status, drawings, parent-keyed categories | [ ] |
| 3 | Read version 3, keep reading 1 and 2, refuse anything newer | [ ] |
| 4 | Re-cut loaded clips (`output_path: ""`) from the library | [ ] |

## Why

The active coach asks for telestration more than anything else, and a session
file loses all of it. Today a saved and reloaded project comes back without
drawings, court positions (so the shot chart is empty) or keep/cut/review
status, and two categories with the same name under different parents merge
into one. A file that is missing `categories` on one clip throws halfway
through the load and leaves a half-built project behind. Loaded clips also
have no video file (`output_path: ""`), and nothing in the app can cut them.

## Current state (at `4c31697`)

- `save-session` (`src/main/main.ts`, search for `"save-session"`) writes
  `version: 2` with `project`, `players` (name, number), `categories` (name,
  color, description, parentName) and `clips` (title, startTime, endTime,
  duration, category names, player names, quarter, notes). It drops
  `court_x`, `court_y`, `status`, and every row of the `annotations` table.
- `load-session` checks only that `version`, `project`, `categories` and
  `clips` exist, then asks for the video, then calls `createProject`,
  `createCategory`, `createPlayer` and `createClip` one at a time, with no
  transaction. `clip.categories.map` throws on a clip without `categories`
  after the project and categories are already written.
- Categories are looked up by bare name (`categoryNameToId`), so a child
  named "Pick and roll" under Offense and another under Defense collapse into
  whichever was created last.
- `version` is never compared, so a file from a newer app loads silently
  with fields dropped.
- Clips are created with `output_path: ""` and `thumbnail_path: ""`. The
  clip library shows them, but play, export and the drawing sync skip them.
- Drawings live in `annotations` (`timestamp`, `data` JSON shape list,
  `display_seconds`, `pause_playback`) keyed by `project_id` and
  `video_path`. `createAnnotation` exists in `database.ts`.

## Step 1: one transaction, validated first

1. Move the parsing into a pure module, `src/main/sessionFile.ts`, with a
   `parseSession(json: unknown)` that returns either a normalised session or
   an error code (`ERROR_INVALID_SESSION_FILE`). It checks every clip has
   finite `startTime < endTime`, `categories` and `players` as string arrays
   (missing becomes `[]`), and every category has a name. No database access.
2. In `database.ts`, add `importSession(session, videoPath, videoName)` that
   runs the project, category, player and clip inserts inside one
   `db.transaction`, so a throw rolls everything back.
3. `load-session` parses and validates before showing the video picker, then
   calls `importSession`.
4. Tests: `src/main/sessionFile.test.mts` for a valid v2 file, a clip with no
   `categories`, a clip with `endTime <= startTime`, and a non-object.

Check: `npm test`, `npm run build`, then in the packaged app (see
`CLAUDE.md`, scratch data folder) load a session file with one broken clip
and confirm the project list is unchanged.

## Step 2: write version 3

Add to the saved file, keeping every v2 field so an older app still reads
the parts it knows:

- `version: 3`.
- Each category gets `key`: `parentName/name` for a child, `name` for a
  parent. Each clip's `categories` becomes a list of keys. Keep `parentName`.
- Each clip gets `courtX`, `courtY` (number or null) and `status`
  (`keep`, `cut`, `review` or null).
- A top-level `drawings` list: `timestamp`, `data` (the parsed shape list,
  not the JSON string), `displaySeconds`, `pausePlayback`.

Note on compatibility: a v2 app reading a v3 file looks up clip categories
by bare name, so child categories saved as `Offense/Pick and roll` would not
match. Write the keys into a new field, `categoryKeys`, and keep
`categories` as bare names. That keeps v2 apps loading v3 files with the
same result as today.

Check: unit test that a project with a duplicate child name, a located clip,
a status and two drawings serialises to the expected v3 object.

## Step 3: read version 3

1. `parseSession` accepts versions 1, 2 and 3 and returns
   `ERROR_SESSION_TOO_NEW` for anything above 3. The renderer shows a
   translated message for it (all 11 locale files).
2. For v3, map clips to categories through `categoryKeys`; fall back to bare
   names when `categoryKeys` is absent (v1, v2).
3. Insert `courtX`, `courtY`, `status`, and the drawings (re-stringify
   `data`, validate it is an array) inside the same transaction.
4. Tests: round trip save then load in memory for a v3 file; a v2 file still
   loads; a v4 file is refused.

Check: packaged app. Make a project with a located shot, a status, a
duplicate child category name and a drawing; save; load against the same
video; the shot chart, status pill, both categories and the drawing replay
all match the original.

## Step 4: re-cut loaded clips

Loaded clips have the timing but no file. Add a "Cut video files" action to
the clip library that appears when the project has clips with an empty
`output_path`. It runs the existing cut path (`cut-video-clip` with the
clip's start and end and its drawings) for each one in sequence, updating
`output_path` and `thumbnail_path` as each finishes, with the existing
progress and cancel handling. It uses the drawing sync's re-cut code where
it can rather than a second cutting loop.

Check: packaged app. Load a session with five clips, run the action, cancel
on the third, run again; all five end with a playable file and a thumbnail,
and the cancelled one leaves no partial file.

## Not in scope

- Sportscode XML drawings (BVA-I6 second half). Sportscode has no public
  schema for drawing overlays. Revisit only if the coach sends an example
  file that holds them.
- Moving drawings between different videos. Drawings keep their timestamp
  and attach to the video picked during load.

## STOP conditions

- The drift check shows `annotations` gained columns not described here.
- A v2 file saved by the current release does not load identically after
  step 1. That is a regression in the format the coach already uses.
- Step 4 would need a second ffmpeg pipeline beside the existing one.
