# Plan 038: Cut the last model-shaped copy off the landing page

> **Executor instructions**: Follow every step, run each verification command.
> Stop and report on any STOP condition. Update this plan's row in
> `plans/README.md` when done.
>
> **Repo**: monorepo of separate git repos. **`website/` only**.
>
> **Drift check**: from `website/`,
> `git diff --stat fa4bc39..HEAD -- src/pages/`

## Status

- **Priority**: P3
- **Effort**: S
- **Risk**: LOW
- **Depends on**: none
- **Category**: docs
- **Planned at**: commit `fa4bc39`, 2026-09-07
- **Executor's tool**: `/clarify`, against `~/.claude/writing-style.md`

## Why this matters

The site's copy is the strongest asset the 2026-09-07 audit found. It scored
7/10, the highest of the eight dimensions, and the critic called it the least
model-shaped copy in the portfolio. Three things survived the rewrite and are
worth removing, precisely because everything around them is good.

This plan is a trim, not a rewrite. Most of the page should not change.

## Current state

**1. One aphoristic closer**, in the final CTA at `src/pages/index.astro:299-302`:

```astro
        <h2 class="font-display text-3xl sm:text-4xl font-bold text-warm-900 mb-6">
          Free forever. Open source.<br>
          Built because coaches deserve better tools.
        </h2>
```

"Built because coaches deserve better tools" is the one sentence on the page
that could appear unchanged on any product's site. It sits in the closing CTA,
where the reader is deciding.

**2. Em dashes in four of the seven page titles.** Verified against production
on 2026-09-07:

| Route | Title |
|---|---|
| `/` | "Basketball Video Analyzer — Free Video Analysis Software for Coaches" |
| `/free-alternative` | "Free Basketball Video Breakdown Software — an Honest Hudl Alternative" |
| `/hudl-alternatives` | "Hudl Alternatives for Basketball Coaches — Free and Paid Options" |
| `/vs-inbound-studio` | "Basketball Video Analyzer vs Inbound Studio — Free vs Paid Film Breakdown" |

The other three use a pipe and are fine. There is also "Pass 1 — Load the game"
in the body of `/film-breakdown`.

**3. The rule of three, four times in one scroll**: "Mark plays, organize
clips, export folders" (hero), "cut, tag, export" (the more-things section),
"No subscriptions, no feature gates, no data collection" (closing CTA), and
"offense, defense, transitions" (feature card). Each works alone. Four on one
page is a rhythm the reader can hear.

**What must not change.** These are the strings a person clearly wrote, and the
audit's keep-list protects them:

- "I got tired of scrubbing through game tapes in VLC, so I built this. Mark
  plays, organize clips, export folders. That's it."
- "1.6.0 • 253.4 MB" under the CTA (the version updates itself once
  `plans/013` lands)
- "This isn't a Hudl replacement, and I won't pretend it is."
- "Those are real features. If you need them, pay for them."
- "A full game is too long for anyone to sit through a second time."
- "Okay, a few more things."
- "The loop is still cut, tag, export. These just make the film room easier."

Note the hero contains one of the four rule-of-three lists and is on the
keep-list. Keep the hero. Change one of the other three.

## Commands you will need

| Purpose | Command (from `website/`) | Expected |
|---|---|---|
| Build | `npm run build` | exit 0 |
| Dev server | `npm run dev` | port 4321 |

No test suite. `npm run build` is the gate.

## Scope

**In scope**:
- `src/pages/index.astro`, the closing CTA heading and one rule-of-three list
- The four `<title>` values containing an em dash
- `src/pages/film-breakdown.astro`, the "Pass 1 — Load the game" heading

**Out of scope**:
- Every string on the keep-list above.
- The six sub-pages' body prose. It is the best writing on the site.
- Meta descriptions and OG tags, unless they carry an em dash (check).
- The app's copy, which is `plans/037`.

## Git workflow

- Branch: `refactor/landing-copy`
- Conventional commits; check `git log --oneline -5` and match. Never mention
  AI tools and never add AI co-author lines.

## Steps

### Step 1: Replace the closer

Change the second line of the closing CTA heading from "Built because coaches
deserve better tools." to something only this product could say. The candidate
from the audit:

```
Free forever. Open source.
The film never leaves your laptop.
```

That names a real property of an offline desktop app, it is a reason to
download rather than a sentiment, and it is the one claim a coach handling
minors' footage actually cares about.

Confirm the claim is true before shipping it: the app is offline, stores clips
in `userData`, and the only network calls are the update check and the optional
YouTube import. If that is not accurate, pick a different true fact rather than
softening this one.

**Verify**: `grep -rn "deserve better tools" src/` returns no matches.

### Step 2: Replace the em dashes in the four titles

Use a colon, a comma or a pipe. The three titles that already use a pipe set the
house pattern, so match them:

- "Basketball Video Analyzer | Free Video Analysis Software for Coaches"
- "Free Basketball Video Breakdown Software | An Honest Hudl Alternative"
- "Hudl Alternatives for Basketball Coaches | Free and Paid Options"
- "Basketball Video Analyzer vs Inbound Studio | Free vs Paid Film Breakdown"

Keep every title under 60 characters where possible so search results do not
truncate; if one has to run longer, put the distinctive words first.

Also fix "Pass 1 — Load the game" in `/film-breakdown` to "Pass 1: load the
game".

**Verify**: `grep -rn "—" src/pages/` returns no matches.

### Step 3: Break one rule-of-three

Leave the hero's list (keep-list) and the more-things section's "cut, tag,
export" (it echoes the hero deliberately, which is the good kind of repetition).
Change the closing CTA's "No subscriptions, no feature gates, no data
collection" or the feature card's "offense, defense, transitions".

The feature card is the easier fix and `plans/015` is already rewriting that
card for the wrong shortcut keys. Coordinate: if plan 015 has landed, the list
may already be gone.

**Verify**: at most three rule-of-three constructions remain on the landing
route, and none of them is in the closing CTA and the hero at once.

### Step 4: Read the page aloud

**Verify**: `npm run build` → exit 0, then read the landing route top to bottom
out loud. No sentence should sound like it was written to sound good.

## Test plan

No test suite. By hand:

- `grep -rn "—" src/` returns nothing.
- Every keep-list string is byte-identical to before.
- Page titles render correctly in the browser tab and are under 60 characters
  where possible.
- The new closer states a fact about the product that is true.
- The build emits all eight pages.

## Done criteria

- [ ] `npm run build` exits 0
- [ ] `grep -rn "—" src/` returns no matches
- [ ] "Built because coaches deserve better tools" no longer appears
- [ ] Every string on the keep-list is unchanged (diff them explicitly)
- [ ] The four titles use the same separator as the other three
- [ ] `plans/README.md` status row updated

## STOP conditions

- The replacement closer would make a claim that is not true. Check the app's
  network behaviour before writing "the film never leaves your laptop"; the
  update check and the YouTube import both use the network, though neither
  uploads video.
- Any keep-list string would have to change to make an edit work. Stop; the
  keep-list wins.

## Maintenance notes

- The em dashes are in `<title>` tags, which nobody reads during review because
  they are not visible on the page. Worth a grep in whatever pre-commit or CI
  check the site gains later.
- A reviewer should compare the keep-list strings byte for byte, since a
  well-meaning edit to the hero is the main risk in a copy change.
