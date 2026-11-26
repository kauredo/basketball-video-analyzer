# Plan 045: Replace the stacked sidebar filters with one Filter button, a popover and removable chips

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report, do not improvise. When done, update the status row for this plan
> in `plans/README.md`, unless a reviewer dispatched you and told you they
> maintain the index.
>
> **Drift check (run first)**:
> `git diff --stat afb5b80..HEAD -- src/renderer/components/ClipLibrary.tsx src/renderer/styles/ClipLibrary.module.css src/renderer/components/StatsDashboard.tsx src/renderer/hooks/useDismissableMenu.ts src/renderer/utils src/i18n/locales`
> Plan 044 lands first and touches `ClipLibrary.tsx` (card markup,
> `handleUpdateClip`), `ClipLibrary.module.css` (card edit styles) and the
> locales (card edit keys). Those diffs are expected. Any other change in the
> filter, stats, search or sort code compared with the excerpts below is a
> mismatch: treat it as a STOP condition.

## Status

- **Priority**: P1
- **Effort**: M
- **Risk**: LOW (renderer only, no schema, no IPC; filter semantics stay the same)
- **Depends on**: plan 044 (card inline edit). This is PR 2 of a five-PR stack
  044 → 045 → 046 → 047 → 048; branch from 044's branch.
- **Repo**: `app` (`kauredo/basketball-video-analyzer`)
- **Category**: direction (coach feedback)
- **Planned at**: commit `afb5b80`, 2026-11-26
- **Design spec**: Workspace board on the canvas, https://claude.ai/artifact/WQSZuvHz6cTgGYEVFcJCGg
  (the facts you need from it are copied into "Design spec" below)

## Why this matters

A coach scouting opponents asked for collapsible sidebar filters. Today the
clip library stacks up to three full-width filter boxes (category, player,
status) and a three-number stats box above the search field. Each box lists
one button per option in a column, so a project with eight categories and ten
players pushes the first clip card a full screen down the side panel. The
filters are also always open, even when nobody is filtering.

After this lands the top of the library is one row (search, Filter, sort),
then one line of chips for whatever is active and a short summary such as
`4 of 16 · 0:47`. The options live in a popover under the Filter button.

## Current state (at `afb5b80`)

### Files in play

- `src/renderer/components/ClipLibrary.tsx` (1194 lines): filter state,
  filter derivation, the stacked filter JSX, stats, search and sort.
- `src/renderer/styles/ClipLibrary.module.css` (946 lines).
- `src/renderer/hooks/useDismissableMenu.ts`: outside click and Escape close
  for transient menus. Used by the export menu here, `ClipTable.tsx:93`,
  `VideoPlayer.tsx:141`, `AnnotationTimingControl.tsx:110`. Signature
  `useDismissableMenu(isOpen, onDismiss, insideRefs[])`; it listens to
  `mousedown` and to `keydown` in the capture phase. It does not move focus.
- `src/renderer/hooks/useFocusTrap.ts`: traps Tab, focuses the first
  focusable on open, and on close restores focus to whatever had it. Do not
  use it here (see Step 3 for why).
- `src/renderer/utils/storage.ts`: `loadPref` / `savePref` and
  `STORAGE_KEYS.CLIP_SORT_BY` / `CLIP_SORT_ORDER`. Sort is persisted; filters
  are not, and this plan keeps it that way.
- `src/renderer/utils/constants.ts`: `CLIP_STATUSES = ["keep","cut","review"]`
  and `statusLabelKey(status)`.
- `src/renderer/utils/contrast.ts`: `inkOn(hex)` picks readable text for a
  category colour; the cards already use it for category tags (`ClipLibrary.tsx:1106`).

### Filter state, `ClipLibrary.tsx:133-141`

```tsx
const [selectedCategory, setSelectedCategory] = useState<number | null>(null);
const [selectedPlayer, setSelectedPlayer] = useState<number | null>(null);
const [searchTerm, setSearchTerm] = useState("");
const [sortBy, setSortBy] = useState<"date" | "duration" | "title">(() => loadPref(STORAGE_KEYS.CLIP_SORT_BY, "date") as ...);
const [sortOrder, setSortOrder] = useState<"asc" | "desc">(() => loadPref(STORAGE_KEYS.CLIP_SORT_ORDER, "desc") as ...);
...
const [selectedStatus, setSelectedStatus] = useState<ClipStatus | null>(null);
```

**Selection semantics today (keep them):** each dimension holds at most one
value. Category: one id or none. Player: one id or none. Status: one of
keep/cut/review or none. The dimensions combine with AND, and search (title
or notes, case-insensitive substring) is ANDed on top.

### Parent and subcategory matching, `ClipLibrary.tsx:182-203`

```tsx
// A parent category owns its subcategories' clips too ...
const categoryFamily = useMemo(() => {
  const family = new Map<number, Set<number>>();
  categories.forEach(parent => {
    family.set(parent.id, new Set([parent.id, ...(parent.children ?? []).map(child => child.id)]));
    parent.children?.forEach(child => family.set(child.id, new Set([child.id])));
  });
  return family;
}, [categories]);

const clipInCategory = useCallback((clip, categoryId) => {
  const ids = categoryFamily.get(categoryId) ?? new Set([categoryId]);
  try { return (JSON.parse(clip.categories || "[]") as number[]).some(id => ids.has(id)); }
  catch { return false; }
}, [categoryFamily]);
```

Selecting a parent shows clips tagged with the parent or any of its
subcategories. Selecting a subcategory shows only clips tagged with that
subcategory. `categories` comes from `getCategoriesHierarchical`
(`src/main/database.ts:1026`), which returns **parents only** at the top level,
each with a `children` array. Subcategories are never in the top-level array.

### Filtering and sorting, `ClipLibrary.tsx:205-254`

`filteredClips` applies search, `clipInCategory`, `parsePlayerIds(clip.players).includes(selectedPlayer)`
and `clip.status === selectedStatus`. `sortedClips` sorts a copy:
`date` compares `created_at` newest first, `duration` compares
`end_time - start_time` longest first, `title` is `a.title.localeCompare(b.title)`;
`sortOrder === "asc"` negates the comparison. So "desc" means newest first,
longest first, and A to Z for title. Keep that exactly.

```tsx
const toggleSort = (field) => {
  if (sortBy === field) { flip sortOrder; savePref(CLIP_SORT_ORDER) }
  else { setSortBy(field); setSortOrder("desc"); savePref both }
};
```

`toggleSort` is also passed to `ClipTable` as `onToggleSort` (`ClipLibrary.tsx:1037`)
for its column headers. Leave that wiring alone.

### The stacked filters, `ClipLibrary.tsx:765-955`

- **Category section** (765-869): heading `t("app.clips.filterByCategory")`,
  an "All (N)" button, then one button per parent with a family count. The
  subcategory buttons (exact-id count) appear only while the parent or one of
  its children is selected. Selected buttons fill with the category colour and
  white text.
- **Player section** (871-905): only when `players.length > 0`. "All (N)",
  then `#{number} {name} ({count})` per player.
- **Status section** (907-939): only when `clips.some(clip => clip.status)`.
  "All (N)" then Keep / Cut / Review with counts.
- **Stats row** (941-955): Clips / Total Duration / Avg Duration from
  `getClipStats()` (590-605), using the local `formatTime` (m:ss, so 75
  minutes prints as `75:00`).

### Search and sort, `ClipLibrary.tsx:957-1012`

A search input with `aria-label={t("app.library.searchPlaceholder")}` and
three sort buttons (Date, Duration, Title); the active one is teal and shows
`faSortUp` for asc, `faSortDown` for desc.

### What still reads the filter state (must keep working)

- Export menu "Export video files" (691): `selectedCategory ? handleExportCategory() : handleExportAll()`.
  `handleExportCategory` (368-423) sends `categoryIds: [selectedCategory]`.
- Hints (1014-1028): `first-clip` when `clips.length === 1`, `first-export`
  when `clips.length >= 3`. Unchanged by this plan.
- Empty state (1046-1068): when `sortedClips.length === 0`, shows "No clips
  yet" if `selectedCategory === null`, else "No clips in {name}".
- Export hint (1168-1180): names the selected category.
- `getCategoryName` (585-588) searches the top-level `categories` only, so a
  selected **subcategory** prints `t("app.clips.unknown")` in the empty state
  and the export hint. Existing bug; Step 1 fixes it because the chips need
  the same lookup.

### Filters survive a project switch (existing bug)

`App.tsx:861` renders `<ClipLibrary currentProject={...}>` with no `key`, and
`ClipLibrary` only reloads data when `currentProject` changes (160-162). A
category, player or status picked in project A stays selected in project B,
where that id matches nothing. With chips on screen this becomes visible.
Step 2 resets the three filters and the search when `currentProject?.id` changes.

### Panel geometry that constrains the popover

- `.clipLibrary` has `container-type: inline-size` (`ClipLibrary.module.css:3-18`),
  so `cqi` units resolve to the side panel's width.
- The side panel is 280 to 600 px wide when dragged (`App.tsx:343`), default
  360. Switching to table view calls `onRequestWidth(TABLE_MIN_PANEL_WIDTH)`
  with `822` (`ClipLibrary.tsx:97,150`), so the panel can also be 822 px. The
  popover keeps its fixed width there; it does not stretch.
- The nearest clipping ancestor of the filter row is `.clipLibraryContent`
  (`ClipLibrary.module.css:792`): `flex: 1; overflow-y: auto; overflow-x: hidden;
  padding: 0 var(--spacing-md)`. (`.clipLibraryPanel` in `App.module.css:124`
  also scrolls, further out.) An absolutely positioned popover inside
  `.clipLibraryContent` is clipped at its left and right edges and extends
  its scroll height downward. The popover must fit inside the row's width,
  and with only 0 to 2 clips the bottom of a tall popover may need a scroll
  to reach.

### Tokens (from `src/renderer/styles/variables.css`; names differ from the brief's shorthand)

- Teal: `--color-primary` (#0b7972). Teal text: `--color-accent-ink`.
- Raised neutral: `--bg-quaternary`. Hover border: `--border-color-hover`.
  There is no `--border-hover` or `--accent-ink`; use the names above.
- `--radius-md` is 1px, `--shadow-lg` is `none`, `--z-popover` is 200.
- Focus: `outline: var(--focus-ring-width) solid var(--focus-ring-color); outline-offset: 2px;`
  on `:focus-visible`, as every button in `ClipLibrary.module.css` does.

### Locale keys this touches (en values)

- Reused: `app.clips.filterByCategory` "Filter by category",
  `app.clips.filterByPlayer` "Filter by player",
  `app.clips.table.filterByStatus` "Filter by status", `app.clips.all` "All",
  `app.clips.date` / `sortDuration` / `sortTitle`, `app.library.searchPlaceholder`,
  `app.clips.table.statusKeep|Cut|Review`.
- Orphaned by this plan (only `ClipLibrary.tsx` reads them; delete from all 11):
  `app.clips.clipsCount`, `app.clips.totalDuration`, `app.clips.avgDuration`.
  Do **not** touch `totalDuration` / `avgDuration` under other namespaces
  (Stats uses its own).
- All 11 files currently have 523 keys each (`npm run lint:locales` prints
  `11 locale files, 523 keys each: clean`). Plan 044 adds its own keys first.

## Design spec (copied from the Workspace board)

Binding decisions from the design ledger: identity frozen (dark default,
tokens only, 1px radii, no shadows, hairline borders, solid category chips);
one solid teal button per region (in the side panel that is Export Clips, so
the Filter button is **not** solid teal); active segments of segmented
controls use the neutral raised style: background `--bg-quaternary`, text
`--text-primary`, `inset 0 0 0 1px var(--border-color-hover)` and a 2px
`--color-accent-ink` bottom edge (`inset 0 -2px 0 var(--color-accent-ink)`).

**Row 1** (gap 6px, controls 36px tall = `--button-height`/`--input-height`):

1. Search input, `flex: 1; min-width: 0`, magnifier icon inside on the left,
   placeholder "Search clips...". Keep the existing `app.library.searchPlaceholder` key.
2. **Filter** button: funnel icon + "Filter" + the active count in mono,
   teal ink (`--color-accent-ink`), shown only when count > 0. While any
   filter is active the button border is `--color-primary`. Accessible name
   "Filter, 1 active" (or "Filter" when none).
3. **Sort** button: current key + arrow (down for desc, up for asc), e.g.
   `Date ↓`, accessible name "Sort by Date".

**Popover** (anchored under the Filter button, ~232px wide, background
`--bg-tertiary`, 1px `--border-color-hover`, padding 10px 12px 12px). Group
headings are 0.7rem, `--text-secondary`, weight 600:

- **Category**: one 26px row per category: 14px check box (1px
  `--border-color-hover`; checked = filled `--color-primary` with a white
  tick), an 8px colour square, the name (flex 1), and the count right-aligned
  in mono 0.7rem `--text-tertiary`. The checked row has background
  `--bg-quaternary`, name weight 500, count in `--text-primary`.
- **Player** (only if the project has players): wrapping chips, 26px tall,
  mono 0.7rem, `#4`, `#7`... Active chip uses the neutral raised style.
  Players without a number show their name.
- **Status** (only once any clip has a status): a 4-segment control
  All / Keep / Cut / Review, equal widths, 26px tall, 1px border around the group.

**Row 2** (margin-top 8px, height 24px): one chip per active filter, then a
spacer, then the summary in mono 0.7rem `--text-secondary`,
`white-space: nowrap`: `4 of 16 · 0:47`.

- Category chip: background = category colour, text `inkOn(colour)`, 22px
  tall, padding `0 3px 0 8px`, name then an 18px × button with
  `aria-label` "Remove Turnovers filter".
- Player and status chips: same shape on `--bg-quaternary` with a 1px
  `--border-color` border.

## Decisions taken in this plan

1. **Selection stays single per group.** The category rows look like check
   boxes (the spec), but behave as a radio group that can be emptied: clicking
   a row selects it and replaces any other; clicking the checked row clears
   it. Mark them up as `role="radio"` / `aria-checked` inside a
   `role="radiogroup"` so screen readers are told the truth. Same for player
   chips (`aria-pressed` toggle buttons; pressing one releases the other).
   Reason: export (`handleExportCategory` sends one id), the empty state and
   the export hint all assume one category. This is the coordinator's
   default, **not confirmed by the owner**; if the owner asks for
   multi-select, that is a follow-up PR (see Maintenance notes), not a change
   to this one.
2. **Subcategories are always listed** in the popover, indented under their
   parent (padding-left 22px, no colour square change), instead of appearing
   only after the parent is picked. Matching does not change: parent row =
   family match and family count, subcategory row = exact match and count.
3. **Sort becomes one button** that opens a small list of the three keys.
   Picking a key calls the existing `toggleSort(key)`: the current key flips
   direction, another key switches to it at "desc". All three keys and both
   directions stay reachable, the stored prefs stay the same, and the table
   headers keep calling `toggleSort`.
4. **The stats row goes.** Count and total duration move into the summary.
   Average duration is dropped (the Stats dashboard has it).
5. **Summary always shows**, `16 of 16 · 3:12` when nothing filters. Search
   counts as filtering for the shown count.
6. **Durations of an hour or more** print as `h:mm:ss` in the summary
   (`1:15:12`), under an hour as `m:ss` (`0:47`). This is exactly what
   `formatDuration` in `StatsDashboard.tsx:49-59` already does; Step 1 moves
   it to `src/renderer/utils/format.ts` and both components import it. Card
   durations keep the local `formatTime`.
7. **Focus**: Escape returns focus to the button that opened the popover.
   An outside click closes without moving focus, because the click already
   put focus where the user wanted it (moving it back would steal a click on
   the search box). Both rules live in one `close` callback that refocuses
   the button only while focus is inside the popover. On Escape that leaves
   focus on the button. On an outside `mousedown` the browser moves focus to
   the clicked element after the listeners run, so the click target ends up
   focused. Removing a chip moves
   focus to the Filter button, since the chip that had focus is gone.

## Commands you will need

| Purpose | Command | Expected on success |
|---|---|---|
| Install (worktree has no `node_modules`) | `npm ci` | exit 0 |
| Unit tests | `npm test` | `fail 0`; 101 pass before this plan, more after |
| One test file | `node --experimental-strip-types --test src/renderer/utils/clipFilters.test.mts` | `fail 0` |
| Typecheck (covers main and renderer, one tsconfig) | `npx tsc --noEmit -p .` | exit 0, no output |
| Locale lint | `npm run lint:locales` | `11 locale files, N keys each: clean` |
| Renderer build | `npm run build:renderer` | exit 0 |
| Full build | `npm run build` | exit 0 (prebuild runs lint:locales) |
| Run the app | `npm run dev` | Electron window opens |

Node: `.nvmrc` pins 22 for the build; tests need `--experimental-strip-types`
(Node 22.6+). Test files import nothing from `node_modules` and import local
modules with the `.ts` extension. A util under test must not import
`constants.ts` or anything with a runtime import of `../../types/global`;
`import type` is fine because type stripping erases it.

Shell rule: plain commands only, no `bash -c` or `eval`. Copy with
`/bin/cp -f`; `rm` is aliased to interactive, use `command rm`.

## Scope

**In scope** (the only files you may modify or create):

- `src/renderer/utils/clipFilters.ts` (**create**): pure filter derivation.
- `src/renderer/utils/clipFilters.test.mts` (**create**).
- `src/renderer/utils/format.ts`: receives `formatDuration` from `StatsDashboard.tsx`.
- `src/renderer/utils/format.test.mts` (**create**): tests for `formatDuration`.
- `src/renderer/components/StatsDashboard.tsx`: **only** delete the local
  `formatDuration` (49-59) and import it from `../utils/format`. Nothing else.
- `src/renderer/components/ClipFilterBar.tsx` (**create**): row 1, popover, sort list, row 2.
- `src/renderer/styles/ClipFilterBar.module.css` (**create**).
- `src/renderer/components/ClipLibrary.tsx`: state, wiring, removal of the old sections.
- `src/renderer/styles/ClipLibrary.module.css`: delete only the classes this plan orphans.
- `src/i18n/locales/*.json` (all 11).
- `plans/README.md`: the coordinator has already added this plan's row;
  update only its Status cell, at the end.

**Out of scope** (do not touch even though they look related):

- `useDismissableMenu.ts` and `useFocusTrap.ts`. Use them as they are.
- `ClipTable.tsx` and its sort headers.
- Card markup and edit behaviour (plan 044), the bottom clip list (plan 046),
  Stats / Court map (plan 047), layout presets (plan 048).
- Export logic, `getClipCategories` (card tags also miss subcategories
  because they search parents only; same root cause, separate fix),
  the empty-state wording when search hides every clip (it says "No clips yet";
  existing behaviour, keep it).
- Persisting filters across restarts.
- Already-dead CSS in `ClipLibrary.module.css` that this plan did not orphan
  (`.clipFilters`, `.categoryFilters`, `.colorDot`, `.clipGrid`, `.clipCategory`,
  `.actionButton*`). Mention it in the PR description; do not delete it. Both
  `.searchInput` blocks (70-91 and 725-746) are different: today they both
  style the one search input through the cascade, and this plan orphans
  both, so Step 4 deletes both.

## Git workflow

- Branch: `feat/sidebar-filter-button`, cut from plan 044's branch.
- Conventional commits; e.g. `feat(clips): one Filter button with chips in the clip library`.
- Never mention AI tooling in a commit message, and never add an AI co-author line.
- Do not push or open a PR unless the operator asked for it. When you do, it
  is stacked on 044's PR.

## Steps

### Step 1: Pure filter module with tests

**1a. Move `formatDuration`.** Cut the function from `StatsDashboard.tsx:49-59`
(comment included) and paste it into `src/renderer/utils/format.ts` as
`export const formatDuration = (seconds: number): string => { ... }`, body
unchanged. In `StatsDashboard.tsx` add `import { formatDuration } from "../utils/format";`.
Its nine call sites stay as they are. Create `src/renderer/utils/format.test.mts`
(import from `./format.ts`; `format.ts` has no imports, so node can load it):
`formatDuration(47) === "0:47"`, `formatDuration(3599) === "59:59"`,
`formatDuration(3600) === "1:00:00"`, `formatDuration(4512.9) === "1:15:12"`,
`formatDuration(0) === "0:00"`.

**1b. The filter module.** Create `src/renderer/utils/clipFilters.ts` with
no runtime imports. Node's type stripping cannot resolve an extensionless
`./format` import and `tsc` rejects `./format.ts`, so this module does not
import `format.ts`; `summarize` returns seconds and the component formats
them. Use exactly these exports:

```ts
import type { ClipStatus } from "../../types/global";

export interface FilterableClip {
  title: string; notes?: string; categories: string; players?: string;
  status?: ClipStatus | null; duration: number;
}
export interface CategoryNode { id: number; name: string; color: string; children?: CategoryNode[] }
export interface ClipFilters {
  search: string; categoryId: number | null; playerId: number | null; status: ClipStatus | null;
}

export const NO_FILTERS: ClipFilters;
export function parseIds(json?: string | null): number[];            // tolerant, [] on bad JSON or non-array
export function categoryFamily(categories: CategoryNode[]): Map<number, Set<number>>; // moved from ClipLibrary
export function findCategory(categories: CategoryNode[], id: number): CategoryNode | undefined; // parents and children
export function clipInCategory(clip: FilterableClip, categoryId: number, family: Map<number, Set<number>>): boolean;
export function filterClips<T extends FilterableClip>(clips: T[], filters: ClipFilters, family: Map<number, Set<number>>): T[];
export function categoryCounts(clips: FilterableClip[], categories: CategoryNode[]): Map<number, number>; // parent = family count, child = exact
export function playerCounts(clips: FilterableClip[]): Map<number, number>;
export function activeFilterCount(filters: ClipFilters): number;       // category + player + status, search excluded
export function summarize(shown: FilterableClip[], total: number): { shown: number; total: number; seconds: number };
```

`NO_FILTERS` is `{ search: "", categoryId: null, playerId: null, status: null }`.

Rules to keep: search matches title or notes, lowercased substring, empty
search matches all; `categoryId` uses the family set (unknown id falls back
to `new Set([id])`, as today); player uses `parseIds(clip.players).includes`;
status is strict equality. `parsePlayerIds` in `ClipLibrary.tsx:49-56` is
replaced by `parseIds`.

Create `src/renderer/utils/clipFilters.test.mts` following
`projectPlayback.test.mts` (`import assert from "node:assert/strict"`,
`import { test } from "node:test"`, import from `./clipFilters.ts`). Cover:

- Parent id matches a clip tagged only with its child; child id does not match a clip tagged only with the parent.
- `categoryCounts`: parent counts its family once per clip (a clip tagged with parent and child counts 1), child counts exact.
- `findCategory` finds a child id.
- `filterClips` ANDs search, category, player and status; search hits notes; bad JSON in `categories` or `players` matches nothing and does not throw.
- `activeFilterCount` is 0 for `NO_FILTERS`, 3 with all three set, and ignores search.
- `summarize` sums `duration` of the shown clips into `seconds` and reports shown/total.

Verify: `node --experimental-strip-types --test src/renderer/utils/clipFilters.test.mts src/renderer/utils/format.test.mts`
→ `fail 0`. `npm test` → `fail 0`, more than 101 tests.
`grep -n "const formatDuration" src/renderer/components/StatsDashboard.tsx` → no output.
`npx tsc --noEmit -p .` exit 0.

### Step 2: Move ClipLibrary onto the module, and reset filters on project switch

In `ClipLibrary.tsx`:

1. Replace the four filter `useState`s for search/category/player/status with
   one `const [filters, setFilters] = useState<ClipFilters>(NO_FILTERS)`.
   Keep `sortBy` / `sortOrder` as they are.
2. `categoryFamily` becomes `useMemo(() => categoryFamily(categories), [categories])`;
   `clipInCategory` calls the util; `filteredClips` becomes
   `useMemo(() => filterClips(clips, filters, family), [...])`.
3. `getCategoryName` uses `findCategory` so subcategories print their name.
4. Update every reader of the old state: export menu (691), `handleExportCategory`
   (368-423), empty state (1048-1063), export hint (1175-1177). Use
   `filters.categoryId` where `selectedCategory` was. Behaviour unchanged.
5. Add `useEffect(() => setFilters(NO_FILTERS), [currentProject?.id])`.
6. Delete `getClipStats` / `stats` (590-605). Keep `formatTime` (cards use it).

Verify: `npx tsc --noEmit -p .` exit 0; `npm test` fail 0;
`grep -n "selectedCategory\|selectedPlayer\|selectedStatus\|parsePlayerIds\|getClipStats" src/renderer/components/ClipLibrary.tsx`
→ no output.

### Step 3: Build `ClipFilterBar`

Create `src/renderer/components/ClipFilterBar.tsx` and
`src/renderer/styles/ClipFilterBar.module.css` (`@import "./variables.css";`
at the top, as `ClipLibrary.module.css` does). Use exactly these props:

```ts
export type SortKey = "date" | "duration" | "title";

interface ClipFilterBarProps {
  /** Every clip in the project; counts and "of N" come from this. */
  clips: Clip[];
  /** ClipLibrary's filteredClips; the summary's shown count and seconds. */
  shownClips: Clip[];
  categories: Category[];
  players: Player[];
  filters: ClipFilters;
  onFiltersChange: (next: ClipFilters) => void;
  sortBy: SortKey;
  sortOrder: "asc" | "desc";
  onToggleSort: (key: SortKey) => void;
}

export const ClipFilterBar: React.FC<ClipFilterBarProps>;
```

ClipLibrary passes `onFiltersChange={setFilters}` and `onToggleSort={toggleSort}`.
Every change inside the bar calls `onFiltersChange({ ...filters, <field>: value })`.

Import `Clip` and `Category` types from `./ClipLibrary` with `import type`
(as `ClipTable.tsx:26` does) and `Player` from `../../types/global`.

**Row 1.** A wrapper `div.filterRow` with `position: relative; display: flex; gap: 6px`.
Search input (moved from ClipLibrary, same key, same `aria-label`), inside a
`span.searchWrap` (`position: relative; flex: 1; min-width: 0`) that also
holds the existing `faSearch` icon, absolutely positioned on the left with
`aria-hidden`. Filter button: `type="button"`, `aria-haspopup="dialog"`,
`aria-expanded={open}`, `aria-controls={open ? popoverId : undefined}`
(`useId()`; the popover is rendered only while open, so the reference is set
only while its target exists), `aria-label` from
`t("app.clips.filter.buttonLabel", { count })` when count > 0, else
`t("app.clips.filter.button")`. Funnel icon: `faFilter` from
`@fortawesome/free-solid-svg-icons`. Sort button: `aria-haspopup="menu"`,
`aria-expanded`, `aria-label` from `t("app.clips.filter.sortBy", { key: label, direction })`
where direction is `t("app.clips.filter.sortAsc" | "sortDesc")`; visible
text is the key label plus `faSortUp` / `faSortDown` (`aria-hidden`).

**Filter popover.** Render it conditionally (`{open && <div ...>}`) inside `.filterRow` (so DOM order is search,
Filter button, popover, sort button and Tab flows from the button into the
popover). `role="dialog"`, `aria-modal="false"`, `aria-label={t("app.clips.filter.dialogLabel")}`.
CSS: `position: absolute; top: calc(100% + var(--spacing-xs)); right: 0;
width: min(240px, 100%); max-height: min(420px, 60vh); overflow-y: auto;
z-index: var(--z-popover)`. Anchoring to the row's right edge rather than the
button's keeps it inside a 280px panel (`.clipLibraryContent` clips anything
wider; see Current state). It still sits under the Filter and sort buttons.
At 822px (table view) it stays 240px wide at the right of the row.

- Close on Escape and outside click with
  `useDismissableMenu(open, close, [filterButtonRef, popoverRef])`, and do
  the focus return **inside** `close`:

  ```ts
  const close = useCallback(() => {
    if (popoverRef.current?.contains(document.activeElement)) {
      filterButtonRef.current?.focus();
    }
    setOpen(false);
  }, []);
  ```

  Do not put the focus return in a React `onKeyDown` on the popover. The
  hook's capture-phase document listener runs first and calls `close`;
  React 18 (`createRoot`) flushes that discrete update in a microtask, so the
  popover can unmount before a bubbling React handler would run. Checking
  `contains(document.activeElement)` gives the right answer for both paths:
  after Escape focus is still inside, so it goes back to the button; on
  `mousedown` outside, focus has not moved yet but the click target takes it
  right after, so the button focus is immediately replaced by the click's
  natural focus. If manual check 3 shows the search box losing the caret,
  STOP and report rather than patching the hook.
- Close when focus leaves: `onBlur` on the popover; if
  `e.relatedTarget` is outside both refs and not null, close. This stops a
  Tab past the last control leaving an open popover behind.
- On open, focus the first control in the popover with
  `requestAnimationFrame` (as `useFocusTrap` does). Do not use
  `useFocusTrap`: it traps Tab (wrong for a non-modal popover) and its
  cleanup restores focus on every close, which steals an outside click.
- Groups, in order, each with a visible heading and a group label:
  - Category: `role="radiogroup"`, `aria-label={t("app.clips.filterByCategory")}`,
    heading `t("app.clips.filter.category")`. For each parent then its
    children (indented): a `<button type="button" role="radio" aria-checked>`
    row containing the box, colour square (`style={{ background: color }}`,
    `aria-hidden`), name, count from `categoryCounts`. Click: set
    `categoryId` to this id, or `null` if it was already this id. Hide the
    group when `categories.length === 0`.
  - Player: only when `players.length > 0`. `role="group"`,
    `aria-label={t("app.clips.filterByPlayer")}`. One `aria-pressed` button
    per player, label `#${number}` when a number exists else the name,
    `title` = full `#7 Name (count)` so the name is still findable.
    Click toggles `playerId` (same id → null).
  - Status: only when `clips.some(c => c.status)` (same condition as today).
    `role="group"`, `aria-label={t("app.clips.table.filterByStatus")}`.
    Four `aria-pressed` buttons: All (`t("app.clips.all")`, status null)
    then `CLIP_STATUSES` with `t(statusLabelKey(s))`.
- Radio-row arrow-key roving is not required (the export menu has none
  either); every control is a button reachable by Tab.

**Sort list.** A second small popover under the sort button, rendered only
while open (wrap the sort button and list in their own `position: relative`
div; list `right: 0`, `min-width: 160px`). Markup: `role="menu"` with
`aria-label={t("app.clips.filter.sortMenuLabel")}`, three
`<button type="button" role="menuitemradio" aria-checked>` items for date /
duration / title (labels `app.clips.date`, `sortDuration`, `sortTitle`), the
checked one with its direction icon. On open, focus moves to the checked
item (`requestAnimationFrame`). ArrowDown / ArrowUp move focus between the
three items (wrapping), Home / End to first / last; Tab closes the list
through the same blur rule as the filter popover. Activating an item calls
`onToggleSort(key)` and then `closeSort()`. Same `useDismissableMenu` setup
with its own `closeSort` callback that refocuses the sort button when
`sortMenuRef.current?.contains(document.activeElement)`.

**Row 2.** `div.activeRow`: `display: flex; align-items: center; gap: 8px;
margin-top: 8px; min-height: 24px`. For each active filter one chip (see
Design spec) with a `type="button"` × (`aria-label={t("app.clips.filter.removeChip", { name })}`,
icon `faXmark`, `aria-hidden` on the icon). `name` is the category name for
a category chip, `#7 Name` for a player (`#7` alone if the player has no
name, the name alone if no number), and the status label for status. The
category chip's × uses `color: inherit`, so it takes the chip's `inkOn`
colour. Removing sets that field to null and focuses the Filter button.
Category chip name/colour from `findCategory`; if it returns undefined
(stale id), render no chip. Then a `flex: 1` spacer and the summary:
`t("app.clips.filter.summary", { shown, total, duration: formatDuration(seconds) })`
with `{ shown, total, seconds } = summarize(shownClips, clips.length)` and
`formatDuration` imported from `../utils/format`, class with
`white-space: nowrap; flex: none; font-family: var(--font-mono)`. Chips go in
a `min-width: 0; flex-wrap: wrap` container so the summary never wraps.

**Styles.** Tokens only, no raw hex. `:focus-visible` with the focus ring on
every button and the input (`outline-offset: -2px` inside the segmented
status group, as `.viewToggleBtn` does). Active segment / active player chip
/ active sort item use the neutral raised style from the Design spec. No
`transform` on hover (the old `.filterBtn:hover` translated by 1px; drop it).

Verify: `npx tsc --noEmit -p .` exit 0 (the component is not mounted yet, so
it only has to compile).

### Step 4: Mount it and delete the old sections

In `ClipLibrary.tsx`, replace the JSX from the `{/* Category Filter */}`
comment through the end of `{/* Search and Sort Controls */}` (765-1012 at
`afb5b80`) with one `<ClipFilterBar ... shownClips={filteredClips} />`. Keep
everything after it (hints, grid/table, export hint) as it is. Remove imports
this leaves unused (`faSort`, `faSortUp`, `faSortDown`, `faSearch`,
`CLIP_STATUSES`, `statusLabelKey` if nothing else in the file uses them; check
with grep before removing each).

In `ClipLibrary.module.css`, delete the classes no file references any more:
`.categoryFilterSection` (and its `h4`), `.filterButtons`, `.categoryGroup`,
`.subcategoryButtons`, `.filterBtn*`, `.subcategoryBtn`, `.libraryStats`,
`.statItem`, `.statLabel`, `.statValue`, `.searchAndSortContainer`,
`.searchContainer`, `.searchIcon`, **both** `.searchInput` blocks with their
`:hover` / `:focus` rules (70-91 and 725-746 at `afb5b80`), `.sortControls`, `.sortButton*`, `.activeSort*`. Before deleting each, run
`grep -rn "styles.<name>" src/renderer` and keep any that still has a user.

Verify:
- `npx tsc --noEmit -p .` exit 0.
- `grep -rn "categoryFilterSection\|libraryStats\|sortButton\|filterBtn" src/renderer` → no output.
- `grep -c "\.searchInput" src/renderer/styles/ClipLibrary.module.css` → `0`.
- `npm run build:renderer` exit 0.

### Step 5: Locale keys

Add under `app.clips` a `filter` object in all 11 files
(`src/i18n/locales/{en,pt,es,fr,de,it,sl,sr,lt,tr,el}.json`):

| Key | en | pt |
|---|---|---|
| `button` | `Filter` | `Filtrar` |
| `buttonLabel_one` | `Filter, {{count}} active` | `Filtrar, {{count}} ativo` |
| `buttonLabel_other` | `Filter, {{count}} active` | `Filtrar, {{count}} ativos` |
| `dialogLabel` | `Filter clips` | `Filtrar clipes` |
| `category` | `Category` | `Categoria` |
| `player` | `Player` | `Jogador` |
| `status` | `Status` | `Estado` |
| `removeChip` | `Remove {{name}} filter` | `Remover filtro {{name}}` |
| `summary` | `{{shown}} of {{total}} · {{duration}}` | `{{shown}} de {{total}} · {{duration}}` |
| `sortBy` | `Sort by {{key}}, {{direction}}` | `Ordenar por {{key}}, {{direction}}` |
| `sortAsc` | `ascending` | `crescente` |
| `sortDesc` | `descending` | `decrescente` |
| `sortMenuLabel` | `Sort clips` | `Ordenar clipes` |

The component calls `t("app.clips.filter.buttonLabel", { count })`; i18next
picks `_one` or `_other`. Every locale gets exactly `_one` and `_other`, as
the existing `app.clips.table.bulkDeleteSuccess_one/_other` pair does in all
11 files today (sl, sr, lt included; i18next falls back to `_other` for their
extra plural forms).

Check the pt file's existing words for "clip" and "player" (`grep -n "clipe\|jogador" src/i18n/locales/pt.json`)
and match them; the lint enforces one register, and pt uses the formal one
only if the file already does. The other nine are machine translations:
keep `{{…}}` placeholders and the `·` separator byte-identical, keep them
short (the Filter button label must fit one line at 280px).

Delete `app.clips.clipsCount`, `app.clips.totalDuration`,
`app.clips.avgDuration` from all 11 files (only under `app.clips`, not the
same names elsewhere).

Verify:
- `npm run lint:locales` → `clean`, key count = 044's count + 10 (13 added, 3 deleted).
  Before 044 the count is 523; read 044's resulting count from the lint
  output before you start this step.
- `grep -rn "app.clips.clipsCount\|app.clips.totalDuration\|app.clips.avgDuration" src/renderer` → no output.
- `npm run build` exit 0.

### Step 6: Manual check in the running app, then the index

Run `npm run dev` (or `npm run package` and launch the binary in `out/` with
`--user-data-dir=<scratch>` as `CLAUDE.md` describes). Use a project with at
least two parent categories, one with subcategories, two players, and one
clip with a status. Walk the manual list in the Test plan. Then update the
Status cell of this plan's row in `plans/README.md` (the coordinator already
added the row; do not add another).

## Test plan

**Unit (node --test)**: `src/renderer/utils/clipFilters.test.mts` and
`src/renderer/utils/format.test.mts`, cases in Step 1.

**Manual, in the running app (side panel at 280px, 600px, and 822px after switching to table view):**

1. With no filter the library shows row 1, no chips, and `N of N · m:ss`.
   The old three boxes and the stats row are gone.
2. Filter opens the popover under the row; focus lands on the first category
   row. Tab moves through categories, players, status, then out to the sort
   button, and the popover closes as focus leaves.
3. Escape closes it and focus is back on the Filter button. Clicking the
   search box while it is open closes it and the caret is in the search box.
4. Pick a parent category: grid shows parent + subcategory clips, the button
   reads `Filter 1` with a teal border, a colour chip appears, the summary
   updates. Pick one of its subcategories: only exact clips, chip shows the
   subcategory's name (not "Unknown"). Click the checked row: filter clears.
5. Player chip toggles; status segments switch; all three combine (AND);
   three chips show; the summary stays on one line at 280px.
6. Each chip's × removes only its filter and focus goes to the Filter button.
7. Status group is absent in a project where no clip has a status; Player
   group is absent in a project with no players.
8. Sort: the button shows `Date ↓`; open it and focus lands on the checked
   Date item; ArrowDown reaches Duration and Title; pick Date again →
   `Date ↑` and order reverses; pick Title → `Title ↓` (A to Z, as before).
   Escape closes the list with focus on the sort button. Restart the app:
   the sort survives. Table view headers still sort and the button follows.
9. Export → "Export video files" with a category selected still exports that
   category only; with none, exports all.
10. Empty state: select a category with no clips → "No clips in {name}",
    correct for a subcategory too. Hints `first-clip` / `first-export` still appear.
11. Switch project: filters and search are cleared.
12. Light theme (Settings): popover, chips and active segments stay readable.
13. Keyboard only: every control reachable, focus ring visible on each.
14. Small library: in a project with 0 clips, then 1, then 2, open the
    popover. It is not cut off at the left or right; if it runs past the
    bottom of `.clipLibraryContent`, scrolling the panel reaches its last
    control. The `first-clip` hint (1 clip) and the "No clips yet" empty
    state (0 clips) still render and do not cover the popover.
15. At 822px (table view) the popover stays 240px wide under the right end
    of the row.

## Done criteria

- [ ] `npm test` exits 0 with `fail 0`, including `clipFilters.test.mts` and `format.test.mts`.
- [ ] `grep -rn "const formatDuration" src/renderer` → only `src/renderer/utils/format.ts`.
- [ ] `npx tsc --noEmit -p .` exits 0.
- [ ] `npm run lint:locales` prints `clean`; `npm run build` exits 0.
- [ ] `grep -rn "selectedCategory\|getClipStats\|categoryFilterSection\|libraryStats\|sortButton" src/renderer` → no output.
- [ ] `grep -c "\"filter\": {" src/i18n/locales/*.json` → 1 for each of the 11 files.
- [ ] No raw hex in `ClipFilterBar.module.css`: `grep -n "#[0-9a-fA-F]\{3,6\}" src/renderer/styles/ClipFilterBar.module.css` → no output.
- [ ] Manual list above passes; screenshots (closed, popover open, three chips at 280px) attached to the PR via the `pr-assets` branch.

## STOP conditions

- The drift check shows changes to the filter, search, sort or stats code
  beyond what plan 044 describes.
- Keeping single selection turns out to break something the spec requires
  that the owner did not accept here (for example a reviewer insists on
  multi-select). Do not widen export or the empty state on your own.
- The popover cannot stay inside a 280px panel without being clipped by
  `.clipLibraryContent`. Report with a screenshot rather than portalling it
  out of `.clipLibrary` (a portal loses the container query and the scroll
  anchoring).
- `useDismissableMenu` needs a change to support the focus return (for
  example the `close`-callback approach leaves the caret out of the search
  box after an outside click). Report; other menus depend on the hook.
- `npm run lint:locales` fails on the register check for a language you
  cannot resolve by matching existing strings.

## Maintenance notes

- **Multi-select** is the obvious next step for categories (the check box
  look invites it). `ClipFilters.categoryId` would become `categoryIds: number[]`
  with OR semantics; `filterClips`, `activeFilterCount` and the chips extend
  directly. The work that is not trivial: `handleExportCategory` must send
  several ids and rewrite each clip's `categories` to the selected ids it
  matches, and the empty state / export hint must name several categories.
- Plan 046 (bottom clip list) may want to follow this filter. The state lives
  in `ClipLibrary` as one `ClipFilters` object so it can be lifted to `App`
  in one move if 046 needs it; do not lift it here.
- The local `formatTime` in `ClipLibrary.tsx` still prints `75:00` for long
  clips; `formatDuration` in `utils/format.ts` is the h:mm:ss version if
  someone unifies them. `StatsDashboard.tsx` also keeps its own
  `parsePlayerIds` (40-47), which `parseIds` could replace later.
- Card category tags (`getClipCategories`) only search parent categories, so
  a clip tagged with a subcategory shows no tag for it. `findCategory` is the
  fix when someone picks it up.

## Plan review

Review fixes are applied above: the focus return moved into `close`, single
selection is recorded as the coordinator's default, `formatDuration` is
shared, the plural key, the clipping ancestor, the 822px width, both
`.searchInput` blocks, pinned signatures, and the sort menu. Two points
needed an adjustment rather than a straight copy:

- **`formatDuration` reuse.** `clipFilters.ts` does not import it.
  `npm test` loads `.ts` modules through Node's type stripping, which needs
  the `.ts` extension on relative imports, and `tsc` (no
  `allowImportingTsExtensions`) rejects that extension. No tested util in the
  repo imports another util today. So `summarize` returns `seconds` and
  `ClipFilterBar` formats it with `formatDuration` from `utils/format.ts`,
  which gets its own `format.test.mts`.
- **Outside click and focus.** With the refocus inside `close`, an outside
  `mousedown` briefly focuses the Filter button, and then the browser's
  default action moves focus to the clicked element. A click on the search
  box therefore still leaves the caret there. A click on a non-focusable
  area leaves focus on the Filter button, which is acceptable. Manual check
  3 and a STOP condition cover the case where this does not hold in Electron.
