import { describe, test, expect } from 'vitest';
import { JSDOM } from 'jsdom';
import {
  gradePage,
  badgeForGrade,
  tierOf,
  words,
  splitSentences,
  splitParagraphs,
  coefficientOfVariation,
  TIER_COLOR,
  MIN_WORDS,
} from '../src/stats.js';

// An AI-flavored passage: uniform sentence length, transition + expletive
// openers, packed rule-of-three triads, and the curly-quote/ellipsis/em-dash
// typography cluster. Tuned to converge on several independent signals.
const AI_TEXT = `Moreover, the platform delivers a seamless, efficient, and reliable experience for every user. It is important to understand that the “platform” scales gracefully under heavy production load. Furthermore, engineers can deploy, monitor, and optimize their services without any manual intervention. There are many reasons why teams adopt this approach for their most critical workloads today.

This is a solution that balances speed, safety, and cost across the entire modern stack. Additionally, the framework supports building, testing, and shipping within one unified developer workflow. Notably, the results were consistent, predictable, and repeatable across every environment we measured — always. Ultimately, the tooling removes friction, reduces toil, and accelerates delivery for the whole organization…

Consequently, adoption grew across design, engineering, and operations within a single fiscal quarter. It is clear that the numbers improved steadily, quietly, and dramatically over the trailing year. This is the kind of outcome that leaders expect, demand, and ultimately reward with real budget.`;

// A human passage: varied sentence lengths, no transition/expletive openers,
// no em-dashes, no typography cluster.
const HUMAN_TEXT = `I spent Saturday fixing the fence. The storm last week had knocked two posts clean out of the ground, and the gate was hanging by a single hinge. My neighbour wandered over with coffee and we argued, cheerfully, about whether concrete was overkill for a fence that has survived thirty winters already.

It wasn't. By noon the rain came back. We gave up, sat under the porch, and watched the dog chase nothing across the yard for the better part of an hour. Sometimes a wasted afternoon is exactly the point of an afternoon, if you let it be.

I will finish the fence next weekend. Or maybe I won't. Either way the dog does not care one bit, and honestly neither do I when the coffee is good and the company is better. My neighbour left around three, still grumbling about the concrete, and I stayed out there a while longer just listening to the rain hammer the tin roof of the shed.`;

describe('text helpers', () => {
  test('words tokenises on letters/digits', () => {
    expect(words('Two rules, one bug.')).toEqual(['Two', 'rules', 'one', 'bug']);
    expect(words('   ').length).toBe(0);
  });

  test('splitSentences breaks on terminal punctuation and newlines', () => {
    expect(splitSentences('One. Two! Three?')).toEqual(['One.', 'Two!', 'Three?']);
    expect(splitSentences('Line one\nLine two')).toEqual(['Line one', 'Line two']);
    expect(splitSentences('   ...   ')).toEqual([]); // no letters/digits
  });

  test('splitParagraphs splits on blank lines', () => {
    expect(splitParagraphs('A para.\n\nB para.').length).toBe(2);
    expect(splitParagraphs('\n\n   \n').length).toBe(0);
  });

  test('coefficientOfVariation: zero for uniform, null for tiny/zero-mean input', () => {
    expect(coefficientOfVariation([5, 5, 5, 5])).toBe(0);
    expect(coefficientOfVariation([1])).toBeNull();
    expect(coefficientOfVariation([0, 0])).toBeNull();
    expect(coefficientOfVariation([2, 4, 6, 8])).toBeGreaterThan(0);
  });
});

describe('tierOf convergence thresholds', () => {
  test('maps fired-signal count to a tier', () => {
    expect(tierOf(0)).toBe('low');
    expect(tierOf(2)).toBe('low');
    expect(tierOf(3)).toBe('some');
    expect(tierOf(4)).toBe('some');
    expect(tierOf(5)).toBe('elevated');
    expect(tierOf(6)).toBe('elevated');
    expect(tierOf(7)).toBe('high');
    expect(tierOf(9)).toBe('high');
  });
});

describe('gradePage eligibility', () => {
  test('refuses to grade text below the minimum size', () => {
    const g = gradePage('Too little text to fairly grade at all here.', null);
    expect(g.eligible).toBe(false);
    expect(g.firedCount).toBe(0);
    expect(g.signals).toEqual([]);
    expect(badgeForGrade(g)).toBeNull();
  });

  test('MIN_WORDS is exported for the popup message', () => {
    expect(MIN_WORDS).toBeGreaterThanOrEqual(100);
  });

  test('tolerates a non-string buffer', () => {
    expect(gradePage(null, null).eligible).toBe(false);
    expect(gradePage(undefined, null).eligible).toBe(false);
  });
});

describe('gradePage on AI-flavored text', () => {
  const g = gradePage(AI_TEXT, null);

  test('is eligible and converges on several signals', () => {
    expect(g.eligible).toBe(true);
    expect(g.firedCount).toBeGreaterThanOrEqual(5);
    expect(['elevated', 'high']).toContain(g.tier);
  });

  test('fires the expected independent signals', () => {
    const fired = new Set(g.signals.filter((s) => s.fired).map((s) => s.key));
    for (const key of ['burstiness', 'transitions', 'expletives', 'rule-of-three', 'typography']) {
      expect(fired.has(key)).toBe(true);
    }
  });

  test('badge shows the fired count tinted by tier', () => {
    const badge = badgeForGrade(g);
    expect(badge.text).toBe(String(g.firedCount));
    expect(badge.color).toBe(TIER_COLOR[g.tier]);
  });
});

describe('gradePage on human text', () => {
  const g = gradePage(HUMAN_TEXT, null);

  test('is eligible but stays low with no signals firing', () => {
    expect(g.eligible).toBe(true);
    expect(g.firedCount).toBe(0);
    expect(g.tier).toBe('low');
  });

  test('badge shows a green zero (scored and clean)', () => {
    expect(badgeForGrade(g)).toEqual({ text: '0', color: TIER_COLOR.low });
  });
});

describe('bold-lead-in list signal (DOM)', () => {
  const boldListDoc = (itemsHtml) =>
    new JSDOM(`<body><ul>${itemsHtml}</ul></body>`).window.document;

  test('fires when most list items lead with <strong>/<b>', () => {
    const doc = boldListDoc(
      '<li><strong>Speed:</strong> fast</li><li><strong>Safety:</strong> secure</li><li><b>Cost:</b> low</li>',
    );
    const g = gradePage(HUMAN_TEXT, doc);
    const bold = g.signals.find((s) => s.key === 'bold-list');
    expect(bold.applicable).toBe(true);
    expect(bold.fired).toBe(true);
  });

  test('does not fire on ordinary list items', () => {
    const doc = boldListDoc('<li>one</li><li>two</li><li>three</li>');
    const g = gradePage(HUMAN_TEXT, doc);
    const bold = g.signals.find((s) => s.key === 'bold-list');
    expect(bold.applicable).toBe(true);
    expect(bold.fired).toBe(false);
  });

  test('is not applicable without a document', () => {
    const g = gradePage(HUMAN_TEXT, null);
    const bold = g.signals.find((s) => s.key === 'bold-list');
    expect(bold.applicable).toBe(false);
    expect(bold.fired).toBe(false);
  });

  test('is not applicable with too few list items', () => {
    const doc = boldListDoc('<li><strong>Only:</strong> one</li>');
    const bold = gradePage(HUMAN_TEXT, doc).signals.find((s) => s.key === 'bold-list');
    expect(bold.applicable).toBe(false);
    expect(bold.value).toBeNull();
    expect(bold.display).toMatch(/few list items/);
  });

  test('is not applicable when the page has no lists at all', () => {
    const doc = new JSDOM('<body><p>No lists here.</p></body>').window.document;
    const bold = gradePage(HUMAN_TEXT, doc).signals.find((s) => s.key === 'bold-list');
    expect(bold.applicable).toBe(false);
    expect(bold.fired).toBe(false);
  });
});

describe('signal display edge cases', () => {
  test('rule-of-three renders a singular "triad" and stays unfired at one', () => {
    const g = gradePage(`${HUMAN_TEXT} The flag is red, white, and blue.`, null);
    const triad = g.signals.find((s) => s.key === 'rule-of-three');
    expect(triad.display).toMatch(/^1 triad\b/);
    expect(triad.fired).toBe(false); // a lone triad is ordinary prose
  });

  test('typography counts an ASCII "..." ellipsis', () => {
    const g = gradePage(`${HUMAN_TEXT} Wait for it... there.`, null);
    const typo = g.signals.find((s) => s.key === 'typography');
    expect(typo.value).toBeGreaterThanOrEqual(1);
  });
});
