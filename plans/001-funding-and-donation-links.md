# Plan 001: Add donation/funding surfaces (FUNDING.yml, README, website footer, in-app About + one-time nudge)

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md`.
>
> **Drift check (run first)**:
> `cd app && git diff --stat 717500b..HEAD -- src/renderer/App.tsx src/renderer/components/ClipLibrary.tsx src/renderer/utils/storage.ts src/main/main.ts src/main/preload.ts src/types/global.d.ts README.md`
> and `cd website && git diff --stat 6c6cf68..HEAD -- src/components/ui/Footer.astro`
> If any in-scope file changed since this plan was written, compare the
> "Current state" excerpts against the live code before proceeding; on a
> mismatch, treat it as a STOP condition.

## Status

- **Priority**: P1
- **Effort**: M
- **Risk**: LOW
- **Depends on**: none
- **Category**: direction (monetization)
- **Planned at**: app repo commit `717500b`, website repo commit `6c6cf68`, 2026-07-10

## Operator input required

The donation URL. If the operator's instructions do not include one, use the
placeholder `https://buymeacoffee.com/kauredo` everywhere this plan says
`DONATION_URL`, and state prominently in your completion report:
**"Donation URL is a placeholder — confirm the Buy Me a Coffee / Ko-fi handle
before the next release."** Do not invent a different URL.

## Why this matters

The app is free, open source (AGPL-3.0), and has zero donation surfaces: no
`.github/FUNDING.yml`, no sponsor link in the README, no donate link on the
website, and no mention inside the app. The owner wants a low-friction way for
users who get value from the app to contribute. This plan adds the standard
surfaces plus one tasteful, one-time in-app nudge after a user has exported 25
clips (i.e., after demonstrated value). Nothing may ever block or interrupt the
workflow.

## Current state

This is a monorepo of **three separate git repos**: `app/` (Electron app),
`website/` (Astro site), `worker/` (not touched here). Commit in each repo
separately.

**App repo (`app/`):**

- `app/.github/` exists (contains `workflows/`); there is **no FUNDING.yml**.
- `app/README.md:5-7` — badges are stale (version says 1.0.0; real version is
  1.6.0 per `app/package.json`; the license badge is wrong — the LICENSE file
  is AGPL-3.0):
  ```markdown
  ![Version](https://img.shields.io/badge/version-1.0.0-blue.svg)
  ![Platform](https://img.shields.io/badge/platform-Windows%20%7C%20macOS%20%7C%20Linux-lightgrey.svg)
  ![License](https://img.shields.io/badge/license-Free%20for%20Teams-green.svg)
  ```
  README `##` headings use emoji prefixes (e.g. `## 📞 Support`, `## 🤝 Contributing`). Match that style.
- `app/src/main/main.ts:1` imports `shell` from electron; `shell.openExternal`
  is used only inside the app menu (`main.ts:197`). There is **no renderer-facing
  IPC to open external URLs**.
- IPC convention (follow it exactly) — example chain for an existing handler:
  - `main.ts:1383` — `ipcMain.handle("getKeyBindings", ...)`
  - `preload.ts` exposes methods on `window.electronAPI` via
    `ipcRenderer.invoke("channel", args)`
  - `src/types/global.d.ts` declares the method on the `electronAPI` interface.
- Settings modal is inline in `app/src/renderer/App.tsx:699-787`. Sections in
  order: General (`:724-745`), Key Bindings (`:747-750`), Categories, Players,
  then Danger Zone (`:770-783`). Each section is:
  ```tsx
  <div className={styles.settingsSection}>
    <h3 className={styles.settingsSectionTitle}>{t("app.settings.general")}</h3>
    <div className={styles.settingsRow}>...</div>
  </div>
  ```
  There is **no About section and no version display** anywhere in settings.
- Toasts: `app/src/renderer/contexts/ToastContext.tsx` exports
  `useToastContext()` returning `{ showSuccess, showError, showWarning, showInfo }`,
  each `(message: string, duration?: number) => string`. Toasts are text-only
  (no action buttons).
- Export success call sites (both in `app/src/renderer/components/ClipLibrary.tsx`,
  which already destructures the toast hook near line 79):
  - `ClipLibrary.tsx:273` (inside `handleExportCategory`):
    ```ts
    showSuccess(t("app.clips.exportSuccess", { count: result.count, dir: result.exportDir }));
    ```
  - `ClipLibrary.tsx:348` (inside `handleExportAll`): identical line.
  `result.count` is the number of clip files exported in that batch.
- Local prefs helper `app/src/renderer/utils/storage.ts` (27 lines):
  ```ts
  export const STORAGE_KEYS = {
    SIDE_PANEL_WIDTH: "sidePanelWidth",
    ...
    ONBOARDING_COMPLETE: "onboardingComplete",
  } as const;
  export function loadPref<T>(key: string, fallback: T): T { ... }
  export function savePref<T>(key: string, value: T): void { ... }
  ```
- i18n: 11 locale files at `app/src/i18n/locales/{en,pt,es,fr,de,it,sl,sr,lt,tr,el}.json`.
  All keys nested under a top-level `app` object; usage is
  `t("app.settings.general")` via `useTranslation()`. **Every new key must be
  added to all 11 files.** en and pt translations are given in this plan;
  translate the remaining 9 yourself, matching the tone of existing entries in
  each file (they are machine translations; short strings are fine).

**Website repo (`website/`):**

- Footer: `website/src/components/ui/Footer.astro`. The right-hand link group
  is `Footer.astro:30-69` — anchors for Basketball Stats App, GitHub, Issues,
  Releases, then `mailto:` Contact. Every external anchor uses
  `target="_blank" rel="noopener noreferrer" class="hover:text-warm-900 transition-colors"`.

## Commands you will need

| Purpose | Command | Expected on success |
|---|---|---|
| App install | `cd app && npm install` | exit 0 |
| App build (typecheck + bundle) | `cd app && npm run build` | exit 0, no TS errors |
| Website build | `cd website && npm run build` | exit 0 |
| i18n parity check | see Step 7 | new keys missing from 0 files |

There is no test suite in either repo; the builds are the verification gates.

## Scope

**In scope** (the only files you should modify/create):
- `app/.github/FUNDING.yml` (create)
- `app/README.md`
- `app/src/main/main.ts` (two small additions: `open-external` + `get-app-version` handlers)
- `app/src/main/preload.ts`
- `app/src/types/global.d.ts`
- `app/src/renderer/utils/constants.ts` (create)
- `app/src/renderer/utils/storage.ts` (add two STORAGE_KEYS entries)
- `app/src/renderer/App.tsx` (About section only)
- `app/src/renderer/components/ClipLibrary.tsx` (nudge logic only)
- `app/src/i18n/locales/*.json` (all 11)
- `website/src/components/ui/Footer.astro`

**Out of scope** (do NOT touch):
- `worker/` entirely.
- Any payment/paid-tier/license-key code — the app stays fully free.
- The app menu in `main.ts` (~line 185-204).
- No new UI components; the nudge is a plain toast.
- Do not redesign the Settings modal or reorder existing sections.

## Git workflow

- App repo: branch `feat/donation-links` off `main`. Website repo: branch
  `feat/donation-link` off `main`. Conventional commits (`feat: ...`).
- Do NOT push or open PRs unless the operator instructed it.
- Do not mention AI tools in commit messages and do not add AI co-author lines.

## Steps

### Step 1: FUNDING.yml (app repo)

Create `app/.github/FUNDING.yml`:

```yaml
github: kauredo
custom: ["DONATION_URL"]
```

(substituting the real donation URL). Note in your report: the `github:` line
only renders a Sponsor button once the owner enrolls in GitHub Sponsors; it is
harmless if not enrolled.

**Verify**: `cat app/.github/FUNDING.yml` → shows both lines.

### Step 2: README badges + support section (app repo)

In `app/README.md`:

1. Replace the three badge lines (5-7) with:
   ```markdown
   ![Version](https://img.shields.io/github/v/release/kauredo/basketball-video-analyzer)
   ![Platform](https://img.shields.io/badge/platform-Windows%20%7C%20macOS%20%7C%20Linux-lightgrey.svg)
   ![License](https://img.shields.io/badge/license-AGPL--3.0-blue.svg)
   ```
2. Add a new section immediately **before** `## 🤝 Contributing`:
   ```markdown
   ## ❤️ Support the Project

   Basketball Video Analyzer is free and open source, built and maintained by
   one person. If it saves you time on film nights, you can support development:

   - **[Buy me a coffee](DONATION_URL)** — one-off, no account needed
   - **Star the repo** — helps other coaches find it
   - **[Report bugs and request features](https://github.com/kauredo/basketball-video-analyzer/issues)**
   ```

**Verify**: `grep -n "Support the Project" app/README.md` → one match; `grep -c "1.0.0" app/README.md` → 0.

### Step 3: `open-external` + `get-app-version` IPC (app repo)

In `app/src/main/main.ts`, next to the other `ipcMain.handle` registrations
(e.g. after the `"getKeyBindings"` handler at ~line 1383), add:

```ts
const ALLOWED_EXTERNAL_URLS = [
  "https://github.com/kauredo/basketball-video-analyzer",
  "https://basketballvideoanalyzer.com",
  "DONATION_URL",
];

ipcMain.handle("open-external", async (_event, url: string) => {
  const ok = ALLOWED_EXTERNAL_URLS.some(
    allowed => url === allowed || url.startsWith(allowed + "/")
  );
  if (!ok) throw new Error("URL not allowed");
  await shell.openExternal(url);
  return true;
});

ipcMain.handle("get-app-version", () => app.getVersion());
```

`shell` and `app` are already imported at `main.ts:1`.

In `app/src/main/preload.ts`, add to the exposed API object (match neighbors'
style):

```ts
openExternal: (url: string) => ipcRenderer.invoke("open-external", url),
getAppVersion: () => ipcRenderer.invoke("get-app-version"),
```

In `app/src/types/global.d.ts`, add to the `electronAPI` interface:

```ts
openExternal: (url: string) => Promise<boolean>;
getAppVersion: () => Promise<string>;
```

**Verify**: `cd app && npm run build` → exit 0.

### Step 4: shared constants (app repo)

Create `app/src/renderer/utils/constants.ts`:

```ts
export const DONATION_URL = "DONATION_URL";
export const GITHUB_URL = "https://github.com/kauredo/basketball-video-analyzer";
export const DONATION_NUDGE_THRESHOLD = 25;
```

(The literal donation URL must equal one of the `ALLOWED_EXTERNAL_URLS`
entries from Step 3 exactly.)

**Verify**: `cd app && npm run build` → exit 0.

### Step 5: About section in Settings (app repo)

In `app/src/renderer/App.tsx`, insert a new settings section **between** the
Players section (ends `:768`) and the Danger Zone section (starts `:770`),
matching the existing section markup exactly:

```tsx
{/* About Section */}
<div className={styles.settingsSection}>
  <h3 className={styles.settingsSectionTitle}>{t("app.settings.about")}</h3>
  <div className={styles.settingsRow}>
    <span>{t("app.settings.version", { version: appVersion })}</span>
  </div>
  <div className={styles.settingsRow}>
    <button type="button" className={styles.themeToggle}
      onClick={() => window.electronAPI.openExternal(GITHUB_URL)}>
      <FontAwesomeIcon icon={faGithub} /> {t("app.settings.viewOnGithub")}
    </button>
    <button type="button" className={styles.themeToggle}
      onClick={() => window.electronAPI.openExternal(DONATION_URL)}>
      <FontAwesomeIcon icon={faHeart} /> {t("app.settings.supportProject")}
    </button>
  </div>
</div>
```

Supporting changes in App.tsx:
- `const [appVersion, setAppVersion] = useState("");` with the other state
  declarations (~line 60), and load it once:
  ```tsx
  useEffect(() => {
    window.electronAPI.getAppVersion().then(setAppVersion).catch(() => {});
  }, []);
  ```
- Imports: `DONATION_URL, GITHUB_URL` from `"./utils/constants"`; `faHeart`
  from `@fortawesome/free-solid-svg-icons` (add to the existing icon import).
  For `faGithub`: it lives in `@fortawesome/free-brands-svg-icons` — check
  `app/package.json` for that package. **If it is not installed, do not add a
  dependency**; use `faCode` from free-solid-svg-icons instead.
- Reuses the existing `styles.themeToggle` button class (see the theme button
  at `App.tsx:734-743`) — do not create new CSS.

**Verify**: `cd app && npm run build` → exit 0.

### Step 6: one-time donation nudge after 25 exported clips (app repo)

In `app/src/renderer/utils/storage.ts`, add to `STORAGE_KEYS`:

```ts
EXPORTED_CLIPS_TOTAL: "exportedClipsTotal",
DONATION_NUDGE_SHOWN: "donationNudgeShown",
```

In `app/src/renderer/components/ClipLibrary.tsx`, add a module-level helper
(near the top, after imports) — it needs `showInfo` and `t`, so implement it as
a function inside the component instead if you prefer; either way keep it
small:

```ts
const recordExportedClips = (count: number) => {
  const total = loadPref(STORAGE_KEYS.EXPORTED_CLIPS_TOTAL, 0) + count;
  savePref(STORAGE_KEYS.EXPORTED_CLIPS_TOTAL, total);
  const shown = loadPref(STORAGE_KEYS.DONATION_NUDGE_SHOWN, false);
  if (total >= DONATION_NUDGE_THRESHOLD && !shown) {
    savePref(STORAGE_KEYS.DONATION_NUDGE_SHOWN, true);
    showInfo(t("app.donation.nudge"), 12000);
  }
};
```

Call `recordExportedClips(result.count)` immediately after the `showSuccess`
lines at `ClipLibrary.tsx:273` and `ClipLibrary.tsx:348` (both call sites).
Import `loadPref`, `savePref`, `STORAGE_KEYS` from `../utils/storage` and
`DONATION_NUDGE_THRESHOLD` from `../utils/constants` (check what ClipLibrary
already imports first — do not duplicate imports). `showInfo` comes from the
already-destructured `useToastContext()` — add it to the destructuring if
absent.

The nudge fires at most once ever, is a passive toast, and never blocks.

**Verify**: `cd app && npm run build` → exit 0.

### Step 7: i18n keys (app repo, all 11 locales)

Add under `app.settings`:
- `"about"` — en: `"About"`, pt: `"Sobre"`
- `"version"` — en: `"Version {{version}}"`, pt: `"Versão {{version}}"`
- `"viewOnGithub"` — en: `"View on GitHub"`, pt: `"Ver no GitHub"`
- `"supportProject"` — en: `"Support this project"`, pt: `"Apoiar este projeto"`

Add a new `app.donation` object:
- `"nudge"` — en: `"You've exported {{count}}+ clips with this free app. If it saves you time, there's a coffee link in Settings → About."`
  pt: `"Já exportou mais de {{count}} clipes com esta aplicação gratuita. Se lhe poupa tempo, há um link para um café em Definições → Sobre."`
  (pass `{ count: DONATION_NUDGE_THRESHOLD }` in the `t()` call in Step 6).

Check pt.json's existing register (formal "você"-implicit vs informal "tu") by
reading a few existing strings and match it. Translate both keys into the other
9 locales (es, fr, de, it, sl, sr, lt, tr, el) yourself, matching each file's
existing tone.

**Verify** (run from `app/`):
```bash
node -e '
const fs=require("fs");const dir="src/i18n/locales";
const leaf=(o,p="")=>Object.entries(o).flatMap(([k,v])=>typeof v==="object"&&v?leaf(v,p+k+"."):[p+k]);
const en=new Set(leaf(JSON.parse(fs.readFileSync(dir+"/en.json","utf8"))));
for(const f of fs.readdirSync(dir).filter(f=>f.endsWith(".json"))){
const s=new Set(leaf(JSON.parse(fs.readFileSync(dir+"/"+f,"utf8"))));
const miss=[...en].filter(k=>!s.has(k));
console.log(f,"missing:",miss.length,miss.filter(k=>k.includes("donation")||k.includes("about")||k.includes("supportProject")||k.includes("viewOnGithub")).join(","));}'
```
Expected: every file prints nothing after `missing: N` for the new keys (the
trailing filtered list is empty). Note: pt.json may report ~7 pre-existing
missing `app.categories.default.*` keys — those are known-dead keys; ignore
them, do NOT add them.

### Step 8: website footer donate link (website repo)

In `website/src/components/ui/Footer.astro`, inside the link group
(`:30-69`), add a Donate anchor **before** the Contact mailto link, matching
the neighbors' classes exactly:

```astro
<a
  href="DONATION_URL"
  target="_blank"
  rel="noopener noreferrer"
  class="hover:text-warm-900 transition-colors"
>
  Donate
</a>
```

**Verify**: `cd website && npm run build` → exit 0.

## Test plan

No test suites exist in either repo. Manual verification (do these if you can
run the app; otherwise list them as unverified in your report):

1. `cd app && npm run dev` → open Settings → About section shows real version,
   both buttons open the default browser (not an Electron window).
2. DevTools console: `localStorage.setItem("exportedClipsTotal", "24")`, then
   export one or more clips → info toast appears once; export again → no toast.
3. Website: footer shows Donate between Releases and Contact.

## Done criteria

- [ ] `cd app && npm run build` exits 0
- [ ] `cd website && npm run build` exits 0
- [ ] `app/.github/FUNDING.yml` exists with `github:` and `custom:` entries
- [ ] `grep -rn "DONATION_URL" app/src website/src` returns **zero** matches
      (the literal placeholder must have been substituted everywhere)
- [ ] i18n parity check (Step 7) shows the new keys present in all 11 locales
- [ ] No files outside the in-scope list are modified (`git status` in both repos)
- [ ] `plans/README.md` status row updated

## STOP conditions

Stop and report back (do not improvise) if:

- The Settings modal markup in App.tsx no longer matches the excerpt
  (sections moved/extracted to a component).
- `ClipLibrary.tsx:273` / `:348` no longer contain the `exportSuccess`
  `showSuccess` calls.
- Adding `@fortawesome/free-brands-svg-icons` would be required and it is not
  already in `app/package.json` — use the documented fallback icon instead; if
  that also fails to compile, stop.
- Any instinct to add a payment flow, license check, or paid feature — that is
  explicitly out of scope.

## Maintenance notes

- If a paid tier is ever added, the `ALLOWED_EXTERNAL_URLS` allowlist in
  main.ts is the single place renderer-openable URLs are controlled.
- The nudge threshold and URL live in `app/src/renderer/utils/constants.ts`.
- Deferred deliberately: a nudge UI with a clickable button (would need a new
  component; the toast API is text-only). Revisit only if the Settings → About
  route measurably underperforms.
- Plan 004 (download stats) is the measurement side of this: donations + downloads
  together tell the owner whether monetization is worth further effort.
