const { FusesPlugin } = require("@electron-forge/plugin-fuses");
const { FuseV1Options, FuseVersion } = require("@electron/fuses");

module.exports = {
  packagerConfig: {
    asar: {
      unpack:
        "**/node_modules/{fluent-ffmpeg,ffmpeg-static,ffprobe-static,better-sqlite3,lzma-native}/**/*",
    },
    name: "BasketballVideoAnalyzer",
    executableName: "basketball-video-analyzer",
    appBundleId: "com.yourname.basketball-video-analyzer",
    icon: "./assets/icon",
    // Code signing disabled - users need to bypass Gatekeeper
    osxSign: false,
    osxNotarize: false,
    // Allow unsigned apps on macOS for development
    extendInfo: {
      NSAppTransportSecurity: {
        NSAllowsArbitraryLoads: true,
      },
    },
    // Windows-specific options
    win32metadata: {
      CompanyName: "Basketball Video Analyzer Team",
      FileDescription: "Basketball Video Analyzer",
      OriginalFilename: "basketball-video-analyzer.exe",
      ProductName: "Basketball Video Analyzer",
      InternalName: "basketball-video-analyzer",
    },
  },
  rebuildConfig: {},
  makers: [
    process.platform === "win32" && {
      name: "@electron-forge/maker-squirrel",
      config: {
        name: "BasketballVideoAnalyzer",
        title: "Basketball Video Analyzer",
      },
    },
    process.platform === "darwin" && {
      name: "@electron-forge/maker-dmg",
      config: {
        format: "ULFO",
        name: "BasketballVideoAnalyzer",
      },
    },
    process.platform === "darwin" && {
      name: "@electron-forge/maker-zip",
      platforms: ["darwin"],
    },
    process.platform === "linux" && {
      name: "@electron-forge/maker-deb",
      config: {
        options: {
          maintainer: "Basketball Video Analyzer Team",
          homepage: "https://github.com/kauredo/basketball-video-analyzer",
          description:
            "Basketball Video Analyzer - Desktop app for cutting and categorizing basketball video clips",
          categories: ["Video", "AudioVideo"],
        },
      },
    },
    process.platform === "linux" && {
      name: "@electron-forge/maker-rpm",
      config: {
        options: {
          maintainer: "Basketball Video Analyzer Team",
          homepage: "https://github.com/kauredo/basketball-video-analyzer",
          description:
            "Basketball Video Analyzer - Desktop app for cutting and categorizing basketball video clips",
          categories: ["Video", "AudioVideo"],
        },
      },
    },
  ].filter(Boolean),
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
  publishers: [
    {
      name: "@electron-forge/publisher-github",
      config: {
        repository: {
          owner: "kauredo",
          name: "basketball-video-analyzer",
        },
        prerelease: false,
        draft: true,
      },
    },
  ],
  // This is needed for electron-updater to work
  hooks: {
    postMake: async (forgeConfig, makeResults) => {
      const fs = require("fs");
      const path = require("path");
      const yaml = require("js-yaml");

      let macMetadataGenerated = false;
      let winMetadataGenerated = false;
      let linuxMetadataGenerated = false;

      for (const result of makeResults) {
        const outPath = path.dirname(result.artifacts[0]);
        const version = require("./package.json").version;

        // Generate update metadata files for auto-updater (only once per platform)

        // macOS: latest-mac.yml
        if (process.platform === "darwin" && !macMetadataGenerated) {
          const latestMac = {
            version: version,
            files: result.artifacts.map(artifact => ({
              url: path.basename(artifact),
              sha512: "", // Will be filled by GitHub
            })),
            path: result.artifacts[0] ? path.basename(result.artifacts[0]) : "",
            sha512: "",
            releaseDate: new Date().toISOString(),
          };
          fs.writeFileSync(
            path.join(outPath, "latest-mac.yml"),
            yaml.dump(latestMac)
          );
          macMetadataGenerated = true;
        }

        // Windows: latest.yml
        if (process.platform === "win32" && !winMetadataGenerated) {
          const latestWin = {
            version: version,
            files: result.artifacts.map(artifact => ({
              url: path.basename(artifact),
              sha512: "", // Will be filled by GitHub
            })),
            path: result.artifacts[0] ? path.basename(result.artifacts[0]) : "",
            sha512: "",
            releaseDate: new Date().toISOString(),
          };
          fs.writeFileSync(
            path.join(outPath, "latest.yml"),
            yaml.dump(latestWin)
          );
          winMetadataGenerated = true;
        }

        // Linux: latest-linux.yml
        if (process.platform === "linux" && !linuxMetadataGenerated) {
          const latestLinux = {
            version: version,
            files: result.artifacts.map(artifact => ({
              url: path.basename(artifact),
              sha512: "", // Will be filled by GitHub
            })),
            path: result.artifacts[0] ? path.basename(result.artifacts[0]) : "",
            sha512: "",
            releaseDate: new Date().toISOString(),
          };
          fs.writeFileSync(
            path.join(outPath, "latest-linux.yml"),
            yaml.dump(latestLinux)
          );
          linuxMetadataGenerated = true;
        }
      }
    },
  },
};
