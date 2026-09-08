# Plan 010: Make Present mode cover the whole window instead of the side panel

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving on. If
> anything in "STOP conditions" occurs, stop and report, do not improvise.
> When done, update this plan's status row in `plans/README.md`.
>
> **Repo**: this is a monorepo of separate git repos. `app/` (Electron) and
> `website/` (Astro) each have their own `.git`. This plan touches **`app/`
> only**. Branch and commit inside `app/`.
>
> **Drift check (run first)**: from `app/`, run
> `git diff --stat 9a863ed..HEAD -- src/renderer/styles/ClipLibrary.module.css src/renderer/components/PresentMode.tsx src/renderer/components/ClipLibrary.tsx`
> If any of those changed, compare the "Current state" excerpts below against
> the live code before proceeding. On a mismatch, treat it as a STOP condition.

## Status

- **Priority**: P1
- **Effort**: S
- **Risk**: LOW
- **Depends on**: none
- **Category**: bug
- **Planned at**: commit `9a863ed`, 2026-09-07
- **Executor's tool**: `/ship`

## Why this matters

Present mode is the feature a coach uses standing in front of a team, and the
marketing site advertises it by name. It is supposed to fill the window as a
cinema view. It currently renders as a 359px strip down the right-hand side,
on top of the live workspace, with the clip title truncated to a single
character and "Clip 1 of 8" wrapped across three lines. Measured in a running
build at a 1440x900 window, the overlay's bounding box is 359 x 808 at
(1081, 76).

The CSS is not wrong. `PresentMode` asks for `position: fixed; inset: 0` and
gets it, but an ancestor has been made the containing block for fixed
descendants, so `inset: 0` resolves against the side panel rather than the
viewport.

## Current state

Files involved:

- `src/renderer/styles/ClipLibrary.module.css`: styles for the clip library
  panel. Line 7 is the cause.
- `src/renderer/components/ClipLibrary.tsx`: renders `<PresentMode>` as its own
  child, inside the clip library subtree (around line 951).
- `src/renderer/components/PresentMode.tsx`: the overlay itself. Correct as
  written.
- `src/renderer/styles/PresentMode.module.css`: lines 1-9, correct as written.

`src/renderer/styles/ClipLibrary.module.css:1-12`:

```css
@import "./variables.css";

.clipLibrary {
  padding: 0;
  max-width: 100%;
  margin: 0;
  container-type: inline-size;
  display: flex;
  flex-direction: column;
  min-height: 0;
  flex: 1;
}
```

`src/renderer/styles/PresentMode.module.css:1-9`:

```css
.presentMode {
  position: fixed;
  inset: 0;
  z-index: var(--z-present);
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--bg-black);
}
```

`src/renderer/components/ClipLibrary.tsx:951-957`:

```tsx
      {showPresent && sortedClips.length > 0 && (
        <PresentMode
          clips={sortedClips}
          categories={categories}
          onClose={() => setShowPresent(false)}
        />
      )}
```

**The mechanism.** An element with `container-type: inline-size` applies
layout, style and inline-size containment. Per the CSS Containment spec, such
an element becomes the containing block for `position: fixed` descendants,
exactly the way a `transform` does. So `.clipLibrary` traps the overlay.

Verified in a running build: no ancestor of the overlay carries a `transform`,
`filter`, `backdrop-filter`, `contain` or `will-change`. The container query is
the only cause.

**Repo conventions.** React 18 with function components and CSS Modules. The
app already uses `createPortal` nowhere, so introducing it is new; keep the
import style consistent with the other `react-dom` usage in
`src/renderer/index.tsx`.

## Commands you will need

| Purpose | Command (run from `app/`) | Expected on success |
|---|---|---|
| Install | `npm install --allow-git all` | exit 0 |
| Build | `npm run build` | exit 0, no TypeScript errors |
| Run | `npm start` | the app window opens |

There is no test suite in this repo. `npm run build` is the verification gate.

Note on install: this repo has a git-sourced transitive dependency
(`@electron/node-gyp`) and npm 12 blocks those by default, hence
`--allow-git all`. If `npm install` also reports blocked install scripts, run
`npm install-scripts approve better-sqlite3 electron ffmpeg-static` and install
again. Do **not** commit the `allowScripts` block this adds to `package.json`;
revert that file before committing.

## Scope

**In scope**:
- `src/renderer/components/PresentMode.tsx`

**Out of scope** (do NOT touch):
- `src/renderer/styles/ClipLibrary.module.css`. Removing `container-type`
  would also fix the symptom, but the file has a `@container` query at line 850
  guarded by `@supports not (container-type: inline-size)`, so the container is
  load-bearing for the panel's responsive layout. Leave it alone.
- Any change to how `ClipLibrary` decides to show Present mode. The state stays
  where it is; only the DOM position of the rendered overlay changes.
- `src/renderer/styles/PresentMode.module.css`. It is already correct.

## Git workflow

- Branch: `fix/present-mode-fullscreen`
- Commit style: conventional commits. Check `git log --oneline -5` for the
  house style and match it.
- Never mention AI tools in the commit message and never add AI co-author
  lines.
- Do not push or open a PR unless the operator asks.

## Steps

### Step 1: Portal the overlay to `document.body`

In `src/renderer/components/PresentMode.tsx`, import `createPortal` from
`react-dom` and wrap the returned tree in it, so the overlay mounts outside the
`.clipLibrary` container and `inset: 0` resolves against the viewport.

The component currently returns, at roughly line 111:

```tsx
  return (
    <div
      className={styles.presentMode}
      role="dialog"
      aria-modal="true"
      aria-labelledby="present-clip-title"
    >
```

Change it to return `createPortal(<div className={styles.presentMode} ...>...</div>, document.body)`.
Keep every prop, every child and the `role`/`aria-modal`/`aria-labelledby`
attributes exactly as they are. The only change is the portal wrapper.

Leave the early `if (!currentClip) return null;` guard above it untouched.

**Verify**: `npm run build` → exit 0, no TypeScript errors.

### Step 2: Confirm the overlay fills the window

Run `npm start`, open a project that has at least one clip, and click
**Present** in the Clip Library panel.

**Verify**: the black cinema view covers the whole window. The clip title reads
in full rather than truncating to one character, and the "Clip N of M" counter
sits on one line. Press `Escape` and confirm the overlay closes and the
workspace is unchanged.

## Test plan

This repo has no test suite, so verification is the manual check in Step 2 plus
the build gate. Cover these cases by hand:

- Present with the side panel expanded, and again with it collapsed. Both must
  fill the window.
- Resize the window to roughly 1024x700 and open Present again. It must still
  fill the window.
- Escape closes it; the close button closes it.
- The next/previous and loop controls still work after the portal change.

## Done criteria

ALL must hold:

- [ ] `npm run build` exits 0
- [ ] Present mode's black backdrop covers the full window at 1440x900 and at
      1024x700
- [ ] The clip title renders in full, not truncated to one character
- [ ] `git status` shows only `src/renderer/components/PresentMode.tsx`
      modified (plus `plans/README.md`)
- [ ] `package.json` is unmodified
- [ ] `plans/README.md` status row updated

## STOP conditions

Stop and report if:

- `ClipLibrary.module.css:7` no longer contains `container-type: inline-size`.
  Someone has already changed this and the plan needs rewriting.
- After portalling, the overlay fills the window but the keyboard shortcuts
  inside Present mode stop firing. That would mean the component depended on
  its position in the tree for event bubbling, which this plan assumes it does
  not.
- `npm run build` fails twice after a reasonable fix attempt.

## Maintenance notes

- Any future overlay rendered from inside `ClipLibrary` hits the same trap.
  `container-type: inline-size` on `.clipLibrary` will capture it too. If a
  second overlay appears there, portal it the same way rather than removing the
  container query.
- A reviewer should check that the portal did not change focus behaviour. The
  overlay sets `role="dialog"` and `aria-modal="true"`, and moving it to
  `document.body` is what makes those attributes honest, since it is now
  genuinely a sibling of the app root rather than buried in a panel.
