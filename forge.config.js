// const { FuseV1Options, FuseVersion } = require("@electron/fuses");

module.exports = {
  packagerConfig: {
    asar: true,
    name: "Basketball Video Analyzer",
    executableName: "basketball-clip-cutter",
    appBundleId: "com.yourname.basketball-clip-cutter",
    icon: "./assets/icon",
    osxSign: false,
    osxNotarize: false,
    // Windows-specific options
    win32metadata: {
      CompanyName: "Your Company",
      FileDescription: "Basketball Video Analyzer",
      OriginalFilename: "basketball-clip-cutter.exe",
      ProductName: "Basketball Video Analyzer",
      InternalName: "basketball-clip-cutter",
    },
  },
  rebuildConfig: {},
  makers: [
    {
      name: "@electron-forge/maker-zip",
      platforms: ["darwin"],
    },
    {
      name: "@electron-forge/maker-dmg",
      platforms: ["darwin"],
      config: {
        name: "Basketball Video Analyzer",
        format: "UDZO",
      },
    },
    {
      name: "@electron-forge/maker-squirrel",
      platforms: ["win32"],
      config: {
        name: "basketball_clip_cutter",
        setupExe: "BasketballVideoAnalyzerSetup.exe",
        setupIcon: "./assets/icon.ico",
        loadingGif: "./assets/loading.gif",
        noMsi: true,
        remoteReleases: "",
        certificateFile: process.env.WINDOWS_CERTIFICATE_FILE,
        certificatePassword: process.env.WINDOWS_CERTIFICATE_PASSWORD,
      },
    },
  ],
  plugins: [
    {
      name: "@electron-forge/plugin-auto-unpack-natives",
      config: {},
    },
  ],
};
