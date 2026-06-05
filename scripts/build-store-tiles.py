#!/usr/bin/env python3
"""Build 1280x800 Chrome Web Store screenshot tiles from the source captures:
a colored panel + headline + the screenshot peeking from the bottom (like the
reference listings). Outputs 24-bit PNGs (no alpha) to store-assets/tiles/."""
import os
from PIL import Image, ImageDraw, ImageFont, ImageFilter

W, H = 1280, 800
SRC = "store-assets"
OUT = "store-assets/tiles"
os.makedirs(OUT, exist_ok=True)

FONT_CANDIDATES = [
    "/System/Library/Fonts/Supplemental/Arial Bold.ttf",
    "/Library/Fonts/Arial Bold.ttf",
    "/System/Library/Fonts/HelveticaNeue.ttc",
    "/System/Library/Fonts/Supplemental/Helvetica.ttc",
]
def load_font(size):
    for p in FONT_CANDIDATES:
        if os.path.exists(p):
            try: return ImageFont.truetype(p, size)
            except Exception: pass
    return ImageFont.load_default()

def lerp(a, b, t): return tuple(int(a[i] + (b[i]-a[i])*t) for i in range(3))

def gradient(top, bot):
    img = Image.new("RGB", (W, H))
    d = ImageDraw.Draw(img)
    for y in range(H):
        d.line([(0, y), (W, y)], fill=lerp(top, bot, y / H))
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

def build(cfg):
    base = gradient(cfg["top"], cfg["bot"])
    draw = ImageDraw.Draw(base)

    # headline
    font = load_font(54)
    lines = wrap(draw, cfg["headline"], font, W - 200)
    line_h = font.getbbox("Ag")[3] + 12
    y = 70
    for ln in lines:
        x = (W - draw.textlength(ln, font=font)) / 2
        draw.text((x+1, y+1), ln, font=font, fill=(0, 0, 0, 60))  # subtle shadow
        draw.text((x, y), ln, font=font, fill=(255, 255, 255))
        y += line_h

    # screenshot, scaled to a target width, peeking from the bottom
    shot = Image.open(os.path.join(SRC, cfg["img"])).convert("RGB")
    target_w = 820
    scale = target_w / shot.width
    shot = shot.resize((target_w, int(shot.height * scale)), Image.LANCZOS)
    sx = (W - target_w) // 2
    sy = y + 26
    radius = 18

    # drop shadow
    sh = Image.new("L", (shot.width, shot.height), 0)
    ImageDraw.Draw(sh).rounded_rectangle([0, 0, shot.width-1, shot.height-1], radius=radius, fill=120)
    sh = sh.filter(ImageFilter.GaussianBlur(26))
    base.paste((0, 0, 0), (sx, sy + 16), sh)

    # rounded screenshot
    base.paste(shot, (sx, sy), rounded_mask(shot.size, radius))

    out = os.path.join(OUT, cfg["out"])
    base.save(out)  # RGB → 24-bit PNG, no alpha
    print("built", out, base.size)

TILES = [
    {"top": (90, 147, 255), "bot": (47, 107, 255),
     "headline": "Capture the whole page — in one click.",
     "img": "01-popup-capture.png", "out": "tile-1-capture.png"},
    {"top": (56, 212, 136), "bot": (25, 165, 100),
     "headline": "Annotate, redact, and export anywhere.",
     "img": "02-editor-result.png", "out": "tile-2-editor.png"},
]

for t in TILES:
    build(t)
