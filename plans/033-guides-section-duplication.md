# Plan 033: Remove the duplicated guide list and fix the axis break

> **Executor instructions**: Follow every step, run each verification command.
> Stop and report on any STOP condition. Update this plan's row in
> `plans/README.md` when done.
>
> **Repo**: monorepo of separate git repos. **`website/` only**.
>
> **Drift check**: from `website/`,
> `git diff --stat fa4bc39..HEAD -- src/pages/index.astro src/components/ui/RelatedGuides.astro src/components/ui/Footer.astro`

## Status

- **Priority**: P3
- **Effort**: S
- **Risk**: LOW
- **Depends on**: none
- **Category**: tech-debt
- **Planned at**: commit `fa4bc39`, 2026-09-07
- **Executor's tool**: `/simplify`

## Why this matters

Near the bottom of the home page, "Coaching guides" renders six text links on a
court-gradient band, and the footer immediately below repeats the same six
links. That is twelve link instances inside roughly 250px of scroll.

The section also breaks the page's grid. Everything on the home page is
left-flush at x=176 on a 1088px measure; the "Coaching guides" heading jumps to
x≈367 on a narrower centred column. It is the only section that changes axis,
and it reads as a block pasted in from the sub-page template.

## Current state

- `src/pages/index.astro` renders the "Coaching guides" section near the end,
  around y≈4550 on desktop.
- `src/components/ui/RelatedGuides.astro` renders a guide list; check whether
  the home page uses it or has its own inline copy.
- `src/components/ui/Footer.astro:7-13` renders the guide nav from
  `src/data/guides.ts`:

```astro
    <nav aria-label="Guides" class="flex flex-wrap gap-x-6 gap-y-2 mb-6 pb-6 border-b border-warm-200 text-sm text-warm-600">
      {
        guides.map((g) => (
          <a href={g.href} class="hover:text-warm-900 transition-colors">{g.label}</a>
        ))
      }
    </nav>
```

Both lists come from the same data, so they can never disagree, only repeat.

Measured axis: home page sections sit at x=176; the "Coaching guides" heading
at x≈367.

## Commands you will need

| Purpose | Command (from `website/`) | Expected |
|---|---|---|
| Build | `npm run build` | exit 0 |
| Dev server | `npm run dev` | port 4321 |

No test suite. `npm run build` is the gate.

## Scope

**In scope**:
- `src/pages/index.astro`, the "Coaching guides" section

**Out of scope**:
- `src/components/ui/Footer.astro`. The footer's guide nav stays; it is the
  site-wide index and, until `plans/030` lands, the only phone navigation.
- `src/data/guides.ts`.
- `src/components/ui/RelatedGuides.astro` as used by the six sub-pages, where
  a "more guides" list is genuinely useful.
- The rest of the home page's section order, which is `plans/034`.

## Git workflow

- Branch: `refactor/home-guides-section`
- Conventional commits; check `git log --oneline -5` and match. Never mention
  AI tools and never add AI co-author lines.

## Steps

### Step 1: Decide what the section is for

Two defensible answers, and one of them is doing nothing useful today.

- **Delete it.** The footer already indexes the guides, directly below. The
  home page loses a redundant band and about 250px.
- **Make it earn its place.** Keep it, but give it something the footer's flat
  link list does not have: a one-line description per guide, so a visitor can
  tell `scouting` from `film-breakdown` without clicking.

Prefer deleting unless the operator wants the guides promoted on the home page.
If keeping it, the descriptions have to be real; a list of six links with a
heading is what the footer already is.

Ask the operator before Step 2 and record the answer in the PR description.

### Step 2a: If deleting

Remove the section from `src/pages/index.astro`. Check whether
`RelatedGuides.astro` becomes unused; if the six sub-pages still import it,
leave the component alone.

**Verify**: `npm run build` → exit 0, and the home page's `scrollHeight` at
1440px drops by roughly 250px.

### Step 2b: If keeping

Fix the axis first: bring the section onto the page's own measure so its
heading sits at x=176 with every other section, not at x≈367. That almost
certainly means replacing a `max-w-3xl mx-auto` wrapper with the home page's
`max-w-6xl` container.

Then add a one-line description per guide, sourced from each page's existing
lede rather than newly written, so the descriptions cannot drift from the pages.
If `src/data/guides.ts` has no description field, adding one is in scope.

**Verify**: the heading's `getBoundingClientRect().x` matches the other section
headings' at 1440px.

### Step 3: Check the gradient band

The section sits on a court-gradient band. If the section is deleted, confirm
the band does not leave an empty strip behind, and that the gradient's
transition into the footer still reads.

**Verify**: at 1440px and 393px, no empty coloured band remains where the
section was.

## Test plan

No test suite. By hand:

- The home page has one guide list, not two, or two that are visibly different
  in purpose.
- Every guide is still reachable from the home page (via the footer at minimum).
- Section headings share one left edge at 1440px.
- No empty band at either width.
- The six sub-pages are unaffected.

## Done criteria

- [ ] `npm run build` exits 0
- [ ] The home page does not show two identical six-link guide lists
- [ ] Every section heading on the home page shares the same left edge at
      1440px
- [ ] All six guides remain reachable from the home page
- [ ] The decision (delete or keep) is recorded in the PR description
- [ ] `plans/README.md` status row updated

## STOP conditions

- Deleting the section would leave the guides reachable only from the footer,
  and `plans/030` has not landed, so on a phone the footer row is still clipped.
  In that case land `plans/012` first, or keep the section.
- `RelatedGuides.astro` turns out to be shared with the home page in a way that
  makes deletion break the sub-pages. Report before changing the component.

## Maintenance notes

- The duplication happened because the footer's guide nav and the home page's
  section were added at different times from the same data. A comment in
  `src/data/guides.ts` naming every consumer would prevent a third.
- A reviewer should scroll the bottom 800px of the home page and count how many
  times they read the same six labels.
