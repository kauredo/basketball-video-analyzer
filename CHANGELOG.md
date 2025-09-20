# Changelog

All notable changes to Basketball Video Analyzer will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

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
