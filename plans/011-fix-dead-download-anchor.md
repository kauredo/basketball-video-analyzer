# Plan 011: Make the navbar Download button work on every route

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving on. If
> anything in "STOP conditions" occurs, stop and report. When done, update this
> plan's status row in `plans/README.md`.
>
> **Repo**: monorepo of separate git repos. `app/` (Electron) and `website/`
> (Astro) each have their own `.git`. This plan touches **`website/` only**.
> Branch and commit inside `website/`.
>
> **Drift check (run first)**: from `website/`, run
> `git diff --stat fa4bc39..HEAD -- src/components/ui/Navbar.astro src/pages/`
> On a mismatch with the excerpts below, treat it as a STOP condition.

## Status

- **Priority**: P1
- **Effort**: S
- **Risk**: LOW
- **Depends on**: none
- **Category**: bug
- **Planned at**: commit `fa4bc39`, 2026-09-07
- **Executor's tool**: `/ship`

## Why this matters

The Download button in the navbar is the site's primary action and appears on
all seven routes. It targets the fragment `#download`. That id exists only on
the home page. On the six guide and comparison routes the button does nothing:
the browser appends `#download` to the URL and the page does not move.

Six of the seven routes are the SEO surface, which is where search traffic
lands. Those visitors currently meet a dead primary action.

Verified live on 2026-09-07 against production: `document.getElementById('download')`
returns an element on `/` and null on `/for-coaches`, `/scouting`,
`/film-breakdown`, `/free-alternative`, `/hudl-alternatives` and
`/vs-inbound-studio`. The navbar renders the same `<a href="#download">Download</a>`
on all seven.

## Current state

- `src/components/ui/Navbar.astro`: the shared fixed navbar, rendered on every
  route through `src/layouts/BaseLayout.astro`. The CTA is at line 33.
- `src/pages/index.astro:296`: the only `id="download"` in the codebase, on the
  final CTA section.

`src/components/ui/Navbar.astro:31-40`:

```astro
        <a
          href="#download"
          class="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium
            bg-primary-500 text-white rounded-lg
            hover:bg-primary-600 transition-colors"
        >
          Download
        </a>
```

`src/pages/index.astro:296`:

```astro
  <section id="download" aria-label="Download" class="py-24 sm:py-32 bg-warm-100/30">
```

Confirmation that only one page defines the target:

```
$ grep -rln 'id="download"' src/pages/
src/pages/index.astro
```

**Repo conventions.** Astro components, Tailwind utility classes inline, no
CSS modules on the site. Internal links elsewhere in the codebase use
root-relative paths (`href="/scouting"`), so `/#download` matches house style.

## Commands you will need

| Purpose | Command (run from `website/`) | Expected on success |
|---|---|---|
| Install | `npm install` | exit 0 |
| Build | `npm run build` | exit 0, all 8 pages built |
| Dev server | `npm run dev` | serves on port 4321 |

There is no test suite. `npm run build` is the verification gate.

## Scope

**In scope**:
- `src/components/ui/Navbar.astro`

**Out of scope** (do NOT touch):
- `src/pages/index.astro`. Do not add a second download section, and do not
  move the existing one.
- The six sub-pages. Do not add an `id="download"` section to each of them;
  that duplicates the CTA six times and is a content decision, not a bug fix.
- The footer, which has its own Releases link and is unaffected.

## Git workflow

- Branch: `fix/navbar-download-anchor`
- Commit style: conventional commits; check `git log --oneline -5` and match.
- Never mention AI tools in the commit message and never add AI co-author lines.
- Do not push or open a PR unless the operator asks.

## Steps

### Step 1: Point the CTA at the home page's anchor

In `src/components/ui/Navbar.astro`, change the CTA's `href` from `#download`
to `/#download`. Change nothing else about the element: keep every class, the
text, and the surrounding markup exactly as they are.

On the home page a browser treats `/#download` as a same-page fragment and
still scrolls smoothly. On the other six routes it navigates to the home page
and lands on the download section.

**Verify**: `grep -n 'href="/#download"' src/components/ui/Navbar.astro`
returns exactly one line, and
`grep -cn 'href="#download"' src/components/ui/Navbar.astro` returns 0.

### Step 2: Build and check every route

**Verify**: `npm run build` → exit 0. Then
`grep -l 'href="/#download"' dist/*.html dist/**/*.html | wc -l` → 8 (the seven
routes plus the 404 page, all of which render the navbar).

### Step 3: Confirm the behaviour in a browser

Run `npm run dev`, open `http://localhost:4321/scouting`, and click **Download**
in the navbar.

**Verify**: the browser navigates to the home page and lands on the download
section, with the download buttons visible. Then open
`http://localhost:4321/` and click **Download**: the page scrolls down to the
same section without a reload.

## Test plan

No test suite exists. Verify by hand on all seven routes plus 404:

- `/` scrolls to the download section without navigating away.
- Each of `/for-coaches`, `/scouting`, `/film-breakdown`, `/free-alternative`,
  `/hudl-alternatives`, `/vs-inbound-studio` navigates to the home page's
  download section.
- `/404` behaves the same as the sub-pages.

## Done criteria

ALL must hold:

- [ ] `npm run build` exits 0
- [ ] `grep -rn 'href="#download"' src/` returns no matches
- [ ] Clicking Download on `/scouting` lands on the home page's download section
- [ ] Clicking Download on `/` scrolls without a page load
- [ ] `git status` shows only `src/components/ui/Navbar.astro` modified
- [ ] `plans/README.md` status row updated

## STOP conditions

Stop and report if:

- `src/pages/index.astro` no longer contains `id="download"`, meaning the
  target section was renamed or removed and this fix would point at nothing.
- The build emits a different number of HTML pages than 8, meaning routes were
  added or removed since this plan was written.

## Maintenance notes

- If the six sub-pages ever get their own download section, revisit this. A
  local `#download` would then be the better target and the navbar would need
  to choose between them.
- A reviewer should confirm no smooth-scroll JavaScript keyed on the exact
  string `#download` exists; a search of `src/` at planning time found none.
