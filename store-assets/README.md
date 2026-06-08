# Store assets

Everything for the Chrome Web Store listing.

- **`listing.md`** — paste-ready copy (title, summary, description, single purpose,
  permission justifications, data-usage answers, privacy policy URL).
- **`tiles/`** — the 1280×800 screenshots to upload under **Global screenshots**.
  24-bit PNG, no alpha.
  - `tile-1-capture.png` — capture (popup over a page)
  - `tile-2-annotate.png` — the annotation editor
  - `tile-3-paste.png` — copy → paste anywhere (Ctrl + V)

## How the tiles are made

`scripts/build-store-tiles.py` draws them **fully synthetically** — a generic,
blurred fake web page in the background with the extension UI (popup, editor
toolbar, annotations, keycaps) crisp on top. No real web page, no third-party
branding, and no "Add to Chrome" button (the earlier rejection was caused by a
screenshot that showed one). Regenerate with:

```bash
python3 scripts/build-store-tiles.py
```
