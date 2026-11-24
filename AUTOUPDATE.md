# Auto-updates and releases

The packaged app uses [update-electron-app](https://github.com/electron/update-electron-app) with the public Electron update service. Windows uses the Squirrel installer. On macOS the updater uses the architecture-specific ZIP. Linux users update through their package manager or download the latest DEB or RPM.

The app checks for updates on startup and every six hours on Windows and macOS. Help > Check for Updates runs a manual check. Downloads happen in the background, and the app prompts for a restart once the update is ready.

## Release an app version

1. Set the new version in `package.json` and `package-lock.json`, update `CHANGELOG.md`, and commit the release changes.
2. Create a matching `vX.Y.Z` tag and push it. The [Release workflow](.github/workflows/release.yml) checks the tag against the app version, runs tests and builds the five native targets.
3. The Mac jobs sign both builds and submit the disk images to Apple. The workflow keeps submission IDs with the signed packages in Actions artifacts. The stapling jobs wait for Apple, staple and validate each DMG and the app inside each ZIP, then upload the finished packages.
4. The publish job uploads the finished installers and all five FFmpeg source archives to GitHub. The website rebuild starts after publication.

For an unsigned rehearsal, run the Release workflow manually on the branch you want to build. The workflow uploads installers to Actions and skips signing, notarization and publication.

## Recover an interrupted release

If Apple is still processing a submission when its wait times out, wait for Apple and choose **Re-run failed jobs** on the original Release run. This reuses the signed packages and submission IDs from that run. For an invalid submission, use the notary log in the failed stapling job to diagnose the signing or packaging problem.

If the website hook fails after publication, re-run failed jobs on that run. The website job can retry independently of publication.

## Signing credentials

Create a **Developer ID Application** certificate in the Apple Developer portal and export it from Keychain Access as a password-protected `.p12`. Create a **Team Key** in App Store Connect and save the `.p8`, key ID, and issuer ID. Set these repository Actions secrets:

| Secret | Value |
| --- | --- |
| `MACOS_CERTIFICATE` | Base64-encoded `.p12` |
| `MACOS_CERTIFICATE_PWD` | Password for the `.p12` |
| `APPLE_API_KEY` | Base64-encoded `.p8` |
| `APPLE_API_KEY_ID` | App Store Connect key ID |
| `APPLE_API_ISSUER` | App Store Connect issuer ID |
| `WEBSITE_DEPLOY_HOOK` | Optional website deployment URL |

For local notarization of the app bundle, install the signing certificate in your keychain and set `APPLE_API_KEY_PATH`, `APPLE_API_KEY_ID` and `APPLE_API_ISSUER` before running `npm run package`.

Check the Release run first if an update is missing. The Windows release needs the Squirrel `RELEASES` file and package, and the macOS release needs the ZIP for the user's architecture. Confirm the installed version and app logs if the assets are present.
