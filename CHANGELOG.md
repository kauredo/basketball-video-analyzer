# Changelog

All notable changes to Basketball Video Analyzer will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.5.3] - 2026-05-19

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
