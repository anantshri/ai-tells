// Document-level "AI-likelihood" grading — the complement to the per-span
// phrase highlighter. Every signal here is model-free and O(n) over the page's
// visible text (no API, no ML), so it runs client-side during a scan.
//
// The non-negotiable caveat (see docs/FUTURE_WORK.md): NO single signal
// convicts. Each has an innocent explanation (formal registers, non-native
// writers, careful editing, CMS smart-quote filters). So we:
//   1. refuse to grade below a minimum text size,
//   2. surface a verdict only through *convergence* — how many independent
//      signals co-fire — never a single number, and
//   3. hand the popup a per-signal breakdown so the user sees the evidence.
//
// The toolbar badge shows the fired-signal COUNT, tinted by tier; the popup
// shows the whole breakdown plus the caveat.

// ---- thresholds (documented, deliberately conservative) ----------------

export const MIN_WORDS = 150;      // below this, refuse to grade
export const MIN_SENTENCES = 8;

const BURSTINESS_MAX_CV = 0.4;     // sentence-length CV below this ⇒ uniform ⇒ AI
const PARA_UNIFORM_MAX_CV = 0.4;   // paragraph-length CV below this ⇒ AI
const EMDASH_PER_1K = 10;          // em-dashes per 1k words above this ⇒ elevated
const TRANSITION_RATIO = 0.10;     // sentences opening with a transition adverb
const EXPLETIVE_RATIO = 0.10;      // sentences opening "It is / There are / This is"
const TRIAD_PER_1K = 5;            // rule-of-three triads per 1k words (>1 per 200)
const BOLD_LEAD_RATIO = 0.5;       // list items led by <strong>/<b>
const MIN_PARAGRAPHS = 4;          // paragraph-uniformity needs a few paragraphs
const MIN_LIST_ITEMS = 3;          // bold-lead-list needs a few items
const MIN_TRIADS = 2;              // a lone triad is ordinary prose

// Tier is a function of how many signals co-fire — convergence, not any one.
const TIER_COLOR = { low: '#16A34A', some: '#CA8A04', elevated: '#EA580C', high: '#DC2626' };
const TIER_LABEL = { low: 'Low', some: 'Some', elevated: 'Elevated', high: 'High' };

export function tierOf(firedCount) {
  if (firedCount >= 7) return 'high';
  if (firedCount >= 5) return 'elevated';
  if (firedCount >= 3) return 'some';
  return 'low';
}

// ---- text helpers ------------------------------------------------------

export function words(text) {
  return text.match(/[A-Za-z0-9][A-Za-z0-9'’-]*/g) || [];
}

// Split into sentences: break after . ! ? followed by space, and on newlines
// (flatten() inserts \n at block boundaries). Fragments with no letters/digits
// (stray punctuation) are dropped.
export function splitSentences(text) {
  return text
    .split(/(?<=[.!?])\s+|\n+/)
    .map((s) => s.trim())
    .filter((s) => /[A-Za-z0-9]/.test(s));
}

export function splitParagraphs(text) {
  return text
    .split(/\n+/)
    .map((s) => s.trim())
    .filter((s) => words(s).length > 0);
}

export function coefficientOfVariation(counts) {
  if (counts.length < 2) return null;
  const mean = counts.reduce((a, b) => a + b, 0) / counts.length;
  if (mean === 0) return null;
  const variance = counts.reduce((a, b) => a + (b - mean) ** 2, 0) / counts.length;
  return Math.sqrt(variance) / mean;
}

// Transition adverbs LLMs over-use to open sentences.
const TRANSITION_WORDS = new Set([
  'moreover', 'furthermore', 'additionally', 'consequently', 'notably',
  'importantly', 'ultimately', 'however', 'therefore', 'thus', 'hence',
  'indeed', 'overall', 'crucially', 'subsequently', 'nevertheless',
  'nonetheless', 'meanwhile', 'similarly', 'accordingly',
]);

const EXPLETIVE_OPENER = /^(?:it(?:['’]s|\s+is|\s+was)|there(?:['’]s|\s+is|\s+are|\s+was|\s+were)|this\s+is|these\s+are|that\s+is)\b/i;

const TRIAD = /\b[\w'’-]+(?:\s+[\w'’-]+){0,2},\s+[\w'’-]+(?:\s+[\w'’-]+){0,2},\s+and\s+[\w'’-]+(?:\s+[\w'’-]+){0,2}/gi;

// ---- individual signals ------------------------------------------------
// Each returns { key, label, applicable, fired, value, display }.

function signalBurstiness(sentences) {
  const lens = sentences.map((s) => words(s).length).filter((n) => n > 0);
  const cv = coefficientOfVariation(lens);
  const applicable = cv != null && lens.length >= 5;
  return {
    key: 'burstiness', label: 'Uniform sentence length', applicable,
    fired: applicable && cv < BURSTINESS_MAX_CV,
    value: cv,
    display: cv == null ? '—' : `CV ${cv.toFixed(2)} (AI < ${BURSTINESS_MAX_CV})`,
  };
}

function signalParagraphUniformity(paragraphs) {
  const lens = paragraphs.map((p) => words(p).length);
  const cv = coefficientOfVariation(lens);
  const applicable = cv != null && paragraphs.length >= MIN_PARAGRAPHS;
  return {
    key: 'para-uniform', label: 'Uniform paragraph length', applicable,
    fired: applicable && cv < PARA_UNIFORM_MAX_CV,
    value: cv,
    display: !applicable ? 'n/a (few paragraphs)' : `CV ${cv.toFixed(2)} (AI < ${PARA_UNIFORM_MAX_CV})`,
  };
}

function signalEmDash(text, wordCount) {
  const count = (text.match(/—/g) || []).length;
  const per1k = wordCount ? (count / wordCount) * 1000 : 0;
  return {
    key: 'em-dash', label: 'Em-dash density', applicable: true,
    fired: per1k > EMDASH_PER_1K,
    value: per1k,
    display: `${per1k.toFixed(1)} per 1k words (AI > ${EMDASH_PER_1K})`,
  };
}

function signalTransitionOpeners(sentences) {
  const applicable = sentences.length >= MIN_SENTENCES;
  let hits = 0;
  for (const s of sentences) {
    const first = (s.match(/[A-Za-z’']+/) || [''])[0].toLowerCase();
    if (TRANSITION_WORDS.has(first)) hits += 1;
  }
  const ratio = sentences.length ? hits / sentences.length : 0;
  return {
    key: 'transitions', label: 'Transition-word openers', applicable,
    fired: applicable && ratio > TRANSITION_RATIO,
    value: ratio,
    display: `${Math.round(ratio * 100)}% of sentences (AI > ${Math.round(TRANSITION_RATIO * 100)}%)`,
  };
}

function signalExpletiveOpeners(sentences) {
  const applicable = sentences.length >= MIN_SENTENCES;
  let hits = 0;
  for (const s of sentences) if (EXPLETIVE_OPENER.test(s)) hits += 1;
  const ratio = sentences.length ? hits / sentences.length : 0;
  return {
    key: 'expletives', label: 'Expletive openers ("It is…", "There are…")', applicable,
    fired: applicable && ratio > EXPLETIVE_RATIO,
    value: ratio,
    display: `${Math.round(ratio * 100)}% of sentences (AI > ${Math.round(EXPLETIVE_RATIO * 100)}%)`,
  };
}

function signalRuleOfThree(text, wordCount) {
  const triads = (text.match(TRIAD) || []).length;
  const per1k = wordCount ? (triads / wordCount) * 1000 : 0;
  return {
    key: 'rule-of-three', label: 'Rule-of-three triads', applicable: true,
    fired: triads >= MIN_TRIADS && per1k > TRIAD_PER_1K,
    value: per1k,
    display: `${triads} triad${triads === 1 ? '' : 's'} (${per1k.toFixed(1)} per 1k; AI > ${TRIAD_PER_1K})`,
  };
}

function signalTypography(text) {
  const curly = /[“”‘’]/.test(text);
  const ellipsis = text.includes('…') || text.includes('...');
  const emDash = text.includes('—');
  const present = [curly, ellipsis, emDash].filter(Boolean).length;
  return {
    key: 'typography', label: 'Unicode typography cluster', applicable: true,
    fired: present === 3,
    value: present,
    display: `${present}/3 of curly-quotes, ellipsis, em-dash`,
  };
}

function signalBoldLeadList(doc) {
  if (!doc || typeof doc.querySelectorAll !== 'function') {
    return { key: 'bold-list', label: 'Bold lead-in list items', applicable: false, fired: false, value: null, display: 'n/a' };
  }
  const items = doc.querySelectorAll('li');
  const total = items.length;
  let bold = 0;
  for (const li of items) {
    const first = li.firstElementChild;
    if (first && (first.tagName === 'STRONG' || first.tagName === 'B')) bold += 1;
  }
  const applicable = total >= MIN_LIST_ITEMS;
  const ratio = total ? bold / total : 0;
  return {
    key: 'bold-list', label: 'Bold lead-in list items', applicable,
    fired: applicable && ratio > BOLD_LEAD_RATIO,
    value: applicable ? ratio : null,
    display: !applicable ? 'n/a (few list items)' : `${Math.round(ratio * 100)}% of ${total} items (AI > ${Math.round(BOLD_LEAD_RATIO * 100)}%)`,
  };
}

// ---- the grade ---------------------------------------------------------

// gradePage(buffer, doc?) -> {
//   eligible, words, sentences, signals[], applicableCount, firedCount,
//   tier, tierLabel
// }
// `doc` is optional; without it the DOM-level bold-list signal is n/a.
export function gradePage(buffer, doc) {
  const text = typeof buffer === 'string' ? buffer : '';
  const wordCount = words(text).length;
  const sentences = splitSentences(text);
  const paragraphs = splitParagraphs(text);
  const eligible = wordCount >= MIN_WORDS && sentences.length >= MIN_SENTENCES;

  if (!eligible) {
    return {
      eligible: false, words: wordCount, sentences: sentences.length,
      signals: [], applicableCount: 0, firedCount: 0, tier: 'low', tierLabel: TIER_LABEL.low,
    };
  }

  const signals = [
    signalBurstiness(sentences),
    signalParagraphUniformity(paragraphs),
    signalEmDash(text, wordCount),
    signalTransitionOpeners(sentences),
    signalExpletiveOpeners(sentences),
    signalRuleOfThree(text, wordCount),
    signalTypography(text),
    signalBoldLeadList(doc),
  ];

  const firedCount = signals.filter((s) => s.fired).length;
  const applicableCount = signals.filter((s) => s.applicable).length;
  const tier = tierOf(firedCount);

  return {
    eligible: true, words: wordCount, sentences: sentences.length,
    signals, applicableCount, firedCount, tier, tierLabel: TIER_LABEL[tier],
  };
}

// Map a grade onto the toolbar badge. Returns null when the page can't be
// graded (too little text) — the caller clears the badge. Otherwise the badge
// shows the fired-signal count, tinted by tier.
export function badgeForGrade(grade) {
  if (!grade || !grade.eligible) return null;
  return { text: String(grade.firedCount), color: TIER_COLOR[grade.tier] };
}

export { TIER_COLOR, TIER_LABEL };
