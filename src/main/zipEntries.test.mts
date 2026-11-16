import { test } from "node:test";
import assert from "node:assert/strict";
import { zipEntries } from "./zipEntries.ts";

test("clips go into their folder, named after the title, keeping the extension", () => {
  assert.deepEqual(
    zipEntries([{ title: "Pick & roll: left", output_path: "/c/a1b2.mp4", folder: "Offense" }]),
    [{ source: "/c/a1b2.mp4", name: "clips/Offense/Pick _ roll_ left.mp4" }],
  );
});

test("same names get a number, ignoring case", () => {
  const names = zipEntries([
    { title: "Drive", output_path: "/c/1.mp4", folder: "Offense" },
    { title: "drive", output_path: "/c/2.mp4", folder: "Offense" },
    { title: "Drive", output_path: "/c/3.mp4", folder: "Offense" },
    { title: "Drive", output_path: "/c/4.mp4", folder: "Defense" },
  ]).map(e => e.name);
  assert.deepEqual(names, [
    "clips/Offense/Drive.mp4",
    "clips/Offense/drive (1).mp4",
    "clips/Offense/Drive (2).mp4",
    "clips/Defense/Drive.mp4",
  ]);
});

test("a title with nothing usable still gets a name", () => {
  assert.equal(
    zipEntries([{ title: "   ", output_path: "/c/x.mov", folder: "Untagged" }])[0].name,
    "clips/Untagged/clip.mov",
  );
});

test("names never climb out of the zip", () => {
  const [entry] = zipEntries([{ title: "../../etc/passwd", output_path: "/c/x.mp4", folder: "A" }]);
  assert.equal(entry.name, "clips/A/______etc_passwd.mp4");
});
