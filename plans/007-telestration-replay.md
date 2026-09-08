# Plan 007: Replay saved telestration drawings automatically during playback

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md`.
>
> **Drift check (run first)**:
> `cd app && git diff --stat 717500b..HEAD -- src/renderer/components/VideoPlayer.tsx src/renderer/components/TelestrationLayer.tsx src/renderer/utils/telestration.ts src/renderer/utils/storage.ts`
> If any in-scope file changed since this plan was written, compare the
> "Current state" excerpts against the live code; on a mismatch, treat it as
> a STOP condition.

## Status

- **Priority**: P2
- **Effort**: M
- **Risk**: MED (draws over the video during playback; must never intercept clicks or degrade playback)
- **Depends on**: none (plan 005 also touches VideoPlayer.tsx — land in either
  order but re-run the drift check)
- **Category**: direction (feature completion — deferred item from the telestration build)
- **Planned at**: app repo commit `717500b`, 2026-07-10

## Why this matters

Coaches save telestration drawings at specific timestamps (green pen markers on
the progress bar), but during normal playback the drawings never appear — you
must notice a marker and click it, which pauses the video and opens edit mode.
The recorded breakdown experience the app is going for ("watch the film, see
the coach's arrows appear at the right moments") needs the drawings to show up
on their own as playback passes their timestamp. This was explicitly deferred
when telestration shipped; the storage, loading, and rendering primitives all
exist.

## Current state

**App repo (`app/`).** All in `src/renderer/`.

- Saved annotations: DB rows `(project_id, video_path, timestamp REAL seconds,
  data TEXT = JSON array of TelestrationShape)`. VideoPlayer loads them:
  - `components/VideoPlayer.tsx:79` — `const [savedAnnotations, setSavedAnnotations] = useState<Annotation[]>([]);`
  - `:187-199` — `loadAnnotations` via `window.electronAPI.getAnnotations(projectId, videoPath)`.
  - `:222-237` — `openAnnotation(annotation)`: pauses, seeks to
    `annotation.timestamp`, `setShapes(JSON.parse(annotation.data))`,
    `setDrawMode(true)` — this is the click-to-edit path; keep it unchanged.
- Playback time: VideoPlayer keeps `currentTime` state (`:85`), updated by the
  video element's `onTimeUpdate={handleTimeUpdate}` (`:582`). `timeupdate`
  fires ~4 times/second — replay sync will be coarse (±250ms), which is fine.
- The video area (`:566-601`): `<video ref={videoRef} ...>` then
  `<TelestrationLayer active={drawMode && !videoError} videoRef={videoRef} containerRef={containerRef} shapes={shapes} ... />`
  then `<div className={styles.videoControls}>`. The new replay canvas mounts
  between the video and the TelestrationLayer (so edit mode always sits on top).
- Rendering primitives in `utils/telestration.ts` (reuse, do not duplicate):
  - `:162` `export function renderShapes(ctx, shapes, w, h)` — draws shapes
    (normalized 0-1 coords) onto a canvas 2D context of pixel size w×h.
  - `:201/:212` `export interface VideoContentRect` /
    `export function getVideoContentRect(...)` — computes the letterboxed
    content rect of the `<video>` inside its container (object-fit: contain
    math). Read both signatures in the file before writing code.
  - `components/TelestrationLayer.tsx` shows the canonical canvas sizing
    pattern (canvas sized to content rect × devicePixelRatio, then
    `renderShapes`) and uses a ResizeObserver to track the rect. Read its
    sizing/redraw effect before writing the new component and copy the
    approach.
- Pen toggle button (the styling pattern for the new replay toggle),
  `VideoPlayer.tsx:893-904`:
  ```tsx
  <button
    type="button"
    className={`${styles.speedButton} ${drawMode ? styles.drawButtonActive : ""}`}
    onClick={toggleDrawMode}
    title={t("app.telestration.draw")}
    aria-label={t("app.telestration.draw")}
    aria-pressed={drawMode}
  >
    <FontAwesomeIcon icon={faPen} />
  </button>
  ```
- Prefs: `utils/storage.ts` — `STORAGE_KEYS` + `loadPref`/`savePref`.
- i18n: 11 locales under `src/i18n/locales/`, keys under `app`, en+pt given
  below, translate the other 9 to match each file's tone.
- CSS modules: `src/renderer/styles/VideoPlayer.module.css` etc.; the app uses
  design tokens (`var(--color-…)`) — don't hardcode colors.

## Commands you will need

| Purpose | Command | Expected on success |
|---|---|---|
| Install | `cd app && npm install` | exit 0 |
| Build (typecheck + bundle) | `cd app && npm run build` | exit 0 |
| Run app | `cd app && npm run dev` | app opens |

## Scope

**In scope**:
- `src/renderer/components/AnnotationReplayLayer.tsx` (create)
- `src/renderer/components/VideoPlayer.tsx` (mount layer + toggle button + pref state)
- `src/renderer/utils/storage.ts` (one STORAGE_KEYS entry)
- `src/renderer/styles/VideoPlayer.module.css` ONLY if the toggle needs an
  active-state class that doesn't exist (prefer reusing `drawButtonActive`)
- `src/i18n/locales/*.json` (all 11)

**Out of scope** (do NOT touch):
- `utils/telestration.ts` — consume its exports as-is.
- `TelestrationLayer.tsx` — edit mode is unchanged.
- The annotation markers on the progress bar (`VideoPlayer.tsx:655-690`) and
  `openAnnotation` — click-to-edit stays exactly as it is.
- Export/ffmpeg paths — replay is a live-playback visual only; burned-in
  export overlays already work.
- Database/IPC — no changes needed.

## Git workflow

- App repo: branch `feat/telestration-replay` off `main`. Conventional commits.
- Do NOT push or open a PR unless the operator instructed it.
- Do not mention AI tools in commit messages and do not add AI co-author lines.

## Design decisions (already made — implement as stated)

- An annotation is "active" when
  `annotation.timestamp <= currentTime && currentTime < annotation.timestamp + REPLAY_DISPLAY_SECONDS`
  with `const REPLAY_DISPLAY_SECONDS = 4;` (module const in the new component).
  If several match, draw all of them (rare; harmless).
- Replay is ON by default, persisted per user
  (`STORAGE_KEYS.ANNOTATION_REPLAY = "annotationReplay"`).
- Replay canvas is `pointer-events: none` (inline style is fine), `aria-hidden`,
  absolutely positioned over the video content rect, and hidden whenever
  `drawMode` is true (edit mode wins) or `videoError` is set.
- Parsing `annotation.data` happens once per annotation (memoize on
  `savedAnnotations`), not on every timeupdate.

## Steps

### Step 1: STORAGE_KEYS entry

Add `ANNOTATION_REPLAY: "annotationReplay",` to `STORAGE_KEYS` in
`utils/storage.ts`.

**Verify**: `cd app && npm run build` → exit 0.

### Step 2: AnnotationReplayLayer component

Create `src/renderer/components/AnnotationReplayLayer.tsx`:

- Props:
  ```ts
  interface AnnotationReplayLayerProps {
    videoRef: React.RefObject<HTMLVideoElement>;
    containerRef: React.RefObject<HTMLDivElement>;
    annotations: Annotation[];
    currentTime: number;
    enabled: boolean;
  }
  ```
  (Import `Annotation` from wherever VideoPlayer imports it — check its
  imports; likely `../../types/global`.)
- Memoize parsed shapes:
  `useMemo(() => annotations.map(a => ({ timestamp: a.timestamp, shapes: safeParse(a.data) })), [annotations])`
  where `safeParse` returns `[]` on JSON errors (never throw).
- Compute active shape lists by the timestamp window rule; if none, or
  `!enabled`, render `null` (no canvas in the DOM at all — cheapest possible
  idle path).
- When active: render one `<canvas>` positioned/sized to
  `getVideoContentRect(...)` × devicePixelRatio and draw with
  `renderShapes(ctx, activeShapes, w, h)`. Copy the sizing + ResizeObserver
  pattern from TelestrationLayer's redraw effect (read it first — reproduce
  the approach, not necessarily the code). Clear the canvas before each draw.
- Redraw effect deps: the active shape lists + the measured rect. Do NOT
  redraw on every `currentTime` tick when the active set is unchanged —
  derive the active set first (e.g. a `useMemo` keyed on
  `[parsed, currentTime]` returning a stable reference when membership is
  unchanged, or compare joined annotation ids).

**Verify**: `cd app && npm run build` → exit 0.

### Step 3: mount in VideoPlayer

In `VideoPlayer.tsx`:

1. State: `const [replayEnabled, setReplayEnabled] = useState(() => loadPref(STORAGE_KEYS.ANNOTATION_REPLAY, true));`
   (import `loadPref`/`savePref`/`STORAGE_KEYS` — check current imports).
   Toggle handler flips state and `savePref`s.
2. Mount between the `</video>`-bearing conditional and `<TelestrationLayer …>`
   (i.e., immediately before line ~591):
   ```tsx
   <AnnotationReplayLayer
     videoRef={videoRef}
     containerRef={containerRef}
     annotations={savedAnnotations}
     currentTime={currentTime}
     enabled={replayEnabled && !drawMode && !videoError}
   />
   ```
3. Toggle button next to the pen button (`:893-904`), same classes/pattern:
   `title`/`aria-label` = `t("app.telestration.replayToggle")`,
   `aria-pressed={replayEnabled}`, active class `drawButtonActive` when
   enabled, icon `faClapperboard` (from free-solid; fallback `faEye` if the
   installed FontAwesome version lacks it).

**Verify**: `cd app && npm run build` → exit 0.

### Step 4: i18n (all 11 locales)

Under `app.telestration`:
- `"replayToggle"` — en: `"Show saved drawings during playback"`,
  pt: `"Mostrar desenhos guardados durante a reprodução"`.
Translate into the other 9 locales matching each file's tone.

**Verify**: parity script from plan 001 Step 7 → new key in all 11 files.

### Step 5: manual verification

`npm run dev`, in a project with saved annotations:

1. Play through an annotation's timestamp → drawing appears for ~4s, then
   clears. Video keeps playing smoothly.
2. Clicks pass through the drawing to the video (click toggles play/pause).
3. Toggle off → nothing appears; relaunch app → toggle state remembered.
4. Enter draw mode while a replay is showing → replay hides, editor works.
5. Click a green marker → old click-to-edit behavior unchanged (pauses, seeks,
   opens editor with shapes loaded).
6. Resize the window during a replay → drawing stays aligned with the video
   content (letterbox math correct).
7. Seek backwards across an annotation → it re-appears in its window.

## Test plan

No test framework in the repo. The manual pass in Step 5 is the gate — report
each item's result. If you can only build but not run, say so explicitly and
mark items 1–7 unverified.

## Done criteria

- [ ] `cd app && npm run build` exits 0
- [ ] `src/renderer/components/AnnotationReplayLayer.tsx` exists;
      `grep -n "pointer-events\|pointerEvents" …/AnnotationReplayLayer.tsx` ≥ 1
- [ ] Toggle button present with `aria-pressed` and i18n label
- [ ] `grep -c "ANNOTATION_REPLAY" src/renderer/utils/storage.ts` → 1
- [ ] i18n key in all 11 locales
- [ ] Step 5 manual pass performed (or explicitly reported as not run)
- [ ] No files outside the in-scope list are modified (`git status`)
- [ ] `plans/README.md` status row updated

## STOP conditions

Stop and report back if:

- `renderShapes` / `getVideoContentRect` signatures differ from what
  TelestrationLayer's usage implies (read that usage first).
- The video area markup (`:566-601`) no longer matches the excerpt.
- Playback visibly stutters with the layer active — report rather than
  micro-optimizing beyond the memoization already specified.
- You feel the need to modify `TelestrationLayer.tsx` or `telestration.ts`.

## Maintenance notes

- `REPLAY_DISPLAY_SECONDS = 4` is a guess at a good default; if users want
  per-annotation durations, that's a schema change (annotations.duration) —
  out of scope here, note it as the follow-up.
- Plan 003's comparison pages mention telestration; once this lands, "drawings
  replay during playback" is a claimable feature there.
- PresentMode plays exported clip files (drawings burned in via ffmpeg), so it
  does not need this layer.
