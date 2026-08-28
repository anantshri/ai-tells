// DOM <-> text-buffer bridge.
//
// The ported detectors in patterns.js operate on a flat string, exactly like the
// original textarea tool. A web page instead spreads text across many DOM nodes,
// so we:
//   1. flatten the visible page text into one `buffer` string, recording a map
//      of where each text node lives in the buffer (and inserting synthetic "\n"
//      at block boundaries so sentence-aware detectors behave like paragraphs);
//   2. run the unchanged `collectMatches` over the buffer;
//   3. map each match's [start, end) back onto DOM Ranges (which may span nodes)
//      so they can be handed to the CSS Custom Highlight API.
//
// It also exposes the reverse mapping (`bufferOffsetOf`) so the content script
// can turn a caret hit-test (node + offset under the cursor) back into a buffer
// offset and find which match, if any, is being hovered.

import { collectMatches } from './patterns.js';

// Block-level elements: crossing one of these inserts a paragraph break so two
// adjacent blocks don't read as one run-on sentence.
const BLOCK_TAGS = new Set([
  'ADDRESS', 'ARTICLE', 'ASIDE', 'BLOCKQUOTE', 'BR', 'DD', 'DETAILS', 'DIV',
  'DL', 'DT', 'FIELDSET', 'FIGCAPTION', 'FIGURE', 'FOOTER', 'FORM', 'H1', 'H2',
  'H3', 'H4', 'H5', 'H6', 'HEADER', 'HR', 'LI', 'MAIN', 'NAV', 'OL', 'P', 'PRE',
  'SECTION', 'TABLE', 'TD', 'TH', 'TR', 'UL',
]);

// Elements whose text is not prose we should scan, or that we must not disturb.
const SKIP_TAGS = new Set([
  'SCRIPT', 'STYLE', 'NOSCRIPT', 'TEMPLATE', 'CODE', 'KBD', 'SAMP',
  'TEXTAREA', 'INPUT', 'SELECT', 'OPTION', 'SVG', 'MATH',
]);

function isHidden(el) {
  if (el.hidden) return true;
  // getComputedStyle is available in browsers and (partially) in jsdom; guard it.
  const view = el.ownerDocument && el.ownerDocument.defaultView;
  if (view && typeof view.getComputedStyle === 'function') {
    const cs = view.getComputedStyle(el);
    if (cs && (cs.display === 'none' || cs.visibility === 'hidden')) return true;
  }
  // Inline fallback for environments without full layout (e.g. jsdom).
  const inline = el.style;
  if (inline && (inline.display === 'none' || inline.visibility === 'hidden')) return true;
  return false;
}

function isEditable(el) {
  return el.isContentEditable === true || el.getAttribute('contenteditable') === '' ||
    el.getAttribute('contenteditable') === 'true';
}

function shouldSkip(el) {
  return SKIP_TAGS.has(el.tagName) || isEditable(el) || isHidden(el);
}

// Flatten the visible text under `root` into a buffer, tracking each text node's
// position. Returns { buffer, segments, nodeStart }.
//   segments: sorted [{ node, bufStart, len }] for real text nodes only
//   nodeStart: Map(textNode -> bufStart) for O(1) reverse lookups
export function flatten(root) {
  let buffer = '';
  const segments = [];
  const nodeStart = new Map();

  const needSeparator = () => {
    if (buffer.length > 0 && buffer[buffer.length - 1] !== '\n') buffer += '\n';
  };

  const walk = (node) => {
    for (let child = node.firstChild; child; child = child.nextSibling) {
      if (child.nodeType === 3 /* TEXT_NODE */) {
        const text = child.data;
        if (!text) continue;
        const bufStart = buffer.length;
        segments.push({ node: child, bufStart, len: text.length });
        nodeStart.set(child, bufStart);
        buffer += text;
      } else if (child.nodeType === 1 /* ELEMENT_NODE */) {
        if (shouldSkip(child)) continue;
        const block = BLOCK_TAGS.has(child.tagName);
        if (block) needSeparator();
        walk(child);
        if (block) needSeparator();
      }
    }
  };

  walk(root);
  return { buffer, segments, nodeStart };
}

// Binary-search the segment containing buffer offset `pos` (bufStart <= pos <
// bufStart+len). Returns the segment index, or -1 if `pos` lands on a synthetic
// separator / outside all text nodes.
function segmentIndexAt(segments, pos) {
  let lo = 0;
  let hi = segments.length - 1;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    const s = segments[mid];
    if (pos < s.bufStart) hi = mid - 1;
    else if (pos >= s.bufStart + s.len) lo = mid + 1;
    else return mid;
  }
  return -1;
}

// Map a buffer start offset -> { node, offset }, or null if it falls on a gap.
function locateStart(segments, pos) {
  const i = segmentIndexAt(segments, pos);
  if (i === -1) return null;
  const s = segments[i];
  return { node: s.node, offset: pos - s.bufStart };
}

// Map a buffer end offset (exclusive) -> { node, offset } using the last
// included character, so the endpoint stays inside a text node where possible.
function locateEnd(segments, pos) {
  const i = segmentIndexAt(segments, pos - 1);
  if (i === -1) return null;
  const s = segments[i];
  return { node: s.node, offset: pos - 1 - s.bufStart + 1 };
}

// Turn detector matches into DOM Ranges. Matches whose endpoints land on a
// synthetic separator (i.e. a match that would straddle a block boundary) are
// dropped rather than mis-highlighted.
export function buildRanges(matches, segments, doc) {
  const hits = [];
  for (const m of matches) {
    const a = locateStart(segments, m.start);
    const b = locateEnd(segments, m.end);
    if (!a || !b) continue;
    let range;
    try {
      range = doc.createRange();
      range.setStart(a.node, a.offset);
      range.setEnd(b.node, b.offset);
    } catch (err) {
      continue;
    }
    if (range.collapsed) continue;
    hits.push({ range, match: m });
  }
  return hits;
}

// Reverse map for hover hit-testing: a DOM (textNode, offset) -> buffer offset,
// or -1 if the node isn't part of the scanned buffer.
export function bufferOffsetOf(nodeStart, node, offset) {
  const base = nodeStart.get(node);
  if (base === undefined) return -1;
  const len = (node.data ? node.data.length : 0);
  return base + Math.min(offset, len);
}

// Find the match covering a buffer offset via binary search, or null.
export function matchAtBufferOffset(matches, pos) {
  let lo = 0;
  let hi = matches.length - 1;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    const m = matches[mid];
    if (pos < m.start) hi = mid - 1;
    else if (pos >= m.end) lo = mid + 1;
    else return m;
  }
  return null;
}

// Upper bound on how much page text we run detectors over in a single scan.
// Defence-in-depth against a hostile or pathologically large page: detection is
// linear in buffer length (the detector quantifiers are bounded), so this caps
// the per-scan main-thread cost. Segments beyond the cap still exist for range
// mapping; matches simply aren't sought past it. 500k chars comfortably covers
// even very long articles while bounding worst-case work to well under a second.
export const MAX_SCAN_CHARS = 500000;

// Full scan: flatten, detect, and map to ranges in one call.
//   enabled: Set of enabled pattern ids
// Returns { buffer, segments, nodeStart, matches, perPattern, hits, truncated }.
export function scan(root, enabled, doc) {
  const document = doc || (root.ownerDocument || root);
  const { buffer, segments, nodeStart } = flatten(root);
  const truncated = buffer.length > MAX_SCAN_CHARS;
  const scanText = truncated ? buffer.slice(0, MAX_SCAN_CHARS) : buffer;
  const { matches, perPattern } = collectMatches(scanText, enabled);
  const hits = buildRanges(matches, segments, document);
  return { buffer, segments, nodeStart, matches, perPattern, hits, truncated };
}
