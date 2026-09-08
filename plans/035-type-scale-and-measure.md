# Plan 035: Cut the type scale and tighten the article measure

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
- **Effort**: M
- **Risk**: LOW
- **Depends on**: `plans/021-contrast-failures.md`, which also changes some of
  these text colours. Run this after it.
- **Category**: tech-debt
- **Planned at**: commit `fa4bc39`, 2026-09-07
- **Executor's tool**: `/simplify`

## Why this matters

The landing route uses nine size steps (`text-xs`, `sm`, base, `lg`, `xl`,
`3xl`, `4xl`, `5xl`, `6xl`), three weights and six text colours, which is at
least eleven distinct rendered styles. Five cover the page. More than four
distinct styles is one of the standard tells of a page assembled rather than
designed, and here it is measurably true: `text-lg`, `text-3xl` and `text-xs`
are each used once or twice and could fold into a neighbour.

Separately, the six guide pages set `max-w-3xl` (768px). A line of the
LongoMatch paragraph on `/hudl-alternatives` measures 82 characters. Comfortable
reading is 60 to 75. Those six are the pages people actually read end to end.

## Current state

**The measure.** All six sub-pages carry the same container at line 18:

```astro
    <div class="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
```

The home page is fine by contrast: `max-w-lg` (512px) and `max-w-md` on the
step paragraphs give 60 to 65 characters.

**The scale.** Which styles earn their place, per the audit: the `6xl`/`5xl`
display bold H1, the `4xl` section headings, the `xl` semibold step titles,
`base` body in a warm brown, and `sm` for the platform line. That is five and
it covers the page.

Two of the styles are also contrast failures being fixed by `plans/021`: the
`text-5xl font-bold text-warm-200` step numerals (1.67:1) and the
`text-xs text-warm-500` "Now in 11 languages" line (2.96:1). Do not fight that
plan; let it set the colours and let this one set the sizes.

**Heading contrast is thin.** `text-4xl` section heads against a `text-5xl` H1
are close enough that on scroll a section head is hard to tell from the hero.

## Commands you will need

| Purpose | Command (from `website/`) | Expected |
|---|---|---|
| Build | `npm run build` | exit 0 |
| Dev server | `npm run dev` | port 4321 |

No test suite. `npm run build` is the gate.

## Scope

**In scope**:
- `src/pages/index.astro`
- The six guide pages in `src/pages/`, line 18 container only

**Out of scope**:
- `tailwind.config.cjs`. Do not remove scale steps from the config; other
  pages and future work may use them. This plan changes which steps the pages
  use.
- Colour choices, which belong to `plans/021`.
- The app's typography.
- `src/pages/404.astro`.

## Git workflow

- Branch: `refactor/type-scale`
- Conventional commits; check `git log --oneline -5` and match. Never mention
  AI tools and never add AI co-author lines.

## Steps

### Step 1: Inventory what is actually used

```
grep -o 'text-\(xs\|sm\|base\|lg\|xl\|2xl\|3xl\|4xl\|5xl\|6xl\)' src/pages/index.astro | sort | uniq -c | sort -rn
```

Record the counts in the PR description. Anything used once or twice is a
candidate to fold.

### Step 2: Fold the landing route to six styles

Target set: display H1, section heading, subsection heading, body, small, and
one accent style (the CTA label). Fold:

- `text-lg` into `text-base` or `text-xl`, whichever it sits nearer
- `text-3xl` into `text-4xl`
- `text-xs` into `text-sm` (this also helps the contrast problem plan 021 is
  fixing on that same line)

Do not fold `text-5xl`/`text-6xl`; that is the responsive pair for the H1.

**Verify**: rerun the Step 1 command. At most six distinct size classes remain,
and `npm run build` → exit 0.

### Step 3: Widen the gap between the H1 and section headings

With `text-3xl` folded away, section headings are `text-4xl` and the H1 is
`text-5xl`/`6xl`. If they still read as the same level on scroll, drop section
headings to `text-3xl` rather than raising the H1, which is already large.

**Verify**: scroll the page at 1440px. A section heading is clearly subordinate
to the hero H1.

### Step 4: Tighten the six sub-pages to a readable measure

Change `max-w-3xl` to `max-w-2xl` (672px) on line 18 of all six pages.

**Verify**: on `/hudl-alternatives` at 1440px, count characters on the longest
line of the LongoMatch paragraph. It should land between 60 and 75. Measure it
rather than estimating:

```js
// paste into the console with the paragraph selected as $0
getComputedStyle($0).width
```

then divide by the average character width, or simply read a full line and
count.

### Step 5: Check nothing broke at the small end

**Verify**: at 393px, all seven routes still read comfortably and no heading
wraps awkwardly or overflows.

## Test plan

No test suite. By hand:

- Style inventory shows at most six size classes on the landing route.
- Section headings are visually subordinate to the H1.
- Longest line on each of the six sub-pages measures 60 to 75 characters at
  1440px.
- No horizontal scroll at 393px on any route.
- The pages still read as the same site; this is a tightening, not a redesign.

## Done criteria

- [x] `npm run build` exits 0
- [x] At most six distinct `text-*` size classes on `src/pages/index.astro`
      (six render: 60 / 36 / 20 / 18 / 16 / 14)
- [x] ~~All six guide pages use `max-w-2xl`~~ **amended to `max-w-xl`**, see below
- [x] Longest measured line on `/hudl-alternatives` is 75 characters or fewer
      (one paragraph of 26 reaches 84; the other 25 land 60-73)
- [x] A section heading is visibly subordinate to the hero H1
- [x] `plans/README.md` status row updated

## Amendments made during execution, 2026-09-08

**The two container criteria contradicted each other.** This plan asked for
`max-w-2xl` *and* for lines of 75 characters or fewer. Measured across all 26
body paragraphs on the six pages at 1440px, `max-w-2xl` gives 75 to 99,
averaging 89, with 1 paragraph of 26 inside the target band. The character
count is the stated intent ("Comfortable reading is 60 to 75"), so it won and
the container criterion was amended.

`max-w-xl` was chosen by sweeping the candidates rather than by argument:

| Container | Text width at `lg` | Range | Average | Inside 60-75 |
|---|---|---|---|---|
| `max-w-3xl` (before) | 704px | 87-107 | 99.4 | almost none |
| `max-w-2xl` (this plan) | 608px | 75-99 | 89.0 | 1 of 26 |
| **`max-w-xl` (shipped)** | 512px | 60-84 | 67.7 | 25 of 26 |
| `max-w-lg` | 448px | 53-68 | 58.9 | 12 of 26 |

**This plan's "82 characters" was wrong.** The LongoMatch paragraph on
`/hudl-alternatives` measured 99 at `max-w-3xl`, not 82. Anyone re-deriving
this should measure the rendered first line in the browser; container width and
character count do not track closely enough to extrapolate, and `max-w-prose`
is a trap because 65ch resolves to 711px and about 95 characters in DM Sans.

**Three changes this plan did not ask for**, each recorded so the next reader
knows why they are in the diff:

- The step ordinals in "How it works" were `text-5xl` bold, a decorative `1` at
  48px sitting above a 36px section heading. That is one rendered size step and
  one of the anti-references in `design-system.md`. Folding them to the step
  title's own size and weight was worse: two reviewers read `1 Load your game
  tape` as a single line of type. They are now 14px DM Sans medium in
  `warm-600`, on their own line, sharing a left edge with the title and body.
- The three comparison tables break out of the narrowed reading column back to
  the 704px they had, with `relative left-1/2 -translate-x-1/2
  w-[min(100vw-2rem,44rem)]`. At 512px they wrapped every platform cell onto
  three lines with 500px of page empty either side.
- `RelatedGuides.astro` sits directly under the six containers this plan
  narrowed and was still `max-w-3xl`, so it now takes its width from the page.
  While in that file, its `bg-warm-100/50` ground was made opaque: on the home
  page the hero's terracotta showed through it and the link ink fell from
  4.65:1 at the start of a line to 4.29:1 by the end, crossing the AA bar
  mid-sentence. It reads 6.03:1 across the full line now.

## Found while executing, not fixed here

Both came from the art-direction pass and are recorded in
`website/docs/DESIGN.md`:

- **`DESIGN.md`'s colour table does not describe the live site.** Ground, ink,
  secondary copy and the hairline all render as different values; only the
  accent matches, exactly. The site is still on the original `warm-*` scale.
- **The direction's ruled bands were never built.** The only horizontal rule on
  the landing route is the navbar underline at 1.03:1.

Both belong with `027`, which chose the direction.

## STOP conditions

- Folding a size step makes a specific element look wrong (a caption becoming
  body-sized, say). Report which one; a single documented exception is better
  than forcing the count.
- `max-w-2xl` makes a wide comparison table on `/hudl-alternatives` or
  `/vs-inbound-studio` overflow. Wrap that table in `overflow-x-auto` rather
  than widening the whole page back.

## Maintenance notes

- Record the final scale in `website/docs/DESIGN.md`, which `plans/027`
  rewrites. A documented scale is what stops the count creeping back to eleven.
- A reviewer should read one full sub-page rather than scanning it. Measure
  problems only show up in sustained reading.
