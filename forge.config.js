const { FusesPlugin } = require("@electron-forge/plugin-fuses");
const { FuseV1Options, FuseVersion } = require("@electron/fuses");

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
      name: "@electron-forge/maker-squirrel",
      config: {},
    },
    {
      name: "@electron-forge/maker-zip",
      platforms: ["darwin"],
    },
    {
      name: "@electron-forge/maker-deb",
      config: {
        name: "basketball-clip-cutter",
        description: "Basketball Video Analyzer",
        category: "Video",
      },
    },
    {
      name: "@electron-forge/maker-rpm",
      config: {
        name: "basketball-clip-cutter",
        description: "Basketball Video Analyzer",
        category: "Video",
      },
    },
  ],
  plugins: [
    {
      name: "@electron-forge/plugin-auto-unpack-natives",
      config: {},
    },
    // Fuses are used to enable/disable various Electron functionality
    // at package time, before code signing the application
    new FusesPlugin({
      version: FuseVersion.V1,
      [FuseV1Options.RunAsNode]: false,
      [FuseV1Options.EnableCookieEncryption]: true,
      [FuseV1Options.EnableNodeOptionsEnvironmentVariable]: false,
      [FuseV1Options.EnableNodeCliInspectArguments]: false,
      [FuseV1Options.EnableEmbeddedAsarIntegrityValidation]: true,
      [FuseV1Options.OnlyLoadAppFromAsar]: true,
    }),
  ],
};
