# Changelog

All notable changes to Basketball Video Analyzer will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.17.0] - 2026-11-28

### Added

- Videos the player can't open now get an MP4 copy that plays. This covers camera files (.mts, .m2ts), .ts, AVI, WMV, FLV, MPEG (.mpg, .vob) and ProRes, which played black before. The app asks first, saves the copy where you choose (next to the original by default) and never changes the original. When only the file type is wrong, as with most camera files, the copy takes a few minutes for a full game. Other formats are re-encoded to H.264 at up to 1080p, which can take about as long as the game.
- If a game in a project still won't play, the error screen has a **Make a playable copy** button. It makes the copy and switches the project to it.
- The open dialog lists the new formats.

### Changed

- The video format error no longer suggests AVI, since the player can't open it.

## [1.16.0] - 2026-11-28

### Fixed

- The app no longer crashes at random with "A JavaScript error occurred in the main process: Array buffer allocation failed". While a video sat paused, the app kept reading the whole game file into memory, which ran an 8 GB laptop out of memory. Memory now stays under 100 MB.
- Exporting a parent category exports its subcategories' clips too. Before, a parent whose clips were all in subcategories exported nothing.
- Sorting clips by title: "Descending" now sorts Z to A. If you had title sorting saved, it flips once.
- In Slovenian, Serbian and Lithuanian, counts such as "3 clips" no longer show in Portuguese.

### Added

- **Share project**, in the clip library header, makes a folder you can send to another coach by USB stick, Google Drive, Dropbox or any other way. It holds the project, every cut clip and, if you tick the box, the game videos.
- **Open shared project**, in the project selector, opens that folder as a new project. It finds game videos you already have, so they aren't copied twice, and asks whether to copy the rest into the app or use them where they are. The same button opens old session files (`.json`).
- When a project you shared comes back with changes, you see what's new, changed or deleted before anything is applied. If you both edited the same thing, you pick which version to keep. Deletions come unchecked.
- Deleting a project removes the game videos the app copied for it.

### Changed

- The Import project button is gone. Open shared project does what it did.
- Reload, Force Reload and Developer Tools are no longer in the View menu.
- The clip export section is called "Export clips".
- The bottom clip list keeps words whole, its header stays put, and the selected clip is easy to see.
- The court map legend counts a parent category's whole family.
- The clip creator keeps the court picker and its Clear location button in view.

## [1.15.0] - 2026-11-26

### Added

- Click a dot on the court map and its clip plays right there in Stats, on a loop, at full or half speed. Previous and next step through the other clips of that category, and "Open in main video" jumps the film to it.
- Layout presets in the header. Tag gives the clip library room, Study gives the bottom clip list room, and Scout gives the video room. A preset shows a dot once you resize a panel by hand, and clicking it again puts its sizes back.
- The bottom clip list has a width control, Narrow, Wide or Full, and shows whole titles and notes.
- Edit a clip's title and notes straight on its card, as in the table. Shift+Enter starts a new line in notes.

### Changed

- The clip library's filters sit behind one Filter button, next to search and sort, with a removable chip for each active filter. The clips now start right under the search box.
- The Stats "Shot chart" tab is now "Court map", since it shows any clip with a spot on the court.
- Opening Stats pauses the main video.

### Fixed

- Edits in the clip library now show in the bottom list and Stats without a reload.
- Picking a parent category in the bottom list or on the court map includes its subcategories' clips.
- A selected subcategory no longer shows as "Unknown", and filters reset when you switch project.
- Clicking a clip in the bottom list no longer throws an error, and Space then plays the video.
- Esc in Stats no longer clears your in and out marks.
- Every click on the side panel's drag handle no longer narrows it by a pixel.
- Multi-line notes keep their lines in the table.

## [1.14.1] - 2026-11-25

### Fixed

- A project whose last-watched game had moved would not open if you cancelled the "locate video" prompt. It now opens another game that is still on disk.
- Relinking a game to a file the project already has explains why it failed.
- Deleting a project clears its saved playback positions.
- The game picker and the rename form show the keyboard focus outline.

### Changed

- Importing a session checks every clip, category and player before asking for videos, and rejects files with more than 100 recordings.

## [1.14.0] - 2026-11-25

### Added

- Scout several games in one project with a shared roster and categories. Switch recordings, jump from a clip to its source, and filter stats and scouting PDFs by game.
- Find the last-opened project, rename saved projects, and resume playback where you stopped.
- Open the app licence and third-party notices from the packaged app.

### Changed

- Session exports track which recording each clip and drawing belongs to. Older single-video sessions still open.
- Release builds include a redistributable FFmpeg and publish its corresponding source. macOS installers are stapled before publication.

## [1.13.0](https://github.com/kauredo/basketball-video-analyzer/releases/tag/v1.13.0) - 2026-11-09

- Let several projects share one video file. [#55](https://github.com/kauredo/basketball-video-analyzer/pull/55)

## [1.12.0](https://github.com/kauredo/basketball-video-analyzer/releases/tag/v1.12.0) - 2026-10-09

- Run the unit tests on every push and pull request. [#50](https://github.com/kauredo/basketball-video-analyzer/pull/50)
- Refresh the timeline after deleting clips in the side panel. [#51](https://github.com/kauredo/basketball-video-analyzer/pull/51)
- Keep clip files in step with saved drawings. [#52](https://github.com/kauredo/basketball-video-analyzer/pull/52)
- Minimize the drawing toolbar. [#53](https://github.com/kauredo/basketball-video-analyzer/pull/53)

## [1.11.1](https://github.com/kauredo/basketball-video-analyzer/releases/tag/v1.11.1) - 2026-10-08

- Bundle deno for yt-dlp and only pass real YouTube links. [#49](https://github.com/kauredo/basketball-video-analyzer/pull/49)

## [1.11.0](https://github.com/kauredo/basketball-video-analyzer/releases/tag/v1.11.0) - 2026-10-08

- Make YouTube import work without Python or ffmpeg installed. [#44](https://github.com/kauredo/basketball-video-analyzer/pull/44)
- Clear the sketch and resume play in one step. [#45](https://github.com/kauredo/basketball-video-analyzer/pull/45)
- Let coaches drag the drawing toolbar out of the way. [#46](https://github.com/kauredo/basketball-video-analyzer/pull/46)
- Burn saved drawings into exported clips, freezes included. [#47](https://github.com/kauredo/basketball-video-analyzer/pull/47)

## [1.10.0](https://github.com/kauredo/basketball-video-analyzer/releases/tag/v1.10.0) - 2026-10-08

- Let coaches choose how long saved drawings replay. [#41](https://github.com/kauredo/basketball-video-analyzer/pull/41)
- Let each saved drawing set its own replay time. [#42](https://github.com/kauredo/basketball-video-analyzer/pull/42)
- Let a saved drawing pause the video while it shows. [#43](https://github.com/kauredo/basketball-video-analyzer/pull/43)

## [1.9.2](https://github.com/kauredo/basketball-video-analyzer/releases/tag/v1.9.2) - 2026-09-17

- Bring the README back in line with the app. [#39](https://github.com/kauredo/basketball-video-analyzer/pull/39)
- Fix clip cutting on Macs without Rosetta, and parent category filters. [#40](https://github.com/kauredo/basketball-video-analyzer/pull/40)

## [1.9.1](https://github.com/kauredo/basketball-video-analyzer/releases/tag/v1.9.1) - 2026-09-09

- Carry the clip status into the exports. [#37](https://github.com/kauredo/basketball-video-analyzer/pull/37)
- Stop build.yml and release.yml from disagreeing. [#38](https://github.com/kauredo/basketball-video-analyzer/pull/38)

## [1.9.0](https://github.com/kauredo/basketball-video-analyzer/releases/tag/v1.9.0) - 2026-09-09

- Lint the locales, since no native speaker ever will. [#35](https://github.com/kauredo/basketball-video-analyzer/pull/35)
- Edit clips after the cut, in a table view. [#36](https://github.com/kauredo/basketball-video-analyzer/pull/36)

## [1.8.2](https://github.com/kauredo/basketball-video-analyzer/releases/tag/v1.8.2) - 2026-09-08

- Show the user the cause the console already had. [#34](https://github.com/kauredo/basketball-video-analyzer/pull/34)

## [1.8.1](https://github.com/kauredo/basketball-video-analyzer/releases/tag/v1.8.1) - 2026-09-08

- Fixed the small Windows icon frames and updated the app colours and translations.

## [1.8.0](https://github.com/kauredo/basketball-video-analyzer/releases/tag/v1.8.0) - 2026-09-08

- Updated the interface with the Scorebook design, a new app mark and clearer playback controls.
- Fixed fullscreen in Present mode and connected app releases to the website rebuild.

## [1.7.2] - 2026-07-13

### Fixed

- **Windows and macOS auto-updates now work.** The app used electron-updater, which is incompatible with how it's packaged (Squirrel), so update checks failed outright on Windows and silently on macOS. It now uses update-electron-app (via update.electronjs.org), which matches the actual builds. This fix only takes effect once you're on 1.7.2 — please update to 1.7.2 manually one last time, and future updates will install on their own. (Linux still updates by manual download.)
- **New users can now reach the Select Project panel.** It only opened when projects already existed, so a first-time user landed on an empty screen with no way to create a project, import from YouTube, or load a saved session. It now opens on startup for everyone, and a new "Select Project" button in the header opens it at any time.

## [1.7.1] - 2026-07-13

### Fixed

- The app no longer starts to a blank window when its database fails to load. Previously a database failure looked identical to "no projects yet" — the Select Project panel silently never appeared. The app now shows a clear error and keeps the Select Project panel reachable, and the underlying error is written to the log file.

## [1.7.0] - 2026-07-10

### Added

- **Shot chart** — mark where each shot was taken on the court and see it plotted in the stats dashboard.
- **First-run onboarding** — inline hints, actionable empty states, and a guide you can reopen any time.
- **Donation surfaces** — support the project from the About screen, with a one-time nudge.

## [1.6.0] - 2026-06-09

### Added

- **Telestration** — draw arrows, lines, shapes, freehand, and text labels over a paused frame. Save an annotated still, pin a drawing to a moment on the timeline, or burn it into an exported clip. Drag labels to reposition them.
- **Present mode** — filter clips and play them back to back in fullscreen.
- **Player tagging** — add a roster, tag who's in each clip, and filter by player.
- **Stats dashboard** — clip breakdowns by category and by quarter.
- **9 new languages** — Spanish, French, German, Italian, Slovenian, Serbian, Lithuanian, Turkish, and Greek (11 total, alongside English and Portuguese).

### Changed

- Local media (source video, clips, thumbnails) is now served through a validated `clip-media://` protocol with `webSecurity` enabled, replacing the insecure `webSecurity: false`.

### Fixed

- Timeline seeking no longer snaps back to the start of the video.
- The timeline panel scrolls vertically, and subcategory rows are tidier in the clips list.

## [1.5.6] - 2026-05-20

### Changed

- **macOS builds are now code-signed and notarized.** No more Gatekeeper "unidentified developer" warning on first launch.
- **Bundle identifier changed** from `com.yourname.basketball-video-analyzer` to `com.kauredo.basketballvideoanalyzer`. macOS treats the new signed app as a separate identity from previous installs — auto-update will not replace the existing 1.5.2 app in place. **If you're upgrading from 1.5.2 or earlier on macOS, please re-download from the Releases page**; your projects, clips, and settings will carry over.

## [1.5.2] - 2026-04-29

### Fixed

- **Auto-update visibility**: the "Update Available" dialog now triggers an immediate header progress strip ("Preparing update download…" → "Downloading update… NN%"), so it is clear the download is actually happening rather than silently stalling.
- **Update completion feedback**: a success toast appears alongside the "Update Ready to Install" dialog when the download finishes, so the confirmation persists even if the modal is dismissed.
- **Update failure feedback**: download failures (network drop, partial transfer) now surface as an error toast instead of being silent. Background/periodic check failures stay silent (log only) to avoid noise.
- Auto-updater errors now serialize cleanly across IPC (previously the `message` field could be lost in transit between main and renderer).

## [1.5.1] - 2026-04-28

### Fixed

- **Old projects with missing video files**: opening a project whose source video is no longer at its stored path now shows a "Locate video" dialog instead of a generic playback error. Project cards display a "Video missing" badge so coaches can spot affected projects at a glance.
- **Clips left behind by historical clips-directory migrations**: on startup, the app now re-resolves clip and thumbnail paths from older locations (`Documents/Basketball Clip Cutter/clips/` and `Documents/Basketball Video Analyzer/clips/`) so previously-broken clips play again without manual intervention.

## [1.4.0] - 2026-03-16

### Added

- **Quick Tag with Keyboard**: Press 1-9 to instantly create a clip tagged with the corresponding category (when mark in/out are set)
- **Quarter Selector**: Select the current quarter (Q1-Q4/OT) in the clip creator for structured clip naming
- **Video-Time Clip Naming**: Clips now use video playback time instead of wall clock time (e.g., `Q1_03:21_Pick_Roll`)
- **Save/Load Analysis Sessions**: Export full project state (categories, clips, metadata) as JSON and reload on any machine
- **YouTube Video Import**: Paste a YouTube URL to download and analyze game footage directly (bundled via youtube-dl-exec, no extra install needed)
- **Import Session** button in project selector for loading saved session files

---

## [1.0.0] - 2024-01-XX

### Added

- **Initial Release** 🎉
- **Time Search Feature**: Jump to specific times using HH:MM:SS format (e.g., 1:23:45, 12:30, 150 seconds)
- **Multiple Preset System**: Create and manage multiple category templates for different scenarios
- **Project-Based Organization**: Separate projects for different games, opponents, or analysis types
- **Hierarchical Category System**: Parent-child categories with unlimited depth
- **Advanced Video Cutting**: Mark in/out points with keyboard shortcuts and frame-by-frame navigation
- **Export System**: Export organized clip libraries by category with folder structure
- **Multi-Language Support**: English and Portuguese translations
- **Cross-Platform Support**: Windows, macOS, and Linux distributions

### Features

- **Video Formats**: Support for MP4, MOV, AVI, MKV, WebM input formats
- **Keyboard Shortcuts**: Comprehensive shortcuts for efficient video navigation
- **Real-time Video Processing**: Uses FFmpeg for actual video file creation
- **Project Isolation**: Each project maintains its own categories and clips
- **Visual Organization**: Color-coded categories with clear hierarchies
- **Batch Export**: Export multiple clips while maintaining folder structure
- **Auto-Save**: Automatic saving of work progress
- **Error Handling**: Robust error handling with user-friendly messages

### Technical

- **Built with**: Electron, React, TypeScript, SQLite
- **Video Processing**: FFmpeg integration for clip creation
- **Database**: SQLite with better-sqlite3 for high performance
- **UI Framework**: React with modern component architecture
- **Internationalization**: i18next for multi-language support

### System Requirements

- **Minimum**: Windows 10/macOS 10.15/Ubuntu 18.04+, 4GB RAM, Intel i5/AMD equivalent
- **Recommended**: 8GB+ RAM, Intel i7/AMD Ryzen 7+, SSD storage
- **Video**: Support for modern graphics cards for smooth video playback

---

## Support

For questions about releases or to report issues:

- **GitHub Issues**: https://github.com/kauredo/basketball-video-analyzer/issues
- **Email**: contact@basketballvideoanalyzer.com
