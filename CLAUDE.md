# Basketball Video Analyzer (desktop app)

Electron 28 + React + better-sqlite3. Free and AGPL. One active coach drives most releases by email.

## Three repos
- `app/` (this one, `kauredo/basketball-video-analyzer`): the product. `plans/` lives here and covers the website too.
- `website/` (`kauredo/basketball-video-analyzer-website`): Astro site. A tagged release pings its deploy hook.
- `worker/` (`kauredo/basketball-video-analyzer-worker`): the Cloudflare Worker that turns in-app feedback into GitHub issues.

## Checks
- Node 22 (`.nvmrc`). `npm test` runs `.mts` files with Node's type stripping and imports nothing from `node_modules`.
- `npm run build` runs `lint:locales`, `tsc` and webpack. CI (`build.yml`) runs the tests plus a three-OS package build on every PR.

## Rules
- Every UI string goes into all 11 files in `src/i18n/locales/`. `npm run lint:locales` fails on a missing key.
- Every IPC handler in `src/main/main.ts` checks what the renderer sends: paths through `isVideoFile` / `insideDir`, clip input through `src/shared/clipInput.ts`. The renderer is not trusted with paths.
- Pure logic goes in its own module with a `.test.mts` next to it, because `main.ts` cannot be imported by the tests.
- Conventional commits, squash-merged PRs, stacked when a change splits. Screenshots for PRs go on the `pr-assets` branch. Never delete it.

## Releasing
Bump `version` in `package.json`, commit `chore(release): X.Y.Z`, tag `vX.Y.Z` and push the tag. `release.yml` refuses a tag that does not match `package.json`, runs the tests, then builds all three platforms, signs the macOS build and publishes the release. Auto-update reads it through update.electronjs.org (`AUTOUPDATE.md`).

## Running the packaged app on scratch data
`npm run package`, then launch the binary in `out/` with `--user-data-dir=<scratch>` and `--remote-debugging-port=<port>` and drive it over CDP. Playwright's Electron launcher times out because a fuse is off. The log file still goes to the real `~/Library/Logs/basketball-video-analyzer/main.log`.
