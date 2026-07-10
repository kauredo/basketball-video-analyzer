#!/usr/bin/env node
// Prints GitHub release download counts per platform, per release.
// No dependencies — plain Node (global fetch, Node >= 18).
// Answers one question: how much demand is there per platform (Windows especially).

const OWNER = "kauredo";
const REPO = "basketball-video-analyzer";
const API = `https://api.github.com/repos/${OWNER}/${REPO}/releases?per_page=100`;

const classify = name => {
  const n = name.toLowerCase();
  // Auto-updater manifests and metadata (RELEASES, latest*.yml, *.blockmap) are
  // fetched every few hours by every install, not user downloads. Bucket them
  // all as "other" first, before the platform checks — otherwise latest.yml /
  // latest-mac.yml fall through to "other" while latest-linux.yml matches the
  // /linux/ check and inflates the Linux count, skewing the platform split.
  if (n === "releases" || n.endsWith(".yml") || n.endsWith(".blockmap")) return "other";
  if (/\.(exe|nupkg|msi)$/.test(n) || /win32|windows|setup/.test(n)) return "windows";
  if (/\.dmg$/.test(n) || (/\.zip$/.test(n) && /darwin|mac/.test(n))) return "mac";
  if (/\.(deb|rpm|appimage)$/.test(n) || /linux/.test(n)) return "linux";
  return "other";
};

const pad = (s, w) => String(s).padEnd(w);
const padl = (s, w) => String(s).padStart(w);

async function main() {
  let res;
  try {
    res = await fetch(API, {
      headers: {
        "User-Agent": "basketball-video-analyzer-stats",
        Accept: "application/vnd.github+json",
      },
    });
  } catch (err) {
    console.error(`Network error reaching GitHub: ${err.message}`);
    process.exit(1);
  }

  if (!res.ok) {
    console.error(`GitHub API returned ${res.status} ${res.statusText}`);
    if (res.status === 403) console.error("Likely the unauthenticated rate limit (60/h). Try again later.");
    process.exit(1);
  }

  const releases = await res.json();
  if (!Array.isArray(releases) || releases.length === 0) {
    console.log("No releases found.");
    process.exit(0);
  }
  if (releases.length === 100) {
    console.warn("Warning: exactly 100 releases returned — pagination not followed, older releases may be missing.\n");
  }

  const totals = { windows: 0, mac: 0, linux: 0, other: 0 };
  const rows = [];
  const unclassified = []; // { tag, name, count }

  for (const rel of releases) {
    const per = { windows: 0, mac: 0, linux: 0, other: 0 };
    for (const asset of rel.assets ?? []) {
      const bucket = classify(asset.name);
      const count = asset.download_count ?? 0;
      per[bucket] += count;
      totals[bucket] += count;
      if (bucket === "other" && count > 0) {
        unclassified.push({ tag: rel.tag_name, name: asset.name, count });
      }
    }
    const date = (rel.published_at ?? "").slice(0, 10);
    rows.push({ tag: rel.tag_name ?? "(untagged)", date, ...per });
  }

  const grand = totals.windows + totals.mac + totals.linux + totals.other;
  const header = `${pad("Release", 16)}${pad("Date", 12)}${padl("Win", 8)}${padl("Mac", 8)}${padl("Linux", 8)}${padl("Other", 8)}${padl("Total", 9)}`;
  console.log(header);
  console.log("-".repeat(header.length));
  for (const r of rows) {
    const total = r.windows + r.mac + r.linux + r.other;
    console.log(
      `${pad(r.tag, 16)}${pad(r.date, 12)}${padl(r.windows, 8)}${padl(r.mac, 8)}${padl(r.linux, 8)}${padl(r.other, 8)}${padl(total, 9)}`
    );
  }
  console.log("-".repeat(header.length));
  console.log(
    `${pad("TOTAL", 28)}${padl(totals.windows, 8)}${padl(totals.mac, 8)}${padl(totals.linux, 8)}${padl(totals.other, 8)}${padl(grand, 9)}`
  );

  const desktop = totals.windows + totals.mac + totals.linux;
  if (desktop > 0) {
    const pct = n => `${((n / desktop) * 100).toFixed(1)}%`;
    console.log(
      `\nPlatform split (of ${desktop} desktop downloads): Windows ${pct(totals.windows)} · macOS ${pct(totals.mac)} · Linux ${pct(totals.linux)}`
    );
  }

  if (unclassified.length > 0) {
    console.log(`\nUnclassified assets (counted under "Other" — refine classify() if a platform is hiding here):`);
    for (const u of unclassified) {
      console.log(`  ${pad(u.tag, 16)} ${pad(u.name, 40)} ${u.count}`);
    }
  }
}

main();
