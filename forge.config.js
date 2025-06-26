const { FusesPlugin } = require("@electron-forge/plugin-fuses");
const { FuseV1Options, FuseVersion } = require("@electron/fuses");

module.exports = {
  packagerConfig: {
    asar: true,
    executableName: "basketball-clip-cutter",
    appBundleId: "com.yourname.basketball-clip-cutter",
    appCategoryType: "public.app-category.sports",
    name: "Basketball Video Analyzer",
    icon: "./assets/icon",
    osxSign: false, // Disable signing for now
    osxNotarize: false, // Disable notarization
    extendInfo: {
      NSCameraUsageDescription: "This app does not use the camera",
      NSMicrophoneUsageDescription: "This app does not use the microphone",
      CFBundleDisplayName: "Basketball Video Analyzer", // macOS display name
      CFBundleName: "Basketball Video Analyzer",
    },
  },
  rebuildConfig: {},
  makers: [
    {
      name: "@electron-forge/maker-squirrel",
      config: {
        name: "basketball_clip_cutter",
        setupExe: "BasketballClipCutterSetup.exe",
        noMsi: true,
      },
    },
    {
      name: "@electron-forge/maker-zip",
      platforms: ["darwin"],
    },
    {
      name: "@electron-forge/maker-dmg",
      platforms: ["darwin"],
      config: {
        name: "Basketball Clip Cutter",
        title: "Basketball Clip Cutter ${version}",
        background: null,
        format: "UDZO",
      },
    },
    {
      name: "@electron-forge/maker-deb",
      config: {
        options: {
          maintainer: "Your Name",
          homepage: "https://github.com/yourusername/basketball-clip-cutter",
          description:
            "Desktop app for cutting and categorizing basketball video clips",
        },
      },
    },
    {
      name: "@electron-forge/maker-rpm",
      config: {},
    },
  ],
  plugins: [
    {
      name: "@electron-forge/plugin-auto-unpack-natives",
      config: {},
    },
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
