import assert from "node:assert/strict";
import { test } from "node:test";
import {
  BOTTOM_MAX,
  BOTTOM_MIN,
  INITIAL_PRESET_STATE,
  LAYOUT_PRESETS,
  LAYOUT_PRESET_IDS,
  parsePresetState,
  presetLayoutFor,
  presetReducer,
  SIDE_MAX,
  SIDE_MIN,
} from "./layoutPresets.ts";

const BOARD = { width: 1440, height: 840 };
const SMALL = { width: 1280, height: 712 };

test("each preset at the board size returns its own values", () => {
  for (const id of LAYOUT_PRESET_IDS) {
    assert.deepEqual(presetLayoutFor(id, BOARD), LAYOUT_PRESETS[id]);
  }
});

test("study clamps its bottom to 252 at 1280x712; tag and scout do not change", () => {
  assert.equal(presetLayoutFor("study", SMALL).bottomPanelHeight, 252);
  assert.equal(presetLayoutFor("study", SMALL).sidePanelWidth, 360);
  assert.deepEqual(presetLayoutFor("tag", SMALL), LAYOUT_PRESETS.tag);
  assert.deepEqual(presetLayoutFor("scout", SMALL), LAYOUT_PRESETS.scout);
});

test("every preset's bottom is 200 at the minimum window height", () => {
  for (const id of LAYOUT_PRESET_IDS) {
    assert.equal(presetLayoutFor(id, { width: 1280, height: 612 }).bottomPanelHeight, 200);
  }
});

test("a narrow main clamps tag's side to the drag floor", () => {
  assert.equal(presetLayoutFor("tag", { width: 900, height: 840 }).sidePanelWidth, 280);
});

test("study's 360 side is clamped once main is under 1000 wide", () => {
  assert.equal(presetLayoutFor("study", { width: 960, height: 840 }).sidePanelWidth, 320);
  assert.equal(presetLayoutFor("study", { width: 1000, height: 840 }).sidePanelWidth, 360);
});

test("at and below a 919 main every preset stays inside the drag ranges and the window", () => {
  for (const width of [919, 900, 700, 400]) {
    for (const height of [612, 500, 300]) {
      for (const id of LAYOUT_PRESET_IDS) {
        const layout = presetLayoutFor(id, { width, height });
        assert.ok(layout.sidePanelWidth >= SIDE_MIN && layout.sidePanelWidth <= SIDE_MAX, `${id} side at ${width}`);
        assert.ok(layout.bottomPanelHeight >= BOTTOM_MIN && layout.bottomPanelHeight <= BOTTOM_MAX, `${id} bottom at ${height}`);
        // The drag floor wins over the window only when the window is narrower than the floor.
        assert.ok(layout.sidePanelWidth <= Math.max(SIDE_MIN, width), `${id} side wider than main at ${width}`);
      }
    }
  }
  assert.equal(presetLayoutFor("study", { width: 919, height: 840 }).sidePanelWidth, 280);
});

test("scout has the widest film column and the shortest bottom", () => {
  for (const main of [BOARD, SMALL]) {
    const scout = presetLayoutFor("scout", main);
    for (const id of ["tag", "study"] as const) {
      const other = presetLayoutFor(id, main);
      assert.ok(main.width - scout.sidePanelWidth > main.width - other.sidePanelWidth);
      assert.ok(scout.bottomPanelHeight <= other.bottomPanelHeight);
    }
  }
});

test("an unusable main size still gives values inside the drag ranges", () => {
  for (const id of LAYOUT_PRESET_IDS) {
    const layout = presetLayoutFor(id, { width: 0, height: NaN });
    assert.ok(layout.sidePanelWidth >= 280 && layout.sidePanelWidth <= 600);
    assert.ok(layout.bottomPanelHeight >= 200 && layout.bottomPanelHeight <= 600);
    assert.equal(layout.sidePanelWidth, LAYOUT_PRESETS[id].sidePanelWidth);
  }
});

test("apply from the initial state selects the preset unedited", () => {
  assert.deepEqual(presetReducer(INITIAL_PRESET_STATE, { type: "apply", id: "scout" }), { selected: "scout", edited: false });
});

test("a manual change after apply marks it edited and keeps it selected", () => {
  const applied = presetReducer(INITIAL_PRESET_STATE, { type: "apply", id: "tag" });
  assert.deepEqual(presetReducer(applied, { type: "manualChange" }), { selected: "tag", edited: true });
});

test("applying the same preset after an edit clears the mark", () => {
  const edited = { selected: "study" as const, edited: true };
  assert.deepEqual(presetReducer(edited, { type: "apply", id: "study" }), { selected: "study", edited: false });
});

test("applying a different preset switches and clears the mark", () => {
  const edited = { selected: "study" as const, edited: true };
  assert.deepEqual(presetReducer(edited, { type: "apply", id: "scout" }), { selected: "scout", edited: false });
});

test("a manual change with nothing selected returns the same object", () => {
  const prev = INITIAL_PRESET_STATE;
  const next = presetReducer(prev, { type: "manualChange" });
  assert.equal(next, prev);
  const edited = { selected: "tag" as const, edited: true };
  assert.equal(presetReducer(edited, { type: "manualChange" }), edited);
});

test("parsePresetState keeps valid state and rejects junk", () => {
  assert.deepEqual(parsePresetState({ selected: "scout", edited: true }), { selected: "scout", edited: true });
  assert.deepEqual(parsePresetState({ selected: "tag", edited: false }), { selected: "tag", edited: false });
  for (const junk of [null, "scout", { selected: "review" }, { selected: "tag", edited: "yes" }, undefined, 3]) {
    assert.deepEqual(parsePresetState(junk), INITIAL_PRESET_STATE);
  }
  assert.deepEqual(parsePresetState({ selected: null, edited: true }), { selected: null, edited: false });
});

test("parsePresetState reads back what JSON.stringify wrote", () => {
  for (const id of LAYOUT_PRESET_IDS) {
    for (const edited of [false, true]) {
      const state = { selected: id, edited };
      assert.deepEqual(parsePresetState(JSON.parse(JSON.stringify(state))), state);
    }
  }
  assert.deepEqual(parsePresetState(JSON.parse(JSON.stringify(INITIAL_PRESET_STATE))), INITIAL_PRESET_STATE);
});
