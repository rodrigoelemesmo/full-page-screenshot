// Vector-object annotation editor.
// Objects live in ORIGINAL image coordinates. Crop is a non-destructive view rect,
// so it's cheap to undo. Tools: select, crop, arrow, rect, text, pencil, blur.

class FpsEditor {
  constructor(canvas, baseImage, onChange) {
    this.canvas = canvas;
    this.base = baseImage; // HTMLImageElement or canvas
    this.onChange = onChange || (() => {});
    this.ctx = canvas.getContext("2d");

    this.objects = [];
    this.selectedId = null;
    this.tool = "select";
    this.color = "#ff3b30";
    this.width = 4;
    this.fontSize = 24;
    this.nextId = 1;

    const w = baseImage.naturalWidth || baseImage.width;
    const h = baseImage.naturalHeight || baseImage.height;
    this.imgW = w;
    this.imgH = h;
    this.crop = { x: 0, y: 0, w, h };

    this.undoStack = [];
    this.redoStack = [];
    this.drag = null;       // active drag state
    this.pendingCrop = null; // crop rect being drawn
    this.textInput = null;

    this._resizeCanvas();
    this._bindEvents();
    this.render();
  }

  // ---- geometry helpers ----
  _resizeCanvas() {
    this.canvas.width = this.crop.w;
    this.canvas.height = this.crop.h;
  }

  _toImg(e) {
    const r = this.canvas.getBoundingClientRect();
    const sx = this.canvas.width / r.width;
    const sy = this.canvas.height / r.height;
    return {
      x: (e.clientX - r.left) * sx + this.crop.x,
      y: (e.clientY - r.top) * sy + this.crop.y,
    };
  }

  _norm(o) {
    // Normalized rect for hit-testing (handles negative w/h).
    let { x, y, w, h } = o;
    if (w < 0) { x += w; w = -w; }
    if (h < 0) { y += h; h = -h; }
    return { x, y, w, h };
  }

  // ---- history ----
  snapshot() {
    this.undoStack.push(JSON.stringify({ objects: this.objects, crop: this.crop }));
    if (this.undoStack.length > 50) this.undoStack.shift();
    this.redoStack = [];
    this.onChange();
  }
  _restore(json) {
    const s = JSON.parse(json);
    this.objects = s.objects;
    this.crop = s.crop;
    this.selectedId = null;
    this._resizeCanvas();
    this.render();
    this.onChange();
  }
  undo() {
    if (!this.undoStack.length) return;
    this.redoStack.push(JSON.stringify({ objects: this.objects, crop: this.crop }));
    this._restore(this.undoStack.pop());
  }
  redo() {
    if (!this.redoStack.length) return;
    this.undoStack.push(JSON.stringify({ objects: this.objects, crop: this.crop }));
    this._restore(this.redoStack.pop());
  }
  canUndo() { return this.undoStack.length > 0; }
  canRedo() { return this.redoStack.length > 0; }

  // ---- public setters ----
  setTool(t) {
    this.tool = t;
    if (t !== "select") this.selectedId = null;
    if (t !== "crop") this.pendingCrop = null;
    this._commitText();
    this.render();
    this.onChange();
  }
  setColor(c) {
    this.color = c;
    const o = this._selected();
    if (o && "color" in o) { this.snapshot(); o.color = c; this.render(); }
  }
  setWidth(w) {
    this.width = w;
    const o = this._selected();
    if (o && "width" in o) { this.snapshot(); o.width = w; this.render(); }
  }
  setFontSize(s) {
    this.fontSize = s;
    const o = this._selected();
    if (o && o.type === "text") { this.snapshot(); o.fontSize = s; this.render(); }
  }
  deleteSelected() {
    if (this.selectedId == null) return;
    this.snapshot();
    this.objects = this.objects.filter((o) => o.id !== this.selectedId);
    this.selectedId = null;
    this.render();
    this.onChange();
  }
  _selected() { return this.objects.find((o) => o.id === this.selectedId); }
  hasSelection() { return this.selectedId != null; }
  isCropping() { return this.tool === "crop" && this.pendingCrop != null; }

  applyCrop() {
    if (!this.pendingCrop) return;
    const c = this._norm(this.pendingCrop);
    c.x = Math.max(0, Math.round(c.x));
    c.y = Math.max(0, Math.round(c.y));
    c.w = Math.min(this.imgW - c.x, Math.round(c.w));
    c.h = Math.min(this.imgH - c.y, Math.round(c.h));
    if (c.w < 8 || c.h < 8) { this.pendingCrop = null; this.render(); return; }
    this.snapshot();
    this.crop = c;
    this.pendingCrop = null;
    this._resizeCanvas();
    this.setTool("select");
  }
  cancelCrop() { this.pendingCrop = null; this.render(); this.onChange(); }

  // ---- export ----
  exportCanvas() {
    const out = document.createElement("canvas");
    out.width = this.crop.w;
    out.height = this.crop.h;
    const ctx = out.getContext("2d");
    ctx.translate(-this.crop.x, -this.crop.y);
    this._drawScene(ctx);
    return out;
  }

  // ---- rendering ----
  render() {
    const ctx = this.ctx;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    ctx.save();
    ctx.translate(-this.crop.x, -this.crop.y);
    this._drawScene(ctx);
    // selection + crop overlays (only on the live canvas, not in export)
    const sel = this._selected();
    if (sel) this._drawSelection(ctx, sel);
    if (this.pendingCrop) this._drawCropOverlay(ctx);
    ctx.restore();
  }

  _drawScene(ctx) {
    ctx.drawImage(this.base, 0, 0, this.imgW, this.imgH);
    for (const o of this.objects) this._drawObject(ctx, o);
  }

  _drawObject(ctx, o) {
    ctx.save();
    ctx.strokeStyle = o.color || this.color;
    ctx.fillStyle = o.color || this.color;
    ctx.lineWidth = o.width || this.width;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    if (o.type === "rect") {
      const r = this._norm(o);
      ctx.strokeRect(r.x, r.y, r.w, r.h);
    } else if (o.type === "arrow") {
      this._drawArrow(ctx, o);
    } else if (o.type === "pencil") {
      ctx.beginPath();
      o.points.forEach((p, i) => (i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y)));
      ctx.stroke();
    } else if (o.type === "text") {
      ctx.font = `${o.fontSize}px -apple-system, Segoe UI, Roboto, sans-serif`;
      ctx.textBaseline = "top";
      ctx.fillText(o.text, o.x, o.y);
    } else if (o.type === "blur") {
      this._drawMosaic(ctx, this._norm(o));
    }
    ctx.restore();
  }

  _drawArrow(ctx, o) {
    const { x1, y1, x2, y2 } = o;
    const w = o.width || this.width;
    const head = Math.max(14, w * 4); // arrowhead length
    const spread = Math.PI / 7;       // half-angle of the barbs (~26°)
    const ang = Math.atan2(y2 - y1, x2 - x1);
    const len = Math.hypot(x2 - x1, y2 - y1);
    // Stop the shaft at the base of the head so the round cap doesn't poke past the tip.
    const back = Math.min(head * 0.9, len);
    const bx = x2 - back * Math.cos(ang);
    const by = y2 - back * Math.sin(ang);
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(bx, by);
    ctx.stroke();
    // Filled triangle head with the tip exactly at (x2, y2).
    ctx.beginPath();
    ctx.moveTo(x2, y2);
    ctx.lineTo(x2 - head * Math.cos(ang - spread), y2 - head * Math.sin(ang - spread));
    ctx.lineTo(x2 - head * Math.cos(ang + spread), y2 - head * Math.sin(ang + spread));
    ctx.closePath();
    ctx.fill();
  }

  _drawMosaic(ctx, r) {
    if (r.w < 2 || r.h < 2) return;
    const block = Math.max(6, Math.round(Math.min(r.w, r.h) / 10));
    const sw = Math.max(1, Math.round(r.w / block));
    const sh = Math.max(1, Math.round(r.h / block));
    const tmp = document.createElement("canvas");
    tmp.width = sw;
    tmp.height = sh;
    const tctx = tmp.getContext("2d");
    tctx.drawImage(this.base, r.x, r.y, r.w, r.h, 0, 0, sw, sh);
    ctx.save();
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(tmp, 0, 0, sw, sh, r.x, r.y, r.w, r.h);
    ctx.restore();
  }

  _handles(o) {
    // Returns interaction handles in image coords.
    if (o.type === "arrow") {
      return [{ k: "p1", x: o.x1, y: o.y1 }, { k: "p2", x: o.x2, y: o.y2 }];
    }
    if (o.type === "rect" || o.type === "blur") {
      const r = this._norm(o);
      return [
        { k: "nw", x: r.x, y: r.y },
        { k: "ne", x: r.x + r.w, y: r.y },
        { k: "sw", x: r.x, y: r.y + r.h },
        { k: "se", x: r.x + r.w, y: r.y + r.h },
      ];
    }
    return [];
  }

  _drawSelection(ctx, o) {
    ctx.save();
    ctx.strokeStyle = "#4f8cff";
    ctx.lineWidth = 1.5;
    ctx.setLineDash([6, 4]);
    const b = this._bounds(o);
    ctx.strokeRect(b.x - 4, b.y - 4, b.w + 8, b.h + 8);
    ctx.setLineDash([]);
    ctx.fillStyle = "#4f8cff";
    for (const h of this._handles(o)) {
      ctx.fillRect(h.x - 5, h.y - 5, 10, 10);
    }
    ctx.restore();
  }

  _drawCropOverlay(ctx) {
    const r = this._norm(this.pendingCrop);
    ctx.save();
    ctx.fillStyle = "rgba(0,0,0,0.5)";
    // darken everything, then clear the crop region
    ctx.fillRect(this.crop.x, this.crop.y, this.crop.w, this.crop.h);
    ctx.clearRect(r.x, r.y, r.w, r.h);
    // re-draw the scene inside the crop region brightly
    ctx.save();
    ctx.beginPath();
    ctx.rect(r.x, r.y, r.w, r.h);
    ctx.clip();
    this._drawScene(ctx);
    ctx.restore();
    ctx.strokeStyle = "#4f8cff";
    ctx.lineWidth = 2;
    ctx.strokeRect(r.x, r.y, r.w, r.h);
    ctx.restore();
  }

  _bounds(o) {
    if (o.type === "rect" || o.type === "blur") return this._norm(o);
    if (o.type === "arrow") {
      const x = Math.min(o.x1, o.x2), y = Math.min(o.y1, o.y2);
      return { x, y, w: Math.abs(o.x2 - o.x1), h: Math.abs(o.y2 - o.y1) };
    }
    if (o.type === "pencil") {
      const xs = o.points.map((p) => p.x), ys = o.points.map((p) => p.y);
      const x = Math.min(...xs), y = Math.min(...ys);
      return { x, y, w: Math.max(...xs) - x, h: Math.max(...ys) - y };
    }
    if (o.type === "text") {
      this.ctx.font = `${o.fontSize}px -apple-system, Segoe UI, Roboto, sans-serif`;
      const w = this.ctx.measureText(o.text).width;
      return { x: o.x, y: o.y, w, h: o.fontSize };
    }
    return { x: 0, y: 0, w: 0, h: 0 };
  }

  // ---- hit testing ----
  _hitHandle(o, p) {
    for (const h of this._handles(o)) {
      if (Math.abs(p.x - h.x) <= 8 && Math.abs(p.y - h.y) <= 8) return h.k;
    }
    return null;
  }
  _hitObject(p) {
    for (let i = this.objects.length - 1; i >= 0; i--) {
      const o = this.objects[i];
      if (this._isHit(o, p)) return o;
    }
    return null;
  }
  _isHit(o, p) {
    const tol = Math.max(8, (o.width || this.width));
    if (o.type === "rect" || o.type === "blur") {
      const r = this._norm(o);
      return p.x >= r.x - tol && p.x <= r.x + r.w + tol && p.y >= r.y - tol && p.y <= r.y + r.h + tol;
    }
    if (o.type === "arrow") return this._distSeg(p, o.x1, o.y1, o.x2, o.y2) <= tol;
    if (o.type === "pencil") {
      for (let i = 1; i < o.points.length; i++) {
        const a = o.points[i - 1], b = o.points[i];
        if (this._distSeg(p, a.x, a.y, b.x, b.y) <= tol) return true;
      }
      return false;
    }
    if (o.type === "text") {
      const b = this._bounds(o);
      return p.x >= b.x && p.x <= b.x + b.w && p.y >= b.y && p.y <= b.y + b.h;
    }
    return false;
  }
  _distSeg(p, x1, y1, x2, y2) {
    const dx = x2 - x1, dy = y2 - y1;
    const len2 = dx * dx + dy * dy || 1;
    let t = ((p.x - x1) * dx + (p.y - y1) * dy) / len2;
    t = Math.max(0, Math.min(1, t));
    const cx = x1 + t * dx, cy = y1 + t * dy;
    return Math.hypot(p.x - cx, p.y - cy);
  }

  // ---- events ----
  _bindEvents() {
    this.canvas.addEventListener("pointerdown", (e) => this._onDown(e));
    window.addEventListener("pointermove", (e) => this._onMove(e));
    window.addEventListener("pointerup", (e) => this._onUp(e));
    this.canvas.addEventListener("dblclick", (e) => this._onDblClick(e));
  }

  _onDown(e) {
    if (this.textInput) { this._commitText(); return; }
    const p = this._toImg(e);
    const tool = this.tool;

    if (tool === "select") {
      const sel = this._selected();
      if (sel) {
        const h = this._hitHandle(sel, p);
        if (h) { this.drag = { mode: "handle", handle: h, o: sel, start: p, pending: true }; return; }
      }
      const hit = this._hitObject(p);
      this.selectedId = hit ? hit.id : null;
      this.render();
      this.onChange();
      if (hit) this.drag = { mode: "move", o: hit, start: p, pending: true };
      return;
    }

    if (tool === "crop") {
      this.pendingCrop = { x: p.x, y: p.y, w: 0, h: 0 };
      this.drag = { mode: "crop", start: p };
      return;
    }

    if (tool === "text") {
      e.preventDefault(); // keep focus on the input we're about to create
      this._startText(p, e);
      return;
    }

    // drawing tools create a new object
    this.snapshot();
    let o;
    const id = this.nextId++;
    if (tool === "rect") o = { id, type: "rect", x: p.x, y: p.y, w: 0, h: 0, color: this.color, width: this.width };
    else if (tool === "blur") o = { id, type: "blur", x: p.x, y: p.y, w: 0, h: 0 };
    else if (tool === "arrow") o = { id, type: "arrow", x1: p.x, y1: p.y, x2: p.x, y2: p.y, color: this.color, width: this.width };
    else if (tool === "pencil") o = { id, type: "pencil", points: [{ x: p.x, y: p.y }], color: this.color, width: this.width };
    this.objects.push(o);
    this.selectedId = id;
    this.drag = { mode: "draw", o, start: p };
    this.render();
  }

  _onMove(e) {
    if (!this.drag) return;
    const p = this._toImg(e);
    const d = this.drag;
    // Snapshot once, on the first real movement (avoids no-op undo entries).
    if (d.pending) { this.snapshot(); d.pending = false; }
    if (d.mode === "crop") {
      this.pendingCrop.w = p.x - d.start.x;
      this.pendingCrop.h = p.y - d.start.y;
    } else if (d.mode === "draw") {
      const o = d.o;
      if (o.type === "rect" || o.type === "blur") { o.w = p.x - o.x; o.h = p.y - o.y; }
      else if (o.type === "arrow") { o.x2 = p.x; o.y2 = p.y; }
      else if (o.type === "pencil") o.points.push({ x: p.x, y: p.y });
    } else if (d.mode === "move") {
      const dx = p.x - d.start.x, dy = p.y - d.start.y;
      d.start = p;
      this._translate(d.o, dx, dy);
    } else if (d.mode === "handle") {
      this._resize(d.o, d.handle, p);
    }
    this.render();
  }

  _onUp() {
    if (!this.drag) return;
    const d = this.drag;
    // discard zero-size draws
    if (d.mode === "draw") {
      const o = d.o;
      const b = this._bounds(o);
      const tiny = o.type === "pencil" ? o.points.length < 2 : (b.w < 3 && b.h < 3);
      if (tiny) {
        this.objects = this.objects.filter((x) => x.id !== o.id);
        this.selectedId = null;
      }
    }
    this.drag = null;
    this.render();
    this.onChange();
  }

  _onDblClick(e) {
    if (this.tool !== "select") return;
    const p = this._toImg(e);
    const hit = this._hitObject(p);
    if (hit && hit.type === "text") this._editText(hit, e);
  }

  _translate(o, dx, dy) {
    if (o.type === "rect" || o.type === "blur" || o.type === "text") { o.x += dx; o.y += dy; }
    else if (o.type === "arrow") { o.x1 += dx; o.y1 += dy; o.x2 += dx; o.y2 += dy; }
    else if (o.type === "pencil") o.points.forEach((pt) => { pt.x += dx; pt.y += dy; });
  }

  _resize(o, handle, p) {
    if (o.type === "arrow") {
      if (handle === "p1") { o.x1 = p.x; o.y1 = p.y; } else { o.x2 = p.x; o.y2 = p.y; }
      return;
    }
    // rect/blur: keep opposite corner fixed
    const r = this._norm(o);
    let x0 = r.x, y0 = r.y, x1 = r.x + r.w, y1 = r.y + r.h;
    if (handle.includes("n")) y0 = p.y;
    if (handle.includes("s")) y1 = p.y;
    if (handle.includes("w")) x0 = p.x;
    if (handle.includes("e")) x1 = p.x;
    o.x = x0; o.y = y0; o.w = x1 - x0; o.h = y1 - y0;
  }

  // ---- text overlay ----
  _startText(p, e) {
    const id = this.nextId++;
    const o = { id, type: "text", x: p.x, y: p.y, text: "", fontSize: this.fontSize, color: this.color };
    this._openInput(o, e, true);
  }
  _editText(o, e) {
    this._openInput(o, e, false);
  }
  _openInput(o, e, isNew) {
    this._commitText();
    const input = document.createElement("input");
    input.type = "text";
    input.value = o.text || "";
    input.className = "fps-text-input";
    const r = this.canvas.getBoundingClientRect();
    const scale = r.width / this.canvas.width;
    input.style.position = "fixed";
    input.style.left = `${r.left + (o.x - this.crop.x) * scale}px`;
    input.style.top = `${r.top + (o.y - this.crop.y) * scale}px`;
    input.style.font = `${o.fontSize * scale}px -apple-system, Segoe UI, Roboto, sans-serif`;
    input.style.color = o.color;
    document.body.appendChild(input);
    this.textInput = { input, o, isNew };
    // Defer focus to the next tick so the originating click can't blur it.
    setTimeout(() => { input.focus(); input.select(); }, 0);
    const finish = () => this._commitText();
    input.addEventListener("blur", finish);
    input.addEventListener("keydown", (ev) => {
      if (ev.key === "Enter") { ev.preventDefault(); finish(); }
      if (ev.key === "Escape") { this.textInput = null; input.remove(); this.render(); }
    });
  }
  _commitText() {
    if (!this.textInput) return;
    const { input, o, isNew } = this.textInput;
    const val = input.value.trim();
    this.textInput = null;
    input.remove();
    if (!val) { this.render(); return; }
    this.snapshot();
    o.text = val;
    if (isNew) { this.objects.push(o); }
    this.selectedId = o.id;
    this.render();
    this.onChange();
  }
}

// Exposed for unit tests (no effect in the browser, where `module` is undefined).
if (typeof module !== "undefined" && module.exports) module.exports = { FpsEditor };
