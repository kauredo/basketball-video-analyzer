# Plan 013: Rebuild the website whenever the app publishes a release

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving on. If
> anything in "STOP conditions" occurs, stop and report. When done, update this
> plan's status row in `plans/README.md`.
>
> **Repo**: monorepo of separate git repos. This plan touches **`app/`** (the
> release workflow) and **`website/`** (the fallback constant). Two branches,
> two commits, one in each repo.
>
> **Operator input required**: this plan needs a Vercel deploy hook URL stored
> as a GitHub Actions secret. See "Operator input" below. Do not invent a URL.
>
> **Drift check (run first)**: from `app/`, run
> `git diff --stat 9a863ed..HEAD -- .github/workflows/release.yml`; from
> `website/`, run `git diff --stat fa4bc39..HEAD -- src/utils/fallback.ts src/utils/github.ts`.

## Status

- **Priority**: P1
- **Effort**: S
- **Risk**: LOW
- **Depends on**: none
- **Category**: bug
- **Planned at**: `app` commit `9a863ed`, `website` commit `fa4bc39`, 2026-09-07
- **Executor's tool**: `/ship`

## Why this matters

The site's download button advertises version **1.6.0**. The latest GitHub
release is **v1.7.2**, published 2026-07-13. Coaches downloading from the site
are getting a build from two releases back, which is before the Windows startup
fix and before the auto-update repair, so those users cannot even update
themselves out of it.

Nothing is hardcoded wrong. The version is correct for the moment the site was
last built, and the site is a static Astro build that nobody rebuilds when the
app ships. Every release silently makes the site more stale.

Verified 2026-09-07: `https://api.github.com/repos/kauredo/basketball-video-analyzer/releases/latest`
returns `v1.7.2`, and the server-rendered HTML at
`https://basketballvideoanalyzer.com/` contains `1.6.0`.

## Current state

**The website reads the release at build time.** `src/pages/index.astro:15`:

```astro
const release = await getCachedLatestRelease() ?? fallbackReleaseData;
```

The same line appears in each of the six sub-pages, for example
`src/pages/film-breakdown.astro:8`. `getCachedLatestRelease()` calls the GitHub
API through `src/utils/github.ts`, which returns `null` on any failure
(`github.ts:110-127`) rather than throwing.

**The fallback is older still.** `src/utils/fallback.ts:3-4`:

```ts
export const fallbackReleaseData: ReleaseInfo = {
  version: "v1.0.0",
```

Its release notes also claim "Multi-Language: English and Portuguese support",
while the app now ships 11 locales. So when the API call fails at build time,
the site silently advertises v1.0.0 with wrong copy and nobody is told.

**The website has no CI.** `website/.github/` does not exist; Vercel builds on
push. `website/vercel.json` is present.

**The app has a release workflow.** `app/.github/workflows/release.yml` runs on
`push` of a `v*` tag. It has a `build` matrix job and a `release` job
(`needs: build`, `runs-on: ubuntu-latest`, starting at line 164) that publishes
the GitHub release. That `release` job is the correct place to notify the site.

## Operator input

Before Step 1, the operator must:

1. In the Vercel dashboard for the website project, create a **Deploy Hook** on
   the production branch. Vercel gives back a URL of the form
   `https://api.vercel.com/v1/integrations/deploy/<id>/<token>`.
2. In the **`kauredo/basketball-video-analyzer`** GitHub repo, add that URL as
   an Actions secret named `WEBSITE_DEPLOY_HOOK`.

If the operator has not done this, STOP after Step 2 and report that Step 1 is
blocked on the secret. Do not commit a URL into the workflow file. Never print
the secret's value in logs or in any file.

## Commands you will need

| Purpose | Command | Expected on success |
|---|---|---|
| Build site | `npm run build` (from `website/`) | exit 0 |
| Lint workflow | `gh workflow view release.yml` (from `app/`) | prints the workflow |
| Check latest release | `gh release view --json tagName` (from `app/`) | current tag |

No test suite in either repo. `npm run build` is the website's gate.

## Scope

**In scope**:
- `app/.github/workflows/release.yml` (add one step to the existing `release` job)
- `website/src/utils/fallback.ts` (refresh the stale constant)

**Out of scope** (do NOT touch):
- `website/src/utils/github.ts`. The caching and error handling are fine; the
  problem is that nothing triggers a rebuild.
- The seven page files that call `getCachedLatestRelease()`. They are correct.
- `app/.github/workflows/build.yml` and `notarize.yml`. Only the release job
  should trigger a site rebuild, not every CI run.
- Any change to how the app versions or tags itself.

## Git workflow

- App branch: `ci/trigger-website-rebuild-on-release`
- Website branch: `fix/refresh-release-fallback`
- Commit style: conventional commits in both repos; check `git log --oneline -5`
  in each and match.
- Never mention AI tools in commit messages and never add AI co-author lines.

## Steps

### Step 1: Trigger a site rebuild from the release job

In `app/.github/workflows/release.yml`, append a step to the **`release`** job
(the one starting at line 164, not the `build` matrix job), after the step that
publishes the GitHub release. The step should POST to the deploy hook:

```yaml
      - name: Rebuild the marketing site
        if: ${{ secrets.WEBSITE_DEPLOY_HOOK != '' }}
        run: curl -fsS -X POST "${{ secrets.WEBSITE_DEPLOY_HOOK }}"
```

The `if` guard means the workflow still succeeds for anyone who has not
configured the secret, rather than failing a release over a website concern.

Place it last in the job, so a deploy-hook failure cannot prevent the release
itself from publishing.

**Verify**: `gh workflow view release.yml` from `app/` prints the workflow
without a YAML parse error. Also run a YAML syntax check:
`python3 -c "import yaml,sys; yaml.safe_load(open('.github/workflows/release.yml')); print('ok')"`
→ prints `ok`.

### Step 2: Refresh the fallback so a failed fetch is not a lie

In `website/src/utils/fallback.ts`, update `version` from `"v1.0.0"` to the
current latest tag (read it with `gh release view --json tagName` from `app/`;
at planning time it was `v1.7.2`). In the same object's `releaseNotes`, change
the line

```
- **Multi-Language**: English and Portuguese support
```

to

```
- **Multi-Language**: 11 languages
```

Leave the `platforms` array, the URLs and the sizes alone. The URLs already use
`releases/latest/download/...`, so they resolve to the newest build regardless
of the version string.

**Verify**: from `website/`, `npm run build` → exit 0, and
`grep -n 'v1.0.0' src/utils/fallback.ts` returns no matches.

### Step 3: Confirm the deployed version after the next release

This step runs after the operator's next tagged release, not during
implementation. Record it in the PR description so it is not forgotten:

```
curl -s https://basketballvideoanalyzer.com/ | grep -o 'v\?1\.[0-9]\+\.[0-9]\+' | sort -u
```

**Verify**: the version printed matches `gh release view --json tagName`.

## Test plan

No test suite. Verification is:

- YAML parses (Step 1).
- Site builds (Step 2).
- A manual `curl -X POST "$WEBSITE_DEPLOY_HOOK"` by the operator triggers a
  Vercel deployment, confirming the hook works before the next release depends
  on it.
- After the next release, the version on the live site matches the tag.

## Done criteria

ALL must hold:

- [ ] `.github/workflows/release.yml` parses as valid YAML
- [ ] The new step lives in the `release` job, not the `build` job, and is the
      last step in it
- [ ] No deploy-hook URL appears anywhere in either repo's tracked files
      (`grep -rn "api.vercel.com/v1/integrations/deploy" .` returns nothing)
- [ ] `website/npm run build` exits 0
- [ ] `grep -n 'v1.0.0' website/src/utils/fallback.ts` returns no matches
- [ ] `plans/README.md` status row updated

## STOP conditions

Stop and report if:

- The `WEBSITE_DEPLOY_HOOK` secret does not exist. Report that Step 1 is
  blocked on operator input rather than hardcoding anything.
- The `release` job in `release.yml` has been restructured since planning and
  no longer has a clear final step.
- The website turns out to be deployed by something other than Vercel, which
  would make the deploy-hook approach wrong. Check `website/vercel.json` and
  the Vercel dashboard before assuming.

## Maintenance notes

- If the website ever moves off Vercel, this step's URL changes but the shape
  does not: the release job pings the site host to rebuild.
- An alternative worth considering later is fetching the release client-side so
  the page is never stale between builds. That trades a build-time API call for
  a runtime one and a flash of fallback content, which is why this plan does
  not do it.
- A reviewer should confirm the `if:` guard, so a missing secret degrades to a
  skipped step rather than a failed release.
