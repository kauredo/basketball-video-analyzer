const YOUTUBE_HOSTS = new Set([
  "youtube.com",
  "www.youtube.com",
  "m.youtube.com",
  "music.youtube.com",
  "youtu.be",
]);

// The link is handed to yt-dlp as an argument, so only a YouTube video link
// gets through, always as https. A pasted link without a scheme is accepted.
export const parseYoutubeUrl = (value: string): string | null => {
  const text = value.trim();
  let url: URL;
  try {
    url = new URL(/^[a-z][a-z0-9+.-]*:\/\//i.test(text) ? text : `https://${text}`);
  } catch {
    return null;
  }
  if (!["https:", "http:"].includes(url.protocol)) return null;
  if (!YOUTUBE_HOSTS.has(url.hostname)) return null;
  url.protocol = "https:";
  const isVideo =
    url.hostname === "youtu.be"
      ? url.pathname.length > 1
      : (url.pathname === "/watch" && url.searchParams.has("v")) ||
        /^\/shorts\/[^/]+/.test(url.pathname);
  return isVideo ? url.href : null;
};
