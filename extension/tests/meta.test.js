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

  test('SlopDetector-researched patterns link to the measured-thresholds article', () => {
    for (const id of ['verb-inflation', 'hedge-stack', 'pseudo-wisdom', 'scene-setting']) {
      expect(moreUrlFor(id)).toBe('https://slopdetector.org/blog/signs-of-ai-writing');
    }
  });

  test('audit-batch patterns link to their own catalogues', () => {
    expect(moreUrlFor('transition-openers')).toBe(
      'https://scriptgrain.com/reference/ai-isms-in-marketing-copy');
    expect(moreUrlFor('literary-slop')).toBe(
      'https://scriptgrain.com/reference/ai-isms-in-marketing-copy');
    expect(moreUrlFor('staccato-fragments')).toBe(
      'https://www.contentbeta.com/blog/list-of-words-overused-by-ai/');
    expect(moreUrlFor('shapes-discussions')).toContain('en.wikipedia.org');
    expect(moreUrlFor('primary-source')).toContain('en.wikipedia.org');
  });

  test('unknown ids resolve safely', () => {
    expect(metaFor('does-not-exist')).toBeNull();
    expect(groupFor('does-not-exist')).toBe('Rhetorical tics');
  });

  test('colon-triple ships disabled by default', () => {
    expect(DEFAULT_DISABLED).toContain('colon-triple');
  });
});
