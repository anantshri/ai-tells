import { describe, test, expect } from 'vitest';
import { allMeta, metaFor, moreUrlFor, groupFor, isWikiPattern, DEFAULT_DISABLED } from '../src/meta.js';
import { patterns } from '../src/patterns.js';

describe('meta', () => {
  test('every pattern has metadata with a moreUrl', () => {
    expect(allMeta.length).toBe(patterns.length);
    for (const m of allMeta) {
      expect(m.name).toBeTruthy();
      expect(m.description).toBeTruthy();
      expect(m.moreUrl).toMatch(/^https:\/\//);
      expect(['Rhetorical tics', 'Signs of AI writing (Wikipedia)']).toContain(m.group);
    }
  });

  test('Wikipedia-group patterns link to the guide; tics link to the tool', () => {
    expect(moreUrlFor('ai-vocab')).toContain('en.wikipedia.org/wiki/Wikipedia:Signs_of_AI_writing');
    expect(isWikiPattern('ai-vocab')).toBe(true);
    expect(moreUrlFor('no-chain')).toContain('tools.simonwillison.net');
    expect(isWikiPattern('no-chain')).toBe(false);
  });

  test('unknown ids resolve safely', () => {
    expect(metaFor('does-not-exist')).toBeNull();
    expect(groupFor('does-not-exist')).toBe('Rhetorical tics');
  });

  test('colon-triple ships disabled by default', () => {
    expect(DEFAULT_DISABLED).toContain('colon-triple');
  });
});
