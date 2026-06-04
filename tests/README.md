# Tests

Two layers. The unit tests are fast and need no browser; the E2E tests are the
real proof that capture works across page types.

## Unit tests (`node --test`, no dependencies)

Pure logic only — no DOM, no Chrome APIs.

```bash
npm run test:unit
# or: node --test tests/unit/*.test.mjs
```

- **`capture-math.test.mjs`** — `scrollPositions()` (every page size reaches the
  bottom, no gaps) and `planImages()` (single / downscale / split decisions, band
  tiling, canvas limits). This is the logic that decides behavior per page size.
- **`editor.test.mjs`** — the annotation editor: each tool creates an object,
  undo/redo, select+move, delete, text commit, non-destructive crop, coordinate
  mapping, hit-testing. Runs `editor.js` with tiny canvas/DOM stubs
  (`helpers/dom-stub.mjs`).

## E2E tests (Playwright, real Chromium + the extension)

This is what guarantees "works for various pages". It loads the actual extension,
opens fixture pages covering each archetype, captures them, and asserts the result.

```bash
npm install            # first time
npx playwright install chromium
npm run test:e2e
```

Runs **headful** on purpose — Chrome extensions and `captureVisibleTab` are most
reliable with a visible window.

### The "bottom marker" technique

Every scrollable fixture ends with a **magenta block** (`rgb(255,0,255)`). The test
decodes the stitched screenshot and samples the bottom-center pixel: if it's
magenta, the capture genuinely scrolled to the very end and stitched correctly.

### Fixtures = page archetypes (`tests/fixtures/`)

| Fixture | What it proves |
|---|---|
| `tall.html` | normal window scroll, full height, reaches bottom |
| `short.html` | page that fits the viewport (no scroll) |
| `fixed-header.html` | fixed/sticky header isn't duplicated; full capture |
| `inner-scroll.html` | content scrolls inside an element (Google-Docs-like) |
| `iframe-parent.html` | content inside a same-origin iframe is detected |
| `huge.html` | oversized page splits into multiple full-res images |

### Notes / gotchas

- The spec copies the extension to a temp dir and adds `<all_urls>` so a
  programmatic capture (no user gesture → no `activeTab`) can inject. In real use
  that permission is granted on demand.
- **Cross-origin iframe** (the claude.ai case) isn't covered here because it needs a
  second origin. To add it: run a second static server on another port, point an
  iframe at it, and grant `<all_urls>` (already done in the test build).
- MV3 service workers can suspend; `getSW()` re-fetches the worker each capture.
- `huge.html` is slow (many slices) — hence the 180s per-test timeout.
