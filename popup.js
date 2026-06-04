const t = (k, subs) => chrome.i18n.getMessage(k, subs);

const btn = document.getElementById("capture");
const grantBtn = document.getElementById("grant");
const statusEl = document.getElementById("status");
const bar = document.querySelector(".bar");
const barFill = document.getElementById("barFill");

function setStatus(text) {
  statusEl.textContent = text || "";
}
function setProgress(p) {
  bar.style.display = "block";
  barFill.style.width = `${Math.round(p * 100)}%`;
}

chrome.runtime.onMessage.addListener((msg) => {
  if (msg.type === "phase") {
    setStatus(msg.text);
  } else if (msg.type === "progress") {
    setStatus(`${t("statusCapturing")} (${msg.current}/${msg.total})`);
    setProgress(msg.current / msg.total);
  }
});

function showResult(res) {
  if (res && res.ok) {
    let msg = t("statusDone");
    if (res.split) msg = t("statusDoneSplit", [String(res.count)]);
    else if (res.downscaled) msg = t("statusDoneDownscaled");
    setStatus(msg);
    setProgress(1);
    grantBtn.style.display = "none";
  } else if (res && res.needsPermission) {
    setStatus(t("needPermMsg"));
    grantBtn.style.display = "block";
  } else {
    setStatus(`⚠️ ${(res && res.error) || t("statusFailed")}`);
  }
}

async function capture() {
  btn.disabled = true;
  setStatus(t("statusPreparing"));
  setProgress(0);
  try {
    showResult(await chrome.runtime.sendMessage({ type: "captureFullPage" }));
  } catch (e) {
    setStatus(`⚠️ ${e.message}`);
  } finally {
    btn.disabled = false;
  }
}

btn.addEventListener("click", capture);

// On-demand broad permission for cross-origin iframe capture.
grantBtn.addEventListener("click", async () => {
  try {
    const granted = await chrome.permissions.request({ origins: ["<all_urls>"] });
    if (granted) {
      grantBtn.style.display = "none";
      await capture(); // retry now that we have access
    } else {
      setStatus(`⚠️ ${t("optPermDenied")}`);
    }
  } catch (e) {
    setStatus(`⚠️ ${e.message}`);
  }
});

// Footer: open options + show current shortcut.
document.getElementById("openOptions").addEventListener("click", () => {
  chrome.runtime.openOptionsPage();
});
chrome.commands.getAll().then((cmds) => {
  const cmd = cmds.find((c) => c.name === "capture-full-page");
  if (cmd && cmd.shortcut) {
    document.getElementById("shortcutHint").innerHTML = `<kbd>${cmd.shortcut}</kbd>`;
  }
});
