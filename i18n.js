// Replaces text in elements tagged with data-i18n / data-i18n-title with the
// localized message. Dynamic strings are translated in each page's own script
// via chrome.i18n.getMessage().
function applyI18n(root = document) {
  root.querySelectorAll("[data-i18n]").forEach((el) => {
    const msg = chrome.i18n.getMessage(el.dataset.i18n);
    if (msg) el.textContent = msg;
  });
  root.querySelectorAll("[data-i18n-title]").forEach((el) => {
    const msg = chrome.i18n.getMessage(el.dataset.i18nTitle);
    if (msg) el.title = msg;
  });
  const docKey =
    document.documentElement.dataset.i18nDoctitle ||
    (document.body && document.body.dataset.i18nDoctitle);
  if (docKey) {
    const msg = chrome.i18n.getMessage(docKey);
    if (msg) document.title = msg;
  }
}

document.addEventListener("DOMContentLoaded", () => applyI18n());
