const YOUTUBE_HOSTS = new Set([
  "youtube.com",
  "www.youtube.com",
  "m.youtube.com",
  "music.youtube.com",
  "youtu.be",
]);

const VIMEO_HOSTS = new Set(["vimeo.com", "www.vimeo.com", "player.vimeo.com"]);

const youtubeVideo = (url: URL): string | null => {
  const isVideo =
    url.hostname === "youtu.be"
      ? url.pathname.length > 1
      : (url.pathname === "/watch" && url.searchParams.has("v")) ||
        /^\/shorts\/[^/]+/.test(url.pathname);
  return isVideo ? url.href : null;
};

// The Vimeo link shapes that point at one video. Showcases and albums also
// end in a number, but it is not a video id, so they are refused.
const VIMEO_PAGE_PATHS = [
  /^\/(\d+)(?:\/([0-9a-f]+))?\/?$/i, // /ID and /ID/HASH (unlisted)
  /^\/channels\/[^/]+\/(\d+)\/?$/,
  /^\/groups\/[^/]+\/videos\/(\d+)\/?$/,
];
const VIMEO_PLAYER_PATH = /^\/video\/(\d+)\/?$/;

// yt-dlp refuses vimeo.com page links without a login but downloads the same
// video from its player URL, so every Vimeo link is rewritten to that.
// Unlisted videos carry a hash, either as a path segment or as ?h=.
const vimeoVideo = (url: URL): string | null => {
  const patterns = url.hostname === "player.vimeo.com" ? [VIMEO_PLAYER_PATH] : VIMEO_PAGE_PATHS;
  const match = patterns.map(pattern => url.pathname.match(pattern)).find(Boolean);
  if (!match) return null;
  const hash = match[2] ?? url.searchParams.get("h");
  const player = new URL(`https://player.vimeo.com/video/${match[1]}`);
  if (hash && /^[0-9a-f]+$/i.test(hash)) player.searchParams.set("h", hash);
  return player.href;
};

// The link is handed to yt-dlp as an argument, so only a YouTube or Vimeo
// video link gets through, always as https. A link without a scheme is
// accepted.
export const parseVideoLink = (value: string): string | null => {
  const text = value.trim();
  let url: URL;
  try {
    url = new URL(/^[a-z][a-z0-9+.-]*:\/\//i.test(text) ? text : `https://${text}`);
  } catch {
    return null;
  }
  if (!["https:", "http:"].includes(url.protocol)) return null;
  url.protocol = "https:";
  if (YOUTUBE_HOSTS.has(url.hostname)) return youtubeVideo(url);
  if (VIMEO_HOSTS.has(url.hostname)) return vimeoVideo(url);
  return null;
};
