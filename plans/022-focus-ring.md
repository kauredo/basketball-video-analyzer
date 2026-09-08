# Plan 022: Give both surfaces one visible, branded focus ring

> **Executor instructions**: Follow every step, run each verification command.
> Stop and report on any STOP condition. Update this plan's row in
> `plans/README.md` when done.
>
> **Repo**: monorepo of separate git repos. Touches **`website/`** and
> **`app/`**. Two branches, two commits.
>
> **Drift check**: from `website/`, `git diff --stat fa4bc39..HEAD -- src/styles/global.css`;
> from `app/`, `git diff --stat 9a863ed..HEAD -- src/renderer/styles/variables.css`

## Status

- **Priority**: P2
- **Effort**: S
- **Risk**: LOW
- **Depends on**: `plans/018`. The ring is the accent's theme face:
  `#0A6E68` on the site, `#3ED0C2` in the app, as `outline: 2px solid` with
  `outline-offset: 2px` on `:focus-visible`.
- **Category**: bug
- **Planned at**: `website` `fa4bc39`, `app` `9a863ed`, 2026-09-07
- **Executor's tool**: `/harden`

## Why this matters

On the website, only two CSS classes have any focus style. Everything else,
including the navbar wordmark, the GitHub icon, all six footer links, the guide
links and every link inside the copy, falls back to Chrome's default ring. That
default is `rgb(0, 95, 204)`, measured on the second tab stop of the home page,
and on a warm cream page with an orange accent it is the one colour that
belongs to nothing.

The app is in better shape and should not be "fixed" carelessly: the ring is
real. Measured with the window holding OS focus,
`el.matches(':focus-visible')` is true and the computed shadow is
`rgb(102, 187, 106) 0 0 0 2px`. What is worth changing is the construction, not
the presence: `box-shadow` is dropped in Windows high-contrast and
forced-colors mode, so keyboard users there lose the ring entirely.

## Current state

**Site.** `src/styles/global.css` has exactly four focus declarations, all
inside `@layer components`:

```css
  .download-btn {
    @apply ... focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2;
  }
  .btn {
    @apply ... focus:outline-none focus:ring-2 focus:ring-offset-2
  }
  .btn-primary { @apply ... focus:ring-primary-500; }
  .btn-secondary { @apply ... focus:ring-warm-500; }
```

A grep for `focus:` across `src/components/` and `src/pages/` returns **zero**
matches, and a grep for `focus-visible` across `src/` returns zero. So no link
anywhere on the site has a focus style, and the buttons that do use `:focus`
rather than `:focus-visible`, which means the ring also appears on mouse
clicks.

**App.** `src/renderer/styles/variables.css:109-110`:

```css
  --focus-ring: 0 0 0 2px var(--color-primary-light);
  --focus-ring-within: 0 0 0 2px var(--color-primary);
```

consumed as `box-shadow: var(--focus-ring)` under `:focus-visible` in the CSS
modules, for example `src/renderer/styles/App.module.css:505-512`.

## Commands you will need

| Purpose | Command | Expected |
|---|---|---|
| Build site | `npm run build` (from `website/`) | exit 0 |
| Build app | `npm run build` (from `app/`) | exit 0 |

No test suites. The builds are the gates.

## Scope

**In scope**:
- `website/src/styles/global.css`
- `app/src/renderer/styles/variables.css`
- The CSS modules in `app/src/renderer/styles/` that consume `--focus-ring`,
  only to change `box-shadow` to `outline`

**Out of scope**:
- Adding focus styles to individual site components one by one. A single global
  rule is the right shape and is what this plan does.
- `--focus-ring-within`. Leave it as a `box-shadow`; it decorates a container
  rather than marking the focused control.
- Removing the app's existing `:focus-visible` selectors. They are correct.

## Git workflow

- Branches: `fix/focus-ring-website` and `fix/focus-ring-app`.
- Conventional commits; check `git log --oneline -5` in each and match. Never
  mention AI tools and never add AI co-author lines.

## Steps

### Step 1: Give the site a global focus ring

In `website/src/styles/global.css`, inside `@layer base`, add:

```css
  :focus-visible {
    outline: 2px solid theme('colors.primary.500');
    outline-offset: 2px;
    border-radius: 2px;
  }
```

`:focus-visible` rather than `:focus`, so pointer clicks do not draw a ring.
`outline` rather than `box-shadow`, so it survives forced-colors mode.
`outline-offset` keeps it clear of the element's own border.

**Verify**: `npm run build` → exit 0. Then `npm run dev`, press Tab several
times on the home page, and confirm every stop draws an accent-coloured ring,
including the navbar wordmark, the GitHub icon and the footer links.

### Step 2: Stop the buttons drawing a ring on mouse click

Change the four `focus:` utilities in `global.css` to `focus-visible:`
(`focus-visible:outline-none focus-visible:ring-2` and so on). Tailwind
supports the `focus-visible:` variant directly.

**Verify**: click the Download button with the mouse → no ring. Tab to it → a
ring.

### Step 3: Convert the app's ring to an outline

In `app/src/renderer/styles/variables.css`, keep the token name and change what
it carries. Because `outline` is a shorthand rather than a shadow, the
consuming rules change too. Define:

```css
  --focus-ring-color: var(--color-primary-light);
  --focus-ring-width: 2px;
```

then in each CSS module that currently has

```css
  box-shadow: var(--focus-ring);
  outline: none;
```

replace it with

```css
  outline: var(--focus-ring-width) solid var(--focus-ring-color);
  outline-offset: 2px;
```

Find every consumer first:

```
grep -rn "var(--focus-ring)" src/renderer/styles/
```

Change all of them in one pass so no component keeps the old construction.

**Verify**: `npm run build` → exit 0, and
`grep -rn "box-shadow: var(--focus-ring)" src/renderer/styles/` returns no
matches.

### Step 4: Confirm the app ring still renders

Run `npm start` and press Tab. Note: the ring will **not** appear if the
Electron window does not have OS focus, because `:focus-visible` does not match
in an unfocused window. Click the window first, then Tab.

**Verify**: in DevTools, `document.activeElement.matches(':focus-visible')` is
`true` and `getComputedStyle(document.activeElement).outlineColor` is the
accent, not `rgb(255, 255, 255)`.

## Test plan

No test suite. By hand:

- Site: Tab through the full home page and one sub-page. Every interactive
  element draws the same ring. No element draws the browser default blue.
- Site: mouse-click the Download button. No ring.
- App: Tab through the header, the mark row and the clip list in both themes.
- App: if a Windows machine is available, check forced-colors mode. The outline
  should survive where the old box-shadow did not. If no Windows machine is
  available, say so in the PR rather than claiming it was tested.

## Done criteria

- [ ] `npm run build` exits 0 in both repos
- [ ] `grep -rn "focus:ring" website/src/styles/global.css` returns no matches
      (all converted to `focus-visible:`)
- [ ] Tabbing the site draws an accent ring on links as well as buttons
- [ ] `grep -rn "box-shadow: var(--focus-ring)" app/src/renderer/styles/`
      returns no matches
- [ ] `document.activeElement`'s computed `outlineColor` in the app is the
      accent
- [ ] `plans/README.md` status row updated

## STOP conditions

- The global `:focus-visible` rule visibly breaks a component's layout, for
  example by drawing inside a clipped container. Report which component; the
  fix is a scoped override, not abandoning the global rule.
- `theme('colors.primary.500')` does not resolve in the `@layer base` context.
  Use the literal hex with a comment pointing at the Tailwind token instead,
  and note it in the PR.

## Maintenance notes

- The app's focus ring reads as absent whenever the Electron window is not
  focused. That is browser behaviour, not a bug, and it is worth a comment
  above the token so the next person does not "fix" a working ring.
- A reviewer should Tab through both surfaces rather than reading the diff.

## Executor note, 2026-09-07 (app PR #15, website PR #8)

Two traps, both of which cost a debugging round.

**In the app**, 40 of the 63 rules set `outline: none` *after* the shadow, not
before. Left in place it beats the new outline in the cascade, and the ring
computes to `0px none` while `outline-offset` still applies, which looks exactly
like an unresolved custom property. One rule, `.select:focus` in
LanguageSelector, hid its `outline: none` behind a `border-color` line and was
missed on the first pass; it was also the last ring in the app still on
`:focus` rather than `:focus-visible`.

**On the site**, Tailwind's `outline-none` sets a *transparent outline* rather
than no outline, so it beat the new global `:focus-visible` rule and left the
button classes falling back to `ring-*`, a box-shadow, which is the exact
construction this plan removes. The fix was deleting all four focus utilities
and letting the global rule cover the buttons too.

`theme("colors.primary.500")` resolves fine inside `@layer base`, so the plan's
second STOP condition did not fire.

### Second pass, after correctness and architecture review

The first pass converted 63 rules and still missed five, because it searched for
`box-shadow: var(--focus-ring)`. Four more rings were written as literal
`box-shadow: 0 0 0 2px var(--token)`: `.resetButton`, `.input`, `.textarea` and
`.timeSearchInput`. **Grep for `box-shadow: 0 0 0` as well as the token.** The
fifth hit, `.colorBtnActive`, is a selected-swatch marker rather than a focus
ring and correctly keeps its shadow.

Two theme-vs-surface bugs, both found independently by two reviewers:

- `--color-accent-on-dark` was applied to the telestration save button on the
  assumption the toolbar is always dark. It is not. The toolbar draws on
  `--bg-overlay`, which is `rgba(255,255,255,0.95)` in the light theme, so the
  bright teal sat at roughly 1.9:1. **Check the actual background token before
  calling a surface theme-independent.** Present mode is the only genuine case,
  because it uses `--bg-black`.
- Present mode therefore needs its own `--focus-ring-color` override. Left
  inheriting the theme's, its ring was the dark teal on a black backdrop.

Do **not** add `border-radius` to the global `:focus-visible` rule, which the
Step 1 snippet in this plan suggests. Browsers already follow the element's own
radius when drawing an outline, and setting it changes the element's box while
it holds focus. Tailwind's components layer beats base, so buttons kept their
radius, but every plain link picked up 2px on Tab.

Removing those consumers left `--color-primary-light` with none, so it was
deleted.
