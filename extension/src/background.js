// Service worker: seed default settings on install. Everything else
// (highlighting, hover, scanning) lives in the content script; the popup talks
// to the active tab directly.

chrome.runtime.onInstalled.addListener(() => {
  chrome.storage.sync.get({ allowlist: null, disabledPatterns: null }, (cur) => {
    const patch = {};
    if (cur.allowlist == null) patch.allowlist = [];
    if (cur.disabledPatterns == null) patch.disabledPatterns = ['colon-triple'];
    if (Object.keys(patch).length) chrome.storage.sync.set(patch);
  });
});
