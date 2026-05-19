const path = require("path");
const { FusesPlugin } = require("@electron-forge/plugin-fuses");
const { FuseV1Options, FuseVersion } = require("@electron/fuses");

const signMac = !!(
  process.env.APPLE_TEAM_ID &&
  process.env.APPLE_ID &&
  process.env.APPLE_APP_SPECIFIC_PASSWORD
);

const osxSignConfig = signMac
  ? {
      optionsForFile: filePath =>
        filePath.includes("Helper")
          ? { hardenedRuntime: true }
          : {
              entitlements: path.join(
                __dirname,
                "build",
                "entitlements.mac.plist"
              ),
              hardenedRuntime: true,
            },
    }
  : false;

const osxNotarizeConfig = signMac
  ? {
      tool: "notarytool",
      appleId: process.env.APPLE_ID,
      appleIdPassword: process.env.APPLE_APP_SPECIFIC_PASSWORD,
      teamId: process.env.APPLE_TEAM_ID,
    }
  : false;

module.exports = {
  packagerConfig: {
    asar: {
      unpack:
        "**/node_modules/{fluent-ffmpeg,ffmpeg-static,ffprobe-static,better-sqlite3,lzma-native,youtube-dl-exec}/**/*",
    },
    name: "BasketballVideoAnalyzer",
    executableName: "basketball-video-analyzer",
    appBundleId: "com.kauredo.basketballvideoanalyzer",
    icon: "./assets/icon",
    osxSign: osxSignConfig,
    osxNotarize: osxNotarizeConfig,
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
      const crypto = require("crypto");
      const fs = require("fs");
      const path = require("path");
      const yaml = require("js-yaml");

      if (makeResults.length === 0) return;

      const allArtifacts = makeResults.flatMap(r => r.artifacts);
      const outPath = path.dirname(allArtifacts[0]);
      const version = require("./package.json").version;

      const files = allArtifacts.map(artifact => {
        const buf = fs.readFileSync(artifact);
        return {
          url: path.basename(artifact),
          sha512: crypto.createHash("sha512").update(buf).digest("base64"),
          size: buf.length,
        };
      });

      // electron-updater's macOS flow extracts the .zip in-place;
      // Windows uses Setup.exe; Linux uses the .deb (when supported).
      const pickPrimary = ext =>
        files.find(f => f.url.toLowerCase().endsWith(ext.toLowerCase())) ||
        files[0];

      const writeYml = (ymlName, primary) =>
        fs.writeFileSync(
          path.join(outPath, ymlName),
          yaml.dump({
            version,
            files,
            path: primary.url,
            sha512: primary.sha512,
            releaseDate: new Date().toISOString(),
          })
        );

      if (process.platform === "darwin") {
        writeYml("latest-mac.yml", pickPrimary(".zip"));
      } else if (process.platform === "win32") {
        writeYml("latest.yml", pickPrimary("Setup.exe"));
      } else if (process.platform === "linux") {
        writeYml("latest-linux.yml", pickPrimary(".deb"));
      }
    },
  },
};
