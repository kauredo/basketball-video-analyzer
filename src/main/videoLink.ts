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

// yt-dlp refuses vimeo.com page links without a login but downloads the same
// video from its player URL, so every Vimeo link is rewritten to that.
// Unlisted videos carry a hash, either as a path segment or as ?h=.
const vimeoVideo = (url: URL): string | null => {
  const segments = url.pathname.split("/").filter(Boolean);
  let id: string | undefined;
  let hash = url.searchParams.get("h") ?? undefined;
  if (url.hostname === "player.vimeo.com") {
    if (segments[0] === "video" && /^\d+$/.test(segments[1] ?? "")) id = segments[1];
  } else {
    let at = segments.length - 1;
    while (at >= 0 && !/^\d+$/.test(segments[at])) at--;
    if (at >= 0 && at >= segments.length - 2) {
      id = segments[at];
      const next = segments[at + 1];
      if (next !== undefined) {
        if (!/^[0-9a-f]+$/i.test(next)) return null;
        hash = next;
      }
    }
  }
  if (!id) return null;
  const player = new URL(`https://player.vimeo.com/video/${id}`);
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
