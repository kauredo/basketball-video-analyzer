# Plan 024: Keep a modal's primary action on screen

> **Executor instructions**: Follow every step, run each verification command.
> Stop and report on any STOP condition. Update this plan's row in
> `plans/README.md` when done.
>
> **Repo**: monorepo of separate git repos. **`app/` only**.
>
> **Drift check**: from `app/`,
> `git diff --stat 9a863ed..HEAD -- src/renderer/styles/App.module.css src/renderer/App.tsx src/renderer/components/ClipCreator.tsx`

## Status

- **Priority**: P1
- **Effort**: M
- **Risk**: LOW
- **Depends on**: none
- **Category**: bug
- **Planned at**: commit `9a863ed`, 2026-09-07
- **Executor's tool**: `/harden`

## Why this matters

A coach marks a play, the Create Clip form opens, they fill it in, and the
button that saves the clip is not on screen. At a 1440x900 window the last
visible element in that modal is "Players (0 selected)"; the commit action sits
below it inside the scroll area with nothing pinning it.

That is the app's central task. Statistics and Settings have the same shape:
the content scrolls past the bottom of the window with no fixed action row.

Note what is **not** wrong: `.modalContent` already caps its height and scrolls
internally. The container is correct; the action row just scrolls away with
everything else.

## Current state

`src/renderer/styles/App.module.css:332-357`:

```css
.modal {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: var(--bg-overlay);
  display: flex;
  align-items: center;
  ...
}

.modalContent {
  background: var(--bg-secondary);
  border-radius: var(--radius-lg);
  box-shadow: var(--shadow-lg);
  width: 90%;
  max-width: var(--container-max-width);
  max-height: 90vh;
  overflow-y: auto;
  position: relative;
  animation: modalFadeIn var(--transition-normal) ease;
  border: 1px solid var(--border-color);
}
```

`max-height: 90vh` and `overflow-y: auto` are already right. The problem is
that `.modalContent` is a single scrolling box: header, body and actions all
scroll together.

The four modals are rendered from `src/renderer/App.tsx`: clip creator
(`aria-labelledby="clip-creator-title"`, around line 691), settings (line 734),
stats (line 891) and feedback (line 928). The clip creator's form and its
submit button live in `src/renderer/components/ClipCreator.tsx`.

**Repo conventions.** CSS Modules per component, tokens from `variables.css`,
`useFocusTrap` applied to every modal
(`src/renderer/hooks/useFocusTrap.ts`). Keep the focus trap working; a sticky
footer must stay inside the trapped container.

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
- `src/renderer/styles/App.module.css` (the modal shell)
- `src/renderer/App.tsx` (modal markup, to introduce a body/footer split)
- `src/renderer/components/ClipCreator.tsx` (move its submit row into the
  footer slot)

**Out of scope**:
- The content of any modal. This plan changes where the action row sits, not
  what the form asks for.
- The duplicated "Create Clip" heading. That is `plans/037-app-copy-drift.md`.
- Present mode, which is not one of these modals and is fixed by plan 010.

## Git workflow

- Branch: `fix/modal-sticky-actions`
- Conventional commits; check `git log --oneline -5` and match. Never mention
  AI tools and never add AI co-author lines.

## Steps

### Step 1: Split the modal shell into header, scrolling body and footer

Change `.modalContent` from a single scrolling box into a flex column that does
not scroll, with a body that does:

```css
.modalContent {
  /* unchanged: background, radius, shadow, width, max-width, border, animation */
  max-height: 90vh;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.modalBody {
  overflow-y: auto;
  flex: 1 1 auto;
  min-height: 0;
}

.modalFooter {
  flex: 0 0 auto;
  border-top: 1px solid var(--border-color);
  background: var(--bg-secondary);
  padding: var(--spacing-md);
  display: flex;
  justify-content: flex-end;
  gap: var(--spacing-sm);
}
```

`min-height: 0` on the body is required; without it the flex item refuses to
shrink and the footer is pushed off screen again.

**Verify**: `npm run build` → exit 0.

### Step 2: Wrap each modal's content in the new slots

In `src/renderer/App.tsx`, for the clip creator, settings and stats modals,
wrap the scrolling content in `<div className={styles.modalBody}>` and put the
primary action row in `<div className={styles.modalFooter}>`.

The existing modal header (title plus close button) stays outside the body so
it is also pinned.

Keep every `role`, `aria-modal` and `aria-labelledby` attribute exactly where
it is, and keep the `useFocusTrap` ref on the same element it is on now.

**Verify**: `npm run build` → exit 0.

### Step 3: Move the clip creator's submit row into the footer

In `src/renderer/components/ClipCreator.tsx`, the component currently renders
its own submit button at the end of the form. Either render it into the footer
slot the parent provides, or, if that is awkward, give `ClipCreator` its own
internal flex column with the same three-part split and let it own the sticky
footer.

Whichever route, the submit button must remain inside the `<form>` so Enter
still submits, and inside the focus trap so Tab still cycles.

**Verify**: `npm start`, mark in and out to open Create Clip, and confirm the
submit button is visible without scrolling at a 1440x900 window. Then shrink
the window to 1024x680 and confirm it is still visible.

### Step 4: Check the other three modals

Open Settings, Statistics and Feedback at 1440x900 and again at 1024x680.

**Verify**: each shows its header pinned at the top, a scrolling body, and any
primary action pinned at the bottom. Nothing is cut off by the window edge.

## Test plan

No test suite. By hand, at 1440x900 and 1024x680:

- Create Clip: submit button visible without scrolling; Enter submits; Escape
  closes; Tab cycles within the modal and does not escape to the page behind.
- Settings: content scrolls, header stays.
- Statistics: charts scroll, header stays.
- Feedback: unchanged behaviour, action visible.
- A modal whose content is *shorter* than the window does not grow a pointless
  gap between body and footer.

## Done criteria

- [ ] `npm run build` exits 0
- [ ] Create Clip's submit button is visible without scrolling at 1024x680
- [ ] All four modals keep their header pinned and scroll only their body
- [ ] Focus trap still confines Tab to the modal (test in each)
- [ ] Enter still submits the Create Clip form
- [ ] `plans/README.md` status row updated

## STOP conditions

- The focus trap stops working in any modal after the restructure. That would
  mean the trap ref moved; report before working around it.
- A modal has no clear primary action to pin (Statistics may not). In that case
  give it a body and a pinned header and skip the footer, rather than inventing
  a button.

## Maintenance notes

- Any new modal should use the three-slot shell. Worth a comment above
  `.modalContent` saying so.
- A reviewer should resize the window while a modal is open. The bug only shows
  below a certain height, which is why it shipped.
