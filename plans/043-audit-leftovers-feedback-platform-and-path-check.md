# Plan 043: Fix the feedback form's platform field and stop `check-paths-exist` answering for any path

> **Executor instructions**: Follow this plan one step at a time. Each step is
> its own branch, its own pull request and its own squash commit. Run every
> check in a step before you open its PR. If anything in "STOP conditions"
> happens, stop and report; do not improvise. When a step merges, tick it in
> the step table and update this plan's row in `plans/README.md`.
>
> **Drift check (run first, and again before each step)**:
> `git diff --stat b5c3170..HEAD -- src/main/main.ts src/main/preload.ts src/renderer/components/FeedbackModal.tsx src/renderer/components/ProjectSelector.tsx src/renderer/App.tsx`
> If any of those changed, compare the "Current state" excerpts against the
> live code before going on.

## Status

- **Priority**: P2
- **Effort**: S (two small steps)
- **Repo**: app
- **Audit ids**: BVA-I46 (the part plan 041 does not cover), and the
  "noted, not fixed" feedback-form line from the audit's round two
- **Depends on**: none. Plan 041 steps 1 and 2 cover the rest of BVA-C10
  (content security policy, navigation guards); this plan covers only the
  path-existence half.

| Step | What | Done |
|---|---|---|
| 1 | Send the feedback form without reading `process` in the renderer | [ ] |
| 2 | Answer `check-paths-exist` only for the paths of saved projects | [ ] |

## Why

Two small leftovers from the November 2026 audit.

The feedback form builds its request with `process.platform || navigator.platform`.
The renderer runs with `nodeIntegration: false` and `contextIsolation: true`,
so `process` is not defined there. Evaluating `process.platform` throws a
`ReferenceError` inside the `try` block, the catch shows the "could not send"
message, and the request never leaves the app. The audit saw this by reading
the code and did not run it; step 1 starts by running it.

`check-paths-exist` answers whether a file exists for any string the renderer
sends. The renderer is not trusted with paths (see `CLAUDE.md`), and the other
handlers already refuse paths that are not a video or not inside an allowed
folder. An existence check is a small leak, but it is the one path handler
left without a rule.

## Current state (at `b5c3170`)

- `src/renderer/components/FeedbackModal.tsx`, in the submit handler, the
  JSON body has `os: navigator.platform` and
  `platform: process.platform || navigator.platform`.
- The worker (`worker/src`, separate repo) reads `appVersion`, `os` and
  `platform` as optional short strings and prints `unknown` when one is empty.
  It needs no change.
- `src/main/main.ts`, `ipcMain.handle("check-paths-exist", ...)`: loops over
  `paths` and returns `{ [path]: fs.existsSync(path) }` for every non-empty
  string. It does not check that `paths` is an array, how long it is, or
  where each path points.
- Two callers, both in the renderer: `App.tsx` (`handleSelectProject`, one
  path: `project.video_path`) and `ProjectSelector.tsx` (`loadProjects`, the
  `video_path` of every saved project). Both ask only about paths that came
  from `getProjects()`.
- `getProjects()` in `src/main/database.ts` returns every saved project.
  `isAllowedMediaPath` in `main.ts` already compares against
  `getProjects().map(p => p.video_path)` for media requests.
- Pure logic goes in its own module with a `.test.mts` next to it, because
  `main.ts` cannot be imported by the tests. `npm test` runs
  `src/main/*.test.mts`.

## Step 1: the feedback form

1. Reproduce first. Run `npm run package`, launch the binary in `out/` as
   `CLAUDE.md` describes (scratch data folder, remote debugging port), open
   the feedback form from the menu, fill both fields and send. Record what
   happens (the error toast, and the console error over CDP). If the send
   succeeds, stop: the audit's reading was wrong. Write what you saw in the
   plan's `## Plan review` section and skip to step 2.
2. In `FeedbackModal.tsx`, replace `platform: process.platform || navigator.platform`
   with `platform: navigator.platform`. Keep `os` as it is.
3. Confirm nothing else in `src/renderer` reads `process`:
   `grep -rn "process\." src/renderer` should show no use that runs in the
   page (a `process.env.NODE_ENV` that webpack replaces at build time is fine).

Check: `npm run build`. In the packaged app from step 1, send feedback; the
success toast shows and an issue appears on the feedback repo. Close that
issue with a note that it is a test.

## Step 2: limit `check-paths-exist` to saved projects

1. Add `src/main/pathsExist.ts` exporting
   `answerPathsExist(paths: unknown, knownPaths: Set<string>, exists: (p: string) => boolean, max = 500): Record<string, boolean>`.
   It returns `{}` when `paths` is not an array, looks at no more than `max`
   entries, and for each string entry answers `knownPaths.has(entry) && exists(entry)`.
   Entries that are not strings are skipped.
2. In `main.ts`, the handler builds `knownPaths` from
   `getProjects().map(p => p.video_path)`, wraps `fs.existsSync` in a
   try/catch that returns `false`, and calls `answerPathsExist`.
3. Add `src/main/pathsExist.test.mts`: an unknown path that exists on disk
   answers `false`; a known path that exists answers `true`; a known path
   that is missing answers `false`; a non-array input returns `{}`; more than
   `max` entries are cut off.

Check: `npm test`, `npm run build`. In the packaged app, with a project
whose video is moved away, the project list still marks the video as
missing and "Locate video" still relinks it. With a normal project the list
shows no missing marker.

## Not in scope

- The content security policy and navigation guards: plan 041, steps 1 and 2.
- Restricting `play-clip` or media serving: already done in the audit run.

## STOP conditions

- Step 1 reproduction shows the form already sends successfully (see step 1).
- A third caller of `checkPathsExist` appears in the drift check that asks
  about a path that is not a saved project's `video_path`. Decide what it
  needs before restricting the handler.
- Relinking a missing video stops working after step 2.
