# App Icons

This folder contains the app icons for Basketball Video Analyzer.

## Current Files

- `icon.svg` - Preview basketball icon (replace with your custom design)

## Required Icon Files for Full Support

To properly support both Mac and Windows, you should add these files:

### For macOS (.icns format):

- `icon.icns` - Mac app icon (contains multiple sizes: 16x16, 32x32, 128x128, 256x256, 512x512, 1024x1024)

### For Windows (.ico format):

- `icon.ico` - Windows app icon (contains multiple sizes: 16x16, 32x32, 48x48, 256x256)

### For Linux (.png format):

- `icon.png` - Linux icon (512x512 recommended)

## How to Create Icons

### Option 1: Online Converters

1. Start with a high-resolution PNG (1024x1024 recommended)
2. Use online converters like:
   - https://cloudconvert.com/ (PNG to ICNS/ICO)
   - https://convertico.com/ (PNG to ICO)
   - https://iconverticons.com/ (PNG to ICNS)

### Option 2: Command Line Tools

```bash
# Install imagemagick
brew install imagemagick

# Create ICO for Windows
magick icon.png -resize 256x256 icon.ico

# For ICNS (Mac), use iconutil or online converter
```

### Option 3: Use the SVG

The current `icon.svg` can be converted to other formats using the online tools above.

## File Structure After Adding Icons

```
assets/
├── icon.svg     (preview/source)
├── icon.icns    (macOS)
├── icon.ico     (Windows)
└── icon.png     (Linux/fallback)
```

## Notes

- The forge config is already set to use `./assets/icon` (without extension)
- Electron Forge will automatically pick the right format for each platform
- Higher resolution source images (1024x1024) create better results when downscaled
