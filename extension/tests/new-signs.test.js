import { describe, test, expect } from 'vitest';
import { patternsById } from '../src/patterns.js';

// Positive/negative cases for the signs added on top of the ported reference set,
// adapted from the updated Wikipedia "Signs of AI writing" guide.
// Shape: [patternId, sampleText, expectedMatchCount]
const cases = [
  // Newer-era AI vocabulary (extension of ai-vocab)
  ['ai-vocab', 'This showcases and fosters collaboration.', 2],
  ['ai-vocab', 'We leverage the platform to enhance results.', 2],
  ['ai-vocab', 'The design aligns with our goals.', 1],
  ['ai-vocab', 'The report was thorough and well organized.', 0],

  // New chatbot / model markup artifacts (extension of ai-leftovers)
  ['ai-leftovers', 'See grok_render_citation_card_json in the paste.', 1],
  ['ai-leftovers', 'left over ppl-ai-file-upload token', 1],
  ['ai-leftovers', 'a sentence [cite: 12] with a marker', 1],
  ['ai-leftovers', 'wrapped in start_span here', 1],
  ['ai-leftovers', 'a :::writing fence slipped through', 1],
  ['ai-leftovers', 'The last update shipped on Tuesday.', 0],

  // Copulative avoidance
  ['copulative-avoidance', 'The museum serves as a hub for local artists.', 1],
  ['copulative-avoidance', 'It stands as the tallest structure in town.', 1],
  ['copulative-avoidance', 'The tool functions as an adapter.', 1],
  ['copulative-avoidance', 'She serves coffee every morning.', 0],
  ['copulative-avoidance', 'The bridge is a landmark.', 0],

  // Vague association
  ['vague-association', 'It was built in connection with the festival.', 1],
  ['vague-association', 'the costs associated with shipping', 1],
  ['vague-association', 'working in association with the council', 1],
  ['vague-association', 'He connected the two wires.', 0],

  // Canned notability
  ['canned-notability', 'The artist maintains an active social media presence.', 1],
  ['canned-notability', 'The film garnered widespread critical acclaim.', 1],
  ['canned-notability', 'It was featured in several media outlets.', 1],
  ['canned-notability', 'The band played a small show downtown.', 0],
];

describe('new signs (post-reference additions)', () => {
  for (const [id, sample, expected] of cases) {
    test(`${id} :: ${sample.slice(0, 44)}`, () => {
      expect(patternsById[id].find(sample).length).toBe(expected);
    });
  }
});
