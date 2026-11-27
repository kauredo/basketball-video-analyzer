import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileRangeStream, CHUNK_SIZE } from "./fileStream.ts";

const tempFile = (bytes: number) => {
  const file = path.join(fs.mkdtempSync(path.join(os.tmpdir(), "bva-stream-")), "v.bin");
  const data = Buffer.alloc(bytes);
  for (let i = 0; i < bytes; i++) data[i] = i % 251;
  fs.writeFileSync(file, data);
  return { file, data };
};

const readAll = async (stream: ReadableStream<Uint8Array>) => {
  const parts: Uint8Array[] = [];
  for await (const part of stream as unknown as AsyncIterable<Uint8Array>) parts.push(part);
  return Buffer.concat(parts);
};

test("streams the requested byte range exactly", async () => {
  const { file, data } = tempFile(CHUNK_SIZE * 3 + 17);
  const start = 5;
  const end = CHUNK_SIZE * 2 + 3;
  const got = await readAll(fileRangeStream(file, start, end));
  assert.deepEqual(got, data.subarray(start, end + 1));
});

test("streams a whole file when the range covers it", async () => {
  const { file, data } = tempFile(1000);
  assert.deepEqual(await readAll(fileRangeStream(file, 0, 999)), data);
});

test("reads only a chunk or two ahead of the reader", async () => {
  const { file } = tempFile(CHUNK_SIZE * 40);
  let read = 0;
  const stream = fileRangeStream(file, 0, CHUNK_SIZE * 40 - 1, (n) => (read += n));
  const reader = stream.getReader();
  await reader.read();
  await new Promise((resolve) => setTimeout(resolve, 100));
  assert.ok(read <= CHUNK_SIZE * 2, `read ${read} bytes ahead`);
  await reader.cancel();
});

test("closes the file when the reader cancels", async () => {
  const { file } = tempFile(CHUNK_SIZE * 4);
  const before = fs.readdirSync("/dev/fd").length;
  const reader = fileRangeStream(file, 0, CHUNK_SIZE * 4 - 1).getReader();
  await reader.read();
  await reader.cancel();
  await new Promise((resolve) => setTimeout(resolve, 20));
  assert.equal(fs.readdirSync("/dev/fd").length, before);
});
