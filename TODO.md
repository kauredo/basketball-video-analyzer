# 🎯 Basketball Video Analyzer - Production TODO

## 📕 Summary

### 🚨 **Priority 1: Essential for Public Release**

#### 📸 Screenshots & Visual Assets

- [ ] Main interface screenshot for README
- [ ] Category management demo screenshot
- [ ] Video cutting workflow screenshot
- [ ] Export process screenshot
- [ ] Preset system screenshot

#### 🎨 App Icons & Branding

- [ ] App icon design (basketball + video theme)
- [ ] Icon generation for all platforms (Windows, macOS, Linux)
- [ ] Favicon for website
- [ ] Logo variations

#### 📖 Documentation & README

- [ ] Comprehensive README with installation guide
- [ ] User manual with screenshots
- [ ] Keyboard shortcuts reference
- [ ] FAQ section
- [ ] Troubleshooting guide

#### 🚀 Distribution & Releases

- [ ] GitHub Actions for automated builds
- [ ] Release automation
- [ ] Code signing certificates
- [ ] Multi-platform testing

### 🎯 **Priority 2: Professional Polish**

#### 🌐 Website & Landing Page

- [ ] Professional website with Astro
- [ ] Demo video creation
- [ ] Download page with system requirements
- [ ] Feature showcase
- [ ] Contact/support page

#### 📱 User Experience

- [ ] Welcome screen/onboarding
- [ ] Product tour for new users
- [ ] Better error messages
- [ ] Loading states and feedback
- [ ] Accessibility improvements

#### 🎥 Demo Content

- [ ] Create demo basketball video
- [ ] Sample project templates
- [ ] Tutorial videos
- [ ] Use case examples

### 🔧 **Priority 3: Technical Improvements**

#### ⚡ Performance

- [ ] Video loading optimization
- [ ] Database performance tuning
- [ ] Memory usage optimization
- [ ] Startup time improvements

#### 🛠️ Features

- [ ] Auto-updater implementation
- [ ] Cloud backup options
- [ ] Advanced export formats
- [ ] Team collaboration features
- [ ] Analytics and insights

#### 🔒 Security & Quality

- [ ] Security audit
- [ ] Code review checklist
- [ ] Automated testing setup
- [ ] Error reporting system

### 🎯 **Priority 4: Marketing & Community**

#### 📢 Marketing Strategy

- [ ] Basketball community outreach
- [ ] Social media presence
- [ ] Coach testimonials
- [ ] Partnership opportunities

#### 🤝 Community Building

- [ ] GitHub discussions setup
- [ ] User feedback system
- [ ] Feature request process
- [ ] Community guidelines

### 📊 **Priority 5: Analytics & Growth**

#### 📈 Usage Analytics

- [ ] Anonymous usage tracking
- [ ] Feature adoption metrics
- [ ] Performance monitoring
- [ ] User journey analysis

#### 🔄 Feedback Loop

- [ ] In-app feedback system
- [ ] Update notification system
- [ ] Beta testing program
- [ ] User interviews

---

## 🔍 Detailed Explanations

### 🚨 **Priority 1: Essential for Public Release**

#### 📸 **Screenshots & Visual Assets (Detailed)**

##### App Screenshots Needed:

###### 1. **Main Interface Screenshot** (`screenshot.png` for README)

- [ ] **Content to capture:**
  - Basketball game video loaded and playing (preferably 720p+ quality)
  - Category panel open showing hierarchical structure:
    - "Offense" (expanded)
      - "Pick & Roll" (expanded)
        - "Ball Screen High"
        - "Ball Screen Low"
      - "Post Ups"
      - "Fast Break"
    - "Defense" (collapsed)
    - "Rebounds" (collapsed)
  - Time search box visible with example "12:30" or "1:23:45"
  - Project dropdown showing: "vs Lakers Game 1", "Player Dev Session", "Team Analysis"
  - Video timeline showing current position around 5:30 mark
  - Mark In/Out buttons clearly visible
  - Professional, clean UI with good color contrast

- [ ] **Technical specifications:**
  - **Resolution:** 1200x800px minimum (2400x1600px for retina)
  - **Format:** PNG with high quality compression
  - **File size:** Under 500KB for fast GitHub loading
  - **Background:** Use actual basketball game footage (copyright-free)
  - **UI scaling:** Ensure text is readable at different sizes

- [ ] **Detailed staging process:**
  1. **Prepare demo video:**
     - Find/create 2-3 minute basketball highlight reel
     - Ensure video has clear plays (pick & roll, fast breaks, etc.)
     - Use copyright-free footage or create your own

  2. **Set up categories:**

     ```
     Offense (🟢 Green)
     ├── Pick & Roll (expanded)
     │   ├── Ball Screen High
     │   ├── Ball Screen Low
     │   └── Slip Screen
     ├── Post Ups
     ├── Fast Break
     └── Half Court Sets

     Defense (🔴 Red)
     ├── Man-to-Man (collapsed)
     ├── Zone Defense (collapsed)
     └── Press (collapsed)

     Rebounds (🟡 Yellow)
     Turnovers (🟠 Orange)
     ```

  3. **Create sample projects:**
     - "vs Lakers Game 1 - Jan 15"
     - "Player Development - Guards"
     - "Team Scrimmage Analysis"

  4. **Position video:**
     - Set to 5:30 timestamp for realistic feel
     - Ensure play is clearly visible
     - Show video controls but not blocking content

  5. **Capture settings:**
     - Use high-DPI display if available
     - Ensure good lighting on screen
     - Clean desktop background
     - Hide unnecessary OS elements

###### 2. **Category Management Deep Dive**

- [ ] **Content to capture:**
  - Category editor panel fully expanded
  - "Edit Categories" button highlighted/active
  - Multiple presets dropdown showing:
    - "Opponent Scouting Template"
    - "Player Development Template"
    - "Team Analysis Template"
    - "Youth Basketball Template"
  - New preset being created with name: "Custom Scouting 2024"
  - Category tree showing:
    - Parent categories with color indicators
    - Subcategories properly indented
    - Add/edit/delete buttons for each level
    - Color picker open for one category
  - Preset save dialog open with:
    - Name field: "Advanced Scouting System"
    - Description: "Comprehensive system for opponent analysis"
    - Save/Cancel buttons

- [ ] **Technical specifications:**
  - **Resolution:** 800x600px minimum (1600x1200px retina)
  - **Focus:** Center on category management panel
  - **Clarity:** Ensure all text is crisp and readable
  - **Highlighting:** Use callouts or arrows if needed

- [ ] **Detailed staging process:**
  1. **Create realistic categories coaches would use:**

     ```
     Offense (🟢 #4CAF50)
     ├── Pick & Roll
     │   ├── Ball Screen High
     │   ├── Ball Screen Low
     │   ├── Slip Screen
     │   └── Re-screen Action
     ├── Post Ups
     │   ├── High Post
     │   ├── Low Post
     │   └── Mid Post
     ├── Fast Break
     │   ├── Primary Break
     │   ├── Secondary Break
     │   └── Trailer Action
     └── Set Plays
         ├── Horns Formation
         ├── 1-4 High
         └── Box Sets

     Defense (🔴 #f44336)
     ├── Man-to-Man
     │   ├── On-Ball Defense
     │   ├── Help Defense
     │   └── Rotations
     ├── Zone Defense
     │   ├── 2-3 Zone
     │   ├── 1-3-1 Zone
     │   └── Match-up Zone
     └── Press
         ├── Full Court
         ├── Half Court
         └── Trap Situations
     ```

  2. **Set up presets with descriptive names:**
     - Show variety of use cases
     - Include templates for different levels (youth, high school, college)
     - Demonstrate preset loading workflow

  3. **Capture preset creation process:**
     - Show user typing new preset name
     - Include helpful placeholder text
     - Show confirmation of successful save

###### 3. **Video Cutting Workflow (Step-by-Step)**

- [ ] **Content to capture:**
  - Video showing clear basketball play in progress
  - Timeline with visible markers:
    - Mark In point at 2:15 (green marker)
    - Mark Out point at 2:27 (red marker)
    - Highlighted region between markers (blue/green overlay)
    - Current playhead position
  - Control buttons clearly visible:
    - Mark In button (highlighted when active)
    - Mark Out button (highlighted when active)
    - Clear Marks button
    - Time search box with "2:15" entered
  - Clip creation dialog open showing:
    - **Title:** "Excellent Pick & Roll Execution - Ball Screen High"
    - **Categories selected:**
      - ✓ Offense > Pick & Roll > Ball Screen High
      - ✓ Player Analysis > Guard Play
    - **Notes:** "Perfect screen timing, great roll to basket, note the help defense rotation"
    - **Duration:** "12 seconds"
    - **Create Clip** button ready to click

- [ ] **Technical specifications:**
  - **Resolution:** 1000x700px minimum (2000x1400px retina)
  - **Multi-step:** Show before/during/after of marking process
  - **Annotations:** Include keyboard shortcut hints (I/O keys)
  - **Quality:** Ensure video content is clearly visible

- [ ] **Detailed staging process:**
  1. **Select appropriate basketball play:**
     - Choose clear, easy-to-understand play (pick & roll is ideal)
     - Ensure play has beginning, middle, end (8-15 seconds)
     - Good video quality with clear player actions

  2. **Demonstrate marking process:**
     - Start with unmarked video
     - Show marking In point at start of play
     - Show marking Out point at completion
     - Display visual feedback of marked region

  3. **Fill clip creation form with realistic details:**
     - Use coaching terminology
     - Show multiple category selection
     - Include detailed notes coaches would write
     - Show duration calculation

  4. **Include helpful UI elements:**
     - Keyboard shortcuts visible (I/O indicators)
     - Time displays showing exact moments
     - Progress indication for clip creation

###### 4. **Clip Library & Organization**

- [ ] **Content to capture:**
  - Main clip library view with grid layout
  - 12-15 clip thumbnails showing:
    - Different basketball plays
    - Variety of clip lengths (8s, 15s, 23s, etc.)
    - Clear thumbnail images from actual plays
  - Left sidebar with hierarchical filtering:
    - Project selector: "vs Lakers Game 1" (active)
    - Category tree with clip counts:
      ```
      📁 All Categories (15 clips)
      ├── 🏀 Offense (8 clips)
      │   ├── Pick & Roll (4 clips) ✓
      │   ├── Post Ups (2 clips)
      │   └── Fast Break (2 clips)
      ├── 🛡️ Defense (5 clips)
      └── 🔄 Turnovers (2 clips)
      ```
  - Top toolbar showing:
    - Search box: "pick and roll"
    - Sort options: "Date Created", "Duration", "Category"
    - View options: Grid/List toggle
    - Export button highlighted
  - Statistics panel:
    - "23 clips total"
    - "12 minutes total duration"
    - "Average 31 seconds per clip"
    - "Last updated: 2 hours ago"
  - Export dialog preview showing folder structure:
    ```
    📁 Exported Clips - vs Lakers Game 1/
    ├── 📁 Offense/
    │   ├── 📁 Pick & Roll/
    │   │   ├── 🎬 Ball_Screen_High_001.mp4
    │   │   └── 🎬 Ball_Screen_High_002.mp4
    │   └── 📁 Post Ups/
    └── 📁 Defense/
    ```

- [ ] **Technical specifications:**
  - **Resolution:** 900x600px minimum (1800x1200px retina)
  - **Variety:** Show diverse clip thumbnails
  - **Organization:** Clear hierarchy and structure
  - **Functionality:** All UI elements visible and purposeful

- [ ] **Detailed staging process:**
  1. **Create diverse clip library:**
     - Mix of offensive and defensive plays
     - Various clip lengths (5-30 seconds)
     - Different game situations
     - Multiple projects to show organization

  2. **Set up realistic filtering:**
     - Show active filters
     - Display clip counts for each category
     - Demonstrate search functionality

  3. **Include export preview:**
     - Show how clips are organized in folders
     - Display file naming conventions
     - Include metadata (duration, date, etc.)

###### 5. **Time Search Feature Showcase**

- [ ] **Content to capture:**
  - Video player with time search input highlighted
  - Multiple time format examples demonstrated:
    - "1:23:45" (1 hour, 23 minutes, 45 seconds)
    - "12:30" (12 minutes, 30 seconds)
    - "150" (150 seconds = 2:30)
    - "45:00" (45 minutes)
  - Before/after showing successful time jump
  - Tooltip or help text explaining format options:
    - "Enter time as HH:MM:SS, MM:SS, or seconds"
    - "Examples: 1:23:45, 12:30, or 150"
  - Video timeline showing jumped-to position
  - Success feedback: "Jumped to 12:30" notification

- [ ] **Technical specifications:**
  - **Resolution:** 600x400px focused screenshot
  - **Clarity:** Time search prominently featured
  - **Examples:** Multiple format demonstrations
  - **Context:** Show within full video player

- [ ] **Detailed staging process:**
  1. **Demonstrate different time formats:**
     - Start with HH:MM:SS for long videos
     - Show MM:SS for typical game clips
     - Include seconds-only for quick jumps

  2. **Show successful navigation:**
     - Video position before search
     - Time entry process
     - Video position after jump
     - Visual confirmation of successful jump

  3. **Include helpful UI:**
     - Placeholder text in search box
     - Error handling for invalid times
     - Keyboard shortcuts (Enter to search)

##### File Organization Structure:

```
/assets/
├── screenshots/
│   ├── hero/
│   │   ├── main-interface-1200x800.png      ## README hero image
│   │   ├── main-interface-2400x1600.png     ## Retina version
│   │   └── main-interface-social-1200x630.png ## Social media
│   │
│   ├── features/
│   │   ├── category-management-800x600.png
│   │   ├── video-cutting-workflow-1000x700.png
│   │   ├── clip-library-900x600.png
│   │   ├── time-search-600x400.png
│   │   ├── preset-system-700x500.png
│   │   └── export-dialog-600x500.png
│   │
│   ├── workflows/
│   │   ├── opponent-scouting-complete.png   ## End-to-end workflow
│   │   ├── player-development-complete.png  ## Use case demo
│   │   ├── team-analysis-complete.png       ## Professional use
│   │   └── first-time-user-journey.png     ## Onboarding flow
│   │
│   ├── ui-details/
│   │   ├── keyboard-shortcuts.png
│   │   ├── category-colors.png
│   │   ├── project-switcher.png
│   │   ├── video-controls.png
│   │   └── error-states.png
│   │
│   └── marketing/
│       ├── app-store-preview-1024x1024.png  ## Future app store
│       ├── social-media-1200x630.png        ## Social sharing
│       ├── press-kit-high-res.png           ## Media resources
│       └── feature-comparison.png           ## vs competitors
```

##### README Integration Strategy:

###### **Hero Section (Top of README):**

```markdown
![Basketball Video Analyzer](assets/screenshots/hero/main-interface-1200x800.png)

**Professional video analysis tool for basketball coaches and teams**
```

###### **Features Section:**

```markdown
### ✨ Key Features

#### 🎬 Advanced Video Cutting

![Video Cutting Workflow](assets/screenshots/features/video-cutting-workflow-1000x700.png)

- **Time Search**: Jump to specific moments using HH:MM:SS format
- **Mark & Cut**: Use I/O keys for precise clip creation
- **Real Video Files**: Creates actual MP4 clips using FFmpeg

#### 🎯 Preset Template System

![Category Management](assets/screenshots/features/category-management-800x600.png)

- **Multiple Presets**: Create templates for different scenarios
- **Hierarchical Categories**: Unlimited depth organization
- **Professional Templates**: Opponent Scouting, Player Development
```

###### **Workflow Section:**

```markdown
### 🚀 Quick Start Guide

#### 1. Create Your Category System

![Category Setup](assets/screenshots/workflows/category-setup.png)

Follow our guided setup to create your first category structure...

#### 2. Load and Cut Your First Clip

![Video Cutting](assets/screenshots/workflows/first-clip.png)

Learn the basics of marking and cutting video clips...
```

##### Usage in Other Materials:

###### **GitHub Release Notes:**

- Feature highlight screenshots
- Before/after comparisons
- New feature demonstrations

###### **Social Media Posts:**

- Individual feature highlights
- Workflow demonstrations
- User success stories

###### **Website Landing Page:**

- Hero image with call-to-action
- Feature gallery with descriptions
- Step-by-step workflow guides

###### **Press Kit for Media:**

- High-resolution application screenshots
- Logo variations and brand assets
- Feature comparison charts
- User testimonial graphics

#### 🎨 **App Icons & Branding (Detailed)**

##### Required Icon Design Elements:

###### **Icon Concept Development:**

- [ ] **Primary concept:** Basketball + Video/Film combination
  - Basketball with play button overlay
  - Film strip with basketball court pattern
  - Whistle + video camera combination
  - Coach's clipboard with video frame

- [ ] **Color scheme:**
  - Primary: Basketball orange (#FF6B35 or #E85D00)
  - Secondary: Court green (#228B22 or #32CD32)
  - Accent: Video blue (#4A90E2 or #007AFF)
  - Neutral: Professional gray (#2C3E50 or #34495E)

- [ ] **Style guidelines:**
  - Modern, flat design with subtle gradients
  - Professional appearance suitable for coaching software
  - Recognizable at small sizes (16x16px)
  - Works well in both light and dark backgrounds

###### **Icon File Requirements:**

####### **macOS Icon (.icns)**

- [ ] **File:** `assets/icon.icns`
- [ ] **Sizes required in .icns:**
  - 16x16px (icon_16x16)
  - 32x32px (icon_16x16@2x)
  - 32x32px (icon_32x32)
  - 64x64px (icon_32x32@2x)
  - 128x128px (icon_128x128)
  - 256x256px (icon_128x128@2x)
  - 256x256px (icon_256x256)
  - 512x512px (icon_256x256@2x)
  - 512x512px (icon_512x512)
  - 1024x1024px (icon_512x512@2x)

- [ ] **Creation process:**
  1. Design master icon at 1024x1024px
  2. Create variations for each size (don't just scale)
  3. Use iconutil command: `iconutil -c icns icon.iconset`
  4. Test on actual macOS system

####### **Windows Icon (.ico)**

- [ ] **File:** `assets/icon.ico`
- [ ] **Sizes required in .ico:**
  - 16x16px (small taskbar)
  - 24x24px (small toolbar)
  - 32x32px (medium toolbar)
  - 48x48px (large toolbar)
  - 64x64px (extra large toolbar)
  - 128x128px (jumbo toolbar)
  - 256x256px (Vista/7/8/10 large)

- [ ] **Creation process:**
  1. Use GIMP, Photoshop, or online converter
  2. Ensure each size is optimized, not just scaled
  3. Test on Windows systems for clarity

####### **Linux Icon (.png)**

- [ ] **Files needed:**
  - `assets/icon.png` (256x256px)
  - `assets/icon@2x.png` (512x512px)
  - `assets/icon@3x.png` (768x768px)

- [ ] **Additional Linux formats:**
  - SVG version for scalability
  - Desktop entry icon (48x48px)

###### **DMG Background Design:**

- [ ] **File:** `assets/dmg-background.png`
- [ ] **Dimensions:** 540x380px (exact size for macOS DMG)
- [ ] **Content design:**
  - Basketball court background (subtle, not distracting)
  - App icon positioned on left side
  - Applications folder icon on right side
  - Arrow indicating drag direction
  - Professional typography: "Drag Basketball Video Analyzer to Applications"
  - Brand colors consistent with app icon

- [ ] **Design elements:**
  - Court lines in subtle gray
  - Hardwood texture (very light)
  - Professional lighting/shadows
  - App name and version number
  - Instructions: "Drag to install"

###### **Loading Animation:**

- [ ] **File:** `assets/loading.gif`
- [ ] **Specifications:**
  - Size: 64x64px or 128x128px
  - Duration: 2-3 seconds loop
  - File size: Under 100KB
  - Frame rate: 15-20 fps for smooth animation

- [ ] **Animation concepts:**
  - Basketball bouncing with subtle rotation
  - Video progress bar filling up
  - Spinning basketball with play button
  - Coach's whistle swinging
  - Simple, professional animation

- [ ] **Creation process:**
  1. Design in After Effects, Blender, or similar
  2. Export as video first for review
  3. Convert to optimized GIF
  4. Test loading times and smoothness

##### Package.json Icon Configuration:

###### **Update Required Paths:**

```json
{
  "config": {
    "forge": {
      "packagerConfig": {
        "icon": "./assets/icon", // Electron Forge will add appropriate extension
        "name": "Basketball Video Analyzer",
        "executableName": "basketball-video-analyzer"
      },
      "makers": [
        {
          "name": "@electron-forge/maker-dmg",
          "config": {
            "name": "Basketball Video Analyzer",
            "icon": "./assets/icon.icns",
            "background": "./assets/dmg-background.png",
            "iconSize": 80,
            "window": {
              "width": 540,
              "height": 380
            },
            "contents": [
              {
                "x": 140,
                "y": 200,
                "type": "file",
                "path": "Basketball Video Analyzer.app"
              },
              {
                "x": 400,
                "y": 200,
                "type": "link",
                "path": "/Applications"
              }
            ]
          }
        },
        {
          "name": "@electron-forge/maker-squirrel",
          "config": {
            "setupIcon": "./assets/icon.ico",
            "loadingGif": "./assets/loading.gif",
            "iconUrl": "https://github.com/kauredo/basketball-video-analyzer/raw/main/assets/icon.ico"
          }
        }
      ]
    }
  }
}
```

###### **Testing Icon Implementation:**

- [ ] **Build test for each platform:**

  ```bash
  ## Test macOS build
  npm run make -- --platform=darwin

  ## Test Windows build
  npm run make -- --platform=win32

  ## Test Linux build
  npm run make -- --platform=linux
  ```

- [ ] **Verification checklist:**
  - [ ] Icons appear correctly in file explorer
  - [ ] Icons show in taskbar/dock
  - [ ] Icons display in app switcher
  - [ ] DMG background displays correctly
  - [ ] Loading animation works during app startup
  - [ ] Icons are crisp at all sizes

###### **Icon Design Tools and Resources:**

####### **Free Design Tools:**

- **GIMP** (free): Advanced image editing
- **Inkscape** (free): Vector graphics for SVG icons
- **Canva** (free tier): Quick icon design with templates
- **Figma** (free): Professional UI design tool
- **Paint.NET** (free): Windows-focused image editor

####### **Online Icon Generators:**

- **IconKitchen**: Automated icon generation
- **AppIcon.co**: iOS/Android icon generation
- **ICO Convert**: Convert PNG to ICO format
- **CloudConvert**: Multi-format icon conversion

####### **Icon Inspiration:**

- **Dribbble**: Search "sports app icons" or "video editing icons"
- **IconFinder**: Professional icon marketplace
- **Flaticon**: Large collection of free icons
- **Material Design Icons**: Google's icon system
- **Feather Icons**: Simple, beautiful icons

###### **Brand Consistency Guidelines:**

####### **Color Palette:**

```css
/* Primary Colors */
--basketball-orange: #ff6b35;
--court-green: #228b22;
--video-blue: #4a90e2;

/* Supporting Colors */
--dark-gray: #2c3e50;
--light-gray: #bdc3c7;
--success-green: #27ae60;
--warning-yellow: #f39c12;
--error-red: #e74c3c;

/* Gradients */
--primary-gradient: linear-gradient(135deg, #ff6b35 0%, #e85d00 100%);
--secondary-gradient: linear-gradient(135deg, #4a90e2 0%, #357abd 100%);
```

####### **Typography for Icons:**

- Font family: Clean, modern sans-serif
- Avoid text in small icons (16x16, 32x32)
- Use symbols and shapes instead
- Ensure readability in icon badges/overlays

####### **Icon Variations Needed:**

- **Full color**: Primary app icon
- **Monochrome**: For dark mode, notifications
- **Outline**: For inactive states
- **Badge**: For notification overlays
- **Favicon**: 16x16px for web use

---

### 🚀 **Priority 2: User Experience Enhancements (Detailed)**

#### 🎯 **Product Tour / Onboarding Implementation**

##### Interactive Tutorial System Architecture:

###### **Technology Stack Selection:**

- [ ] **Primary choice: React Joyride**
  - **Pros**: Most popular, well-maintained, flexible
  - **Cons**: Larger bundle size
  - **Installation**: `npm install react-joyride`
  - **Bundle impact**: ~45KB gzipped

- [ ] **Alternative: Reactour**
  - **Pros**: Lightweight, simple API
  - **Cons**: Less customization options
  - **Installation**: `npm install @reactour/tour`
  - **Bundle impact**: ~25KB gzipped

- [ ] **Alternative: Shepherd.js**
  - **Pros**: Framework agnostic, highly customizable
  - **Cons**: More complex integration with React
  - **Installation**: `npm install shepherd.js react-shepherd`
  - **Bundle impact**: ~35KB gzipped

###### **Recommended Choice: React Joyride**

```typescript
// Installation and basic setup
npm install react-joyride
npm install @types/react-joyride --save-dev
```

##### Detailed Tour Step Implementation:

###### **Step 1: Welcome & Overview**

- [ ] **Trigger**: First app launch (no projects exist)
- [ ] **Target**: Entire app window
- [ ] **Content**:
  ```typescript
  {
    target: 'body',
    content: (
      <div>
        <h2>Welcome to Basketball Video Analyzer! 🏀</h2>
        <p>This powerful tool helps coaches create organized video libraries for team analysis.</p>
        <p><strong>What you'll learn:</strong></p>
        <ul>
          <li>Creating projects for games and sessions</li>
          <li>Building reusable category systems</li>
          <li>Cutting and organizing video clips</li>
          <li>Sharing organized libraries with your team</li>
        </ul>
        <p>Let's get started with your first project!</p>
      </div>
    ),
    placement: 'center',
    disableBeacon: true,
    styles: {
      options: {
        width: 400,
      }
    }
  }
  ```
- [ ] **Visual elements**: Welcome animation, app logo
- [ ] **Duration**: No time limit (user controlled)

###### **Step 2: Project Creation**

- [ ] **Trigger**: After welcome step
- [ ] **Target**: Project selector dropdown
- [ ] **Content**:
  ```typescript
  {
    target: '.project-selector',
    content: (
      <div>
        <h3>Step 1: Create Your First Project</h3>
        <p>Projects help you organize clips by game, opponent, or training session.</p>
        <p><strong>Examples:</strong></p>
        <ul>
          <li>"vs Eagles - Championship Game"</li>
          <li>"Player Development - Guards"</li>
          <li>"Team Scrimmage - Jan 15"</li>
        </ul>
        <p>Click the dropdown to create your first project!</p>
      </div>
    ),
    placement: 'bottom',
    disableBeacon: false,
    spotlightClicks: true, // Allow clicking the target
  }
  ```
- [ ] **Interactive requirement**: User must create a project to continue
- [ ] **Validation**: Check if project exists before advancing

###### **Step 3: Category System Introduction**

- [ ] **Trigger**: After project creation
- [ ] **Target**: Category panel or "Edit Categories" button
- [ ] **Content**:
  ```typescript
  {
    target: '.edit-categories-btn',
    content: (
      <div>
        <h3>Step 2: Build Your Category System</h3>
        <p>Categories help you organize clips by play type, player focus, or analysis goal.</p>
        <div className="category-examples">
          <h4>Common Categories:</h4>
          <div className="category-tree">
            <div>📁 Offense</div>
            <div style={{marginLeft: '20px'}}>└── Pick & Roll</div>
            <div style={{marginLeft: '20px'}}>└── Fast Break</div>
            <div>📁 Defense</div>
            <div style={{marginLeft: '20px'}}>└── Help Defense</div>
          </div>
        </div>
        <p>Click "Edit Categories" to start building!</p>
      </div>
    ),
    placement: 'right',
    spotlightClicks: true,
  }
  ```
- [ ] **Interactive requirement**: User must open category editor
- [ ] **Progressive disclosure**: Show category depth capabilities

###### **Step 4: Creating First Category**

- [ ] **Trigger**: Category editor opens
- [ ] **Target**: Add category form
- [ ] **Content**:
  ```typescript
  {
    target: '.add-category-form',
    content: (
      <div>
        <h3>Create Your First Category</h3>
        <p>Let's create an "Offense" category to get started.</p>
        <div className="guided-input">
          <p><strong>Try this:</strong></p>
          <ol>
            <li>Type "Offense" in the name field</li>
            <li>Choose a green color</li>
            <li>Click "Add Category"</li>
          </ol>
        </div>
        <p>You'll be able to add subcategories like "Pick & Roll" later!</p>
      </div>
    ),
    placement: 'left',
    spotlightClicks: true,
  }
  ```
- [ ] **Interactive requirement**: User must create at least one category
- [ ] **Validation**: Check for category creation before advancing

###### **Step 5: Preset System Demo**

- [ ] **Trigger**: After creating first category
- [ ] **Target**: Preset save section
- [ ] **Content**:
  ```typescript
  {
    target: '.save-preset-section',
    content: (
      <div>
        <h3>💡 Pro Tip: Save as Preset Template</h3>
        <p>This is the game-changer! Save your category structure as a reusable template.</p>
        <div className="preset-benefits">
          <h4>Why presets are powerful:</h4>
          <ul>
            <li>🔄 Reuse the same structure for every game</li>
            <li>⚡ Instantly set up new projects</li>
            <li>📊 Maintain consistent analysis across season</li>
            <li>👥 Share templates with assistant coaches</li>
          </ul>
        </div>
        <p>Try saving this as "My First Template"</p>
      </div>
    ),
    placement: 'bottom',
    spotlightClicks: true,
  }
  ```
- [ ] **Interactive requirement**: User saves their first preset
- [ ] **Educational focus**: Explain the value proposition

###### **Step 6: Video Loading**

- [ ] **Trigger**: After preset creation or skipping preset step
- [ ] **Target**: Video selection button
- [ ] **Content**:
  ```typescript
  {
    target: '.select-video-btn',
    content: (
      <div>
        <h3>Load Your Game Video</h3>
        <p>Now let's load a basketball video to start creating clips.</p>
        <div className="supported-formats">
          <h4>Supported formats:</h4>
          <span className="format-badges">
            <span className="badge">MP4</span>
            <span className="badge">MOV</span>
            <span className="badge">AVI</span>
            <span className="badge">MKV</span>
          </span>
        </div>
        <p><strong>Don't have a video ready?</strong><br/>
        No problem! You can continue the tour with our demo video.</p>
        <button className="demo-video-btn">Use Demo Video</button>
      </div>
    ),
    placement: 'bottom',
    spotlightClicks: true,
  }
  ```
- [ ] **Fallback option**: Provide demo video for tour
- [ ] **Format education**: Explain supported video types

###### **Step 7: Time Search Feature**

- [ ] **Trigger**: After video loads
- [ ] **Target**: Time search input
- [ ] **Content**:
  ```typescript
  {
    target: '.time-search-container',
    content: (
      <div>
        <h3>🎯 New Feature: Time Search</h3>
        <p>Jump to specific moments instantly using multiple time formats!</p>
        <div className="time-examples">
          <h4>Try these formats:</h4>
          <div className="time-format">
            <code>1:23:45</code> → 1 hour, 23 minutes, 45 seconds
          </div>
          <div className="time-format">
            <code>12:30</code> → 12 minutes, 30 seconds
          </div>
          <div className="time-format">
            <code>150</code> → 150 seconds (2:30)
          </div>
        </div>
        <p>Perfect for jumping to specific plays!</p>
      </div>
    ),
    placement: 'top',
    spotlightClicks: true,
  }
  ```
- [ ] **Interactive demo**: Let user try time search
- [ ] **Multiple examples**: Show different format options

###### **Step 8: Mark & Cut Demo**

- [ ] **Trigger**: After time search demo
- [ ] **Target**: Mark In/Out buttons
- [ ] **Content**:
  ```typescript
  {
    target: '.mark-controls',
    content: (
      <div>
        <h3>Mark Your First Clip</h3>
        <p>Use the Mark In/Out buttons or keyboard shortcuts to select a play.</p>
        <div className="shortcuts-reminder">
          <h4>Keyboard shortcuts:</h4>
          <div className="shortcut-grid">
            <div><kbd>I</kbd> Mark In point</div>
            <div><kbd>O</kbd> Mark Out point</div>
            <div><kbd>Space</kbd> Play/Pause</div>
            <div><kbd>←/→</kbd> Skip 5 seconds</div>
          </div>
        </div>
        <p>Try marking a 10-15 second play sequence!</p>
      </div>
    ),
    placement: 'top',
    spotlightClicks: true,
  }
  ```
- [ ] **Guided practice**: User marks their first clip
- [ ] **Keyboard shortcuts**: Educate on efficient workflow

###### **Step 9: Clip Categorization**

- [ ] **Trigger**: After marking In/Out points
- [ ] **Target**: Create clip button or clip creation dialog
- [ ] **Content**:
  ```typescript
  {
    target: '.create-clip-btn',
    content: (
      <div>
        <h3>Categorize & Create Your Clip</h3>
        <p>Now assign categories and create your first organized clip!</p>
        <div className="categorization-tips">
          <h4>Pro categorization tips:</h4>
          <ul>
            <li>🏷️ Use multiple categories when relevant</li>
            <li>📝 Add detailed notes for context</li>
            <li>🎯 Create descriptive titles</li>
            <li>⏱️ Keep clips focused (8-20 seconds ideal)</li>
          </ul>
        </div>
        <p>Click "Create Clip" to organize your first video segment!</p>
      </div>
    ),
    placement: 'left',
    spotlightClicks: true,
  }
  ```
- [ ] **Best practices**: Teach effective categorization
- [ ] **Completion goal**: User creates their first clip

###### **Step 10: Library & Export Overview**

- [ ] **Trigger**: After creating first clip
- [ ] **Target**: Clip library or export button
- [ ] **Content**:
  ```typescript
  {
    target: '.clip-library',
    content: (
      <div>
        <h3>🎉 Congratulations!</h3>
        <p>You've created your first organized basketball clip!</p>
        <div className="next-steps">
          <h4>What you can do now:</h4>
          <ul>
            <li>📚 <strong>View Library</strong> - See all your organized clips</li>
            <li>🔍 <strong>Filter by Category</strong> - Find specific play types</li>
            <li>📤 <strong>Export Clips</strong> - Share with your team</li>
            <li>🔄 <strong>Load Presets</strong> - Use templates in new projects</li>
          </ul>
        </div>
        <div className="completion-actions">
          <button className="primary-btn">Explore Library</button>
          <button className="secondary-btn">Create Another Clip</button>
        </div>
        <p><small>💡 You can replay this tour anytime from the Help menu</small></p>
      </div>
    ),
    placement: 'center',
    disableBeacon: true,
  }
  ```
- [ ] **Celebration**: Acknowledge user's progress
- [ ] **Next steps**: Clear paths for continued engagement

##### Tour Implementation Architecture:

###### **File Structure:**

```typescript
src/renderer/components/tour/
├── ProductTour.tsx              ## Main tour orchestrator
├── TourSteps.tsx               ## Step definitions and content
├── TourProvider.tsx            ## Context provider for tour state
├── TourProgress.tsx            ## Progress indicator component
├── hooks/
│   ├── useFirstTimeUser.ts     ## Detect first-time users
│   ├── useTourProgress.ts      ## Track tour completion
│   └── useTourValidation.ts    ## Validate step completion
├── styles/
│   ├── ProductTour.module.css  ## Tour-specific styling
│   └── TourSteps.module.css    ## Individual step styling
└── utils/
    ├── tourSteps.ts            ## Step configuration
    ├── tourValidation.ts       ## Step validation logic
    └── tourStorage.ts          ## Local storage management
```

###### **Core Implementation:**

####### **ProductTour.tsx** (Main Component):

```typescript
import React, { useState, useEffect } from "react";
import Joyride, { CallBackProps, STATUS, Step } from "react-joyride";
import { useFirstTimeUser } from "./hooks/useFirstTimeUser";
import { tourSteps } from "./utils/tourSteps";
import { validateStepCompletion } from "./utils/tourValidation";
import styles from "./styles/ProductTour.module.css";

interface ProductTourProps {
  isOpen: boolean;
  onComplete: () => void;
  onSkip: () => void;
}

export const ProductTour: React.FC<ProductTourProps> = ({
  isOpen,
  onComplete,
  onSkip,
}) => {
  const [currentStep, setCurrentStep] = useState(0);
  const [tourState, setTourState] = useState({
    run: false,
    continuous: true,
    loading: false,
    stepIndex: 0,
  });

  const handleJoyrideCallback = (data: CallBackProps) => {
    const { action, index, status, type } = data;

    if (([STATUS.FINISHED, STATUS.SKIPPED] as string[]).includes(status)) {
      if (status === STATUS.FINISHED) {
        onComplete();
      } else {
        onSkip();
      }
      setTourState({ ...tourState, run: false });
    } else if (type === "step:after") {
      // Validate step completion before advancing
      const canAdvance = validateStepCompletion(index);
      if (canAdvance || action === "skip") {
        setCurrentStep(index + 1);
      } else {
        // Show validation message
        showValidationMessage(index);
      }
    }
  };

  const showValidationMessage = (stepIndex: number) => {
    // Display step-specific validation guidance
    console.log(`Please complete step ${stepIndex + 1} requirements`);
  };

  useEffect(() => {
    if (isOpen) {
      setTourState({ ...tourState, run: true });
    }
  }, [isOpen]);

  return (
    <Joyride
      callback={handleJoyrideCallback}
      continuous={tourState.continuous}
      run={tourState.run}
      stepIndex={tourState.stepIndex}
      steps={tourSteps}
      showProgress={true}
      showSkipButton={true}
      styles={{
        options: {
          primaryColor: "#FF6B35", // Basketball orange
          width: 350,
          zIndex: 10000,
        },
        tooltip: {
          borderRadius: 8,
          padding: 20,
        },
        tooltipContent: {
          padding: "12px 0",
        },
        buttonNext: {
          backgroundColor: "#FF6B35",
          borderRadius: 6,
          color: "#fff",
          fontSize: 16,
          fontWeight: 600,
          padding: "8px 16px",
        },
        buttonSkip: {
          color: "#666",
          fontSize: 14,
        },
      }}
      locale={{
        back: "Previous",
        close: "Close",
        last: "Complete Tour",
        next: "Next Step",
        skip: "Skip Tour",
      }}
    />
  );
};
```

####### **useFirstTimeUser.ts** (Hook):

```typescript
import { useState, useEffect } from "react";

interface FirstTimeUserState {
  isFirstTime: boolean;
  hasCompletedTour: boolean;
  shouldShowTour: boolean;
}

export const useFirstTimeUser = (): FirstTimeUserState & {
  markTourCompleted: () => void;
  resetTourStatus: () => void;
} => {
  const [state, setState] = useState<FirstTimeUserState>({
    isFirstTime: true,
    hasCompletedTour: false,
    shouldShowTour: false,
  });

  useEffect(() => {
    checkFirstTimeStatus();
  }, []);

  const checkFirstTimeStatus = async () => {
    try {
      // Check if user has any projects
      const projects = await window.electronAPI.getProjects();

      // Check tour completion status from localStorage
      const tourCompleted = localStorage.getItem("tour_completed") === "true";
      const tourSkipped = localStorage.getItem("tour_skipped") === "true";

      const isFirstTime = projects.length === 0;
      const hasCompletedTour = tourCompleted || tourSkipped;
      const shouldShowTour = isFirstTime && !hasCompletedTour;

      setState({
        isFirstTime,
        hasCompletedTour,
        shouldShowTour,
      });
    } catch (error) {
      console.error("Error checking first-time status:", error);
    }
  };

  const markTourCompleted = () => {
    localStorage.setItem("tour_completed", "true");
    localStorage.setItem("tour_completed_date", new Date().toISOString());
    setState((prev) => ({
      ...prev,
      hasCompletedTour: true,
      shouldShowTour: false,
    }));
  };

  const resetTourStatus = () => {
    localStorage.removeItem("tour_completed");
    localStorage.removeItem("tour_skipped");
    localStorage.removeItem("tour_completed_date");
    setState((prev) => ({
      ...prev,
      hasCompletedTour: false,
      shouldShowTour: true,
    }));
  };

  return {
    ...state,
    markTourCompleted,
    resetTourStatus,
  };
};
```

###### **Tour Integration in Main App:**

####### **App.tsx Integration:**

```typescript
import React, { useState, useEffect } from "react";
import { ProductTour } from "./components/tour/ProductTour";
import { useFirstTimeUser } from "./components/tour/hooks/useFirstTimeUser";

export const App: React.FC = () => {
  const { shouldShowTour, markTourCompleted } = useFirstTimeUser();
  const [showTour, setShowTour] = useState(false);

  useEffect(() => {
    // Delay tour start to allow app to fully load
    if (shouldShowTour) {
      const timer = setTimeout(() => {
        setShowTour(true);
      }, 1000);
      return () => clearTimeout(timer);
    }
  }, [shouldShowTour]);

  const handleTourComplete = () => {
    markTourCompleted();
    setShowTour(false);
    // Optional: Show completion celebration
    showCompletionMessage();
  };

  const handleTourSkip = () => {
    localStorage.setItem("tour_skipped", "true");
    setShowTour(false);
  };

  const showCompletionMessage = () => {
    // Show success notification
    console.log("Welcome to Basketball Video Analyzer! 🎉");
  };

  return (
    <div className="app">
      {/* Your existing app components */}

      <ProductTour
        isOpen={showTour}
        onComplete={handleTourComplete}
        onSkip={handleTourSkip}
      />
    </div>
  );
};
```

##### Tour Customization Features:

###### **Progress Indicator:**

- [ ] **Visual progress bar** showing step X of Y
- [ ] **Step titles** with completion checkmarks
- [ ] **Estimated time remaining** for tour completion
- [ ] **Branch indicators** for optional steps

###### **Interactive Validation:**

- [ ] **Step completion detection** before allowing advance
- [ ] **Helpful hints** if user gets stuck
- [ ] **Alternative paths** for different user actions
- [ ] **Graceful error handling** for edge cases

###### **Accessibility Features:**

- [ ] **Keyboard navigation** through tour steps
- [ ] **Screen reader support** with proper ARIA labels
- [ ] **High contrast mode** compatibility
- [ ] **Reduced motion** option for animations

###### **Advanced Tour Features:**

- [ ] **Branching logic** based on user choices
- [ ] **Context-sensitive help** triggered by user actions
- [ ] **Micro-interactions** for engagement
- [ ] **Analytics tracking** for tour completion rates

#### 📖 **Help System Implementation (Detailed)**

##### In-App Help Infrastructure:

###### **Help Button Integration:**

- [ ] **Location**: Header navigation bar (? icon)
- [ ] **Functionality**: Opens help modal/panel
- [ ] **Accessibility**: Keyboard shortcut (F1 or Ctrl+?)
- [ ] **Visual design**: Consistent with app theme

###### **Help Modal Content Structure:**

```typescript
// Help system structure
interface HelpSection {
  id: string;
  title: string;
  icon: string;
  content: React.ReactNode;
  searchKeywords: string[];
}

const helpSections: HelpSection[] = [
  {
    id: "getting-started",
    title: "Getting Started",
    icon: "play-circle",
    content: <GettingStartedContent />,
    searchKeywords: ["start", "begin", "first", "new", "tutorial"],
  },
  {
    id: "keyboard-shortcuts",
    title: "Keyboard Shortcuts",
    icon: "keyboard",
    content: <KeyboardShortcutsContent />,
    searchKeywords: ["keyboard", "shortcuts", "hotkeys", "keys"],
  },
  // ... more sections
];
```

###### **Keyboard Shortcuts Modal:**

- [ ] **Trigger**: Ctrl+? or Shift+?
- [ ] **Content**: Comprehensive shortcut list
- [ ] **Organization**: Grouped by functionality
- [ ] **Interactive**: Allow users to practice shortcuts

```typescript
const KeyboardShortcutsContent = () => (
  <div className="keyboard-shortcuts">
    <div className="shortcut-section">
      <h3>Video Navigation</h3>
      <div className="shortcut-grid">
        <div className="shortcut-item">
          <kbd>Space</kbd>
          <span>Play/Pause video</span>
        </div>
        <div className="shortcut-item">
          <kbd>←</kbd>
          <span>Skip backward 5 seconds</span>
        </div>
        <div className="shortcut-item">
          <kbd>→</kbd>
          <span>Skip forward 5 seconds</span>
        </div>
        <div className="shortcut-item">
          <kbd>Alt</kbd> + <kbd>←</kbd>
          <span>Skip backward 30 seconds</span>
        </div>
        <div className="shortcut-item">
          <kbd>Alt</kbd> + <kbd>→</kbd>
          <span>Skip forward 30 seconds</span>
        </div>
        <div className="shortcut-item">
          <kbd>Ctrl/Cmd</kbd> + <kbd>←</kbd>
          <span>Skip backward 1 minute</span>
        </div>
        <div className="shortcut-item">
          <kbd>Ctrl/Cmd</kbd> + <kbd>→</kbd>
          <span>Skip forward 1 minute</span>
        </div>
      </div>
    </div>

    <div className="shortcut-section">
      <h3>Clip Creation</h3>
      <div className="shortcut-grid">
        <div className="shortcut-item">
          <kbd>I</kbd>
          <span>Mark In point</span>
        </div>
        <div className="shortcut-item">
          <kbd>O</kbd>
          <span>Mark Out point</span>
        </div>
        <div className="shortcut-item">
          <kbd>C</kbd>
          <span>Clear marks</span>
        </div>
        <div className="shortcut-item">
          <kbd>Enter</kbd>
          <span>Create clip (when marks set)</span>
        </div>
      </div>
    </div>

    <div className="shortcut-section">
      <h3>Application</h3>
      <div className="shortcut-grid">
        <div className="shortcut-item">
          <kbd>Ctrl/Cmd</kbd> + <kbd>N</kbd>
          <span>New project</span>
        </div>
        <div className="shortcut-item">
          <kbd>Ctrl/Cmd</kbd> + <kbd>O</kbd>
          <span>Open video</span>
        </div>
        <div className="shortcut-item">
          <kbd>Ctrl/Cmd</kbd> + <kbd>E</kbd>
          <span>Export clips</span>
        </div>
        <div className="shortcut-item">
          <kbd>F1</kbd>
          <span>Show help</span>
        </div>
        <div className="shortcut-item">
          <kbd>Ctrl/Cmd</kbd> + <kbd>?</kbd>
          <span>Show keyboard shortcuts</span>
        </div>
      </div>
    </div>
  </div>
);
```

###### **Context-Sensitive Tooltips:**

- [ ] **Implementation**: React library (react-tooltip or custom)
- [ ] **Trigger**: Hover + 500ms delay
- [ ] **Content**: Concise, helpful explanations
- [ ] **Positioning**: Smart positioning to avoid viewport edges

```typescript
// Tooltip implementation example
import { Tooltip } from "react-tooltip";

const CategoryButton = () => (
  <div>
    <button
      data-tooltip-id="category-tooltip"
      data-tooltip-content="Create hierarchical categories to organize your clips by play type, player focus, or analysis goal"
      className="edit-categories-btn"
    >
      Edit Categories
    </button>
    <Tooltip
      id="category-tooltip"
      place="bottom"
      style={{
        backgroundColor: "#2C3E50",
        color: "#fff",
        maxWidth: "250px",
        fontSize: "14px",
        borderRadius: "6px",
      }}
    />
  </div>
);
```

###### **Error State Help:**

- [ ] **Integration**: Show contextual help for error conditions
- [ ] **Content**: Solution-focused guidance
- [ ] **Examples**: Common video format issues, storage problems

```typescript
const VideoLoadError = ({ error }: { error: string }) => (
  <div className="error-state">
    <h3>Video Loading Failed</h3>
    <p>{error}</p>

    <div className="error-help">
      <h4>Common Solutions:</h4>
      <ul>
        <li>
          <strong>Unsupported format:</strong> Convert to MP4, MOV, or AVI
        </li>
        <li>
          <strong>File corrupted:</strong> Try playing in another video player
        </li>
        <li>
          <strong>File too large:</strong> Compress video or check available
          storage
        </li>
        <li>
          <strong>Path issues:</strong> Avoid special characters in filename
        </li>
      </ul>

      <button onClick={() => openHelp("video-formats")}>
        Learn about supported formats
      </button>
    </div>
  </div>
);
```

---

### 🌐 **Priority 3: Online Presence & Marketing (Detailed)**

#### 🖥️ **Project Website Implementation**

##### Landing Page Architecture:

###### **Technology Stack Selection:**

- [ ] **Primary choice: Static Site Generator**
  - **Recommended: Astro** (fast, modern, component-based)
  - **Alternative: Next.js** (React-based, powerful)
  - **Alternative: Hugo** (Go-based, extremely fast)
  - **Simple option: HTML/CSS/JS** (no framework needed)

###### **Recommended Choice: Astro + Tailwind CSS**

```bash
## Quick setup for modern, fast website
npm create astro@latest basketball-video-analyzer-site
cd basketball-video-analyzer-site
npm install
npx astro add tailwind
```

###### **Complete Website Structure:**

```
website/
├── src/
│   ├── pages/
│   │   ├── index.astro              ## Landing page
│   │   ├── features.astro           ## Feature details
│   │   ├── downloads.astro          ## Download page
│   │   ├── support.astro            ## Help & support
│   │   ├── changelog.astro          ## Version history
│   │   └── privacy.astro            ## Privacy policy
│   │
│   ├── components/
│   │   ├── Header.astro             ## Navigation
│   │   ├── Footer.astro             ## Footer links
│   │   ├── Hero.astro               ## Hero section
│   │   ├── FeatureCard.astro        ## Feature highlights
│   │   ├── DownloadButton.astro     ## Platform downloads
│   │   ├── Screenshot.astro         ## Image gallery
│   │   └── VideoEmbed.astro         ## Demo videos
│   │
│   ├── layouts/
│   │   ├── Layout.astro             ## Base layout
│   │   └── FeaturePage.astro        ## Feature page layout
│   │
│   └── styles/
│       ├── global.css               ## Global styles
│       └── components.css           ## Component styles
│
├── public/
│   ├── images/
│   │   ├── hero-screenshot.png      ## Main app screenshot
│   │   ├── features/                ## Feature screenshots
│   │   ├── icons/                   ## App icons
│   │   └── backgrounds/             ## Background images
│   │
│   ├── videos/
│   │   ├── demo-overview.mp4        ## App overview video
│   │   ├── feature-demos/           ## Individual features
│   │   └── tutorials/               ## How-to videos
│   │
│   ├── downloads/                   ## Static download links
│   └── favicon.ico                  ## Site favicon
│
└── package.json
```

##### Landing Page Content Implementation:

###### **Hero Section** (Complete Code):

```astro
---
// src/components/Hero.astro
---

<section class="hero-section bg-gradient-to-br from-orange-500 to-orange-600 text-white">
  <div class="container mx-auto px-6 py-20">
    <div class="grid lg:grid-cols-2 gap-12 items-center">

      <!-- Left Column: Content -->
      <div class="hero-content">
        <div class="badge mb-6">
          <span class="bg-white/20 text-white px-4 py-2 rounded-full text-sm font-medium">
            🏀 Professional Basketball Analysis Tool
          </span>
        </div>

        <h1 class="text-5xl lg:text-6xl font-bold leading-tight mb-6">
          Basketball Video
          <span class="text-yellow-300">Analyzer</span>
        </h1>

        <p class="text-xl text-orange-100 mb-8 leading-relaxed">
          Create organized video libraries for team analysis across multiple games,
          opponents, and seasons. Built specifically for basketball coaches who want
          systematic, repeatable video analysis workflows.
        </p>

        <div class="key-features mb-8">
          <div class="grid sm:grid-cols-2 gap-4 text-orange-100">
            <div class="flex items-center">
              <svg class="w-5 h-5 text-yellow-300 mr-3" fill="currentColor" viewBox="0 0 20 20">
                <path fill-rule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clip-rule="evenodd"></path>
              </svg>
              Project-based organization
            </div>
            <div class="flex items-center">
              <svg class="w-5 h-5 text-yellow-300 mr-3" fill="currentColor" viewBox="0 0 20 20">
                <path fill-rule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clip-rule="evenodd"></path>
              </svg>
              Time search (HH:MM:SS)
            </div>
            <div class="flex items-center">
              <svg class="w-5 h-5 text-yellow-300 mr-3" fill="currentColor" viewBox="0 0 20 20">
                <path fill-rule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clip-rule="evenodd"></path>
              </svg>
              Reusable category presets
            </div>
            <div class="flex items-center">
              <svg class="w-5 h-5 text-yellow-300 mr-3" fill="currentColor" viewBox="0 0 20 20">
                <path fill-rule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clip-rule="evenodd"></path>
              </svg>
              Hierarchical clip libraries
            </div>
          </div>
        </div>

        <div class="cta-buttons flex flex-col sm:flex-row gap-4">
          <a href="/downloads"
             class="bg-white text-orange-600 px-8 py-4 rounded-lg font-semibold text-lg hover:bg-orange-50 transition-colors inline-flex items-center justify-center">
            <svg class="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"></path>
            </svg>
            Download Free
          </a>

          <a href="#demo-video"
             class="border-2 border-white text-white px-8 py-4 rounded-lg font-semibold text-lg hover:bg-white hover:text-orange-600 transition-colors inline-flex items-center justify-center">
            <svg class="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M14.828 14.828a4 4 0 01-5.656 0M9 10h1.586a1 1 0 01.707.293l2.414 2.414a1 1 0 00.707.293H15M9 10v4a2 2 0 002 2h2a2 2 0 002-2v-4M9 10V9a2 2 0 012-2h2a2 2 0 012 2v1"></path>
            </svg>
            Watch Demo
          </a>
        </div>

        <div class="trust-indicators mt-8 flex items-center text-orange-200 text-sm">
          <span class="mr-6">✓ Free for all basketball teams</span>
          <span class="mr-6">✓ Windows, macOS, Linux</span>
          <span>✓ No account required</span>
        </div>
      </div>

      <!-- Right Column: Screenshot -->
      <div class="hero-image">
        <div class="relative">
          <img src="/images/hero-screenshot.png"
               alt="Basketball Video Analyzer Interface"
               class="rounded-lg shadow-2xl border-4 border-white/20"
               loading="eager">

          <!-- Floating badges -->
          <div class="absolute -top-4 -left-4 bg-green-500 text-white px-3 py-1 rounded-full text-sm font-medium">
            v1.0.0
          </div>
          <div class="absolute -bottom-4 -right-4 bg-blue-500 text-white px-3 py-1 rounded-full text-sm font-medium">
            Free Download
          </div>
        </div>
      </div>

    </div>
  </div>
</section>

<style>
  .hero-section {
    background-image:
      radial-gradient(circle at 20% 50%, rgba(255, 255, 255, 0.1) 0%, transparent 50%),
      radial-gradient(circle at 80% 20%, rgba(255, 255, 255, 0.1) 0%, transparent 50%);
  }

  .hero-image img {
    transition: transform 0.3s ease;
  }

  .hero-image:hover img {
    transform: scale(1.02);
  }

  @media (max-width: 768px) {
    .hero-content h1 {
      font-size: 2.5rem;
    }
  }
</style>
```

###### **Features Section** (Interactive Implementation):

```astro
---
// src/components/FeatureShowcase.astro
const features = [
  {
    id: 'video-cutting',
    title: 'Advanced Video Cutting',
    description: 'Mark in/out points with keyboard shortcuts and create actual MP4 clips using FFmpeg.',
    icon: 'scissors',
    image: '/images/features/video-cutting-workflow.png',
    highlights: [
      'Time search: Jump to specific moments (1:23:45, 12:30, 150s)',
      'Keyboard shortcuts: I/O for mark points, Space for play/pause',
      'Real video files: Creates actual MP4 clips, not just timestamps',
      'Frame-by-frame navigation with precise control'
    ]
  },
  {
    id: 'preset-system',
    title: 'Preset Template System',
    description: 'Save category structures as reusable templates for different scouting scenarios.',
    icon: 'template',
    image: '/images/features/category-management.png',
    highlights: [
      'Multiple presets: Opponent Scouting, Player Development, Team Analysis',
      'Hierarchical categories: Unlimited depth organization',
      'Quick setup: Load presets to instantly configure new projects',
      'Share templates: Export/import preset files with other coaches'
    ]
  },
  {
    id: 'organization',
    title: 'Project-Based Organization',
    description: 'Separate projects for different games, opponents, or analysis types.',
    icon: 'folder',
    image: '/images/features/clip-library.png',
    highlights: [
      'Project isolation: Each project maintains its own categories and clips',
      'Hierarchical filtering: Drill down to specific subcategories',
      'Visual browser: Thumbnail view of all clips with project context',
      'Export system: Create organized folders for team sharing'
    ]
  }
];
---

<section class="features-section py-20 bg-gray-50">
  <div class="container mx-auto px-6">

    <!-- Section Header -->
    <div class="text-center mb-16">
      <h2 class="text-4xl font-bold text-gray-800 mb-4">
        Everything You Need for Professional Basketball Analysis
      </h2>
      <p class="text-xl text-gray-600 max-w-3xl mx-auto">
        Powerful features designed specifically for basketball coaches who want
        systematic, organized video analysis workflows.
      </p>
    </div>

    <!-- Feature Cards -->
    <div class="features-grid space-y-20">
      {features.map((feature, index) => (
        <div class={`feature-item grid lg:grid-cols-2 gap-12 items-center ${index % 2 === 1 ? 'lg:grid-flow-col-dense' : ''}`}>

          <!-- Content Column -->
          <div class={`feature-content ${index % 2 === 1 ? 'lg:col-start-2' : ''}`}>
            <div class="feature-badge mb-4">
              <span class="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-orange-100 text-orange-800">
                <FeatureIcon type={feature.icon} class="w-4 h-4 mr-2" />
                {feature.title}
              </span>
            </div>

            <h3 class="text-3xl font-bold text-gray-800 mb-4">
              {feature.title}
            </h3>

            <p class="text-lg text-gray-600 mb-6 leading-relaxed">
              {feature.description}
            </p>

            <div class="feature-highlights">
              <h4 class="text-lg font-semibold text-gray-800 mb-3">Key Features:</h4>
              <ul class="space-y-3">
                {feature.highlights.map(highlight => (
                  <li class="flex items-start">
                    <svg class="w-5 h-5 text-orange-500 mt-0.5 mr-3 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                      <path fill-rule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clip-rule="evenodd"></path>
                    </svg>
                    <span class="text-gray-700">{highlight}</span>
                  </li>
                ))}
              </ul>
            </div>

            <div class="feature-cta mt-8">
              <a href={`#demo-${feature.id}`}
                 class="inline-flex items-center text-orange-600 font-semibold hover:text-orange-700 transition-colors">
                See it in action
                <svg class="w-4 h-4 ml-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7"></path>
                </svg>
              </a>
            </div>
          </div>

          <!-- Image Column -->
          <div class={`feature-image ${index % 2 === 1 ? 'lg:col-start-1' : ''}`}>
            <div class="relative group">
              <img src={feature.image}
                   alt={`${feature.title} Screenshot`}
                   class="rounded-lg shadow-xl transition-transform duration-300 group-hover:scale-105"
                   loading="lazy">

              <!-- Overlay on hover -->
              <div class="absolute inset-0 bg-orange-600/10 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex items-center justify-center">
                <div class="bg-white rounded-full p-3 shadow-lg">
                  <svg class="w-6 h-6 text-orange-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"></path>
                  </svg>
                </div>
              </div>
            </div>
          </div>

        </div>
      ))}
    </div>

  </div>
</section>
```

###### **Download Section** (Platform Detection):

```astro
---
// src/components/DownloadSection.astro
---

<section class="download-section py-20 bg-white">
  <div class="container mx-auto px-6">

    <div class="text-center mb-12">
      <h2 class="text-4xl font-bold text-gray-800 mb-4">
        Download Basketball Video Analyzer
      </h2>
      <p class="text-xl text-gray-600 mb-6">
        Free for all basketball teams and coaches. Choose your platform:
      </p>
      <div class="license-note bg-green-50 border border-green-200 rounded-lg p-4 max-w-2xl mx-auto">
        <p class="text-green-800 text-sm">
          ✓ Free for basketball teams and personal use •
          ✓ No account required •
          ✓ Works offline
        </p>
      </div>
    </div>

    <div class="download-grid grid md:grid-cols-3 gap-8 max-w-4xl mx-auto">

      <!-- Windows Download -->
      <div class="download-card bg-gradient-to-br from-blue-50 to-blue-100 rounded-xl p-6 text-center hover:shadow-lg transition-shadow">
        <div class="platform-icon mb-4">
          <svg class="w-16 h-16 mx-auto text-blue-600" viewBox="0 0 24 24" fill="currentColor">
            <path d="M3 12V6.75l6-1.32v6.48L3 12zm17-9v8.75l-10 .15V5.21L20 3zM3 13l6 .09v6.81l-6-1.15V13zm17 .25V22l-10-1.91V13.1L20 13.25z"/>
          </svg>
        </div>
        <h3 class="text-xl font-bold text-gray-800 mb-2">Windows</h3>
        <p class="text-gray-600 mb-4 text-sm">Windows 10/11 • 64-bit</p>
        <a href="https://github.com/kauredo/basketball-video-analyzer/releases/latest/download/Basketball-Video-Analyzer-Setup.exe"
           class="download-btn bg-blue-600 text-white px-6 py-3 rounded-lg font-semibold hover:bg-blue-700 transition-colors inline-flex items-center"
           data-platform="windows">
          <svg class="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"></path>
          </svg>
          Download .exe
        </a>
        <p class="text-xs text-gray-500 mt-2">~45MB • Auto-updates</p>
      </div>

      <!-- macOS Download -->
      <div class="download-card bg-gradient-to-br from-gray-50 to-gray-100 rounded-xl p-6 text-center hover:shadow-lg transition-shadow">
        <div class="platform-icon mb-4">
          <svg class="w-16 h-16 mx-auto text-gray-700" viewBox="0 0 24 24" fill="currentColor">
            <path d="M12.152 6.896c-.948 0-2.415-1.078-3.96-1.04-2.04.027-3.91 1.183-4.961 3.014-2.117 3.675-.546 9.103 1.519 12.09 1.013 1.454 2.208 3.09 3.792 3.039 1.52-.065 2.09-.987 3.935-.987 1.831 0 2.35.987 3.96.948 1.637-.026 2.676-1.48 3.676-2.948 1.156-1.688 1.636-3.325 1.662-3.415-.039-.013-3.182-1.221-3.22-4.857-.026-3.04 2.48-4.494 2.597-4.559-1.429-2.09-3.623-2.324-4.39-2.376-2-.156-3.675 1.09-4.61 1.09zM15.53 3.83c.843-1.012 1.4-2.427 1.245-3.83-1.207.052-2.662.805-3.532 1.818-.78.896-1.454 2.338-1.273 3.714 1.338.104 2.715-.688 3.559-1.701"/>
          </svg>
        </div>
        <h3 class="text-xl font-bold text-gray-800 mb-2">macOS</h3>
        <p class="text-gray-600 mb-4 text-sm">macOS 10.15+ • Apple Silicon & Intel</p>
        <a href="https://github.com/kauredo/basketball-video-analyzer/releases/latest/download/Basketball-Video-Analyzer.dmg"
           class="download-btn bg-gray-700 text-white px-6 py-3 rounded-lg font-semibold hover:bg-gray-800 transition-colors inline-flex items-center"
           data-platform="macos">
          <svg class="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"></path>
          </svg>
          Download .dmg
        </a>
        <p class="text-xs text-gray-500 mt-2">~52MB • Drag to install</p>
      </div>

      <!-- Linux Download -->
      <div class="download-card bg-gradient-to-br from-orange-50 to-orange-100 rounded-xl p-6 text-center hover:shadow-lg transition-shadow">
        <div class="platform-icon mb-4">
          <svg class="w-16 h-16 mx-auto text-orange-600" viewBox="0 0 24 24" fill="currentColor">
            <path d="M12.504 0c-.155 0-.315.008-.480.021-4.226.333-3.105 4.807-3.17 6.298-.076 1.092-.3 1.953-1.05 3.02-.885 1.051-2.127 2.75-2.716 4.521-.278.832-.41 1.684-.287 2.489a.424.424 0 00-.11.135c-.26.268-.45.6-.663.839-.199.199-.485.267-.797.4-.313.136-.658.269-.864.68-.09.189-.136.394-.132.602 0 .199.027.4.055.536.058.399.116.728.04.97-.249.68-.28 1.145-.106.889.174-.256.334-.585.427-.961.11-.446.21-.985.074-1.43-.136-.446-.427-.74-.573-1.06-.146-.319-.146-.658-.074-.992.07-.334.274-.598.57-.598.296 0 .548.262.752.262.204 0 .262-.408.262-.408l.017-.199c.093-.322.178-.51.304-.510.127-.001.226.18.226.327v.511c0 .832.17 1.646.85 1.646.68 0 .85-.814.85-1.646v-.511c0-.147.099-.328.226-.327.126 0 .212.188.304.51l.017.199s.058.408.262.408c.204 0 .456-.262.752-.262.296 0 .5.264.57.598.072.334.072.673-.074.992-.146.32-.437.614-.573 1.06-.136.445-.036.984.074 1.43.093.376.253.705.427.961.174.256.143-.209-.106-.889-.076-.242-.018-.571.04-.97.028-.136.055-.337.055-.536.004-.208-.042-.413-.132-.602-.206-.411-.551-.544-.864-.68-.312-.133-.598-.201-.797-.4-.213-.239-.403-.571-.663-.839a.424.424 0 00-.11-.135c.123-.805-.009-1.657-.287-2.489-.589-1.771-1.831-3.47-2.716-4.521-.75-1.067-.974-1.928-1.05-3.02-.065-1.491 1.056-5.965-3.17-6.298-.165-.013-.325-.021-.48-.021zm-.751 4.463c.399 0 .973.283 1.151 1.151.178.868-.04 1.565-.537 1.565-.496 0-.895-.697-.537-1.565.178-.868.524-1.151.923-1.151zm1.502 0c.399 0 .745.283.923 1.151.358.868-.041 1.565-.537 1.565-.497 0-.715-.697-.537-1.565.178-.868.752-1.151 1.151-1.151z"/>
          </svg>
        </div>
        <h3 class="text-xl font-bold text-gray-800 mb-2">Linux</h3>
        <p class="text-gray-600 mb-4 text-sm">Ubuntu 18.04+ • Other distros</p>
        <div class="linux-options space-y-2">
          <a href="https://github.com/kauredo/basketball-video-analyzer/releases/latest/download/basketball-video-analyzer.deb"
             class="download-btn bg-orange-600 text-white px-4 py-2 rounded text-sm font-semibold hover:bg-orange-700 transition-colors inline-flex items-center"
             data-platform="linux-deb">
            Download .deb
          </a>
          <a href="https://github.com/kauredo/basketball-video-analyzer/releases/latest/download/basketball-video-analyzer.rpm"
             class="download-btn bg-orange-600 text-white px-4 py-2 rounded text-sm font-semibold hover:bg-orange-700 transition-colors inline-flex items-center"
             data-platform="linux-rpm">
            Download .rpm
          </a>
        </div>
        <p class="text-xs text-gray-500 mt-2">~48MB • Package manager</p>
      </div>

    </div>

    <!-- System Requirements -->
    <div class="system-requirements mt-12 max-w-4xl mx-auto">
      <details class="bg-gray-50 rounded-lg p-6">
        <summary class="cursor-pointer font-semibold text-gray-800 mb-4">
          System Requirements
        </summary>
        <div class="grid md:grid-cols-2 gap-8 text-sm text-gray-600">
          <div>
            <h4 class="font-semibold text-gray-800 mb-2">Minimum Requirements:</h4>
            <ul class="space-y-1">
              <li>• 4GB RAM (8GB recommended)</li>
              <li>• 2GB free storage space</li>
              <li>• Intel i5 or AMD equivalent</li>
              <li>• Any modern graphics card</li>
            </ul>
          </div>
          <div>
            <h4 class="font-semibold text-gray-800 mb-2">Supported Video Formats:</h4>
            <ul class="space-y-1">
              <li>• MP4, MOV, AVI, MKV, WebM</li>
              <li>• Output: MP4 (H.264)</li>
              <li>• Up to 4K resolution supported</li>
              <li>• FFmpeg processing included</li>
            </ul>
          </div>
        </div>
      </details>
    </div>

  </div>
</section>

<script>
// Platform detection and auto-highlight
document.addEventListener('DOMContentLoaded', function() {
  const userAgent = navigator.userAgent.toLowerCase();
  let platform = 'windows'; // default

  if (userAgent.includes('mac')) {
    platform = 'macos';
  } else if (userAgent.includes('linux')) {
    platform = 'linux-deb';
  }

  // Highlight the user's platform
  const platformButton = document.querySelector(`[data-platform="${platform}"]`);
  if (platformButton) {
    platformButton.classList.add('ring-4', 'ring-offset-2', 'ring-blue-300');
    platformButton.parentElement.classList.add('scale-105', 'shadow-xl');
  }

  // Analytics tracking
  document.querySelectorAll('.download-btn').forEach(btn => {
    btn.addEventListener('click', function() {
      const platform = this.getAttribute('data-platform');
      // Track download with your analytics service
      console.log(`Download started: ${platform}`);
    });
  });
});
</script>
```

##### Hosting & Deployment Strategy:

###### **Recommended Hosting: Netlify**

- [ ] **Why Netlify:**
  - Free tier with generous limits
  - Automatic deployments from Git
  - Built-in CDN and optimization
  - Custom domain support
  - Form handling for contact forms

###### **Complete Deployment Setup:**

```bash
## 1. Build your Astro site
npm run build

## 2. Deploy to Netlify (multiple options)

## Option A: Drag & drop (quickest)
## - Go to netlify.com
## - Drag the 'dist' folder to deploy

## Option B: Git integration (recommended)
## - Connect your GitHub repo
## - Set build command: npm run build
## - Set publish directory: dist
## - Auto-deploys on git push

## Option C: Netlify CLI
npm install -g netlify-cli
netlify login
netlify deploy --prod
```

###### **Custom Domain Setup:**

```javascript
// netlify.toml (in project root)
[build]
  publish = "dist"
  command = "npm run build"

[[redirects]]
  from = "/download/windows"
  to = "https://github.com/kauredo/basketball-video-analyzer/releases/latest/download/Basketball-Video-Analyzer-Setup.exe"
  status = 302

[[redirects]]
  from = "/download/mac"
  to = "https://github.com/kauredo/basketball-video-analyzer/releases/latest/download/Basketball-Video-Analyzer.dmg"
  status = 302

[[redirects]]
  from = "/download/linux"
  to = "https://github.com/kauredo/basketball-video-analyzer/releases/latest/download/basketball-video-analyzer.deb"
  status = 302

## SPA fallback for client-side routing
[[redirects]]
  from = "/*"
  to = "/index.html"
  status = 200
```

#### 📹 **Demo Video Production (Detailed)**

##### Video Content Strategy:

###### **1. Overview Video (60 seconds)**

- [ ] **Script outline:**

  ```
  [0-10s] Hook: "Tired of recreating category systems for every basketball game?"
  [10-20s] Problem: Show messy, unorganized video files
  [20-30s] Solution: Quick app overview with main interface
  [30-45s] Key features: Time search, presets, organization
  [45-55s] Call to action: "Download free at basketballvideoanalyzer.com"
  [55-60s] End screen with download button
  ```

- [ ] **Production requirements:**
  - **Resolution:** 1920x1080 (1080p) minimum
  - **Frame rate:** 30fps
  - **Audio:** Clear narration or text overlays
  - **Format:** MP4 (H.264)
  - **Length:** 60 seconds exactly
  - **Branding:** App logo in corner, consistent colors

###### **2. Feature Demonstration Videos:**

####### **Video 1: "Creating Your First Project" (2 minutes)**

- [ ] **Detailed script:**

  ```
  [0-15s] Introduction
  - "Let's create your first basketball analysis project"
  - Show empty app interface

  [15-45s] Project Creation
  - Click "New Project"
  - Type "vs Eagles - Championship Game"
  - Show project appears in dropdown

  [45-75s] Category Setup
  - Click "Edit Categories"
  - Create "Offense" category (green)
  - Add subcategory "Pick & Roll"
  - Show hierarchical structure

  [75-105s] Preset Saving
  - Name preset "Championship Analysis"
  - Save preset
  - Show in preset dropdown

  [105-120s] Conclusion
  - "Now you can reuse this structure for any game"
  - Show loading preset in new project
  ```

- [ ] **Visual requirements:**
  - Clear mouse cursor highlighting
  - Smooth transitions between sections
  - Text overlays for key points
  - No audio gaps or background noise

####### **Video 2: "Time Search Feature" (1 minute)**

- [ ] **Detailed script:**

  ```
  [0-10s] Introduction
  - "Jump to specific moments instantly"
  - Show video player with timeline

  [10-25s] Format Examples
  - Type "1:23:45" - show jump to 1h 23m 45s
  - Type "12:30" - show jump to 12 minutes 30 seconds
  - Type "150" - show jump to 2:30 (150 seconds)

  [25-45s] Real Use Case
  - "Jump to that great pick & roll at 15:30"
  - Show actual basketball play
  - Mark and cut the play

  [45-60s] Benefits
  - "Perfect for reviewing specific plays"
  - "No more scrubbing through long videos"
  ```

###### **Video Production Tools & Setup:**

####### **Recommended Software:**

- [ ] **Screen Recording:** OBS Studio (free)
  - **Settings:** 1920x1080, 30fps, CRF 23
  - **Audio:** Built-in mic or external USB mic
  - **Filters:** Noise suppression, gain

- [ ] **Video Editing:** DaVinci Resolve (free)
  - **Timeline:** 1080p 30fps project
  - **Color:** Consistent with app branding
  - **Audio:** Background music (royalty-free)

- [ ] **Screen Recording Setup:**

  ```
  OBS Studio Settings:
  - Output: Recording Quality (CRF 15-18)
  - Video: 1920x1080, 30fps
  - Audio: 48kHz, Stereo
  - Hotkeys: F9 start/stop recording

  Scene Setup:
  - Display Capture (full screen)
  - Window Capture (app only) - recommended
  - Audio Input Capture (microphone)
  - Image Source (logo overlay)
  ```

###### **Video Hosting Strategy:**

####### **Primary: YouTube Channel**

- [ ] **Channel setup:** "Basketball Video Analyzer"
- [ ] **Channel art:** App branding, feature highlights
- [ ] **Playlists:**
  - "Getting Started"
  - "Feature Tutorials"
  - "Use Cases"
  - "Tips & Tricks"

####### **Embedding Strategy:**

```html
<!-- Website video embed -->
<div class="video-container">
  <iframe
    width="560"
    height="315"
    src="https://www.youtube.com/embed/VIDEO_ID?rel=0&showinfo=0&modestbranding=1"
    frameborder="0"
    allowfullscreen
  >
  </iframe>
</div>

<!-- GitHub README embed -->
[![Basketball Video Analyzer
Demo](https://img.youtube.com/vi/VIDEO_ID/maxresdefault.jpg)](https://www.youtube.com/watch?v=VIDEO_ID)
```

#### 📱 **Social Media Strategy (Implementation-Ready)**

##### Platform-Specific Content Strategy:

###### **Twitter/X (@BasketballVideoAnalyzer)**

- [ ] **Account setup:**
  - **Bio:** "Free video analysis tool for basketball coaches 🏀 Create organized clip libraries • Time search • Preset templates • Download ⬇️"
  - **Profile image:** App icon
  - **Header image:** App screenshot with features highlighted
  - **Pinned tweet:** Introduction video

- [ ] **Content calendar (weekly):**

  ```
  Monday: Feature Spotlight
  - "💡 Feature Monday: Time Search lets you jump to exact moments like 1:23:45 or 12:30"
  - Include GIF demonstration

  Wednesday: Coaching Tips
  - "🏀 Coaching Tip: Organize clips by 'Offensive Sets' → 'Horns Formation' for consistent analysis"
  - Basketball strategy + app usage

  Friday: User Success
  - "🎉 Coach spotlight: How @LocalCoach uses preset templates for every opponent"
  - User-generated content

  Sunday: Development Updates
  - "⚡ This week: Improved time search performance and new export options"
  - Development transparency
  ```

###### **LinkedIn (Company Page)**

- [ ] **Professional positioning:**
  - Target: High school, college, and professional coaches
  - Content: Industry insights, coaching efficiency, team analysis
  - Tone: Professional, educational, results-focused

- [ ] **Content examples:**

  ```
  "How modern basketball coaches are revolutionizing game analysis"
  - 3-minute read about video analysis trends
  - Position app as solution to common problems
  - Include user testimonials

  "5 ways organized video libraries improve team performance"
  - Educational content that showcases app benefits
  - Coaching methodology insights
  - Call-to-action to download free app
  ```

##### Community Engagement Strategy:

###### **Basketball Coaching Communities:**

####### **Reddit Engagement:**

- [ ] **Target subreddits:**
  - r/Basketball (3.4M members)
  - r/basketballcoach (12K members)
  - r/BasketballTips (180K members)
  - r/NCAAW, r/CollegeBasketball (specific communities)

- [ ] **Engagement approach:**

  ```
  1. Value-first posting:
     - Share coaching insights, not just app promotion
     - Answer questions about video analysis
     - Provide helpful resources

  2. App mentions (natural):
     - "I've been using this free tool called Basketball Video Analyzer"
     - Only when directly relevant to discussion
     - Focus on helping, not selling

  3. AMA potential:
     - "I built a free video analysis tool for coaches, AMA"
     - After establishing community presence
  ```

####### **Facebook Groups:**

- [ ] **Target groups:**
  - "Basketball Coaches Network" (45K members)
  - "Youth Basketball Coaches" (38K members)
  - "High School Basketball Coaches" (22K members)
  - Regional coaching groups

- [ ] **Content strategy:**

  ```
  Educational posts:
  - "How to organize opponent scouting videos"
  - "The importance of consistent analysis workflows"
  - Include app as solution, not primary focus

  Questions for engagement:
  - "What's your biggest video analysis challenge?"
  - "How do you organize clips for different opponents?"
  - Respond with helpful advice + app mention if relevant
  ```

###### **Content Creation Tools:**

####### **Visual Content Tools:**

- [ ] **Canva Pro** (recommended)
  - **Templates:** Social media posts, infographics
  - **Brand kit:** Upload app colors, fonts, logos
  - **Automation:** Resize content for different platforms

- [ ] **Screen recording for social:**

  ```
  Instagram/TikTok format (9:16):
  - Record phone-oriented app demos
  - 15-30 second feature highlights
  - Text overlays for key points

  Twitter format (16:9 or 1:1):
  - Quick feature demonstrations
  - Before/after organization examples
  - Time search format examples
  ```

#### 🏀 **Basketball Community Outreach (Detailed)**

##### Professional Outreach Strategy:

###### **Coaching Clinics & Conferences:**

- [ ] **Target events (2024-2025):**

  ```
  National Events:
  - Nike Basketball Summit (July)
  - NABC Convention (April)
  - USA Basketball Coaching Certification (ongoing)
  - Hoops U Coaching Clinics (various dates)

  Regional Events:
  - State coaching association meetings
  - Local basketball camps (summer)
  - AAU tournaments (year-round)
  - High school coaching clinics (pre-season)
  ```

- [ ] **Presentation approach:**
  ```
  Offer free 15-minute presentations:
  - "Modern Video Analysis for Basketball Teams"
  - Focus on coaching methodology first
  - Demonstrate app as practical solution
  - Provide free licenses for attendees
  - Collect feedback for improvement
  ```

###### **Educational Institution Partnerships:**

####### **University Sports Programs:**

- [ ] **Target outreach:**

  ```
  Email template for university coaches:
  ---
  Subject: Free Video Analysis Tool for [University] Basketball Program

  Hi Coach [Name],

  I'm reaching out because I developed a free video analysis tool specifically
  for basketball coaches and thought it might be useful for [University]'s program.

  Basketball Video Analyzer helps coaches:
  - Create organized clip libraries for opponent scouting
  - Build reusable category templates (saves hours each game)
  - Jump to specific game moments using time search
  - Export organized folders for staff and player review

  The tool is completely free for all basketball teams and educational institutions.
  No accounts, subscriptions, or hidden costs.

  Would you be interested in a quick 10-minute demo? I can show you how other
  college programs are using it to streamline their video analysis workflow.

  Free download: [website]
  Demo request: [calendar link]

  Best regards,
  [Your name]
  Basketball Video Analyzer Team
  ```

####### **High School Programs:**

- [ ] **Outreach strategy:**

  ```
  State athletics associations:
  - Contact state high school athletic associations
  - Offer free presentations at coaching meetings
  - Provide tool for coaching education programs

  Regional coaching networks:
  - Partner with established coaching clinics
  - Sponsor coaching certification programs
  - Provide tool as part of coaching resources
  ```

###### **Youth Basketball Organizations:**

####### **AAU and Travel Teams:**

- [ ] **Partnership opportunities:**

  ```
  Tournament partnerships:
  - Provide free tool access to participating coaches
  - Set up demo stations at tournament venues
  - Partner with tournament organizers for promotion

  League partnerships:
  - Partner with regional AAU organizations
  - Offer tool training for league coaches
  - Create case studies from successful implementations
  ```

##### Content Marketing for Basketball Community:

###### **Educational Content Strategy:**

- [ ] **Blog content calendar:**

  ```
  Week 1: "5 Essential Categories Every Basketball Coach Should Track"
  - Educational content about video analysis
  - Natural app integration as solution

  Week 2: "How to Build Consistent Opponent Scouting Workflows"
  - Coaching methodology focus
  - Template/preset system explanation

  Week 3: "The Evolution of Basketball Video Analysis: From VHS to AI"
  - Industry perspective piece
  - Position app in modern context

  Week 4: "Coach Spotlight: How [Local Coach] Improved Team Performance"
  - User success story
  - Concrete results and testimonials
  ```

###### **Video Content for Coaches:**

- [ ] **YouTube series: "Modern Basketball Analysis"**

  ```
  Episode 1: "Why Video Analysis Matters in Modern Basketball"
  - Industry trends and coaching evolution
  - Position systematic analysis as competitive advantage

  Episode 2: "Building Your First Video Analysis System"
  - Step-by-step methodology
  - App demonstration as practical implementation

  Episode 3: "Advanced Scouting Techniques with Video"
  - Expert coaching insights
  - Advanced app features showcase

  Episode 4: "From Analysis to Implementation: Using Video in Practice"
  - Bridge between analysis and coaching
  - Real coaching scenarios
  ```

---

### 🔧 **Priority 4: Technical Improvements (Implementation-Ready)**

#### 🚀 **Performance & Polish Implementation**

##### Application Startup Optimization:

###### **Splash Screen Implementation:**

- [ ] **Create splash screen component:**

```typescript
// src/renderer/components/SplashScreen.tsx
import React, { useEffect, useState } from "react";
import styles from "../styles/SplashScreen.module.css";

interface SplashScreenProps {
  isVisible: boolean;
  progress: number;
  message: string;
}

export const SplashScreen: React.FC<SplashScreenProps> = ({
  isVisible,
  progress,
  message,
}) => {
  const [fadeOut, setFadeOut] = useState(false);

  useEffect(() => {
    if (progress >= 100) {
      setTimeout(() => setFadeOut(true), 500);
    }
  }, [progress]);

  if (!isVisible && !fadeOut) return null;

  return (
    <div
      className={`${styles.splashContainer} ${fadeOut ? styles.fadeOut : ""}`}
    >
      <div className={styles.splashContent}>
        {/* App Logo */}
        <div className={styles.logoContainer}>
          <img
            src="/assets/icon.png"
            alt="Basketball Video Analyzer"
            className={styles.logo}
          />
          <h1 className={styles.appName}>Basketball Video Analyzer</h1>
          <p className={styles.tagline}>
            Professional Video Analysis for Basketball Coaches
          </p>
        </div>

        {/* Loading Progress */}
        <div className={styles.progressContainer}>
          <div className={styles.progressBar}>
            <div
              className={styles.progressFill}
              style={{ width: `${progress}%` }}
            />
          </div>
          <p className={styles.progressMessage}>{message}</p>
        </div>

        {/* Basketball Animation */}
        <div className={styles.basketballAnimation}>
          <div className={styles.basketball}>🏀</div>
        </div>

        {/* Version Info */}
        <div className={styles.versionInfo}>
          <span>Version 1.0.0</span>
          <span>Free for Basketball Teams</span>
        </div>
      </div>
    </div>
  );
};
```

- [ ] **Splash screen CSS:**

```css
/* src/renderer/styles/SplashScreen.module.css */
.splashContainer {
  position: fixed;
  top: 0;
  left: 0;
  width: 100vw;
  height: 100vh;
  background: linear-gradient(135deg, #ff6b35 0%, #e85d00 100%);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 10000;
  transition: opacity 0.5s ease;
}

.splashContainer.fadeOut {
  opacity: 0;
  pointer-events: none;
}

.splashContent {
  text-align: center;
  color: white;
  max-width: 400px;
  padding: 2rem;
}

.logoContainer {
  margin-bottom: 3rem;
}

.logo {
  width: 80px;
  height: 80px;
  margin-bottom: 1rem;
  filter: drop-shadow(0 4px 8px rgba(0, 0, 0, 0.2));
}

.appName {
  font-size: 1.5rem;
  font-weight: 700;
  margin: 0 0 0.5rem 0;
  text-shadow: 0 2px 4px rgba(0, 0, 0, 0.2);
}

.tagline {
  font-size: 0.9rem;
  opacity: 0.9;
  margin: 0;
}

.progressContainer {
  margin-bottom: 2rem;
}

.progressBar {
  width: 100%;
  height: 4px;
  background: rgba(255, 255, 255, 0.2);
  border-radius: 2px;
  overflow: hidden;
  margin-bottom: 1rem;
}

.progressFill {
  height: 100%;
  background: #fff;
  border-radius: 2px;
  transition: width 0.3s ease;
}

.progressMessage {
  font-size: 0.8rem;
  opacity: 0.8;
  margin: 0;
}

.basketballAnimation {
  margin-bottom: 2rem;
  height: 40px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.basketball {
  font-size: 2rem;
  animation: bounce 1.5s infinite;
}

@keyframes bounce {
  0%,
  100% {
    transform: translateY(0);
  }
  50% {
    transform: translateY(-10px);
  }
}

.versionInfo {
  display: flex;
  justify-content: space-between;
  font-size: 0.7rem;
  opacity: 0.7;
}
```

###### **Loading State Management:**

```typescript
// src/renderer/hooks/useAppInitialization.ts
import { useState, useEffect } from "react";

interface InitializationStep {
  name: string;
  message: string;
  duration: number;
}

const INITIALIZATION_STEPS: InitializationStep[] = [
  { name: "database", message: "Initializing database...", duration: 800 },
  { name: "ffmpeg", message: "Setting up video processing...", duration: 1200 },
  { name: "projects", message: "Loading projects...", duration: 600 },
  { name: "presets", message: "Loading category presets...", duration: 400 },
  { name: "ui", message: "Preparing interface...", duration: 500 },
];

export const useAppInitialization = () => {
  const [currentStep, setCurrentStep] = useState(0);
  const [progress, setProgress] = useState(0);
  const [isComplete, setIsComplete] = useState(false);
  const [currentMessage, setCurrentMessage] = useState("");

  useEffect(() => {
    const runInitialization = async () => {
      for (let i = 0; i < INITIALIZATION_STEPS.length; i++) {
        const step = INITIALIZATION_STEPS[i];
        setCurrentStep(i);
        setCurrentMessage(step.message);

        // Simulate initialization step
        await new Promise((resolve) => setTimeout(resolve, step.duration));

        // Update progress
        const newProgress = ((i + 1) / INITIALIZATION_STEPS.length) * 100;
        setProgress(newProgress);
      }

      setCurrentMessage("Ready to analyze!");
      setTimeout(() => setIsComplete(true), 500);
    };

    runInitialization();
  }, []);

  return {
    currentStep,
    progress,
    isComplete,
    currentMessage,
    isVisible: !isComplete,
  };
};
```

##### Error Boundaries & Graceful Degradation:

###### **Global Error Boundary:**

```typescript
// src/renderer/components/ErrorBoundary.tsx
import React, { Component, ErrorInfo, ReactNode } from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faExclamationTriangle,
  faRefresh,
  faBug,
} from "@fortawesome/free-solid-svg-icons";
import styles from "../styles/ErrorBoundary.module.css";

interface ErrorBoundaryState {
  hasError: boolean;
  error?: Error;
  errorInfo?: ErrorInfo;
  errorId: string;
}

interface ErrorBoundaryProps {
  children: ReactNode;
  fallback?: ReactNode;
}

export class ErrorBoundary extends Component<
  ErrorBoundaryProps,
  ErrorBoundaryState
> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = {
      hasError: false,
      errorId: this.generateErrorId(),
    };
  }

  static getDerivedStateFromError(error: Error): Partial<ErrorBoundaryState> {
    return {
      hasError: true,
      error,
    };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    this.setState({
      error,
      errorInfo,
    });

    // Log error to analytics service
    this.logError(error, errorInfo);
  }

  generateErrorId = (): string => {
    return `err_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  };

  logError = (error: Error, errorInfo: ErrorInfo) => {
    const errorReport = {
      errorId: this.state.errorId,
      message: error.message,
      stack: error.stack,
      componentStack: errorInfo.componentStack,
      timestamp: new Date().toISOString(),
      userAgent: navigator.userAgent,
      url: window.location.href,
    };

    console.error("Application Error:", errorReport);

    // Send to error tracking service (optional)
    // this.sendErrorReport(errorReport);
  };

  handleReload = () => {
    window.location.reload();
  };

  handleReportError = () => {
    const errorDetails = {
      error: this.state.error?.message,
      stack: this.state.error?.stack,
      errorId: this.state.errorId,
    };

    const githubIssueUrl = `https://github.com/kauredo/basketball-video-analyzer/issues/new?title=Application Error: ${encodeURIComponent(
      this.state.error?.message || "Unknown error"
    )}&body=${encodeURIComponent(`
**Error ID:** ${this.state.errorId}

**Error Message:** ${this.state.error?.message}

**Steps to Reproduce:**
1.
2.
3.

**Additional Context:**
Please describe what you were doing when this error occurred.

**Technical Details:**
\`\`\`
${this.state.error?.stack}
\`\`\`
    `)}`;

    window.open(githubIssueUrl, "_blank");
  };

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <div className={styles.errorBoundary}>
          <div className={styles.errorContent}>
            <div className={styles.errorIcon}>
              <FontAwesomeIcon icon={faExclamationTriangle} />
            </div>

            <h1 className={styles.errorTitle}>Oops! Something went wrong</h1>

            <p className={styles.errorMessage}>
              Basketball Video Analyzer encountered an unexpected error. Don't
              worry - your projects and clips are safe.
            </p>

            <div className={styles.errorDetails}>
              <p>
                <strong>Error ID:</strong> {this.state.errorId}
              </p>
              {this.state.error && (
                <p>
                  <strong>Error:</strong> {this.state.error.message}
                </p>
              )}
            </div>

            <div className={styles.errorActions}>
              <button
                onClick={this.handleReload}
                className={styles.primaryAction}
              >
                <FontAwesomeIcon icon={faRefresh} /> Reload Application
              </button>

              <button
                onClick={this.handleReportError}
                className={styles.secondaryAction}
              >
                <FontAwesomeIcon icon={faBug} /> Report This Error
              </button>
            </div>

            <details className={styles.technicalDetails}>
              <summary>Technical Details (for developers)</summary>
              <pre className={styles.errorStack}>{this.state.error?.stack}</pre>
            </details>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
```

#### 🔄 **Auto-Updater Implementation (Complete)**

##### Electron Auto-Updater Setup:

###### **Installation & Configuration:**

```bash
## Install electron-updater
npm install electron-updater
npm install @types/electron-updater --save-dev
```

###### **Main Process Auto-Updater:**

```typescript
// src/main/autoUpdater.ts
import { app, BrowserWindow, dialog } from "electron";
import { autoUpdater } from "electron-updater";
import log from "electron-log";

// Configure logging
log.transports.file.level = "info";
autoUpdater.logger = log;

export class AutoUpdater {
  private mainWindow: BrowserWindow;
  private isManualCheck = false;

  constructor(mainWindow: BrowserWindow) {
    this.mainWindow = mainWindow;
    this.setupAutoUpdater();
  }

  private setupAutoUpdater() {
    // Configure auto-updater
    autoUpdater.checkForUpdatesAndNotify();

    // Auto-updater events
    autoUpdater.on("checking-for-update", () => {
      log.info("Checking for update...");
      this.sendToRenderer("update-checking");
    });

    autoUpdater.on("update-available", (info) => {
      log.info("Update available:", info.version);
      this.sendToRenderer("update-available", {
        version: info.version,
        releaseNotes: info.releaseNotes,
        releaseDate: info.releaseDate,
      });
    });

    autoUpdater.on("update-not-available", (info) => {
      log.info("Update not available:", info.version);
      this.sendToRenderer("update-not-available");

      if (this.isManualCheck) {
        dialog.showMessageBox(this.mainWindow, {
          type: "info",
          title: "No Updates Available",
          message: "Basketball Video Analyzer is up to date!",
          detail: `Current version: ${app.getVersion()}`,
          buttons: ["OK"],
        });
        this.isManualCheck = false;
      }
    });

    autoUpdater.on("error", (error) => {
      log.error("Auto-updater error:", error);
      this.sendToRenderer("update-error", error.message);

      if (this.isManualCheck) {
        dialog.showErrorBox(
          "Update Error",
          `Failed to check for updates: ${error.message}`,
        );
        this.isManualCheck = false;
      }
    });

    autoUpdater.on("download-progress", (progressObj) => {
      this.sendToRenderer("update-download-progress", {
        percent: Math.round(progressObj.percent),
        bytesPerSecond: progressObj.bytesPerSecond,
        total: progressObj.total,
        transferred: progressObj.transferred,
      });
    });

    autoUpdater.on("update-downloaded", (info) => {
      log.info("Update downloaded:", info.version);
      this.sendToRenderer("update-downloaded", {
        version: info.version,
        releaseNotes: info.releaseNotes,
      });

      // Show restart dialog
      this.showRestartDialog(info.version);
    });

    // Check for updates on startup (after 10 seconds)
    setTimeout(() => {
      this.checkForUpdates(false);
    }, 10000);

    // Check for updates every 4 hours
    setInterval(
      () => {
        this.checkForUpdates(false);
      },
      4 * 60 * 60 * 1000,
    );
  }

  public checkForUpdates(manual = false) {
    this.isManualCheck = manual;
    autoUpdater.checkForUpdatesAndNotify();
  }

  public downloadUpdate() {
    autoUpdater.downloadUpdate();
  }

  public installUpdate() {
    autoUpdater.quitAndInstall(false, true);
  }

  private showRestartDialog(version: string) {
    const choice = dialog.showMessageBoxSync(this.mainWindow, {
      type: "info",
      title: "Update Downloaded",
      message: `Basketball Video Analyzer ${version} has been downloaded.`,
      detail: "Restart the application to apply the update.",
      buttons: ["Restart Now", "Restart Later"],
      defaultId: 0,
    });

    if (choice === 0) {
      this.installUpdate();
    }
  }

  private sendToRenderer(channel: string, data?: any) {
    this.mainWindow.webContents.send(channel, data);
  }
}

// Usage in main.ts
import { AutoUpdater } from "./autoUpdater";

// After creating main window
const updater = new AutoUpdater(mainWindow);

// IPC handlers for manual update checks
ipcMain.handle("check-for-updates", () => {
  updater.checkForUpdates(true);
});

ipcMain.handle("download-update", () => {
  updater.downloadUpdate();
});

ipcMain.handle("install-update", () => {
  updater.installUpdate();
});
```

###### **Renderer Process Update UI:**

```typescript
// src/renderer/components/UpdateNotification.tsx
import React, { useState, useEffect } from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faDownload,
  faRefresh,
  faClose,
  faCloudDownloadAlt,
} from "@fortawesome/free-solid-svg-icons";
import styles from "../styles/UpdateNotification.module.css";

interface UpdateInfo {
  version: string;
  releaseNotes?: string;
  releaseDate?: string;
}

interface DownloadProgress {
  percent: number;
  bytesPerSecond: number;
  total: number;
  transferred: number;
}

export const UpdateNotification: React.FC = () => {
  const [updateState, setUpdateState] = useState<
    "none" | "checking" | "available" | "downloading" | "downloaded"
  >("none");
  const [updateInfo, setUpdateInfo] = useState<UpdateInfo | null>(null);
  const [downloadProgress, setDownloadProgress] =
    useState<DownloadProgress | null>(null);
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    // Listen for update events
    const removeListeners: (() => void)[] = [];

    const addListener = (
      channel: string,
      listener: (event: any, data?: any) => void
    ) => {
      window.electronAPI.on(channel, listener);
      removeListeners.push(() =>
        window.electronAPI.removeListener(channel, listener)
      );
    };

    addListener("update-checking", () => {
      setUpdateState("checking");
      setIsVisible(true);
    });

    addListener("update-available", (event, info: UpdateInfo) => {
      setUpdateState("available");
      setUpdateInfo(info);
      setIsVisible(true);
    });

    addListener("update-not-available", () => {
      setUpdateState("none");
      setIsVisible(false);
    });

    addListener(
      "update-download-progress",
      (event, progress: DownloadProgress) => {
        setUpdateState("downloading");
        setDownloadProgress(progress);
      }
    );

    addListener("update-downloaded", (event, info: UpdateInfo) => {
      setUpdateState("downloaded");
      setUpdateInfo(info);
    });

    addListener("update-error", () => {
      setUpdateState("none");
      setIsVisible(false);
    });

    return () => {
      removeListeners.forEach(remove => remove());
    };
  }, []);

  const handleDownload = () => {
    window.electronAPI.downloadUpdate();
  };

  const handleInstall = () => {
    window.electronAPI.installUpdate();
  };

  const handleDismiss = () => {
    setIsVisible(false);
  };

  const formatBytes = (bytes: number): string => {
    if (bytes === 0) return "0 Bytes";
    const k = 1024;
    const sizes = ["Bytes", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
  };

  const formatSpeed = (bytesPerSecond: number): string => {
    return `${formatBytes(bytesPerSecond)}/s`;
  };

  if (!isVisible) return null;

  return (
    <div className={styles.updateNotification}>
      <div className={styles.updateContent}>
        {updateState === "checking" && (
          <div className={styles.updateMessage}>
            <FontAwesomeIcon
              icon={faRefresh}
              spin
              className={styles.updateIcon}
            />
            <span>Checking for updates...</span>
          </div>
        )}

        {updateState === "available" && updateInfo && (
          <div className={styles.updateAvailable}>
            <div className={styles.updateHeader}>
              <FontAwesomeIcon
                icon={faCloudDownloadAlt}
                className={styles.updateIcon}
              />
              <div className={styles.updateText}>
                <h4>Update Available</h4>
                <p>Version {updateInfo.version} is ready to download</p>
              </div>
            </div>

            {updateInfo.releaseNotes && (
              <details className={styles.releaseNotes}>
                <summary>What's new in this version</summary>
                <div
                  dangerouslySetInnerHTML={{ __html: updateInfo.releaseNotes }}
                />
              </details>
            )}

            <div className={styles.updateActions}>
              <button onClick={handleDownload} className={styles.downloadBtn}>
                <FontAwesomeIcon icon={faDownload} /> Download Update
              </button>
              <button onClick={handleDismiss} className={styles.dismissBtn}>
                <FontAwesomeIcon icon={faClose} /> Later
              </button>
            </div>
          </div>
        )}

        {updateState === "downloading" && downloadProgress && (
          <div className={styles.updateDownloading}>
            <div className={styles.downloadHeader}>
              <FontAwesomeIcon
                icon={faDownload}
                className={styles.updateIcon}
              />
              <div className={styles.updateText}>
                <h4>Downloading Update</h4>
                <p>Version {updateInfo?.version}</p>
              </div>
            </div>

            <div className={styles.progressContainer}>
              <div className={styles.progressBar}>
                <div
                  className={styles.progressFill}
                  style={{ width: `${downloadProgress.percent}%` }}
                />
              </div>
              <div className={styles.progressStats}>
                <span>{downloadProgress.percent}% complete</span>
                <span>
                  {formatBytes(downloadProgress.transferred)} /{" "}
                  {formatBytes(downloadProgress.total)}
                </span>
                <span>{formatSpeed(downloadProgress.bytesPerSecond)}</span>
              </div>
            </div>
          </div>
        )}

        {updateState === "downloaded" && updateInfo && (
          <div className={styles.updateReady}>
            <div className={styles.updateHeader}>
              <FontAwesomeIcon icon={faRefresh} className={styles.updateIcon} />
              <div className={styles.updateText}>
                <h4>Update Ready</h4>
                <p>Version {updateInfo.version} is ready to install</p>
              </div>
            </div>

            <div className={styles.updateActions}>
              <button onClick={handleInstall} className={styles.installBtn}>
                <FontAwesomeIcon icon={faRefresh} /> Restart & Install
              </button>
              <button onClick={handleDismiss} className={styles.dismissBtn}>
                <FontAwesomeIcon icon={faClose} /> Install Later
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
```

---

This completes the ultra-detailed TODO with comprehensive implementation guides for Website & Marketing, Technical Improvements, and all the production-ready features. Every section now includes complete code examples, step-by-step processes, and ready-to-implement solutions that you can use immediately to make your app professional!
