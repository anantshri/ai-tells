// Popup UI: scan/clear the active tab, toggle auto-scan for the current site,
// and enable/disable individual patterns. Settings live in chrome.storage.sync;
// the content script reacts to changes automatically.

import { allMeta } from './meta.js';

const els = {
  status: document.getElementById('status'),
  scan: document.getElementById('scan'),
  clear: document.getElementById('clear'),
  allowSite: document.getElementById('allow-site'),
  origin: document.getElementById('origin'),
  patternMeta: document.getElementById('pattern-meta'),
  patternList: document.getElementById('pattern-list'),
  allOn: document.getElementById('all-on'),
  allOff: document.getElementById('all-off'),
};

let activeTab = null;
let activeOrigin = null;
let settings = { allowlist: [], disabledPatterns: ['colon-triple'] };

const canScan = (url) => /^https?:/i.test(url || '');

function getSettings() {
  return new Promise((resolve) =>
    chrome.storage.sync.get({ allowlist: [], disabledPatterns: ['colon-triple'] }, resolve));
}

function setSettings(patch) {
  return new Promise((resolve) => chrome.storage.sync.set(patch, resolve));
}

function getActiveTab() {
  return new Promise((resolve) =>
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => resolve(tabs[0] || null)));
}

// Send a message to the tab, injecting the content script first if it isn't
// there yet (e.g. the tab was open before the extension was installed).
function sendToTab(tabId, message) {
  return new Promise((resolve) => {
    chrome.tabs.sendMessage(tabId, message, (resp) => {
      if (chrome.runtime.lastError) {
        chrome.scripting.executeScript({ target: { tabId }, files: ['content.js'] }, () => {
          if (chrome.runtime.lastError) { resolve(null); return; }
          chrome.tabs.sendMessage(tabId, message, (r2) =>
            resolve(chrome.runtime.lastError ? null : r2));
        });
      } else {
        resolve(resp);
      }
    });
  });
}

function setStatus(text) { els.status.textContent = text; }

function renderPatterns() {
  const off = new Set(settings.disabledPatterns);
  els.patternMeta.textContent = `· ${allMeta.length - off.size}/${allMeta.length} on`;
  els.patternList.textContent = '';
  let lastGroup = null;
  for (const m of allMeta) {
    if (m.group !== lastGroup) {
      const h = document.createElement('div');
      h.className = 'pattern-group';
      h.textContent = m.group;
      els.patternList.appendChild(h);
      lastGroup = m.group;
    }
    const row = document.createElement('div');
    row.className = 'pattern-row';
    const label = document.createElement('label');
    const box = document.createElement('input');
    box.type = 'checkbox';
    box.checked = !off.has(m.id);
    box.dataset.id = m.id;
    box.addEventListener('change', onToggle);
    label.appendChild(box);
    label.appendChild(document.createTextNode(' ' + m.name));
    label.title = m.description;
    row.appendChild(label);
    els.patternList.appendChild(row);
  }
}

async function onToggle(event) {
  const id = event.target.dataset.id;
  const off = new Set(settings.disabledPatterns);
  if (event.target.checked) off.delete(id); else off.add(id);
  settings.disabledPatterns = [...off];
  await setSettings({ disabledPatterns: settings.disabledPatterns });
  els.patternMeta.textContent = `· ${allMeta.length - off.size}/${allMeta.length} on`;
}

async function setAll(on) {
  settings.disabledPatterns = on ? [] : allMeta.map((m) => m.id);
  await setSettings({ disabledPatterns: settings.disabledPatterns });
  renderPatterns();
}

async function onAllowSite() {
  if (!activeOrigin) return;
  const set = new Set(settings.allowlist);
  if (els.allowSite.checked) set.add(activeOrigin); else set.delete(activeOrigin);
  settings.allowlist = [...set];
  await setSettings({ allowlist: settings.allowlist });
  setStatus(els.allowSite.checked ? 'Auto-scan enabled for this site.' : 'Auto-scan disabled for this site.');
}

async function onScan() {
  if (!activeTab) return;
  setStatus('Scanning…');
  const resp = await sendToTab(activeTab.id, { type: 'scan' });
  if (!resp || !resp.ok) { setStatus('Could not scan this page.'); return; }
  setStatus(resp.count === 1 ? '1 match highlighted.' : `${resp.count} matches highlighted.`);
}

async function onClear() {
  if (!activeTab) return;
  await sendToTab(activeTab.id, { type: 'clear' });
  setStatus('Highlights cleared.');
}

async function init() {
  settings = await getSettings();
  // Harden against a corrupted stored value (only this extension can write it,
  // but a non-array would otherwise throw and abort init).
  if (!Array.isArray(settings.allowlist)) settings.allowlist = [];
  if (!Array.isArray(settings.disabledPatterns)) settings.disabledPatterns = ['colon-triple'];
  activeTab = await getActiveTab();
  activeOrigin = activeTab && canScan(activeTab.url) ? new URL(activeTab.url).origin : null;

  els.origin.textContent = activeOrigin || 'this site';
  els.allowSite.checked = Boolean(activeOrigin && settings.allowlist.includes(activeOrigin));

  const scannable = Boolean(activeOrigin);
  els.scan.disabled = !scannable;
  els.clear.disabled = !scannable;
  els.allowSite.disabled = !scannable;
  if (!scannable) setStatus('This page type can’t be scanned.');
  else setStatus('Ready.');

  renderPatterns();

  els.scan.addEventListener('click', onScan);
  els.clear.addEventListener('click', onClear);
  els.allowSite.addEventListener('change', onAllowSite);
  els.allOn.addEventListener('click', () => setAll(true));
  els.allOff.addEventListener('click', () => setAll(false));
}

init();
