// Service worker: seed default settings on install, and mirror each tab's
// live match count onto the toolbar action badge. The content script scans the
// page and reports its match count here; we render it as a per-tab badge so the
// number tracks whichever tab is in front without opening the popup.

import { badgeText } from './badge.js';

const BADGE_BG = '#DC2626';
const BADGE_FG = '#FFFFFF';

chrome.runtime.onInstalled.addListener(() => {
  chrome.storage.sync.get({ allowlist: null, disabledPatterns: null }, (cur) => {
    const patch = {};
    if (cur.allowlist == null) patch.allowlist = [];
    if (cur.disabledPatterns == null) patch.disabledPatterns = ['colon-triple'];
    if (Object.keys(patch).length) chrome.storage.sync.set(patch);
  });
});

// The badge colours are global (not per-tab); set them whenever the worker
// spins up. Text-colour control is newer, so feature-detect it.
chrome.action.setBadgeBackgroundColor({ color: BADGE_BG });
if (chrome.action.setBadgeTextColor) chrome.action.setBadgeTextColor({ color: BADGE_FG });

function setBadge(tabId, count) {
  if (typeof tabId !== 'number') return;
  chrome.action.setBadgeText({ tabId, text: badgeText(count) }, () => void chrome.runtime.lastError);
}

chrome.runtime.onMessage.addListener((msg, sender) => {
  // Only trust messages from our own content script running in a tab. Web pages
  // can't reach the worker (no externally_connectable) and other extensions get
  // a different sender.id; requiring sender.tab makes the trust boundary explicit.
  if (!sender || sender.id !== chrome.runtime.id || !sender.tab) return;
  if (msg && msg.type === 'matchCount') setBadge(sender.tab.id, msg.count);
});

// A per-tab badge otherwise persists across navigations, so a count from the
// previous page would linger on an unrelated one. Clear it the moment the tab
// starts loading; if the new page is scanned, the content script re-reports.
chrome.tabs.onUpdated.addListener((tabId, changeInfo) => {
  if (changeInfo.status === 'loading') {
    chrome.action.setBadgeText({ tabId, text: '' }, () => void chrome.runtime.lastError);
  }
});
