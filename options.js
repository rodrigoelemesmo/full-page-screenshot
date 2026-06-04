const DEFAULTS = { format: "png", jpegQuality: 0.92, autoDownload: false, largePage: "split", captureDelay: 150, stabilize: false };
const t = (k, subs) => chrome.i18n.getMessage(k, subs);

const formatEl = document.getElementById("format");
const qualityEl = document.getElementById("quality");
const qualityValEl = document.getElementById("qualityVal");
const qualityRow = document.getElementById("qualityRow");
const largePageEl = document.getElementById("largePage");
const captureDelayEl = document.getElementById("captureDelay");
const captureDelayValEl = document.getElementById("captureDelayVal");
const stabilizeEl = document.getElementById("stabilize");
const autoDownloadEl = document.getElementById("autoDownload");
const savedEl = document.getElementById("saved");
const shortcutEl = document.getElementById("shortcut");
const permToggleEl = document.getElementById("permToggle");
const permStatusEl = document.getElementById("permStatus");

let saveTimer = null;
function flashSaved() {
  savedEl.textContent = t("optSaved");
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => (savedEl.textContent = ""), 1200);
}

function syncQualityVisibility() {
  qualityRow.style.opacity = formatEl.value === "jpeg" ? "1" : "0.4";
  qualityEl.disabled = formatEl.value !== "jpeg";
}

async function save() {
  const settings = {
    format: formatEl.value,
    jpegQuality: parseFloat(qualityEl.value),
    largePage: largePageEl.value,
    captureDelay: parseInt(captureDelayEl.value, 10),
    stabilize: stabilizeEl.checked,
    autoDownload: autoDownloadEl.checked,
  };
  await chrome.storage.sync.set({ settings });
  flashSaved();
}

async function load() {
  const { settings } = await chrome.storage.sync.get("settings");
  const s = { ...DEFAULTS, ...(settings || {}) };
  formatEl.value = s.format;
  qualityEl.value = s.jpegQuality;
  qualityValEl.textContent = s.jpegQuality.toFixed(2);
  largePageEl.value = s.largePage;
  captureDelayEl.value = s.captureDelay;
  captureDelayValEl.textContent = `${s.captureDelay} ms`;
  stabilizeEl.checked = s.stabilize;
  autoDownloadEl.checked = s.autoDownload;
  syncQualityVisibility();

  // Show the current keyboard shortcut.
  const cmds = await chrome.commands.getAll();
  const cmd = cmds.find((c) => c.name === "capture-full-page");
  shortcutEl.textContent = cmd && cmd.shortcut ? cmd.shortcut : t("optNotSet");

  await refreshPermission();
}

async function refreshPermission() {
  const has = await chrome.permissions.contains({ origins: ["<all_urls>"] });
  if (has) {
    permStatusEl.textContent = t("optPermGranted");
    permToggleEl.textContent = t("optPermRevoke");
  } else {
    permStatusEl.textContent = "";
    permToggleEl.textContent = t("optPermGrant");
  }
  permToggleEl.dataset.has = has ? "1" : "";
}

permToggleEl.addEventListener("click", async () => {
  const has = permToggleEl.dataset.has === "1";
  try {
    if (has) {
      await chrome.permissions.remove({ origins: ["<all_urls>"] });
    } else {
      const granted = await chrome.permissions.request({ origins: ["<all_urls>"] });
      if (!granted) permStatusEl.textContent = t("optPermDenied");
    }
  } catch (e) {
    permStatusEl.textContent = e.message;
  }
  await refreshPermission();
});

formatEl.addEventListener("change", () => { syncQualityVisibility(); save(); });
qualityEl.addEventListener("input", () => { qualityValEl.textContent = parseFloat(qualityEl.value).toFixed(2); });
qualityEl.addEventListener("change", save);
largePageEl.addEventListener("change", save);
captureDelayEl.addEventListener("input", () => { captureDelayValEl.textContent = `${captureDelayEl.value} ms`; });
captureDelayEl.addEventListener("change", save);
stabilizeEl.addEventListener("change", save);
autoDownloadEl.addEventListener("change", save);

document.getElementById("changeShortcut").addEventListener("click", () => {
  chrome.tabs.create({ url: "chrome://extensions/shortcuts" });
});

load();
