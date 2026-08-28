import { describe, test, expect } from 'vitest';
import { JSDOM } from 'jsdom';
import {
  scan,
  flatten,
  buildRanges,
  bufferOffsetOf,
  matchAtBufferOffset,
} from '../src/detect.js';
import { patternsById } from '../src/patterns.js';

const ALL = new Set(Object.keys(patternsById));

function docFrom(html) {
  return new JSDOM(`<body>${html}</body>`).window.document;
}

describe('flatten', () => {
  test('skips script, style, textarea, and hidden nodes', () => {
    const doc = docFrom(`
      <p>Visible prose here.</p>
      <script>var s = "delve tapestry";</script>
      <style>.x{content:"pivotal"}</style>
      <textarea>You already know the answer.</textarea>
      <p style="display:none">nestled in a valley, boasts a hidden gem</p>
    `);
    const { buffer } = flatten(doc.body);
    expect(buffer).toContain('Visible prose here.');
    expect(buffer).not.toContain('delve');
    expect(buffer).not.toContain('pivotal');
    expect(buffer).not.toContain('already know');
    expect(buffer).not.toContain('nestled');
  });

  test('inserts a separator between block elements', () => {
    const doc = docFrom(`<p>First.</p><p>Second.</p>`);
    const { buffer } = flatten(doc.body);
    expect(buffer).toContain('First.');
    expect(buffer).toContain('Second.');
    expect(buffer).toMatch(/First\.\s*\n\s*Second\./);
  });
});

describe('scan -> ranges', () => {
  test('detects a chain and maps it to a range covering the text', () => {
    const doc = docFrom(`<p>We shipped it. No sign-ups, no downloads, no hassle.</p>`);
    const res = scan(doc.body, ALL, doc);
    const hit = res.hits.find((h) => h.match.patternId === 'no-chain');
    expect(hit).toBeTruthy();
    expect(hit.range.toString()).toBe('No sign-ups, no downloads, no hassle');
    expect(hit.match.count).toBe(3);
  });

  test('builds a range spanning multiple text nodes', () => {
    const doc = docFrom(`<div>The improvement <b>is real</b>, and it is not subtle.</div>`);
    const res = scan(doc.body, ALL, doc);
    const hit = res.hits.find((h) => h.match.patternId === 'is-real');
    expect(hit).toBeTruthy();
    // the match starts inside <b> and ends in the following text node
    expect(hit.range.startContainer).not.toBe(hit.range.endContainer);
    expect(hit.range.toString()).toContain('is real');
  });

  test('respects the enabled set', () => {
    const doc = docFrom(`<p>No sign-ups, no downloads, no hassle.</p>`);
    const none = scan(doc.body, new Set(), doc);
    expect(none.hits.length).toBe(0);
    const only = scan(doc.body, new Set(['no-chain']), doc);
    expect(only.hits.length).toBe(1);
  });
});

describe('reverse hover mapping', () => {
  test('bufferOffsetOf + matchAtBufferOffset locate the hovered match', () => {
    const doc = docFrom(`<p>Intro text. No fluff, no filler, no jargon.</p>`);
    const res = scan(doc.body, ALL, doc);
    const match = res.matches.find((m) => m.patternId === 'no-chain');
    // pick the text node and an offset inside the matched span
    const seg = res.segments.find((s) => s.node.data.includes('No fluff'));
    const inNodeOffset = seg.node.data.indexOf('fluff') + 1;
    const pos = bufferOffsetOf(res.nodeStart, seg.node, inNodeOffset);
    expect(matchAtBufferOffset(res.matches, pos)).toBe(match);
  });

  test('bufferOffsetOf returns -1 for unknown nodes', () => {
    const doc = docFrom(`<p>Hello.</p>`);
    const stray = doc.createTextNode('elsewhere');
    const res = scan(doc.body, ALL, doc);
    expect(bufferOffsetOf(res.nodeStart, stray, 0)).toBe(-1);
  });

  test('matchAtBufferOffset returns null outside any match', () => {
    const doc = docFrom(`<p>No fluff, no filler.</p>`);
    const res = scan(doc.body, new Set(['no-chain']), doc);
    expect(matchAtBufferOffset(res.matches, res.buffer.length)).toBeNull();
  });
});

describe('buildRanges edge cases', () => {
  test('drops matches whose endpoints fall on a synthetic separator', () => {
    // a fabricated match reaching past the text into the trailing separator
    const doc = docFrom(`<p>No fluff, no filler.</p>`);
    const { segments, buffer } = flatten(doc.body);
    const bogus = [{ start: buffer.length - 1, end: buffer.length + 5, patternId: 'x' }];
    const hits = buildRanges(bogus, segments, doc);
    expect(hits.length).toBe(0);
  });
});
