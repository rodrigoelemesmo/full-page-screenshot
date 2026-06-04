// Minimal DOM/canvas stubs so editor.js can run under `node --test`
// without a browser. Only the APIs the editor actually touches are stubbed.

function makeCtx() {
  return new Proxy({}, {
    get(t, k) {
      if (k === "measureText") return (s) => ({ width: String(s).length * 8 });
      if (k in t) return t[k];
      return () => {};
    },
    set(t, k, v) { t[k] = v; return true; },
  });
}

export function makeCanvas(w = 0, h = 0) {
  return {
    width: w, height: h, style: {},
    getContext: () => makeCtx(),
    getBoundingClientRect() { return { left: 0, top: 0, width: this.width, height: this.height }; },
    addEventListener() {},
    toDataURL: () => "data:image/png;base64,AAAA",
  };
}

export function makeImage(w = 1000, h = 2000) {
  return { width: w, height: h, naturalWidth: w, naturalHeight: h };
}

export function setupDom() {
  global.document = {
    createElement: (tag) =>
      tag === "canvas"
        ? makeCanvas()
        : { style: {}, addEventListener() {}, focus() {}, select() {}, remove() {}, value: "" },
    body: { appendChild() {} },
    addEventListener() {},
  };
  global.window = { addEventListener() {} };
}
