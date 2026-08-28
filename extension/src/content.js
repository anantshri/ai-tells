// Content script: scans the page, paints highlights via the CSS Custom Highlight
// API (no DOM mutation), and shows an interactive tooltip on hover that names
// the signal and links out to read more about it.
//
// Activation is allowlist-driven: on an allowlisted origin the script scans on
// load and re-scans on DOM changes. Everywhere else it stays idle until the
// popup asks it to scan ("Scan now").

import { scan, bufferOffsetOf, matchAtBufferOffset } from './detect.js';
import { patternsById } from './patterns.js';
import { metaFor, isWikiPattern } from './meta.js';

const HL_TIC = 'aicliche-tic';
const HL_WIKI = 'aicliche-wiki';
const STYLE_ID = 'aicliche-style';
const TIP_ID = 'aicliche-tooltip';

// Only run in the top frame.
const IS_TOP = window.top === window.self;

// Custom Highlight API + caret hit-testing are both required.
const SUPPORTED = IS_TOP &&
  typeof CSS !== 'undefined' && CSS.highlights &&
  typeof Highlight === 'function' &&
  (document.caretPositionFromPoint || document.caretRangeFromPoint);

let state = {
  active: false,
  matches: [],
  nodeStart: new Map(),
  enabled: new Set(),
};

let observer = null;
let rescanTimer = null;
let hideTimer = null;
let tipMatchId = null;

// ---- settings ----------------------------------------------------------

function originAllowed(allowlist) {
  return Array.isArray(allowlist) && allowlist.includes(location.origin);
}

function enabledFrom(disabled) {
  const off = new Set(disabled || []);
  const on = new Set();
  for (const id of Object.keys(patternsById)) if (!off.has(id)) on.add(id);
  return on;
}

function getSettings() {
  return new Promise((resolve) => {
    chrome.storage.sync.get({ allowlist: [], disabledPatterns: ['colon-triple'] }, resolve);
  });
}

// ---- styles ------------------------------------------------------------

const STYLE_CSS = `
::highlight(${HL_TIC}) {
  background-color: rgba(252, 211, 77, 0.55);
  color: inherit;
  text-decoration: underline;
  text-decoration-color: rgba(180, 83, 9, 0.9);
  text-decoration-thickness: 2px;
  text-underline-offset: 2px;
}
::highlight(${HL_WIKI}) {
  background-color: rgba(147, 197, 253, 0.5);
  color: inherit;
  text-decoration: underline;
  text-decoration-color: rgba(29, 78, 216, 0.9);
  text-decoration-thickness: 2px;
  text-underline-offset: 2px;
}
#${TIP_ID} {
  all: initial;
  display: block;
  position: fixed;
  z-index: 2147483647;
  max-width: 320px;
  padding: 10px 12px;
  background: #1d1b17;
  color: #fff;
  border-radius: 8px;
  font-family: Helvetica, Arial, sans-serif;
  font-size: 13px;
  line-height: 1.45;
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.35);
  pointer-events: auto;
}
/* all: initial above resets display to inline and outranks the UA
   [hidden] { display: none } rule, so hide the tooltip explicitly. The
   #id[hidden] selector has higher specificity than #id, so it wins. */
#${TIP_ID}[hidden] {
  display: none;
}
#${TIP_ID} .aic-name { font-weight: bold; display: block; margin-bottom: 3px; }
#${TIP_ID} .aic-group { color: #d6d1c4; font-size: 11px; text-transform: uppercase; letter-spacing: 0.05em; }
#${TIP_ID} .aic-desc { color: #eae7df; margin: 5px 0 7px; }
#${TIP_ID} a.aic-more { color: #fcd34d; text-decoration: underline; cursor: pointer; }
#${TIP_ID} a.aic-more:hover { color: #fde68a; }
`;

function injectStyle() {
  if (document.getElementById(STYLE_ID)) return;
  const style = document.createElement('style');
  style.id = STYLE_ID;
  style.textContent = STYLE_CSS;
  (document.head || document.documentElement).appendChild(style);
}

// ---- tooltip -----------------------------------------------------------

function getTip() {
  let tip = document.getElementById(TIP_ID);
  if (!tip) {
    tip = document.createElement('div');
    tip.id = TIP_ID;
    tip.setAttribute('role', 'tooltip');
    tip.hidden = true;
    tip.addEventListener('mouseenter', cancelHide);
    tip.addEventListener('mouseleave', scheduleHide);
    document.documentElement.appendChild(tip);
  }
  return tip;
}

function cancelHide() {
  if (hideTimer) { clearTimeout(hideTimer); hideTimer = null; }
}

function scheduleHide() {
  cancelHide();
  hideTimer = setTimeout(hideTip, 220);
}

function hideTip() {
  cancelHide();
  const tip = document.getElementById(TIP_ID);
  if (tip && !tip.hidden) { tip.hidden = true; }
  tipMatchId = null;
}

function showTip(match, x, y) {
  if (tipMatchId === match.id) { cancelHide(); return; }
  const meta = metaFor(match.patternId);
  if (!meta) return;
  const tip = getTip();
  tip.textContent = '';

  const name = document.createElement('span');
  name.className = 'aic-name';
  name.textContent = match.badgeTitle ? meta.name + ' · ' + match.badgeTitle : meta.name;
  tip.appendChild(name);

  const group = document.createElement('span');
  group.className = 'aic-group';
  group.textContent = meta.group;
  tip.appendChild(group);

  const desc = document.createElement('p');
  desc.className = 'aic-desc';
  desc.textContent = meta.description;
  tip.appendChild(desc);

  const more = document.createElement('a');
  more.className = 'aic-more';
  more.href = meta.moreUrl;
  more.target = '_blank';
  more.rel = 'noopener noreferrer';
  more.textContent = 'Read more ↗';
  tip.appendChild(more);

  tip.hidden = false;
  tipMatchId = match.id;
  position(tip, x, y);
}

function position(tip, x, y) {
  const vw = document.documentElement.clientWidth;
  const vh = document.documentElement.clientHeight;
  const rect = tip.getBoundingClientRect();
  let left = x + 14;
  let top = y + 16;
  if (left + rect.width + 8 > vw) left = Math.max(8, x - rect.width - 14);
  if (top + rect.height + 8 > vh) top = Math.max(8, y - rect.height - 16);
  tip.style.left = left + 'px';
  tip.style.top = top + 'px';
}

// ---- hover hit-testing -------------------------------------------------

function caretUnder(x, y) {
  if (document.caretPositionFromPoint) {
    const pos = document.caretPositionFromPoint(x, y);
    if (pos) return { node: pos.offsetNode, offset: pos.offset };
  }
  if (document.caretRangeFromPoint) {
    const range = document.caretRangeFromPoint(x, y);
    if (range) return { node: range.startContainer, offset: range.startOffset };
  }
  return null;
}

let pendingMove = null;
function onMouseMove(event) {
  if (!state.active) return;
  pendingMove = event;
  if (pendingMove.rafScheduled) return;
  pendingMove.rafScheduled = true;
  requestAnimationFrame(() => {
    const e = pendingMove;
    pendingMove = null;
    if (!e) return;
    handleHover(e.clientX, e.clientY, e.target);
  });
}

function handleHover(x, y, target) {
  const tip = document.getElementById(TIP_ID);
  if (tip && target && (target === tip || tip.contains(target))) return; // over the tooltip
  const caret = caretUnder(x, y);
  if (!caret || caret.node.nodeType !== 3) { scheduleHide(); return; }
  const pos = bufferOffsetOf(state.nodeStart, caret.node, caret.offset);
  if (pos < 0) { scheduleHide(); return; }
  const match = matchAtBufferOffset(state.matches, pos);
  if (!match) { scheduleHide(); return; }
  cancelHide();
  showTip(match, x, y);
}

function onKeyDown(event) {
  if (event.key === 'Escape') hideTip();
}

// ---- highlight painting -----------------------------------------------

function paint(hits) {
  const tic = [];
  const wiki = [];
  for (const h of hits) (isWikiPattern(h.match.patternId) ? wiki : tic).push(h.range);
  CSS.highlights.set(HL_TIC, new Highlight(...tic));
  CSS.highlights.set(HL_WIKI, new Highlight(...wiki));
}

function clearHighlights() {
  CSS.highlights.delete(HL_TIC);
  CSS.highlights.delete(HL_WIKI);
}

// ---- scan lifecycle ----------------------------------------------------

function runScan() {
  if (!SUPPORTED) return;
  injectStyle();
  const res = scan(document.body, state.enabled, document);
  state.matches = res.matches;
  state.nodeStart = res.nodeStart;
  paint(res.hits);
  if (!state.active) {
    state.active = true;
    document.addEventListener('mousemove', onMouseMove, { passive: true });
    document.addEventListener('scroll', hideTip, { passive: true, capture: true });
    document.addEventListener('keydown', onKeyDown, true);
    // Leaving the page/window entirely fires no further mousemove, so hide here.
    document.documentElement.addEventListener('mouseleave', scheduleHide);
  }
  return res.matches.length;
}

function deactivate() {
  clearHighlights();
  hideTip();
  stopObserver();
  if (state.active) {
    document.removeEventListener('mousemove', onMouseMove);
    document.removeEventListener('scroll', hideTip, true);
    document.removeEventListener('keydown', onKeyDown, true);
    document.documentElement.removeEventListener('mouseleave', scheduleHide);
    state.active = false;
  }
  state.matches = [];
  state.nodeStart = new Map();
}

function scheduleRescan() {
  clearTimeout(rescanTimer);
  rescanTimer = setTimeout(() => { if (state.active) runScan(); }, 400);
}

function startObserver() {
  if (observer || !document.body) return;
  observer = new MutationObserver((mutations) => {
    const tip = document.getElementById(TIP_ID);
    const meaningful = mutations.some((m) => {
      if (m.target === tip || (tip && tip.contains(m.target))) return false;
      return true;
    });
    if (meaningful) scheduleRescan();
  });
  observer.observe(document.body, { subtree: true, childList: true, characterData: true });
}

function stopObserver() {
  if (observer) { observer.disconnect(); observer = null; }
}

// ---- wiring ------------------------------------------------------------

async function init() {
  if (!SUPPORTED) return;
  const settings = await getSettings();
  state.enabled = enabledFrom(settings.disabledPatterns);
  if (originAllowed(settings.allowlist)) {
    runScan();
    startObserver();
  }
}

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  // Defence-in-depth: only accept messages from our own extension. Web pages
  // can't reach chrome.runtime at all, and with no externally_connectable other
  // extensions can't either, but this makes the trust boundary explicit.
  if (!sender || sender.id !== chrome.runtime.id) return false;
  if (!SUPPORTED) { sendResponse({ ok: false, reason: 'unsupported' }); return true; }
  if (msg && msg.type === 'scan') {
    getSettings().then((s) => {
      state.enabled = enabledFrom(s.disabledPatterns);
      const count = runScan();
      startObserver();
      sendResponse({ ok: true, count });
    });
    return true;
  }
  if (msg && msg.type === 'clear') {
    deactivate();
    sendResponse({ ok: true });
    return true;
  }
  if (msg && msg.type === 'ping') {
    sendResponse({ ok: true, active: state.active });
    return true;
  }
  return false;
});

// React to settings changes: re-scan with the new pattern set if active, and
// start/stop when this origin is added to / removed from the allowlist.
chrome.storage.onChanged.addListener((changes, area) => {
  if (area !== 'sync') return;
  if (changes.disabledPatterns) {
    state.enabled = enabledFrom(changes.disabledPatterns.newValue);
    if (state.active) runScan();
  }
  if (changes.allowlist) {
    const allowed = originAllowed(changes.allowlist.newValue);
    if (allowed && !state.active) { runScan(); startObserver(); }
    else if (!allowed && state.active) deactivate();
  }
});

init();
