# Chrome Web Store — Listing copy

Copy/paste-ready content for the store listing. (Internal doc, not shipped.)

## Name
Full Page Screenshot

## Summary (≤132 chars)
Capture the whole page in one shot — scrolls, stitches, and lets you crop, annotate, and export to PNG, JPEG, or PDF.

## Category
Productivity

## Language
English (default). Also localized: Portuguese (Brazil), Spanish.

## Detailed description

Capture an entire web page as a single image — not just the visible part.

Full Page Screenshot scrolls through the page, captures each section, and stitches
them into one tall image. Then it opens a built-in editor so you can crop, annotate,
and save.

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
• Copy straight to the clipboard
• Keyboard shortcut (Alt+Shift+P, configurable) and Cmd/Ctrl+S to save

PRIVATE BY DESIGN
• No tracking, no ads, no remote servers — everything stays on your device
• Installs with minimal permissions; broad access is requested only on demand,
  and only to capture cross-origin iframes

Open source: https://github.com/rodrigoelemesmo/full-page-screenshot

## Single purpose (required field)
Capture a screenshot of the full web page (including content beyond the viewport)
and let the user annotate and export it.

## Permission justifications (required, one per permission)

- **activeTab** — Used only when the user clicks the toolbar icon or presses the
  shortcut, to access the current tab so the page can be measured and captured.
- **scripting** — Injects the routine that measures the page, scrolls it, and waits
  for rendering so the full page can be captured and stitched.
- **storage** — Stores the finished screenshot temporarily to pass it to the result/
  editor page, and remembers the user's settings.
- **unlimitedStorage** — Full-page screenshots can be large; this avoids the default
  storage quota when handing the image to the editor page.
- **host permissions `<all_urls>` (optional)** — Declared as an *optional* permission
  and requested on demand only when the user captures content inside a cross-origin
  iframe. It is not requested for normal pages.

## Remote code
No. The extension contains no remote or third-party code; everything is in the package.

## Data usage (Privacy practices form answers)
- Does this item collect or use any of the listed data types? **No.**
  (Screenshots are created and processed locally and are never transmitted. Settings
  are local preferences synced by Chrome itself.)
- Certifications (check all):
  - ✅ I do not sell or transfer user data to third parties (outside approved use cases)
  - ✅ I do not use or transfer user data for purposes unrelated to the single purpose
  - ✅ I do not use or transfer user data to determine creditworthiness or for lending
- Privacy policy URL:
  https://github.com/rodrigoelemesmo/full-page-screenshot/blob/main/PRIVACY.md

## Store assets checklist
- Store icon: 128×128 (already in the package: icons/icon128.png)
- Screenshots: at least 1, ideally 3–5, at 1280×800 or 640×400 (PNG/JPEG). Suggestions:
  1. The toolbar + a captured page in the editor
  2. An annotated screenshot (arrow + text + redaction)
  3. The options page
  4. A long page result showing the full capture
- Small promo tile (optional): 440×280
- Marquee (optional): 1400×560
