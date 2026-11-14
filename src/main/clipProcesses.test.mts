import { test } from "node:test";
import assert from "node:assert/strict";
import { cancelClipProcess } from "./clipProcesses.ts";

const command = () => {
  const handle = { killed: false, kill: () => (handle.killed = true) };
  return handle;
};

test("cancel stops a cut that is still grabbing its thumbnail", () => {
  const thumb = command();
  const processes = new Map([["abc-thumb", thumb]]);
  assert.equal(cancelClipProcess(processes, "abc"), true);
  assert.equal(thumb.killed, true);
  assert.equal(processes.size, 0);
});

test("cancel stops a cut that is encoding", () => {
  const encode = command();
  const processes = new Map([["abc", encode]]);
  assert.equal(cancelClipProcess(processes, "abc"), true);
  assert.equal(encode.killed, true);
});

test("cancel leaves other cuts alone and reports an unknown id", () => {
  const other = command();
  const processes = new Map([["xyz", other]]);
  assert.equal(cancelClipProcess(processes, "abc"), false);
  assert.equal(other.killed, false);
  assert.equal(processes.size, 1);
});
