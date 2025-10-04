import { autoUpdater } from "electron-updater";
import { BrowserWindow, dialog } from "electron";
import log from "electron-log";

// Configure logging
log.transports.file.level = "info";
autoUpdater.logger = log;

// Flag to prevent duplicate notifications during manual checks
let isManualCheck = false;

export function setupAutoUpdater(mainWindow: BrowserWindow) {
  // Don't check for updates in development
  if (process.env.NODE_ENV === "development") {
    console.log("Auto-updater disabled in development");
    return;
  }

  // Configure update server
  autoUpdater.setFeedURL({
    provider: "github",
    owner: "kauredo",
    repo: "basketball-video-analyzer",
  });

  // Check for updates on startup (after a delay)
  setTimeout(() => {
    autoUpdater.checkForUpdatesAndNotify();
  }, 3000);

  // Check for updates every 6 hours
  setInterval(() => {
    autoUpdater.checkForUpdatesAndNotify();
  }, 6 * 60 * 60 * 1000);

  // Event handlers
  autoUpdater.on("checking-for-update", () => {
    log.info("Checking for update...");
  });

  autoUpdater.on("update-available", info => {
    log.info("Update available:", info);
    mainWindow.webContents.send("update-available", info);

    // Only show automatic notification if this isn't a manual check
    // (manual checks have their own notification flow)
    if (!isManualCheck) {
      dialog.showMessageBox(mainWindow, {
        type: "info",
        title: "Update Available",
        message: `Version ${info.version} is available and will download in the background. You'll be notified when it's ready to install.`,
        buttons: ["OK"],
      });
    }
  });

  autoUpdater.on("update-not-available", info => {
    log.info("Update not available:", info);
  });

  autoUpdater.on("error", err => {
    log.error("Error in auto-updater:", err);
    mainWindow.webContents.send("update-error", err);
  });

  let lastProgressNotification = 0;
  autoUpdater.on("download-progress", progressObj => {
    const percent = Math.floor(progressObj.percent);
    const logMessage = `Download speed: ${progressObj.bytesPerSecond} - Downloaded ${percent}% (${progressObj.transferred}/${progressObj.total})`;
    log.info(logMessage);
    mainWindow.webContents.send("download-progress", progressObj);

    // Show progress notification every 25% to avoid spam
    if (percent >= lastProgressNotification + 25 && percent < 100) {
      lastProgressNotification = percent;
      log.info(`Update download progress: ${percent}%`);
    }
  });

  autoUpdater.on("update-downloaded", info => {
    log.info("Update downloaded:", info);
    mainWindow.webContents.send("update-downloaded", info);

    // Show dialog to restart and install
    dialog
      .showMessageBox(mainWindow, {
        type: "info",
        title: "Update Ready to Install",
        message: `Version ${info.version} has been downloaded and is ready to install.\n\nWould you like to restart now to complete the update?\n\nNote: If you choose "Later", the update will be installed the next time you start the app.`,
        buttons: ["Restart Now", "Install Later"],
        defaultId: 0,
        cancelId: 1,
      })
      .then(result => {
        if (result.response === 0) {
          // Quit and install immediately
          autoUpdater.quitAndInstall();
        }
        // If user clicks "Install Later", the update will install on next app launch automatically
      });
  });
}

// Manual check for updates (can be triggered from menu)
export function checkForUpdates(mainWindow: BrowserWindow) {
  if (process.env.NODE_ENV === "development") {
    dialog.showMessageBox(mainWindow, {
      type: "info",
      title: "Development Mode",
      message: "Auto-updates are disabled in development mode.",
    });
    return;
  }

  // Set flag to prevent duplicate notifications
  isManualCheck = true;

  // Show checking message
  dialog.showMessageBox(mainWindow, {
    type: "info",
    title: "Checking for Updates",
    message: "Checking for updates...",
    buttons: ["OK"],
  });

  // Set up one-time listeners for this manual check
  const onUpdateAvailable = (info: any) => {
    dialog.showMessageBox(mainWindow, {
      type: "info",
      title: "Update Available",
      message: `A new version ${info.version} is available! It will download in the background.`,
      buttons: ["OK"],
    });
    autoUpdater.off("update-available", onUpdateAvailable);
    autoUpdater.off("update-not-available", onUpdateNotAvailable);
    autoUpdater.off("error", onError);
    isManualCheck = false;
  };

  const onUpdateNotAvailable = () => {
    dialog.showMessageBox(mainWindow, {
      type: "info",
      title: "No Updates Available",
      message: "You're already running the latest version!",
      buttons: ["OK"],
    });
    autoUpdater.off("update-available", onUpdateAvailable);
    autoUpdater.off("update-not-available", onUpdateNotAvailable);
    autoUpdater.off("error", onError);
    isManualCheck = false;
  };

  const onError = (err: Error) => {
    dialog.showMessageBox(mainWindow, {
      type: "error",
      title: "Update Check Failed",
      message: `Failed to check for updates: ${err.message}`,
      buttons: ["OK"],
    });
    autoUpdater.off("update-available", onUpdateAvailable);
    autoUpdater.off("update-not-available", onUpdateNotAvailable);
    autoUpdater.off("error", onError);
    isManualCheck = false;
  };

  autoUpdater.once("update-available", onUpdateAvailable);
  autoUpdater.once("update-not-available", onUpdateNotAvailable);
  autoUpdater.once("error", onError);

  autoUpdater.checkForUpdates().catch(err => {
    // Fallback error handling
    isManualCheck = false;
    dialog.showErrorBox(
      "Update Check Failed",
      "Failed to check for updates: " + err.message
    );
  });
}
