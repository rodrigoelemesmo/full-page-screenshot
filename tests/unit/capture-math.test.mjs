// Unit tests for the pure capture math: how pages of any size are traversed
// and split/downscaled. This is the logic behind "works for various pages".
import { test } from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const { scrollPositions, planImages, thumbDiff, MAX_DIM, MAX_AREA, STABILIZE_THRESHOLD } =
  require("../../lib/capture-math.js");

test("short page (fits viewport) → a single position at 0", () => {
  assert.deepEqual(scrollPositions(800, 1000), [0]);
});

test("exact viewport multiple → no duplicate bottom position", () => {
  assert.deepEqual(scrollPositions(2000, 1000), [0, 1000]);
});

test("non-multiple page → steps by viewport; last step covers the bottom", () => {
  // 2500 tall, 1000 vp → 0,1000,2000. The 2000 clamps to maxScroll (1500) at runtime.
  assert.deepEqual(scrollPositions(2500, 1000), [0, 1000, 2000]);
});

test("the last scroll position reaches the bottom (>= maxScroll, clamps there)", () => {
  for (const [full, vp] of [[3000, 900], [12345, 768], [5000, 1080], [1001, 1000]]) {
    const pos = scrollPositions(full, vp);
    const maxScroll = Math.max(0, full - vp);
    const last = pos[pos.length - 1];
    assert.ok(last >= maxScroll, `last ${last} >= maxScroll ${maxScroll} for ${full}/${vp}`);
    // and the step before the last leaves no gap larger than a viewport
    if (pos.length > 1) assert.ok(maxScroll - pos[pos.length - 2] <= vp);
  }
});

test("zero height never produces an empty plan", () => {
  assert.deepEqual(scrollPositions(0, 1000), [0]);
});

test("normal page → single image, no downscale", () => {
  const p = planImages(1200, 5000, "split");
  assert.equal(p.kind, "single");
  assert.equal(p.q, 1);
  assert.deepEqual([p.width, p.height], [1200, 5000]);
});

test("very tall page in split mode → multiple full-resolution bands", () => {
  const fullW = 1200, fullH = 40000; // exceeds MAX_DIM height
  const p = planImages(fullW, fullH, "split");
  assert.equal(p.kind, "split");
  assert.ok(p.bands.length > 1, "should split into >1 bands");
  // bands tile the full height with no gaps/overlaps
  assert.equal(p.bands[0].start, 0);
  const last = p.bands[p.bands.length - 1];
  assert.equal(last.start + last.height, fullH);
  for (let i = 1; i < p.bands.length; i++) {
    assert.equal(p.bands[i].start, p.bands[i - 1].start + p.bands[i - 1].height);
  }
  // every band is within canvas limits
  for (const b of p.bands) {
    assert.ok(b.height <= MAX_DIM);
    assert.ok(fullW * b.height <= MAX_AREA);
  }
});

test("very tall page in downscale mode → one image scaled to fit", () => {
  const p = planImages(1200, 40000, "downscale");
  assert.equal(p.kind, "downscale");
  assert.ok(p.q < 1);
  assert.ok(p.height <= MAX_DIM, "fits canvas height limit");
  assert.ok(p.width * p.height <= MAX_AREA + 1, "fits area limit");
});

test("too-wide page can't be band-split → falls back to downscale", () => {
  const p = planImages(20000, 3000, "split"); // width > MAX_DIM
  assert.notEqual(p.kind, "split");
  assert.equal(p.kind, "downscale");
  assert.ok(p.width <= MAX_DIM);
});

test("huge area but within dim limits → downscale by area", () => {
  // 16000 x 15000 = 240M > MAX_AREA, both sides < MAX_DIM
  const p = planImages(16000, 15000, "downscale");
  assert.equal(p.kind, "downscale");
  assert.ok(p.width * p.height <= MAX_AREA + 1000);
});

test("thumbDiff: identical buffers → 0 (slice considered settled)", () => {
  const a = new Uint8ClampedArray([10, 20, 30, 255, 40, 50, 60, 255]);
  const b = new Uint8ClampedArray([10, 20, 30, 255, 40, 50, 60, 255]);
  assert.equal(thumbDiff(a, b), 0);
  assert.ok(thumbDiff(a, b) <= STABILIZE_THRESHOLD);
});

test("thumbDiff: tiny noise stays under threshold; big change exceeds it", () => {
  const base = new Uint8ClampedArray(400).fill(120);
  const noisy = Uint8ClampedArray.from(base, (v, i) => (i % 97 === 0 ? v + 3 : v));
  assert.ok(thumbDiff(base, noisy) <= STABILIZE_THRESHOLD, "small noise → settled");
  const changed = new Uint8ClampedArray(400).fill(220);
  assert.ok(thumbDiff(base, changed) > STABILIZE_THRESHOLD, "big change → not settled");
});

test("thumbDiff: mismatched shapes → treated as different", () => {
  assert.equal(thumbDiff(new Uint8ClampedArray(4), new Uint8ClampedArray(8)), 255);
});
