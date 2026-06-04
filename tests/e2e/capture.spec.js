// End-to-end tests: load the real extension in Chromium, capture a set of
// page archetypes, and assert the result. The key assertion is the "bottom
// marker" technique — a magenta block at the very end of each scrollable page.
// If it shows up at the bottom of the stitched image, the capture truly
// scrolled to the end.
const { test, expect, chromium } = require("@playwright/test");
const path = require("node:path");
const os = require("node:os");
const fs = require("node:fs");
const http = require("node:http");

const EXT_SRC = path.resolve(__dirname, "../..");
const FIXTURES = path.resolve(__dirname, "../fixtures");

let server, baseURL, context, extDir;

// --- helpers ---------------------------------------------------------------

function startServer(dir) {
  const types = { ".html": "text/html", ".css": "text/css", ".js": "text/javascript" };
  const srv = http.createServer((req, res) => {
    const file = path.join(dir, decodeURIComponent(req.url.split("?")[0]));
    fs.readFile(file, (err, buf) => {
      if (err) { res.statusCode = 404; res.end("not found"); return; }
      res.setHeader("Content-Type", types[path.extname(file)] || "text/plain");
      res.end(buf);
    });
  });
  return new Promise((r) => srv.listen(0, () => r({ srv, port: srv.address().port })));
}

// Copy the extension to a temp dir and add <all_urls> so programmatic captures
// (no user gesture → no activeTab) can inject. In real use this is granted on
// demand; for deterministic tests we declare it up front.
function buildTestExtension() {
  const dest = fs.mkdtempSync(path.join(os.tmpdir(), "fps-ext-"));
  fs.cpSync(EXT_SRC, dest, {
    recursive: true,
    filter: (src) => !/(\/|^)(tests|node_modules|\.git)(\/|$)/.test(src.replace(EXT_SRC, "")),
  });
  const mf = path.join(dest, "manifest.json");
  const m = JSON.parse(fs.readFileSync(mf, "utf8"));
  m.host_permissions = ["<all_urls>"];
  fs.writeFileSync(mf, JSON.stringify(m, null, 2));
  return dest;
}

async function getSW() {
  let sw = context.serviceWorkers().find((w) => w.url().includes("background.js"));
  if (!sw) sw = await context.waitForEvent("serviceworker");
  return sw;
}

// Open a fixture, run a capture, return the stored screenshot object.
async function capture(fixture) {
  const page = await context.newPage();
  await page.goto(`${baseURL}/${fixture}`, { waitUntil: "load" });
  await page.bringToFront();
  await page.waitForTimeout(300);
  const sw = await getSW();
  await sw.evaluate(() => chrome.storage.local.remove("lastScreenshot"));
  await sw.evaluate(() => self.captureFullPage());
  const shot = await sw.evaluate(
    async () => (await chrome.storage.local.get("lastScreenshot")).lastScreenshot
  );
  // Close the fixture + any results tab the capture opened.
  for (const p of context.pages()) {
    if (p !== page && p.url().includes("results.html")) await p.close().catch(() => {});
  }
  await page.close();
  return shot;
}

// Decode the stitched image(s) and read dimensions + the bottom-center pixel.
async function analyze(shot) {
  const probe = await context.newPage();
  const data = await probe.evaluate(async (images) => {
    const load = (src) => new Promise((res) => { const i = new Image(); i.onload = () => res(i); i.src = src; });
    const imgs = await Promise.all(images.map((x) => load(x.dataUrl)));
    const last = imgs[imgs.length - 1];
    const c = document.createElement("canvas");
    c.width = last.naturalWidth; c.height = last.naturalHeight;
    const ctx = c.getContext("2d");
    ctx.drawImage(last, 0, 0);
    const px = (x, y) => Array.from(ctx.getImageData(x, y, 1, 1).data).slice(0, 3);
    return {
      count: imgs.length,
      width: Math.max(...imgs.map((i) => i.naturalWidth)),
      totalH: imgs.reduce((s, i) => s + i.naturalHeight, 0),
      bottom: px(Math.floor(last.naturalWidth / 2), last.naturalHeight - 8),
      top: px(Math.floor(last.naturalWidth / 2), 8),
    };
  }, shot.images);
  await probe.close();
  return data;
}

const isMagenta = ([r, g, b]) => r > 180 && g < 90 && b > 180;

// --- setup -----------------------------------------------------------------

test.beforeAll(async () => {
  const started = await startServer(FIXTURES);
  server = started.srv;
  baseURL = `http://localhost:${started.port}`;
  extDir = buildTestExtension();
  const userDataDir = fs.mkdtempSync(path.join(os.tmpdir(), "fps-profile-"));
  context = await chromium.launchPersistentContext(userDataDir, {
    headless: false, // extensions + captureVisibleTab are most reliable headful
    args: [
      `--disable-extensions-except=${extDir}`,
      `--load-extension=${extDir}`,
      "--no-first-run",
    ],
  });
  await getSW(); // ensure the service worker is up
});

test.afterAll(async () => {
  await context?.close();
  server?.close();
});

// --- tests -----------------------------------------------------------------

test("tall window-scroll page: captures full height + reaches the bottom", async () => {
  const shot = await capture("tall.html");
  expect(shot.images.length).toBe(1);
  expect(shot.split).toBeFalsy();
  const a = await analyze(shot);
  expect(Math.abs(a.totalH - 3000)).toBeLessThan(80);
  expect(isMagenta(a.bottom)).toBe(true); // scrolled all the way down
});

test("short page (fits viewport): single image, succeeds", async () => {
  const shot = await capture("short.html");
  expect(shot.images.length).toBe(1);
  const a = await analyze(shot);
  expect(a.width).toBeGreaterThan(300);
  expect(a.totalH).toBeGreaterThan(100);
});

test("fixed header: full height captured, bottom reached", async () => {
  const shot = await capture("fixed-header.html");
  const a = await analyze(shot);
  expect(Math.abs(a.totalH - 3000)).toBeLessThan(80);
  expect(isMagenta(a.bottom)).toBe(true);
});

test("inner scroll container (Docs-like): scrolls the element, reaches bottom", async () => {
  const shot = await capture("inner-scroll.html");
  const a = await analyze(shot);
  expect(Math.abs(a.totalH - 3000)).toBeLessThan(120);
  expect(isMagenta(a.bottom)).toBe(true);
});

test("same-origin iframe: detects and captures the iframe content", async () => {
  const shot = await capture("iframe-parent.html");
  const a = await analyze(shot);
  expect(Math.abs(a.totalH - 3000)).toBeLessThan(120);
  expect(isMagenta(a.bottom)).toBe(true);
});

test("huge page: splits into multiple full-resolution images, last reaches bottom", async () => {
  const shot = await capture("huge.html");
  expect(shot.split).toBe(true);
  const a = await analyze(shot);
  expect(a.count).toBeGreaterThan(1);
  expect(isMagenta(a.bottom)).toBe(true);
});
