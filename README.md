# 🏀 Basketball Video Analyzer

**Professional video analysis tool for basketball coaches and teams**

![Version](https://img.shields.io/github/v/release/kauredo/basketball-video-analyzer)
![Platform](https://img.shields.io/badge/platform-Windows%20%7C%20macOS%20%7C%20Linux-lightgrey.svg)
![License](https://img.shields.io/badge/license-AGPL--3.0--or--later-blue.svg)

A powerful desktop application designed specifically for basketball coaches and analysts to cut, categorize, and organize video clips across multiple projects with reusable preset templates.

**Website & downloads:** [basketballvideoanalyzer.com](https://basketballvideoanalyzer.com) — free basketball video breakdown software for coaches, with guides on film breakdown, scouting, and using it as a free Hudl alternative.

![App Screenshot](screenshot.png)

## 📥 Installation

### 🚀 Quick Install (Recommended)

**Download the latest version for your operating system from the [latest release page](https://github.com/kauredo/basketball-video-analyzer/releases/latest):**

#### macOS

- **[Download BasketballVideoAnalyzer.dmg](https://github.com/kauredo/basketball-video-analyzer/releases/latest/download/BasketballVideoAnalyzer.dmg)** (macOS 11+, Apple Silicon)
- Open the .dmg and drag the app to Applications
- Builds are signed with a Developer ID certificate and notarized by Apple, so it opens with a double-click. No Gatekeeper workaround needed.

#### Windows

- Open the [latest release](https://github.com/kauredo/basketball-video-analyzer/releases/latest) and download `BasketballVideoAnalyzer-X.Y.Z.Setup.exe` from the Assets list
- Run the installer; if SmartScreen blocks it, click **More info** → **Run anyway**. Windows builds are not code-signed, so SmartScreen will warn on every release.
- The app will auto-update when new versions are available

#### Linux

Open the [latest release](https://github.com/kauredo/basketball-video-analyzer/releases/latest) and download the package for your distro from the Assets list, then install:

**Ubuntu / Debian** (`.deb`):

```bash
sudo dpkg -i basketball-video-analyzer_*_amd64.deb
```

**Red Hat / Fedora** (`.rpm`):

```bash
sudo rpm -i basketball-video-analyzer-*.x86_64.rpm
```

### 💻 System Requirements

#### Minimum Requirements

- **OS**: Windows 10, macOS 11 (Apple Silicon), or Ubuntu 18.04+
- **RAM**: 4GB minimum, 8GB recommended
- **Storage**: 2GB free space (plus space for video clips)
- **CPU**: Intel i5 or AMD equivalent
- **GPU**: Any modern graphics card (for video playback)

#### Recommended for Large Videos (4K)

- **RAM**: 16GB
- **CPU**: Intel i7/AMD Ryzen 7 or better
- **Storage**: SSD recommended for video processing

#### Supported Video Formats

- **Input**: MP4, MOV, AVI, MKV, WebM, M4V
- **Output**: MP4 (H.264 for maximum compatibility)

---

## 🎯 What This App Does

This app solves the common problem of **creating organized video libraries for team analysis** across multiple games, opponents, and seasons. Instead of recreating category systems for every video, coaches can:

- ✅ Create project-specific clip libraries with consistent organization
- ✅ Build hierarchical category systems (parent categories with subcategories)
- ✅ Save category structures as reusable presets across projects
- ✅ Cut specific plays and automatically organize them in project folders
- ✅ **Jump to specific times** using HH:MM:SS search (new feature!)
- ✅ Export organized clip libraries to share with teams, players, or staff
- ✅ Maintain consistent video analysis workflows throughout the season

Perfect for building "Opponent Scouting" projects with reusable category presets, or creating "Player Development" libraries that maintain the same organizational structure across multiple sessions.

## ✨ Key Features

### 🎬 Advanced Video Cutting

- **Simple Mark & Cut**: Use `I` and `O` keys to mark in/out points during video playback
- **Time Search**: Jump to specific moments using HH:MM:SS format (e.g., 1:23:45, 12:30, or just 150 seconds)
- **Real Video Files**: Creates actual MP4 clips using FFmpeg (not just timestamps)
- **Precise Control**: Frame-by-frame navigation and comprehensive keyboard shortcuts

### 📁 Project-Based Organization

- **Multiple Projects**: Create separate projects for different games, opponents, or analysis types
- **Project Isolation**: Each project maintains its own categories and clips
- **Project Switching**: Seamlessly switch between projects while preserving all data
- **Organized Storage**: Clips are automatically organized by project in your file system

### 🏷️ Hierarchical Category System

- **Parent-Child Categories**: Create main categories with detailed subcategories (e.g., "Offense" → "Pick & Roll" → "Ball Screen High")
- **Unlimited Depth**: Build category hierarchies as deep as needed for your analysis
- **Multi-tagging**: Each clip can have multiple categories from different hierarchy branches
- **Visual Organization**: Color-coded categories with clear parent-child relationships

### 🎯 Preset Template System

- **Save Category Structures**: Save your complete category hierarchy as reusable presets
- **Multiple Presets**: Create different templates for different scenarios (Opponent Scouting, Player Development, etc.)
- **Load Across Projects**: Apply saved presets to new projects for consistent organization
- **Preset Management**: Save, load, and delete presets with user-friendly confirmation dialogs
- **Template Library**: Build a library of preset templates for different analysis types

### 📚 Enhanced Clip Library

- **Project-Specific Libraries**: Each project maintains its own complete clip collection
- **Visual Browser**: Thumbnail view of all clips with project context
- **Hierarchical Filtering**: Filter by parent categories or drill down to specific subcategories
- **One Filter Button**: Search, Filter, and sort sit on one row. Filter opens Category, Player, and Status; each active filter shows as a chip you can remove, and one line shows how many clips match out of the total
- **Category Statistics**: See clip counts and total duration by category and subcategory
- **Cross-Project Overview**: Easily switch between project libraries

### 📊 Table View and Clip Editing

- **Two Views**: Browse clips as a thumbnail grid or switch to a dense, editable table
- **Inline Editing**: Change title, categories, and notes directly in a table row, or edit title and notes in place on a card. Shift+Enter starts a new line in notes
- **Multi-Select**: Tick rows to delete or re-categorise clips in bulk
- **Clip Status**: Mark a clip keep, cut, or review; the row tints to match and the library filters by it

### 👥 Players, Court, and Stats

- **Player Tagging**: Tag clips with the players involved and filter the library by player
- **Court Positions**: Mark where on the floor a play happened
- **Stats Dashboard**: Clip counts and durations broken down by category, player, and quarter
- **Court Map**: Each located clip is a dot on the court. Click a dot to play that clip inside Stats, looped at 0.5x or 1x, step to the previous or next clip in the same category, or open it in the main video

### 🪟 Workspace Layout

- **Layout Presets**: Tag, Study, and Scout in the header set the panel sizes and clip list width in one click. After you resize by hand the preset shows a dot, and clicking it again restores its sizes
- **List Width**: Set the bottom panel's clip list to Narrow, Wide, or Full; rows show whole titles and notes

### 🎥 Film Sessions

- **Present Mode**: Play a filtered set of clips back to back for a team film session
- **Telestration**: Draw arrows, circles, and freehand over paused video, then replay the annotations
- **YouTube and Vimeo Import**: Pull game footage in from a YouTube or Vimeo link, with a Cancel button while it downloads

### 📤 Flexible Export System

- **Project-Based Export**: Export entire project libraries or selected categories
- **Batch Export**: Export all clips in selected categories while maintaining folder structure
- **Organized Folders**: Creates hierarchical folders by category for intuitive team sharing
- **Data Export**: Export the clip list as CSV or JSON, or as Sportscode-compatible timeline XML for coaches already on that workflow

### 🤝 Share a Project with Another Coach

- **Share project** writes one folder with the project file (`.bvap`), every cut clip and, if you tick the box, the game videos. Send it any way you like: a USB stick, Google Drive, Dropbox.
- **Open shared project** in the project selector reads that folder. It finds videos you already have, so they aren't copied twice, and asks whether to copy the rest into the app or use them where they are.
- When a project you shared comes back with changes, the app shows what's new, changed or deleted before anything is applied. If you both edited the same thing, you pick which version to keep. Deletions come unticked.
- Old session files (`.json`) open through the same button.

### 🌐 Multi-Language Support

- **Eleven Languages**: English, Portuguese, Spanish, French, Italian, German, Greek, Lithuanian, Slovenian, Serbian, and Turkish
- **Dynamic Language Switching**: Change languages without restarting the application
- **Localized Dialogs**: All confirmation dialogs and messages respect language selection

## 🚀 Quick Start Guide

### 1. Create or Select a Project

- Start by creating a new project or selecting an existing one from the project dropdown
- Each project maintains its own categories, clips, and organization
- Projects are perfect for organizing different games, opponents, or analysis types

### 2. Build Your Category System

#### Create Hierarchical Categories:

- Click **"Edit Categories"** to open the category management panel
- Add parent categories like `Offense`, `Defense`, `Special Situations`
- Add subcategories under parents: `Offense` → `Pick & Roll` → `Ball Screen High`
- Create unlimited category depth for detailed organization
- Choose colors for visual identification

#### Use Category Presets:

- **Save Presets**: After building your category structure, save it as a preset template
- **Load Presets**: Apply saved presets to new projects for consistent organization
- **Manage Presets**: Delete outdated presets to keep your template library organized
- **Perfect for**: Creating standardized category systems for scouting reports, player development sessions, or season-long analysis

### 3. Load Your Game Video

- Click **"Select Video"** and choose your basketball game file
- Supports: MP4, MOV, AVI, MKV, WebM, M4V formats
- Video loads within your current project context

### 4. Navigate and Cut Video Clips

#### Quick Time Navigation:

- **Time Search**: Use the time search box to jump to specific moments
  - Type `1:23:45` to jump to 1 hour, 23 minutes, 45 seconds
  - Type `12:30` to jump to 12 minutes, 30 seconds
  - Type `150` to jump to 150 seconds (2:30)
  - Press Enter or click the search button

#### Keyboard Shortcuts:

- **`Space`** - Play/Pause video
- **`Z`** - Mark In point (start of clip)
- **`M`** - Mark Out point (end of clip)
- **`Esc`** - Clear marks
- **`←/→`** - Skip 5 seconds
- **`Alt + ←/→`** - Skip 30 seconds
- **`Ctrl/Cmd + ←/→`** - Skip 1 minute
- **`Shift + ←/→`** - Step one frame

The mark keys are rebindable in Settings. Z and M are the defaults.

#### Using Mouse:

- Click **"Mark In"** and **"Mark Out"** buttons
- Visual indicators show marked regions on video

### 5. Categorize Your Clip

- Select categories from your hierarchical structure (can select from multiple branches)
- Add detailed notes if needed (e.g., "Great defensive rotation - note help timing")
- Enter custom title or use auto-generated name with category context

### 6. Create the Clip

- Click **"Create Clip"**
- App uses FFmpeg to cut actual video file with project organization
- Progress bar shows cutting status
- Clips are automatically saved in project-specific folders

### 7. Manage Your Project Library

- View all clips in the **Clip Library** filtered by current project
- Use the **Filter** button to narrow by category, subcategory, player, or status
- Switch between projects to access different clip libraries
- Review category statistics to understand your analysis coverage

### 8. Export and Share

- Click **"Export"** to create organized folders by category hierarchy
- Maintain folder structure that matches your category organization
- Export specific categories or entire project libraries
- Share organized folders with team via cloud storage, USB, or team platforms
- To hand the whole project to another coach so they can keep working on it, use **Share project** in the clip library instead. They open it with **Open shared project**, and when they send it back you review their changes before applying them.

## 🎯 Typical Workflows

### Opponent Scouting Workflow

1. **Create Project**: "vs Team ABC - 2024 Conference Game"
2. **Load Preset**: Apply your standard "Opponent Scouting" category preset
3. **Video Analysis**: Load opponent game footage and cut relevant plays
4. **Quick Navigation**: Use time search to jump to specific plays (e.g., type `18:30` for a key moment)
5. **Categorize**: Organize clips by "Offense Schemes", "Defensive Sets", "Transition", etc.
6. **Export**: Create organized folders for coaching staff review
7. **Reuse**: Save any new categories back to your scouting preset for future games

### Player Development Workflow

1. **Create Project**: "Player 5 - Post Development Session 3"
2. **Load Preset**: Apply "Player Development" preset with skill-based categories
3. **Session Recording**: Cut clips from practice or game footage
4. **Time Navigation**: Jump to specific drill moments using time search
5. **Hierarchical Organization**: "Post Moves" → "Drop Steps" → "Strong Hand" vs "Weak Hand"
6. **Individual Review**: Export player-specific folders for one-on-one sessions
7. **Progress Tracking**: Compare with previous project libraries to track improvement

## ⌨️ Keyboard Shortcuts

| Key            | Action                     |
| -------------- | -------------------------- |
| `Space`        | Play/Pause video           |
| `Z`            | Mark In (start of clip)    |
| `M`            | Mark Out (end of clip)     |
| `Esc`          | Clear marks                |
| `←`            | Skip backward 5 seconds    |
| `→`            | Skip forward 5 seconds     |
| `Alt + ←`      | Skip backward 30 seconds   |
| `Alt + →`      | Skip forward 30 seconds    |
| `Ctrl/Cmd + ←` | Skip backward 1 minute     |
| `Ctrl/Cmd + →` | Skip forward 1 minute      |
| `Shift + ←`    | Previous frame             |
| `Shift + →`    | Next frame                 |
| `1`-`9`        | Quick tag with category    |
| `Ctrl/Cmd + 1` | Show or hide the side panel |
| `Ctrl/Cmd + 2` | Show or hide the clip list |

`Z` and `M` are defaults. Both can be rebound in Settings, and the in-app
shortcuts dialog always shows your current bindings.

## 📁 File Organization

The app automatically organizes your files with project-based structure:

```
📁 App Data Folder/
├── 📁 clips/                           # All created video clips organized by project
│   ├── 📁 Project_1_vs_Team_ABC/       # Individual project folders
│   │   ├── 🎬 Offense_PickRoll_001.mp4
│   │   ├── 🎬 Defense_Rotation_002.mp4
│   │   └── ...
│   ├── 📁 Project_2_Player_Development/
│   │   ├── 🎬 Player5_PostMoves_001.mp4
│   │   └── ...
│   └── ...
├── 📄 basketball-analyzer.db           # Database with projects, categories, presets, and clip metadata
└── 📁 presets/                         # Saved category preset templates
    ├── 📄 opponent_scouting.json
    ├── 📄 player_development.json
    └── ...
```

## 🚨 Troubleshooting

### Installation Issues

#### Windows

- **"Windows protected your PC"**: Click "More info" → "Run anyway" (app is not yet code-signed)
- **Installation fails**: Run as administrator
- **App won't start**: Install [Visual C++ Redistributable](https://docs.microsoft.com/en-us/cpp/windows/latest-supported-vc-redist)

#### macOS

- **"App can't be opened"**: Releases are notarized, so this should not happen. If it does, check you are on macOS 11+ and re-download the .dmg; a partial download fails the signature check.
- **Permission denied**: Check System Settings → Privacy & Security
- **App crashes**: Ensure macOS 11+ and check Console for errors

#### Linux

- **Package conflicts**: Install with `--force-depends` flag
- **Missing dependencies**: Install `libgtk-3-0`, `libxss1`, `libgconf-2-4`
- **Permission errors**: Run with `sudo` or check file permissions

### Video Issues

- **Video won't load**: Ensure format is supported (MP4, MOV, AVI, MKV, WebM, M4V)
- **Playback stutters**: Close other applications or try lower resolution video
- **Audio issues**: Check system audio settings and volume controls

### Performance Issues

- **Slow clip creation**: Large 4K videos may take longer to process
- **App runs slowly**: Close other resource-heavy applications
- **Out of memory**: Ensure sufficient RAM for video size

### Can't Find Files

- Click **"Open Clips Folder"** to locate created clips
- Default location varies by OS:
  - **Windows**: `%APPDATA%/basketball-video-analyzer/clips/`
  - **macOS**: `~/Library/Application Support/basketball-video-analyzer/clips/`
  - **Linux**: `~/.config/basketball-video-analyzer/clips/`

## 🔄 Updates

The app automatically checks for updates on startup. When a new version is available:

1. You'll see a notification in the app
2. Click "Download Update" to get the latest version
3. The app will restart with new features and bug fixes

## 📞 Support

Having issues? We're here to help:

- **📖 Documentation**: Check this README for common solutions
- **🐛 Bug Reports**: [Create an issue on GitHub](https://github.com/kauredo/basketball-video-analyzer/issues)
- **💡 Feature Requests**: [Suggest new features](https://github.com/kauredo/basketball-video-analyzer/issues)
- **📧 Email Support**: contact@basketballvideoanalyzer.com

## ❤️ Support the Project

Basketball Video Analyzer is free and open source, built and maintained by one
person. If it saves you time on film nights, you can support development:

- **[Buy me a coffee](https://ko-fi.com/kauredo)** — one-off, no account needed
- **Star the repo** — helps other coaches find it
- **[Report bugs and request features](https://github.com/kauredo/basketball-video-analyzer/issues)**

## 🤝 Contributing

We welcome contributions from the basketball and developer communities:

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## 📄 License

Copyright (C) 2026 Vasco Kaufmann. Basketball Video Analyzer is licensed under
the **GNU Affero General Public License v3.0 or later**. In practice that means:

- ✅ Free to use for anything, including commercially. Coaches, clubs, schools, and federations all qualify, at any level.
- ✅ Free to modify and to redistribute.
- ⚠️ If you distribute a modified version, or run one as a network service, you have to release your source under the AGPL as well.

The full terms are in the [LICENSE](LICENSE) file, and they are what governs.
Questions about the licence: contact@basketballvideoanalyzer.com

The app ships FFmpeg, yt-dlp, deno and a set of npm packages, each under its
own licence. Packaged builds carry `LICENSE` and `THIRD-PARTY-NOTICES.txt` in
their resources folder, and **Help > Licenses** opens the notices. The notices
file links to the corresponding FFmpeg and bundled library source archive on the GitHub
release. `npm run notices` writes it to
`out/notices/`.

---

## 🚀 For Developers

### Development Setup

#### Prerequisites

- **Node.js** 20+ and **npm**
- **Git** for cloning the repository

#### Installation

```bash
# Clone the repository
git clone https://github.com/kauredo/basketball-video-analyzer.git
cd basketball-video-analyzer

# Install dependencies
npm install

# Build the FFmpeg binary (requires a C compiler, make, CMake, pkg-config and NASM on x86)
bash scripts/build-ffmpeg.sh

# Start development environment
npm run dev
```

#### Build and Package

```bash
# Build the application
npm run build

# Make installers for this platform
npm run make
```

#### Project Structure

```
src/
├── main/           # Electron main process
├── renderer/       # React frontend
├── types/          # TypeScript definitions
└── i18n/          # Internationalization
```

---

**Built for coaches, by coaches** 🏀

_Making systematic basketball analysis efficient, organized, and repeatable._
