# Plan 041: Upgrade Electron from 28 to 45, with a content security policy first

> **Executor instructions**: Follow this plan one step at a time. Each step is
> its own branch, its own pull request and its own squash commit, so any one of
> them can be reverted alone. Run every check in a step before you open its PR.
> If anything in "STOP conditions" happens, stop and report; do not improvise.
> When a step merges, tick it in the step table below and update this plan's
> row in `plans/README.md`, unless a reviewer dispatched you and told you they
> maintain the index.
>
> **Drift check (run first, and again before each step)**:
> `git diff --stat 5228f02..HEAD -- package.json forge.config.js webpack.config.js src/main/main.ts src/main/preload.ts src/main/autoUpdater.ts src/main/database.ts src/renderer/index.html .github/workflows`
> If any of those changed, compare the "Current state" excerpts against the
> live code before going on. A mismatch you cannot explain is a STOP condition.
> `.github/workflows` is expected to change once: a separate fix for the Linux
> build was in flight when this plan was written. Read that change before Step 4.

## Status

- **Priority**: P1
- **Effort**: L overall, as seven steps of S or M
- **Risk**: MED. Steps 1 to 4 are small and run on the current Electron. Step 5
  swaps the runtime and the SQLite binding at once, and Step 6 ships it to every
  user through auto-update.
- **Depends on**: none. Coordinate Step 4 with the Linux build fix (it edits the
  same workflow files).
- **Repo**: `app` (`kauredo/basketball-video-analyzer`)
- **Category**: security, maintenance
- **Audit**: BVA-C9 (Electron end of life); Steps 1 and 2 also cover the CSP and
  navigation-guard half of BVA-C10
- **Planned at**: commit `5228f02`, 2026-11-14

| Step | What | Size | Electron | Done |
|---|---|---|---|---|
| 1 | Content security policy in `index.html` | S | 28 | |
| 2 | Block in-window navigation and new windows | S | 28 | |
| 3 | Open dialogs remember the last folder | S | 28 | |
| 4 | Toolchain: Node 22 in CI, `@electron/rebuild` replaces `electron-rebuild` | S | 28 | |
| 5 | Electron 45, `better-sqlite3` 13, `@types/node` 24 | M | 45 | |
| 6 | Release: requirements, release notes, manual test list, tag | M (mostly the owner's time) | 45 | |
| 7 | Optional: Electron Forge 8 and `@electron/fuses` 2 | M | 45 | |

## Why this matters

The app ships Electron 28.3.3. Electron 28 reached end of life on 2024-06-10
and its last release, 28.3.3, came out on 2024-05-23. Electron supports the
latest three stable majors, and as of 2026-11-14 those are 45, 44 and 43. Every
installer this repo signs and notarises carries a Chromium from early 2024
(Chromium 120). The app renders local video, YouTube downloads and pasted text,
and opens external links, so the browser engine is the part most exposed to
outside input.

The renderer also has no content security policy. `main.ts:72-74` says the media
scheme "must NOT bypass CSP", but there is no CSP for it to bypass. A policy is
cheap to add on the current Electron and protects the app through the upgrade.

## Target: Electron 45

Facts from `releases.electronjs.org`, read on 2026-11-14:

| Major | Stable since | End of life | Chromium | Node | ABI |
|---|---|---|---|---|---|
| 28 (current) | 2023-12-04 | 2024-06-10 | 120 | 18.18 | 119 |
| 43 | 2026-06-29 | 2027-01-05 | 150 | 24.17 | 148 |
| 44 | 2026-08-24 | 2027-03-02 | 152 | 24.18 | 149 |
| **45** | 2026-10-20 | **2027-04-27** | 156 | 24.22 | 150 |
| 46 (beta) | 2027-01-05 (planned) | 2027-06-22 | 160 | 26.13 | |

Latest 45 release: **45.3.3** (2026-11-14, Chromium 156.0.8078.100, Node 24.22.3).

Why 45:
- It is the current stable major and has the longest support window of the
  three: about five months, against two for 43.
- 43 would avoid the macOS 13 requirement (see Decision D1 below), but it
  reaches end of life on 2027-01-05, so the next upgrade would be due almost at
  once.
- 46 is still in beta.

Why one jump from 28 to 45, with no stops at the majors in between: every major
between them is out of support, so a release on any of them would ship an
unsupported Chromium again. The inventory below shows the breaking changes that
touch this app are few and each has a known fix. If Step 5 breaks in a way the
inventory does not explain, bisect locally (install 33, then 38, then 42) to
find the major that broke it, but do not release from the middle.

Pin `"electron": "~45.3.3"` (patch updates only). Dependabot then raises the
minor and major bumps as PRs the owner can read.

## Decision for the owner before Step 6

**D1. macOS 12 (Monterey) users.** Electron 44 and later need macOS 13 or newer.
Neither `update-electron-app` nor update.electronjs.org documents any check of
the OS version before an update installs. A coach still on macOS 12 who has auto-update on
will download the Electron 45 build, restart into it, and the app will not
launch. Recovery is a manual download of the last 1.x release built on 28.

Options:
1. **Accept it (recommended).** Say "macOS 13 or newer" in the README, the
   release notes and the website download section, and link the last Electron 28
   release for anyone on macOS 12. The latest release had 50 mac downloads in
   total (dmg and zip), so the group affected is a fraction of a small number.
2. **Ship a guard release first.** One more release on Electron 28 whose
   `setupAutoUpdater` skips auto-update when `process.platform === "darwin"` and
   the Darwin major from `os.release()` is below 22 (macOS 13 is Darwin 22).
   Leave it out for a few weeks before Step 6, so most users pick it up. Users
   who skip that release and update straight to the 45 build still hit the
   problem, so this only shrinks the group. Size S.

Windows needs nothing: Electron has required Windows 10 since 23, and the
Squirrel build is already x64. Electron 44 dropped Windows 32-bit, which this
app never shipped.

## Current state

### Files in play

| File | Electron surface |
|---|---|
| `package.json` | `electron ^28.0.0` (line 72, installed 28.3.3), `electron-rebuild ^3.2.0` (73, deprecated), `better-sqlite3 ^9.2.2` (90, installed 9.6.0), `@types/node ^20.0.0` (67), `postinstall: electron-rebuild -f -w better-sqlite3` (18), `prepare-deps` uses `electron-forge import` (19) |
| `forge.config.js` | Forge 7 (`@electron-forge/cli ^7.8.1`, installed 7.11.2), `osxSign` with hardened runtime, `osxNotarize` through notarytool, asar with natives unpacked, `plugin-auto-unpack-natives`, `FusesPlugin` with six fuses |
| `src/main/main.ts` | `protocol.registerSchemesAsPrivileged` (75-85), `protocol.handle(MEDIA_SCHEME, ...)` with its own Range handling (335-401), `BrowserWindow` with `nodeIntegration: false`, `contextIsolation: true`, a preload, `loadFile` (220-238), `dialog.showOpenDialog` with no `defaultPath` at 503, 1099, 1969, 1986, `shell.openExternal` / `shell.openPath` |
| `src/main/preload.ts` | imports only `contextBridge` and `ipcRenderer`; exposes wrappers as `electronAPI` (305), including `ipcRenderer.on` and `removeAllListeners` |
| `src/main/autoUpdater.ts` | `updateElectronApp` with `ElectronPublicUpdateService`, `notifyUser: false`, Electron's `autoUpdater` events; Linux skipped |
| `src/main/database.ts` | `new Database(path.join(app.getPath("userData"), "clip-cutter.db"))` (118-122) |
| `src/renderer/index.html` | no CSP; an inline `<style>` block |
| `webpack.config.js` | `target: "electron-renderer"`; `devtool: "source-map"` in development and `false` in production (no `eval`); `style-loader` injects `<style>` tags; fonts emitted as files under `fonts/` |
| `.github/workflows/build.yml` | build matrix on Node 20 (43); `npm install -g @electron/rebuild` (78); `electron-rebuild -f --which better-sqlite3` (94) |
| `.github/workflows/release.yml` | Node 20 (28); `npm ci` runs the postinstall rebuild; mac signs in `make`, notarises with `--no-wait`; uploads `out/make/` |
| `.github/workflows/notarize.yml` | finds `*.dmg` / `*.zip` with `find`, staples, re-uploads |

### The fuses, `forge.config.js`

```js
new FusesPlugin({
  version: FuseVersion.V1,
  [FuseV1Options.RunAsNode]: false,
  [FuseV1Options.EnableCookieEncryption]: true,
  [FuseV1Options.EnableNodeOptionsEnvironmentVariable]: false,
  [FuseV1Options.EnableNodeCliInspectArguments]: false,
  [FuseV1Options.EnableEmbeddedAsarIntegrityValidation]: true,
  [FuseV1Options.OnlyLoadAppFromAsar]: true,
}),
```

Two fuses exist now that this list does not set: `GrantFileProtocolExtraPrivileges`
(default on) and `WasmTrapHandlers` (default on). Leave both at their defaults.
The app loads its page from `file://`, and the Electron fuses page says to turn
off `GrantFileProtocolExtraPrivileges` only if you do not serve pages from
`file://`.

### What the renderer loads (the CSP has to allow exactly this)

- Its own `bundle.js`, injected by `HtmlWebpackPlugin` as a file next to `index.html`.
- Inline styles: the `<style>` block in `index.html`, the `<style>` tags
  `style-loader` injects, Font Awesome's injected style tag, and React `style=`
  attributes (56 hits in `src/renderer`).
- Fonts from `@fontsource*`, emitted as `.woff2` files.
- Video and thumbnails over `clip-media://media/?path=...`
  (`src/renderer/utils/paths.ts:26`).
- One network call: `fetch("https://bva-feedback.kauredo.workers.dev/feedback")`
  in `FeedbackModal.tsx:46`.
- Canvas `toDataURL` for telestration (`utils/telestration.ts:201`). That needs
  no CSP entry, but allow `data:` and `blob:` images in case one is shown in an
  `<img>`.

## Breaking changes from 29 to 45 that touch this app

Each item was checked against the Electron breaking-changes page and grepped in
`src/`, `forge.config.js`, `package.json` and `.github/`.

| Major | Change | Where it touches this app | Action |
|---|---|---|---|
| 29 | `ipcRenderer` can no longer be sent over `contextBridge` | `preload.ts` exposes wrapper functions, never `ipcRenderer` itself | None. Smoke test the IPC events in Step 5 |
| 32 | `File.path` removed (use `webUtils.getPathForFile`) | No `File.path` use; every file pick goes through `dialog` in main | None |
| 32 | A `databases` folder in `userData` is deleted on first run | The SQLite file is `userData/clip-cutter.db`; clips and downloads are in `userData/clips` and `userData/downloads`. No `databases` folder | None. Manual test 1 confirms data survives |
| 33 | Native modules need C++20 | `better-sqlite3`. 9.x will not build against 45; 13.x ships prebuilt Node-API binaries | Step 5 bumps it |
| 33 | Custom protocol URLs containing Windows paths do not work with `protocol.handle` | `clip-media` puts the path in a `?path=` query with host `media`, so no Windows path sits in the URL's host or path | None. Manual test 2 on Windows |
| 37 | `null` `session` in `ProtocolResponse` removed | `protocol.handle` returns a `Response`, not a `ProtocolResponse` | None |
| 42 | The `electron` package no longer downloads its binary in `postinstall`; `ELECTRON_SKIP_BINARY_DOWNLOAD` is gone | `npm ci` in CI, the local boot workaround in `plans/README.md` ("run each package's `install.js`"). Nothing in the repo sets `ELECTRON_SKIP_BINARY_DOWNLOAD` | `require("electron")` now downloads on first use, so `electron-forge start` keeps working. Update the README note in Step 5 |
| 43 | `dialog.showOpenDialog` / `showSaveDialog` default to Downloads when `defaultPath` is not given, and the OS stops remembering the last folder | `main.ts:503` (`select-video-file`), `:1099` (`export-clips-by-category`), `:1969` and `:1986` (`load-session`, JSON then video). The save dialogs already pass `defaultPath` | Step 3 |
| 44 | macOS 12 dropped (macOS 13 required) | Every mac user | Decision D1, README and website copy in Step 6 |
| 44 | Windows ia32 and Linux armv7l binaries dropped | None shipped (Squirrel x64, deb/rpm x64, dmg arm64) | None |
| 44 | `clipboard` module removed from the renderer | Not used | None |
| 45 | Sandboxed preloads lose the `events`, `timers`, `url` shims and the `Buffer`, `setImmediate`, `clearImmediate` globals; `require` loads only `electron` | The preload is sandboxed (the default since 20 when `nodeIntegration` is off) and imports only `electron`. `ipcRenderer.on` and `removeAllListeners` keep working on the native `EventEmitter` | None. Step 5 greps the compiled preload |
| 45 | File descriptors for files inside ASAR only work through `fs` | ffmpeg, `better-sqlite3` and `youtube-dl-exec` are unpacked by `packagerConfig.asar.unpack`; the database lives in `userData` | None. Manual tests 3 and 4 cover ffmpeg and yt-dlp from the packaged app |

Checked and not used anywhere: `crashed` and `renderer-process-crashed` events,
`BrowserView`, `webContents` navigation history methods, `registerFileProtocol`,
`safeStorage`, `utilityProcess`, `console-message`, `nativeImage`,
`contentTracing`, `window.open`.

## Third-party compatibility

| Package | Now | Target | Notes |
|---|---|---|---|
| `better-sqlite3` | 9.6.0 | 13.2.0 | 12.0.0 dropped Electron 26 to 28. 13.0.0 moved to Node-API and ships prebuilt binaries inside the package (`prebuilds/<platform>-<arch>.node`, loaded from `lib/<platform>.js`), with no `prebuild-install`. 13.2.0 loads a locally compiled binary before the prebuilt one. `engines.node >= 22`. Avoid 13.1.0 (its release notes mark it "not a viable release") |
| `electron-rebuild` | 3.2.9 | removed | npm marks it deprecated: "Please use @electron/rebuild" |
| `@electron/rebuild` | 3.7.2 (through Forge) | 4.2.1 | ESM, `engines.node >= 22.12.0`. Forge already runs it during `start` and `package` |
| `@electron-forge/*` | 7.11.2 | stay on 7.11.2 for Step 5 | Forge 8.0.1 (2026-09-29) is ESM only, needs Node 22.17, moves DMG output to `out/make/dmg/<arch>/`, removes `electron-forge import` and requires `@electron/fuses` 2. Optional, Step 7 |
| `@electron/fuses` | 1.8.0 | 1.8.0 (2.1.3 in Step 7) | The fuse wire is versioned (`FuseVersion.V1`); keep 1.x with Forge 7 |
| `update-electron-app` | 3.3.0 | 3.3.0 | Latest. Its requirements are macOS or Windows, signed mac builds, a public repo and GitHub Releases. No Electron version limit |
| `@types/node` | ^20 | ^24 | Electron 45 bundles Node 24.22 |
| CI Node (build, release) | 20 | 22 | Node 20 is past end of life, and `better-sqlite3` 13 and `@electron/rebuild` 4 both need 22. `.nvmrc` is already 22.17.1 |

## Commands you will need

| Purpose | Command | Expected |
|---|---|---|
| Install | `npm ci` (see the npm 12 workarounds at the top of `plans/README.md`) | exit 0 |
| Unit tests | `npm test` | all pass |
| Typecheck | `npx tsc --noEmit` | no errors |
| Build | `npm run build` | exit 0 (runs the locale linter first) |
| Run | `npm run dev` | the app window opens |
| Package locally | `npm run make` | installers under `out/make/` |
| Read fuses | `npx @electron/fuses read --app <packaged app>` | the six fuses as configured |
| Electron version in a running app | DevTools console: `navigator.userAgent` | contains `Electron/45.3.3` |

## Steps

### Step 1: Content security policy (Electron 28) · S

The page loads from `file://`, so a response header set through
`webRequest.onHeadersReceived` does not apply to it. The Electron security
guide says to use a `<meta>` tag in that case.

In `src/renderer/index.html`, add as the first child of `<head>` after the
charset meta:

```html
<meta
  http-equiv="Content-Security-Policy"
  content="default-src 'none'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob: clip-media:; media-src 'self' blob: clip-media:; font-src 'self' data:; connect-src 'self' clip-media: https://bva-feedback.kauredo.workers.dev; object-src 'none'; base-uri 'none'; form-action 'none'; frame-src 'none'"
/>
```

`'unsafe-inline'` on styles is required by `style-loader`, the inline block in
`index.html` and React `style=` attributes. Scripts get no `'unsafe-inline'`
and no `'unsafe-eval'`; the webpack build uses neither.

Update the comment at `main.ts:72-74` only if it no longer matches; it says the
scheme must not bypass CSP, which is now true and enforced.

Checks:
- `npm run build` → exit 0, and `grep -c "Content-Security-Policy" dist/renderer/index.html` → 1.
- `npm run dev`, open DevTools, filter the console for `Content Security Policy`,
  then walk every screen: project list, open a video, seek, cut a clip with a
  drawing, the clip library in card and table view, stats and shot chart,
  present mode, settings and key bindings, onboarding hints, export menu,
  send feedback (submit a test entry), YouTube import. Zero violations.
- Inversion: delete `clip-media:` from `media-src`, reload, and confirm the video
  stops loading with a CSP error in the console. Put it back.

Rollback: revert the commit. Nothing else depends on it.

### Step 2: Block in-window navigation and new windows (Electron 28) · S

Part of BVA-C10. In `createWindow` in `main.ts`, after `new BrowserWindow`:

```ts
mainWindow.webContents.setWindowOpenHandler(() => ({ action: "deny" }));
mainWindow.webContents.on("will-navigate", event => event.preventDefault());
```

External links already go through the allowlisted `open-external` handler
(`main.ts:1612`), so no in-app link needs to navigate.

Checks:
- `npx tsc --noEmit` → no errors.
- `npm run dev`: drag a `.txt` file and a web link onto the window; the page
  stays. Help → Learn More still opens the browser. Every link in the About and
  donation surfaces still opens the browser.
- View → Reload still reloads (reload is not a navigation event).

Rollback: revert the commit.

Not in this step: restricting `play-clip` to the clips folder (the other half of
BVA-C10). It is independent of the upgrade.

### Step 3: Open dialogs remember the last folder (Electron 28) · S

Electron 43 makes every open dialog without `defaultPath` start in Downloads,
and the OS stops remembering the last folder. A coach who keeps game film in
one folder would have to walk to it on every import. Ship the fix on 28, where
passing the last folder gives the same result the OS gives today, so the
change is invisible until Step 5.

In `main.ts`, keep two module-level values, `lastVideoDir` and `lastSessionDir`
(plus `lastExportDir` for the directory picker), each `string | undefined`. Pass
the matching one as `defaultPath` at `:503`, `:1986` (video), `:1969` (session
JSON) and `:1099` (export folder). After a pick that is not cancelled, store
`path.dirname(filePaths[0])` (for the directory picker, store `filePaths[0]`).
This is the pattern on the breaking-changes page. Keeping the values in memory
is enough; the first dialog after a launch opens in Downloads on 45, which is
fine.

Checks:
- `npx tsc --noEmit` → no errors.
- `npm run dev`: open a video from a deep folder, then open the video picker
  again; it starts in that folder. Same for session import and export folder.

Rollback: revert the commit.

### Step 4: Toolchain on Electron 28 · S

Do this after the Linux build fix has merged, and read what it changed in
`build.yml` and `release.yml` first.

1. `.github/workflows/build.yml` and `release.yml`: `node-version: "20"` →
   `"22"` in the build and release matrices. Leave the `test` job on 24.
2. `package.json`: remove `electron-rebuild` and add `@electron/rebuild` `^4.2.1`
   as a devDependency. The new package installs a binary with the same name, so
   the `postinstall` script text stays as it is.
3. `build.yml:78`: drop `npm install -g @electron/rebuild`; the step at `:94`
   then uses the local binary through `npx electron-rebuild -f --which better-sqlite3`.
   This pins the rebuild tool through the lockfile, where the global install
   took whatever was latest.
4. `package.json:19`, `prepare-deps`: it calls `electron-forge import`, a
   one-time setup command. Delete the script unless the owner still uses it.

Checks:
- `npm ci` on Node 22.17.1 → exit 0, and the postinstall rebuild prints
  `Rebuild Complete`.
- `npm test`, `npx tsc --noEmit`, `npm run build` → pass.
- `npm run dev` opens a project with clips (proves the rebuilt binding loads).
- The PR's three-OS build matrix is green.

Rollback: revert the commit. Nothing user-facing changes.

### Step 5: Electron 45 and better-sqlite3 13 · M

These two go in one commit: `better-sqlite3` 9.x does not compile against
Electron 45 (C++20, ABI 150), and 12.x and later dropped Electron 28.

1. `package.json`:
   - `"electron": "~45.3.3"`
   - `"better-sqlite3": "^13.2.0"`
   - `"@types/node": "^24.0.0"`
   - Keep `@types/better-sqlite3` unless `better-sqlite3` 13 ships its own types
     (check `node_modules/better-sqlite3/package.json` for `types`); if it does,
     remove the `@types` package.
2. `npm install` (not `npm ci`), so the lockfile updates. Apply the npm 12
   workarounds from `plans/README.md` if needed, and revert any `allowScripts`
   block npm adds.
3. `npx tsc --noEmit`. Fix only what the new `@types/node` flags.
4. `plans/README.md`, the local-boot paragraph: the electron binary no longer
   needs its `install.js` run by hand from 42 on. Edit that sentence so it
   names ffmpeg only.

Checks:
- `npm test`, `npx tsc --noEmit`, `npm run build` → pass.
- `grep -nE "require\\(\"(events|timers|url|buffer)\"\\)|Buffer|setImmediate" dist/main/preload.js`
  → no output.
- `npm run dev`: DevTools shows `Electron/45.3.3` in `navigator.userAgent`; open
  an existing project made with 1.13.x; clips, players, categories and drawings
  are all there.
- `npm run make` on a Mac. Open the `.app` from `out/`, then run
  `npx @electron/fuses read --app out/BasketballVideoAnalyzer-darwin-arm64/BasketballVideoAnalyzer.app`
  → `RunAsNode` off, `EnableCookieEncryption` on, `EnableNodeOptionsEnvironmentVariable` off,
  `EnableNodeCliInspectArguments` off, `EnableEmbeddedAsarIntegrityValidation` on,
  `OnlyLoadAppFromAsar` on.
- From the packaged app: open a project, cut a clip (ffmpeg from
  `app.asar.unpacked`), import a YouTube link (yt-dlp and deno).
- Find which SQLite binary the packaged app loads: list
  `Contents/Resources/app.asar.unpacked/node_modules/better-sqlite3/` for
  `build/Release/*.node` (Forge's rebuild) and `prebuilds/`. Either works with
  Electron because both are Node-API; write down which one in the PR.
- The three-OS build matrix on the PR is green.

Rollback: revert the commit before any release. After a release, see "Risks".

### Step 6: Release · M

1. Decision D1 settled.
2. `README.md`: lines 23, 53, 322 and 324 say macOS 11. Change them to macOS 13
   (Ventura) or newer. Windows stays "Windows 10" (64-bit). The Linux line should
   follow Electron's own wording: distributions still supported by their
   maintainer, which drops "Ubuntu 18.04+".
3. The website download section in `kauredo/basketball-video-analyzer-website`
   gets the same requirement, in a separate PR there.
4. Run the manual test list below on real machines with the release-candidate
   builds from the PR's build artifacts.
5. Release as a minor version with the normal flow (bump, tag, wait for Release
   and Notarize). The release notes say: new Electron and Chromium, macOS 13 now
   required, and the link to the last release for macOS 12.

Rollback: see "Risks".

### Step 7 (optional): Electron Forge 8 and @electron/fuses 2 · M

Not needed for security. Do it when a Forge 7 bug or a new Forge feature gives a
reason, or before Forge 7 stops getting fixes.

- Bump every `@electron-forge/*` to `^8.0.1` and `@electron/fuses` to `^2.1.3`.
  Forge 8 is ESM only but loads a CommonJS `forge.config.js`. `forge.config.js`
  does `require("@electron/fuses")`, which is ESM in 2.x; Node 22.12+ allows
  `require` of ESM without top-level await. If it fails, rename the config to
  `forge.config.mjs` and switch to `import`.
- `package.json`: `"publish": "electron-forge publish"` → `"release": "electron-forge release"`
  (`publish` still works as a deprecated alias).
- DMG output moves to `out/make/dmg/<arch>/`. `release.yml` finds the DMG with
  `find out/make -name "*.dmg"` and uploads the whole `out/make/`, so it keeps
  working; check any other glob that names a fixed path.
- Config templating (`${version}` strings in config) was removed. This config
  has none.

Checks: `npm run make` on all three OSes in CI, the fuses read from Step 5,
and manual tests 5 and 6.

## Manual test list (owner, real machines)

Run on the release candidate from Step 5 before Step 6 tags it. Mac and Windows
are required; Linux at least for install and launch.

1. **Existing data.** Install the candidate over 1.13.x with real data. Every
   project opens with its clips, drawings, players and categories.
2. **Seek over `clip-media://`.** Open a long source video (over 1 GB if you
   have one). Drag the scrubber to the end, the middle and the start; the
   picture follows and does not snap back. Repeat on Windows with a video on a
   path that has a space and a drive letter (`D:\Game Film\...`). Play a cut clip
   from the library.
3. **Cut a clip with drawings.** Draw a pause annotation, cut across it, play the
   clip in present mode, and confirm the drawing is burnt into the clip at the
   right time.
4. **YouTube import.** Paste a public YouTube link; the download finishes, the
   video opens, and a clip cut from it plays.
5. **Auto-update from the previous version.** On a Mac and a Windows machine with
   1.13.x installed from the website, publish the new release, then use
   Check for Updates. The update downloads, the restart dialog appears, and after
   restart Help → About (or `navigator.userAgent` in DevTools) shows the new
   version and Electron 45.
6. **Notarised mac build.** Download the DMG from the GitHub release on a Mac that
   never had the app. It opens without a Gatekeeper warning.
   `spctl -a -vv /Applications/BasketballVideoAnalyzer.app` says
   `accepted, source=Notarized Developer ID`.
7. **Windows installer.** Run `Setup.exe` on a clean Windows 10 or 11 machine;
   the app installs, launches and creates its Start menu shortcut. Uninstall
   from Settings removes it.
8. **Linux installers.** Install the `.deb` on a current Ubuntu LTS and the `.rpm`
   on a current Fedora if you have one; the app launches and opens a video.
9. **CSP and dialogs.** DevTools console shows no CSP violation on any screen; send
   a feedback entry; the video picker opens in the last folder used.
10. **Exports.** CSV, JSON, Sportscode XML and export by category each write their
    files.

## Risks and rollback

| Risk | Step | What happens | Rollback |
|---|---|---|---|
| CSP blocks something not in the inventory | 1 | A screen loses styles, fonts or video, with a console error | Add the missing source to the policy, or revert Step 1 |
| `better-sqlite3` 13 fails to load in the packaged app | 5 | The startup database error banner (`dbInitError`) on launch | Caught before release by the packaged-app check. Revert Step 5 |
| Forge's rebuild picks a broken compiler path on one OS | 4, 5 | That OS's matrix job goes red | Fix in the PR; nothing ships |
| macOS 12 users update into a build that will not launch | 6 | The app does not open after the update | Decision D1. Users download the last 28 release by hand |
| A regression found after release | 6 | Users already run 45 | Squirrel only moves forward, so a rollback is a new, higher version built from a revert of Step 5. Its Chromium is older than the one that last opened the profile. Check on one machine first that UI preferences in `localStorage` (onboarding state, view mode) survive going back; clips and projects live in SQLite and are not affected |
| Notarisation rejects the new framework | 6 | The Notarize workflow fails | Nothing is published unstapled for long; fix the entitlements and re-tag |

## Done when

- Steps 1 to 6 are merged and a release built on Electron 45.3.x is published and
  notarised.
- `grep '"electron"' package.json` shows `~45.`, and `electron-rebuild` is gone
  from `package.json`.
- Manual tests 1 to 10 passed and the PR or release notes record who ran them,
  on which OS versions.
- README and website state macOS 13 or newer.

## STOP conditions

- The compiled preload needs anything beyond `electron` in Step 5's grep.
- The packaged app shows the database error banner, or a 1.13.x database loses
  rows when opened by the new build.
- Seeking over `clip-media://` snaps back on any OS.
- The fuses read differs from the six values in Step 5.
- Notarisation fails for a reason the entitlements file cannot fix.
- Any step grows past its size by more than half. Report instead of pushing on.

## Maintenance notes

- Electron 45 reaches end of life on 2027-04-27. The next upgrade (to 47 or
  later) is due by then, and this plan's inventory table is the template: read
  the breaking-changes page from 46 up, grep for each API, and repeat the manual
  test list.
- With `better-sqlite3` on Node-API, the same binary loads under plain Node and
  under Electron. That removes the reason `database.ts` has no unit tests
  (BVA-C18 in the 2026-11 code audit): tests can now import it
  with an in-memory database. Worth a small follow-up plan once Step 5 lands.
- The renderer uses `webpack` `target: "electron-renderer"` with Node integration
  off. `process` is not defined in the page; `FeedbackModal.tsx:55` reads
  `process.platform` anyway. Step 1's feedback check will show whether that call
  throws. Fix it in its own PR if it does.

## Docs this plan relied on (read 2026-11-14)

- Electron breaking changes: https://github.com/electron/electron/blob/main/docs/breaking-changes.md
- Electron release timelines and support policy: https://github.com/electron/electron/blob/main/docs/tutorial/electron-timelines.md
- Release data (versions, dates, Node, Chromium, ABI): https://releases.electronjs.org/releases.json and https://releases.electronjs.org/schedule.json
- Electron security guide, CSP section (meta tag for `file://`): https://github.com/electron/electron/blob/main/docs/tutorial/security.md
- Electron fuses: https://github.com/electron/electron/blob/main/docs/tutorial/fuses.md
- Electron native modules (Forge runs `@electron/rebuild` in dev and make): https://github.com/electron/electron/blob/main/docs/tutorial/using-native-node-modules.md
- Electron platform support: https://github.com/electron/electron/blob/main/README.md#platform-support
- `better-sqlite3` releases 12.0.0, 13.0.0, 13.1.0, 13.1.1, 13.2.0: https://github.com/WiseLibs/better-sqlite3/releases
- `better-sqlite3` troubleshooting (Electron and asar unpacking): https://github.com/WiseLibs/better-sqlite3/blob/master/docs/troubleshooting.md
- `@electron/rebuild` README and npm metadata: https://github.com/electron/rebuild
- Electron Forge 8.0.1 release notes: https://github.com/electron/forge/releases/tag/v8.0.1
- `@electron/fuses` README: https://github.com/electron/fuses
- `update-electron-app` README: https://github.com/electron/update-electron-app
