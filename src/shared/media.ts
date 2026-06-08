// Custom scheme used to serve local media (clips, thumbnails, source video) to
// the renderer without disabling webSecurity. Shared by the main process
// (protocol registration + handler) and the renderer (URL building) so the two
// sides can never drift.
export const MEDIA_SCHEME = "clip-media";
