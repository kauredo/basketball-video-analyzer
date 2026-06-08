import { MEDIA_SCHEME } from "../../shared/media";

// Build a media URL for a local filesystem path. Local media is served by the
// main process through the privileged MEDIA_SCHEME (see main.ts) so the renderer
// can keep webSecurity enabled instead of loading raw file:// URLs.
export const formatVideoSrc = (filePath: string): string => {
  if (!filePath) return "";

  let normalized = filePath;
  // Projects created before the MEDIA_SCHEME switch may have stored video_path
  // as a file:// URL; normalise those back to a plain path. new URL() decodes
  // percent-escapes safely (a raw "%" in a path would throw decodeURIComponent).
  if (filePath.startsWith("file://")) {
    try {
      // new URL() guarantees valid percent-encoding, so this decode is safe.
      normalized = decodeURIComponent(new URL(filePath).pathname);
      // Windows: URL pathname is "/C:/dir/file" — drop the leading slash.
      if (/^\/[A-Za-z]:/.test(normalized)) {
        normalized = normalized.slice(1);
      }
    } catch {
      normalized = filePath;
    }
  }

  return `${MEDIA_SCHEME}://media/?path=${encodeURIComponent(normalized)}`;
};
