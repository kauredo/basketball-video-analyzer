#!/usr/bin/env node
/**
 * Writes THIRD-PARTY-NOTICES.txt for the packaged app: the app's own notice,
 * the FFmpeg, yt-dlp and deno binaries it ships, and every production npm
 * package with its full licence text.
 *
 * forge.config.js runs this before packaging and ships the file in the app's
 * resources folder next to LICENSE. Run it by hand with
 * `node scripts/third-party-notices.mjs [output path]`.
 *
 * The npm walk follows `dependencies` and `optionalDependencies` from
 * package.json the way Node resolves them, which is the set Forge copies into
 * the package once it prunes the dev dependencies.
 */
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, readdirSync, readFileSync, realpathSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const RULE = "=".repeat(78);
const SOURCE = "https://github.com/kauredo/basketball-video-analyzer";

const LICENSE_FILE = /^(licen[cs]e|copying|notice)([.\-_]|$)/i;

const readJson = file => JSON.parse(readFileSync(file, "utf8"));
const section = (title, body) => `${RULE}\n${title}\n${RULE}\n\n${body.trim()}\n\n`;

/** The FFmpeg release a `ffmpeg -version` banner names, or null for a git snapshot. */
export const ffmpegRelease = versionOutput => {
  const token = /^ffmpeg version (\S+)/m.exec(versionOutput)?.[1];
  return token ? (/^n?(\d+\.\d+(?:\.\d+)?)(?:$|-)/.exec(token)?.[1] ?? null) : null;
};

/** Licence-like files at the top of a package folder, sorted so output is stable. */
export const licenseFiles = names => names.filter(name => LICENSE_FILE.test(name)).sort();

const resolvePackage = (name, fromDir) => {
  for (let dir = fromDir; ; dir = dirname(dir)) {
    const candidate = join(dir, "node_modules", name);
    if (existsSync(join(candidate, "package.json"))) return candidate;
    if (dir === ROOT || dir === dirname(dir)) return null;
  }
};

const productionPackages = () => {
  const seen = new Map();
  const visit = dir => {
    const pkg = readJson(join(dir, "package.json"));
    const deps = [
      ...Object.keys(pkg.dependencies ?? {}).map(name => [name, false]),
      ...Object.keys(pkg.optionalDependencies ?? {}).map(name => [name, true]),
    ];
    for (const [name, optional] of deps) {
      const found = resolvePackage(name, dir);
      if (!found) {
        if (!optional) throw new Error(`${name} (needed by ${pkg.name}) is not installed`);
        continue;
      }
      const real = realpathSync(found);
      if (seen.has(real)) continue;
      seen.set(real, readJson(join(real, "package.json")));
      visit(real);
    }
  };
  visit(ROOT);
  return [...seen].sort(([, a], [, b]) => `${a.name}@${a.version}`.localeCompare(`${b.name}@${b.version}`));
};

const licenseOf = pkg =>
  typeof pkg.license === "string"
    ? pkg.license
    : pkg.license?.type ?? ((pkg.licenses ?? []).map(l => l.type).join(" OR ") || "UNKNOWN");

const repoOf = pkg => (typeof pkg.repository === "string" ? pkg.repository : pkg.repository?.url) ?? pkg.homepage ?? "";

const MIT_TEXT = `Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.`;

const authorOf = pkg => (typeof pkg.author === "string" ? pkg.author : pkg.author?.name) ?? `the ${pkg.name} authors`;

// A few MIT packages publish no licence file. The licence still asks for its
// text and the copyright line, so reproduce them from package.json.
const missingLicenseText = pkg => {
  console.warn(`third-party-notices: ${pkg.name}@${pkg.version} has no licence file`);
  if (licenseOf(pkg) !== "MIT") return `This package ships no licence file. Its package.json declares: ${licenseOf(pkg)}.`;
  return `This package ships no licence file. Its package.json declares the MIT
License; the standard text follows, with the author from package.json.

MIT License

Copyright (c) ${authorOf(pkg)}

${MIT_TEXT}`;
};

const npmSection = (dir, pkg) => {
  const files = licenseFiles(readdirSync(dir));
  const head = [`License: ${licenseOf(pkg)}`, repoOf(pkg) && `Repository: ${repoOf(pkg)}`].filter(Boolean).join("\n");
  const texts = files.length
    ? files.map(file => readFileSync(join(dir, file), "utf8").trim()).join("\n\n")
    : missingLicenseText(pkg);
  return section(`${pkg.name} ${pkg.version}`, `${head}\n\n${texts}`);
};

export const validateFfmpeg = (banner, licence) => {
  const configuration = /^configuration: (.+)$/m.exec(banner)?.[1];
  if (/(?:^|\s)--enable-nonfree(?:\s|$)/.test(configuration ?? "") ||
      /nonfree parts|not legally redistributable/i.test(licence)) {
    throw new Error("FFmpeg contains nonfree parts");
  }
  if (!configuration || !ffmpegRelease(banner) || !licence.trim()) {
    throw new Error("Could not identify the FFmpeg build");
  }
  return { banner, configuration };
};

export const inspectFfmpeg = binary => {
  const options = { encoding: "utf8", timeout: 15000 };
  const banner = execFileSync(binary, ["-hide_banner", "-version"], options).replaceAll("\r\n", "\n");
  const licence = execFileSync(binary, ["-hide_banner", "-L"], options);
  return validateFfmpeg(banner, licence);
};

const ffmpegSection = app => {
  const dir = join(ROOT, "out", "ffmpeg");
  const binary = join(dir, process.platform === "win32" ? "ffmpeg.exe" : "ffmpeg");
  const { banner, configuration } = inspectFfmpeg(binary);
  const platform = `${process.platform}-${process.arch}`;
  const source = `${SOURCE}/releases/download/v${app.version}/ffmpeg-source-${platform}.tar.gz`;

  return section("FFmpeg, x264 and zlib", `
The app runs FFmpeg as a separate program to cut and convert video. FFmpeg
includes statically linked x264 and zlib and is licensed under the GNU General Public
License, version 3 or later. The release build recipe is scripts/build-ffmpeg.sh
in the app's source repository.

  Platform:      ${platform}
  Version line:  ${banner.split("\n")[0]}
  Configuration: ${configuration}

Corresponding Source for FFmpeg and its bundled libraries,
including the build script: ${source}

${["FFmpeg-LICENSE.md", "FFmpeg-COPYING", "x264-COPYING", "zlib-LICENSE"]
  .map(file => readFileSync(join(dir, file), "utf8").trim()).join("\n\n")}
`);
};

const bundledSection = (title, intro, files) =>
  section(title, [intro.trim(), ...files.map(file => readFileSync(join(ROOT, "licenses", file), "utf8").trim())].join("\n\n"));

const pinnedVersion = name =>
  new RegExp(`^${name}=(\\S+)`, "m").exec(readFileSync(join(ROOT, "scripts", "fetch-yt-dlp.sh"), "utf8"))?.[1] ?? "unknown";

export const buildNotices = () => {
  const app = readJson(join(ROOT, "package.json"));
  const packages = productionPackages();
  const fontAwesome = packages.find(([, pkg]) => pkg.name === "@fortawesome/free-solid-svg-icons")?.[1];
  const ytdlp = pinnedVersion("YTDLP_VERSION");
  const deno = pinnedVersion("DENO_VERSION");

  const header = `
Basketball Video Analyzer ${app.version}
Copyright (C) 2026 Vasco Kaufmann

This program is free software: you can redistribute it and/or modify it under
the terms of the GNU Affero General Public License as published by the Free
Software Foundation, either version 3 or (at your option) any later version.
The full licence is in the LICENSE file next to this one.

This program is distributed in the hope that it will be useful, but WITHOUT ANY
WARRANTY; without even the implied warranty of MERCHANTABILITY or FITNESS FOR A
PARTICULAR PURPOSE. See the GNU Affero General Public License for more details.

Source code: ${SOURCE}

This file lists the third-party software shipped with the app and their
licences. Electron and Chromium carry their own notices in the LICENSE and
LICENSES.chromium.html files at the top of the app folder.

Icons: Font Awesome Free${fontAwesome ? ` ${fontAwesome.version}` : ""} by Fonticons, Inc., https://fontawesome.com.
The icons are licensed under CC BY 4.0 (https://creativecommons.org/licenses/by/4.0/)
and the code under the MIT License. The full terms are in the @fortawesome
sections below.

Fonts: IBM Plex Sans, IBM Plex Mono and Space Grotesk, under the SIL Open Font
License 1.1, shipped through the @fontsource packages listed below.
`;

  return [
    `${header.trim()}\n\n`,
    ffmpegSection(app),
    bundledSection(
      `yt-dlp ${ytdlp} (binary)`,
      `The app runs yt-dlp as a separate program to import YouTube and Vimeo videos.
Release builds ship the standalone yt-dlp executable ${ytdlp} from
https://github.com/yt-dlp/yt-dlp/releases/tag/${ytdlp}. yt-dlp is released
under the Unlicense. The executable bundles Python and other components, whose
licences yt-dlp lists in its THIRD_PARTY_LICENSES.txt, reproduced after the
Unlicense.`,
      ["yt-dlp-LICENSE.txt", "yt-dlp-THIRD_PARTY_LICENSES.txt"]
    ),
    bundledSection(
      `deno ${deno} (binary)`,
      `yt-dlp runs deno to solve YouTube's challenges. Release builds ship the deno
executable ${deno} from https://github.com/denoland/deno/releases/tag/${deno}.`,
      ["deno-LICENSE.md"]
    ),
    `${RULE}\nnpm packages (${packages.length})\n${RULE}\n\n`,
    ...packages.map(([dir, pkg]) => npmSection(dir, pkg)),
  ].join("");
};

export const writeNotices = (out = join(ROOT, "out", "notices", "THIRD-PARTY-NOTICES.txt")) => {
  mkdirSync(dirname(out), { recursive: true });
  writeFileSync(out, buildNotices());
  return out;
};

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  console.log(`Wrote ${writeNotices(process.argv[2] && resolve(process.argv[2]))}`);
}
