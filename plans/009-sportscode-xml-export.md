# Plan 009: Export clips as Hudl Sportscode-compatible XML

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md`.
>
> **Drift check (run first)**:
> `cd app && git diff --stat 717500b..HEAD -- src/main/main.ts src/main/preload.ts src/types/global.d.ts src/renderer/components/ClipLibrary.tsx`
> If any in-scope file changed since this plan was written, compare the
> "Current state" excerpts against the live code; on a mismatch, treat it as
> a STOP condition.

## Status

- **Priority**: P3
- **Effort**: M
- **Risk**: MED (interop format consumed by third-party software; correctness
  of the XML matters more than the code)
- **Depends on**: none (006 recommended first — both touch main.ts export
  handlers; land 006, then this, and re-run the drift check)
- **Category**: direction (interop — feeds club Hudl/Sportscode seats)
- **Planned at**: app repo commit `717500b`, 2026-07-10

## Why this matters

Many clubs have one Hudl Sportscode (or Angles) seat. The XML timeline
interchange format those tools import is simple and widely supported across
sports-analysis software. If this app can hand its tag timeline to that
ecosystem, it becomes the free capture/tagging front-end for clubs that
already paid for analysis software — a reason to adopt it rather than a
competitor. The app already exports CSV/JSON; this adds one more serializer on
the same code path.

## Current state

**App repo (`app/`).**

- The pattern to copy — `ipcMain.handle("export-clips-data", ...)` at
  `src/main/main.ts:1418-1503`: takes `projectId`, builds a `categoryMap`
  (id→name) from `getCategoriesHierarchical(projectId)` (see the lines just
  above `:1440` and the identical map-building in `save-session` at
  `:1514-1523`), opens `dialog.showSaveDialog` with extension filters,
  serializes `getClips(projectId)`, writes with `fs.writeFileSync`, returns
  `{ filePath, count }`. Clip categories/players are JSON TEXT columns parsed
  with try/catch (`:1449-1453`).
- Preload + types pattern: `src/main/preload.ts:222`
  `exportClipsData: (projectId) => ipcRenderer.invoke("export-clips-data", projectId)`;
  `src/types/global.d.ts:125`
  `exportClipsData: (projectId: number) => Promise<{ filePath: string; count: number } | null>`.
- Renderer: the Export dropdown in
  `src/renderer/components/ClipLibrary.tsx:453-515` has three menu items —
  "Export video files", "Export CSV/JSON" (`:489-500`, calls
  `handleExportData` defined at `:358`), "Save session". The success toast in
  `handleExportData` (`:365`) uses
  `t("app.clips.exportDataSuccess", { count, path })` — reuse that key.
- Clip fields available: `title`, `start_time` / `end_time` (seconds, REAL),
  `categories` / `players` (JSON TEXT of ids), `quarter` (TEXT | null),
  `notes`. Category rows have `color` (hex string like `#4CAF50`).
  Player rows have `name` and `number`.
- i18n: 11 locales; one new key (menu label) — en+pt below, translate the rest.

### The XML format (authoritative for this plan — do not improvise)

The Sportscode timeline interchange format:

```xml
<?xml version="1.0" encoding="UTF-8"?>
<file>
  <ALL_INSTANCES>
    <instance>
      <ID>1</ID>
      <start>128.40</start>
      <end>136.20</end>
      <code>Made Shot</code>
      <label>
        <group>Category</group>
        <text>3pt</text>
      </label>
      <label>
        <group>Player</group>
        <text>7 Smith</text>
      </label>
      <label>
        <group>Quarter</group>
        <text>Q1</text>
      </label>
    </instance>
    <!-- one <instance> per clip, ID sequential from 1 -->
  </ALL_INSTANCES>
  <ROWS>
    <row>
      <code>Made Shot</code>
      <R>19532</R>
      <G>44975</G>
      <B>20560</B>
    </row>
    <!-- one <row> per distinct code, colors are 16-bit (0-65535) -->
  </ROWS>
</file>
```

Mapping rules (decided — implement as stated):

- `<code>` = the clip's **first** category's name; clips with zero parseable
  categories get code `"Untagged"`.
- Additional categories beyond the first → one `<label>` each with
  `<group>Category</group>`.
- Each tagged player → `<label>` with `<group>Player</group>` and text
  `"{number} {name}"` when number exists, else just the name.
- `quarter` (when non-null) → `<label>` with `<group>Quarter</group>`.
- `notes` (when non-empty) → `<label>` with `<group>Note</group>`.
- `<start>`/`<end>` = `start_time.toFixed(2)` / `end_time.toFixed(2)`
  (seconds relative to the source video — same video the Sportscode user will
  attach).
- `<ROWS>`: one row per distinct code in output order of first appearance;
  colors from the category's hex `color` converted per channel:
  `Math.round(parseInt(hex.slice(1,3),16) * 257)` (0–255 → 0–65535), G/B
  likewise. `"Untagged"` row: 32896/32896/32896 (mid gray). Guard malformed
  hex (fall back to gray).
- XML-escape every text value (`& < > " '` → entities). No other characters
  need escaping; keep UTF-8.
- Indentation/whitespace is cosmetic; importers ignore it.

## Commands you will need

| Purpose | Command | Expected on success |
|---|---|---|
| Install | `cd app && npm install` | exit 0 |
| Build (typecheck + bundle) | `cd app && npm run build` | exit 0 |
| Run app | `cd app && npm run dev` | app opens |
| XML well-formedness | `xmllint --noout <exported file>` | exit 0, silent |

(`xmllint` ships with macOS. If unavailable, use
`node -e 'new (require("@xmldom/xmldom").DOMParser)...'` only if that package
already exists in node_modules — otherwise any XML validator you have; state
which you used.)

## Scope

**In scope**:
- `src/main/main.ts` — new `export-clips-xml` handler (placed next to
  `export-clips-data`)
- `src/main/preload.ts`, `src/types/global.d.ts` — one method each
- `src/renderer/components/ClipLibrary.tsx` — one menu item + one handler
- `src/i18n/locales/*.json` (all 11) — one key

**Out of scope** (do NOT touch):
- The CSV/JSON export handler (plan 006 owns changes there).
- No XML library dependency — the format is small; hand-build with the
  escaping helper.
- No import of Sportscode XML (one-way export only).
- Video file re-encoding — this exports the timeline only.

## Git workflow

- App repo: branch `feat/sportscode-xml` off `main`. Conventional commits.
- Do NOT push or open a PR unless the operator instructed it.
- Do not mention AI tools in commit messages and do not add AI co-author lines.

## Steps

### Step 1: main-process handler

Add `ipcMain.handle("export-clips-xml", async (_event, projectId: number) => ...)`
directly after the `export-clips-data` handler. Structure it identically:
project/clips/categories fetch, id→name maps for categories AND players
(`getPlayers(projectId)` — id→`{name, number}`), save dialog with
`filters: [{ name: "XML", extensions: ["xml"] }]` and defaultPath
`<project name sanitized>-sportscode.xml` (copy the sanitize regex from
`save-session` `:1567`), then build the XML per the format section above and
`fs.writeFileSync(..., "utf-8")`. Return `{ filePath, count: clips.length }`.
Include a small local `escapeXml(s: string)` helper. Handle the canceled
dialog by returning `null` (same as the CSV handler).

**Verify**: `cd app && npm run build` → exit 0.

### Step 2: preload + types

`preload.ts`: `exportClipsXml: (projectId: number) => ipcRenderer.invoke("export-clips-xml", projectId),`
`global.d.ts`: `exportClipsXml: (projectId: number) => Promise<{ filePath: string; count: number } | null>;`

**Verify**: `cd app && npm run build` → exit 0.

### Step 3: renderer menu item + handler

In `ClipLibrary.tsx`: add `handleExportXml` modeled exactly on
`handleExportData` (`:358-373` — read it first): guard no project, call
`window.electronAPI.exportClipsXml(currentProject.id)`, on non-null result
`showSuccess(t("app.clips.exportDataSuccess", { count: result.count, path: result.filePath }))`,
catch → the same generic export error toast the sibling uses. Add a fourth
menu item after "Save session" (`:501-512`), same classes/roles
(`role="menuitem"`, `styles.exportMenuItem`, closes the menu first), icon
`faFileCode` from free-solid (fallback `faCode`), label
`t("app.clips.exportSportscode")`.

**Verify**: `cd app && npm run build` → exit 0.

### Step 4: i18n (all 11 locales)

`app.clips.exportSportscode` — en: `"Export Sportscode XML"`,
pt: `"Exportar XML Sportscode"` ("Sportscode" stays untranslated everywhere).
Translate the surrounding sentence structure for the other 9 if needed (it's
two words plus the product name — likely identical in most).

**Verify**: parity script (plan 001 Step 7) → key in all 11 files.

### Step 5: manual verification

`npm run dev`, project with ≥3 clips including: one multi-category clip, one
with players+quarter, one with a title containing `&` or `<`, one untagged:

1. Export menu → Export Sportscode XML → file written.
2. `xmllint --noout file.xml` → silent exit 0.
3. Open the file: sequential IDs from 1; first-category codes; extra
   categories/players/quarter/notes as labels; special characters escaped;
   ROWS has one entry per distinct code with 16-bit colors; untagged clip has
   code `Untagged`.
4. If you have access to any Sportscode/Angles/import-capable tool, try the
   import; otherwise state that real-tool import was not tested (expected —
   see Maintenance notes).

## Test plan

No test framework. Steps 1–5 verifications are the gates. Include in your
report: the first `<instance>` block of a real exported file and the xmllint
result.

## Done criteria

- [ ] `cd app && npm run build` exits 0
- [ ] `grep -n "export-clips-xml" src/main/main.ts src/main/preload.ts` → both present
- [ ] Fourth export menu item renders (grep `exportSportscode` in ClipLibrary.tsx)
- [ ] Exported file passes `xmllint --noout`
- [ ] Escaping verified with a `&`-containing title
- [ ] i18n key in all 11 locales
- [ ] No files outside the in-scope list are modified (`git status`)
- [ ] `plans/README.md` status row updated

## STOP conditions

Stop and report back if:

- The export dropdown structure (`:453-515`) or `handleExportData` no longer
  match the excerpts.
- You want to add an XML/npm dependency — out of scope by decision.
- You believe the XML format above is wrong for the target tool: do NOT
  substitute a format from memory; report the discrepancy with a source.

## Maintenance notes

- The format was specified from the widely-used Sportscode timeline
  interchange structure. The one real-world risk is a picky importer (e.g.
  requiring `SORT_INFO` or specific ordering). First user bug report should
  include their tool + version; add optional elements then, not preemptively.
- Ask a user with a real Sportscode seat to validate one exported file before
  announcing the feature (the website comparison pages should only claim
  "Sportscode XML export" after that).
- If plan 008 (shot chart) lands, court coordinates could map to Sportscode
  XY labels later — deferred until someone asks.
