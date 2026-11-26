import assert from "node:assert/strict";
import { test } from "node:test";
import {
  draftFor,
  editedValue,
  editKeyAction,
  nextEdit,
  type EditAction,
  type EditTarget,
} from "./inlineEdit.ts";

const writesFor = (actions: EditAction[]): EditTarget[] => {
  let open: EditTarget | null = null;
  const writes: EditTarget[] = [];
  for (const action of actions) {
    const next = nextEdit(open, action);
    open = next.open;
    if (next.write) writes.push(next.write);
  }
  return writes;
};

const target: EditTarget = { id: 7, field: "title" };

test("a second commit (Enter then blur) writes nothing more", () => {
  assert.deepEqual(
    writesFor([{ type: "start", target }, { type: "commit" }, { type: "commit" }]),
    [target],
  );
});

test("Escape then blur writes nothing", () => {
  assert.deepEqual(
    writesFor([{ type: "start", target }, { type: "cancel" }, { type: "commit" }]),
    [],
  );
});

test("a title of only a line break reverts", () => {
  assert.equal(editedValue("title", "\n", "Old"), null);
});

test("a trailing line break on an unchanged title writes nothing", () => {
  assert.equal(editedValue("title", "Old\n", "Old"), null);
});

test("trims a title", () => {
  assert.equal(editedValue("title", "  Drag  ", "Old"), "Drag");
});

test("reverts an empty title", () => {
  assert.equal(editedValue("title", "   ", "Old"), null);
});

test("allows an empty note", () => {
  assert.equal(editedValue("notes", "  ", "was here"), "");
});

test("skips a value equal to the current one", () => {
  assert.equal(editedValue("title", "Old ", "Old"), null);
  assert.equal(editedValue("notes", "", undefined), null);
  assert.equal(editedValue("notes", "", null), null);
});

test("keeps interior line breaks in a note", () => {
  assert.equal(editedValue("notes", "a\nb", ""), "a\nb");
});

test("turns line breaks in a title into spaces", () => {
  assert.equal(editedValue("title", "Q3\nsteal", "x"), "Q3 steal");
});

test("maps keys to commit and cancel", () => {
  assert.equal(editKeyAction("title", "Enter", false), "commit");
  assert.equal(editKeyAction("notes", "Enter", false), "commit");
  assert.equal(editKeyAction("title", "Enter", true), "commit");
  assert.equal(editKeyAction("notes", "Enter", true), null);
  assert.equal(editKeyAction("title", "Escape", false), "cancel");
  assert.equal(editKeyAction("notes", "Escape", false), "cancel");
  assert.equal(editKeyAction("title", "a", false), null);
  assert.equal(editKeyAction("notes", "a", false), null);
});

test("starts a draft from the clip's field", () => {
  assert.equal(draftFor("notes", { title: "t" }), "");
  assert.equal(draftFor("title", { title: "t", notes: "n" }), "t");
});
