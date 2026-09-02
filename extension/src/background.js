// Service worker: seed default settings on install, and mirror each tab's page
// grade onto the toolbar action badge. The content script scans the page,
// computes a document-level AI grade, and reports the badge to render here
// ({text, color}, or null to clear). The badge shows the fired-signal count,
// tinted green→red by tier, per-tab so it tracks whichever tab is in front.

const BADGE_FG = '#FFFFFF';

chrome.runtime.onInstalled.addListener(() => {
  chrome.storage.sync.get({ allowlist: null, disabledPatterns: null }, (cur) => {
    const patch = {};
    if (cur.allowlist == null) patch.allowlist = [];
    if (cur.disabledPatterns == null) patch.disabledPatterns = ['colon-triple'];
    if (Object.keys(patch).length) chrome.storage.sync.set(patch);
  });
});

// Badge text colour is global; set it whenever the worker spins up. The
// background colour is per-tab (it encodes the tier), so it's set per message.
// setBadgeTextColor is newer, so feature-detect it.
if (chrome.action.setBadgeTextColor) chrome.action.setBadgeTextColor({ color: BADGE_FG });

const swallow = () => void chrome.runtime.lastError;

function clearBadge(tabId) {
  chrome.action.setBadgeText({ tabId, text: '' }, swallow);
}

function renderBadge(tabId, badge) {
  if (!badge || !badge.text) { clearBadge(tabId); return; }
  chrome.action.setBadgeBackgroundColor({ tabId, color: badge.color }, swallow);
  chrome.action.setBadgeText({ tabId, text: badge.text }, swallow);
}

chrome.runtime.onMessage.addListener((msg, sender) => {
  // Only trust messages from our own content script running in a tab. Web pages
  // can't reach the worker (no externally_connectable) and other extensions get
  // a different sender.id; requiring sender.tab makes the trust boundary explicit.
  if (!sender || sender.id !== chrome.runtime.id || !sender.tab) return;
  if (msg && msg.type === 'pageGrade' && typeof sender.tab.id === 'number') {
    renderBadge(sender.tab.id, msg.badge);
  }
});

// A per-tab badge otherwise persists across navigations, so a grade from the
// previous page would linger on an unrelated one. Clear it the moment the tab
// starts loading; if the new page is scanned, the content script re-reports.
chrome.tabs.onUpdated.addListener((tabId, changeInfo) => {
  if (changeInfo.status === 'loading') clearBadge(tabId);
});
