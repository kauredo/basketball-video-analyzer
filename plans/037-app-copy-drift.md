# Plan 037: Make the app's strings consistent and plain

> **Executor instructions**: Follow every step, run each verification command.
> Stop and report on any STOP condition. Update this plan's row in
> `plans/README.md` when done.
>
> **Repo**: monorepo of separate git repos. **`app/` only**.
>
> **Drift check**: from `app/`,
> `git diff --stat 9a863ed..HEAD -- src/i18n/locales/ src/renderer/components/ClipCreator.tsx src/renderer/components/ProjectSelector.tsx`

## Status

- **Priority**: P3
- **Effort**: M
- **Risk**: LOW
- **Depends on**: none
- **Category**: docs
- **Planned at**: commit `9a863ed`, 2026-09-07
- **Executor's tool**: `/clarify`

## Why this matters

The website's copy has been rewritten by a person and reads that way. The app's
has not had the same pass, and it shows in four ways: two nouns for one thing,
two names for one screen, Title Case drifting through an otherwise
sentence-case interface, and one string that explains a save button in two
sentences of marketing language.

None of it is broken. All of it makes the app feel less finished than the site
that sells it.

## Current state

Every user-facing string lives in `src/i18n/locales/`, **11 files**: `de`, `el`,
`en`, `es`, `fr`, `it`, `lt`, `pt`, `sl`, `sr`, `tr`. Any key whose English
value changes must be updated in all eleven, or the app ships a mix of new
English and stale translations.

The specific strings, with their keys:

| Key | Current value | Problem |
|---|---|---|
| `app.categories.presets.description` | "Save your category layouts as reusable templates for different scouting scenarios. Create multiple presets like 'Opponent Scouting', 'Player Development', 'Team Analysis', etc." | Two sentences of "reusable templates" and "scenarios" plus a quoted rule-of-three and "etc.", to explain a save button |
| `app.projects.noProjectsYet` | "No Projects Yet" | Title Case; and the sibling line explains the app to someone who already opened it |
| `app.projects.importSession` | "Import Session" | "Session" and "Project" name the same thing on one screen |
| `app.clips.saveSession` | "Save Session" | same |
| `app.stats.title` | "Statistics" | the button that opens it says "Stats" |
| `app.shortcuts.markIn` | "Mark In point" | reads as a typo; the button says "Mark In (Z)" |
| `app.shortcuts.markOut` | "Mark Out point" | same |
| `app.timeline.selectedClip` | "Selected Clip" | Title Case |
| `app.settings.lightMode` | "Light Mode" | Title Case, and the control is ambiguous about whether it names the current state or the action |

Also, `src/renderer/components/ClipCreator.tsx` renders its heading twice: once
in the modal chrome and again as an H2 about 95px below.

**The voice to match**, from the site and from the app's own best string: plain,
specific, names the mechanism. The app already contains
"This relies on YouTube's service and may not always work", which is the
register to aim for. No em dashes. No rule-of-three lists. Sentence case.

## Commands you will need

| Purpose | Command (from `app/`) | Expected |
|---|---|---|
| Install | `npm install --allow-git all` | exit 0 |
| Build | `npm run build` | exit 0 |
| Run | `npm start` | window opens |

No test suite. `npm run build` is the gate. If install scripts are blocked,
approve `better-sqlite3 electron ffmpeg-static`, reinstall, and revert the
`allowScripts` block from `package.json`.

## Scope

**In scope**:
- All 11 files in `src/i18n/locales/`
- `src/renderer/components/ClipCreator.tsx`, the duplicated heading only

**Out of scope**:
- Adding or removing keys. Change values; do not restructure the key tree,
  which would ripple through every component.
- Translating into the ten non-English locales yourself unless you read the
  language. See "The translation question".
- The first-run onboarding sequence, which `plans/005` already covers. Check
  that plan's status before touching `noProjectsYet`.
- The site's copy.

## The translation question

Changing an English string leaves ten translations stale. Two honest options:

1. **Update English, and mark the ten others for review.** The app falls back
   to the existing translation, which is still valid text, just not matching
   the new English. Record which keys changed so a translator can catch up.
2. **Update English and machine-translate the rest, flagged for review.** Faster
   to look consistent, riskier: a bad translation is worse than a stale one,
   and nobody in the review chain reads Slovenian.

Take option 1 unless the operator says otherwise, and list the changed keys in
the PR description so the debt is visible.

## Git workflow

- Branch: `refactor/app-copy`
- Conventional commits; check `git log --oneline -5` and match. Never mention
  AI tools and never add AI co-author lines.

## Steps

### Step 1: Settle on one noun for a project

The app calls the same thing a "project" in most places and a "session" in the
save and import flows. Pick **project**, because it is what the primary create
action says and what the database table is called.

Update `app.projects.importSession`, `app.clips.saveSession` and any sibling
description strings to use "project". Read the surrounding UI first: if "save
session" actually saves something different from a project (a working state
rather than the project itself), keep two nouns and say so in the PR rather
than flattening a real distinction.

**Verify**: `grep -rn '"[^"]*[Ss]ession' src/i18n/locales/en.json` returns only
strings where "session" is genuinely a different thing.

### Step 2: One name per screen

Change `app.stats.title` from "Statistics" to "Stats", matching the button that
opens it. Changing the button instead would also work; pick one and be
consistent.

**Verify**: the header button and the modal title read the same.

### Step 3: Sentence case, and fix the shortcut labels

- `app.projects.noProjectsYet`: "No projects yet"
- `app.timeline.selectedClip`: "Selected clip"
- `app.settings.lightMode`: "Light mode"
- `app.shortcuts.markIn`: "Mark the start of a clip"
- `app.shortcuts.markOut`: "Mark the end of a clip"

Sweep the English file for other Title Case values in the same position and fix
them in the same pass.

**Verify**: `npm run build` → exit 0, and the shortcuts modal reads as
sentences rather than as fragments.

### Step 4: Rewrite the presets description

Replace `app.categories.presets.description` with something that says what the
button does:

```
Save a category tree and load it on the next game. Keep one for scouting
opponents, one for your own team.
```

Two short sentences, no "reusable templates", no "etc.", no quoted list.

**Verify**: the string is under 140 characters and contains no em dash.

### Step 5: Remove the duplicated Create Clip heading

In `src/renderer/components/ClipCreator.tsx`, the title appears in the modal
chrome and again as an H2 in the body. Delete the H2 and make sure the modal's
`aria-labelledby` still points at a heading that exists.

**Verify**: `npm start`, mark in and out, and confirm "Create Clip" appears once.
In DevTools, check that the element referenced by the dialog's
`aria-labelledby` is present in the DOM.

### Step 6: Read the whole English file

Read `src/i18n/locales/en.json` end to end looking for the same four problems:
Title Case in sentence positions, marketing register, a second noun for an
existing concept, and rule-of-three lists.

Fix what you find in this pass rather than leaving a second round.

**Verify**: list every changed key in the PR description.

## Test plan

No test suite. By hand:

- Every screen that shows a changed string renders it correctly, with no
  missing-key fallback such as a raw `app.foo.bar` on screen.
- The Create Clip modal shows its title once and its `aria-labelledby` target
  exists.
- Switch to a non-English locale (Settings → Language) and confirm the app does
  not crash and shows the existing translation rather than a blank.
- All 11 locale files still parse:
  `for f in src/i18n/locales/*.json; do python3 -m json.tool "$f" > /dev/null || echo "BAD $f"; done`
  prints nothing.

## Done criteria

- [ ] `npm run build` exits 0
- [ ] All 11 locale files are valid JSON with the same key set as `en.json`
- [ ] No raw i18n key appears on screen in any locale
- [ ] "Create Clip" appears once in the clip modal
- [ ] The header button and the stats modal title use the same word
- [ ] `app.categories.presets.description` is under 140 characters
- [ ] The PR description lists every changed key so translations can catch up
- [ ] `plans/README.md` status row updated

## STOP conditions

- The key sets diverge between locale files after your edits. Compare them:
  a missing key in one locale shows the raw key string to that user.
- "Session" turns out to be a genuinely different concept from "project".
  Report it; flattening a real distinction is worse than the inconsistency.
- `plans/005` (first-run onboarding) is in progress and also edits
  `noProjectsYet`. Coordinate rather than conflicting.

## Maintenance notes

- The app has 11 locales and no process for keeping them in step. Worth a
  script that diffs key sets across the files and fails CI on a mismatch;
  that is a separate, small plan worth writing.
- The register to hold future strings to is "This relies on YouTube's service
  and may not always work": names the dependency, admits the failure, no
  padding.
- A reviewer should read the app's strings aloud. Title Case drift and
  marketing register are both obvious when spoken.
