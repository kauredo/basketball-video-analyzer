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

### macOS code signing + notarization

Signing is **already wired up** in `forge.config.js` and `.github/workflows/release.yml`. It activates automatically whenever the `APPLE_TEAM_ID` env var is present (i.e. in CI when the secrets below are set). Local `npm run make` builds without those env vars stay unsigned, so nothing changes for day-to-day development.

To enable signed releases, do this **once**:

#### 1. Create a "Developer ID Application" certificate

In [Apple Developer → Certificates](https://developer.apple.com/account/resources/certificates), create a new certificate of type **Developer ID Application** (not "Mac App Distribution" — that's for the Mac App Store).

- Generate a CSR from Keychain Access on your Mac (`Keychain Access → Certificate Assistant → Request a Certificate From a Certificate Authority`, save to disk).
- Upload the CSR, download the resulting `.cer`, double-click to install it into your login keychain.

#### 2. Export the certificate as `.p12`

In Keychain Access, find "Developer ID Application: <Your Name> (TEAMID)" under "My Certificates". Right-click → **Export** → save as `.p12` with a strong password. Keep the password — you'll need it as `MACOS_CERTIFICATE_PWD`.

#### 3. Generate an App Store Connect API key

At [appstoreconnect.apple.com/access/integrations/api](https://appstoreconnect.apple.com/access/integrations/api):

- Switch to the **Team Keys** tab (not "Individual Keys").
- Click **+ Generate API Key**.
- Name: e.g. `basketball-video-analyzer notarization`.
- Access: **Developer** is sufficient for notarytool.
- Click **Generate**, then **download the `.p8` file immediately** — Apple only lets you download it once.
- Note the **Key ID** (10 chars, shown in the keys list).
- Note the **Issuer ID** (UUID, shown at the top of the page).

We use the API key instead of the older app-specific-password flow because notary submissions go through a more responsive endpoint that doesn't get stuck in the multi-hour queues we hit with the legacy path.

#### 4. Add four GitHub secrets

In the repo: Settings → Secrets and variables → Actions → New repository secret.

| Secret | Value |
| --- | --- |
| `MACOS_CERTIFICATE` | Base64 of the `.p12` from step 2 (run `base64 -i cert.p12 \| pbcopy` and paste) |
| `MACOS_CERTIFICATE_PWD` | The `.p12` password from step 2 |
| `APPLE_API_KEY` | Base64 of the `.p8` from step 3 (run `base64 -i AuthKey_XXXXXXXXXX.p8 \| pbcopy` and paste) |
| `APPLE_API_KEY_ID` | The Key ID from step 3 (10 chars) |
| `APPLE_API_ISSUER` | The Issuer ID from step 3 (UUID) |

After that, every tag push (`v*`) produces a signed + notarized DMG, and Gatekeeper warnings go away for end users.

#### Verifying locally (optional)

Once the cert is in your local keychain *and* you have the `.p8` saved somewhere safe, you can produce a fully signed+notarized build locally:

```bash
export APPLE_API_KEY_PATH="/path/to/AuthKey_XXXXXXXXXX.p8"
export APPLE_API_KEY_ID="XXXXXXXXXX"
export APPLE_API_ISSUER="abcd1234-5678-90ab-cdef-1234567890ab"
npm run make
```

Notarization typically completes in 2–10 minutes; the build will block until Apple responds.

#### Two-phase release flow

Apple does deep-scan analysis on first-time submissions for a developer or app — Apple DTS confirms this typically takes **1–2 days** for new apps before the system "recognises" them, after which submissions speed back up to 15-minute responses. To avoid blocking releases on that wait, the release pipeline splits notarization in two:

1. **`release.yml` (on tag push `v*`)** — builds, signs, packages, submits to notary **without waiting**, then publishes the GitHub Release immediately with the unstapled artifacts. The release body contains a `⏳ macOS notarization pending` notice and the Apple submission id. End users can download and use the app right away (signed; macOS may show a one-time "unidentified developer" prompt that they bypass with right-click → Open).

2. **`notarize.yml` (manual `workflow_dispatch`)** — run from the Actions tab after Apple completes notarization (typically 1–2 days for first-release, faster after). Reads the submission id from the release body, runs `notarytool wait`, then `stapler staple`s the `.dmg` and the `.app` inside the `.zip`, regenerates `latest-mac.yml` with the new hashes, and replaces the release assets in place. The release body updates to `✅ macOS notarization complete`.

To run the second phase: Actions tab → **Notarize and staple release** → **Run workflow** → optionally enter a tag (defaults to the latest release).

> **Windows code signing is not configured.** Windows users will still see a SmartScreen warning on first run ("Don't run / More info → Run anyway"). Buying a code-signing cert (~$200+/yr) would remove this, but isn't currently set up.

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
