// Pure capture math (scrollPositions, planImages, MAX_DIM, MAX_AREA).
importScripts("lib/capture-math.js");

// ===== Functions injected into the page (run in each frame's context) =====

function getMetrics() {
  const de = document.documentElement;
  const body = document.body;
  const fullHeight = Math.max(
    de.scrollHeight, body ? body.scrollHeight : 0,
    de.offsetHeight, body ? body.offsetHeight : 0,
    de.clientHeight
  );
  const fullWidth = Math.max(
    de.scrollWidth, body ? body.scrollWidth : 0,
    de.offsetWidth, body ? body.offsetWidth : 0,
    de.clientWidth
  );
  return {
    href: location.href,
    title: document.title,
    isTop: window.top === window.self,
    fullHeight,
    fullWidth,
    viewportHeight: window.innerHeight,
    viewportWidth: window.innerWidth,
    dpr: window.devicePixelRatio || 1,
    canScroll: fullHeight > window.innerHeight + 4,
    originalScrollX: window.scrollX,
    originalScrollY: window.scrollY,
  };
}

// Rects (in top-frame CSS px) of every iframe on the main page.
function getIframeRects() {
  return [...document.querySelectorAll("iframe")].map((f) => {
    const r = f.getBoundingClientRect();
    return { src: f.src, x: r.x, y: r.y, w: r.width, h: r.height };
  });
}

// Hide the scrollbar (without freezing scroll) and catalog fixed/sticky nodes.
function beginCapture() {
  window.__fpsState = { fixed: [] };
  const style = document.createElement("style");
  style.id = "__fps_style";
  style.textContent =
    "::-webkit-scrollbar{width:0!important;height:0!important;display:none!important}" +
    "html{scrollbar-width:none!important;-ms-overflow-style:none!important}";
  document.documentElement.appendChild(style);

  document.querySelectorAll("*").forEach((el) => {
    const pos = getComputedStyle(el).position;
    if (pos === "fixed" || pos === "sticky") {
      window.__fpsState.fixed.push({ el, visibility: el.style.visibility });
    }
  });
}

function hideFixed() {
  const s = window.__fpsState;
  if (!s) return;
  for (const f of s.fixed) f.el.style.visibility = "hidden";
}

function scrollToY(y) {
  window.scrollTo({ top: y, left: 0, behavior: "instant" });
  return window.scrollY;
}

// Wait until the current view is actually painted before capturing:
//   - two animation frames (a paint happened after the scroll)
//   - in-viewport images finished decoding (bounded at 1.5s so it never hangs)
//   - plus a user-configurable extra delay for heavy/canvas pages
// executeScript awaits the returned promise, so the capture waits for this.
function waitForRender(extraMs) {
  return new Promise((resolve) => {
    requestAnimationFrame(() =>
      requestAnimationFrame(() => {
        const vh = window.innerHeight || 0;
        const pending = [...document.images].filter((im) => {
          if (im.complete) return false;
          const r = im.getBoundingClientRect();
          return r.width > 0 && r.bottom > 0 && r.top < vh;
        });
        Promise.race([
          Promise.all(pending.map((im) => im.decode().catch(() => {}))),
          new Promise((r) => setTimeout(r, 1500)),
        ]).then(() => setTimeout(resolve, extraMs > 0 ? extraMs : 0));
      })
    );
  });
}

// Find the largest inner scrollable element (Google Docs, Gmail, Notion, dashboards).
// Generic: instead of trusting computed overflow, PROBE each element by nudging its
// scrollTop and checking whether it actually moved. Tags the winner for later calls.
function findScroller() {
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const cands = [];
  document.querySelectorAll("*").forEach((el) => {
    const delta = el.scrollHeight - el.clientHeight;
    if (delta < 40) return;
    const r = el.getBoundingClientRect();
    // Must cover a meaningful chunk of the viewport (so it holds the main content).
    const visW = Math.max(0, Math.min(r.right, vw) - Math.max(r.left, 0));
    const visH = Math.max(0, Math.min(r.bottom, vh) - Math.max(r.top, 0));
    if (visW < vw * 0.3 || visH < vh * 0.3) return;
    // Probe real scrollability (works even when overflow is set via JS/unusual CSS).
    const before = el.scrollTop;
    el.scrollTop = before + 50;
    const moved = el.scrollTop !== before;
    el.scrollTop = before;
    if (moved) cands.push({ el, delta, area: visW * visH });
  });
  if (!cands.length) return null;
  cands.sort((a, b) => b.delta - a.delta || b.area - a.area);
  const best = cands[0].el;
  best.setAttribute("data-fps-scroller", "");
  const r = best.getBoundingClientRect();
  return {
    href: location.href,
    title: document.title,
    fullHeight: best.scrollHeight,
    fullWidth: best.scrollWidth,
    viewportHeight: best.clientHeight,
    viewportWidth: best.clientWidth,
    dpr: window.devicePixelRatio || 1,
    rect: { x: r.x, y: r.y, w: r.width, h: r.height },
    originalScrollTop: best.scrollTop,
    originalScrollX: 0,
    originalScrollY: 0,
  };
}

function scrollElementToY(y) {
  const el = document.querySelector("[data-fps-scroller]");
  if (!el) return 0;
  el.scrollTop = y;
  return el.scrollTop;
}

function getElementMetrics() {
  const el = document.querySelector("[data-fps-scroller]");
  if (!el) return null;
  return {
    fullHeight: el.scrollHeight,
    fullWidth: el.scrollWidth,
    viewportHeight: el.clientHeight,
    viewportWidth: el.clientWidth,
    originalScrollX: 0,
    originalScrollY: 0,
  };
}

function endCapture(originalScrollX, originalScrollY, elementScrollTop) {
  const s = window.__fpsState;
  if (s) {
    for (const f of s.fixed) f.el.style.visibility = f.visibility;
    delete window.__fpsState;
  }
  const style = document.getElementById("__fps_style");
  if (style) style.remove();
  const el = document.querySelector("[data-fps-scroller]");
  if (el) {
    if (elementScrollTop != null) el.scrollTop = elementScrollTop;
    el.removeAttribute("data-fps-scroller");
  } else {
    window.scrollTo(originalScrollX, originalScrollY);
  }
}

// ===== Helpers =====

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const i18n = (k, subs) => chrome.i18n.getMessage(k, subs);

const SETTINGS_DEFAULTS = { format: "png", jpegQuality: 0.92, autoDownload: false, largePage: "split", captureDelay: 150, stabilize: false };
const RATE_FLOOR_MS = 500; // captureVisibleTab is limited to ~2 calls/second

// Tiny thumbnail of a capture, used to cheaply detect when a slice has settled.
function thumbOf(bitmap) {
  const w = 32;
  const h = Math.max(1, Math.round((32 * bitmap.height) / bitmap.width));
  const c = new OffscreenCanvas(w, h);
  const ctx = c.getContext("2d");
  ctx.drawImage(bitmap, 0, 0, w, h);
  return ctx.getImageData(0, 0, w, h).data;
}

async function getSettings() {
  const { settings } = await chrome.storage.sync.get("settings");
  return { ...SETTINGS_DEFAULTS, ...(settings || {}) };
}

// Draw the relevant part of every capture into ctx, shifted by -offsetY.
// geom: { kind, scale, rect, fullH }
function drawCaptures(ctx, captures, geom, offsetY) {
  if (geom.kind !== "window") {
    const r = geom.rect;
    const sx = Math.round(r.x * geom.scale);
    const sy = Math.round(r.y * geom.scale);
    const sw = Math.round(r.w * geom.scale);
    const sliceH = Math.round(r.h * geom.scale);
    for (const c of captures) {
      const destY = Math.round(c.realY * geom.scale) - offsetY;
      const drawH = Math.min(sliceH, geom.fullH - (destY + offsetY));
      if (drawH <= 0) continue;
      ctx.drawImage(c.bitmap, sx, sy, sw, drawH, 0, destY, sw, drawH);
    }
  } else {
    for (const c of captures) {
      ctx.drawImage(c.bitmap, 0, Math.round(c.realY * geom.scale) - offsetY);
    }
  }
}

// Render captures into one or more PNG images, honoring the large-page mode.
// The PLAN (split vs downscale, band sizes, scale factor) comes from the pure,
// unit-tested planImages(); this function just does the canvas work.
// Returns { images: [{dataUrl, width, height}], downscaled, split }.
async function renderImages(captures, geom, largePage) {
  const { fullW, fullH } = geom;
  const plan = planImages(fullW, fullH, largePage);

  if (plan.kind === "split") {
    const images = [];
    for (const band of plan.bands) {
      const canvas = new OffscreenCanvas(fullW, band.height);
      const ctx = canvas.getContext("2d");
      drawCaptures(ctx, captures, geom, band.start);
      const dataUrl = await blobToDataURL(await canvas.convertToBlob({ type: "image/png" }));
      images.push({ dataUrl, width: fullW, height: band.height });
    }
    return { images, downscaled: false, split: true };
  }

  // Single image (with optional downscale factor q).
  const canvas = new OffscreenCanvas(plan.width, plan.height);
  const ctx = canvas.getContext("2d");
  ctx.setTransform(plan.q, 0, 0, plan.q, 0, 0);
  drawCaptures(ctx, captures, geom, 0);
  const dataUrl = await blobToDataURL(await canvas.convertToBlob({ type: "image/png" }));
  return { images: [{ dataUrl, width: plan.width, height: plan.height }], downscaled: plan.kind === "downscale", split: false };
}

async function execTop(tabId, func, args = []) {
  const [res] = await chrome.scripting.executeScript({
    target: { tabId, frameIds: [0] },
    func,
    args,
  });
  return res.result;
}

async function execFrame(tabId, frameId, func, args = []) {
  const [res] = await chrome.scripting.executeScript({
    target: { tabId, frameIds: [frameId] },
    func,
    args,
  });
  return res.result;
}

async function execAllFrames(tabId, func, args = []) {
  const results = await chrome.scripting.executeScript({
    target: { tabId, allFrames: true },
    func,
    args,
  });
  return results.map((r) => ({ frameId: r.frameId, result: r.result }));
}

async function blobToDataURL(blob) {
  const buf = await blob.arrayBuffer();
  const bytes = new Uint8Array(buf);
  let binary = "";
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode.apply(null, bytes.subarray(i, i + chunk));
  }
  return `data:${blob.type};base64,${btoa(binary)}`;
}

function notify(payload) {
  chrome.runtime.sendMessage(payload).catch(() => {});
}

// ===== Pick the scroll target =====
// Priority: top window → scrollable cross-origin iframe → inner scrollable element.

async function pickTarget(tabId, topMetrics) {
  if (topMetrics.canScroll) {
    return { kind: "window", frameId: 0, metrics: topMetrics };
  }

  // 1) Scrollable iframe (e.g. claude.ai design previews).
  const frames = await execAllFrames(tabId, getMetrics);
  const candidates = frames
    .filter((f) => f.result && !f.result.isTop && f.result.canScroll)
    .map((f) => ({ frameId: f.frameId, m: f.result }))
    .sort((a, b) => b.m.fullHeight - a.m.fullHeight);

  if (candidates.length) {
    const best = candidates[0];
    const rects = await execTop(tabId, getIframeRects);
    let origin = "";
    try { origin = new URL(best.m.href).origin; } catch {}

    let rect = null;
    let bestScore = Infinity;
    for (const r of rects) {
      let rOrigin = "";
      try { rOrigin = new URL(r.src).origin; } catch {}
      const sizeDiff = Math.abs(r.w - best.m.viewportWidth) + Math.abs(r.h - best.m.viewportHeight);
      const originMatch = origin && rOrigin === origin ? 0 : 1000;
      const score = sizeDiff + originMatch;
      if (score < bestScore) { bestScore = score; rect = r; }
    }

    const dist = best.m.fullHeight - best.m.viewportHeight;
    if (rect && dist > 100) {
      return { kind: "iframe", frameId: best.frameId, metrics: best.m, rect, topMetrics };
    }
  }

  // 2) Inner scrollable element in the top document (Google Docs, Gmail, Notion…).
  const sc = await execTop(tabId, findScroller);
  if (sc) {
    return { kind: "element", frameId: 0, metrics: sc, rect: sc.rect, topMetrics };
  }

  return { kind: "window", frameId: 0, metrics: topMetrics };
}

// Warm-up pass: scroll through the page to trigger lazy-loaded content,
// then re-measure (height often grows). Capped to avoid infinite feeds.
async function warmUp(tabId, frameId, metrics, scrollFn, metricsFn) {
  notify({ type: "phase", text: i18n("phaseLazy") });
  const step = Math.max(200, Math.floor(metrics.viewportHeight * 0.9));
  let height = metrics.fullHeight;
  let y = 0;
  let guard = 0;
  const MAX_STEPS = 60;
  while (y < height && guard < MAX_STEPS) {
    await execFrame(tabId, frameId, scrollFn, [y]);
    await sleep(120);
    const m = await execFrame(tabId, frameId, metricsFn);
    if (m) height = Math.max(height, m.fullHeight);
    y += step;
    guard++;
  }
  await execFrame(tabId, frameId, scrollFn, [0]);
  await sleep(200);
  return (await execFrame(tabId, frameId, metricsFn)) || metrics;
}

// ===== Orchestration =====

async function captureFullPage() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab) throw new Error(i18n("errNoTab"));
  if (/^(chrome|edge|about|chrome-extension|devtools|view-source):/i.test(tab.url || "")) {
    throw new Error(i18n("errInternal"));
  }

  const settings = await getSettings();

  let topMetrics;
  try {
    topMetrics = await execTop(tab.id, getMetrics);
  } catch (e) {
    throw new Error(i18n("errBlocked"));
  }

  // If the page scrolls inside a cross-origin iframe and we lack broad host
  // access, we can't inject into it. Signal the popup to request permission.
  if (!topMetrics.canScroll) {
    const hasBroad = await chrome.permissions.contains({ origins: ["<all_urls>"] });
    if (!hasBroad) {
      const rects = await execTop(tab.id, getIframeRects);
      let topOrigin = "";
      try { topOrigin = new URL(topMetrics.href).origin; } catch {}
      const vwArea = topMetrics.viewportWidth * topMetrics.viewportHeight;
      const bigCrossIframe = rects.some((r) => {
        let o = "";
        try { o = new URL(r.src).origin; } catch {}
        return o && o !== topOrigin && r.w * r.h > vwArea * 0.4;
      });
      if (bigCrossIframe) {
        const e = new Error(i18n("needPermMsg"));
        e.code = "NEEDS_PERMISSION";
        throw e;
      }
    }
  }

  const target = await pickTarget(tab.id, topMetrics);

  const tId = tab.id;
  const fId = target.frameId;
  const isElement = target.kind === "element";
  const scrollFn = isElement ? scrollElementToY : scrollToY;
  const metricsFn = isElement ? getElementMetrics : getMetrics;

  // Warm-up first so lazy images load and height stabilizes.
  const m = await warmUp(tId, fId, target.metrics, scrollFn, metricsFn);

  await execFrame(tId, fId, beginCapture);

  try {
    const positions = scrollPositions(m.fullHeight, m.viewportHeight);

    const captures = []; // { realY, bitmap }
    let scale = 1; // captured px per CSS px
    let lastCapture = 0;

    // One captureVisibleTab → bitmap, honoring the rate-limit floor + quota retry.
    async function captureOnce() {
      const gap = Date.now() - lastCapture;
      if (gap < RATE_FLOOR_MS) await sleep(RATE_FLOOR_MS - gap);
      let dataUrl;
      try {
        dataUrl = await chrome.tabs.captureVisibleTab(tab.windowId, { format: "png" });
      } catch (e) {
        await sleep(1000); // quota exceeded → back off and retry
        dataUrl = await chrome.tabs.captureVisibleTab(tab.windowId, { format: "png" });
      }
      lastCapture = Date.now();
      return createImageBitmap(await (await fetch(dataUrl)).blob());
    }

    // Capture, and (if stabilize is on) keep recapturing until two consecutive
    // frames are pixel-identical — handles async/canvas rendering (Google Docs).
    async function captureStable() {
      let bmp = await captureOnce();
      if (!settings.stabilize) return bmp;
      let prev = thumbOf(bmp);
      for (let attempt = 1; attempt < STABILIZE_MAX; attempt++) {
        const next = await captureOnce();
        const cur = thumbOf(next);
        if (thumbDiff(prev, cur) <= STABILIZE_THRESHOLD) {
          bmp.close(); // settled → keep the latest frame
          return next;
        }
        bmp.close(); // still changing → discard the older frame and keep going
        bmp = next;
        prev = cur;
      }
      return bmp; // hit the cap → accept the last frame
    }

    for (let i = 0; i < positions.length; i++) {
      if (i === 1) await execFrame(tId, fId, hideFixed);

      const realY = await execFrame(tId, fId, scrollFn, [positions[i]]);
      // Wait for the view to actually paint (frames + images + extra delay).
      await execFrame(tId, fId, waitForRender, [settings.captureDelay]);

      const bitmap = await captureStable();
      scale = bitmap.width / topMetrics.viewportWidth;
      captures.push({ realY, bitmap });

      notify({ type: "progress", current: i + 1, total: positions.length });
    }

    // Full content size in captured px (before any guard).
    // For iframe/element targets, width comes from the target rect (cropped region).
    const fullW = Math.round((target.kind === "window" ? m.fullWidth : target.rect.w) * scale);
    const fullH = Math.round(m.fullHeight * scale);

    notify({ type: "phase", text: i18n("phaseStitch") });
    const geom = { kind: target.kind, scale, rect: target.rect, fullW, fullH };
    const { images, downscaled, split } = await renderImages(captures, geom, settings.largePage);
    for (const c of captures) c.bitmap.close();

    await chrome.storage.local.set({
      lastScreenshot: {
        images,
        title: topMetrics.title || tab.title || "screenshot",
        url: topMetrics.href || tab.url || "",
        mode: target.kind,
        downscaled,
        split,
      },
    });

    await chrome.tabs.create({ url: chrome.runtime.getURL("results.html") });
    return { ok: true, downscaled, split, count: images.length };
  } finally {
    const elementScrollTop = isElement ? (target.metrics.originalScrollTop || 0) : null;
    await execFrame(tId, fId, endCapture, [
      m.originalScrollX || 0,
      m.originalScrollY || 0,
      elementScrollTop,
    ]);
  }
}

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg.type === "captureFullPage") {
    captureFullPage()
      .then((r) => sendResponse(r))
      .catch((e) =>
        sendResponse({
          ok: false,
          error: e.message,
          needsPermission: e.code === "NEEDS_PERMISSION",
        })
      );
    return true;
  }
});

// Exposed so E2E tests can trigger a capture directly in the service worker.
self.captureFullPage = captureFullPage;

// Keyboard shortcut (configurable at chrome://extensions/shortcuts).
chrome.commands.onCommand.addListener((command) => {
  if (command === "capture-full-page") {
    captureFullPage().catch((e) => {
      // Can't prompt for permission without a user gesture → open Options.
      if (e.code === "NEEDS_PERMISSION") chrome.runtime.openOptionsPage();
      else console.error("[FullPageScreenshot]", e.message);
    });
  }
});
