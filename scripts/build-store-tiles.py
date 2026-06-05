#!/usr/bin/env python3
"""Build 1280x800 Chrome Web Store screenshot tiles (24-bit PNG, no alpha).
Pretty diagonal gradients, a modern font, and a didactic 'paste anywhere' tile."""
import os
from PIL import Image, ImageDraw, ImageFont, ImageFilter

W, H = 1280, 800
SRC = "store-assets"
OUT = "store-assets/tiles"
os.makedirs(OUT, exist_ok=True)

# ---- modern font (Avenir Next / Avenir / Futura), distinct from the site's sans ----
def find_font(size):
    files = [
        "/System/Library/Fonts/Avenir Next.ttc",
        "/System/Library/Fonts/Avenir.ttc",
        "/System/Library/Fonts/Supplemental/Futura.ttc",
    ]
    cands = []
    for f in files:
        if not os.path.exists(f):
            continue
        for idx in range(0, 16):
            try:
                ft = ImageFont.truetype(f, size, index=idx)
            except Exception:
                break
            fam, sty = ft.getname()
            cands.append((fam, sty, ft))
    def score(c):
        fam, sty, _ = c
        s = 0
        if "Italic" in sty or "Oblique" in sty: s -= 100
        if "Heavy" in sty: s += 30
        elif "Bold" in sty: s += 26
        elif "Demi" in sty or "Semibold" in sty: s += 16
        if "Avenir Next" in fam: s += 10
        elif "Avenir" in fam: s += 8
        elif "Futura" in fam: s += 5
        return s
    cands = [c for c in cands if score(c) > 0]
    if cands:
        cands.sort(key=score, reverse=True)
        return cands[0][2]
    for p in ["/System/Library/Fonts/Supplemental/Arial Bold.ttf"]:
        if os.path.exists(p):
            return ImageFont.truetype(p, size)
    return ImageFont.load_default()

def lerp(a, b, t): return tuple(int(a[i] + (b[i]-a[i])*t) for i in range(3))

def diagonal(c1, c2):
    den = W + H
    table = [lerp(c1, c2, i/den) for i in range(den + 1)]
    img = Image.new("RGB", (W, H))
    img.putdata([table[x+y] for y in range(H) for x in range(W)])
    # soft top-left highlight for depth
    glow = Image.new("L", (W, H), 0)
    ImageDraw.Draw(glow).ellipse([-360, -460, int(W*0.75), int(H*0.75)], fill=70)
    glow = glow.filter(ImageFilter.GaussianBlur(220))
    img.paste((255, 255, 255), (0, 0), glow)
    return img

def rounded_mask(size, radius):
    m = Image.new("L", size, 0)
    ImageDraw.Draw(m).rounded_rectangle([0, 0, size[0]-1, size[1]-1], radius=radius, fill=255)
    return m

def wrap(draw, text, font, max_w):
    words, lines, cur = text.split(), [], ""
    for w in words:
        t = (cur + " " + w).strip()
        if draw.textlength(t, font=font) <= max_w: cur = t
        else: lines.append(cur); cur = w
    if cur: lines.append(cur)
    return lines

def headline(base, text):
    draw = ImageDraw.Draw(base)
    font = find_font(56)
    lines = wrap(draw, text, font, W - 200)
    asc, desc = font.getmetrics()
    line_h = asc + 10  # tight: drop the descender slack below each line
    y = 64
    for ln in lines:
        x = (W - draw.textlength(ln, font=font)) / 2
        draw.text((x, y), ln, font=font, fill=(255, 255, 255))
        y += line_h
    return y  # bottom of headline

def drop_shadow(base, box, radius, blur=26, alpha=120, dy=16):
    x, y, w, h = box
    sh = Image.new("L", (w, h), 0)
    ImageDraw.Draw(sh).rounded_rectangle([0, 0, w-1, h-1], radius=radius, fill=alpha)
    sh = sh.filter(ImageFilter.GaussianBlur(blur))
    base.paste((0, 0, 0), (x, y + dy), sh)

# ---- screenshot tiles (capture / annotate) ----
def build_shot(cfg):
    base = diagonal(cfg["c1"], cfg["c2"])
    y = headline(base, cfg["headline"])
    shot = Image.open(os.path.join(SRC, cfg["img"])).convert("RGB")
    target_w = 820
    shot = shot.resize((target_w, int(shot.height * target_w / shot.width)), Image.LANCZOS)
    sx = (W - target_w) // 2
    sy = int(y) + 30
    drop_shadow(base, (sx, sy, shot.width, shot.height), 18)
    base.paste(shot, (sx, sy), rounded_mask(shot.size, 18))
    base.save(os.path.join(OUT, cfg["out"]))
    print("built", cfg["out"], base.size)

# ---- didactic paste tile (Ctrl + V → image appears in your app) ----
def keycap(draw, x0, cy, label, font):
    """Draw a keycap whose LEFT edge is x0; return its width."""
    tw = draw.textlength(label, font=font)
    asc, desc = font.getmetrics()
    pad = 30
    w = int(tw + pad * 2); h = 92
    x0 = int(x0); y0 = int(cy - h/2)
    draw.rounded_rectangle([x0, y0+7, x0+w, y0+h+7], radius=16, fill=(18, 19, 26))   # 3D base
    draw.rounded_rectangle([x0, y0, x0+w, y0+h], radius=16, fill=(48, 50, 66))       # top face
    draw.rounded_rectangle([x0+4, y0+4, x0+w-4, y0+18], radius=8, fill=(66, 68, 86)) # gloss
    draw.text((x0 + (w - tw)/2, cy - (asc+desc)/2 + 2), label, font=font, fill=(255, 255, 255))
    return w

def build_paste(cfg):
    base = diagonal(cfg["c1"], cfg["c2"])
    draw = ImageDraw.Draw(base)
    headline(base, cfg["headline"])

    # destination "app" card on the right with the pasted screenshot inside
    cw, ch, cx0, cy0 = 520, 470, 690, 300
    drop_shadow(base, (cx0, cy0, cw, ch), 22, blur=34, alpha=110, dy=18)
    card = Image.new("RGB", (cw, ch), (255, 255, 255))
    cd = ImageDraw.Draw(card)
    cd.ellipse([26, 26, 60, 60], fill=(79, 140, 255))               # avatar
    cd.rounded_rectangle([74, 30, 230, 44], radius=7, fill=(60, 62, 80))    # name
    cd.rounded_rectangle([74, 52, 320, 64], radius=6, fill=(208, 212, 224)) # sub
    # the pasted screenshot (top portion), rounded + light border
    paste_img = Image.open(os.path.join(SRC, cfg["paste"])).convert("RGB")
    pw = cw - 52
    paste_img = paste_img.resize((pw, int(paste_img.height * pw / paste_img.width)), Image.LANCZOS)
    crop_h = min(ch - 110, paste_img.height)
    paste_img = paste_img.crop((0, 0, pw, crop_h))
    card.paste(paste_img, (26, 88), rounded_mask(paste_img.size, 12))
    cd.rounded_rectangle([26, 88, 26+pw-1, 88+crop_h-1], radius=12, outline=(228, 230, 240), width=2)
    base.paste(card, (cx0, cy0), rounded_mask((cw, ch), 22))

    # keycaps: Ctrl + V on the left, laid out left→right with a real gap for "+"
    kf = find_font(40)
    pf = find_font(48)
    midy = cy0 + 150
    gap = 26
    wC = draw.textlength("Ctrl", font=kf) + 60
    wV = draw.textlength("V", font=kf) + 60
    wPlus = draw.textlength("+", font=pf)
    total = wC + gap + wPlus + gap + wV
    gx = 280  # group center x
    x = gx - total / 2
    asc, desc = pf.getmetrics()
    x += keycap(draw, x, midy, "Ctrl", kf) + gap
    draw.text((x, midy - (asc + desc) / 2 + 2), "+", font=pf, fill=(255, 255, 255))
    x += wPlus + gap
    keycap(draw, x, midy, "V", kf)
    cap = find_font(26)
    lbl = "paste it"
    draw.text((gx - draw.textlength(lbl, font=cap) / 2, midy + 72), lbl, font=cap, fill=(255, 255, 255))

    # arrow → into the card
    ax0, ax1, ay = 470, 650, midy
    draw.line([(ax0, ay), (ax1, ay)], fill=(255, 255, 255), width=8)
    draw.polygon([(ax1, ay-16), (ax1+24, ay), (ax1, ay+16)], fill=(255, 255, 255))

    base.save(os.path.join(OUT, cfg["out"]))
    print("built", cfg["out"], base.size)

# Pretty diagonal gradients, one hue family each.
build_shot({"c1": (95, 142, 255), "c2": (123, 63, 242),
            "headline": "Capture the whole page — in one click.",
            "img": "01-popup-capture.png", "out": "tile-1-capture.png"})
build_shot({"c1": (55, 214, 150), "c2": (15, 150, 170),
            "headline": "Annotate it, right there.",
            "img": "02-editor-result.png", "out": "tile-2-annotate.png"})
build_paste({"c1": (255, 120, 200), "c2": (123, 63, 242),
             "headline": "Copy, then paste it anywhere.",
             "paste": "02-editor-result.png", "out": "tile-3-paste.png"})
