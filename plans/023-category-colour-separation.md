# Plan 023: Make default category colours tell categories apart

> **Executor instructions**: Follow every step, run each verification command.
> Stop and report on any STOP condition. Update this plan's row in
> `plans/README.md` when done.
>
> **Repo**: monorepo of separate git repos. **`app/` only**.
>
> **Drift check**: from `app/`,
> `git diff --stat 9a863ed..HEAD -- src/main/database.ts src/renderer/components/CategoryManager.tsx src/renderer/components/Timeline.tsx`

## Status

- **Priority**: P2
- **Effort**: M
- **Risk**: MED (touches seeded data)
- **Depends on**: none. Blocks Option A of `plans/018-single-accent-across-surfaces.md`.
- **Category**: bug
- **Planned at**: commit `9a863ed`, 2026-09-07
- **Executor's tool**: `/harden`

## Why this matters

Scanning the timeline for one category is the app's core visual task, and the
default palette makes it harder than it needs to be. Measured from the Stats
bars on 2026-09-07, seven of the 45 colour pairs sit under ΔE 22, which is
roughly the threshold at which two swatches stop being reliably distinguishable
at chip size. The worst is Rebounding `#8926A4` against Offensive Rebound
`#9940B1` at **ΔE 9.0**, and those two are a parent and its own child, so they
appear next to each other constantly.

Five of the ten default categories live in the orange band. On the timeline,
markers carry colour as their only signal, with no shape or label, so a
deuteranopic user cannot separate Transition (green) from Offense (orange) at
all.

## Current state

The Basketball preset is seeded in `src/main/database.ts` into the
`category_presets` table. Read the current values with:

```
sqlite3 "$HOME/Library/Application Support/basketball-video-analyzer/clip-cutter.db" \
  "select category_name, color, parent_name from category_presets where preset_name='Basketball' order by id;"
```

At planning time it seeds, in order: Offense `#FF5722`, Pick & Roll `#FF7043`,
Isolation `#FF8A65`, Fast Break `#FFAB91`, Post Up `#FFCCBC`, Defense
`#2196F3`, Man-to-Man `#42A5F5`, Zone Defense `#64B5F6`, Press `#90CAF9`,
Transition `#4CAF50`, Rebounding `#9C27B0`, Offensive Rebound `#AB47BC`, and
more.

The pattern is one hue per parent with progressively lighter tints for its
children, which is why siblings collide: `#FF7043`, `#FF8A65`, `#FFAB91` and
`#FFCCBC` are four steps of one Material ramp.

**How the data flows.** `category_presets` seeds a project's `categories` rows
when that project is created. Existing projects already hold their own `color`
values in the `categories` table, so changing the preset affects **new projects
only** unless a migration also updates existing rows.

`colorPresets` in `src/renderer/components/CategoryManager.tsx` is the swatch
list a user picks from when creating a category by hand. It is a
`{ hex, name }[]` array and it should stay in step with whatever this plan
chooses.

## Commands you will need

| Purpose | Command (from `app/`) | Expected |
|---|---|---|
| Install | `npm install --allow-git all` | exit 0 |
| Build | `npm run build` | exit 0 |
| Run | `npm start` | window opens |

No test suite. `npm run build` is the gate. If install scripts are blocked, run
`npm install-scripts approve better-sqlite3 electron ffmpeg-static`, install
again, and revert the `allowScripts` block from `package.json` before
committing.

## Scope

**In scope**:
- `src/main/database.ts`, the Basketball preset seed
- `src/renderer/components/CategoryManager.tsx`, the `colorPresets` array
- `src/renderer/components/Timeline.tsx`, to add a non-colour signal to markers

**Out of scope**:
- Migrating existing projects' category colours. See "The migration question".
- The app's `--color-primary` and the other semantic tokens. Those are plans
  018 and 019.
- The Stats chart rendering.

## The migration question

Do **not** silently rewrite the `categories` rows of existing projects. A coach
has learned that their Offense chips are orange, and changing that under them
mid-season is worse than a slightly muddy palette.

The default this plan takes: **new projects get the new palette, existing
projects keep theirs.** If the operator wants existing projects migrated, that
is a separate plan with a user-facing prompt, because it rewrites data the user
can edit.

Say which behaviour shipped in the PR description.

## Git workflow

- Branch: `fix/category-colour-separation`
- Conventional commits; check `git log --oneline -5` and match. Never mention
  AI tools and never add AI co-author lines.

## Steps

### Step 1: Pick a palette that separates at chip size

Replace the tint-ramp scheme with one where every category, parent or child,
gets a distinct hue and the parent relationship is carried by the `└` glyph and
the indent that already exist in the UI rather than by colour.

Constraints the new palette must satisfy:

- Every pair at ΔE 22 or above in CIELAB. Compute it; do not eyeball.
- No colour within ΔE 25 of the app's `--color-primary` or `--color-danger`,
  so category identity never collides with action colour.
- Distinguishable under deuteranopia. Simulate the palette and re-check the
  worst pairs.
- At least 3:1 against both `--bg-secondary` values (dark `#2a2a2a` and light
  `#f5f5f5`), since chips render on both.

Write the ΔE matrix into the PR description as evidence.

**Verify**: a script or console snippet that computes the ΔE matrix for the new
palette reports a minimum pairwise distance of at least 22.

### Step 2: Update the seed and the manual picker together

Apply the palette to the Basketball preset in `src/main/database.ts` and to
`colorPresets` in `CategoryManager.tsx`. Keep `colorPresets` as
`{ hex, name }[]`; the `name` is used for the swatch buttons' `aria-label` and
must stay accurate, so rename any swatch whose hue changed.

**Verify**: `npm run build` → exit 0, and the two lists agree:
every colour in the preset seed also appears in `colorPresets`.

### Step 3: Stop the timeline relying on colour alone

In `src/renderer/components/Timeline.tsx`, give each track's markers a second
signal so the tracks are separable without colour. The tracks are already
labelled on the left, so the cheapest correct fix is a per-track marker shape
or a border treatment that differs between adjacent tracks, not a legend
change.

Keep it subtle. This is a dense timeline and the markers are small.

**Verify**: `npm start`, open a project with clips in at least four categories,
and confirm the tracks are separable in a greyscale screenshot. Take one:
convert a screenshot to greyscale and check you can still tell the tracks
apart.

### Step 4: Check a fresh project end to end

Create a new project and confirm it seeds with the new palette. Then open an
existing project and confirm its colours are unchanged.

**Verify**: both hold. Record in the PR description that existing projects were
verified untouched.

## Test plan

No test suite. By hand:

- ΔE matrix computed and pasted into the PR, minimum ≥ 22.
- Greyscale screenshot of the timeline: tracks still separable.
- Deuteranopia simulation of the category filter panel: chips still separable.
- A new project seeds the new colours.
- An existing project's colours are byte-identical to before (compare the
  `categories` table rows before and after).

## Done criteria

- [ ] `npm run build` exits 0
- [ ] The ΔE matrix in the PR shows a minimum pairwise distance ≥ 22
- [ ] No category colour is within ΔE 25 of `--color-primary` or
      `--color-danger`
- [ ] The preset seed and `colorPresets` list the same colours
- [ ] Timeline tracks are separable in a greyscale screenshot
- [ ] Existing projects' `categories` rows are unchanged
- [ ] `plans/README.md` status row updated

## STOP conditions

- Ten hues at ΔE ≥ 22 that also clear 3:1 on both backgrounds turn out to be
  impossible. Report the best matrix achieved; the answer is then fewer default
  categories, which is a product decision.
- Any step would require rewriting existing users' category rows. Stop; that is
  explicitly out of scope.

## Maintenance notes

- Whoever adds a default category later has to re-run the ΔE check. Worth
  keeping the computation script in the repo rather than in a PR comment.
- A reviewer should look at the timeline in greyscale. That is the check that
  catches colour-only encoding.
