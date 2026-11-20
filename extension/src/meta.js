// Per-pattern display metadata for the hover tooltip's "Read more" link.
//
// `name` and `description` already live on each entry in patterns.js. Here we
// add, per pattern, a URL the user can open to read about that specific signal:
//   - Wikipedia-group patterns -> the matching section of the "Signs of AI
//     writing" guide they were adapted from.
//   - Rhetorical-tic patterns -> the source catalogue (Simon Willison's tool),
//     which is where these were catalogued and explained.
//
// `group` is derived from patterns.js (Wikipedia entries carry a `group` field);
// it drives both the popup grouping and the highlight colour.
//
// A third source sits alongside Wikipedia and the reference tool: SlopDetector's
// "Signs of AI writing" research (measured thresholds per pattern). The page is
// client-rendered with no stable per-section anchors, so those patterns link to
// the article itself.
//
// Two further sources joined in the 2026-11 coverage audit: ScriptGrain's
// counted AI-isms list (phrases and sentence shapes measured per 1,000 words)
// and ContentBeta's AI word/pattern blacklist. Each gets its own link set
// below; per-source anchors are not stable, so patterns link to the list.
// (oreateai.com and hanalarockwriting.com also fed this batch, but their
// coverage overlaps the sources already linked.)

import { patterns, patternsById } from './patterns.js';

const WIKI_URL = 'https://en.wikipedia.org/wiki/Wikipedia:Signs_of_AI_writing';
const TOOL_URL = 'https://tools.simonwillison.net/llm-cliche-highlighter';
const SLOP_URL = 'https://slopdetector.org/blog/signs-of-ai-writing';
const SCRIPTGRAIN_URL = 'https://scriptgrain.com/reference/ai-isms-in-marketing-copy';
const CONTENTBETA_URL = 'https://www.contentbeta.com/blog/list-of-words-overused-by-ai/';

const wikiSection = (anchor) => WIKI_URL + '#' + anchor;

// Deep links into the Wikipedia guide, keyed by pattern id. Anchors match the
// guide's section headings (spaces -> underscores). An anchor that ever drifts
// simply lands the reader at the top of the guide, never on a broken page.
const WIKI_ANCHORS = {
  'ai-vocab': "High_density_of_'AI_vocabulary'_words",
  'not-just': 'Negative_parallelisms',
  'note-that': 'Undue_emphasis_on_significance,_legacy,_and_broader_trends',
  'testament': 'Undue_emphasis_on_significance,_legacy,_and_broader_trends',
  'crucial-role': 'Undue_emphasis_on_significance,_legacy,_and_broader_trends',
  'landscape': 'Undue_emphasis_on_significance,_legacy,_and_broader_trends',
  'vague-experts': 'Vague_attributions_and_overgeneralization_of_opinions',
  'despite-challenges': 'Outline-like_conclusions_about_challenges_and_future_prospects',
  'participle-tail': 'Superficial_analyses',
  'promo': 'Promotional_and_advertisement-like_language',
  'ai-leftovers': 'Markup_irregularities',
  'copulative-avoidance': 'Avoidance_of_basic_copulatives',
  'vague-association': 'Vague_expression_of_connection_or_association',
  'canned-notability': 'Canned_emphasis_on_notability,_attribution,_and_media_coverage',
  'shapes-discussions': 'Claims_that_a_topic_has_influenced_discussions_about_related_topics',
  'primary-source': 'Undue_emphasis_on_identification_by_primary_or_tertiary_sources',
};

// SlopDetector-researched patterns (see the comment up top), keyed by pattern
// id. WIKI_ANCHORS above wins where it has an entry — a deep section link beats
// the article root — so only patterns whose best source is SlopDetector's
// research are listed here.
const SLOP_PATTERNS = new Set([
  'verb-inflation',
  'hedge-stack',
  'pseudo-wisdom',
  'scene-setting',
]);

// Patterns best documented by ScriptGrain's counted AI-isms list.
const SCRIPTGRAIN_PATTERNS = new Set([
  'transition-openers',
  'literary-slop',
]);

// Patterns best documented by ContentBeta's AI word/pattern blacklist.
const CONTENTBETA_PATTERNS = new Set([
  'staccato-fragments',
]);

// Resolve the "read more" URL for a pattern id.
export function moreUrlFor(id) {
  if (WIKI_ANCHORS[id]) return wikiSection(WIKI_ANCHORS[id]);
  if (SLOP_PATTERNS.has(id)) return SLOP_URL;
  if (SCRIPTGRAIN_PATTERNS.has(id)) return SCRIPTGRAIN_URL;
  if (CONTENTBETA_PATTERNS.has(id)) return CONTENTBETA_URL;
  const p = patternsById[id];
  return p && p.group ? WIKI_URL : TOOL_URL;
}

// The group label for a pattern id. Wikipedia entries carry `group`; everything
// else is a rhetorical tic.
export function groupFor(id) {
  const p = patternsById[id];
  return p && p.group ? p.group : 'Rhetorical tics';
}

// Whether a pattern belongs to the Wikipedia group (drives highlight colour).
export function isWikiPattern(id) {
  const p = patternsById[id];
  return Boolean(p && p.group);
}

// Patterns that ship disabled by default (noisy on technical pages).
export const DEFAULT_DISABLED = ['colon-triple'];

// Full display record for a pattern id: everything the popup and tooltip need.
export function metaFor(id) {
  const p = patternsById[id];
  if (!p) return null;
  return {
    id,
    name: p.name,
    description: p.description,
    group: groupFor(id),
    isWiki: isWikiPattern(id),
    moreUrl: moreUrlFor(id),
  };
}

// Every pattern's metadata, in declaration order.
export const allMeta = patterns.map((p) => metaFor(p.id));
