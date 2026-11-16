import { autoUpdater, dialog, BrowserWindow } from "electron";
import { updateElectronApp, UpdateSourceType } from "update-electron-app";
import log from "electron-log";
import { nt } from "./nativeStrings";

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
    // Only a manual check gets this dialog, so it does not go silent until the
    // download finishes. The automatic check runs every 6 hours and waits for
    // the restart prompt instead.
    if (!isManualCheck) return;
    isManualCheck = false;
    dialog.showMessageBox(mainWindow, {
      type: "info",
      title: nt("updateAvailableTitle"),
      message: nt("updateAvailable"),
      buttons: [nt("ok")],
    });
  });

  autoUpdater.on("update-not-available", () => {
    log.info("No update available");
    if (isManualCheck) {
      isManualCheck = false;
      dialog.showMessageBox(mainWindow, {
        type: "info",
        title: nt("noUpdateTitle"),
        message: nt("noUpdate"),
        buttons: [nt("ok")],
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
          title: nt("updateReadyTitle"),
          message: nt("updateReady", { version: releaseName ?? "" }),
          buttons: [nt("restartNow"), nt("installLater")],
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
      title: nt("updatesTitle"),
      message: nt("updatesUnsupported"),
      buttons: [nt("ok")],
    });
    return;
  }

  isManualCheck = true;
  dialog.showMessageBox(mainWindow, {
    type: "info",
    title: nt("checkingTitle"),
    message: nt("checking"),
    buttons: [nt("ok")],
  });
  try {
    autoUpdater.checkForUpdates();
  } catch (err) {
    isManualCheck = false;
    dialog.showErrorBox(
      nt("checkFailedTitle"),
      nt("checkFailed", { message: (err as Error)?.message ?? String(err) })
    );
  }
}
