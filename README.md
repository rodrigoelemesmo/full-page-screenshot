# Full Page Screenshot

A Chrome extension (Manifest V3) that captures a **full-page screenshot** by scrolling
to the bottom of the page and stitching the visible slices into a single image.

It also handles pages whose content lives inside a **cross-origin iframe** (e.g.
`claude.ai/design` wireframes), where the top window doesn't scroll.

## Install (unpacked)

1. Open `chrome://extensions`
2. Enable **Developer mode** (top-right)
3. Click **Load unpacked** and select this folder
4. Pin the extension, open any page, click the 📸 icon → **Capture full page**

A new tab opens with the result in an **annotation editor**: choose **PNG / JPEG / PDF**,
**Download** (or `Cmd/Ctrl+S`), and **Copy** (to paste anywhere).

### Editor

The result page is a vector annotation editor — every annotation is a selectable,
movable, editable object with real undo/redo:

- **Tools**: Select, Crop, Arrow, Rectangle, Text, Pencil (freehand), Blur (mosaic redaction)
- **Color** + **thickness**; **font size** for text
- **Undo/Redo** (`Cmd/Ctrl+Z`, `Cmd/Ctrl+Shift+Z`), **Delete** (`Del`/`Backspace`)
- Double-click a text object to edit it; drag handles to resize boxes/arrows
- Crop is non-destructive (cheap to undo); exports flatten the annotations
- Oversized captures split into multiple images skip the editor (download the parts)

> **Permissions:** the extension installs with only `activeTab` + `scripting` +
> `storage` — no scary "read and change all your data on all websites" warning. That
> covers normal pages, same-origin inner-scroll apps (Google Docs, Gmail, Notion), and
> any same-origin content. **Cross-origin iframe capture** (e.g. claude.ai design
> previews) needs the broader `<all_urls>` host permission, which is declared as an
> *optional* permission and requested **on demand**: the first time you capture such a
> page, the popup shows a **Grant access** button. You can also grant/revoke it anytime
> in Options.

### Languages

UI is localized via `_locales/` — **English, Portuguese (pt-BR), and Spanish** — and
follows your Chrome language automatically.

### Keyboard shortcut

Default: **`Alt+Shift+P`** captures the active tab without opening the popup.
Reconfigure it in the **Options** page (gear → *Change shortcut*) or directly at
`chrome://extensions/shortcuts`.

### Options

Open via the **Options** link in the popup. Configure: default format (PNG/JPEG),
JPEG quality, auto-download after capture, and the keyboard shortcut.

> After editing any file, click the **🔄 reload** button on the extension card in
> `chrome://extensions` — otherwise Chrome keeps running the old version.

## How it works

1. **Pick the scroll target** (in priority order):
   - **Top window**, if it scrolls.
   - **Scrollable cross-origin iframe** (e.g. claude.ai design previews) — found by
     injecting `getMetrics` into every frame and matching its rectangle in the top
     window by origin + size.
   - **Inner scrollable element** in the top document (Google Docs `.kix-appview-editor`,
     Gmail, Notion, dashboards). Detection is generic: rather than trusting computed
     `overflow`, it **probes** each large viewport-covering element by nudging its
     `scrollTop` and checking whether it moved. The extension scrolls that element and
     crops each capture to its rectangle.
2. **Warm-up pass.** Scroll through the whole target once to trigger lazy-loaded
   images and let the height stabilize, then re-measure. Capped at 60 steps so it
   doesn't run forever on infinite feeds.
2b. **Render wait (per step).** Before each capture: two animation frames (a paint
   happened), in-viewport images finished decoding (bounded at 1.5s), plus a
   configurable extra delay. Optional **stabilize** mode recaptures a slice until two
   consecutive frames are pixel-identical — for canvas apps (Google Docs) that paint
   asynchronously and expose no "done" signal.
3. **Capture + stitch.** Scroll step by step, call `chrome.tabs.captureVisibleTab`
   at each position (with rate-limit backoff), and draw each slice onto an
   `OffscreenCanvas` at its real scroll offset. For the iframe case, each capture is
   cropped to the iframe's rectangle before stitching.
4. **Canvas guard.** If the full image would exceed safe canvas limits
   (`32767 px` per side or `200M px²`), it's automatically downscaled to fit and
   flagged with a "downscaled" badge.

| File | Role |
|---|---|
| `manifest.json` | MV3 config + permissions (`activeTab`, `scripting`, `tabs`, `storage`, `unlimitedStorage`, `<all_urls>`) |
| `popup.html` / `popup.js` | Trigger button + progress bar |
| `background.js` | Core engine: target detection, warm-up, scroll, capture, stitch |
| `lib/capture-math.js` | Pure, unit-tested capture math (scroll positions, split/downscale plan) |
| `editor.js` | Vector annotation editor (crop, arrow, rect, text, pencil, hide) |
| `results.html` / `results.js` | Preview + download + copy |

## Resilience — honest notes

No scroll-and-stitch tool is 100% resilient. Where this one does well:

- ✅ Normal pages (blogs, docs, landing pages, e-commerce, static dashboards)
- ✅ Lazy-loaded images (handled by the warm-up pass)
- ✅ Very long pages (auto-downscale guard)
- ✅ Content inside a cross-origin iframe (e.g. claude.ai design previews)
- ✅ Inner scroll containers (Google Docs, Gmail, Notion, dashboards) — scrolls the
  element, not the window
- ✅ Fixed/sticky headers (hidden after the first slice to avoid duplicates)

Known limitations (fundamental to the method):

- ❌ **Virtualized feeds** (X/Twitter, LinkedIn, Reddit, huge data grids): items mount
  and unmount during scroll, so slice alignment can drift. Note: scroll-stitch is
  actually the *best available* approach here — it scrolls for real, which mounts the
  items. A DevTools-Protocol (CDP) full-page capture would **not** help, because
  off-screen virtual items don't exist in the DOM and CDP rendering doesn't fire the
  scroll handlers that create them.
- ❌ **Sandboxed iframes** without `allow-scripts`: the browser blocks script injection.
- ❌ **Horizontal scrolling**: only vertical is captured.

## Tests

Two layers — see [`tests/README.md`](tests/README.md):

- **Unit** (`npm run test:unit`, no browser): pure logic — capture math
  (scroll positions, split/downscale) and the annotation editor.
- **E2E** (`npm run test:e2e`, Playwright + real Chromium): loads the extension and
  captures fixture pages covering each archetype (tall, short, fixed-header,
  inner-scroll, iframe, oversized/split), asserting a magenta "bottom marker" appears
  at the end of the stitched image — proving it scrolled to the very bottom.

## Done

- ✅ Configurable keyboard shortcut (`Alt+Shift+P` by default)
- ✅ Options page (default format, JPEG quality, oversized-page mode, auto-download, shortcut)
- ✅ JPEG export + quality (much smaller files on long pages)
- ✅ `Cmd/Ctrl+S` to save, auto-download option
- ✅ **Split oversized pages into multiple full-resolution images** (or downscale — your choice)
- ✅ **PDF export** via a built-in, dependency-free PDF writer (JPEG pages, sliced at 14000px)
- ✅ **Inner scroll containers** (Google Docs, Gmail, Notion) via probe-based detection
- ✅ **On-demand permission** — installs with `activeTab` only; `<all_urls>` is optional
  and requested when you first capture a cross-origin iframe (grant/revoke in Options)
- ✅ **i18n** — English, Portuguese (pt-BR), Spanish via `_locales/`
- ✅ **Annotation editor** — vector objects (crop, arrow, rect, text, pencil, blur),
  select/move/resize/delete, undo/redo; exports flatten annotations

## Future / TODO

- **Editor extras** — ellipse/circle, numbered step badges, line, emoji/stickers.
- **CDP mode (optional, not planned yet).** See discussion below — it would not solve
  virtualized feeds, so it's deliberately deprioritized. A second engine using `chrome.debugger` +
  `Page.captureScreenshot({ captureBeyondViewport: true })` would capture in one shot
  (no stitching seams, no ~2-capture/sec throttle). Trade-offs: shows the yellow
  *"… is debugging this browser"* bar, and it does **not** solve virtualized feeds.
  Decision: **not worth building preemptively** — current use cases (wireframes, docs,
  articles) rarely hit the cases where it would help. Revisit only if a specific real
  page captures poorly.
- Optional JPG/quality export for smaller files on very long pages.
- Keyboard shortcut to trigger capture.
- Detect/support multiple independent scroll containers (currently picks the largest).
