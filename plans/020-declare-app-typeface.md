# Plan 020: Give the desktop app the same typefaces as the site

> **Executor instructions**: Follow every step and run each verification
> command. Stop and report on any STOP condition. Update this plan's row in
> `plans/README.md` when done.
>
> **Repo**: monorepo of separate git repos. **`app/` only**. Branch and commit
> inside `app/`.
>
> **Drift check**: from `app/`,
> `git diff --stat 9a863ed..HEAD -- src/renderer/index.html src/renderer/styles/variables.css webpack.config.js package.json`

## Status

- **Priority**: P2
- **Effort**: M
- **Risk**: LOW
- **Depends on**: `plans/027` DECIDED. Load **IBM Plex Sans** and **IBM Plex
  Mono** as well as Space Grotesk, and make Plex Sans the app's interface face
  rather than Space Grotesk: Space Grotesk has no Greek and `el.json` needs it.
- **Category**: tech-debt
- **Planned at**: commit `9a863ed`, 2026-09-07
- **Executor's tool**: `/improve plan` then `/ship`

## Why this matters

The app declares no typeface. It falls back to whatever the platform supplies,
so the same product renders in SF Pro on macOS, Segoe UI on Windows and Roboto
on Linux. The website, meanwhile, loads Space Grotesk for display and DM Sans
for body text, and those choices do real work: they read as a considered indie
tool rather than a generic SaaS product.

Two consequences. The download hands the user off to something that looks like
different software. And the problem is invisible to anyone testing on a Mac,
because SF Pro is close enough to the site's faces to pass a glance, while
Windows is roughly half the app's downloads.

## Current state

`src/renderer/index.html:8-16`:

```html
  <style>
    body {
      margin: 0;
      font-family:
        -apple-system, BlinkMacSystemFont, "Segoe UI", "Roboto", sans-serif;
      background: var(--bg-primary);
      color: var(--text-primary);
      overflow: hidden;
    }
```

That is the only `font-family` declaration for body text in the app. Every
other `font-family` across the 22 CSS modules is `var(--font-mono)`, defined at
`src/renderer/styles/variables.css:113`:

```css
  --font-mono: "Monaco", "Menlo", "Ubuntu Mono", monospace;
```

There is no `--font-display` or `--font-body` token.

**How the site loads its faces.** `website/package.json` depends on
`@fontsource-variable/space-grotesk` and `@fontsource-variable/dm-sans`. The
app must self-host the same way: an Electron renderer has no reliable network
at launch, and fetching from Google Fonts would break the app's offline
promise, which is one of its selling points.

**Build setup.** The renderer is bundled by webpack
(`npm run build:renderer` → `webpack --mode=production`). Check
`webpack.config.js` for an existing rule handling font files (`woff2`) before
adding one.

## Commands you will need

| Purpose | Command (from `app/`) | Expected |
|---|---|---|
| Install | `npm install --allow-git all` | exit 0 |
| Build | `npm run build` | exit 0 |
| Run | `npm start` | window opens |
| Package | `npm run package` | produces a bundle |

No test suite. `npm run build` is the gate. If install scripts are blocked, run
`npm install-scripts approve better-sqlite3 electron ffmpeg-static`, install
again, and revert the `allowScripts` block from `package.json` before
committing.

## Scope

**In scope**:
- `package.json` (two fontsource dependencies)
- `src/renderer/index.html` (the body font stack)
- `src/renderer/styles/variables.css` (new `--font-display` and `--font-body`)
- `src/renderer/index.tsx` (font imports, if that is where the bundler wants
  them)
- `webpack.config.js` (only if no font-file rule exists)

**Out of scope**:
- `--font-mono` and every use of it. Timecodes and key chips should stay
  monospace.
- Restyling components. This plan changes which faces render, not sizes,
  weights or hierarchy. Type-scale work is `plans/035-type-scale-and-measure.md`.
- The site. It already has these faces.

## Git workflow

- Branch: `feat/app-typefaces`
- Conventional commits; check `git log --oneline -5` and match. Never mention
  AI tools and never add AI co-author lines.

## Steps

### Step 1: Add the fonts as dependencies

```
npm install --allow-git all @fontsource-variable/space-grotesk @fontsource-variable/dm-sans
```

Match the versions the website uses; read them from
`website/package.json` (at planning time `^5.2.10` and `^5.2.8`).

**Verify**: both packages appear in `package.json` `dependencies`, and
`ls node_modules/@fontsource-variable/dm-sans` succeeds.

### Step 2: Import the faces into the renderer bundle

In `src/renderer/index.tsx`, add the fontsource imports at the top, above the
existing style imports:

```ts
import "@fontsource-variable/space-grotesk";
import "@fontsource-variable/dm-sans";
```

If webpack has no rule for `woff2`, add one using `asset/resource`. Check
`webpack.config.js` first; do not add a duplicate rule.

**Verify**: `npm run build` → exit 0, and the built output contains woff2
files: `find dist/renderer -name "*.woff2" | head` returns at least one path.

### Step 3: Add the tokens

In `src/renderer/styles/variables.css`, next to `--font-mono`, add:

```css
  --font-display: "Space Grotesk Variable", "Space Grotesk", system-ui, sans-serif;
  --font-body: "DM Sans Variable", "DM Sans", system-ui, sans-serif;
```

Each has a real fallback stack, so a missing font file degrades rather than
breaking.

**Verify**: `grep -c "font-display\|font-body" src/renderer/styles/variables.css`
returns at least 2.

### Step 4: Use them

In `src/renderer/index.html`, change the body `font-family` to
`var(--font-body)`, keeping the existing platform stack as the fallback after
it in case the token has not loaded.

Then set `--font-display` on the app header's `h1` only, in
`src/renderer/styles/App.module.css` under `.title`. Do not sweep it across
every heading in this plan; the wordmark is where it matters and a wider
application is a design decision for plan 035.

**Verify**: `npm run build` → exit 0, then `npm start` and confirm the header
wordmark renders in Space Grotesk and body text in DM Sans. Check in DevTools:
`getComputedStyle(document.querySelector('h1')).fontFamily` contains
`Space Grotesk`.

### Step 5: Confirm it survives packaging and works offline

```
npm run package
```

Launch the packaged app with networking disabled.

**Verify**: the fonts still render. If they do not, the woff2 files are not
being bundled and Step 2's webpack rule needs fixing.

## Test plan

No test suite. By hand:

- Dev build renders both faces.
- Packaged build renders both faces.
- Packaged build with no network renders both faces (this is the check that
  matters; the app's offline promise is a selling point).
- Monospace elements (timecodes, key chips) are unchanged.
- The app still starts in under the time it did before; note the bundle size
  delta in the PR.

## Done criteria

- [ ] `npm run build` exits 0
- [ ] `npm run package` succeeds and the packaged app renders both faces with
      networking off
- [ ] `getComputedStyle(document.body).fontFamily` contains `DM Sans`
- [ ] `getComputedStyle(document.querySelector('h1')).fontFamily` contains
      `Space Grotesk`
- [ ] No `var(--font-mono)` usage changed
- [ ] `plans/README.md` status row updated

## STOP conditions

- The packaged app cannot find the fonts offline after two attempts at the
  webpack rule. Report the bundle contents rather than falling back to a CDN
  link, which would break the offline promise.
- The bundle grows by more than about 400KB. Variable fonts should cost far
  less; a larger jump means every weight is being bundled and the import needs
  narrowing.

## Maintenance notes

- Keep the app's and the site's fontsource versions in step. A divergence shows
  up as two subtly different renderings of the same wordmark.
- A reviewer should look at a Windows screenshot, not just macOS. That is where
  this change is visible.

## Executor note, 2026-09-07 (app PR #13)

The steps above predate the direction hunt and specify DM Sans. Shipped as
**IBM Plex Sans** for interface and body, **IBM Plex Mono** for timecodes and
key chips, **Space Grotesk** for the header wordmark only.

Two things the plan did not know. There is no `@fontsource-variable/ibm-plex-mono`;
use `@fontsource/ibm-plex-mono` and import the weights the modules actually ask
for, which are 400, 500 and 600. And webpack had no rule for font files at all,
so one was added rather than reused.

Verified over `file://` in the running app that all three faces plus the Greek
and Latin Extended subsets resolve, and that all 15 font files are in the
packaged asar. 320KB on disk, 50KB of bundle.
