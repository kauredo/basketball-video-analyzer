import fs from "fs";

export const CHUNK_SIZE = 1024 * 1024;

// A web ReadableStream over bytes start..end (inclusive) of a file, read one
// chunk per pull. Readable.toWeb on Node 18 (Electron 28) counts its buffer in
// chunks, not bytes, so it read whole multi-GB videos into memory and crashed
// the main process with "Array buffer allocation failed".
export const fileRangeStream = (
  file: string,
  start: number,
  end: number,
  onRead?: (bytes: number) => void,
): ReadableStream<Uint8Array> => {
  let handle: fs.promises.FileHandle | undefined;
  let position = start;
  const close = async () => {
    const open = handle;
    handle = undefined;
    await open?.close();
  };

  return new ReadableStream<Uint8Array>(
    {
      async start() {
        handle = await fs.promises.open(file, "r");
      },
      async pull(controller) {
        if (!handle) return;
        const length = Math.min(CHUNK_SIZE, end - position + 1);
        const buffer = Buffer.allocUnsafe(length);
        const { bytesRead } = await handle.read(buffer, 0, length, position);
        onRead?.(bytesRead);
        position += bytesRead;
        if (bytesRead > 0) controller.enqueue(buffer.subarray(0, bytesRead));
        if (bytesRead === 0 || position > end) {
          await close();
          controller.close();
        }
      },
      cancel: close,
    },
    { highWaterMark: 0 },
  );
};
