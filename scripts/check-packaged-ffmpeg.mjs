import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { inspectFfmpeg } from "./third-party-notices.mjs";

const target = `out/BasketballVideoAnalyzer-${process.platform}-${process.arch}`;
const resources = join(target, process.platform === "darwin"
  ? "BasketballVideoAnalyzer.app/Contents/Resources"
  : "resources");
const binary = join(resources, process.platform === "win32" ? "ffmpeg.exe" : "ffmpeg");
const { banner } = inspectFfmpeg(binary);
const licence = readFileSync(join(resources, "LICENSE"), "utf8");
assert.match(licence, /Basketball Video Analyzer/);
assert.match(licence, /GNU AFFERO GENERAL PUBLIC LICENSE/);
const notices = readFileSync(join(resources, "THIRD-PARTY-NOTICES.txt"), "utf8");
assert.ok(notices.includes(banner.split("\n")[0]));
assert.ok(notices.includes(`ffmpeg-source-${process.platform}-${process.arch}.tar.gz`));
console.log(`Checked FFmpeg, LICENSE and THIRD-PARTY-NOTICES.txt in ${resources}`);
