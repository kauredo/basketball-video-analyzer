import { test, after } from "node:test";
import assert from "node:assert/strict";
import { createHash, randomBytes } from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fingerprintFile } from "./fingerprint.ts";

const FINGERPRINT_BYTES = 4 * 1024 * 1024;

const dir = fs.mkdtempSync(path.join(os.tmpdir(), "bva-fingerprint-"));
after(() => fs.rmSync(dir, { recursive: true, force: true }));

const sha = (bytes: Buffer) => createHash("sha256").update(bytes).digest("hex");
let n = 0;
const write = (bytes: Buffer) => {
  const file = path.join(dir, `f${n++}.bin`);
  fs.writeFileSync(file, bytes);
  return file;
};

test("a file under 8 MB hashes what there is at each end", async () => {
  const bytes = randomBytes(5 * 1024 * 1024 + 7);
  const file = write(bytes);
  const expected = {
    size: bytes.length,
    head: sha(bytes.subarray(0, FINGERPRINT_BYTES)),
    tail: sha(bytes.subarray(bytes.length - FINGERPRINT_BYTES)),
  };
  assert.deepEqual(await fingerprintFile(file), expected);
  assert.deepEqual(await fingerprintFile(file), expected);
});

test("a tiny file and an empty file get the whole file as head and tail", async () => {
  const small = Buffer.from("tiny");
  assert.deepEqual(await fingerprintFile(write(small)), { size: 4, head: sha(small), tail: sha(small) });
  const empty = sha(Buffer.alloc(0));
  assert.deepEqual(await fingerprintFile(write(Buffer.alloc(0))), { size: 0, head: empty, tail: empty });
});

test("a file just over 8 MB hashes exactly the first and last 4 MB", async () => {
  const bytes = randomBytes(2 * FINGERPRINT_BYTES + 1);
  const result = await fingerprintFile(write(bytes));
  assert.deepEqual(result, {
    size: bytes.length,
    head: sha(bytes.subarray(0, FINGERPRINT_BYTES)),
    tail: sha(bytes.subarray(FINGERPRINT_BYTES + 1)),
  });
  assert.deepEqual(await fingerprintFile(write(bytes)), result);
});

test("documented limitation: files that differ only in the middle share a fingerprint, because only the first and last 4 MB are hashed", async () => {
  const bytes = randomBytes(3 * FINGERPRINT_BYTES);
  const other = Buffer.from(bytes);
  other[Math.floor(other.length / 2)] ^= 0xff;
  assert.deepEqual(await fingerprintFile(write(bytes)), await fingerprintFile(write(other)));
});

test("files that differ in the tail do not", async () => {
  const bytes = randomBytes(3 * FINGERPRINT_BYTES);
  const other = Buffer.from(bytes);
  other[other.length - 1] ^= 0xff;
  const [a, b] = [await fingerprintFile(write(bytes)), await fingerprintFile(write(other))];
  assert.equal(a.head, b.head);
  assert.notEqual(a.tail, b.tail);
});
