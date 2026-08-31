import { describe, test, expect } from 'vitest';
import {
  patterns,
  patternsById,
  collectMatches,
  buildRegions,
  sentenceBounds,
  buildWindows,
  countWords,
  EXAMPLE,
} from '../src/patterns.js';
import { patternCases } from './cases.js';

describe('detector cases (ported from the reference tool)', () => {
  for (const [id, sample, expectMatches, expectItems] of patternCases) {
    test(`${id} :: ${sample.slice(0, 44)}`, () => {
      const found = patternsById[id].find(sample);
      expect(found.length).toBe(expectMatches);
      if (expectItems) expect(found.map((f) => f.count)).toEqual(expectItems);
    });
  }
});

describe('engine invariants', () => {
  test('every pattern has id, name, description, and a find()', () => {
    for (const p of patterns) {
      expect(typeof p.id).toBe('string');
      expect(typeof p.name).toBe('string');
      expect(typeof p.description).toBe('string');
      expect(typeof p.find).toBe('function');
    }
  });

  test('sentence bounds isolate the flagged sentence', () => {
    const t = 'First sentence here. No fluff, no filler. Last one.';
    const m = patternsById['no-chain'].find(t)[0];
    const [s, e] = sentenceBounds(t, m.start, m.end);
    expect(t.slice(s, e)).toBe('No fluff, no filler.');
  });

  test('collectMatches drops overlapping matches, keeping first/longest', () => {
    const enabled = new Set(patterns.map((p) => p.id));
    const { matches } = collectMatches(EXAMPLE, enabled);
    for (let i = 1; i < matches.length; i++) {
      expect(matches[i].start).toBeGreaterThanOrEqual(matches[i - 1].end);
    }
  });

  test('example text trips every reference pattern exactly once', () => {
    // Patterns added on top of the ported reference set are not represented in
    // the reference EXAMPLE, so they should not appear; every original pattern
    // still trips exactly once.
    const ADDED = new Set([
      'copulative-avoidance', 'vague-association', 'canned-notability',
      'chat-boilerplate', 'scene-setting', 'journey-metaphor', 'dive-in',
      'hype-buzzwords', 'conclusion-wrapper',
      'false-authority', 'corporate-buzzwords', 'fiction-slop', 'something-for-everyone',
      'cataphoric-teaser', 'hook-opener',
      'verb-inflation', 'hedge-stack', 'pseudo-wisdom',
    ]);
    const all = new Set(patterns.map((p) => p.id));
    const { matches } = collectMatches(EXAMPLE, all);
    const hitIds = new Set(matches.map((m) => m.patternId));
    expect(matches.length).toBe(hitIds.size); // each pattern at most once
    for (const p of patterns) {
      expect(hitIds.has(p.id)).toBe(!ADDED.has(p.id));
    }
  });

  test('buildRegions + buildWindows keep 12 words of context each side', () => {
    const pre = Array.from({ length: 30 }, (_, i) => 'w' + i).join(' ');
    const post = Array.from({ length: 30 }, (_, i) => 't' + i).join(' ');
    const t = pre + '. No fluff, no filler, just results. ' + post + '.';
    const regions = buildRegions(t, collectMatches(t, new Set(['no-chain'])).matches);
    const wins = buildWindows(t, regions);
    expect(wins.length).toBe(1);
    expect(countWords(t.slice(0, wins[0].start))).toBe(18);
    expect(countWords(t.slice(wins[0].end))).toBe(18);
  });

  test('disabled patterns produce no matches', () => {
    const { matches, perPattern } = collectMatches(EXAMPLE, new Set());
    expect(matches.length).toBe(0);
    expect(perPattern['no-chain']).toBe(0);
  });
});
