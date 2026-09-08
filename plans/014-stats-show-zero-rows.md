# Plan 014: Show zero-count categories and quarters in Statistics

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving on. If
> anything in "STOP conditions" occurs, stop and report. When done, update this
> plan's status row in `plans/README.md`.
>
> **Repo**: monorepo of separate git repos. This plan touches **`app/` only**.
> Branch and commit inside `app/`.
>
> **Drift check (run first)**: from `app/`, run
> `git diff --stat 9a863ed..HEAD -- src/renderer/components/StatsDashboard.tsx`

## Status

- **Priority**: P2
- **Effort**: S
- **Risk**: LOW
- **Depends on**: none
- **Category**: bug
- **Planned at**: commit `9a863ed`, 2026-09-07
- **Executor's tool**: `/harden`

## Why this matters

The Statistics modal silently omits any category or quarter with no clips. A
coach who tagged nothing in Q4 sees a chart that runs Q1, Q2, Q3 and stops, and
cannot tell that apart from a game that had no Q4. The same happens for
categories: the side panel lists "Defense (0)" and "Special Plays (0)", and
Statistics simply does not mention them.

Absence and zero are different facts. For a scouting tool the zero is often the
interesting one, since "we ran no zone offense in the second half" is a finding.

Captured 2026-09-07 with a seeded project of 8 clips: the side panel showed six
categories including two at zero, and "Clips by category" listed four. "Clips
by quarter" listed Q1, Q2 and Q3 and omitted Q4 and OT.

## Current state

- `src/renderer/components/StatsDashboard.tsx`: the Statistics modal body. Two
  `useMemo` blocks build the chart rows.

`src/renderer/components/StatsDashboard.tsx:109-117` (categories):

```tsx
    const rows = flatCategories
      .filter(cat => cat.id !== undefined && tally.has(cat.id))
      .map(cat => ({
        id: cat.id!,
        name: cat.name,
        color: cat.color,
        ...tally.get(cat.id!)!,
      }))
      .sort((a, b) => b.count - a.count);
```

`tally` is a `Map<number, { count, duration }>` built from the clips just above,
so `tally.has(cat.id)` is true only for categories that have at least one clip.

`src/renderer/components/StatsDashboard.tsx:134-136` (quarters):

```tsx
    const rows = order
      .filter(q => counts.has(q))
      .map(q => ({ label: q, count: counts.get(q)! }));
```

where `const order = ["Q1", "Q2", "Q3", "Q4", "OT"];` at line 124.

Immediately after the quarter rows, lines 137-141 append any non-canonical
quarter values found in the data, and lines 142-144 append a "no quarter"
bucket. Both of those must keep working.

**Repo conventions.** React function components, `useMemo` for derived data,
`react-i18next` via `const { t } = useTranslation()` for every user-facing
string. The app ships **11 locale files** in `src/i18n/locales/`
(`de, el, en, es, fr, it, lt, pt, sl, sr, tr`). Any new string goes into all
eleven.

## Commands you will need

| Purpose | Command (run from `app/`) | Expected on success |
|---|---|---|
| Install | `npm install --allow-git all` | exit 0 |
| Build | `npm run build` | exit 0, no TypeScript errors |
| Run | `npm start` | app window opens |

No test suite. `npm run build` is the gate.

If `npm install` reports blocked install scripts, run
`npm install-scripts approve better-sqlite3 electron ffmpeg-static`, install
again, and revert the `allowScripts` block it adds to `package.json` before
committing.

## Scope

**In scope**:
- `src/renderer/components/StatsDashboard.tsx`

**Out of scope** (do NOT touch):
- The bar-rendering markup's colour handling, beyond what is needed for a
  zero-width bar to look deliberate.
- `src/renderer/components/ClipLibrary.tsx` side-panel filter counts. They
  already show zeros correctly and are the behaviour this plan matches.
- The shot chart and any other Stats section not named here.
- The category colour palette. Separating similar category colours is planned
  in `plans/023-category-colour-separation.md`.

## Git workflow

- Branch: `fix/stats-zero-rows`
- Commit style: conventional commits; check `git log --oneline -5` and match.
- Never mention AI tools in commit messages and never add AI co-author lines.

## Steps

### Step 1: Keep every category, at zero when it has no clips

Replace the `.filter(...)` at line 110 so all categories with a defined `id`
survive, and read the tally with a zero default:

```tsx
    const rows = flatCategories
      .filter(cat => cat.id !== undefined)
      .map(cat => ({
        id: cat.id!,
        name: cat.name,
        color: cat.color,
        ...(tally.get(cat.id!) ?? { count: 0, duration: 0 }),
      }))
      .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));
```

The secondary sort by name keeps the zero rows in a stable, readable order
instead of whatever order they happened to arrive in.

**Verify**: `npm run build` → exit 0.

### Step 2: Keep every canonical quarter

Replace the `.filter(q => counts.has(q))` at line 135 so all five canonical
quarters render:

```tsx
    const rows = order.map(q => ({ label: q, count: counts.get(q) ?? 0 }));
```

Leave lines 137-141 (non-canonical quarters) and lines 142-144 (the no-quarter
bucket) exactly as they are.

**Verify**: `npm run build` → exit 0.

### Step 3: Make a zero bar readable

A bar of width 0 reads as a rendering bug. In the bar markup for both charts,
give zero-count rows a visible track with the count label still shown, so the
row reads as "this exists and is empty".

Find the element whose width is computed from `count / maxCount` and ensure a
zero row still paints the row's background track and its `0` label. Do not
introduce a new colour token; use the existing muted background already used
elsewhere in this file.

Also guard the divisor: when every row is zero, `maxCount` is 0 and
`count / maxCount` is `NaN`. Compute the percentage as
`maxCount > 0 ? (count / maxCount) * 100 : 0`.

**Verify**: `npm run build` → exit 0, then run `npm start`, open a project,
open **Stats**, and confirm the charts list every category and Q1 through OT,
with zero rows showing a `0` and no broken layout.

### Step 4: Check the empty project case

Open Statistics on a project with **no clips at all**.

**Verify**: the modal renders without a crash, every category appears at 0, and
Q1 through OT appear at 0. No `NaN` appears anywhere on screen.

## Test plan

No test suite exists in this repo, so verification is manual. Cover:

- A project with clips in some categories and some quarters: zero rows appear
  alongside non-zero ones, correctly ordered.
- A project with zero clips: no crash, no `NaN`, all rows at 0.
- A project with a clip whose `quarter` is null: the "no quarter" bucket still
  appears, unchanged.
- A project with a non-canonical quarter value: that row still appears after
  the canonical five, unchanged.

## Done criteria

ALL must hold:

- [ ] `npm run build` exits 0
- [ ] `grep -n "tally.has" src/renderer/components/StatsDashboard.tsx` returns
      no matches
- [ ] `grep -n "counts.has(q)" src/renderer/components/StatsDashboard.tsx`
      returns no matches
- [ ] With the seeded/manual test project, "Clips by category" lists the same
      categories the side panel lists, including the zero ones
- [ ] "Clips by quarter" lists Q1, Q2, Q3, Q4 and OT
- [ ] Statistics on an empty project renders with no `NaN` on screen
- [ ] `git status` shows only `StatsDashboard.tsx` modified (plus
      `plans/README.md`)
- [ ] `plans/README.md` status row updated

## STOP conditions

Stop and report if:

- The two `useMemo` blocks no longer match the excerpts above.
- Showing every category makes the chart unusably long for a project with many
  categories (say more than 30 rows). If so, stop and report; the right answer
  is then a "hide empty" toggle defaulting to off, which is a bigger design
  decision than this plan covers.
- Any new user-facing string turns out to be needed. This plan is designed to
  need none. If you find you need one, stop and report, because it would have
  to be added to all 11 locale files.

## Maintenance notes

- The shot chart and any future Stats section should follow the same rule:
  show the zero, do not drop the row.
- A reviewer should check the `maxCount > 0` guard specifically. It is the only
  part of this change that can produce a runtime `NaN`.
