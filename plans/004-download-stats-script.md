# Plan 004: Per-platform download stats script (measure Windows/macOS/Linux demand)

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md`.
>
> **Drift check (run first)**:
> `cd app && git diff --stat 717500b..HEAD -- package.json scripts/`
> (a `scripts/` dir may not exist yet — that's expected).

## Status

- **Priority**: P3
- **Effort**: S
- **Risk**: LOW
- **Depends on**: none
- **Category**: dx (measurement)
- **Planned at**: app repo commit `717500b`, 2026-07-10

## Why this matters

The owner decided to skip paid Windows code signing until there's evidence of
Windows demand. GitHub's releases API exposes a cumulative `download_count` per
release asset, but nobody looks at it. A small script that prints downloads per
platform per release makes the decision reviewable in ten seconds ("Windows is
60% of downloads" vs "nobody downloads the .exe"). The website's GA download
event (already firing in `DownloadButton.tsx`) measures clicks; this measures
actual asset downloads including direct GitHub traffic.

## Current state

**App repo** (`app/`, `github.com/kauredo/basketball-video-analyzer`).

- No `scripts/` directory exists at the app repo root.
- `app/package.json` scripts block currently ends with `"prepare-deps": ...`.
- Releases are published to GitHub Releases (electron-forge; `publish` script
  exists; the repo has `release.yml`/`notarize.yml` workflows). Asset naming is
  whatever electron-forge makers produce — the script must classify defensively
  by extension AND filename substring, and list anything unclassified rather
  than hiding it.
- The API needs no token for public repos:
  `GET https://api.github.com/repos/kauredo/basketball-video-analyzer/releases?per_page=100`
  → array of releases, each with `tag_name`, `published_at`, and `assets[]`
  where each asset has `name` and `download_count`. Unauthenticated rate limit
  is 60 req/h — one request is plenty.
- Node ≥18 is available (Electron 29+ toolchain), so global `fetch` exists.

## Commands you will need

| Purpose | Command | Expected on success |
|---|---|---|
| Run script | `cd app && npm run stats:downloads` | table printed, exit 0 |

## Scope

**In scope**:
- `app/scripts/download-stats.mjs` (create)
- `app/package.json` (add one script entry)

**Out of scope** (do NOT touch):
- `worker/` — a KV-backed time-series was considered and deferred (see
  Maintenance notes).
- No new npm dependencies. Plain Node, global fetch.
- The website's GA tracking.

## Git workflow

- App repo: branch `chore/download-stats` off `main`. Conventional commit
  (`chore: add per-platform download stats script`).
- Do NOT push or open a PR unless the operator instructed it.
- Do not mention AI tools in commit messages and do not add AI co-author lines.

## Steps

### Step 1: Write the script

Create `app/scripts/download-stats.mjs`. Requirements:

- Fetch all releases (`per_page=100`, follow `Link: rel="next"` header if
  present — unlikely to be needed but cheap to handle; if you skip pagination,
  print a warning when exactly 100 releases come back).
- Classify each asset by lowercase name:
  - windows: ends with `.exe` or `.nupkg` or `.msi`, or contains `win32`/`windows`/`setup`
  - mac: ends with `.dmg`, or (ends with `.zip` and contains `darwin` or `mac`)
  - linux: ends with `.deb`, `.rpm`, `.appimage`, or contains `linux`
  - other: everything else (e.g. `RELEASES`, `.blockmap`, `latest-mac.yml`) —
    still counted, shown in its own column, never silently dropped.
- Print a per-release table (tag, date, win, mac, linux, other, total) in
  reverse-chronological order, then a totals row and platform percentage split
  computed over win+mac+linux only.
- Exit non-zero with a readable message on HTTP failure (include status code).
- Keep it under ~120 lines, no dependencies. Set the `User-Agent` header
  (GitHub's API requires one): `"basketball-video-analyzer-stats"`.

### Step 2: npm script

Add to `app/package.json` scripts:

```json
"stats:downloads": "node scripts/download-stats.mjs"
```

### Step 3: Run it

**Verify**: `cd app && npm run stats:downloads` → exits 0 and prints at least
one release row (the repo has published releases up to v1.6.x) with a totals
row and a percentage line. If the `other` column dominates a release, print the
unclassified asset names below the table so the classifier can be improved —
check that this listing works by reading the output.

## Test plan

No test framework in the repo; do not add one for this. The verification is
running the script against the live public API (Step 3). Edge behavior to
confirm by reading your own code: zero releases → prints "no releases" and
exits 0; network error → non-zero exit with the status code.

## Done criteria

- [ ] `cd app && npm run stats:downloads` exits 0 and prints per-release rows,
      totals, and a win/mac/linux percentage split
- [ ] Unclassified assets are listed by name, not silently dropped
- [ ] No new entries in `package.json` dependencies/devDependencies
- [ ] No files outside the in-scope list are modified (`git status`)
- [ ] `plans/README.md` status row updated

## STOP conditions

Stop and report back if:

- The API request fails repeatedly (rate limit or network) — report, don't
  stub fake output.
- You find yourself wanting to add a dependency (octokit, chalk, cli-table…)
  — the constraint is deliberate; plain strings are fine.

## Maintenance notes

- `download_count` is cumulative per asset and per release, so demand trend =
  compare across releases; no time series needed for the signing decision.
  If a real time series is ever wanted, the deferred design is a scheduled
  Cloudflare Worker (the `worker/` repo already exists) snapshotting counts
  into KV daily — do not build it until someone actually wants the graph.
- When the Windows-signing decision is revisited, run this script and check
  the win % — that was the whole point. Also check SignPath.io's free
  open-source signing program before paying for a certificate.
