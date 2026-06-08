// Build a media URL for a local filesystem path. Local media is served by the
// main process through the privileged "clip-media" scheme (see main.ts) so the
// renderer can keep webSecurity enabled instead of loading raw file:// URLs.
export const formatVideoSrc = (filePath: string): string => {
  if (!filePath) return "";
  // Tolerate paths that were already stored as file:// URLs.
  const normalized = filePath.startsWith("file://")
    ? decodeURIComponent(filePath.replace(/^file:\/\/\/?/, "/"))
    : filePath;
  return `clip-media://media/?path=${encodeURIComponent(normalized)}`;
};
