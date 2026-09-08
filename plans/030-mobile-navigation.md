# Plan 030: Give the site navigation on a phone

> **Executor instructions**: Follow every step, run each verification command.
> Stop and report on any STOP condition. Update this plan's row in
> `plans/README.md` when done.
>
> **Repo**: monorepo of separate git repos. **`website/` only**.
>
> **Drift check**: from `website/`,
> `git diff --stat fa4bc39..HEAD -- src/components/ui/Navbar.astro src/data/guides.ts`

## Status

- **Priority**: P1
- **Effort**: M
- **Risk**: LOW
- **Depends on**: `plans/012-footer-overflow.md` (so overflow measurements are
  meaningful), `plans/016-one-product-name.md` (the longer wordmark has to fit)
- **Category**: bug
- **Planned at**: commit `fa4bc39`, 2026-09-07
- **Executor's tool**: `/adapt`

## Why this matters

At 393px the site has no navigation. Measured across all seven routes on
2026-09-07, the top 120 CSS pixels contain zero non-background pixels beyond
the wordmark and the Download button: no menu trigger, no links, nothing.

The consequence is that six of the seven routes, which are the guide and
comparison pages search traffic lands on, are reachable on a phone only from
the footer at the bottom of a page that runs 5,790px on the home route. And
until `plans/012` lands, that footer row is itself clipped at both edges.

## Current state

`src/components/ui/Navbar.astro` is the whole navigation. It renders:

- a logo link (mark plus wordmark) on the left
- a GitHub icon link, classed `hidden sm:block`, so it disappears below 640px
- a Download button

There is no `<button>`, no `aria-expanded`, no menu markup and no script. A DOM
query on production for `header button, nav button, [aria-expanded]` returned an
empty array on every route.

The guide links exist as data. `src/data/guides.ts` is imported by
`src/components/ui/Footer.astro:2` and mapped into the footer's guide nav, so
the same source can feed a mobile menu without duplicating the list.

`src/components/ui/RelatedGuides.astro` also renders from that data.

**Repo conventions.** Astro components with Tailwind utilities inline.
Interactive islands use React with a `client:` directive
(`DownloadButton.tsx` uses `client:idle`). A disclosure menu does not need
React; a small inline `<script>` toggling `hidden` and `aria-expanded` is
lighter and matches the site's otherwise static nature. Prefer that.

## Commands you will need

| Purpose | Command (from `website/`) | Expected |
|---|---|---|
| Build | `npm run build` | exit 0 |
| Dev server | `npm run dev` | serves on port 4321 |

No test suite. `npm run build` is the gate.

## Scope

**In scope**:
- `src/components/ui/Navbar.astro`

**Out of scope**:
- `src/data/guides.ts`. Read it, do not restructure it.
- The footer. Its guide nav stays; plan 012 fixes its overflow.
- The desktop navbar's appearance above the `sm` breakpoint. Desktop currently
  shows no links either, and adding them there is a composition decision that
  belongs with `plans/034` and `plans/033`, not with this accessibility fix.
  If the operator wants desktop links too, say so and this plan grows.

## Git workflow

- Branch: `feat/mobile-navigation`
- Conventional commits; check `git log --oneline -5` and match. Never mention
  AI tools and never add AI co-author lines.

## Steps

### Step 1: Add a menu trigger below the `sm` breakpoint

In `src/components/ui/Navbar.astro`, add a button before the Download link,
visible only below `sm`:

```astro
        <button
          type="button"
          id="nav-menu-toggle"
          class="sm:hidden inline-flex items-center justify-center w-11 h-11 -mr-2 text-warm-700"
          aria-label="Open menu"
          aria-expanded="false"
          aria-controls="nav-menu"
        >
          <!-- hamburger icon, currentColor, 24x24 -->
        </button>
```

The 44px hit target (`w-11 h-11`) is the minimum comfortable touch size and
matches the app's own `--min-interactive-size: 44px`.

**Verify**: the button renders below 640px and is absent at and above it.

### Step 2: Add the panel, driven by the guides data

Import `guides` from `src/data/guides.ts` the way `Footer.astro:2` does, and
render a panel under the bar:

```astro
<div id="nav-menu" hidden class="sm:hidden border-b border-warm-200/60 bg-warm-50">
  <nav aria-label="Guides" class="max-w-6xl mx-auto px-4 py-3 flex flex-col">
    {guides.map((g) => (
      <a href={g.href} class="py-3 text-warm-700 hover:text-warm-900">{g.label}</a>
    ))}
    <a href="https://github.com/kauredo/basketball-video-analyzer" class="py-3 text-warm-700">GitHub</a>
  </nav>
</div>
```

Include the GitHub link here, since it is hidden below `sm` in the bar and
otherwise unreachable on a phone.

Use the `hidden` attribute rather than a class, and toggle `el.hidden` in
script. Each row is `py-3`, which gives a comfortable touch target without a
fixed height.

**Verify**: `npm run build` → exit 0, and the panel markup appears in every
built page.

### Step 3: Wire the toggle

Add a small inline `<script>` at the end of the component:

- click on the toggle flips `menu.hidden` and sets `aria-expanded` to match
- `Escape` closes the menu and returns focus to the toggle
- clicking a link closes it (it navigates, but closing avoids a flash on
  same-page anchors)
- the menu closes if the viewport crosses to `sm` or wider, so a rotation does
  not leave it stranded open

Do not trap focus. This is a disclosure, not a modal.

**Verify**: `npm run dev`, then at 393px open the menu, Tab through it, press
Escape, and confirm focus lands back on the toggle.

### Step 4: Check the bar still fits

With `plans/016` landed, the wordmark reads "Basketball Video Analyzer", and
the bar now also carries a menu button.

**Verify**: at 393px,
`document.querySelector('nav').scrollWidth <= 393`, and the wordmark, the
toggle and the Download button are all fully visible without overlap.

If they do not fit, reduce the wordmark to `text-base` below `sm` before
considering anything else.

## Test plan

No test suite. By hand at 393px, on `/` and one sub-page:

- The toggle is visible and at least 44x44.
- Tapping it opens a panel listing all six guides plus GitHub.
- `aria-expanded` flips between `"false"` and `"true"`.
- Escape closes it and focus returns to the toggle.
- Tapping a guide link navigates to that page.
- Rotating to landscape (or resizing past 640px) closes the menu.
- At 1440px, nothing changed: no toggle, no panel.
- Keyboard only: Tab reaches the toggle, Enter and Space both open it.

## Done criteria

- [ ] `npm run build` exits 0
- [ ] At 393px, a menu trigger exists on all seven routes plus 404
- [ ] The open menu lists all six guides from `src/data/guides.ts` plus GitHub
- [ ] `aria-expanded` tracks the panel's state
- [ ] Escape closes the menu and restores focus to the toggle
- [ ] `document.querySelector('nav').scrollWidth <= 393` at 393px
- [ ] Nothing changes at and above the `sm` breakpoint
- [ ] `plans/README.md` status row updated

## STOP conditions

- The bar cannot fit the wordmark, the toggle and the Download button at 393px
  even with a smaller wordmark. Report the measured widths; the answer is then
  moving Download into the menu, which changes the primary action's prominence
  and needs the operator's call.
- `src/data/guides.ts` turns out not to contain all six guide routes. Report
  what it has rather than hardcoding a second list.

## Maintenance notes

- The menu reads from `src/data/guides.ts`, so a new guide appears in the
  navbar, the footer and `RelatedGuides` at once. Keep it that way.
- A reviewer should test on a real phone with a keyboard attached, or at least
  with the keyboard-only path, since the disclosure script is the only
  JavaScript in the navbar.
