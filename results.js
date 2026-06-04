const DEFAULTS = { format: "png", jpegQuality: 0.92, autoDownload: false };
const t = (k, subs) => chrome.i18n.getMessage(k, subs);

const metaEl = document.getElementById("meta");
const badgeEl = document.getElementById("badge");
const formatEl = document.getElementById("format");
const downloadBtn = document.getElementById("download");
const copyBtn = document.getElementById("copy");
const canvas = document.getElementById("canvas");
const multiStage = document.getElementById("multiStage");
const toolbarWrap = document.getElementById("toolbarWrap");
const emptyMsg = document.getElementById("emptyMsg");

function sanitize(name) {
  return (name || "screenshot").replace(/[\\/:*?"<>|]+/g, "_").slice(0, 80);
}
function triggerDownload(href, filename) {
  const a = document.createElement("a");
  a.href = href;
  a.download = filename;
  a.click();
}
function jpegDataUrlToBytes(dataUrl) {
  const bin = atob(dataUrl.split(",")[1]);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return bytes;
}

// ---- Minimal dependency-free PDF writer (one JPEG page per entry) ----
function buildPDF(pages) {
  const enc = new TextEncoder();
  const chunks = [];
  let length = 0;
  const offsets = [];
  const push = (data) => {
    const arr = typeof data === "string" ? enc.encode(data) : data;
    chunks.push(arr);
    length += arr.length;
  };
  const obj = (n) => { offsets[n] = length; };

  push("%PDF-1.3\n");
  const N = pages.length;
  obj(1);
  push("1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n");
  const kids = [];
  for (let i = 0; i < N; i++) kids.push(`${5 + i * 3} 0 R`);
  obj(2);
  push(`2 0 obj\n<< /Type /Pages /Kids [${kids.join(" ")}] /Count ${N} >>\nendobj\n`);
  for (let i = 0; i < N; i++) {
    const p = pages[i];
    const imgN = 3 + i * 3, contN = 4 + i * 3, pageN = 5 + i * 3;
    obj(imgN);
    push(`${imgN} 0 obj\n<< /Type /XObject /Subtype /Image /Width ${p.width} /Height ${p.height} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${p.bytes.length} >>\nstream\n`);
    push(p.bytes);
    push("\nendstream\nendobj\n");
    const content = `q\n${p.width} 0 0 ${p.height} 0 0 cm\n/Im0 Do\nQ\n`;
    obj(contN);
    push(`${contN} 0 obj\n<< /Length ${enc.encode(content).length} >>\nstream\n${content}endstream\nendobj\n`);
    obj(pageN);
    push(`${pageN} 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${p.width} ${p.height}] /Resources << /XObject << /Im0 ${imgN} 0 R >> >> /Contents ${contN} 0 R >>\nendobj\n`);
  }
  const xrefOffset = length;
  const total = 2 + N * 3;
  push(`xref\n0 ${total + 1}\n0000000000 65535 f \n`);
  for (let n = 1; n <= total; n++) push(`${String(offsets[n]).padStart(10, "0")} 00000 n \n`);
  push(`trailer\n<< /Size ${total + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF\n`);
  const out = new Uint8Array(length);
  let pos = 0;
  for (const c of chunks) { out.set(c, pos); pos += c.length; }
  return out;
}

const PDF_PAGE_MAX = 14000;
function pdfFromCanvases(canvases, quality) {
  const pages = [];
  for (const src of canvases) {
    const W = src.width, H = src.height;
    for (let y = 0; y < H; y += PDF_PAGE_MAX) {
      const h = Math.min(PDF_PAGE_MAX, H - y);
      const c = document.createElement("canvas");
      c.width = W; c.height = h;
      const ctx = c.getContext("2d");
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, W, h);
      ctx.drawImage(src, 0, y, W, h, 0, 0, W, h);
      pages.push({ bytes: jpegDataUrlToBytes(c.toDataURL("image/jpeg", quality)), width: W, height: h });
    }
  }
  return buildPDF(pages);
}

// Encode a source canvas to png/jpeg (jpeg gets a white background).
function encodeCanvas(src, format, quality) {
  if (format === "png") return src.toDataURL("image/png");
  const c = document.createElement("canvas");
  c.width = src.width; c.height = src.height;
  const ctx = c.getContext("2d");
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, c.width, c.height);
  ctx.drawImage(src, 0, 0);
  return c.toDataURL("image/jpeg", quality);
}

(async () => {
  const [{ lastScreenshot: shot }, { settings }] = await Promise.all([
    chrome.storage.local.get("lastScreenshot"),
    chrome.storage.sync.get("settings"),
  ]);
  const cfg = { ...DEFAULTS, ...(settings || {}) };

  if (!shot || !shot.images || !shot.images.length) {
    canvas.style.display = "none";
    toolbarWrap.style.display = "none";
    emptyMsg.style.display = "block";
    return;
  }

  const totalW = Math.max(...shot.images.map((i) => i.width));
  const totalH = shot.images.reduce((s, i) => s + i.height, 0);
  const partsLabel = shot.images.length > 1 ? ` · ${t("metaParts", [String(shot.images.length)])}` : "";
  metaEl.textContent = `${totalW}×${totalH}px${partsLabel}`;
  if (shot.split) {
    badgeEl.style.display = "";
    badgeEl.textContent = t("badgeSplit", [String(shot.images.length)]);
  } else if (shot.downscaled) {
    badgeEl.style.display = "";
    badgeEl.textContent = t("badgeDownscaled");
  }

  const base = sanitize(shot.title);
  const ext = (f) => (f === "jpeg" ? "jpg" : f === "pdf" ? "pdf" : "png");

  // Load all parts.
  const imgs = await Promise.all(
    shot.images.map((part) => new Promise((res) => {
      const img = new Image();
      img.onload = () => res(img);
      img.src = part.dataUrl;
    }))
  );

  // ===== Multi-part (oversized/split): no editor, stacked download =====
  if (imgs.length > 1) {
    canvas.style.display = "none";
    // Keep the download controls (.right) but hide the editing tools + legend.
    document.getElementById("editTools").style.display = "none";
    document.getElementById("toolHint").style.display = "none";
    const note = document.createElement("div");
    note.className = "note";
    note.textContent = t("edSplitNote");
    multiStage.appendChild(note);
    imgs.forEach((img) => multiStage.appendChild(img));
    multiStage.style.display = "flex";

    const sources = imgs.map((img) => { const c = document.createElement("canvas"); c.width = img.naturalWidth; c.height = img.naturalHeight; c.getContext("2d").drawImage(img, 0, 0); return c; });

    function doDownloadMulti() {
      const f = formatEl.value;
      if (f === "pdf") {
        const url = URL.createObjectURL(new Blob([pdfFromCanvases(sources, cfg.jpegQuality)], { type: "application/pdf" }));
        triggerDownload(url, `${base}.pdf`);
        setTimeout(() => URL.revokeObjectURL(url), 10000);
        return;
      }
      sources.forEach((c, i) => triggerDownload(encodeCanvas(c, f, cfg.jpegQuality), `${base}-${i + 1}.${ext(f)}`));
    }
    wireExport(doDownloadMulti, () => sources[0]);
    formatEl.value = cfg.format;
    if (cfg.autoDownload) doDownloadMulti();
    return;
  }

  // ===== Single image: full editor =====
  const editor = new FpsEditor(canvas, imgs[0], refreshToolbar);
  formatEl.value = cfg.format;

  function exportSource() { return editor.exportCanvas(); }
  function doDownload() {
    const f = formatEl.value;
    const src = exportSource();
    if (f === "pdf") {
      const url = URL.createObjectURL(new Blob([pdfFromCanvases([src], cfg.jpegQuality)], { type: "application/pdf" }));
      triggerDownload(url, `${base}.pdf`);
      setTimeout(() => URL.revokeObjectURL(url), 10000);
      return;
    }
    triggerDownload(encodeCanvas(src, f, cfg.jpegQuality), `${base}.${ext(f)}`);
  }
  wireExport(doDownload, exportSource);

  // Toolbar wiring
  const colorEl = document.getElementById("color");
  const widthEl = document.getElementById("width");
  const fontSizeEl = document.getElementById("fontSize");
  const fontWrap = document.getElementById("fontWrap");
  const cropActions = document.getElementById("cropActions");
  const undoBtn = document.getElementById("undo");
  const redoBtn = document.getElementById("redo");
  const deleteBtn = document.getElementById("delete");
  const toolBtns = [...document.querySelectorAll(".tool[data-tool]")];
  const toolHint = document.getElementById("toolHint");

  let activeHint = "hintSelect";
  const showHint = (key) => { toolHint.textContent = key ? t(key) : ""; };
  showHint(activeHint);

  toolBtns.forEach((b) => {
    b.addEventListener("click", () => {
      editor.setTool(b.dataset.tool);
      toolBtns.forEach((x) => x.classList.toggle("active", x === b));
      fontWrap.style.display = b.dataset.tool === "text" ? "" : "none";
      cropActions.classList.toggle("show", b.dataset.tool === "crop");
      activeHint = b.dataset.hint;
      showHint(activeHint);
    });
    // Hover over any tool previews what it does; revert to the active tool on leave.
    b.addEventListener("mouseenter", () => showHint(b.dataset.hint));
    b.addEventListener("mouseleave", () => showHint(activeHint));
  });
  colorEl.addEventListener("input", () => editor.setColor(colorEl.value));
  widthEl.addEventListener("input", () => editor.setWidth(parseInt(widthEl.value, 10)));
  fontSizeEl.addEventListener("input", () => editor.setFontSize(parseInt(fontSizeEl.value, 10)));
  document.getElementById("applyCrop").addEventListener("click", () => {
    editor.applyCrop();
    document.querySelector('.tool[data-tool="select"]').click();
  });
  document.getElementById("cancelCrop").addEventListener("click", () => editor.cancelCrop());
  undoBtn.addEventListener("click", () => editor.undo());
  redoBtn.addEventListener("click", () => editor.redo());
  deleteBtn.addEventListener("click", () => editor.deleteSelected());

  document.addEventListener("keydown", (e) => {
    if (e.target.tagName === "INPUT") return;
    if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "z") {
      e.preventDefault();
      e.shiftKey ? editor.redo() : editor.undo();
    } else if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "y") {
      e.preventDefault();
      editor.redo();
    } else if (e.key === "Delete" || e.key === "Backspace") {
      if (editor.hasSelection()) { e.preventDefault(); editor.deleteSelected(); }
    }
  });

  function refreshToolbar() {
    undoBtn.disabled = !editor.canUndo();
    redoBtn.disabled = !editor.canRedo();
    deleteBtn.disabled = !editor.hasSelection();
  }
  refreshToolbar();

  if (cfg.autoDownload) doDownload();
})();

// Shared export wiring (download feedback, Cmd/Ctrl+S, copy).
function wireExport(doDownload, sourceCanvasFn) {
  downloadBtn.addEventListener("click", () => {
    doDownload();
    downloadBtn.textContent = t("resDownloaded");
    setTimeout(() => (downloadBtn.textContent = t("resDownload")), 1500);
  });
  document.addEventListener("keydown", (e) => {
    if (e.target.tagName === "INPUT") return;
    if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "s") {
      e.preventDefault();
      doDownload();
    }
  });
  copyBtn.addEventListener("click", async () => {
    try {
      const blob = await new Promise((res) => sourceCanvasFn().toBlob(res, "image/png"));
      await navigator.clipboard.write([new ClipboardItem({ "image/png": blob })]);
      copyBtn.textContent = t("resCopied");
      setTimeout(() => (copyBtn.textContent = t("resCopy")), 1500);
    } catch (e) {
      copyBtn.textContent = t("resFailed");
      setTimeout(() => (copyBtn.textContent = t("resCopy")), 1500);
    }
  });
}
