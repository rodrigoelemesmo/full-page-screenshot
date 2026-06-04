// Pure capture math — no DOM, no Chrome APIs. Shared by the service worker
// (via importScripts) and unit tests (via require). This is the logic that
// decides how a page of any size is traversed and assembled.

const MAX_DIM = 16384;        // safe max canvas side across browsers
const MAX_AREA = 200_000_000; // safe max canvas area (px²)

// Scroll offsets to visit so the whole content (incl. the exact bottom) is captured.
function scrollPositions(fullHeight, viewportHeight) {
  const positions = [];
  for (let y = 0; y < fullHeight; y += viewportHeight) positions.push(y);
  if (positions.length === 0) return [0];
  const maxScroll = Math.max(0, fullHeight - viewportHeight);
  if (positions[positions.length - 1] < maxScroll) positions.push(maxScroll);
  return positions;
}

// Decide how to emit the final image(s) given the full content size in captured px.
//   mode: "split" (preserve resolution, multiple images) | "downscale" (one image)
// Returns one of:
//   { kind: "single" }
//   { kind: "downscale", q, width, height }
//   { kind: "split", bands: [{ start, height }, ...] }
function planImages(fullW, fullH, mode, maxDim = MAX_DIM, maxArea = MAX_AREA) {
  const tooWide = fullW > maxDim;
  const tooBig = tooWide || fullH > maxDim || fullW * fullH > maxArea;

  if (tooBig && mode === "split" && !tooWide) {
    const bandH = Math.max(1, Math.min(maxDim, Math.floor(maxArea / fullW)));
    const bands = [];
    for (let start = 0; start < fullH; start += bandH) {
      bands.push({ start, height: Math.min(bandH, fullH - start) });
    }
    return { kind: "split", bands };
  }

  let q = Math.min(1, maxDim / fullW, maxDim / fullH);
  if (fullW * fullH * q * q > maxArea) q = Math.min(q, Math.sqrt(maxArea / (fullW * fullH)));
  return {
    kind: q < 1 ? "downscale" : "single",
    q,
    width: Math.max(1, Math.round(fullW * q)),
    height: Math.max(1, Math.round(fullH * q)),
  };
}

// ---- stabilization (for canvas pages that paint asynchronously) ----
const STABILIZE_MAX = 4;       // max captures per slice while waiting for it to settle
const STABILIZE_THRESHOLD = 2; // mean per-channel abs diff below which two frames are "equal"

// Mean absolute per-channel difference between two equal-length pixel buffers.
// Returns a large value if shapes differ. 0 = identical.
function thumbDiff(a, b) {
  if (!a || !b || a.length !== b.length) return 255;
  let sum = 0;
  for (let i = 0; i < a.length; i++) sum += Math.abs(a[i] - b[i]);
  return sum / a.length;
}

if (typeof module !== "undefined" && module.exports) {
  module.exports = {
    scrollPositions, planImages, thumbDiff,
    MAX_DIM, MAX_AREA, STABILIZE_MAX, STABILIZE_THRESHOLD,
  };
}
