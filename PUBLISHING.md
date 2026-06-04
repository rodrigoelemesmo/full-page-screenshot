# Publishing to the Chrome Web Store

Step-by-step. Items marked **(you)** must be done by you — they need your Google
login, a one-time fee, or screenshots only you can take.

## 0. Developer account — (you)
- Go to the Chrome Web Store Developer Dashboard:
  https://chrome.google.com/webstore/devconsole
- Pay the **one-time US$5** registration fee (required once per Google account).
- Set up the publisher contact email and verify it (required before publishing).

## 1. Build the package
From the repo root:
```bash
npm run zip
```
This produces `dist/full-page-screenshot-v<version>.zip` containing only the runtime
files (no tests, no dev config). Bump `version` in `manifest.json` before each new
upload — the store rejects re-uploads of the same version.

## 2. Create the item — (you)
- Dashboard → **Add new item** → upload the `.zip` from `dist/`.
- The 128px icon is read from the package automatically.

## 3. Store listing — (you, copy from STORE_LISTING.md)
- **Name**, **Summary**, **Description**, **Category** (Productivity), **Language**.
- **Screenshots** (required, ≥1 at 1280×800 or 640×400). Take 3–5:
  1. Toolbar + a captured page in the editor
  2. An annotated capture (arrow + text + redaction)
  3. The options page
  Tip: capture them at exactly 1280×800 so no cropping is needed.
- Optional: small promo tile (440×280), marquee (1400×560).

## 4. Privacy practices — (you, copy from STORE_LISTING.md)
- **Single purpose** statement.
- **Permission justifications** — one per permission (activeTab, scripting, storage,
  unlimitedStorage, optional host access).
- **Data usage**: select **does not collect** any data type; check the three
  certifications.
- **Privacy policy URL**:
  https://github.com/rodrigoelemesmo/full-page-screenshot/blob/main/PRIVACY.md

## 5. Distribution — (you)
- Visibility: **Public** (or Unlisted while you test).
- Regions: all.
- Pricing: **Free**.

## 6. Submit — (you)
- Click **Submit for review**. Review usually takes a few hours to a few days.
- First submissions and broad host permissions can take longer; the `<all_urls>` here
  is *optional*, so reviewers see a minimal default permission set.

## After approval
- Updates: bump `manifest.json` version → `npm run zip` → upload the new zip → submit.
- Watch the dashboard for review feedback (most rejections are about permission
  justifications or a missing/again-needed privacy policy — both are covered above).
