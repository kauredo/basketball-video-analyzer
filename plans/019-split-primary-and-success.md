# Plan 019: Give "act here" and "that worked" different colours

> **Executor instructions**: Follow every step and run each verification
> command. Stop and report on any STOP condition. Update this plan's row in
> `plans/README.md` when done.
>
> **Repo**: monorepo of separate git repos. **`app/` only**. Branch and commit
> inside `app/`.
>
> **Drift check**: from `app/`,
> `git diff --stat 9a863ed..HEAD -- src/renderer/styles/variables.css`

## Status

- **Priority**: P2
- **Effort**: S
- **Risk**: LOW
- **Depends on**: none. Land this **before** `plans/018-single-accent-across-surfaces.md`
  if both run.
- **Category**: tech-debt
- **Planned at**: commit `9a863ed`, 2026-09-07
- **Executor's tool**: `/improve plan` then `/ship`

## Why this matters

`--color-primary` and `--color-success` are the same hex, so the app cannot
distinguish "press this" from "that worked". The Export Clips button, the
selected filter chip, the Mark In button and a success toast all land on the
same green. When every affirmative signal is one colour, none of them carries
information.

The light theme makes it concrete. It redefines `--color-primary` to a darker
green but leaves `--color-success` at the dark theme's value, so in light mode
the two tokens finally differ, by accident rather than by design, and anything
built on `--color-success` keeps a contrast ratio of 2.84:1 against white.

## Current state

`src/renderer/styles/variables.css:5-13` (dark, the default):

```css
  --color-primary: #4caf50;
  --color-primary-dark: #45a049;
  --color-primary-light: #66bb6a;
  --color-danger: #f44336;
  --color-danger-dark: #d32f2f;
  --color-danger-light: #ef5350;
  --color-success: #4caf50;
  --color-success-dark: #388e3c;
  --color-warning: #ff9800;
  --color-info: #2196f3;
```

`--color-primary` and `--color-success` are both `#4caf50`.

`src/renderer/styles/variables.css:117-124` (light):

```css
[data-theme="light"] {
  /* Colors */
  --color-primary: #2e7d32;
  --color-primary-dark: #1b5e20;
  --color-primary-light: #388e3c;

  --color-success-dark: #1b5e20;
```

`--color-success` is **not** redefined here, so it inherits `#4caf50` from
`:root`. `--color-success-dark` is redefined but its base is not, which is the
tell that this was an oversight.

Measured contrast against white: `#4caf50` is 2.84:1, `#2e7d32` is 5.13:1.

**Repo conventions.** All colour lives in `variables.css` as custom properties;
the 22 CSS modules consume tokens and hardcode nothing. Themes are applied by
`document.documentElement.setAttribute("data-theme", theme)` at
`src/renderer/App.tsx:180`.

## Commands you will need

| Purpose | Command (from `app/`) | Expected |
|---|---|---|
| Install | `npm install --allow-git all` | exit 0 |
| Build | `npm run build` | exit 0 |
| Run | `npm start` | window opens |

No test suite. `npm run build` is the gate. If install scripts are blocked, run
`npm install-scripts approve better-sqlite3 electron ffmpeg-static`, install
again, and revert the `allowScripts` block from `package.json` before
committing.

## Scope

**In scope**:
- `src/renderer/styles/variables.css`
- Any CSS module that uses `--color-primary` for a *confirmation* rather than
  an *action*, or `--color-success` for an action (Step 2 finds them)

**Out of scope**:
- Choosing a new brand accent. That is plan 018.
- `--color-danger`, `--color-warning`, `--color-info`.
- The category preset colours in `src/main/database.ts`.

## Git workflow

- Branch: `refactor/split-primary-success`
- Conventional commits; check `git log --oneline -5` and match. Never mention
  AI tools and never add AI co-author lines.

## Steps

### Step 1: Make the two tokens different, in both themes

In the `:root` block, keep `--color-primary` as it is and move
`--color-success` to a distinctly different green, darker and less saturated so
it reads as a report rather than an invitation. `#2e7d32` is already in the
codebase (the light theme's primary) and measures 5.13:1 against white, so it
is a safe choice:

```css
  --color-success: #2e7d32;
  --color-success-dark: #1b5e20;
  --color-success-light: #43a047;
```

Then add the missing light-theme override so success does not inherit the dark
value:

```css
  --color-success: #1b5e20;
  --color-success-dark: #14481a;
  --color-success-light: #2e7d32;
```

**Verify**: `npm run build` → exit 0, and
`grep -c "color-success" src/renderer/styles/variables.css` returns at least 6.

### Step 2: Audit which token each consumer should use

```
grep -rn "color-primary\|color-success" src/renderer/styles/*.css
```

For each hit, decide by the rule: **`--color-primary` for anything the user
clicks to do something; `--color-success` only for reporting an outcome that
already happened.** Toast success styling and any "saved"/"exported"
confirmation move to `--color-success`. Buttons, selected filter chips and
Mark In stay on `--color-primary`.

Change only the ones that are on the wrong side of that rule. Do not
mass-rename.

**Verify**: `npm run build` → exit 0. Record in the PR description which files
changed and why.

### Step 3: Look at both themes

Run `npm start`. In dark theme, trigger a success toast (export clips, or
switch theme, which itself toasts) and confirm the toast green differs from the
Export Clips button green. Switch to light theme and repeat.

**Verify**: in both themes the confirmation colour and the action colour are
visibly different, and success text on its background is readable.

## Test plan

No test suite. By hand:

- Dark theme: success toast against a primary button, side by side. Different.
- Light theme: same check. Different.
- Every place that previously read as green still reads as intentional; nothing
  turned muddy.
- No element lost its colour entirely (a token typo shows up as black or
  transparent).

## Done criteria

- [ ] `npm run build` exits 0
- [ ] `--color-primary` and `--color-success` differ in the `:root` block
- [ ] `--color-success` is explicitly defined inside `[data-theme="light"]`
- [ ] A success toast and a primary button are visibly different in both themes
- [ ] `git status` shows only `variables.css` and any files changed in Step 2
- [ ] `plans/README.md` status row updated

## STOP conditions

- More than about eight files need changing in Step 2. That suggests the two
  tokens are entangled more deeply than this plan assumes; report the list.
- Any component turns out to read `--color-success` for a *disabled* or
  *neutral* state, which would mean the token is carrying a third meaning.

## Maintenance notes

- Plan 018 may replace `--color-primary` with a different hue. It should not
  touch `--color-success`; after this plan they are independent.
- A reviewer should check the light theme specifically. The missing override
  was the original bug and it was invisible in dark mode.

## Executor note, 2026-09-07 (app PR #11)

Step 2's rule found the entanglement running the opposite way from what this
plan assumed. **No consumer used `--color-primary` for a confirmation.** Five
used `--color-success` for an action: `.selectAllBtn:hover`, the
`.addSubcategoryForm` border, `.addSubBtn`, `.markIn` and `.markInBtn`. All
five moved to `--color-primary`, which is what unblocked 018 reaching Mark In.

Two deviations. `--color-success-light` was not added, because nothing consumes
it. And `--color-success-rgb` was added, because `.toast.success` had its fill
hardcoded as `rgba(76, 175, 80, 0.9)` and would not otherwise have followed the
token. The plan did not know about that literal.

`--color-success` now has exactly one consumer, the toast.
