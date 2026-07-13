import { autoUpdater, dialog, BrowserWindow } from "electron";
import { updateElectronApp, UpdateSourceType } from "update-electron-app";
import log from "electron-log";

// Configure logging
log.transports.file.level = "info";

// update.electronjs.org drives Squirrel updates on Windows and macOS, which is
// how this app is packaged (electron-forge maker-squirrel + the macOS .zip).
// Linux (deb/rpm) has no Squirrel updater, so auto-update is intentionally
// skipped there — those users update via their package manager or a manual
// download. This replaces electron-updater, which needs an NSIS build and an
// app-update.yml that electron-forge never produces (hence the ENOENT on
// Windows and silently-broken updates on macOS).
const AUTO_UPDATE_SUPPORTED =
  process.platform === "win32" || process.platform === "darwin";

let updatesStarted = false;
let isManualCheck = false;

export function setupAutoUpdater(mainWindow: BrowserWindow) {
  if (process.env.NODE_ENV === "development") {
    console.log("Auto-updater disabled in development");
    return;
  }
  if (!AUTO_UPDATE_SUPPORTED) {
    log.info(`Auto-update not supported on platform ${process.platform}`);
    return;
  }

  updateElectronApp({
    updateSource: {
      type: UpdateSourceType.ElectronPublicUpdateService,
      repo: "kauredo/basketball-video-analyzer",
    },
    updateInterval: "6 hours",
    logger: log,
    // We drive our own restart dialog in the update-downloaded handler below,
    // so update-electron-app must not attach its own.
    notifyUser: false,
  });
  updatesStarted = true;

  // Electron's built-in Squirrel updater emits these. Note: Squirrel has no
  // download-progress event, so there is no live percentage to show.
  autoUpdater.on("update-available", () => {
    log.info("Update available; downloading in background");
    // Show this on both automatic and manual checks — otherwise a manual
    // "Check for Updates" that finds one just goes silent until the download
    // finishes minutes later.
    isManualCheck = false;
    dialog.showMessageBox(mainWindow, {
      type: "info",
      title: "Update Available",
      message:
        "A new version is available and is downloading in the background. You'll be asked to restart when it's ready.",
      buttons: ["OK"],
    });
  });

  autoUpdater.on("update-not-available", () => {
    log.info("No update available");
    if (isManualCheck) {
      isManualCheck = false;
      dialog.showMessageBox(mainWindow, {
        type: "info",
        title: "No Updates Available",
        message: "You're already running the latest version!",
        buttons: ["OK"],
      });
    }
  });

  autoUpdater.on(
    "update-downloaded",
    (_event, _releaseNotes, releaseName) => {
      log.info("Update downloaded:", releaseName);
      isManualCheck = false;
      mainWindow.webContents.send("update-downloaded", {
        version: releaseName,
      });
      dialog
        .showMessageBox(mainWindow, {
          type: "info",
          title: "Update Ready to Install",
          message: `Version ${releaseName ?? ""} has been downloaded and is ready to install.\n\nRestart now to finish updating? If you choose "Install Later", it will be applied the next time you open the app.`,
          buttons: ["Restart Now", "Install Later"],
          defaultId: 0,
          cancelId: 1,
        })
        .then(result => {
          if (result.response === 0) {
            autoUpdater.quitAndInstall();
          }
        });
    }
  );

  autoUpdater.on("error", err => {
    log.error("Auto-updater error:", err);
    if (isManualCheck) {
      isManualCheck = false;
      mainWindow.webContents.send("update-error", {
        message: err?.message ?? String(err),
      });
    }
  });
}

// Manual check triggered from the app menu.
export function checkForUpdates(mainWindow: BrowserWindow) {
  if (process.env.NODE_ENV === "development") {
    dialog.showMessageBox(mainWindow, {
      type: "info",
      title: "Development Mode",
      message: "Auto-updates are disabled in development mode.",
    });
    return;
  }
  if (!AUTO_UPDATE_SUPPORTED || !updatesStarted) {
    dialog.showMessageBox(mainWindow, {
      type: "info",
      title: "Updates",
      message:
        "Automatic updates aren't available on this platform. Please download the latest version from the website.",
      buttons: ["OK"],
    });
    return;
  }

  isManualCheck = true;
  dialog.showMessageBox(mainWindow, {
    type: "info",
    title: "Checking for Updates",
    message: "Checking for updates...",
    buttons: ["OK"],
  });
  try {
    autoUpdater.checkForUpdates();
  } catch (err) {
    isManualCheck = false;
    dialog.showErrorBox(
      "Update Check Failed",
      "Failed to check for updates: " + (err as Error)?.message
    );
  }
}
