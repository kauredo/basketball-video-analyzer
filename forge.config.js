const path = require("path");
const { FusesPlugin } = require("@electron-forge/plugin-fuses");
const { FuseV1Options, FuseVersion } = require("@electron/fuses");

const signMac = !!(
  process.env.APPLE_API_KEY_PATH &&
  process.env.APPLE_API_KEY_ID &&
  process.env.APPLE_API_ISSUER
);

// CI sets SKIP_NOTARIZE=1 to defer notarization to a separate workflow step,
// avoiding the multi-hour wait inside @electron/notarize when Apple's queue
// is backlogged. Signing still happens during make.
const notarizeMac = signMac && process.env.SKIP_NOTARIZE !== "1";

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

const osxNotarizeConfig = notarizeMac
  ? {
      tool: "notarytool",
      appleApiKey: process.env.APPLE_API_KEY_PATH,
      appleApiKeyId: process.env.APPLE_API_KEY_ID,
      appleApiIssuer: process.env.APPLE_API_ISSUER,
    }
  : false;

module.exports = {
  packagerConfig: {
    asar: {
      unpack:
        "**/node_modules/{fluent-ffmpeg,better-sqlite3,lzma-native,youtube-dl-exec}/**/*",
    },
    // Copied into the app's resources folder. The prePackage hook writes the
    // notices file for the platform being packaged.
    extraResource: [
      "LICENSE",
      "out/notices/THIRD-PARTY-NOTICES.txt",
      path.join("out", "ffmpeg", process.platform === "win32" ? "ffmpeg.exe" : "ffmpeg"),
    ],
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
        // The Apple Silicon DMG keeps its old name, which the website and
        // older links expect; the Intel one says what it is.
        name:
          process.arch === "x64"
            ? "BasketballVideoAnalyzer-x64"
            : "BasketballVideoAnalyzer",
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
  hooks: {
    prePackage: async (_, platform, arch) => {
      if (platform !== process.platform || arch !== process.arch) {
        throw new Error("Package on a native runner for the target platform and architecture so FFmpeg matches.");
      }
      const { writeNotices } = await import("./scripts/third-party-notices.mjs");
      writeNotices();
    },
    // Legacy: generates latest*.yml update manifests. The app now updates via
    // update-electron-app (update.electronjs.org), which reads GitHub releases
    // directly and ignores these files — kept for now, harmless, remove later.
    postMake: async (forgeConfig, makeResults) => {
      const crypto = require("crypto");
      const fs = require("fs");
      const path = require("path");
      const yaml = require("js-yaml");

      if (makeResults.length === 0) return;
      // Intel Mac and arm64 Linux builds would write a manifest with the same
      // name as the main build's and overwrite it in the release.
      const mainArch = process.platform === "darwin" ? "arm64" : "x64";
      if (process.arch !== mainArch) return;

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
