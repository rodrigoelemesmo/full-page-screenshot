# Web Store listing — paste-ready

Everything to fill the Chrome Web Store form, kept next to the screenshots.

## Title
Full Page Screenshot

## Summary (≤132 chars)
Capture the whole page in one shot — scrolls, stitches, and lets you crop, annotate, and export to PNG, JPEG, or PDF.

## Category
Productivity

## Description (paste into the Description field)

Capture an entire web page as a single image — not just the visible part.

Full Page Screenshot scrolls through the page, captures each section, and stitches them into one tall image. Then it opens a built-in editor so you can crop, annotate, and save.

WHAT MAKES IT WORK EVERYWHERE
• Normal pages, long articles, and dashboards
• Pages that scroll inside an element (Google Docs, Gmail, Notion, web apps)
• Content inside cross-origin iframes (e.g. embedded design previews)
• Lazy-loaded images — it waits for them to render
• Very long pages — split into multiple full-resolution images, or fit one image

ANNOTATION EDITOR
• Crop (non-destructive)
• Arrow, rectangle, free-hand pencil, and text
• Hide/redact sensitive values (pixelate)
• Color, thickness, undo/redo

EXPORT
• PNG, JPEG (smaller files), or PDF
• Copy straight to the clipboard — then paste it anywhere
• Keyboard shortcut (Alt+Shift+P, configurable) and Cmd/Ctrl+S to save

PRIVATE BY DESIGN
• No tracking, no ads, no remote servers — everything stays on your device
• Installs with minimal permissions; broad access is requested only on demand, and only to capture cross-origin iframes

Open source: https://github.com/rodrigoelemesmo/full-page-screenshot

## Single purpose (required field)
Capture a screenshot of the full web page (including content beyond the viewport) and let the user annotate and export it.

## Permission justifications (one per permission)
- activeTab — Used only when the user clicks the toolbar icon or presses the shortcut, to access the current tab so the page can be measured and captured.
- scripting — Injects the routine that measures the page, scrolls it, and waits for rendering so the full page can be captured and stitched.
- storage — Stores the finished screenshot temporarily to pass it to the result/editor page, and remembers the user's settings.
- unlimitedStorage — Full-page screenshots can be large; this avoids the default storage quota when handing the image to the editor page.
- host permissions <all_urls> (optional) — Optional permission, requested on demand only when the user captures content inside a cross-origin iframe. Not requested for normal pages.

## Remote code
No. The extension contains no remote or third-party code; everything is in the package.

## Data usage (privacy practices form)
- Collects or uses any listed data type? NO. (Screenshots are created and processed locally and never transmitted; settings are local preferences synced by Chrome itself.)
- Certify: ✅ not sold/transferred to third parties · ✅ not used for unrelated purposes · ✅ not used for creditworthiness/lending.
- Privacy policy URL: https://github.com/rodrigoelemesmo/full-page-screenshot/blob/main/PRIVACY.md

## Screenshots (Global screenshots, 1280×800)
- tiles/tile-1-capture.png
- tiles/tile-2-annotate.png
- tiles/tile-3-paste.png

## Website (optional, after deploying the landing)
Your landing page URL — see TODO.md.
