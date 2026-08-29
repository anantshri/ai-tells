// AUTO-PORTED verbatim from Simon Willison's llm-cliche-highlighter
// https://tools.simonwillison.net/llm-cliche-highlighter
// The detector logic below is copied unchanged; only ES-module exports are appended.

// Each pattern: { id, name, description, find(text) -> [{ start, end, badge?, badgeTitle?, count? }] }
// Add new patterns to this array and they get a checkbox, per-pattern count, and highlighting for free.
// makeChainFinder builds a detector for "HEAD X, HEAD Y, ..." lists and counts the items;
// makeRegexFinder wraps a plain regex (must use the g flag); makeEchoFinder builds a
// detector for runs of consecutive sentences repeating the same multi-word skeleton;
// makeQuestionChainFinder flags runs of consecutive question sentences; and
// makeAnaphoraFinder flags runs of consecutive sentences opening on the same word.

// DEVIATION FROM THE VERBATIM PORT (behaviour identical, proven by the ported
// tests): the reference built each chain regex with `new RegExp(...)` from a
// `head` string argument. That trips semgrep's detect-non-literal-regexp (ReDoS)
// rule, so the two chain regexes are hoisted to hardcoded literals below and
// makeChainFinder now takes the compiled regex directly. The separator grammar
// used for counting items is the shared CHAIN_SPLIT literal.
const CHAIN_SPLIT = /(?:\s*,\s*(?:and\s+|or\s+)?|\s+(?:and|or)\s+|\s*[;&\u2013\u2014]\s*(?:and\s+|or\s+)?|\s+-{1,2}\s+)/i;

function makeChainFinder(chain, headTest, itemLabel) {
  return function (text) {
    const found = [];
    for (const m of text.matchAll(chain)) {
      let end = m.index + m[0].length;
      while (end > m.index && /\s/.test(text[end - 1])) end -= 1;
      const count = m[0].split(CHAIN_SPLIT).filter(p => headTest.test(p.trim())).length;
      found.push({
        start: m.index,
        end,
        count,
        badge: String(count),
        badgeTitle: count + ' ' + itemLabel + (count === 1 ? '' : 's')
      });
    }
    return found;
  };
}

function makeRegexFinder(re) {
  return function (text) {
    const found = [];
    for (const m of text.matchAll(re)) {
      found.push({ start: m.index, end: m.index + m[0].length });
    }
    return found;
  };
}

// makeEchoFinder builds a detector for runs of consecutive sentences that
// repeat the same multi-word skeleton -- the "X does A. Y does B." triad.
// The badge counts the echoing sentences.
function makeEchoFinder({ minGram = 3, minRun = 2 } = {}) {
  const SENT = /[^.!?\n]+[.!?]?/g;
  const grams = (s, n) => {
    const w = s.toLowerCase().match(/[a-z0-9'’-]+/g) || [];
    const out = new Set();
    for (let i = 0; i + n <= w.length; i++) out.add(w.slice(i, i + n).join(' '));
    return out;
  };
  return function (text) {
    const sents = [];
    for (const m of text.matchAll(SENT)) {
      if ((m[0].match(/\S+/g) || []).length >= 4) {
        sents.push({ start: m.index, end: m.index + m[0].length, text: m[0] });
      }
    }
    const found = [];
    let i = 0;
    while (i < sents.length) {
      let j = i;
      let shared = null;
      while (j + 1 < sents.length) {
        if (sents[j + 1].start - sents[j].end > 3) break; // adjacent prose only
        const a = grams(sents[j].text, minGram);
        const b = grams(sents[j + 1].text, minGram);
        const common = [...a].filter(g => b.has(g));
        if (!common.length) break;
        shared = common.sort((x, y) => y.length - x.length)[0];
        j += 1;
      }
      const run = j - i + 1;
      if (run >= minRun && shared) {
        let end = sents[j].end;
        while (end > sents[i].start && /\s/.test(text[end - 1])) end -= 1;
        found.push({
          start: sents[i].start,
          end,
          count: run,
          badge: String(run),
          badgeTitle: run + ' sentences echoing “' + shared + '”'
        });
        i = j + 1;
      } else {
        i += 1;
      }
    }
    return found;
  };
}

// Flags runs of consecutive question sentences -- the stacked rhetorical
// interrogation. The badge counts the questions.
function makeQuestionChainFinder({ minRun = 2 } = {}) {
  // The {1,400} bound (vs the reference's unbounded +) caps backtracking so a
  // long run with no `?` is O(n) instead of O(n^2) on attacker-controlled page
  // text; real questions are far shorter than 400 chars.
  const chain = /[^.!?\n]{1,400}\?(?:\s+[^.!?\n]{1,400}\?)+/g;
  return function (text) {
    const found = [];
    for (const m of text.matchAll(chain)) {
      const count = (m[0].match(/\?/g) || []).length;
      if (count < minRun) continue;
      let start = m.index;
      while (start < m.index + m[0].length && /\s/.test(text[start])) start += 1;
      found.push({
        start,
        end: m.index + m[0].length,
        count,
        badge: String(count),
        badgeTitle: count + ' questions in a row'
      });
    }
    return found;
  };
}

// Flags runs of consecutive sentences opening on the same word -- "Maybe X.
// Maybe Y. Maybe Z." Pronouns and articles are skipped, since repeating those
// is just ordinary prose. The badge counts the sentences.
const ANAPHORA_SKIP = /^(?:i|it|the|a|an|this|that|we|you|they|he|she|there|but|and|so|in|as|if|my|his|her|their|its|these|those|for|at|on|of|to|is|was)$/i;
function makeAnaphoraFinder({ minRun = 3 } = {}) {
  // {1,400} bound caps backtracking on a long terminator-free run (O(n) not
  // O(n^2)); see makeQuestionChainFinder.
  const SENT = /[^.!?\n]{1,400}[.!?]/g;
  return function (text) {
    const sents = [];
    for (const m of text.matchAll(SENT)) {
      const w = m[0].match(/[A-Za-z'’-]+/);
      if (w) {
        sents.push({
          start: m.index + m[0].indexOf(w[0]),
          end: m.index + m[0].length,
          head: w[0].toLowerCase()
        });
      }
    }
    const found = [];
    let i = 0;
    while (i < sents.length) {
      let j = i;
      while (j + 1 < sents.length && sents[j + 1].head === sents[i].head
             && sents[j + 1].start - sents[j].end < 4) j += 1;
      const run = j - i + 1;
      if (run >= minRun && !ANAPHORA_SKIP.test(sents[i].head)) {
        found.push({
          start: sents[i].start,
          end: sents[j].end,
          count: run,
          badge: String(run),
          badgeTitle: run + ' sentences opening “' + sents[i].head + '”'
        });
        i = j + 1;
      } else i += 1;
    }
    return found;
  };
}

// Patterns in this group are adapted from Wikipedia's "Signs of AI writing"
// guide: https://en.wikipedia.org/wiki/Wikipedia:Signs_of_AI_writing
const WIKI_GROUP = 'Signs of AI writing (Wikipedia)';

const patterns = [
  {
    id: 'no-chain',
    name: '“No X, no Y” chains',
    description: 'Two or more “no …” items in a row, e.g. “No fluff, no filler, no jargon.” The badge counts the “no” items.',
    find: makeChainFinder(/\bno[-\s][^,.;:!?\n\u2013\u2014\u2026]{0,400}(?:(?:\s*,\s*(?:and\s+|or\s+)?|\s+(?:and|or)\s+|\s*[;&\u2013\u2014]\s*(?:and\s+|or\s+)?|\s+-{1,2}\s+)no[-\s][^,.;:!?\n\u2013\u2014\u2026]{0,400})+/gi, /^no[-\s]/i, '\u201cno\u201d item')
  },
  {
    id: 'whole',
    name: '“That’s the whole …”',
    description: '“That / this is the whole point, game, thing …”',
    find: makeRegexFinder(/\b(?:that|this)(?:['\u2019]s|\s+(?:is|was))\s+the\s+whole\b(?:\s+\w+)?/gi)
  },
  {
    id: 'did-not-chain',
    name: '“Did not X, did not Y” chains',
    description: 'Two or more “did not …” or “didn’t …” items in a row. The badge counts the items.',
    find: makeChainFinder(/\b(?:did\s+not|didn['\u2019]t)\s[^,.;:!?\n\u2013\u2014\u2026]{0,400}(?:(?:\s*,\s*(?:and\s+|or\s+)?|\s+(?:and|or)\s+|\s*[;&\u2013\u2014]\s*(?:and\s+|or\s+)?|\s+-{1,2}\s+)(?:did\s+not|didn['\u2019]t)\s[^,.;:!?\n\u2013\u2014\u2026]{0,400})+/gi, /^(?:did\s+not|didn['\u2019]t)\s/i, '\u201cdid not\u201d item')
  },
  {
    id: 'dont-verb-it',
    name: '“Don’t VERB it … VERB it”',
    description: '“Don’t call it X. Call it Y.” — a negated verb + “it”, then the same verb + “it” again.',
    find: makeRegexFinder(/\b(?:do\s+not|don['\u2019]t)\s+(?:just\s+|simply\s+|merely\s+)?(\w+)(?:\s+(?:of|about|at|on|for|with|to))?\s+it\b[^.!?\n]*?[.!?;,:\u2013\u2014]['"\u201d\u2019]*\s*(?:just\s+|simply\s+|merely\s+)?\1(?:\s+(?:of|about|at|on|for|with|to))?\s+it\b/gi)
  },
  {
    id: 'sit-with',
    name: '“Sit with that”',
    description: 'The reflective “sit with that / this / it (for a moment)”, plus “sit with the discomfort” and friends.',
    find: makeRegexFinder(/\bsit(?:s|ting)?\s+with\s+(?:that|this|it|(?:the|your)\s+(?:discomfort|feelings?|tension|weight|uncertainty|ambiguity|grief|silence|unease))\b(?:\s+for\s+a\s+\w+)?/gi)
  },
  {
    id: 'already-know',
    name: '“You already know”',
    description: '“You already know” — the answer, what to do, or standing alone before a full stop.',
    find: makeRegexFinder(/\byou\s+already\s+knows?\s+(?:the\s+answer|what|how|why|this|that|it|who|where)\b|\byou\s+already\s+knows?\b(?![ \t]+\w)/gi)
  },
  {
    id: 'is-the-entire',
    name: '“Is the entire …”',
    description: '“X is the entire point / game / business model.”',
    find: makeRegexFinder(/(?:\b(?:is|was|are|were)|['\u2019]s)\s+the\s+entire\b(?:\s+\w+)?/gi)
  },
  {
    id: 'the-entire-is',
    name: '“The entire … is”',
    description: '“The entire point / game / business model is …” — the flipped twin of “is the entire”.',
    find: makeRegexFinder(/\bthe\s+entire\s+[\w'\u2019-]+(?:\s+[\w'\u2019-]+){0,4}?\s+(?:is|was|are|were)\b/gi)
  },
  {
    id: 'is-real',
    name: '“Is real … and / not”',
    description: '“The X is real, and / not …”, including “is the real … and it”. Skips “real estate”, “real time”, and similar.',
    find: makeRegexFinder(/\bis\s+(?:(?:the|a)\s+real\b(?![\s-]+(?:estate|time|life|world|quick)\b)[^.!?\n]*?\b(?:and|not)\s+it\b|real\b(?![\s-]+(?:estate|time|life|world|quick)\b)[^.!?\n]*?\b(?:and|not)\b)/gi)
  },
  {
    id: 'punchline',
    name: '“The punchline is”',
    description: '“The punchline is …”, “the punchline:”, or “the punchline?”.',
    find: makeRegexFinder(/\bthe\s+punchline(?:\s+(?:is|was|being)\b|\s*[:?])/gi)
  },
  {
    id: 'worth-naming',
    name: '“Worth naming”',
    description: 'The therapist-voiced “that loss is real and it’s worth naming”, “it’s worth naming that …”, or a “Worth naming:” opener. Skips “naming names”.',
    find: makeRegexFinder(/(?:\b(?:is|are|was|were|feels?|felt|seems?|seemed)|['\u2019]s)\s+(?:\w+\s+){0,2}?worth\s+naming\b(?!\s+names\b)|\bworth\s+naming\s*:/gi)
  },
  {
    id: 'not-nothing',
    name: '\u201cThat\u2019s not nothing\u201d',
    description: '\u201cThat is not nothing\u201d / \u201cthat\u2019s not nothing\u201d, plus the \u201cthis / it / which is not nothing\u201d variants.',
    find: makeRegexFinder(/\b(?:that|this|it|which)(?:['\u2019]s|\s+(?:is|was))\s+not\s+nothing\b/gi)
  },
  {
    id: 'is-the-whole',
    name: '“Is the whole …”',
    description: 'Any subject + “is the whole point / trick / pitch / idea”, plus the “here is the whole …” opener. The twin of “is the entire …”, and a generalisation of “That’s the whole …” to subjects other than that/this.',
    find: makeRegexFinder(/(?:\b(?:is|was|are|were)|['’]s)\s+the\s+whole\b(?:\s+\w+)?|\bhere(?:['’]s|\s+is)\s+the\s+whole\b(?:\s+\w+)?/gi)
  },
  {
    id: 'echo-triad',
    name: 'Echoing sentence runs',
    description: 'Consecutive sentences built on the same repeated skeleton — “A shopping cart is an object in the system. A chat room is an object in the system.” The badge counts the echoing sentences.',
    find: makeEchoFinder({ minGram: 4, minRun: 2 })
  },
  {
    id: 'performative-honesty',
    name: 'Performative honesty',
    description: 'Sincerity announced rather than demonstrated: “I won’t pretend”, “I’ll be honest”, “let’s be honest”, “to be clear”, and sentence-initial “Honestly,” or “Look,”.',
    find: makeRegexFinder(/\bI\s+(?:will\s+not|won['’]t)\s+pretend\b|\b(?:I['’]ll|let['’]s|to)\s+be\s+(?:honest|clear|blunt|real)\b|(?:^|[.!?–—]\s+|\n)(?:Honestly|Look|Truthfully|Frankly)\s*,/gi)
  },
  {
    id: 'thats-the-part',
    name: '“That’s the part …”',
    description: 'Gesturing at a favoured detail instead of stating it: “that is the part a counter can’t reach”, “the part that makes me trust the rest”, “my favourite part of …”.',
    find: makeRegexFinder(/\b(?:that|this|it)(?:['’]s|\s+(?:is|was))\s+the\s+part\b|\bthe\s+part\s+that\s+(?:makes|made|gets|got|keeps|kept)\s+(?:me|you|us|it)\b|\bmy\s+favou?rite\s+part\s+of\b/gi)
  },
  {
    id: 'the-only-i-trust',
    name: '“The only X I trust”',
    description: 'The narrowing superlative reveal: “the only marketing I trust”, “the only thing it needs”, “the only X that matters”.',
    find: makeRegexFinder(/\bthe\s+only\s+[\w'’-]+(?:\s+[\w'’-]+){0,2}?\s+(?:I|you|we|it|he|she|they)\s+(?:trust|need|needs|care|want|wants|use|uses|believe)\b|\bthe\s+only\s+[\w'’-]+\s+that\s+(?:matters|counts|works|survives)\b/gi)
  },
  {
    id: 'take-my-word',
    name: '“Don’t take my word for it”',
    description: 'The stock invitation to verify: “you don’t have to take my word for it”, “don’t take my word for any of this”.',
    find: makeRegexFinder(/\b(?:you\s+)?(?:do\s+not|don['’]t)\s+(?:have\s+to\s+)?take\s+my\s+word\s+for\s+(?:it|any\s+of\s+(?:it|this|that))\b/gi)
  },
  {
    id: 'turns-out',
    name: '“Turns out …”',
    description: 'The casual-revelation opener, almost always bolted to a tidy conclusion: “Turns out X”, “it turns out that X”.',
    find: makeRegexFinder(/(?:^|[.!?–—]\s+|\n)Turns\s+out\b|\bit\s+turns\s+out\s+that\b/gi)
  },
  {
    id: 'fits-in-your-head',
    name: '“Fits in your head”',
    description: 'Dev-blog boilerplate for simplicity: “small enough to hold in your head”, “batteries included”, “it just works”, “zero config”, “sane defaults”.',
    find: makeRegexFinder(/\b(?:hold|fit|fits|holds|held)\s+(?:it\s+)?in\s+your\s+head\b|\bbatteries[-\s]included\b|\bit\s+just\s+works\b|\bzero[-\s]config(?:uration)?\b|\bsane\s+defaults\b/gi)
  },
  {
    id: 'stacked-questions',
    name: 'Stacked rhetorical questions',
    description: 'Two or more questions fired in a row, usually fragments after the first: “Do I know how it works? Where it breaks? Which corners it cut?” The badge counts the questions.',
    find: makeQuestionChainFinder({ minRun: 2 })
  },
  {
    id: 'sentence-anaphora',
    name: 'Repeated sentence openers',
    description: 'Three or more consecutive sentences starting on the same word — “Maybe nobody needed it. Maybe it introduced … Maybe a small convenience …” Pronouns and articles are ignored. The badge counts the sentences.',
    find: makeAnaphoraFinder({ minRun: 3 })
  },
  {
    id: 'colon-triple',
    name: 'Colon into a triple',
    description: 'A colon opening onto three or more comma-separated items: “separate ports, processes, and local state”. The most common shape LLM prose uses to sound concrete. Noisy in technical writing — leave it off by default if your corpus is documentation.',
    find: makeRegexFinder(/:\s+[^.!?;:\n]{2,40},\s+[^.!?;:\n]{2,40},\s+(?:and\s+|or\s+)?[^.!?;:\n]{2,40}(?=[.!?\n])/g)
  },
  {
    id: 'heres-the-twist',
    name: '“Here’s the twist”',
    description: 'The stage-managed reveal: “here’s the twist”, “here’s the thing”, “here’s the catch / kicker / rub”, “here’s the first example:”.',
    find: makeRegexFinder(/\bhere(?:['’]s|\s+is)\s+(?:the|a|my|one)\s+(?:twist|thing|catch|kicker|rub|problem|first|second|third|next|recent|real|best|worst|surprising|interesting|key|important)\b[\w\s-]{0,20}[:.]/gi)
  },
  {
    id: 'x-is-dead',
    name: '“X is dead”',
    description: 'The obituary headline and its sequel: “peer code review is dead”, “botd is dead; long live botd”.',
    find: makeRegexFinder(/\b[\w\s]{3,30}\s+(?:is|are)\s+dead\b|\blong\s+live\s+\w+/gi)
  },
  {
    id: 'thats-why-mattered',
    name: '“That’s why X mattered”',
    description: 'Retroactively assigning significance: “that’s why being able to open the environment mattered”, “this is why preserving every conversation mattered”.',
    find: makeRegexFinder(/\b(?:that|this)(?:['’]s|\s+(?:is|was))\s+why\b[^.!?\n]{0,80}?\b(?:matter(?:s|ed)?|count(?:s|ed)?)\b/gi)
  },
  {
    id: 'stranded-auxiliary',
    name: 'Stranded auxiliary contrast',
    description: 'A clause that lands on a bare auxiliary for the reversal: “The tool died; the data didn’t.”, “Reading mostly passed … Writing didn’t”, “Maybe it wouldn’t have.”',
    find: makeRegexFinder(/[;:,]\s+[^.;:!?\n]{2,50}\s(?:did|does|do|was|were|is|are|has|have|had|can|could|would|will)(?:n['’]t)?\s*[.;]|\b(?:Maybe|Perhaps)\s+\w+[^.!?\n]{0,40}\s(?:would|could|might|should|did|had|was|is)(?:n['’]t)?\s+(?:have\s*)?\./g)
  },
  {
    id: 'chat-boilerplate',
    name: 'Chatbot pleasantries',
    description: 'Conversational filler pasted from an assistant reply: sentence-initial “Certainly!”, “Absolutely!”, “Great question”, plus “I’d be happy to help”, “I hope this helps”, “feel free to / don’t hesitate to”, “let me know if you …”.',
    find: makeRegexFinder(/(?:^|[.!?"'”’\n–—]\s*)(?:certainly|absolutely|of\s+course|great\s+question|excellent\s+question)\s*[!,]|\bI(?:['’]d|\s+would)\s+be\s+(?:more\s+than\s+)?happy\s+to\s+help\b|\bI\s+hope\s+this\s+helps\b|\b(?:feel\s+free|do\s+not\s+hesitate|don['’]t\s+hesitate)\s+to\b|\blet\s+me\s+know\s+if\s+you\b/gi)
  },
  {
    id: 'scene-setting',
    name: '“In today’s fast-paced world”',
    description: 'Throat-clearing openers that set an epochal scene: “in today’s fast-paced / digital / ever-changing world”, “in a world where”, “in the realm of”, “when it comes to”.',
    find: makeRegexFinder(/\bin\s+(?:today['’]s|a|the|this|our)\s+(?:fast-paced|ever-(?:changing|evolving)|rapidly\s+(?:changing|evolving)|digital|modern|competitive|hyper-connected)\s+(?:world|age|era|landscape|society|market|economy)\b|\bin\s+a\s+world\s+where\b|\bin\s+the\s+realm\s+of\b|\bwhen\s+it\s+comes\s+to\b/gi)
  },
  {
    id: 'journey-metaphor',
    name: 'Journey & discovery metaphors',
    description: 'Grand exploration imagery: “embark on a journey”, “navigating the complexities of”, “pave the way”, “unlock the potential/secrets”, “shed light on”, “at the forefront of”, “a beacon of”, “treasure trove”.',
    find: makeRegexFinder(/\bembark(?:ing|ed)?\s+on\s+(?:a|an|this)\s+(?:journey|adventure|quest|exploration|voyage)\b|\bnavigat(?:e|es|ing|ed)\s+the\s+(?:complex\w*|landscape|world|challenges|intricacies|maze|nuances)\b|\bpav(?:e|es|ed|ing)\s+the\s+way\b|\bunlock(?:s|ing|ed)?\s+the\s+(?:power|potential|secret|secrets|key)\b|\bshed(?:ding)?\s+light\s+on\b|\bat\s+the\s+forefront\s+of\b|\ba\s+beacon\s+of\b|\btreasure\s+trove\b/gi)
  },
  {
    id: 'dive-in',
    name: '“Dive into / deep dive”',
    description: 'The invitation-to-explore cliché: “let’s dive into”, “dive deep into”, “deep dive”, “let’s explore”, “let’s take a closer look”.',
    find: makeRegexFinder(/\b(?:dive|diving|dives)\s+(?:deep\s+)?into\b|\bdeep\s+dive\b|\blet['’]s\s+(?:dive\s+in\b|explore\b|take\s+a\s+(?:closer\s+)?look\b)/gi)
  },
  {
    id: 'hype-buzzwords',
    name: 'Hype & marketing buzzwords',
    description: 'Empty superlatives and business jargon: “game-changer”, “cutting-edge”, “state-of-the-art”, “top-notch”, “best-in-class”, “next-level”, “world-class”, “the possibilities are endless”, “move the needle”, “low-hanging fruit”, “paradigm shift”.',
    find: makeRegexFinder(/\bgame[-\s]?chang(?:er|ing)\b|\bcutting[-\s]edge\b|\btop[-\s]notch\b|\bstate[-\s]of[-\s]the[-\s]art\b|\bbest[-\s]in[-\s]class\b|\bnext[-\s]level\b|\bworld[-\s]class\b|\bthe\s+possibilities\s+are\s+endless\b|\bmove\s+the\s+needle\b|\blow[-\s]hanging\s+fruit\b|\bparadigm\s+shift\b|\btake\s+it\s+to\s+the\s+next\s+level\b/gi)
  },
  {
    id: 'conclusion-wrapper',
    name: 'Formulaic conclusions',
    description: 'Boilerplate wrap-up openers: sentence-initial “In conclusion”, “In summary”, “In essence”, “To sum up”, “All in all”, “At the end of the day”, “Ultimately,”.',
    find: makeRegexFinder(/(?:^|[.!?\n–—]\s+)(?:In\s+conclusion|In\s+summary|In\s+essence|To\s+sum\s+up|To\s+summari[sz]e|All\s+in\s+all|At\s+the\s+end\s+of\s+the\s+day|Ultimately)\s*,/gi)
  },
  {
    id: 'cataphoric-teaser',
    name: 'Cataphoric teaser',
    description: 'The forward-referencing suspense hook — a payoff withheld to manufacture cheap curiosity, the LLM descendant of clickbait: “Here’s the part that nobody tells you”, “Here’s what most people get wrong”, “The part most people sleep on”, “what nobody tells you”.',
    find: makeRegexFinder(/\bhere(?:['’]s|\s+is)\s+(?:what\s+|the\s+[\w'’-]+\s+)(?:that\s+)?(?:most\s+people|nobody|no\s+one|everyone|they|you)\b|\bthe\s+(?:part|thing|secret|trick|detail|bit|reason|truth|catch)\s+(?:that\s+)?(?:most\s+people|nobody|no\s+one|everyone)\b|\bwhat\s+(?:most\s+people|nobody|no\s+one|everyone)\s+(?:get|gets|got)\s+(?:wrong|right)\b|\bwhat\s+(?:nobody|no\s+one)\s+(?:tell|tells|told)s?\s+you\b|\b(?:that\s+)?(?:nobody|no\s+one)\s+(?:talks|talked|tells|told)\s+(?:about|you)\b|\bmost\s+people\s+(?:sleep\s+on\b|miss\b|overlook\b|get\s+(?:this|it|that)\s+wrong\b)|\b(?:it|this|that)(?:['’]s|\s+is)\s+not\s+what\s+you\s+(?:think|expect|expected|imagine)\b/gi)
  },
  {
    id: 'hook-opener',
    name: 'Superlative hook opener',
    description: 'The engagement-bait opener that promises a hot take: “What I find most annoying about …”, “The stupidest thing you could do is …”, “The most interesting thing to notice is …”.',
    find: makeRegexFinder(/\bwhat\s+I\s+(?:find|found)\s+(?:most|so|really|truly|absolutely|the\s+most)\s+[\w-]+\s+about\b|\bthe\s+(?:single\s+)?(?:most|least|best|worst|smartest|dumbest|stupidest|craziest|weirdest|biggest|hardest|coolest|scariest|wildest)\s+(?:[\w-]+\s+)?(?:thing|mistake|lesson|part|move|advice)\s+(?:you|we|i|they|anyone|to)\b/gi)
  },
  {
    id: 'false-authority',
    name: 'Vague appeals to research',
    description: 'Hand-waving at unnamed evidence: “studies have shown”, “research suggests / indicates”, “data shows”, “science tells us”, “the data speaks for itself”, “it is widely believed”, “many people argue”.',
    find: makeRegexFinder(/\b(?:studies|research|data|science|evidence)\s+(?:have\s+|has\s+|consistently\s+)?(?:shows?|shown|suggests?|indicates?|reveals?|proves?|demonstrates?|confirms?|tells?\s+us|speaks?\s+for\s+itself)\b|\bit\s+is\s+widely\s+(?:known|believed|accepted|regarded|recognized)\b|\b(?:many|some)\s+(?:people\s+)?(?:believe|argue|would\s+argue|claim)\b/gi)
  },
  {
    id: 'corporate-buzzwords',
    name: 'Corporate buzzword pairings',
    description: 'Meaningless business collocations: “robust framework”, “holistic approach”, “seamless integration”, “comprehensive solution”, “actionable insights”, “value proposition”, “core competency”, “synergy”, “mission-critical”, “thought leadership”.',
    find: makeRegexFinder(/\b(?:robust|scalable|flexible)\s+framework\b|\bholistic\s+approach\b|\bseamless\s+integration\b|\bcomprehensive\s+solution\b|\bactionable\s+insights?\b|\bvalue\s+proposition\b|\bcore\s+competenc(?:y|ies)\b|\bsynerg(?:y|ies|istic)\b|\bmission[-\s]critical\b|\bthought\s+leader(?:ship)?\b/gi)
  },
  {
    id: 'fiction-slop',
    name: 'AI fiction clichés',
    description: 'Stock creative-writing tells LLMs overuse: “barely above a whisper”, “took a deep breath”, “a shiver ran down her spine”, “heart pounding”, “eyes widened”, “breath hitched”, “little did they know”, “the air was thick with”, “casting long shadows”.',
    find: makeRegexFinder(/\b(?:voice\s+(?:barely\s+)?(?:above\s+)?a\s+whisper|barely\s+above\s+a\s+whisper)\b|\btook\s+a\s+deep\s+breath\b|\blet\s+out\s+a\s+breath\s+(?:he|she|they|I)\s+(?:didn['’]t|did\s+not)\s+(?:know|realize)\b|\b(?:a\s+shiver\s+ran|sent\s+shivers?)\s+down\s+(?:his|her|their|my)\s+spine\b|\bheart\s+(?:pounding|racing|hammering|thundering)\b|\beyes\s+widen(?:ed|ing)?\b|\bbreath\s+hitched\b|\blittle\s+did\s+(?:he|she|they|I|we)\s+know\b|\bthe\s+air\s+was\s+thick\s+with\b|\bcasting\s+long\s+shadows\b/gi)
  },
  {
    id: 'something-for-everyone',
    name: '“Something for everyone”',
    description: 'The inclusive sign-off: “there’s something for everyone”, “whether you’re a beginner or a pro, you’ll find …”.',
    find: makeRegexFinder(/\bsomething\s+for\s+everyone\b|\bwhether\s+you(?:['’]re|\s+are)\s+[^.!?\n]{1,50}?,\s*(?:there['’]s|you['’]ll\s+find|you\s+will\s+find)\b/gi)
  },
  {
    id: 'ai-vocab',
    group: WIKI_GROUP,
    name: 'AI vocabulary words',
    description: 'Words LLMs lean on far more than people do \u2014 validated by frequency studies of post-ChatGPT writing (Kobak et al.; Liang et al.). \u201cdelve\u201d, \u201ctapestry\u201d, \u201cmeticulous\u201d, \u201cpivotal\u201d, \u201cintricate\u201d, \u201cunderscore\u201d, \u201cgarner\u201d, \u201cbolster\u201d, \u201cmultifaceted\u201d, \u201cseamless\u201d, \u201cshowcase\u201d, \u201cleverage\u201d, plus rarer high-signal tells \u201celucidate\u201d, \u201cdelineate\u201d, \u201cjuxtapose\u201d, \u201ctranscend\u201d, \u201cunveil\u201d, \u201cburgeoning\u201d, \u201cgroundbreaking\u201d, \u201cunparalleled\u201d, \u201cnuanced\u201d, \u201cmyriad\u201d, \u201cprowess\u201d. One hit can be coincidence \u2014 several is a tell.',
    find: makeRegexFinder(/\b(?:delv(?:e|es|ed|ing)|tapestr(?:y|ies)|meticulous(?:ly)?|pivotal|intricate(?:ly)?|intricacies|interplay|underscor(?:e|es|ed|ing)|garner(?:s|ed|ing)?|bolster(?:s|ed|ing)?|vibrant|bustling|multifaceted|seamless(?:ly)?|commendable|ever-evolving|showcas(?:e|es|ed|ing)|foster(?:s|ed|ing)|leverag(?:e|es|ed|ing)|enhanc(?:e|es|ed|ing)|align(?:s|ed|ing)?\s+with|elucidat(?:e|es|ed|ing)|delineat(?:e|es|ed|ing)|juxtapos(?:e|es|ed|ing|ition)|streamlin(?:e|es|ed|ing)|catalyz(?:e|es|ed|ing)|transcend(?:s|ed|ing)?|unveil(?:s|ed|ing)?|illuminat(?:e|es|ed|ing)|spearhead(?:s|ed|ing)?|exemplif(?:y|ies|ied|ying)|encapsulat(?:e|es|ed|ing)|propel(?:s|led|ling)?|burgeoning|noteworthy|groundbreaking|unparalleled|transformative|nuanced|renowned|invaluable|versatile|myriad|prowess)\b/gi)
  },
  {
    id: 'not-just',
    group: WIKI_GROUP,
    name: 'Negative parallelisms',
    description: 'Negative parallelisms: \u201cnot just X, but (also) Y\u201d, \u201cnot only \u2026 but \u2026\u201d, the \u201cit\u2019s not X \u2014 it\u2019s Y\u201d contrast, and the trailing \u201cX is A, not B\u201d antithesis (\u201ca hypothesis, not a control\u201d) LLMs love as a closing kicker.',
    find: makeRegexFinder(/\bnot\s+(?:just|only|merely|simply)\s+[^.!?\n;]*?\bbut(?:\s+also)?\b|\b(?:it|this|that)(?:['\u2019]s|\s+(?:is|was))\s+not\s+[^.!?\n,;\u2014\u2013]{1,60}[,;\u2014\u2013]\s*(?:it|this|that)(?:['\u2019]s|\s+(?:is|was))\b|\b(?:is|are|was|were|be|been|being|['\u2019]s|remains?|stays?|becomes?|became)\s+[^.!?\n,;:\u2014\u2013]{1,50}?,\s+not\s+(?:a|an|the)\s+[^.!?\n]{1,60}?(?=[.!?]|$)/gi)
  },
  {
    id: 'note-that',
    group: WIKI_GROUP,
    name: '\u201cIt\u2019s important to note\u201d',
    description: 'Didactic hedging: \u201cit is important to note that\u201d, \u201cit\u2019s worth noting\u201d, \u201cit should be noted\u201d, plus the \u201cworth pausing / considering / asking\u201d family.',
    find: makeRegexFinder(/\bit(?:['\u2019]s|\s+(?:is|was))\s+(?:also\s+)?(?:important|worth|crucial|essential|vital)\s+(?:to\s+(?:note|remember|understand|recognize|mention|pause|consider|ask)|noting|mentioning|remembering|pausing|considering|asking)\b(?:\s+that\b)?|\bit\s+should\s+be\s+noted\b/gi)
  },
  {
    id: 'testament',
    group: WIKI_GROUP,
    name: '\u201cStands as a testament\u201d',
    description: '\u201cStands / serves as a testament (or reminder)\u201d, \u201cis a testament to\u201d \u2014 inflating significance instead of saying what happened.',
    find: makeRegexFinder(/\b(?:stand|stands|stood|serve|serves|served|standing|serving)\s+as\s+(?:a|an)\s+(?:\w+\s+)?(?:testament|reminder)\b|\b(?:is|was|are|were|remain|remains)\s+a\s+(?:\w+\s+)?testament\s+to\b/gi)
  },
  {
    id: 'crucial-role',
    group: WIKI_GROUP,
    name: '\u201cPlays a crucial role\u201d',
    description: '\u201cPlays a crucial / pivotal / vital / key / significant role in \u2026\u201d.',
    find: makeRegexFinder(/\bplay(?:s|ed|ing)?\s+(?:a|an)\s+(?:\w+\s+)?(?:crucial|pivotal|vital|key|significant|central|critical|important)\s+role\b/gi)
  },
  {
    id: 'landscape',
    group: WIKI_GROUP,
    name: '\u201cEver-evolving landscape\u201d',
    description: 'Scene-setting boilerplate: \u201cthe ever-evolving / changing / shifting landscape\u201d, \u201cin today\u2019s fast-paced world\u201d.',
    find: makeRegexFinder(/\b(?:ever-)?(?:evolving|changing|shifting)\s+landscape\b|\bin\s+today['\u2019]s\s+(?:fast-paced|ever-changing|ever-evolving|digital|modern|competitive)\s+\w+/gi)
  },
  {
    id: 'vague-experts',
    group: WIKI_GROUP,
    name: '\u201cExperts argue\u201d',
    description: 'Vague attribution to unnamed authorities: \u201cexperts argue\u201d, \u201csome critics have noted\u201d, \u201cobservers suggest\u201d, \u201cindustry reports indicate\u201d.',
    find: makeRegexFinder(/\b(?:many|some|several|most|numerous)?\s*(?:experts|critics|observers|scholars|analysts|commentators)\s+(?:have\s+|often\s+|widely\s+)?(?:argu(?:e|es|ed)|not(?:e|es|ed)|suggest(?:s|ed)?|believ(?:e|es|ed)|agree[ds]?|contend(?:s|ed)?|observ(?:e|es|ed)|caution(?:s|ed)?|claim(?:s|ed)?|cit(?:e|es|ed)|point(?:s|ed)?\s+out)\b|\bindustry\s+reports?\s+(?:suggest|indicate|show)\w*\b/gi)
  },
  {
    id: 'despite-challenges',
    group: WIKI_GROUP,
    name: '\u201cDespite these challenges\u201d',
    description: 'The boilerplate challenges-and-outlook formula: \u201cdespite these challenges\u201d, \u201cfaces several challenges\u201d, \u201cchallenges remain\u201d, \u201cremains to be seen\u201d, \u201ctime will tell\u201d.',
    find: makeRegexFinder(/\bdespite\s+(?:these|those|such|its|their|the|numerous|significant|ongoing)\s+(?:\w+\s+)?challenges\b|\bfac(?:e|es|ed|ing)\s+(?:several|numerous|many|significant|various|a\s+number\s+of)\s+challenges\b|\bchallenges\s+remain\b|\bremains\s+to\s+be\s+seen\b|\b(?:only\s+)?time\s+will\s+tell\b/gi)
  },
  {
    id: 'participle-tail',
    group: WIKI_GROUP,
    name: 'Participle sentence tails',
    description: 'Superficial analysis bolted onto a sentence end: \u201c\u2026, highlighting / underscoring / showcasing / reflecting the \u2026\u201d.',
    find: makeRegexFinder(/,\s+(?:highlighting|underscoring|emphasizing|showcasing|reflecting|demonstrating|illustrating|signaling|solidifying|cementing|reinforcing|underlining)\s+(?:its|his|her|their|our|the|a|an|how|that|what|both)\b[^.!?\n]*/gi)
  },
  {
    id: 'promo',
    group: WIKI_GROUP,
    name: 'Promotional boilerplate',
    description: 'Travel-brochure tone: \u201cnestled in\u201d, \u201cin the heart of\u201d, \u201crich tapestry / heritage\u201d, \u201chidden gem\u201d, \u201cboasts a\u201d, \u201cbreathtaking\u201d, \u201cstunning views\u201d.',
    find: makeRegexFinder(/\bnestled\s+(?:in|on|among|between|along|at)\b|\bin\s+the\s+heart\s+of\b|\brich\s+(?:cultural\s+|historical\s+)?(?:heritage|history|tapestry)\b|\bhidden\s+gem\b|\bmust-(?:visit|see|try)\b|\bbreathtaking\b|\bboasts?\s+(?:a|an|the)\b|\bstunning\s+(?:views?|scenery|architecture|backdrop)\b/gi)
  },
  {
    id: 'ai-leftovers',
    group: WIKI_GROUP,
    name: 'Chatbot leftovers',
    description: 'Artifacts pasted straight from a chatbot: \u201cas an AI language model\u201d, \u201cas of my last update\u201d, \u201cknowledge cutoff\u201d, plus markup debris across models \u2014 ChatGPT (\u201coaicite\u201d, \u201ccontentReference\u201d, \u201cturn0search\u201d), Gemini (\u201c[cite: 1]\u201d, \u201cstart_span\u201d), Grok (\u201cgrok_render_citation_card_json\u201d), Perplexity (\u201cppl-ai-file-upload\u201d), \u201c:::writing\u201d, and \u201cutm_source=\u201d tracking parameters.',
    find: makeRegexFinder(/\bas\s+an\s+ai(?:\s+language)?\s+model\b|\bas\s+of\s+my\s+last\s+(?:update|training)\b|\bknowledge\s+cutoff\b|\bI\s+(?:cannot|can['\u2019]t|do\s+not|don['\u2019]t)\s+(?:browse\s+the\s+internet|access\s+real-?time)\b|contentReference|oaicite|turn0(?:search|news|image)\d*|attributableIndex|utm_source=|grok_render_citation_card_json|grok_card|ppl-ai-file-upload|attached_file|:::writing|\bstart_span\b|\bend_span\b|\[cite:\s*\d+\]/gi)
  },
  {
    id: 'copulative-avoidance',
    group: WIKI_GROUP,
    name: 'Copulative avoidance',
    description: 'Elaborate constructions standing in for a plain \u201cis / are\u201d: \u201cserves as\u201d, \u201cstands as\u201d, \u201cfunctions as\u201d + a / an / the. AI prose reaches for these to sound weightier than \u201cX is Y\u201d.',
    find: makeRegexFinder(/\b(?:serves?|serving|stands?|standing|functions?|functioning|positions?\s+itself)\s+as\s+(?:a|an|the)\b/gi)
  },
  {
    id: 'vague-association',
    group: WIKI_GROUP,
    name: 'Vague association',
    description: 'Indirect connective phrasing instead of a clear relationship: \u201cin connection with\u201d, \u201cin association with\u201d, \u201cconnected with\u201d, \u201cassociated with\u201d.',
    find: makeRegexFinder(/\bin\s+(?:connection|association)\s+with\b|\b(?:connected|associated)\s+with\b/gi)
  },
  {
    id: 'canned-notability',
    group: WIKI_GROUP,
    name: 'Canned notability',
    description: 'Boilerplate significance-signalling: \u201cmaintains an active social media presence\u201d, \u201cfeatured in local/regional media outlets\u201d, \u201cgarnered widespread coverage / acclaim\u201d.',
    find: makeRegexFinder(/\bactive\s+(?:social\s+media|online)\s+presence\b|\bmaintains?\s+an?\s+active\s+(?:social\s+media\s+|online\s+)?presence\b|\bfeatured\s+in\s+(?:various\s+|numerous\s+|several\s+|local\s+|regional\s+|national\s+|multiple\s+)*(?:media\s+outlets|news\s+outlets|publications)\b|\b(?:garner(?:ed|ing)?|receiv(?:ed|ing)|gain(?:ed|ing))\s+(?:significant\s+|widespread\s+|considerable\s+|critical\s+)*(?:media\s+)?(?:coverage|acclaim|recognition|attention)\b/gi)
  }
];

const patternsById = Object.fromEntries(patterns.map(p => [p.id, p]));

const CONTEXT_WORDS = 12;

function countWords(s) {
  const m = s.match(/\S+/g);
  return m ? m.length : 0;
}

function expandLeft(text, pos, words) {
  let i = pos;
  let count = 0;
  while (i > 0 && count < words) {
    while (i > 0 && /\s/.test(text[i - 1])) i -= 1;
    if (i === 0) break;
    while (i > 0 && !/\s/.test(text[i - 1])) i -= 1;
    count += 1;
  }
  return i;
}

function expandRight(text, pos, words) {
  let i = pos;
  let count = 0;
  while (i < text.length && count < words) {
    while (i < text.length && /\s/.test(text[i])) i += 1;
    if (i === text.length) break;
    while (i < text.length && !/\s/.test(text[i])) i += 1;
    count += 1;
  }
  return i;
}

function buildWindows(text, regions) {
  const windows = [];
  for (const r of regions) {
    const ws = expandLeft(text, r.start, CONTEXT_WORDS);
    const we = expandRight(text, r.end, CONTEXT_WORDS);
    const last = windows[windows.length - 1];
    if (last && (ws <= last.end || countWords(text.slice(last.end, ws)) === 0)) {
      last.end = Math.max(last.end, we);
      last.regions.push(r);
    } else {
      windows.push({ start: ws, end: we, regions: [r] });
    }
  }
  return windows;
}

function collectMatches(text, enabled) {
  const perPattern = {};
  const raw = [];
  for (const p of patterns) {
    perPattern[p.id] = 0;
    if (!enabled.has(p.id)) continue;
    for (const m of p.find(text)) {
      m.patternId = p.id;
      raw.push(m);
    }
  }
  raw.sort((a, b) => a.start - b.start || b.end - a.end);
  const matches = [];
  for (const m of raw) {
    const last = matches[matches.length - 1];
    if (last && m.start < last.end) continue;
    m.id = matches.length;
    matches.push(m);
    perPattern[m.patternId] += 1;
  }
  return { matches, perPattern };
}

function buildRegions(text, matches) {
  const regions = [];
  for (const m of matches) {
    const [s, e] = sentenceBounds(text, m.start, m.end);
    const last = regions[regions.length - 1];
    if (last && s <= last.end) {
      last.end = Math.max(last.end, e);
      last.matches.push(m);
    } else {
      regions.push({ start: s, end: e, matches: [m] });
    }
  }
  return regions;
}

function sentenceBounds(text, start, end) {
  let s = start;
  while (s > 0) {
    const ch = text[s - 1];
    if (ch === '\n' || ch === '.' || ch === '!' || ch === '?' || ch === '\u2026') break;
    s -= 1;
  }
  while (s < start && /\s/.test(text[s])) s += 1;
  let e = end;
  while (e < text.length) {
    const ch = text[e];
    if (ch === '\n') break;
    e += 1;
    if (ch === '.' || ch === '!' || ch === '?' || ch === '\u2026') {
      while (e < text.length && /["'\u201d\u2019)\]]/.test(text[e])) e += 1;
      break;
    }
  }
  return [s, e];
}

const EXAMPLE = `We rebuilt the editor from the ground up. No sign-ups, no downloads, no hassle — just paste your text and start writing. Everything runs locally in your browser.

The reviewer read the draft twice. Did not flinch, did not blink, did not reach for the red pen. That's the whole review, honestly.

Don't call it a rewrite — call it a rescue. The improvement is real, and it's not subtle. That loss is worth naming. Sit with that for a moment. The gains were modest, but that's not nothing.

You already know the answer, of course. Consistency is the entire game, and the punchline is that nobody wants to hear it. The entire pitch is one sentence long.

In this guide we delve into the redesign. It is important to note that the rollout happened in stages. Community feedback plays a pivotal role in every release. Experts argue that the shift was overdue.

The studio is nestled in a converted warehouse. The finished space is not just an office, but a small museum. Visitors keep coming back, reflecting the appeal of the collection. The steady attendance is a testament to the curators.

Despite these challenges, the team kept shipping. They adapted to an ever-evolving landscape. As of my last update, the pricing page still said “coming soon”.

The parser is a tiny state machine. The renderer is a tiny state machine.

I won't pretend the rollout was smooth. It turns out that nobody reads the changelog. Here is the whole secret. The small core still fits in your head. That's the part a schedule can't capture. It's the only estimate I trust. You don't have to take my word for it.

The launch needed three things: a blog post, a demo video, and a pricing page. Here's the catch: the demo was recorded months earlier. Do I regret shipping it? Do I miss the old importer?

The old importer is dead, and nobody mourned. That's why the export button mattered. The tool died; the data didn't.

Maybe nobody needed the importer. Maybe the shortcut confused people. Maybe the redesign was overdue all along.

This closing paragraph is deliberately ordinary, with no list patterns at all, so nothing here should light up.`;

// URL loading: the page URL's #fragment holds the article URL, and the text is
// fetched through the Jina Reader proxy (https://r.jina.ai/) as plain text.
// A direct fetch of the URL races alongside as a quiet fallback in case the
// site serves open CORS headers and Jina fails.

function normalizeUrl(raw) {
  const url = raw.trim();
  if (!url) return '';
  if (/^https?:\/\//i.test(url)) return url;
  if (/^[\w.-]+\.[a-z]{2,}(?:[/?#:]|$)/i.test(url)) return 'https://' + url;
  return '';
}

function urlFromFragment(fragment) {
  let raw = fragment.startsWith('#') ? fragment.slice(1) : fragment;
  if (!raw) return '';
  try {
    raw = decodeURIComponent(raw);
  } catch (err) {
    // Not valid percent-encoding — treat the fragment as a literal URL
  }
  return normalizeUrl(raw);
}

function fragmentFromUrl(url) {
  return url ? '#' + encodeURI(url) : '';
}

// Tooltip text for a highlight: the pattern name, plus the chain item count
// when the match has one. Shown on tap/click (title-attribute hover tooltips
// don't exist on touch screens) and duplicated in the title attribute.
function matchTipText(name, badgeTitle) {
  return badgeTitle ? name + ' · ' + badgeTitle : name;
}

export {
  patterns,
  patternsById,
  collectMatches,
  buildRegions,
  sentenceBounds,
  buildWindows,
  countWords,
  expandLeft,
  expandRight,
  CONTEXT_WORDS,
  EXAMPLE,
  matchTipText,
  normalizeUrl,
  urlFromFragment,
  fragmentFromUrl,
};
