# Plan 036: Delete the eyebrows that restate the heading

> **Executor instructions**: Follow every step, run each verification command.
> Stop and report on any STOP condition. Update this plan's row in
> `plans/README.md` when done.
>
> **Repo**: monorepo of separate git repos. **`website/` only**.
>
> **Drift check**: from `website/`,
> `git diff --stat fa4bc39..HEAD -- src/pages/`

## Status

- **Priority**: P3
- **Effort**: S
- **Risk**: LOW
- **Depends on**: none
- **Category**: docs
- **Planned at**: commit `fa4bc39`, 2026-09-07
- **Executor's tool**: `/clarify`

## Why this matters

All six guide pages open with a small coloured label above the H1 that says
what the H1 already says:

| Page | Eyebrow | H1 |
|---|---|---|
| `hudl-alternatives` | "Comparison" | "Hudl alternatives for basketball" |
| `scouting` | "For scouts" | "Scout an opponent from their own film" |
| `film-breakdown` | "Guide" | "How to break down game film fast" |
| `for-coaches` | "For coaches" | "Film review that players actually watch" |
| `free-alternative` | (eyebrow present) | (see the file) |
| `vs-inbound-studio` | (eyebrow present) | (see the file) |

An eyebrow earns its place when it tells the reader something the heading does
not: a category in a list of many, a series name, a date. None of these do.
"Guide" above "How to break down game film fast" adds nothing; the reader can
see it is a guide.

They also cost the page's only decorative use of the accent above the fold,
which competes with the Download button for the eye.

## Current state

Each of the six pages has the eyebrow in the hero block, near line 20, styled
in the accent colour at a small size. Read each file to get the exact markup;
they follow one template but the strings differ.

The audit measured the sub-page hero as 170px of blank, then eyebrow, H1, lede,
one H2 and one paragraph, with the lower 200px and both 370px side margins
empty. Removing the eyebrow tightens that opening rather than emptying it
further.

**The site's voice.** First person, plain, specific. The sub-pages contain the
best writing on the site ("Full disclosure first: this is the tool this site is
built around, so take the pitch with that in mind"). Nothing in this plan
should touch that prose.

## Commands you will need

| Purpose | Command (from `website/`) | Expected |
|---|---|---|
| Build | `npm run build` | exit 0 |
| Dev server | `npm run dev` | port 4321 |

No test suite. `npm run build` is the gate.

## Scope

**In scope**:
- The six guide pages in `src/pages/`, the eyebrow element in each hero

**Out of scope**:
- The H1s and ledes. They are good.
- `src/pages/index.astro`.
- The hero's spacing, which `plans/035` and the composition plans touch.
- Any eyebrow that turns out to carry real information (Step 1 checks).

## Git workflow

- Branch: `refactor/remove-eyebrows`
- Conventional commits; check `git log --oneline -5` and match. Never mention
  AI tools and never add AI co-author lines.

## Steps

### Step 1: Read all six and check each one

For each page, read the eyebrow and the H1 together and ask: does the eyebrow
say anything the H1 does not?

If one does, keep it and say so in the PR description. The audit found none
that did, but read them rather than trusting that.

**Verify**: a list in the PR description, six rows, each marked delete or keep
with one line of reasoning.

### Step 2: Delete the ones that restate

Remove the element entirely, not just its text. Leaving an empty span leaves
its margin behind.

**Verify**: `npm run build` → exit 0, and
`grep -rn "Comparison\|For scouts\|For coaches" src/pages/*.astro` returns no
matches in a hero position.

### Step 3: Check the spacing that is left

Deleting an element leaves its margin. Confirm the H1 does not now sit too
close to the nav, or float with a gap where the eyebrow was.

**Verify**: at 1440px and 393px, each of the six heroes reads as deliberate,
with the H1 as the first thing after the nav.

### Step 4: Confirm the accent still appears where it should

With the eyebrows gone, the accent above the fold on those pages is the nav's
Download button alone. That is the intended outcome: one accent, one job.

**Verify**: on each sub-page at 1440px, the accent appears only on interactive
elements.

## Test plan

No test suite. By hand:

- All six pages build and render.
- No orphaned margin above any H1.
- The H1 and lede are unchanged.
- The accent above the fold appears only on the Download button.
- At 393px, the heroes are shorter than before, not just missing a line.

## Done criteria

- [ ] `npm run build` exits 0
- [ ] Each of the six pages either has no eyebrow, or has one that carries
      information the H1 does not, justified in the PR description
- [ ] No empty element or orphaned margin remains where an eyebrow was
- [ ] H1 and lede text is byte-identical to before
- [ ] `plans/README.md` status row updated

## STOP conditions

- An eyebrow turns out to be doing structural work, for example feeding a
  breadcrumb or a structured-data field. Check for JSON-LD referencing it
  before deleting.
- Removing it visibly breaks the hero's vertical rhythm on a page and the fix
  is more than a spacing tweak. Report it; hero composition belongs with the
  composition plans.

## Maintenance notes

- The eyebrow is a template default. If a seventh guide page is added from the
  same template, it will arrive with one. Worth removing it from whatever
  template or snippet the pages were copied from.
- A reviewer should read the eyebrow and the H1 aloud, in order. The redundancy
  is obvious when spoken and easy to miss when scanned.
