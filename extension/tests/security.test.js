import { describe, test, expect } from 'vitest';
import { JSDOM } from 'jsdom';
import { patternsById, patterns, collectMatches } from '../src/patterns.js';
import { scan, MAX_SCAN_CHARS } from '../src/detect.js';

// Regression guard for the ReDoS fix: the sentence/chain detectors used to be
// O(n^2) on terminator-free input (a hostile page could freeze the tab). After
// bounding the quantifiers they are linear, so even large adversarial inputs
// finish quickly. Generous ceilings avoid CI flakiness while still catching a
// quadratic regression (which would take many seconds at 200k chars).
describe('ReDoS resistance', () => {
  const adversarial = {
    'no-chain': 'no '.repeat(200000 / 3),
    'did-not-chain': 'did not '.repeat(200000 / 8),
    'stacked-questions': 'word '.repeat(200000 / 5),
    'sentence-anaphora': 'word '.repeat(200000 / 5),
  };

  for (const [id, text] of Object.entries(adversarial)) {
    test(`${id} stays fast on pathological input`, () => {
      const t0 = Date.now();
      patternsById[id].find(text);
      expect(Date.now() - t0).toBeLessThan(3000);
    });
  }

  test('full pipeline over a large hostile buffer is bounded', () => {
    const all = new Set(patterns.map((p) => p.id));
    const text = 'no what word, why did not and - '.repeat(200000 / 32);
    const t0 = Date.now();
    collectMatches(text, all);
    expect(Date.now() - t0).toBeLessThan(3000);
  });

  test('normal-length chains still detected after bounding', () => {
    expect(patternsById['no-chain'].find('No fluff, no filler, no jargon.')[0].count).toBe(3);
    expect(patternsById['sentence-anaphora']
      .find('Maybe nobody needed it. Maybe the timing was off. Maybe both.')[0].count).toBe(3);
    expect(patternsById['stacked-questions']
      .find('Do I know? Where it breaks? Which corner?')[0].count).toBe(3);
  });
});

describe('scan input cap', () => {
  test('does not scan past MAX_SCAN_CHARS and reports truncation', () => {
    const filler = 'x'.repeat(MAX_SCAN_CHARS);
    // one chain before the cap, one well after it
    const html = `<p>No fluff, no filler here.</p><p>${filler}</p><p>No ads, no fees there.</p>`;
    const doc = new JSDOM(`<body>${html}</body>`).window.document;
    const res = scan(doc.body, new Set(['no-chain']), doc);
    expect(res.truncated).toBe(true);
    const texts = res.hits.map((h) => h.range.toString());
    expect(texts.some((t) => t.includes('No fluff, no filler'))).toBe(true);
    expect(texts.some((t) => t.includes('No ads'))).toBe(false);
  });

  test('small pages are not truncated', () => {
    const doc = new JSDOM('<body><p>No fluff, no filler.</p></body>').window.document;
    const res = scan(doc.body, new Set(['no-chain']), doc);
    expect(res.truncated).toBe(false);
  });
});
