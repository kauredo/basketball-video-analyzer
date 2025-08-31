# 🏀 Basketball Video Analyzer

A desktop application designed specifically for basketball coaches and analysts to cut, categorize, and organize video clips across multiple projects with reusable preset templates.

![App Screenshot](screenshot.png)

## 🎯 Purpose

This app solves the common problem of **creating organized video libraries for team analysis** across multiple games, opponents, and seasons. Instead of recreating category systems for every video, coaches can:

- Create project-specific clip libraries with consistent organization
- Build hierarchical category systems (parent categories with subcategories)
- Save category structures as reusable presets across projects
- Cut specific plays and automatically organize them in project folders
- Export organized clip libraries to share with teams, players, or staff
- Maintain consistent video analysis workflows throughout the season

Perfect for building "Opponent Scouting" projects with reusable category presets, or creating "Player Development" libraries that maintain the same organizational structure across multiple sessions.

## ✨ Key Features

### 🎬 Advanced Video Cutting

- **Simple Mark & Cut**: Use `I` and `O` keys to mark in/out points during video playback
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
- **Load Across Projects**: Apply saved presets to new projects for consistent organization
- **Preset Management**: Save, load, and delete presets with user-friendly confirmation dialogs
- **Subcategory Preservation**: Presets maintain complete hierarchical structures including all subcategories
- **Template Library**: Build a library of preset templates for different analysis types (scouting, player development, etc.)

### 📚 Enhanced Clip Library

- **Project-Specific Libraries**: Each project maintains its own complete clip collection
- **Visual Browser**: Thumbnail view of all clips with project context
- **Hierarchical Filtering**: Filter by parent categories or drill down to specific subcategories
- **Category Statistics**: See clip counts and total duration by category and subcategory
- **Cross-Project Overview**: Easily switch between project libraries

### 📤 Flexible Export System

- **Project-Based Export**: Export entire project libraries or selected categories
- **Batch Export**: Export all clips in selected categories while maintaining folder structure
- **Organized Folders**: Creates hierarchical folders by category for intuitive team sharing
- **Multiple Formats**: Exports to any directory for cloud sharing, USB distribution, or team platforms

### 🌐 Multi-Language Support

- **English and Portuguese**: Full interface translation support
- **Dynamic Language Switching**: Change languages without restarting the application
- **Localized Dialogs**: All confirmation dialogs and messages respect language selection

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
- Supports: MP4, MOV, AVI, MKV, WebM formats
- Video loads within your current project context

### 4. Cut Video Clips

#### Using Keyboard Shortcuts (Recommended):

- **`Space`** - Play/Pause video
- **`I`** - Mark In point (start of clip)
- **`O`** - Mark Out point (end of clip)
- **`C`** - Clear marks
- **`←/→`** - Skip 5 seconds

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
- Use hierarchical filtering to drill down to specific subcategories
- Switch between projects to access different clip libraries
- Review category statistics to understand your analysis coverage

### 8. Export and Share

- Click **"Export"** to create organized folders by category hierarchy
- Maintain folder structure that matches your category organization
- Export specific categories or entire project libraries
- Share organized folders with team via cloud storage, USB, or team platforms

## 🎯 Typical Workflows

### Opponent Scouting Workflow

1. **Create Project**: "vs Team ABC - 2024 Conference Game"
2. **Load Preset**: Apply your standard "Opponent Scouting" category preset
3. **Video Analysis**: Load opponent game footage and cut relevant plays
4. **Categorize**: Organize clips by "Offense Schemes", "Defensive Sets", "Transition", etc.
5. **Export**: Create organized folders for coaching staff review
6. **Reuse**: Save any new categories back to your scouting preset for future games

### Player Development Workflow

1. **Create Project**: "Player 5 - Post Development Session 3"
2. **Load Preset**: Apply "Player Development" preset with skill-based categories
3. **Session Recording**: Cut clips from practice or game footage
4. **Hierarchical Organization**: "Post Moves" → "Drop Steps" → "Strong Hand" vs "Weak Hand"
5. **Individual Review**: Export player-specific folders for one-on-one sessions
6. **Progress Tracking**: Compare with previous project libraries to track improvement

### Team Preparation Workflow

1. **Create Project**: "Season 2024 - Offensive System Implementation"
2. **Custom Categories**: Build detailed hierarchy: "Offensive Sets" → "Horns" → "High Ball Screen" → "Show Coverage"
3. **Multi-Game Analysis**: Cut clips from multiple games showing execution evolution
4. **Save as Preset**: Save category structure as "Offensive System Analysis" for future use
5. **Team Distribution**: Export hierarchical folders for position coaches and individual player review

---

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

The app automatically organizes your files with project-based structure:

```
📁 App Data Folder/
├── 📁 clips/                           # All created video clips organized by project
│   ├── 📁 Project_1_vs_Team_ABC/       # Individual project folders
│   │   ├── 🎬 Offense_PickRoll_001.mp4
│   │   ├── 🎬 Defense_Rotation_002.mp4
│   │   └── ...
│   ├── � Project_2_Player_Development/
│   │   ├── 🎬 Player5_PostMoves_001.mp4
│   │   └── ...
│   └── ...
├── 📄 basketball-analyzer.db           # Database with projects, categories, presets, and clip metadata
└── 📁 presets/                         # Saved category preset templates
    ├── 📄 opponent_scouting.json
    ├── 📄 player_development.json
    └── ...
```

**Export folders** maintain hierarchical structure:

```
📁 Exported Clips/
├── 📁 Offense/                         # Parent category folder
│   ├── 📁 Pick & Roll/                 # Subcategory folder
│   │   ├── 📁 Ball Screen High/        # Sub-subcategory folder
│   │   │   ├── 🎬 clip_001.mp4
│   │   │   └── 🎬 clip_002.mp4
│   │   └── 📁 Ball Screen Low/
│   └── 📁 Post Ups/
├── 📁 Defense/
│   ├── 📁 Help Defense/
│   └── 📁 Transition Defense/
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
- **React + TypeScript** - User interface with hierarchical component architecture
- **FFmpeg** - Video processing and clip creation
- **SQLite** - Local database for projects, hierarchical categories, presets, and clip metadata
- **better-sqlite3** - High-performance synchronous SQLite bindings
- **i18next** - Internationalization framework with dynamic language switching

### Database Architecture:

- **Project Isolation**: Each project maintains separate category and clip collections
- **Hierarchical Categories**: Parent-child relationships with unlimited nesting depth
- **Constraint Management**: UNIQUE constraints per project prevent category conflicts
- **Preset Storage**: Category structures serialized and saved as reusable templates
- **Migration System**: Automatic database schema updates for new features

### Performance:

- Clips are processed locally (no cloud uploads)
- Original video files remain untouched
- Fast clip creation (typically 10-30 seconds per clip)
- Efficient project switching with lazy loading
- Hierarchical category queries optimized for deep structures

### File Formats:

- **Input**: MP4, MOV, AVI, MKV, WebM
- **Output**: MP4 (H.264 codec for maximum compatibility)
- **Presets**: JSON format for cross-platform compatibility

## 🚨 Troubleshooting

### Video Won't Load

- **Check format**: Ensure video is MP4, MOV, AVI, MKV, or WebM
- **File path**: Avoid special characters in filename/path
- **Codec**: Some unusual codecs may not be supported

### Project and Category Issues

- **Missing categories**: Ensure you're in the correct project - categories are project-specific
- **Preset loading fails**: Check that preset files haven't been corrupted or manually edited
- **Database errors**: App automatically handles migrations - restart if issues persist

### Clip Creation Fails

- **Disk space**: Ensure enough free space for output clips
- **Permissions**: Check write permissions to app data folder
- **FFmpeg**: App includes FFmpeg automatically, no manual install needed
- **Project folders**: App automatically creates project-specific clip directories

### Performance Issues

- **Large videos**: 4K+ videos may process slowly
- **Old hardware**: Consider lower resolution videos for better performance
- **Multiple clips**: Process clips one at a time for best results
- **Large projects**: Consider archiving old projects to maintain performance

### Can't Find Clips

- Click **"Open Folder"** to see where clips are stored
- Check app data folder: `~/AppData/basketball-clip-cutter/clips/` (Windows)

## 🎬 Advanced Use Cases

### 🏆 Comprehensive Team Scouting

_"I need a complete opponent analysis system that I can reuse for every game"_

- Create "vs [Opponent Name]" projects with standardized scouting categories
- Use preset templates: "Offensive Sets", "Defensive Schemes", "Special Situations", "Personnel Packages"
- Build detailed subcategories: "Offense" → "Pick & Roll" → "Coverage vs Show" → "Player Reactions"
- Export hierarchical folders that match your coaching staff's analysis workflow
- Save time by loading your "Opponent Scouting" preset for every new opponent project

### 🎯 Systematic Player Development

_"Track individual player progress across multiple sessions with consistent organization"_

- Create player-specific projects: "Player 5 - Post Development Series"
- Load "Player Development" preset with skill-based hierarchical categories
- Track progress: "Post Moves" → "Drop Steps" → "Footwork" → "Strong Hand vs Weak Hand"
- Compare clips across multiple development sessions within the same project
- Export individualized folders for one-on-one player review sessions

### 📊 Advanced Season Analysis

_"Build a comprehensive database of our team's execution across an entire season"_

- Create season-long projects: "2024 Season - Offensive System Evolution"
- Use consistent category presets to maintain organizational standards
- Track improvement: Compare early season vs late season execution of same concepts
- Build searchable libraries: Find all "Transition Defense" clips from conference games
- Export compilation videos showing team growth and areas needing attention

### 🎓 Comprehensive Teaching Library

_"Create reusable instructional content with consistent organization"_

- Build "Teaching Concepts" projects with preset category structures
- Develop hierarchical organization: "Fundamentals" → "Shooting" → "Form" → "Follow Through"
- Save teaching presets: "Youth Fundamentals", "Advanced Concepts", "Position Specific"
- Export organized instructional folders that can be reused with different teams
- Maintain consistency in teaching approaches across multiple seasons

### 🔄 Cross-Season Consistency

_"Maintain the same organizational system across multiple years"_

- Save category structures as reusable presets once, apply everywhere
- Create standardized workflows: Same categories for every opponent, every player development session
- Build institutional knowledge: New coaches can load existing preset templates
- Maintain continuity: Transfer successful organizational systems between seasons

## 🤝 Contributing

This is a specialized tool for basketball analysis. To suggest improvements:

1. **File issues** for bugs or feature requests
2. **Document workflows** that could be improved
3. **Share use cases** that aren't currently supported

## 📄 License

MIT License - Feel free to modify for your team's specific needs.

---

**Built for coaches, by coaches** 🏀

_Making systematic basketball analysis efficient, organized, and repeatable._
