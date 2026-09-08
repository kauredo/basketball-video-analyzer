# Plan 015: Correct the shortcut keys the website teaches

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result. If anything in "STOP
> conditions" occurs, stop and report. When done, update this plan's status row
> in `plans/README.md`.
>
> **Repo**: monorepo of separate git repos. This plan touches **`website/`
> only**. Branch and commit inside `website/`.
>
> **Drift check (run first)**: from `website/`, run
> `git diff --stat fa4bc39..HEAD -- src/pages/index.astro src/pages/film-breakdown.astro`

## Status

- **Priority**: P1
- **Effort**: S
- **Risk**: LOW
- **Depends on**: none
- **Category**: bug
- **Planned at**: commit `fa4bc39`, 2026-09-07
- **Executor's tool**: `/clarify`

## Why this matters

The website teaches two keyboard shortcuts that do nothing in the app. The
home page and the film-breakdown guide both say `I` sets a clip's in-point and
`O` sets its out-point. The app uses `Z` and `M`.

This is the first instruction a new user follows, and it fails silently: they
press `I`, nothing happens, and there is no error to tell them why. It is also
the only factually wrong copy on the site, and the landing page's own hero
screenshot contradicts it, since the buttons in that image read "Mark In (Z)"
and "Mark Out (M)".

## Current state

**What the app actually does.** `app/src/main/database.ts` seeds the key
bindings table at first run:

```sql
INSERT OR IGNORE INTO key_bindings (key, value) VALUES
  ('markInKey', 'z'),
  ('markOutKey', 'm');
```

The buttons render as "Mark In (Z)" and "Mark Out (M)", the in-app hint says
"Press Z to mark the start of a clip, M to mark the end", and Settings → Key
Bindings shows `z` and `m` as the defaults. Users can rebind them, so the site
should teach the defaults and say they are rebindable.

**What the site says.** `src/pages/index.astro:86`:

```astro
            Press I for in-point, O for out-point, Space to play/pause. Frame-by-frame with arrow keys.
```

`src/pages/film-breakdown.astro:48-51`:

```astro
        <li class="flex gap-3"><kbd class="font-mono text-sm bg-warm-100 border border-warm-300 rounded px-2 py-0.5 text-warm-900">Space</kbd> play / pause</li>
        <li class="flex gap-3"><kbd class="font-mono text-sm bg-warm-100 border border-warm-300 rounded px-2 py-0.5 text-warm-900">I</kbd> set the clip's in-point</li>
        <li class="flex gap-3"><kbd class="font-mono text-sm bg-warm-100 border border-warm-300 rounded px-2 py-0.5 text-warm-900">O</kbd> set the clip's out-point</li>
        <li class="flex gap-3"><kbd class="font-mono text-sm bg-warm-100 border border-warm-300 rounded px-2 py-0.5 text-warm-900">&larr; &rarr;</kbd> step frame by frame to trim the edges</li>
```

And `src/pages/film-breakdown.astro:44` sets up the list with prose that also
needs to stay accurate:

```astro
        you set an in-point and an out-point, then tag it. The shortcuts are there
```

**Repo conventions.** Astro pages, Tailwind utilities inline. Copy on this site
is written in first person, plain, and specific. It avoids marketing adjectives
and names mechanisms and numbers. Match that. Do not use em dashes.

## Commands you will need

| Purpose | Command (run from `website/`) | Expected on success |
|---|---|---|
| Build | `npm run build` | exit 0 |
| Dev server | `npm run dev` | serves on port 4321 |

No test suite. `npm run build` is the gate.

## Scope

**In scope**:
- `src/pages/index.astro` (the feature card at line 86)
- `src/pages/film-breakdown.astro` (the keycap list at lines 48-51)

**Out of scope** (do NOT touch):
- The app's key bindings. Do not change the app to match the site. `Z` and `M`
  are the shipped defaults, documented in the app's own UI, and users have
  muscle memory for them.
- Any other page. A search at planning time found `I`/`O` only in these two
  files.
- The screenshots. They already show the correct keys and are being replaced in
  `plans/017-refresh-product-screenshots.md` for a different reason.

## Git workflow

- Branch: `fix/shortcut-keys-copy`
- Commit style: conventional commits; check `git log --oneline -5` and match.
- Never mention AI tools in commit messages and never add AI co-author lines.

## Steps

### Step 1: Fix the home page feature card

In `src/pages/index.astro:86`, replace the sentence with:

```
Z marks the start, M marks the end, Space plays. Arrow keys step one frame.
```

This keeps the card's length, names the real keys, and drops "in-point" and
"out-point" in favour of what the buttons say.

**Verify**: `grep -n "Press I for in-point" src/pages/index.astro` returns no
matches.

### Step 2: Fix the film-breakdown keycap list

In `src/pages/film-breakdown.astro`, change the `I` keycap to `Z` and the `O`
keycap to `M`, and update the two labels to match the app's wording:

- `Z` → `mark the start of the clip`
- `M` → `mark the end, which opens the clip form`

Keep the `Space` and arrow-key rows unchanged, and keep the existing `<kbd>`
classes byte for byte on the changed rows.

Add one row after the list, or a sentence beneath it, noting the keys are
configurable:

```
Both keys are configurable in Settings.
```

That is true, it is useful, and it stops the guide going stale if someone
rebinds them.

**Verify**: `grep -n '>I<\|>O<' src/pages/film-breakdown.astro` returns no
matches, and `grep -c '>Z<\|>M<' src/pages/film-breakdown.astro` returns 2.

### Step 3: Check the surrounding prose still reads correctly

Read `src/pages/film-breakdown.astro` lines 40-56 as a whole. Line 44 says
"you set an in-point and an out-point, then tag it". That is still true and
needs no change, but confirm the paragraph and the list do not now contradict
each other in vocabulary. If the paragraph says "in-point" while the list says
"mark the start", align the paragraph to the list's wording.

**Verify**: `npm run build` → exit 0.

### Step 4: Read it in the browser

Run `npm run dev` and open both `/` and `/film-breakdown`.

**Verify**: the home feature card and the guide both name `Z` and `M`, and
neither mentions `I` or `O`.

## Test plan

No test suite. Verify by hand:

- `grep -rn "in-point, O for\|>I</kbd>\|>O</kbd>" src/` returns nothing.
- Both pages build and render.
- The claim now matches the app: launch the app, press `Z` then `M`, and
  confirm the marks land and the clip form opens.

## Done criteria

ALL must hold:

- [ ] `npm run build` exits 0
- [ ] `grep -rn "for in-point" src/` returns no matches
- [ ] `/film-breakdown` shows `Z` and `M` keycaps and no `I` or `O` keycaps
- [ ] The guide mentions that the keys are configurable in Settings
- [ ] `git status` shows only the two page files modified
- [ ] `plans/README.md` status row updated

## STOP conditions

Stop and report if:

- The app's defaults are no longer `z` and `m`. Check
  `app/src/main/database.ts` for the `key_bindings` seed before writing any
  key into the copy.
- `I` or `O` turn up as taught shortcuts on a third page not listed in Scope.

## Maintenance notes

- If the app ever changes its default bindings, these two files are the ones
  that go stale. Worth a comment in the app's key-binding seed pointing at
  them.
- A reviewer should press the keys in the app while reading the guide. That is
  the only check that catches this class of error.
