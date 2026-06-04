// Unit tests for the annotation editor's logic (geometry, tools, history, crop).
// Runs under `node --test` with DOM/canvas stubs — no browser needed.
import { test } from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { setupDom, makeCanvas, makeImage } from "../helpers/dom-stub.mjs";

setupDom();
const require = createRequire(import.meta.url);
const { FpsEditor } = require("../../editor.js");

function newEditor() {
  return new FpsEditor(makeCanvas(), makeImage(1000, 2000), () => {});
}
// A pointer-event-like object (includes preventDefault, used by the text tool).
const ev = (x, y) => ({ clientX: x, clientY: y, preventDefault() {} });
// Simulate a drag with the given tool.
function drag(ed, tool, x1, y1, x2, y2) {
  ed.setTool(tool);
  ed._onDown(ev(x1, y1));
  ed._onMove(ev(x2, y2));
  ed._onUp();
}

test("canvas matches the base image size", () => {
  const ed = newEditor();
  assert.equal(ed.canvas.width, 1000);
  assert.equal(ed.canvas.height, 2000);
});

test("each drawing tool creates one object", () => {
  const ed = newEditor();
  drag(ed, "rect", 10, 10, 110, 130);
  drag(ed, "arrow", 50, 50, 200, 80);
  drag(ed, "pencil", 5, 5, 60, 90);
  drag(ed, "blur", 300, 300, 450, 400);
  assert.deepEqual(ed.objects.map((o) => o.type), ["rect", "arrow", "pencil", "blur"]);
});

test("a near-zero drag is discarded (no accidental dots)", () => {
  const ed = newEditor();
  ed.setTool("rect");
  ed._onDown(ev(10, 10));
  ed._onMove(ev(11, 11));
  ed._onUp();
  assert.equal(ed.objects.length, 0);
});

test("undo / redo restore object count", () => {
  const ed = newEditor();
  drag(ed, "rect", 10, 10, 110, 130);
  drag(ed, "arrow", 50, 50, 200, 80);
  assert.equal(ed.objects.length, 2);
  ed.undo();
  assert.equal(ed.objects.length, 1);
  ed.undo();
  assert.equal(ed.objects.length, 0);
  ed.redo();
  assert.equal(ed.objects.length, 1);
});

test("select + move mutates the object position", () => {
  const ed = newEditor();
  drag(ed, "rect", 40, 40, 140, 140);
  const before = JSON.stringify(ed.objects[0]);
  ed.setTool("select");
  ed._onDown(ev(60, 60)); // inside rect
  ed._onMove(ev(90, 100));
  ed._onUp();
  assert.notEqual(JSON.stringify(ed.objects[0]), before);
  assert.equal(ed.objects[0].x, 70); // 40 + (90-60)
});

test("delete removes the selected object", () => {
  const ed = newEditor();
  drag(ed, "rect", 40, 40, 140, 140);
  ed.setTool("select");
  ed._onDown(ev(60, 60));
  ed._onUp();
  assert.ok(ed.hasSelection());
  ed.deleteSelected();
  assert.equal(ed.objects.length, 0);
});

test("text commit adds a text object; empty text does not", () => {
  const ed = newEditor();
  ed.setTool("text");
  ed._onDown(ev(100, 100));
  ed.textInput.input.value = "Hello";
  ed._commitText();
  assert.equal(ed.objects.at(-1).type, "text");
  assert.equal(ed.objects.at(-1).text, "Hello");

  ed.setTool("text");
  ed._onDown(ev(200, 200));
  ed.textInput.input.value = "   ";
  ed._commitText();
  assert.equal(ed.objects.filter((o) => o.type === "text").length, 1);
});

test("crop is non-destructive: resizes canvas and is undoable", () => {
  const ed = newEditor();
  ed.setTool("crop");
  ed._onDown(ev(100, 100));
  ed._onMove(ev(600, 900));
  ed.applyCrop();
  assert.deepEqual(ed.crop, { x: 100, y: 100, w: 500, h: 800 });
  assert.equal(ed.canvas.width, 500);
  assert.equal(ed.canvas.height, 800);
  ed.undo();
  assert.deepEqual(ed.crop, { x: 0, y: 0, w: 1000, h: 2000 });
});

test("pointer coords account for the active crop offset", () => {
  const ed = newEditor();
  ed.setTool("crop");
  ed._onDown(ev(100, 100));
  ed._onMove(ev(600, 900));
  ed.applyCrop();
  // After crop, a click at canvas (10,10) maps to image (110,110).
  drag(ed, "rect", 10, 10, 60, 60);
  const r = ed.objects.at(-1);
  assert.equal(r.x, 110);
  assert.equal(r.y, 110);
});

test("exportCanvas matches the current crop dimensions", () => {
  const ed = newEditor();
  ed.setTool("crop");
  ed._onDown(ev(0, 0));
  ed._onMove(ev(400, 700));
  ed.applyCrop();
  const out = ed.exportCanvas();
  assert.equal(out.width, 400);
  assert.equal(out.height, 700);
});

test("hit-testing selects the topmost object under the point", () => {
  const ed = newEditor();
  drag(ed, "rect", 0, 0, 200, 200);
  drag(ed, "rect", 50, 50, 250, 250); // overlaps, drawn later → on top
  ed.setTool("select");
  ed._onDown(ev(120, 120));
  ed._onUp();
  assert.equal(ed.selectedId, ed.objects[1].id);
});
