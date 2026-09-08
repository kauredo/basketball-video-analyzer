# Plan 005: First-run onboarding — guided hint sequence, actionable empty states, reopenable instructions

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md`.
>
> **Drift check (run first)**:
> `cd app && git diff --stat 717500b..HEAD -- src/renderer/App.tsx src/renderer/components/VideoPlayer.tsx src/renderer/components/ClipLibrary.tsx src/renderer/components/ContextualHint.tsx src/i18n/locales/en.json`
> If any in-scope file changed since this plan was written, compare the
> "Current state" excerpts against the live code; on a mismatch, treat it as
> a STOP condition.

## Status

- **Priority**: P1
- **Effort**: M
- **Risk**: LOW
- **Depends on**: none (001 touches ClipLibrary.tsx and App.tsx too — if both
  plans run, land 001 first and re-run this plan's drift check)
- **Category**: direction (onboarding/retention)
- **Planned at**: app repo commit `717500b`, 2026-07-10

## Why this matters

A coach who exports one clip in their first session understands the app; one
who stares at panels without knowing the Z/M loop gives up. The app already has
the pieces — an `InstructionsModal` auto-shown on true first launch, a
dismiss-forever `ContextualHint` component, and empty states — but the hint
chain stops after "press Z/M" and the empty-state copy doesn't tell the user
the actual keys. This plan completes the guided loop (mark in → mark out →
clip appears → export), makes empty states actionable, and makes the
instructions reopenable (currently a first-launch-only modal that can never be
seen again).

## Current state

**App repo (`app/`).** All paths under `app/`.

- `src/renderer/components/ContextualHint.tsx` (49 lines) — props
  `{ hintId: string; message: string }`; persists dismissal in raw
  localStorage key `` `hint-dismissed-${hintId}` ``; renders lightbulb +
  message + dismiss button with **hardcoded** `aria-label="Dismiss hint"`
  (`:43`) — the only non-i18n'd string in the component.
- Existing hint usages (the pattern to follow):
  - `src/renderer/components/VideoPlayer.tsx:907-914` — "first-video" hint,
    gated by `showFirstVideoHint` state (`:97`), set true 2s after video load
    (`:349`); message interpolates the user's actual keys:
    `t("app.hints.markKeys", { markIn: keyBindings.markInKey.toUpperCase(), markOut: keyBindings.markOutKey.toUpperCase() })`
  - `src/renderer/components/ClipLibrary.tsx:754-760` — "first-clip" hint when
    `clips.length === 1`.
- `VideoPlayer.tsx` already has everything the new mark-out hint needs:
  `keyBindings` state (`:90-93`, loaded from `getKeyBindings()`), and props
  `markInTime` / `markOutTime` passed from App
  (`src/renderer/App.tsx:580-581`).
- First-launch flow in `src/renderer/App.tsx`:
  - `:63` `const [showInstructions, setShowInstructions] = useState(false);`
  - `:100-106` — on mount, if no projects and no video and
    `!loadPref(STORAGE_KEYS.ONBOARDING_COMPLETE, false)` → `setShowInstructions(true)`.
  - `:790-801` — render:
    ```tsx
    <InstructionsModal
      isOpen={!hasExistingProjects && !videoPath && showInstructions}
      onClose={() => { setShowInstructions(false); savePref(STORAGE_KEYS.ONBOARDING_COMPLETE, true); }}
      onSelectVideo={() => { savePref(STORAGE_KEYS.ONBOARDING_COMPLETE, true); handleSelectVideo(); }}
      showSelectVideoButton={true}
    />
    ```
    The `!hasExistingProjects && !videoPath` guard makes it impossible to ever
    reopen once a project exists.
  - Settings modal General section `:724-745` — rows are
    `<div className={styles.settingsRow}>...</div>`; the theme toggle button
    at `:734-743` uses `className={styles.themeToggle}` (reuse that class).
- Empty states:
  - `ClipLibrary.tsx:764-775` — no clips, no filter:
    `t("app.clips.noClipsYet")` / `t("app.clips.startCuttingClips")`.
    Current en strings: `"No clips yet"` / `"Start cutting clips from your
    video to build your library"` (en.json:147/168) — no keys mentioned.
  - `Timeline.tsx:293-298` — `t("app.timeline.noClips")` +
    `t("app.timeline.noClipsGuidance")`; guidance string (en.json:387) is
    `"Mark in/out points on the video to create your first clip."` — no keys.
- Export flow (for the first-export hint): the Export dropdown button is at
  `ClipLibrary.tsx:453-515`; localStorage key `exportedClipsTotal` is added by
  plan 001 (if 001 hasn't landed, gate the hint only on `clips.length >= 3`).
- Prefs: `src/renderer/utils/storage.ts` — `STORAGE_KEYS` const +
  `loadPref`/`savePref` (JSON in localStorage).
- i18n: 11 locale files `src/i18n/locales/{en,pt,es,fr,de,it,sl,sr,lt,tr,el}.json`,
  keys nested under `app`, accessed via `t("app…")` from `useTranslation()`.
  New keys go into **all 11**; en+pt provided below, translate the other 9
  matching each file's existing tone.

## Commands you will need

| Purpose | Command | Expected on success |
|---|---|---|
| Install | `cd app && npm install` | exit 0 |
| Build (typecheck + bundle) | `cd app && npm run build` | exit 0 |
| Run app | `cd app && npm run dev` | app opens |
| i18n parity | script in plan 001 Step 7 | new keys in all 11 files |

## Scope

**In scope**:
- `src/renderer/components/ContextualHint.tsx` (i18n the aria-label only)
- `src/renderer/components/VideoPlayer.tsx` (one new hint block)
- `src/renderer/components/ClipLibrary.tsx` (one new hint block; keys in empty-state copy)
- `src/renderer/App.tsx` (reopen-instructions row + modal gate change)
- `src/i18n/locales/*.json` (all 11)

**Out of scope** (do NOT touch):
- `InstructionsModal.tsx` content — reuse as-is.
- Bundling a sample video (deferred — needs an operator-provided asset; see
  Maintenance notes).
- No tour library, no overlay/spotlight framework, no new dependencies.
- `Timeline.tsx` code — its guidance string improves via en.json only
  (the component already renders the key).
- ProjectSelector empty state — already adequate.

## Git workflow

- App repo: branch `feat/onboarding-hints` off `main`. Conventional commits.
- Do NOT push or open a PR unless the operator instructed it.
- Do not mention AI tools in commit messages and do not add AI co-author lines.

## Steps

### Step 1: i18n the ContextualHint dismiss label

In `ContextualHint.tsx`: import `useTranslation` from `react-i18next`, call
`const { t } = useTranslation();` inside the component, and change
`aria-label="Dismiss hint"` to `aria-label={t("app.hints.dismiss")}`.

**Verify**: `cd app && npm run build` → exit 0.

### Step 2: "now press M" hint in VideoPlayer

In `VideoPlayer.tsx`, directly below the existing first-video hint block
(`:907-914`), add:

```tsx
{markInTime !== null && markOutTime === null && (
  <ContextualHint
    hintId="first-mark-out"
    message={t("app.hints.markOutNext", {
      markOut: keyBindings.markOutKey.toUpperCase(),
    })}
  />
)}
```

Check the actual prop types first: if `markInTime`/`markOutTime` are
`number | null` this is correct; if they are `number | undefined`, use
`!= null` / `== null`. Like all ContextualHints, it disappears forever once
dismissed; until then it shows whenever a mark-in is pending, which is the
same behavior the existing hints have.

**Verify**: build passes; manually (`npm run dev`): load a video, press Z →
hint appears naming your mark-out key; press M → hint disappears (condition
false); dismiss once → never again (check localStorage
`hint-dismissed-first-mark-out` = `"true"`).

### Step 3: first-export hint in ClipLibrary

Below the existing first-clip hint (`ClipLibrary.tsx:754-760`), add:

```tsx
{clips.length >= 3 && loadPref(STORAGE_KEYS.EXPORTED_CLIPS_TOTAL, 0) === 0 && (
  <ContextualHint
    hintId="first-export"
    message={t("app.hints.firstExport")}
  />
)}
```

If plan 001 has NOT landed (no `EXPORTED_CLIPS_TOTAL` in `STORAGE_KEYS`), use
only `clips.length >= 3` as the condition and note it in your report. Import
`loadPref`/`STORAGE_KEYS` if not already imported in this file.

**Verify**: build passes.

### Step 4: actionable empty-state copy (en + pt; translate rest)

Update string **values** only (keys unchanged):

- `app.clips.startCuttingClips` —
  en: `"Play the video and press Z at the start of a play, M at the end. Pick a category and the clip saves itself."`
  pt: `"Reproduza o vídeo e prima Z no início de uma jogada e M no fim. Escolha uma categoria e o clipe fica guardado."`
- `app.timeline.noClipsGuidance` —
  en: `"Press Z while the video plays to mark the start of a clip, then M to finish it."`
  pt: `"Prima Z durante a reprodução para marcar o início de um clipe e M para o terminar."`

Note: these two strings hardcode Z/M because the components rendering them
don't know the user's rebound keys. That's acceptable (defaults are Z/M and
rebinding is rare); do NOT add keybinding plumbing to ClipLibrary/Timeline for
this. Check pt.json's register (formal vs informal) against neighboring
strings and match it.

New keys (all 11 locales):
- `app.hints.dismiss` — en: `"Dismiss hint"`, pt: `"Dispensar dica"`
- `app.hints.markOutNext` — en: `"Start marked. Now press {{markOut}} where the play ends to create the clip."`
  pt: `"Início marcado. Agora prima {{markOut}} onde a jogada termina para criar o clipe."`
- `app.hints.firstExport` — en: `"You have a few clips now. Use the Export button above to save them into category folders."`
  pt: `"Já tem alguns clipes. Use o botão Exportar acima para os guardar em pastas por categoria."`
- `app.settings.showInstructions` — en: `"Show quick start guide"`,
  pt: `"Mostrar guia de introdução"` (used in Step 5)

**Verify**: i18n parity script (plan 001 Step 7 has it inline) → the four new
keys present in all 11 files; pre-existing pt gaps (`app.categories.default.*`)
are known — ignore.

### Step 5: make InstructionsModal reopenable

In `App.tsx`:

1. Change the render gate at `:791` from
   `isOpen={!hasExistingProjects && !videoPath && showInstructions}` to
   `isOpen={showInstructions}`. (Auto-show on first launch is already
   controlled separately by the effect at `:100-106`; this gate only
   prevented manual reopening.)
2. In the Settings General section (after the theme row, `:732-744`), add:
   ```tsx
   <div className={styles.settingsRow}>
     <button
       type="button"
       className={styles.themeToggle}
       onClick={() => { setShowSettings(false); setShowInstructions(true); }}
     >
       <FontAwesomeIcon icon={faCircleQuestion} /> {t("app.settings.showInstructions")}
     </button>
   </div>
   ```
   `faCircleQuestion` comes from `@fortawesome/free-solid-svg-icons` — add to
   the existing import. If that icon name doesn't exist in the installed
   version, use `faQuestionCircle` (older alias).

Behavior note: `InstructionsModal`'s `onSelectVideo` calls `handleSelectVideo()`
— fine when reopened. Its `showSelectVideoButton={true}` stays as-is.

**Verify**: build passes; manually: with an existing project open, Settings →
"Show quick start guide" → modal opens; close it; it does not reappear on
restart (ONBOARDING_COMPLETE already true).

## Test plan

No test framework in the repo. Manual pass (list results in your report):

1. Fresh profile (`rm -rf ~/Library/Application\ Support/basketball-video-analyzer`
   on macOS — **ask the operator before deleting**; or use a scratch machine):
   first launch → InstructionsModal auto-shows.
2. Load video → after 2s the existing markKeys hint shows.
3. Press Z → "now press M" hint; press M → ClipCreator opens; save → clip
   count 1 → "first-clip" hint in library.
4. Create 3 clips without exporting → "first-export" hint appears.
5. Each hint's dismiss button hides it permanently across restarts.
6. Settings reopen-guide button works with a project loaded.
7. Switch language to pt → all new strings render translated (no raw key
   names in the UI).

## Done criteria

- [ ] `cd app && npm run build` exits 0
- [ ] `grep -c 'aria-label="Dismiss hint"' src/renderer/components/ContextualHint.tsx` → 0
- [ ] Hints `first-mark-out` and `first-export` exist
      (`grep -rn "first-mark-out\|first-export" src/renderer/components/`)
- [ ] `grep -n "hasExistingProjects && !videoPath && showInstructions" src/renderer/App.tsx` → 0 matches
- [ ] i18n parity: 4 new keys in all 11 locales
- [ ] No files outside the in-scope list are modified (`git status`)
- [ ] `plans/README.md` status row updated

## STOP conditions

Stop and report back if:

- The InstructionsModal render block or first-launch effect no longer match
  the excerpts.
- `markInTime`/`markOutTime` are not available as props inside VideoPlayer
  (the plan's premise is wrong — report, don't add new props ad hoc).
- You are tempted to add a tour/overlay library — out of scope by design.
- Deleting the app-data directory is needed for testing and the operator
  hasn't approved it.

## Maintenance notes

- Hint IDs are permanent once shipped (they key localStorage dismissals) —
  never rename `first-video`, `first-clip`, `first-mark-out`, `first-export`.
- Deferred: bundling a ~20s sample game clip for a zero-risk first run. Needs
  an operator-provided, redistributable video (~3–5 MB) added via
  electron-forge `extraResource`, plus a "Try with sample video" button in
  InstructionsModal. Worth doing if onboarding metrics still look bad after
  this plan; requires the operator to source the footage (rights!).
- If keybindings ever become fully remappable per-category (beyond Z/M), the
  two hardcoded Z/M strings from Step 4 need revisiting.
