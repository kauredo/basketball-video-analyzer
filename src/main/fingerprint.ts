import { createHash } from "crypto";
import fs from "fs";
import type { Fingerprint } from "./bundleManifest";

export const FINGERPRINT_BYTES = 4 * 1024 * 1024;

const hashRange = (file: string, start: number, end: number): Promise<string> =>
  new Promise((resolve, reject) => {
    const hash = createHash("sha256");
    // An empty range still has to hash nothing; createReadStream treats end -1 as "to the end".
    if (end < start) {
      resolve(hash.digest("hex"));
      return;
    }
    fs.createReadStream(file, { start, end })
      .on("data", chunk => hash.update(chunk))
      .on("error", reject)
      .on("end", () => resolve(hash.digest("hex")));
  });

/**
 * File size plus SHA-256 of the first and last 4 MB, so a multi-GB game video
 * is recognised by reading 8 MB. Two files that differ only in the middle get
 * the same fingerprint; the size check makes that unlikely for real videos.
 */
export const fingerprintFile = async (file: string): Promise<Fingerprint> => {
  const { size } = await fs.promises.stat(file);
  const length = Math.min(size, FINGERPRINT_BYTES);
  const [head, tail] = await Promise.all([
    hashRange(file, 0, length - 1),
    hashRange(file, size - length, size - 1),
  ]);
  return { size, head, tail };
};
