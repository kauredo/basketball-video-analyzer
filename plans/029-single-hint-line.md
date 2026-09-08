# Plan 029: Show one hint at a time, not two stacked

> **Executor instructions**: Follow every step, run each verification command.
> Stop and report on any STOP condition. Update this plan's row in
> `plans/README.md` when done.
>
> **Repo**: monorepo of separate git repos. **`app/` only**.
>
> **Drift check**: from `app/`,
> `git diff --stat 9a863ed..HEAD -- src/renderer/components/VideoPlayer.tsx`

## Status

- **Priority**: P2
- **Effort**: S
- **Risk**: LOW
- **Depends on**: none. Land this **before**
  `plans/028-workspace-vertical-budget.md`, which reclaims the space this frees.
- **Category**: bug
- **Planned at**: commit `9a863ed`, 2026-09-07
- **Executor's tool**: `/simplify`

## Why this matters

Pressing Z stacks a second hint banner under the first, and the first stays.
The user then reads, in order:

> Press Z to mark the start of a clip, M to mark the end.
> Start marked. Now press M where the play ends to create the clip.

The first line is now wrong: the start is already marked. Two banners tell one
instruction, one of them stale.

It also costs height at the worst moment. The two stacked banners push the
video pane from 325px down to 217px, so the film shrinks by a third exactly
when the user is watching for the end of the play.

## Current state

`src/renderer/components/VideoPlayer.tsx:939-956`:

```tsx
              {showFirstVideoHint && (
                <ContextualHint
                  hintId="first-video"
                  message={t("app.hints.markKeys", {
                    markIn: keyBindings.markInKey.toUpperCase(),
                    markOut: keyBindings.markOutKey.toUpperCase(),
                  })}
                />
              )}

              {markInTime !== null && markOutTime === null && (
                <ContextualHint
                  hintId="first-mark-out"
                  message={t("app.hints.markOutNext", {
                    markOut: keyBindings.markOutKey.toUpperCase(),
                  })}
                />
              )}
```

The two conditions are independent, so both are true while a mark is in
progress and the first video hint has not been dismissed.

`ContextualHint` (`src/renderer/components/ContextualHint.tsx`) is dismissible
and remembers dismissal per `hintId` in `localStorage` under
`hint-dismissed-<hintId>`. That behaviour is correct and stays.

Note the hints already interpolate the user's real key bindings
(`keyBindings.markInKey`, `markOutKey`), so they stay accurate if someone
rebinds. Preserve that.

**Repo conventions.** React function components; all user-facing strings go
through `react-i18next`; the app ships **11 locale files** in
`src/i18n/locales/` (`de, el, en, es, fr, it, lt, pt, sl, sr, tr`) and any new
string must be added to all eleven.

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
- `src/renderer/components/VideoPlayer.tsx`, lines 939-956

**Out of scope**:
- `src/renderer/components/ContextualHint.tsx`. The component is fine.
- The two hints in `ClipLibrary.tsx` (lines 806 and 814). Check whether they
  can also co-occur; if they cannot, leave them alone and say so in the PR.
- Adding any new i18n string. This plan is designed to need none.
- The hint copy itself. Rewriting it is `plans/037-app-copy-drift.md`.

## Git workflow

- Branch: `fix/single-hint-line`
- Conventional commits; check `git log --oneline -5` and match. Never mention
  AI tools and never add AI co-author lines.

## Steps

### Step 1: Make the first hint stand down once a mark is in progress

Add the mark-in condition to the first hint so the two are mutually exclusive:

```tsx
              {showFirstVideoHint && markInTime === null && (
                <ContextualHint
                  hintId="first-video"
                  message={t("app.hints.markKeys", { ... })}
                />
              )}
```

Leave the second block exactly as it is. The two conditions
(`markInTime === null` and `markInTime !== null && markOutTime === null`) can
now never both be true, so at most one banner renders.

**Verify**: `npm run build` → exit 0.

### Step 2: Confirm the behaviour in the app

Run `npm start` and open a project with a video.

**Verify**, in order:

1. Before marking: the "Press Z to mark the start" hint shows, alone.
2. Press Z: the first hint disappears and "Start marked. Now press M…"
   replaces it. Exactly one banner is visible.
3. Press Escape to clear marks: the first hint comes back.
4. Press Z then M: the clip form opens; no banner is stranded behind it.

### Step 3: Confirm the video pane no longer jumps

Watch the top edge of the video pane while pressing Z.

**Verify**: the video pane's height does not change. Before this change it
dropped by roughly 48px for the second banner.

Measure it if you want certainty: in DevTools, read
`document.querySelector('video').getBoundingClientRect().height` before and
after pressing Z. The two numbers should match.

### Step 4: Confirm dismissal still works

Dismiss the first hint with its close button, restart the app, and open a
project.

**Verify**: the dismissed hint stays dismissed, and the mark-out hint still
appears when a mark is in progress. The two `hintId` values are independent, so
dismissing one must not silence the other.

## Test plan

No test suite. By hand:

- The four-step sequence in Step 2.
- Dismissal persistence in Step 4, for each hint independently.
- Rebind the mark keys in Settings, then check both hints name the new keys.
- Clear `localStorage` and confirm a first-run user sees the first hint again.
- Check the two `ClipLibrary` hints at lines 806 and 814 for the same
  co-occurrence problem; report in the PR whether they can stack.

## Done criteria

- [ ] `npm run build` exits 0
- [ ] At most one hint banner is visible at any time in the video area
- [ ] The video element's height is unchanged by pressing Z
- [ ] Each hint's dismissal persists independently across a restart
- [ ] Both hints reflect custom key bindings
- [ ] No new i18n string was added
- [ ] `plans/README.md` status row updated

## STOP conditions

- Making the hints mutually exclusive means a first-run user never sees the
  "press Z" hint because a mark is already in progress at mount. Check the
  initial state of `markInTime`; it should be `null` on load.
- The `ClipLibrary` hints turn out to stack too and fixing them needs a new
  string. Report it; a new string means editing 11 locale files and belongs in
  its own change.

## Maintenance notes

- Any third hint added to this area needs the same mutual-exclusion treatment,
  or it will stack the same way. The underlying shape is a hint *sequence*,
  and if a third one appears it is worth making that explicit with a single
  `currentHint` value rather than three independent conditions.
- A reviewer should press Z and watch the video edge, not just read the diff.
