#!/usr/bin/env python3
"""Build 1280x800 Chrome Web Store tiles, fully synthetic (no real web page).
A generic, BLURRED fake page sits behind, while the extension UI (popup, editor
toolbar, annotations, keycaps) is drawn crisp on top — so the plugin is the focus
and there's no third-party branding. 24-bit PNG, no alpha."""
import os
from PIL import Image, ImageDraw, ImageFont, ImageFilter

W, H = 1280, 800
OUT = "store-assets/tiles"
os.makedirs(OUT, exist_ok=True)

# ---------- fonts (modern, distinct from the site's system sans) ----------
def find_font(size, weight="bold"):
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
        if weight == "bold":
            if "Heavy" in sty: s += 30
            elif "Bold" in sty: s += 26
            elif "Demi" in sty or "Semibold" in sty: s += 16
        else:
            if sty in ("Regular", "Medium"): s += 26
            elif "Medium" in sty: s += 20
            elif "Regular" in sty: s += 18
        if "Avenir Next" in fam: s += 10
        elif "Avenir" in fam: s += 8
        elif "Futura" in fam: s += 5
        return s
    cands = [c for c in cands if score(c) > 0]
    if cands:
        cands.sort(key=score, reverse=True)
        return cands[0][2]
    p = "/System/Library/Fonts/Supplemental/Arial Bold.ttf"
    return ImageFont.truetype(p, size) if os.path.exists(p) else ImageFont.load_default()

# ---------- helpers ----------
def lerp(a, b, t): return tuple(int(a[i] + (b[i]-a[i])*t) for i in range(3))

def diagonal(c1, c2):
    den = W + H
    table = [lerp(c1, c2, i/den) for i in range(den + 1)]
    img = Image.new("RGB", (W, H))
    img.putdata([table[x+y] for y in range(H) for x in range(W)])
    glow = Image.new("L", (W, H), 0)
    ImageDraw.Draw(glow).ellipse([-360, -460, int(W*0.75), int(H*0.75)], fill=70)
    img.paste((255, 255, 255), (0, 0), glow.filter(ImageFilter.GaussianBlur(220)))
    return img

def rmask(size, radius):
    m = Image.new("L", size, 0)
    ImageDraw.Draw(m).rounded_rectangle([0, 0, size[0]-1, size[1]-1], radius=radius, fill=255)
    return m

def shadow(base, box, radius, blur=30, alpha=115, dy=18):
    x, y, w, h = box
    sh = Image.new("L", (w, h), 0)
    ImageDraw.Draw(sh).rounded_rectangle([0, 0, w-1, h-1], radius=radius, fill=alpha)
    base.paste((0, 0, 0), (x, y+dy), sh.filter(ImageFilter.GaussianBlur(blur)))

def wrap(draw, text, font, max_w):
    words, lines, cur = text.split(), [], ""
    for w in words:
        t = (cur + " " + w).strip()
        if draw.textlength(t, font=font) <= max_w: cur = t
        else: lines.append(cur); cur = w
    if cur: lines.append(cur)
    return lines

def headline(base, text):
    d = ImageDraw.Draw(base)
    font = find_font(56, "bold")
    asc, _ = font.getmetrics()
    y = 60
    for ln in wrap(d, text, font, W - 200):
        d.text(((W - d.textlength(ln, font=font)) / 2, y), ln, font=font, fill=(255, 255, 255))
        y += asc + 10
    return y

def arrow(d, x1, y1, x2, y2, color, width):
    import math
    d.line([(x1, y1), (x2, y2)], fill=color, width=width)
    ang = math.atan2(y2-y1, x2-x1); hl = max(16, width*3.2); sp = math.pi/7
    d.polygon([(x2, y2),
               (x2-hl*math.cos(ang-sp), y2-hl*math.sin(ang-sp)),
               (x2-hl*math.cos(ang+sp), y2-hl*math.sin(ang+sp))], fill=color)

# ---------- a generic, blurred fake web page ----------
def fake_page(w, h, blur=3.4):
    img = Image.new("RGB", (w, h), (255, 255, 255))
    d = ImageDraw.Draw(img)
    pad = 44
    d.ellipse([pad, 28, pad+26, 54], fill=(120, 150, 230))
    d.rounded_rectangle([pad+38, 36, pad+150, 48], radius=6, fill=(223, 227, 238))
    for xx in (w-260, w-180, w-110):
        d.rounded_rectangle([xx, 36, xx+62, 48], radius=6, fill=(231, 234, 243))
    y = 104
    d.rounded_rectangle([pad, y, pad+int(w*0.50), y+34], radius=8, fill=(70, 76, 98))
    d.rounded_rectangle([pad, y+48, pad+int(w*0.34), y+78], radius=8, fill=(110, 116, 140))
    for i in range(3):
        d.rounded_rectangle([pad, y+112+i*22, pad+int(w*0.46), y+112+i*22+12], radius=6, fill=(214, 219, 230))
    d.rounded_rectangle([pad, y+196, pad+150, y+228], radius=10, fill=(79, 140, 255))
    ix = int(w*0.58)
    d.rounded_rectangle([ix, y, w-pad, y+232], radius=14, fill=(223, 227, 238))
    d.ellipse([ix+30, y+28, ix+72, y+70], fill=(199, 206, 223))
    d.polygon([(ix+18, y+208), (ix+92, y+120), (ix+166, y+208)], fill=(206, 212, 227))
    d.polygon([(ix+128, y+208), (ix+188, y+140), (ix+250, y+208)], fill=(198, 205, 222))
    cy = y+276; cw = (w - 2*pad - 48)//3
    for i in range(3):
        cx = pad + i*(cw+24)
        d.rounded_rectangle([cx, cy, cx+cw, cy+150], radius=12, fill=(250, 251, 253), outline=(228, 231, 240), width=2)
        d.rounded_rectangle([cx+18, cy+18, cx+50, cy+50], radius=8, fill=(120, 150, 230))
        for j in range(3):
            d.rounded_rectangle([cx+18, cy+66+j*20, cx+cw-24, cy+66+j*20+10], radius=5, fill=(224, 228, 238))
    return img.filter(ImageFilter.GaussianBlur(blur))

# ---------- window chrome ----------
def browser_window(w, h):
    win = Image.new("RGB", (w, h), (255, 255, 255))
    d = ImageDraw.Draw(win)
    bar = 44
    d.rectangle([0, 0, w, bar], fill=(241, 242, 247))
    for i, c in enumerate([(255, 95, 87), (254, 188, 46), (40, 200, 64)]):
        d.ellipse([18+i*22, bar//2-6, 30+i*22, bar//2+6], fill=c)
    d.rounded_rectangle([96, 12, w-20, bar-12], radius=8, fill=(255, 255, 255), outline=(225, 228, 238), width=1)
    d.text((112, 14), "example.com", font=find_font(17, "regular"), fill=(140, 146, 160))
    win.paste(fake_page(w, h-bar).resize((w, h-bar)), (0, bar))
    return win

def draw_icon(d, kind, cx, cy, col):
    lw = 2
    if kind == "cursor":
        d.polygon([(cx-5, cy-7), (cx-5, cy+7), (cx-1, cy+3), (cx+2, cy+8), (cx+4, cy+7), (cx+1, cy+2), (cx+6, cy+2)], fill=col)
    elif kind == "crop":
        d.line([(cx-7, cy-3), (cx-7, cy+7), (cx+3, cy+7)], fill=col, width=lw)
        d.line([(cx-3, cy-7), (cx+7, cy-7), (cx+7, cy+3)], fill=col, width=lw)
    elif kind == "arrow":
        d.line([(cx-6, cy+6), (cx+6, cy-6)], fill=col, width=lw)
        d.line([(cx+6, cy-6), (cx+1, cy-6)], fill=col, width=lw)
        d.line([(cx+6, cy-6), (cx+6, cy-1)], fill=col, width=lw)
    elif kind == "rect":
        d.rounded_rectangle([cx-7, cy-5, cx+7, cy+5], radius=2, outline=col, width=lw)
    elif kind == "text":
        f = find_font(17, "bold"); d.text((cx-d.textlength("T", font=f)/2, cy-10), "T", font=f, fill=col)
    elif kind == "pencil":
        d.line([(cx-6, cy+6), (cx+5, cy-5)], fill=col, width=lw)
        d.polygon([(cx-7, cy+7), (cx-3, cy+6), (cx-6, cy+3)], fill=col)
    elif kind == "eye":
        d.ellipse([cx-7, cy-4, cx+7, cy+4], outline=col, width=lw)
        d.ellipse([cx-2, cy-2, cx+2, cy+2], fill=col)
        d.line([(cx-8, cy+6), (cx+8, cy-6)], fill=col, width=lw)

def editor_window(w, h, annotate_fn):
    win = Image.new("RGB", (w, h), (255, 255, 255))
    d = ImageDraw.Draw(win)
    th = 52
    d.rectangle([0, 0, w, th], fill=(22, 23, 29))
    x, bs = 14, 32
    for t in ["cursor", "crop", "arrow", "rect", "text", "pencil", "eye"]:
        d.rounded_rectangle([x, (th-bs)//2, x+bs, (th-bs)//2+bs], radius=8, fill=(44, 46, 60))
        draw_icon(d, t, x+bs/2, th/2, (236, 237, 243))
        x += bs+8
    d.rounded_rectangle([x+8, (th-24)//2, x+8+28, (th-24)//2+24], radius=6, fill=(255, 59, 48))  # red swatch
    cf = find_font(17, "bold")
    cw = 88
    d.rounded_rectangle([w-cw-16, (th-32)//2, w-16, (th-32)//2+32], radius=8, fill=(79, 140, 255))
    d.text((w-cw-16+(cw-d.textlength("Copy", font=cf))/2, th/2-11), "Copy", font=cf, fill=(255, 255, 255))
    dw = 116; dx = w-cw-16-dw-10
    d.rounded_rectangle([dx, (th-32)//2, dx+dw, (th-32)//2+32], radius=8, fill=(44, 46, 60))
    d.text((dx+(dw-d.textlength("Download", font=cf))/2, th/2-11), "Download", font=cf, fill=(236, 237, 243))
    win.paste(fake_page(w, h-th).resize((w, h-th)), (0, th))
    annotate_fn(ImageDraw.Draw(win), w, th, h)
    return win

# ---------- extension popup (capture tile) ----------
def draw_popup(base, x, y):
    w, h = 300, 150
    shadow(base, (x, y, w, h), 16, blur=28, alpha=120, dy=12)
    card = Image.new("RGB", (w, h), (28, 29, 37))
    d = ImageDraw.Draw(card)
    d.rounded_rectangle([18, 18, 42, 42], radius=6, fill=(79, 140, 255))
    d.text((52, 22), "Full Page Screenshot", font=find_font(16, "bold"), fill=(240, 240, 246))
    d.rounded_rectangle([18, 58, w-18, 98], radius=10, fill=(79, 140, 255))
    bf = find_font(17, "bold"); lbl = "Capture full page"
    d.text(((w-d.textlength(lbl, font=bf))/2, 68), lbl, font=bf, fill=(255, 255, 255))
    sf = find_font(14, "regular")
    d.rounded_rectangle([18, 116, 116, 137], radius=5, fill=(44, 46, 60))
    d.text((26, 119), "Alt+Shift+P", font=sf, fill=(210, 212, 224))
    d.text((w-18-d.textlength("Options", font=sf), 119), "Options", font=sf, fill=(120, 160, 255))
    base.paste(card, (x, y), rmask((w, h), 16))

# ---------- tiles ----------
def tile_capture():
    base = diagonal((95, 142, 255), (123, 63, 242))
    headline(base, "Capture the whole page — in one click.")
    ww, wh, wx, wy = 900, 470, (W-900)//2, 250
    shadow(base, (wx, wy, ww, wh), 16)
    base.paste(browser_window(ww, wh), (wx, wy), rmask((ww, wh), 16))
    draw_popup(base, wx+ww-330, wy+18)
    base.save(os.path.join(OUT, "tile-1-capture.png")); print("built tile-1-capture.png")

def annotate_demo(d, w, th, h):
    red = (255, 59, 48)
    rx0, ry0, rx1, ry1 = int(w*0.57), th+78, w-34, th+300
    d.rounded_rectangle([rx0, ry0, rx1, ry1], radius=10, outline=red, width=5)
    arrow(d, int(w*0.34), th+250, rx0-10, ry0+70, red, 6)
    d.text((int(w*0.12), th+214), "Look here!", font=find_font(26, "bold"), fill=red)
    # redaction mosaic over a "title" line
    mx, my, mw, mh, blk = int(w*0.05), th+96, 210, 30, 9
    for yy in range(0, mh, blk):
        for xx in range(0, mw, blk):
            s = 50 + (xx*7 + yy*11) % 60
            d.rectangle([mx+xx, my+yy, mx+xx+blk, my+yy+blk], fill=(s, s, s+6))

def tile_annotate():
    base = diagonal((55, 214, 150), (15, 150, 170))
    headline(base, "Annotate it, right there.")
    ww, wh, wx, wy = 900, 470, (W-900)//2, 250
    shadow(base, (wx, wy, ww, wh), 16)
    base.paste(editor_window(ww, wh, annotate_demo), (wx, wy), rmask((ww, wh), 16))
    base.save(os.path.join(OUT, "tile-2-annotate.png")); print("built tile-2-annotate.png")

def keycap(d, x0, cy, label, font):
    tw = d.textlength(label, font=font); asc, desc = font.getmetrics()
    w = int(tw+60); h = 92; x0 = int(x0); y0 = int(cy-h/2)
    d.rounded_rectangle([x0, y0+7, x0+w, y0+h+7], radius=16, fill=(18, 19, 26))
    d.rounded_rectangle([x0, y0, x0+w, y0+h], radius=16, fill=(48, 50, 66))
    d.rounded_rectangle([x0+4, y0+4, x0+w-4, y0+18], radius=8, fill=(66, 68, 86))
    d.text((x0+(w-tw)/2, cy-(asc+desc)/2+2), label, font=font, fill=(255, 255, 255))
    return w

def tile_paste():
    base = diagonal((255, 120, 200), (123, 63, 242))
    d = ImageDraw.Draw(base)
    headline(base, "Copy, then paste it anywhere.")
    # destination app card with a pasted (blurred fake) screenshot
    cw, ch, cx0, cy0 = 520, 470, 690, 300
    shadow(base, (cx0, cy0, cw, ch), 22, blur=34, alpha=110)
    card = Image.new("RGB", (cw, ch), (255, 255, 255)); cd = ImageDraw.Draw(card)
    cd.ellipse([26, 26, 60, 60], fill=(79, 140, 255))
    cd.rounded_rectangle([74, 30, 230, 44], radius=7, fill=(60, 62, 80))
    cd.rounded_rectangle([74, 52, 320, 64], radius=6, fill=(208, 212, 224))
    thumb = browser_window(cw-52, 360)
    crop_h = min(ch-110, thumb.height)
    thumb = thumb.crop((0, 0, cw-52, crop_h))
    card.paste(thumb, (26, 88), rmask(thumb.size, 12))
    cd.rounded_rectangle([26, 88, 26+thumb.width-1, 88+thumb.height-1], radius=12, outline=(228, 230, 240), width=2)
    base.paste(card, (cx0, cy0), rmask((cw, ch), 22))
    # keycaps Ctrl + V → arrow into the card
    kf = find_font(40, "bold"); pf = find_font(48, "bold")
    midy = cy0+150; gap = 26
    total = (d.textlength("Ctrl", font=kf)+60) + gap + d.textlength("+", font=pf) + gap + (d.textlength("V", font=kf)+60)
    gx = 280; x = gx-total/2; asc, desc = pf.getmetrics()
    x += keycap(d, x, midy, "Ctrl", kf) + gap
    d.text((x, midy-(asc+desc)/2+2), "+", font=pf, fill=(255, 255, 255)); x += d.textlength("+", font=pf)+gap
    keycap(d, x, midy, "V", kf)
    cap = find_font(26, "bold"); lbl = "paste it"
    d.text((gx-d.textlength(lbl, font=cap)/2, midy+72), lbl, font=cap, fill=(255, 255, 255))
    arrow(d, 470, midy, 660, midy, (255, 255, 255), 8)
    base.save(os.path.join(OUT, "tile-3-paste.png")); print("built tile-3-paste.png")

tile_capture()
tile_annotate()
tile_paste()
