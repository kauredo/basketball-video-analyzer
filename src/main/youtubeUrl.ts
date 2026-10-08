const YOUTUBE_HOSTS = new Set([
  "youtube.com",
  "www.youtube.com",
  "m.youtube.com",
  "music.youtube.com",
  "youtu.be",
]);

// The link is handed to yt-dlp as an argument, so only an https YouTube
// video link gets through. A pasted link without a scheme is accepted.
export const parseYoutubeUrl = (value: string): string | null => {
  let url: URL;
  try {
    url = new URL(/^[a-z][a-z0-9+.-]*:/i.test(value) ? value : `https://${value}`);
  } catch {
    return null;
  }
  if (url.protocol !== "https:" || !YOUTUBE_HOSTS.has(url.hostname)) return null;
  const isVideo =
    url.hostname === "youtu.be"
      ? url.pathname.length > 1
      : (url.pathname === "/watch" && url.searchParams.has("v")) ||
        url.pathname.startsWith("/shorts/");
  return isVideo ? url.href : null;
};
