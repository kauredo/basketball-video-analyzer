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
