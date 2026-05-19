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

      const checksum = file => {
        const buf = fs.readFileSync(file);
        return {
          sha512: crypto.createHash("sha512").update(buf).digest("base64"),
          size: buf.length,
        };
      };

      const writeYml = (ymlName, result) => {
        const outPath = path.dirname(result.artifacts[0]);
        const version = require("./package.json").version;
        const files = result.artifacts.map(artifact => {
          const { sha512, size } = checksum(artifact);
          return { url: path.basename(artifact), sha512, size };
        });
        fs.writeFileSync(
          path.join(outPath, ymlName),
          yaml.dump({
            version,
            files,
            path: files[0].url,
            sha512: files[0].sha512,
            releaseDate: new Date().toISOString(),
          })
        );
      };

      let macDone = false;
      let winDone = false;
      let linuxDone = false;

      for (const result of makeResults) {
        if (process.platform === "darwin" && !macDone) {
          writeYml("latest-mac.yml", result);
          macDone = true;
        }
        if (process.platform === "win32" && !winDone) {
          writeYml("latest.yml", result);
          winDone = true;
        }
        if (process.platform === "linux" && !linuxDone) {
          writeYml("latest-linux.yml", result);
          linuxDone = true;
        }
      }
    },
  },
};
