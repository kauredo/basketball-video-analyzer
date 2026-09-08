# Plan 025: Stop toasts covering the header buttons

> **Executor instructions**: Follow every step, run each verification command.
> Stop and report on any STOP condition. Update this plan's row in
> `plans/README.md` when done.
>
> **Repo**: monorepo of separate git repos. **`app/` only**.
>
> **Drift check**: from `app/`,
> `git diff --stat 9a863ed..HEAD -- src/renderer/styles/Toast.module.css src/renderer/styles/App.module.css`

## Status

- **Priority**: P3
- **Effort**: S
- **Risk**: LOW
- **Depends on**: none
- **Category**: bug
- **Planned at**: commit `9a863ed`, 2026-09-07
- **Executor's tool**: `/harden`

## Why this matters

Toasts are anchored to the top-right of the window, which is exactly where the
header keeps its action buttons. A confirmation covers Stats, Settings and the
help button while it is on screen, and clips "Hide Bottom Panel". So the
feedback for an action hides the controls the user might click next, and in the
worst case it covers the button they just pressed.

Captured 2026-09-07: after toggling the theme, the "Switched to Light Mode"
toast sat over the header's right-hand controls.

## Current state

`src/renderer/styles/Toast.module.css:1-8`:

```css
.toastContainer {
  position: fixed;
  top: var(--spacing-lg);
  right: var(--spacing-lg);
  z-index: var(--z-toast);
  ...
}
```

`--z-toast: 2000` (`src/renderer/styles/variables.css:86`).

The header is the full-width bar at the top of the window
(`.appHeader`, `src/renderer/styles/App.module.css:418-424`), with its actions
right-aligned inside it. So the toast's anchor point and the header's busiest
region are the same rectangle.

**Repo conventions.** Spacing and z-index come from tokens in `variables.css`.
The toast system is reached through `ToastContext`
(`src/renderer/contexts/ToastContext.tsx`) and is used across the app for
success, error and warning messages.

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
- `src/renderer/styles/Toast.module.css`

**Out of scope**:
- The toast content, timing or dismiss behaviour.
- Which operations toast. That is not in question.
- `src/renderer/contexts/ToastContext.tsx`.

## Git workflow

- Branch: `fix/toast-position`
- Conventional commits; check `git log --oneline -5` and match. Never mention
  AI tools and never add AI co-author lines.

## Steps

### Step 1: Move the toast below the header

The header's height is set by its padding plus its content
(`padding: var(--spacing-md)` on `.appHeader`). Rather than hardcoding a pixel
offset that drifts when the header changes, anchor the toast to the bottom of
the window instead:

```css
.toastContainer {
  position: fixed;
  bottom: var(--spacing-lg);
  right: var(--spacing-lg);
  z-index: var(--z-toast);
}
```

Bottom-right is the conventional place for transient confirmations, it is clear
of every control in this app's header, and it does not depend on the header's
height.

Check the stacking direction: if multiple toasts render, the newest should
appear nearest the corner and older ones stack away from it. If the container
uses `flex-direction: column`, switch it to `column-reverse` so the newest is
at the bottom.

**Verify**: `npm run build` → exit 0.

### Step 2: Check it clears the bottom panel

The bottom panel holds the clip list and can be resized. Confirm the toast does
not cover the clip list's controls or the timeline legend at the default panel
height.

If it does, the alternative anchor is top-centre
(`top: var(--spacing-lg); left: 50%; transform: translateX(-50%)`), which
clears both the header's right-hand controls and the bottom panel. Use that
instead if bottom-right is obstructed.

**Verify**: `npm start`, trigger a toast (toggle the theme in Settings), and
confirm no header button and no clip-list control is covered.

### Step 3: Check with several toasts at once

Trigger two or three toasts in quick succession.

**Verify**: they stack without covering the header, and each is dismissible.

## Test plan

No test suite. By hand:

- Theme toggle toast: clears the header.
- An error toast (try to play a clip whose file is missing): clears the header.
- Three toasts at once: they stack, none covers a control, all dismissible.
- Both themes.
- A small window (1024x680): the toast is still fully on screen.

## Done criteria

- [ ] `npm run build` exits 0
- [ ] No toast covers any header button, in either theme, at 1440x900 and
      1024x680
- [ ] Multiple toasts stack with the newest nearest the anchor corner
- [ ] `git status` shows only `Toast.module.css` modified
- [ ] `plans/README.md` status row updated

## STOP conditions

- Both bottom-right and top-centre are obstructed at some window size. Report
  the sizes; the answer is then reserving a strip, which is a layout change and
  belongs with `plans/028-workspace-vertical-budget.md`.

## Maintenance notes

- If a future layout adds a status bar at the bottom of the window, this anchor
  needs revisiting. Worth a comment in the CSS naming the assumption.
- A reviewer should trigger a toast and then immediately try to click Settings.
