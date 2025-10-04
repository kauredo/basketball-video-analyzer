# Auto-Update Setup Guide

This app now supports automatic over-the-air (OTA) updates via GitHub Releases!

## How It Works

The app uses `electron-updater` to:

1. **Check for updates** automatically every 6 hours (and on startup)
2. **Download updates** in the background
3. **Notify users** when an update is ready
4. **Install updates** on restart

## For Developers: Publishing Updates

### Simple 2-Step Process

**Option 1: Using Git (Recommended)**

```bash
# 1. Update version and create tag
npm version patch  # for 1.0.0 → 1.0.1 (or minor/major)

# 2. Push the tag
git push --follow-tags

# Done! GitHub Actions handles everything else ✅
```

**Option 2: Using GitHub UI**

1. Go to GitHub → Releases → "Create a new release"
2. Create new tag (e.g., `v1.0.1`)
3. Click "Publish release"
4. GitHub Actions builds and publishes automatically ✅

### What Happens Automatically

When you push a tag or create a release, GitHub Actions:

1. ✅ Builds the app on macOS, Windows, and Linux (in parallel)
2. ✅ Creates installers (.dmg, .exe, .deb, .rpm)
3. ✅ Publishes a GitHub Release with all installers attached
4. ✅ Generates release notes automatically

**No manual building or publishing needed!**

### Your GitHub Workflow

Your `.github/workflows/release.yml` already handles:

- Multi-platform builds (macOS, Windows, Linux)
- Installer creation for all platforms
- Release publishing with auto-generated notes
- Artifact uploads

All you need to do is create a version tag!

## For Users: Getting Updates

### Automatic (Default)

- The app checks for updates automatically
- When an update is available, you'll see a notification
- Updates download in the background
- You'll be prompted to restart when ready

### Manual Check

- **macOS**: Menu → Basketball Video Analyzer → Check for Updates
- **Windows/Linux**: Menu → Help → Check for Updates

## Update Flow

```
1. App starts → Checks for updates (after 3 second delay)
2. Update available? → Downloads in background
3. Download complete → Shows "Update Ready" dialog
4. User clicks "Restart" → Quits and installs update
5. App restarts with new version
```

## Configuration

### Update Check Frequency

Edit `src/main/autoUpdater.ts`:

```typescript
// Check every 6 hours (default)
setInterval(() => {
  autoUpdater.checkForUpdatesAndNotify();
}, 6 * 60 * 60 * 1000);
```

### Update Server

Updates are fetched from GitHub Releases. Configuration in:

- `forge.config.js` → `publishers` section
- `package.json` → `build.publish` section

### Disable in Development

Auto-updates are automatically disabled when `NODE_ENV=development`

## Troubleshooting

### "Updates not working"

1. **Check GitHub release exists**

   - Must be a published (not draft) release
   - Must have proper installers attached

2. **Check version number**

   - New version must be higher than current
   - Use semantic versioning (e.g., 1.0.0)

3. **Check logs**
   - Logs are saved to:
     - macOS: `~/Library/Logs/basketball-video-analyzer/main.log`
     - Windows: `%USERPROFILE%\AppData\Roaming\basketball-video-analyzer\logs\main.log`
     - Linux: `~/.config/basketball-video-analyzer/logs/main.log`

### "GITHUB_TOKEN error"

Make sure your GitHub token:

- Has `repo` scope
- Is set in environment: `export GITHUB_TOKEN="..."`
- Is valid and not expired

### "Code signing errors (macOS)"

For macOS auto-updates to work properly in production:

- App must be code-signed
- Update `forge.config.js`:
  ```javascript
  osxSign: {
    identity: "Developer ID Application: Your Name (TEAM_ID)"
  },
  osxNotarize: {
    tool: "notarytool",
    appleId: "your@email.com",
    appleIdPassword: "@keychain:AC_PASSWORD",
    teamId: "TEAM_ID"
  }
  ```

## Testing Updates Locally

1. Build version 1.0.0:

   ```bash
   npm version 1.0.0
   npm run build && npm run make
   ```

2. Install and run

3. Create and publish version 1.0.1 on GitHub

4. Wait or manually check for updates

5. Verify update downloads and installs

## Security

- Updates are downloaded over HTTPS
- GitHub validates package integrity
- Signature verification (when code-signed)
- Users can always opt to update later

## Resources

- [electron-updater docs](https://www.electron.build/auto-update)
- [Electron Forge publishing](https://www.electronforge.io/config/publishers)
- [GitHub Releases API](https://docs.github.com/en/rest/releases)
