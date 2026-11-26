# Plan 044: Edit a clip's title and notes in place on the card view, and let those edits reach Timeline and Stats

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report, do not improvise. When done, update the Status column of the
> existing 044 row in `plans/README.md` (the coordinator already added it).
>
> **Drift check (run first)**:
> `git diff --stat afb5b80..HEAD -- src/renderer/components/ClipLibrary.tsx src/renderer/components/ClipTable.tsx src/renderer/styles/ClipLibrary.module.css src/renderer/utils src/renderer/hooks src/i18n/locales`
> If any of those changed since this plan was written, compare the
> "Current state" excerpts against the live code before proceeding; on a
> mismatch, treat it as a STOP condition.

## Status

- **Priority**: P1
- **Effort**: M
- **Risk**: LOW (renderer only; reuses the `updateClip` path the table view already calls)
- **Depends on**: none. This is the first of five stacked PRs (044 to 048).
- **Repo**: `app` (`kauredo/basketball-video-analyzer`)
- **Category**: direction (plus one bug fix)
- **Planned at**: commit `afb5b80`, 2026-11-26
- **Design spec**: workspace board on the canvas, https://claude.ai/artifact/WQSZuvHz6cTgGYEVFcJCGg (the facts you need are copied below)

## Stacking

A coach scouting opponents asked for five changes. They ship as five stacked
PRs, each branched from the one before:

| Plan | What | Files it touches that this plan also touches |
|---|---|---|
| **044 (this one)** | Card inline edit, plus `onClipsChanged` fix | n/a |
| 045 | Sidebar Filter button, popover and chips | `ClipLibrary.tsx` (toolbar and filter state), `ClipLibrary.module.css`, all 11 locales |
| 046 | Bottom clip list width control and readable rows | locales |
| 047 | Court map: a dot click plays its clip in Stats; "Shot chart" renamed "Court map" | locales |
| 048 | Layout presets Tag / Study / Scout | locales |

Nothing comes before this plan. Keep your `ClipLibrary.tsx` edits inside the
card block (the `sortedClips.map` in the grid branch), the handler
`handleUpdateClip`/`handleUpdateEach`, and the imports, so 045's toolbar
rewrite rebases cleanly on top. Add locale keys inside the existing
`app.clips.table` object only.

## Why this matters

A coach can fix a typo in a clip title only from the table view. The card
grid, which is the default view, shows the title and notes as plain text with
no way to change them, so the coach has to switch views, find the row, edit,
and switch back. The design pick (round 0, binding) is that cards edit title
and notes in place: click the text, type, "Enter saves, Esc cancels", the same
behaviour as the table.

There is also a bug on the existing table path. `handleUpdateClip` in
`ClipLibrary.tsx` writes the edit and patches the library's own `clips` state,
but never calls `onClipsChanged()`. `App.tsx` holds a second copy of the clips
for the Timeline and the Stats dashboard, and that copy only reloads when
`onClipsChanged` bumps `refreshTrigger`. So today a title edited in the table
still shows the old title on the Timeline marker tooltip and in Stats until
something else forces a reload. `handleUpdateEach` (bulk status and category)
has the same gap, and a status or category change is exactly what Stats counts.

## Current state (at `afb5b80`)

### Files in play

- `src/renderer/components/ClipLibrary.tsx` (1194 lines): loads clips,
  filters, sorts, exports, renders the card grid or `<ClipTable>`.
  - Local `Clip` interface at lines 67-84 (`title: string`, `notes?: string`).
    `ClipTable.tsx` imports it as a type from here.
  - Props at 86-94: `onClipsChanged: () => void` with the doc comment
    "Clips were deleted here, so the timeline's copy is stale."
  - `loadData()` at 164-180 refetches clips, categories and players. The
    `useEffect` at 160-162 runs it whenever the `onRefresh` prop changes.
  - `handleDeleteClip` at 280-292 calls `onClipsChanged()` after a delete.
  - `handleUpdateClip` at 294-307:
    ```ts
    // The first renderer caller of updateClip. Local state is patched rather than
    // reloading everything: a reload would refetch clips, categories and players
    // over IPC on every committed edit. The catch resyncs, so a rejected write
    // never leaves a value on screen that the database does not hold.
    const handleUpdateClip = async (id: number, updates: Partial<Clip>) => {
      try {
        await window.electronAPI.updateClip(id, updates);
        setClips(prev => prev.map(c => (c.id === id ? { ...c, ...updates } : c)));
      } catch (error) {
        console.error("Error updating clip:", error);
        showError(withCause(t("app.clips.table.saveError"), error));
        await loadData();
      }
    };
    ```
  - `handleUpdateEach` at 309-338: `Promise.allSettled` over `updateClip`,
    patches local state, shows a success or partial-failure toast. No
    `onClipsChanged()`.
  - `handleDeleteMany` at 340-366 ends with `onClipsChanged();`.
  - The card grid at 1070-1163. The parts this plan changes:
    ```tsx
    {/* Clip Info */}
    <div className={styles.clipInfo}>
      <h4 className={styles.clipTitle}>{clip.title}</h4>
      {/* Categories */}
      <div className={styles.clipCategories}> ... </div>
      {/* Notes */}
      {clip.notes && (
        <div className={styles.clipNotes}>{clip.notes}</div>
      )}
      {/* Metadata */}
      <div className={styles.clipMetadata}> ... </div>
    </div>
    ```
    A card with no notes renders nothing for notes, so there is no place to
    add one today.
- `src/renderer/components/ClipTable.tsx` (562 lines): the table view. Its
  edit logic is what this plan extracts:
  - State at 73-77: `editing: { id: number; field: "title" | "notes" } | null`
    and `draft: string`.
  - `startEdit` / `commitEdit` / `onEditKeyDown` at 170-198:
    ```ts
    const startEdit = (clip: Clip, field: "title" | "notes") => {
      setEditing({ id: clip.id, field });
      setDraft(field === "title" ? clip.title : clip.notes || "");
    };

    const commitEdit = (clip: Clip) => {
      if (!editing) return;
      const field = editing.field;
      const value = draft.trim();
      const current = field === "title" ? clip.title : clip.notes || "";
      setEditing(null);

      // An empty title would leave the clip unidentifiable in the export
      // filenames, so it reverts. An empty note is a legitimate value.
      if (field === "title" && value === "") return;
      if (value === current) return;

      void onUpdate(clip.id, { [field]: value } as Partial<Clip>);
    };

    const onEditKeyDown = (event: React.KeyboardEvent, clip: Clip) => {
      if (event.key === "Enter") {
        event.preventDefault();
        commitEdit(clip);
      } else if (event.key === "Escape") {
        event.preventDefault();
        setEditing(null);
      }
    };
    ```
  - `isEditingTitle` / `isEditingNotes` at 364-367; the title `<input>` at
    384-394 and notes `<input>` at 479-490 use `value={draft}`, `autoFocus`,
    `onBlur={() => commitEdit(clip)}`, `onKeyDown={event => onEditKeyDown(event, clip)}`.
- `src/renderer/App.tsx`:
  - `refreshTrigger` state at line 70; the effect at 165-182 reloads App's own
    `clips` and `categories` when it changes.
  - `const refreshClips = useCallback(() => setRefreshTrigger(prev => prev + 1), []);` at 605.
  - `<Timeline clips={gameClips} ...>` at 827 and `<StatsDashboard clips={...clips...}>` at 1130 read App's copy.
  - `<ClipLibrary onRefresh={refreshTrigger} ... onClipsChanged={refreshClips}>` at 861-867.
    So calling `onClipsChanged()` also reloads the library itself through `onRefresh`.
  - The global shortcut handlers (App.tsx:222-230, VideoPlayer.tsx:490-498)
    already ignore keys whose target is an `HTMLTextAreaElement`, so typing in
    a textarea will not trigger playback shortcuts.
- `src/renderer/components/Timeline.tsx:565`: each marker has
  `title={`${clip.title} (${formatTime(...)}`}`. This is what the manual check
  uses to prove an edit reached the Timeline.
- `src/renderer/styles/ClipLibrary.module.css`:
  - `.clipTitle` at 231-244: semibold, `--font-size-md`, `-webkit-line-clamp: 2`, `word-break: break-word`.
  - `.clipNotes` at 259-271: `--font-size-xs`, `--text-secondary`, `-webkit-line-clamp: 3`.
- `src/renderer/styles/ClipTable.module.css:149-187`: `.cellButton` (transparent
  1px border, `cursor: text`, border turns `--border-color-hover` on hover,
  focus-visible outline `var(--focus-ring-width) solid var(--focus-ring-color)`)
  and `.cellInput` (`--bg-primary`, 1px `--color-primary` border). Copy these
  patterns for the card styles.
- Pure-module test pattern: `src/renderer/utils/projectPlayback.ts` with
  `projectPlayback.test.mts` next to it (imports `./projectPlayback.ts` with the
  `.ts` extension, uses `node:test` and `node:assert/strict`). `npm test` picks
  up `src/renderer/utils/*.test.mts` automatically. Test files import nothing
  from `node_modules`.
- Existing locale keys you reuse (all under `app.clips.table`, present in all
  11 files): `editTitle` ("Edit title"), `editNotes` ("Edit notes"),
  `notesPlaceholder` ("Add a note"), `saveError`.

### How notes are used, and why Enter saves in the notes field

Notes can already hold line breaks: the cut form (`ClipCreator.tsx:673-686`)
uses a `<textarea rows={3}>` whose Enter inserts a newline. The exports cope
with that: CSV quotes any cell with `\n` (`src/main/clipsData.ts:57-64`), the
XML export trims the note into a label (`main.ts:2052`), and the scouting
report escapes it into an HTML table cell (`src/shared/scoutingReport.ts:78`),
where it collapses to a space.

Decision for the card's notes field: **Enter saves, Shift+Enter inserts a line
break, Escape cancels.** Reasons: the hint the board shows ("Enter saves")
stays true for both fields; the table's rule (Enter commits) stays the rule
everywhere; and the notes field is a `<textarea>`, so a note that already has
line breaks from the cut form is shown and kept intact instead of flattened.
The notes hint says so: "Enter saves, Shift+Enter adds a line, Esc cancels".

### Design spec (from the workspace board, binding)

- Click the title: it becomes a field with a 1px teal border
  (`--color-primary`) and the focus ring, same font as the title. Under it,
  in `--font-size-xs`, `--text-secondary`: "Enter saves, Esc cancels".
- Hovering a card shows the notes as a field you can click: a 1px dashed
  `--border-color-hover` border, `cursor: text`. A card with no notes shows a
  muted "Add a note" in that same spot on hover or keyboard focus.
- Radii 1px, no shadows, tokens only, never raw hex.
- PRODUCTION.md finish note, raised by three critics: the rename field must
  show the whole title while editing. A single-line `<input>` in a ~180px
  card column hides most of a 40-character title. This plan uses a
  `<textarea>` that wraps and grows to fit its content (Electron 28 is
  Chromium 120, which has no `field-sizing: content`, so the growth is three
  lines of JS). The caret starts at the end.
- Out of scope from the same board: the card's new horizontal layout, the
  hover-only play and delete buttons. Only the editing is in this plan.

## Commands you will need

Run from the repo root (`app/`, or the worktree).

| Purpose | Command | Expected on success |
|---|---|---|
| Typecheck (main and renderer, one tsconfig) | `npx tsc --noEmit -p .` | exit 0, no output |
| Unit tests | `npm test` | all pass, including the new `inlineEdit` tests |
| Locale parity | `npm run lint:locales` | exit 0 |
| Renderer bundle | `npm run build:renderer` | webpack "compiled successfully" (size warnings for the 3D chunk are normal) |
| Full build | `npm run build` | exit 0 |
| Packaged app for the manual check | `npm run package` | an app under `out/` |

Shell rules: plain commands only, never `bash -c` or `eval`; copy with
`/bin/cp -f`; `rm` is aliased to interactive here, so use `command rm`.

## Scope

**In scope** (the only files you should modify or create):
- `src/renderer/utils/inlineEdit.ts` (create): the pure commit rules
- `src/renderer/utils/inlineEdit.test.mts` (create)
- `src/renderer/hooks/useInlineEdit.ts` (create): the editing state both views share
- `src/renderer/components/ClipTable.tsx`: switch to the hook, no visible change
- `src/renderer/components/ClipLibrary.tsx`: card editing, and the `onClipsChanged` fix
- `src/renderer/styles/ClipLibrary.module.css`: card editing styles
- `src/i18n/locales/{en,pt,es,fr,de,it,sl,sr,lt,tr,el}.json`: two new keys

**Out of scope** (do NOT touch):
- `src/main/*`, `preload.ts`, `global.d.ts`: the `update-clip` IPC path
  already validates and writes title and notes. No new field, so the three
  `Clip` copies stay as they are.
- `ClipTable`'s markup and CSS. Its notes cell stays a single-line `<input>`;
  see Maintenance notes for the known line-break issue there.
- The card layout redesign on the board, the Filter popover (plan 045), any
  App.tsx change. `refreshClips` already does what is needed.
- Editing categories, status or players from the card.

## Git workflow

- Branch: `feat/card-inline-edit` from `main` at `afb5b80` or later.
- One commit is fine; conventional commits, squash-merged. Example from the
  log: `fix(projects): reopen projects with a missing game and validate imports (#87)`.
  Suggested message: `feat(clips): edit title and notes from the card view`.
- Do not push or open a PR unless the operator told you to.

## Steps

### Step 0: Install dependencies

The worktree has no `node_modules`, so `tsc` and the build fail until you
install. From the worktree root, with the Node version from `.nvmrc` (22):

1. `nvm use` (or select Node 22 another way; `node --version` should print `v22.x`)
2. `npm ci`

**Verify**: `npm ci` exits 0 (its `postinstall` rebuilds `better-sqlite3`).
`npx tsc --noEmit -p .` exits 0 on the untouched tree.

### Step 1: Pure commit rules in `src/renderer/utils/inlineEdit.ts`, with tests

Create the module. It must not import React or anything from `components/`.

```ts
export type EditField = "title" | "notes";

/** The text a field starts from when editing opens. */
export const draftFor = (
  field: EditField,
  clip: { title: string; notes?: string | null },
): string => (field === "title" ? clip.title : clip.notes || "");

/**
 * What a committed draft writes, or null when nothing should be written.
 * The draft is trimmed. An empty title reverts, because a clip without a
 * title cannot be told apart in export filenames; an empty note is a real
 * value. A value equal to the current one is skipped. Line breaks in a title
 * (pasted text) become single spaces.
 */
export const editedValue = (
  field: EditField,
  draft: string,
  current: string | null | undefined,
): string | null => { ... };

/** What a key does in an open editor. Shift+Enter is a newline in notes. */
export const editKeyAction = (
  field: EditField,
  key: string,
  shiftKey: boolean,
): "commit" | "cancel" | null => { ... };
```

Rules, exactly:
- `editedValue`: `value = draft.trim()`; for `"title"` also
  `value = value.replace(/\s*[\r\n]+\s*/g, " ")`. Return `null` if
  `field === "title" && value === ""`. Return `null` if
  `value === (current ?? "")`. Otherwise return `value`. (The comparison is
  against the untrimmed current value, as ClipTable does today.)
- `editKeyAction`: `"Escape"` gives `"cancel"`. `"Enter"` gives `"commit"`
  unless `field === "notes" && shiftKey`, which gives `null`. Any other key
  gives `null`.

Create `src/renderer/utils/inlineEdit.test.mts` modelled on
`projectPlayback.test.mts` (`import { ... } from "./inlineEdit.ts";`). Cases:
1. title trimmed: `editedValue("title", "  Drag  ", "Old")` is `"Drag"`.
2. empty title reverts: `editedValue("title", "   ", "Old")` is `null`.
3. empty note allowed: `editedValue("notes", "  ", "was here")` is `""`.
4. unchanged skipped: `editedValue("title", "Old ", "Old")` is `null`;
   `editedValue("notes", "", undefined)` is `null`; `editedValue("notes", "", null)` is `null`.
5. note keeps interior line breaks: `editedValue("notes", "a\nb", "")` is `"a\nb"`.
6. title line breaks become spaces: `editedValue("title", "Q3\nsteal", "x")` is `"Q3 steal"`.
7. keys: Enter commits both fields; Shift+Enter commits a title and is `null`
   for notes; Escape cancels both; `"a"` is `null`.
8. `draftFor("notes", { title: "t" })` is `""`; `draftFor("title", { title: "t", notes: "n" })` is `"t"`.

**Verify**: `npm test` → all pass; the output lists the new test names.
`npx tsc --noEmit -p .` → exit 0.

### Step 2: Shared editing state in `src/renderer/hooks/useInlineEdit.ts`

The hook holds what ClipTable keeps in `editing`/`draft` today and applies the
rules from step 1. Shape:

```ts
type EditableClip = { id: number; title: string; notes?: string | null };
type EditUpdate = { title?: string; notes?: string };

export function useInlineEdit(
  onUpdate: (id: number, updates: EditUpdate) => Promise<void> | void,
) {
  // returns:
  // editing: { id: number; field: EditField } | null
  // draft: string, setDraft
  // isEditing(id, field): boolean
  // start(clip, field)
  // cancel()
  // commit(clip)
  // onKeyDown(event: React.KeyboardEvent, clip)
  // editorRef: a stable callback ref for a <textarea>
}
export function autoGrow(el: HTMLTextAreaElement): void
```

Requirements:
- Mirror `editing` in a ref (`editingRef`). `start(clip, field)` sets the ref
  and the state together: `editingRef.current = { id: clip.id, field }`, then
  `setEditing(...)` with the same object and `setDraft(draftFor(field, clip))`.
  `commit` reads the ref, returns if
  it is null, sets the ref to null **before** calling `setEditing(null)`, then
  calls `editedValue(field, draft, current)` with `current` from the clip
  (`clip.title` or `clip.notes`). When the result is not `null`, build the
  update explicitly, with no cast:
  `const update: EditUpdate = field === "title" ? { title: value } : { notes: value };`
  and call `void onUpdate(clip.id, update)`. `cancel` also sets the ref to null first. This makes the second
  call a no-op when Enter commits and the unmounting field then fires blur,
  and stops a blur from saving a draft the user just cancelled with Escape.
  ClipTable today has no such guard and relies on the closure's `editing`.
- `onKeyDown` uses `editKeyAction(field, event.key, event.shiftKey)`; on
  `"commit"` or `"cancel"` it calls `event.preventDefault()` and then
  `commit(clip)` / `cancel()`. On `null` it does nothing (Shift+Enter inserts
  the newline natively).
- `editorRef` is a `useCallback(el => { ... }, [])` with no deps, so it runs
  once per mounted field and does not move the caret on every keystroke. For
  a `HTMLTextAreaElement` it calls `el.focus()`, puts the caret at the end
  (`el.setSelectionRange(el.value.length, el.value.length)`) and `autoGrow(el)`.
  It must ignore non-textarea elements (ClipTable's inputs keep `autoFocus`).
- `autoGrow(el)`: `el.style.height = "auto"; el.style.height = `${el.scrollHeight + el.offsetHeight - el.clientHeight}px`;`
  `scrollHeight` excludes the border, so adding `offsetHeight - clientHeight`
  (the two 1px borders) keeps the last line from being clipped.

Then switch `ClipTable.tsx` to it: delete the `editing`/`draft` state and
`startEdit`/`commitEdit`/`onEditKeyDown`, call
`const edit = useInlineEdit(onUpdate);`, and use `edit.isEditing(clip.id, "title")`,
`edit.draft`, `edit.setDraft`, `edit.start(clip, "title")`, `edit.commit(clip)`,
`edit.onKeyDown(event, clip)` in the two cells. The inputs keep `autoFocus`
and their current markup and classes. Do not pass `editorRef` to them.

**Verify**: `npx tsc --noEmit -p .` → exit 0.
`grep -n "draft.trim\|setEditing" src/renderer/components/ClipTable.tsx` → no
matches (the logic lives in the hook and the util only).
`grep -rn "draft.trim" src/renderer` → exactly one match, in `utils/inlineEdit.ts`.

### Step 3: Make edits reach Timeline and Stats

In `ClipLibrary.tsx`:
- `handleUpdateClip`: after the `setClips(...)` line inside `try`, call
  `onClipsChanged();`. Keep the local patch so the card shows the new value
  before the reload returns. Replace the comment above it with one that
  says why both happen, for example: "Patched locally so the edit shows at
  once, then onClipsChanged so App reloads the copy Timeline and Stats read.
  That also reloads this list through onRefresh. The catch resyncs, so a
  rejected write never leaves a value on screen that the database does not
  hold."
- `handleUpdateEach`: call `onClipsChanged();` once after the `setClips(...)`
  when at least one entry landed (`applied.size > 0`). This goes beyond the
  reported bug (which named only `handleUpdateClip`), so list it as extra
  scope in the PR body: "Also fixes bulk status/category edits from the
  table not reaching Timeline and Stats (`handleUpdateEach`)."
- Update the prop's doc comment at line 89 from "Clips were deleted here, so
  the timeline's copy is stale." to "Clips were edited or deleted here, so
  App's copy (Timeline, Stats) is stale."

**Verify**: `grep -n "onClipsChanged()" src/renderer/components/ClipLibrary.tsx`
→ four matches (delete, update, update-each, delete-many).
`npx tsc --noEmit -p .` → exit 0. The proof that the fix works is manual
check 7 in the test plan; there is no React test harness in this repo.

### Step 4: Card editing in `ClipLibrary.tsx` and its CSS

In `ClipLibrary.tsx`:
- `import { useInlineEdit, autoGrow } from "../hooks/useInlineEdit";`
- Near the other hooks: `const edit = useInlineEdit(handleUpdateClip);`
  and `const editHintId = useId();` (add `useId` to the React import). Only
  one field edits at a time, so one id is enough. `handleUpdateClip` is
  declared with `const` further down; place the `useInlineEdit` call after
  its declaration.
- Replace `<h4 className={styles.clipTitle}>{clip.title}</h4>` with:
  - when `edit.isEditing(clip.id, "title")`:
    ```tsx
    <div className={styles.inlineEditor}>
      <textarea
        ref={edit.editorRef}
        rows={1}
        className={`${styles.inlineInput} ${styles.inlineTitleInput}`}
        value={edit.draft}
        onChange={event => { edit.setDraft(event.target.value); autoGrow(event.target); }}
        onBlur={() => edit.commit(clip)}
        onKeyDown={event => edit.onKeyDown(event, clip)}
        aria-label={t("app.clips.table.editTitle")}
        aria-describedby={editHintId}
      />
      <div id={editHintId} className={styles.editHint}>{t("app.clips.table.editHint")}</div>
    </div>
    ```
  - otherwise: `<h4 className={styles.clipTitle}>` containing a
    `<button type="button" className={styles.clipTitleButton} title={clip.title}
    onClick={() => edit.start(clip, "title")}
    aria-label={`${t("app.clips.table.editTitle")}: ${clip.title}`}>{clip.title}</button>`.
- Replace the `{clip.notes && (<div className={styles.clipNotes}>...)}` block with:
  - when `edit.isEditing(clip.id, "notes")`: the same `inlineEditor` wrapper
    with a `<textarea rows={2}>` using `styles.inlineInput` and
    `styles.inlineNotesInput`, `placeholder={t("app.clips.table.notesPlaceholder")}`,
    `aria-label={t("app.clips.table.editNotes")}`, the same `ref`, `onChange`,
    `onBlur`, `onKeyDown`, `aria-describedby`, and the hint text
    `t("app.clips.table.editHintNotes")`.
  - else if `clip.notes`: `<button type="button" className={`${styles.clipNotes} ${styles.clipNotesButton}`}
    title={clip.notes} onClick={() => edit.start(clip, "notes")}
    aria-label={t("app.clips.table.editNotes")}>{clip.notes}</button>`.
  - else: `<button type="button" className={styles.addNoteButton}
    onClick={() => edit.start(clip, "notes")}>{t("app.clips.table.notesPlaceholder")}</button>`.
- Add `white-space: pre-line` to the notes button so a note with line breaks
  shows them on the card.

In `ClipLibrary.module.css`, add (tokens only, `border-radius: var(--radius-sm)`,
no shadows; check `--radius-sm` exists in `variables.css` and use the token
that `ClipTable.module.css` uses for `.cellButton` if it differs):
- Move the line-clamp from `.clipTitle` to a new `.clipTitleButton`
  (`display: -webkit-box; -webkit-line-clamp: 2; line-clamp: 2;
  -webkit-box-orient: vertical; overflow: hidden; word-break: break-word;`).
  A button inside a clamped `-webkit-box` counts as one atomic line, so the
  clamp has to sit on the button. Keep the typography on `.clipTitle`.
- `.clipTitleButton`, `.clipNotesButton`, `.addNoteButton`: reset like
  `.cellButton` (`display: block` for `.addNoteButton` only. `.clipTitleButton`
  and `.clipNotesButton` keep `display: -webkit-box`, so the title's 2-line
  clamp and the notes' 3-line clamp from `.clipNotes` survive; do not put a
  `display` declaration on `.clipNotesButton` that would override `.clipNotes`.
  `width: 100%`, `text-align: left`, `background: none`, `font: inherit`,
  `color: inherit`, `padding: 2px var(--spacing-xs)`, `margin: 0 calc(-1 * var(--spacing-xs))`
  so text stays aligned with the card's other lines, `cursor: text`,
  `border: 1px solid transparent`).
- `.clipCard:hover .clipNotesButton, .clipNotesButton:focus-visible`:
  `border: 1px dashed var(--border-color-hover);`. Title button on hover:
  `border-color: var(--border-color-hover)` (solid, as in the table).
- `.addNoteButton`: `color: var(--text-muted); font-size: var(--font-size-xs);`
  and `opacity: 0` until `.clipCard:hover .addNoteButton, .clipCard:focus-within .addNoteButton`
  sets `opacity: 1`. It stays in the tab order, so keyboard users reach it.
  Because it is hidden with `opacity` and not `display: none`, it keeps its
  line in the card while invisible. That is intended: the prompt appears in
  that same spot on hover or focus, and the card height does not jump.
- All three buttons: `:focus-visible { outline: var(--focus-ring-width) solid var(--focus-ring-color); outline-offset: 1px; }`.
- `.inlineEditor`: `display: flex; flex-direction: column; gap: 3px;`.
- `.inlineInput`: `width: 100%; resize: none; overflow: hidden;
  background: var(--bg-primary); border: 1px solid var(--color-primary);
  border-radius: var(--radius-sm); color: var(--text-primary); font: inherit;
  padding: 2px var(--spacing-xs); line-height: var(--line-height-normal);`
  plus the same `:focus-visible` outline.
- `.inlineTitleInput`: `font-weight: var(--font-weight-semibold); font-size: var(--font-size-md);`
- `.inlineNotesInput`: `font-size: var(--font-size-xs); color: var(--text-secondary); line-height: var(--line-height-relaxed);`
- `.editHint`: `font-size: var(--font-size-xs); color: var(--text-secondary);`

**Verify**: `npx tsc --noEmit -p .` → exit 0. `npm run build:renderer` →
compiled successfully. `grep -nE "#[0-9a-fA-F]{3,6}\b" src/renderer/styles/ClipLibrary.module.css`
shows no line you added.

### Step 5: Two locale keys in all 11 files

Add to the `app.clips.table` object, right after `"editNotes"`, in every
locale file. en and pt are hand-written; the other nine are machine
translations (say so in the PR description).

| File | `editHint` | `editHintNotes` |
|---|---|---|
| en | Enter saves, Esc cancels | Enter saves, Shift+Enter adds a line, Esc cancels |
| pt | Enter guarda, Esc cancela | Enter guarda, Shift+Enter muda de linha, Esc cancela |
| es | Intro guarda, Esc cancela | Intro guarda, Mayús+Intro añade una línea, Esc cancela |
| fr | Entrée enregistre, Échap annule | Entrée enregistre, Maj+Entrée ajoute une ligne, Échap annule |
| de | Enter speichert, Esc bricht ab | Enter speichert, Umschalt+Enter fügt eine Zeile ein, Esc bricht ab |
| it | Invio salva, Esc annulla | Invio salva, Maiusc+Invio va a capo, Esc annulla |
| sl | Enter shrani, Esc prekliče | Enter shrani, Shift+Enter doda vrstico, Esc prekliče |
| sr | Enter čuva, Esc otkazuje | Enter čuva, Shift+Enter dodaje red, Esc otkazuje |
| lt | Enter išsaugo, Esc atšaukia | Enter išsaugo, Shift+Enter prideda eilutę, Esc atšaukia |
| tr | Enter kaydeder, Esc iptal eder | Enter kaydeder, Shift+Enter satır ekler, Esc iptal eder |
| el | Enter για αποθήκευση, Esc για ακύρωση | Enter για αποθήκευση, Shift+Enter για νέα γραμμή, Esc για ακύρωση |

(`sr.json` is written in Latin script; keep it that way.)

**Verify**: `npm run lint:locales` → exit 0.
`grep -c "\"editHint\"" src/i18n/locales/*.json` → 1 in each of the 11 files.

### Step 6: Full checks and the manual pass

**Verify**: `npm test`, `npx tsc --noEmit -p .`, `npm run build` all exit 0.
Then run the manual checks below in the packaged app.

## Test plan

**Unit** (`src/renderer/utils/inlineEdit.test.mts`, step 1): the eight cases
listed there. They cover trimming, empty-title revert, empty note allowed,
unchanged skipped (including `undefined` and `null` notes), line breaks kept
in notes and flattened in titles, and the key map.

**Manual, in the running app.** `npm run package`, then launch the binary in
`out/` with `--user-data-dir=<a scratch folder>` and
`--remote-debugging-port=9222` (see `CLAUDE.md`). Create a project on any
short video and cut three clips: one with a long title (over 40 characters),
one with a two-line note (Enter in the cut form's notes box), one with no
note. Stay in Cards view.

1. Click the long title. The field shows the whole title wrapped over
   several lines, the caret is at the end, and "Enter saves, Esc cancels"
   shows under it. Type " #7", press Enter. The card shows the new title.
2. Click the title, type "zzz", press Escape. The old title is back. Reload
   the window (Cmd+R): still the old title. (This proves blur-on-unmount did
   not save the cancelled draft.)
3. Click the title, clear it, click elsewhere. The old title is back.
4. Click the title, add a trailing space only, press Enter. The title is
   unchanged and no error toast appears. (The unit tests prove the write is
   skipped; this only confirms the card wiring uses them.)
5. On the clip with the two-line note: the card shows both lines. Click
   the note; the field shows both lines and the hint
   "Enter saves, Shift+Enter adds a line, Esc cancels". Shift+Enter adds a
   third line; Enter saves. Export "Data (CSV)" and open it: the note cell
   has three lines inside one quoted cell.
6. On the clip with no note: hover the card, "Add a note" appears. Tab
   to it with the keyboard (it shows the focus ring), press Enter, type,
   press Enter. The note shows on the card. Clear it again and press
   Enter: the note is gone and "Add a note" is back on hover.
7. **The `onClipsChanged` fix.** Rename a clip on the card to
   "Renamed on card". Without reloading, over CDP evaluate
   `!!document.querySelector('[title^="Renamed on card ("]')` → `true`
   (the Timeline marker's tooltip). Then switch to Table, use the row's
   category picker to add a second category to one clip, and open Stats
   without reloading: that category's count went up by one. On `afb5b80`
   the evaluate returns `false` and the Stats count is unchanged; run it
   there once if you want the before/after.
8. Switch to Table view and repeat checks 1 to 3 on a row. Behaviour
   matches what it was before this plan.
9. Light theme (Settings): the field border, hint and dashed hover border
   are visible.

## Done criteria

- [ ] `npm test` exits 0, and `src/renderer/utils/inlineEdit.test.mts` exists with the eight cases
- [ ] `npx tsc --noEmit -p .` exits 0
- [ ] `npm run lint:locales` exits 0; `grep -c "\"editHintNotes\"" src/i18n/locales/*.json` is 1 per file
- [ ] `npm run build` exits 0
- [ ] `grep -rn "draft.trim" src/renderer` returns one line, in `src/renderer/utils/inlineEdit.ts`
- [ ] `grep -n "onClipsChanged()" src/renderer/components/ClipLibrary.tsx` returns four lines
- [ ] `grep -n "useInlineEdit" src/renderer/components/ClipTable.tsx src/renderer/components/ClipLibrary.tsx` matches in both files
- [ ] `git status` shows changes only to files in the Scope list (changes under `plans/` do not count)
- [ ] Manual checks 1 to 9 pass; check 7 evaluates to `true`
- [ ] The coordinator has already added a row for 044 to `plans/README.md`; update that row's Status column (do not add a new row)

## STOP conditions

- The excerpts in "Current state" do not match the code (especially
  `handleUpdateClip`, ClipTable's `commitEdit`, or the card block).
- `onClipsChanged` in `App.tsx` no longer bumps the same `refreshTrigger` that
  feeds ClipLibrary's `onRefresh`, or Timeline/Stats no longer read App's
  `clips`. The fix in step 3 assumes both.
- Manual check 2 saves the cancelled draft even with the ref guard. Report
  what event fired; do not add timers to paper over it.
- After step 3, an edit in the table makes the row jump or lose focus
  because the reload re-sorts while the user is still editing another
  field. Report it instead of removing the `onClipsChanged` call.
- The textarea will not grow (`scrollHeight` stays one line) in the packaged
  app. Report it rather than falling back to a fixed-height input, since the
  whole-title requirement comes from three critics.
- Any step needs a change in `src/main`, `preload.ts` or `global.d.ts`.

## Maintenance notes

- The commit rules now live in `src/renderer/utils/inlineEdit.ts` and the
  editing state in `src/renderer/hooks/useInlineEdit.ts`. A third editable
  field (say the clip's quarter) should extend `EditField` there, not copy
  the logic into a component.
- Every committed edit now triggers one reload in App and one in
  ClipLibrary (clips, categories, players over IPC). An unchanged value
  still skips the write and the reload. If a project with thousands of clips
  makes this slow, replace the call with a narrower `onClipUpdated(id, updates)`
  prop that patches App's `clips` in place. The table's category popover
  calls `onUpdate` once per checkbox, so it reloads once per tick.
- Known issue left for a follow-up: ClipTable's notes cell is a single-line
  `<input>`. A browser strips line breaks from an input's value, so editing a
  multi-line note there and typing a character flattens the note on save.
  The fix is to give that cell a textarea with `editorRef`, or to show a
  multi-line note read-only in the table. Not done here to keep the table
  untouched.
- Reviewer focus: the ref guard in `useInlineEdit` (Enter then blur must
  write once; Escape then blur must write nothing), and that ClipTable's
  visible behaviour did not change.
- Plans 045 to 048 stack on this branch. 045 rewrites the ClipLibrary
  toolbar and adds locale keys next to these.

## Plan review

Reviewed 2026-11-26. All eight findings were applied: the notes clamp, Step 0
`npm ci`, `start` setting ref and state together, the explicit update object,
the border-aware `autoGrow`, the "Add a note" line kept on purpose, the
README row and the `plans/` exclusion, and `handleUpdateEach` named as extra
scope. None contested.
