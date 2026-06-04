# Privacy Policy — Full Page Screenshot

_Last updated: 2026-06-04_

**Short version: this extension does not collect, transmit, or sell any data.
Everything happens locally on your device.**

## What the extension does

Full Page Screenshot captures a screenshot of the page you are viewing by
scrolling through it and stitching the pieces together, then opens a result page
where you can annotate, crop, and download the image (PNG, JPEG, or PDF).

## Data handling

- **Screenshots** are created and processed entirely in your browser. The image is
  stored temporarily in your browser's local extension storage
  (`chrome.storage.local`) only so it can be handed to the result/editor page, and
  is replaced by your next capture. It is **never uploaded or sent anywhere**.
- **Settings** (output format, quality, delay, etc.) are stored using Chrome's
  extension storage (`chrome.storage.sync`), which may sync across your own devices
  through your Google account. These are preferences only — no personal data.
- **No analytics, no tracking, no ads, no remote servers.** The extension makes no
  network requests of its own and contains no third-party/remote code.

## Permissions

- **activeTab / scripting** — read the active tab's size and run the capture routine,
  only when you click the icon or press the shortcut.
- **storage / unlimitedStorage** — hold the captured image (which can be large) to
  pass it to the editor, and remember your settings.
- **Host access (`<all_urls>`)** — **optional** and requested on demand only when you
  capture content inside a cross-origin iframe (e.g. an embedded design preview). It
  is not requested for normal pages.

## Data sharing

None. No data is shared with the developer or any third party, because no data
leaves your device.

## Contact

Questions or issues: https://github.com/rodrigoelemesmo/full-page-screenshot/issues
