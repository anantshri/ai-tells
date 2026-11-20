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

  // Chat boilerplate
  ['chat-boilerplate', 'Certainly! Here is your summary.', 1],
  ['chat-boilerplate', "I'd be happy to help with that.", 1],
  ['chat-boilerplate', "Don't hesitate to reach out.", 1],
  ['chat-boilerplate', 'He absolutely nailed the landing.', 0],

  // Scene setting
  ['scene-setting', 'In today’s fast-paced world, attention is scarce.', 1],
  ['scene-setting', 'In the realm of astrophysics, scale matters.', 1],
  ['scene-setting', 'When it comes to security, defaults matter.', 1],
  ['scene-setting', 'The world of finance is large.', 0],

  // Journey metaphors
  ['journey-metaphor', 'We embark on a journey through the codebase.', 1],
  ['journey-metaphor', 'Navigating the complexities of the tax code.', 1],
  ['journey-metaphor', 'These reforms pave the way for growth.', 1],
  ['journey-metaphor', 'unlock the potential of your team', 1],
  ['journey-metaphor', 'They took a long journey home.', 0],

  // Dive in
  ['dive-in', "Let's dive into the numbers.", 1],
  ['dive-in', 'A deep dive into performance.', 1],
  ['dive-in', 'The submarine dove into the trench.', 0],

  // Hype buzzwords
  ['hype-buzzwords', 'This tool is a game-changer.', 1],
  ['hype-buzzwords', 'a state-of-the-art, best-in-class system', 2],
  ['hype-buzzwords', 'It caused a paradigm shift.', 1],
  ['hype-buzzwords', 'She stood at the edge of the cliff.', 0],

  // Conclusion wrappers
  ['conclusion-wrapper', 'In conclusion, the launch succeeded.', 1],
  ['conclusion-wrapper', 'Great work. Ultimately, it paid off.', 1],
  ['conclusion-wrapper', 'The ultimate showdown begins now.', 0],

  // Expanded ai-vocab (study-validated rare words)
  ['ai-vocab', 'The paper elucidates a nuanced, groundbreaking result.', 3],
  ['ai-vocab', 'an unparalleled, transformative approach', 2],
  ['ai-vocab', 'a myriad of versatile options', 2],
  ['ai-vocab', 'They painted the fence on Saturday.', 0],

  // Vague appeals to research
  ['false-authority', 'Studies have shown this works.', 1],
  ['false-authority', 'Research suggests a link.', 1],
  ['false-authority', 'The data speaks for itself.', 1],
  ['false-authority', 'She studies the ocean floor.', 0],

  // Corporate buzzword pairings
  ['corporate-buzzwords', 'a holistic approach with real synergy', 2],
  ['corporate-buzzwords', 'our robust framework scales', 1],
  ['corporate-buzzwords', 'They built a wooden frame.', 0],

  // AI fiction clichés
  ['fiction-slop', 'A shiver ran down her spine.', 1],
  ['fiction-slop', 'He took a deep breath.', 1],
  ['fiction-slop', 'Little did they know.', 1],
  ['fiction-slop', 'The breathing exercise helped.', 0],

  // Something for everyone
  ['something-for-everyone', 'The festival has something for everyone.', 1],
  ['something-for-everyone', 'Whether you are new or an expert, you will find value.', 1],
  ['something-for-everyone', 'Everyone arrived on time.', 0],

  // Cataphoric teaser (the "here's what nobody tells you" suspense hook)
  ['cataphoric-teaser', "Here's the part that nobody tells you.", 1],
  ['cataphoric-teaser', "Here's what most people get wrong.", 1],
  ['cataphoric-teaser', 'The part most people sleep on is caching.', 1],
  ['cataphoric-teaser', 'What nobody tells you is the real cost.', 1],
  ['cataphoric-teaser', 'Here is your receipt.', 0],
  ['cataphoric-teaser', 'The part number is 4032.', 0],
  ['cataphoric-teaser', "It's not what you think.", 1],
  ['cataphoric-teaser', 'It is not what I ordered.', 0],

  // Superlative hook openers (Twitter-style engagement bait)
  ['hook-opener', 'What I find most annoying about it is the delay.', 1],
  ['hook-opener', 'The stupidest thing you could do is ignore it.', 1],
  ['hook-opener', 'The most interesting thing to notice is the timing.', 1],
  ['hook-opener', 'The worst mistake you can make is waiting.', 1],
  ['hook-opener', 'The best way to cook pasta is to boil it.', 0],
  ['hook-opener', 'The best part is the ending.', 0],

  // Corporate verb inflation (SlopDetector sign 2: Latinate swaps for plain verbs)
  ['verb-inflation', 'We utilize the API and facilitate faster builds.', 2],
  ['verb-inflation', 'The team will commence testing prior to the release.', 2],
  ['verb-inflation', 'In order to ascertain the cause, we re-ran the audit.', 2],
  ['verb-inflation', 'A number of users reported the glitch.', 1],
  ['verb-inflation', 'They endeavored to finish before the deadline.', 1],
  ['verb-inflation', 'We use the API to speed up the build.', 0],
  ['verb-inflation', 'The optimizer shortened the hot loop.', 0],
  ['verb-inflation', 'She demonstrated the prototype at the review.', 0],
  // "terminate" is deliberately excluded (technical vocabulary)
  ['verb-inflation', 'Call terminate() to end the session.', 0],

  // Hedge stacking (stacked unfalsifiable qualifiers)
  ['hedge-stack', 'It could be argued that this approach may potentially help.', 2],
  ['hedge-stack', 'To some extent, the results can sometimes be noisy.', 2],
  ['hedge-stack', 'Generally speaking, teams prefer smaller services.', 1],
  ['hedge-stack', 'There is no one-size-fits-all answer here.', 1],
  ['hedge-stack', 'One could argue the tradeoff is worth it.', 1],
  ['hedge-stack', 'The process tends to be slow on old hardware.', 0],
  ['hedge-stack', 'Arguably, the first version was better.', 0],

  // Pseudo-wisdom filler (sounds like insight, cannot be wrong)
  ['pseudo-wisdom', 'The key is to find the right balance.', 1],
  ['pseudo-wisdom', 'At the end of the day, context is everything.', 1],
  ['pseudo-wisdom', 'It all comes down to your specific needs.', 1],
  ['pseudo-wisdom', 'True growth comes from within.', 1],
  ['pseudo-wisdom', 'Success ultimately comes down to consistency.', 1],
  ['pseudo-wisdom', 'The best approach is the one that works for you.', 1],
  ['pseudo-wisdom', 'It depends on your use case more than anything.', 1],
  ['pseudo-wisdom', 'Timing is everything in comedy.', 1],
  ['pseudo-wisdom', 'Finding the right balance takes practice.', 1],
  ['pseudo-wisdom', 'We balanced the load across three nodes.', 0],
  ['pseudo-wisdom', 'The tradeoff depends on the compiler version.', 0],

  // scene-setting extensions (empty-opener family)
  ['scene-setting', 'Picture this: a team shipping weekly without a QA gate.', 1],
  ['scene-setting', 'Now more than ever, security reviews matter.', 1],
  ["scene-setting", "It's no secret that demos are rehearsed.", 1],
  ['scene-setting', 'In an era of cheap storage, retention is easy.', 1],
  ['scene-setting', 'As technology continues to evolve, so do attacks.', 1],
  ['scene-setting', 'Imagine a world where deploys are boring.', 1],
  ['scene-setting', 'Let’s face it: nobody reads the manual.', 1],
  ['scene-setting', 'In the digital age, attention is scarce.', 1],
  ['scene-setting', 'The picture this frame captures is sharp.', 0],

  // despite-challenges extensions (forward-glance wrap-ups)
  ['despite-challenges', 'Moving forward, the team will split into two tracks.', 1],
  ['despite-challenges', 'As we look ahead, priorities may shift.', 1],
  ['despite-challenges', 'The paper ends with challenges and future prospects.', 1],
  ['despite-challenges', 'The report closes on the future outlook for the sector.', 1],
  ["despite-challenges", "It's important to note that budgets differ.", 1],
  ['despite-challenges', 'He moved the meeting forward by a day.', 0],

  // copulative-avoidance extensions ("represents a …", "marks a significant …")
  ['copulative-avoidance', 'The acquisition represents a significant milestone for the region.', 1],
  ['copulative-avoidance', 'This release marks a pivotal shift in strategy.', 1],
  ['copulative-avoidance', 'The chart represents a sample of the data.', 0],
  ['copulative-avoidance', 'The logo marks a change of sponsor.', 0],

  // journey-metaphor extensions ("sets/setting the stage", "underscores the importance of")
  ['journey-metaphor', 'The deal sets the stage for further expansion.', 1],
  ['journey-metaphor', 'The partnership is setting the stage for a merger.', 1],
  ['journey-metaphor', 'This failure underscores the importance of backups.', 1],
  ['journey-metaphor', 'The crew built a stage for the school play.', 0],

  // Topic announcement ("The subject is measurement" — third-person topic labeling)
  ['topic-announcement', 'The subject is measurement, and the obfuscated logic bypass that automation cannot finish.', 1],
  ['topic-announcement', 'The real story is that the launch failed.', 1],
  ['topic-announcement', 'The takeaway here is simple: test your backups.', 1],
  ['topic-announcement', 'The topic was community governance.', 1],
  ['topic-announcement', 'The bigger lesson is that defaults matter.', 1],
  ['topic-announcement', 'The upshot was a full rewrite.', 1],
  ['topic-announcement', 'The subject: measurement.', 1],
  ['topic-announcement', 'The subject of this paper is hashing.', 0],
  ['topic-announcement', 'She changed the subject.', 0],
  ['topic-announcement', 'The story has a happy ending.', 0],
  ['topic-announcement', 'The focus is on performance.', 0],
  ['topic-announcement', 'The topics are mundane.', 0],

  // Ineffability ("the X that automation cannot finish" — grandiose-negation flourish)
  ['ineffability', 'The subject is measurement, and the obfuscated logic bypass that automation cannot finish.', 1],
  ['ineffability', 'A bypass that no benchmark can capture.', 1],
  ['ineffability', 'Edge cases which no tool will ever fully cover.', 1],
  ['ineffability', 'Nuance that automation can’t capture.', 1],
  ['ineffability', 'Details that tests cannot reach.', 1],
  ['ineffability', 'A path that no test can cover.', 1],
  ['ineffability', 'An interface beyond the reach of automation.', 1],
  ['ineffability', 'Behavior beyond what any model can predict.', 1],
  ['ineffability', 'A workflow that defies easy categorization.', 1],
  ['ineffability', 'The root cause eludes simple measurement.', 1],
  ['ineffability', 'Parts of the pipeline cannot be fully automated.', 1],
  ['ineffability', 'Tests that can run in parallel.', 0],
  ['ineffability', 'A file that tools can open.', 0],
  ['ineffability', 'He defies gravity and expectation.', 0],
  ['ineffability', 'The bug was beyond the reach of the original team.', 0],
  ['ineffability', 'This content cannot be reproduced without permission.', 0],

  // ---- 2026-11-20 batch: coverage audit of five AI-ism sources -------------
  // Wikipedia "Signs of AI writing"; discover.oreateai.com AI-isms;
  // scriptgrain.com counted AI-isms; contentbeta.com overused-word list;
  // hanalarockwriting.com 10 ChatGPT-isms.

  // Transition-word openers (scriptgrain generic transitions; oreateai;
  // hanalarock §6) — sentence-initial only
  ['transition-openers', 'Moreover, the rollout slipped again.', 1],
  ['transition-openers', 'The plan failed. Furthermore, nobody noticed.', 1],
  ['transition-openers', 'Additionally, the price went up mid-contract.', 1],
  ['transition-openers', 'In addition, the docs were stale.', 1],
  ['transition-openers', 'The project moved forward, moreover, without a plan.', 0],
  ['transition-openers', 'This addition improves the parser.', 0],
  ['transition-openers', 'He was tired; moreover, he was broke.', 0],

  // "Bear in mind" (hanalarock §6) — extension of note-that
  ['note-that', 'Bear in mind that the estimate assumes steady traffic.', 1],
  ['note-that', 'Bearing this in mind, we rewrote the importer.', 1],
  ['note-that', 'The bear in the exhibit was asleep.', 0],

  // Shaping the debate (Wikipedia: claims of influencing related discussions)
  ['shapes-discussions', 'Her work has shaped conversations about digital ethics.', 1],
  ['shapes-discussions', 'These works have shaped emerging policy discussions about ownership.', 1],
  ['shapes-discussions', 'The phenomenon has generated debate about authenticity.', 1],
  ['shapes-discussions', 'The paper prompted broader reflection on mortality.', 1],
  ['shapes-discussions', 'Her campaign contributed to wider discussions about marriage.', 1],
  ['shapes-discussions', 'The sculptor shaped the clay into a bowl.', 0],
  ['shapes-discussions', 'The protests sparked a conversation about wages.', 0],
  ['shapes-discussions', 'The study prompted a broader debate about ethics.', 1],
  ['shapes-discussions', 'The book generated conversations about grief.', 1],

  // Identified by sources (Wikipedia: primary/tertiary source identification)
  ['primary-source', 'His personal website identifies him as a retired officer.', 1],
  ['primary-source', 'His parliamentary biography records that he served as president.', 1],
  ['primary-source', 'The church is listed in the national register.', 1],
  ['primary-source', 'Her professional profile lists her as a consultant.', 1],
  ['primary-source', 'Company filings describe a restructuring plan.', 1],
  ['primary-source', 'He listed his three favourite albums.', 0],
  ['primary-source', 'The website lists the opening hours.', 0],
  ['primary-source', 'The official website dates from 2005.', 0],
  ['primary-source', 'Court records date from the medieval period.', 0],
  ['primary-source', 'The staff page notes that parking is limited.', 0],

  // Bare scene-setting openers (scriptgrain; contentbeta; oreateai)
  ['scene-setting', 'In today’s world, everyone ships software.', 1],
  ['scene-setting', 'In an age where data is cheap, judgment is scarce.', 1],
  ['scene-setting', 'Since the dawn of time, humans have sought better tools.', 1],
  ['scene-setting', 'In this day and age, nobody faxes memos.', 1],
  ['scene-setting', 'The world today runs on software.', 0],

  // Bare "digital / competitive landscape" (oreateai) — extension of landscape
  ['landscape', 'The digital landscape is shifting fast.', 1],
  ['landscape', 'Startups fight for share in a competitive landscape.', 1],
  ['landscape', 'They photographed the mountain landscape.', 0],

  // "Here's the deal" / "the hard truth" (contentbeta) — extension of heres-the-twist
  ['heres-the-twist', 'Here’s the deal: the trial ends Friday.', 1],
  ['heres-the-twist', 'The hard truth is that most dashboards go unread.', 1],
  ['heres-the-twist', 'She told the truth about the delay.', 0],
  ['heres-the-twist', 'The hard facts speak for themselves.', 0],
  ['heres-the-twist', 'She finally accepted the hard truth.', 0],

  // Uncertainty formulas + "Perhaps X, perhaps Y" (hanalarock §8; scriptgrain
  // hedging pair) — extension of hedge-stack
  ['hedge-stack', 'It is likely that the rollout will slip again.', 1],
  ['hedge-stack', 'There is a possibility that the data is stale.', 1],
  ['hedge-stack', 'It may be the case that users ignored the banner.', 1],
  ['hedge-stack', 'Perhaps it was haste, perhaps it was pride.', 1],
  ['hedge-stack', 'It is likely to rain later.', 0],
  ['hedge-stack', 'Perhaps we should reconsider.', 0],

  // "Double-edged sword" / "strike a balance" (oreateai) — extension of pseudo-wisdom
  ['pseudo-wisdom', 'Automation is a double-edged sword for small teams.', 1],
  ['pseudo-wisdom', 'The art is striking a balance between speed and rigor.', 1],
  ['pseudo-wisdom', 'The sword was double-edged steel.', 0],
  ['pseudo-wisdom', 'They balanced the ledger by hand.', 0],

  // Chatbot trailing offer, placeholders, raw markdown (Wikipedia §5.3/§6) —
  // extension of ai-leftovers
  ['ai-leftovers', 'The report is ready. Would you like me to expand the section?', 1],
  ['ai-leftovers', 'Founded in [insert year], the company grew quickly.', 1],
  ['ai-leftovers', 'Set the status to [Name] before shipping.', 1],
  ['ai-leftovers', 'The agenda item is still TBD.', 1],
  ['ai-leftovers', 'This is **bold text** pasted from a chat.', 1],
  ['ai-leftovers', '## Why This Matters\n\nThe rollout began in March.', 1],
  ['ai-leftovers', 'As noted \\[1\\], the dates conflict.', 1],
  ['ai-leftovers', 'Would you like tea or coffee?', 0],
  ['ai-leftovers', 'The array index is arr[1].', 0],
  ['ai-leftovers', 'user[name] maps to the profile field.', 0],
  ['ai-leftovers', 'Compute 2 ** 3 ** 2 for the exponent demo.', 0],
  ['ai-leftovers', 'Read the docs at example.com/tbd first.', 0],

  // Marketing negative-parallelism variants (contentbeta §2) — extension of not-just
  ['not-just', 'Not because it is easy. But because it works.', 1],
  ['not-just', 'Not because it was convenient, but because it was necessary.', 1],
  ['not-just', 'Forget the roadmap. Think feedback loops.', 1],
  ['not-just', 'Less noise, more signal — that is the pitch.', 1],
  ['not-just', 'He was not there because of the traffic.', 0],
  ['not-just', 'The bill came to less than expected.', 0],
  ['not-just', 'I forgot the roadmap at home.', 0],
  ['not-just', 'Don’t forget the intro; start with the hook.', 0],

  // Literary register slop (scriptgrain nominalised metaphors + hedged closes)
  ['literary-slop', 'It was chaos of a kind that could only be described as theatrical.', 1],
  ['literary-slop', 'The failure carried its own form of grace.', 1],
  ['literary-slop', 'He was possessed of a rare patience.', 1],
  ['literary-slop', 'A constellation of factors shaped the outcome.', 1],
  ['literary-slop', 'The ending offered perhaps enough after all.', 1],
  ['literary-slop', 'The prose had something approaching a rhythm.', 1],
  ['literary-slop', 'The negotiators described the terms carefully.', 0],
  ['literary-slop', 'The house possessed real charm.', 0],

  // Staccato sentence fragments (contentbeta "X. Y. Z." patterns)
  ['staccato-fragments', 'Focused. Aligned. Measurable.', 1],
  ['staccato-fragments', 'No theory. No fluff. Just execution.', 1],
  ['staccato-fragments', 'Fewer questions. Less confusion. Better engagement.', 1],
  ['staccato-fragments', 'The launch was focused, the team aligned, the rollout measurable.', 0],
  ['staccato-fragments', 'Dr. Smith arrived at noon. Mr. Jones followed shortly after.', 0],
  ['staccato-fragments', 'Go.\n\n\n\nFast.\n\n\n\nNow.', 0],
  ['staccato-fragments', '1. 2. 3. Go. Fast. Now.', 1],
  ['staccato-fragments', 'Yes. No. Maybe.', 1],
  ['staccato-fragments', 'J. D. Vance wrote a memoir.', 0],
];

describe('new signs (post-reference additions)', () => {
  for (const [id, sample, expected] of cases) {
    test(`${id} :: ${sample.slice(0, 44)}`, () => {
      expect(patternsById[id].find(sample).length).toBe(expected);
    });
  }
});
