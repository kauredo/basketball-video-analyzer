# 🏀 Basketball Clip Cutter

A desktop application designed specifically for basketball coaches and analysts to cut, categorize, and share video clips for team scouting and analysis.

![App Screenshot](screenshot.png)

## 🎯 Purpose

This app solves the common problem of **creating shareable video clips for team scouting**. Instead of sending entire game videos, coaches can:

- Cut specific plays (rebounds, screens, defensive actions, etc.)
- Categorize clips by player, play type, or situation
- Export organized folders of clips to share with the team
- Build a searchable library of plays for analysis

Perfect for sharing "all Player #9 screens" or "defensive rebounds in the 4th quarter" with your team.

## ✨ Key Features

### 🎬 Video Cutting

- **Simple Mark & Cut**: Use `I` and `O` keys to mark in/out points during video playback
- **Real Video Files**: Creates actual MP4 clips using FFmpeg (not just timestamps)
- **Precise Control**: Frame-by-frame navigation and keyboard shortcuts

### 🏷️ Smart Categorization

- **Custom Categories**: Create your own categories (Rebounds, Screens, Player actions, etc.)
- **Multi-tagging**: Each clip can have multiple categories (e.g., "Offense" + "Player 5" + "Screen")
- **Visual Organization**: Color-coded categories for easy identification

### 📚 Clip Library

- **Visual Browser**: Thumbnail view of all your clips
- **Smart Filtering**: Filter by category to find specific plays
- **Quick Stats**: See clip counts and total duration by category

### 📤 Team Sharing

- **Batch Export**: Export all clips in selected categories
- **Organized Folders**: Creates folders by category for easy team sharing
- **Multiple Formats**: Exports to any directory for cloud sharing or USB distribution

## 🚀 Getting Started

### Prerequisites

- **Node.js** (version 16 or higher)
- **npm** (comes with Node.js)
- **Git** (for cloning)

### Installation

1. **Run the setup script:**

   ```bash
   chmod +x setup.sh
   ./setup.sh
   ```

2. **Copy file contents** from the provided artifacts into the created files:

   - Copy all TypeScript, HTML, CSS, and component files
   - Each file content is provided in the artifacts

3. **Build and run:**
   ```bash
   npm run build
   npm start
   ```

### Manual Setup (Alternative)

```bash
# Clone or create project directory
mkdir basketball-clip-cutter && cd basketball-clip-cutter

# Copy all provided files into the correct directories
# (package.json, tsconfig.json, src/ files, etc.)

# Install dependencies
npm install

# Build and run
npm run build
npm start
```

## 📖 How to Use

### 1. Load Your Game Video

- Click **"Select Video"** and choose your basketball game file
- Supports: MP4, MOV, AVI, MKV, WebM formats

### 2. Create Custom Categories

- Click **"Edit"** in the Categories panel
- Add categories like:
  - `Rebounds`, `Screens`, `Fast Breaks`
  - `Player 1`, `Player 2`, etc.
  - `Defensive Plays`, `Turnovers`
- Choose colors for visual organization

### 3. Cut Video Clips

#### Using Keyboard Shortcuts (Recommended):

- **`Space`** - Play/Pause video
- **`I`** - Mark In point (start of clip)
- **`O`** - Mark Out point (end of clip)
- **`C`** - Clear marks
- **`←/→`** - Skip 5 seconds

#### Using Mouse:

- Click **"Mark In"** and **"Mark Out"** buttons
- Visual indicators show marked regions on video

### 4. Categorize Your Clip

- Select one or multiple categories for each clip
- Add notes if needed (e.g., "Great defensive rotation")
- Enter custom title or use auto-generated name

### 5. Create the Clip

- Click **"Create Clip"**
- App uses FFmpeg to cut actual video file
- Progress bar shows cutting status

### 6. Organize & Share

- View all clips in the **Clip Library**
- Filter by category to find specific plays
- Click **"Export"** to create folders by category
- Share folders with team via cloud storage or USB

## 🎯 Typical Workflow

### For Game Analysis:

1. **Load game video**
2. **Create categories**: `Good Screens`, `Defensive Breakdowns`, `Player X Highlights`
3. **Watch video** and mark interesting plays with `I`/`O` keys
4. **Tag each clip** with relevant categories
5. **Export by category** and share with team

### For Player Development:

1. **Create player-specific categories**: `Player 1 Offense`, `Player 1 Defense`
2. **Cut clips** showing player's actions
3. **Add notes** about what to improve
4. **Export player folder** for individual review

### For Opponent Scouting:

1. **Create opponent categories**: `Their Offense`, `Their Weak Side`, `Their Screens`
2. **Cut opponent plays** during film study
3. **Export for team** to study before games

## ⌨️ Keyboard Shortcuts

| Key     | Action                  |
| ------- | ----------------------- |
| `Space` | Play/Pause video        |
| `I`     | Mark In (start of clip) |
| `O`     | Mark Out (end of clip)  |
| `C`     | Clear marks             |
| `←`     | Skip backward 5 seconds |
| `→`     | Skip forward 5 seconds  |

## 📁 File Organization

The app automatically organizes your files:

```
📁 App Data Folder/
├── 📁 clips/                    # All created video clips
│   ├── 🎬 Rebound_Game1_001.mp4
│   ├── 🎬 Screen_Game1_002.mp4
│   └── ...
└── 📄 clip-cutter.db           # Clip metadata and categories
```

**Export folders** (when sharing):

```
📁 Exported Clips/
├── 📁 Rebounds/
│   ├── 🎬 Rebound_Game1_001.mp4
│   └── 🎬 Rebound_Game2_003.mp4
├── 📁 Screens/
│   ├── 🎬 Screen_Game1_002.mp4
│   └── 🎬 Screen_Game2_004.mp4
└── 📁 Player 5/
    ├── 🎬 Player5_Offense_001.mp4
    └── 🎬 Player5_Defense_002.mp4
```

## 🔧 Technical Details

### Built With:

- **Electron** - Desktop app framework
- **React + TypeScript** - User interface
- **FFmpeg** - Video processing
- **SQLite** - Local database for clip metadata

### Performance:

- Clips are processed locally (no cloud uploads)
- Original video files remain untouched
- Fast clip creation (typically 10-30 seconds per clip)

### File Formats:

- **Input**: MP4, MOV, AVI, MKV, WebM
- **Output**: MP4 (H.264 codec for maximum compatibility)

## 🚨 Troubleshooting

### Video Won't Load

- **Check format**: Ensure video is MP4, MOV, AVI, MKV, or WebM
- **File path**: Avoid special characters in filename/path
- **Codec**: Some unusual codecs may not be supported

### Clip Creation Fails

- **Disk space**: Ensure enough free space for output clips
- **Permissions**: Check write permissions to app data folder
- **FFmpeg**: App includes FFmpeg automatically, no manual install needed

### Performance Issues

- **Large videos**: 4K+ videos may process slowly
- **Old hardware**: Consider lower resolution videos for better performance
- **Multiple clips**: Process clips one at a time for best results

### Can't Find Clips

- Click **"Open Folder"** to see where clips are stored
- Check app data folder: `~/AppData/basketball-clip-cutter/clips/` (Windows)

## 🎬 Use Cases

### 🏆 Team Scouting

_"Send me all the opponent's screen plays"_

- Cut opponent clips during film study
- Categorize by play type and personnel
- Export and share with team before game

### 🎯 Player Development

_"Here are all your defensive plays from last game"_

- Create player-specific categories
- Cut clips showing successes and areas for improvement
- Share individual folders with players

### 📊 Season Analysis

_"Let's review our rebounding throughout the season"_

- Build clip library across multiple games
- Filter by category to see trends
- Create season highlight reels

### 🎓 Teaching Tool

_"Here's how we want to run this screen"_

- Cut example plays showing proper execution
- Categorize by fundamental skill
- Share with younger players or new team members

## 🤝 Contributing

This is a specialized tool for basketball analysis. To suggest improvements:

1. **File issues** for bugs or feature requests
2. **Document workflows** that could be improved
3. **Share use cases** that aren't currently supported

## 📄 License

MIT License - Feel free to modify for your team's specific needs.

---

**Built for coaches, by coaches** 🏀

_Making team film study efficient and effective._
