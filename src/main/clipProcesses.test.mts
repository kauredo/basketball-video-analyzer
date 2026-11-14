import { test } from "node:test";
import assert from "node:assert/strict";
import { ClipCuts } from "./clipProcesses.ts";

const command = () => {
  const handle = { killed: false, kill: () => (handle.killed = true) };
  return handle;
};

test("cancel stops a cut that is still grabbing its thumbnail", () => {
  const cuts = new ClipCuts();
  const thumb = command();
  cuts.start("abc");
  cuts.track("abc", "thumb", thumb);
  assert.equal(cuts.cancel("abc"), true);
  assert.equal(thumb.killed, true);
});

test("cancel stops a cut that is encoding", () => {
  const cuts = new ClipCuts();
  const encode = command();
  cuts.start("abc");
  cuts.track("abc", "encode", encode);
  assert.equal(cuts.cancel("abc"), true);
  assert.equal(encode.killed, true);
});

test("a cancel between the two steps is seen by the cut and kills the encode when it starts", () => {
  const cuts = new ClipCuts();
  cuts.start("abc");
  cuts.track("abc", "thumb", command());
  cuts.untrack("abc", "thumb");
  assert.equal(cuts.cancel("abc"), true);
  assert.equal(cuts.isCancelled("abc"), true);
  const encode = command();
  cuts.track("abc", "encode", encode);
  assert.equal(encode.killed, true);
});

test("cancel reports an id with no cut in progress and leaves other cuts alone", () => {
  const cuts = new ClipCuts();
  const other = command();
  cuts.start("xyz");
  cuts.track("xyz", "encode", other);
  assert.equal(cuts.cancel("abc"), false);
  assert.equal(other.killed, false);
});

test("a finished cut can no longer be cancelled", () => {
  const cuts = new ClipCuts();
  cuts.start("abc");
  cuts.finish("abc");
  assert.equal(cuts.cancel("abc"), false);
  assert.equal(cuts.isCancelled("abc"), false);
});
