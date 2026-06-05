# TODO — after Web Store approval

## Landing page deployment
- [ ] **Host `landing/index.html` on my own domain** (e.g. fullpagescreenshot.<domain>
      or a subpath). It's a single self-contained file — just upload it.
- [ ] **Point the "Add to Chrome" buttons to the Web Store listing.**
      Once the extension is approved it gets a URL like:
      `https://chromewebstore.google.com/detail/<EXTENSION_ID>`
      In `landing/index.html`, the CTA buttons are currently inert `<button>`s.
      Replace them with links to that URL:
      - nav button: `class="btn navcta"` → wrap/replace with `<a class="btn navcta" href="STORE_URL">`
      - hero button: `＋ Add to Chrome — it's free`
      - CTA band button: `＋ Add to Chrome — it's free`
      (3 spots total — search for "Add to Chrome".)
- [ ] Add the landing URL as the **Website** field in the Web Store listing, and
      keep the GitHub link in the footer.

## Nice-to-have (later)
- [ ] Stronger tile 2: capture an editor screenshot that actually shows an arrow +
      a redaction, then re-run `python3 scripts/build-store-tiles.py`.
- [ ] Editor extras: ellipse/circle, numbered step badges, line, emoji/stickers.
