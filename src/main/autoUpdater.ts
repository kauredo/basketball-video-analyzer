import { autoUpdater } from "electron-updater";
import { BrowserWindow, dialog } from "electron";
import log from "electron-log";

// Configure logging
log.transports.file.level = "info";
autoUpdater.logger = log;

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

  autoUpdater.on("update-available", (info) => {
    log.info("Update available:", info);
    mainWindow.webContents.send("update-available", info);
  });

  autoUpdater.on("update-not-available", (info) => {
    log.info("Update not available:", info);
  });

  autoUpdater.on("error", (err) => {
    log.error("Error in auto-updater:", err);
    mainWindow.webContents.send("update-error", err);
  });

  autoUpdater.on("download-progress", (progressObj) => {
    const logMessage = `Download speed: ${progressObj.bytesPerSecond} - Downloaded ${progressObj.percent}% (${progressObj.transferred}/${progressObj.total})`;
    log.info(logMessage);
    mainWindow.webContents.send("download-progress", progressObj);
  });

  autoUpdater.on("update-downloaded", (info) => {
    log.info("Update downloaded:", info);
    mainWindow.webContents.send("update-downloaded", info);

    // Show dialog to restart and install
    dialog
      .showMessageBox(mainWindow, {
        type: "info",
        title: "Update Ready",
        message: "A new version has been downloaded. Restart to install?",
        buttons: ["Restart", "Later"],
        defaultId: 0,
        cancelId: 1,
      })
      .then((result) => {
        if (result.response === 0) {
          // Quit and install
          autoUpdater.quitAndInstall();
        }
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

  autoUpdater.checkForUpdates().catch((err) => {
    dialog.showErrorBox(
      "Update Check Failed",
      "Failed to check for updates: " + err.message
    );
  });
}
