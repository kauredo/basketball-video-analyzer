export interface ZipClip {
  title: string;
  output_path: string;
  /** Folder for the clip, already safe as a file name (safeFolderName). */
  folder: string;
}

export interface ZipEntry {
  source: string;
  name: string;
}

const extension = (file: string) => {
  const match = /\.[^./\\]+$/.exec(file);
  return match ? match[0] : "";
};

/**
 * Where each clip file goes inside the zip: one folder per first category,
 * named after the clip title, unique ignoring case so it unpacks the same on
 * Windows and macOS. Each clip goes in once, unlike the folder export, so a
 * zip meant for sending stays as small as it can.
 */
export const zipEntries = (clips: ZipClip[]): ZipEntry[] => {
  const taken = new Set<string>();
  return clips.map(clip => {
    const title = clip.title.replace(/[^a-zA-Z0-9 \-()]/g, "_").trim() || "clip";
    const ext = extension(clip.output_path);
    let name = `clips/${clip.folder}/${title}${ext}`;
    for (let n = 1; taken.has(name.toLowerCase()); n++) {
      name = `clips/${clip.folder}/${title} (${n})${ext}`;
    }
    taken.add(name.toLowerCase());
    return { source: clip.output_path, name };
  });
};
