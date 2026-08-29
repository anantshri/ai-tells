# Changelog

All notable changes to this project are documented here.
Format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and
[Semantic Versioning](https://semver.org/spec/v2.0.0.html).

Keep this file high-level: one bullet per user-visible change, grouped under the
right heading. Record the blow-by-blow detail (commands, diffs, reasoning) in
`DETAILED_CHANGELOG.md` instead.

## [Unreleased]

### Changed

- AI Tells: the toolbar badge now reflects the page **grade** (fired-signal
  count, colour-coded by tier) instead of the raw phrase-match count. Phrase
  matches remain highlighted on the page and counted in the popup status.
- AI Tells: the negative-parallelism detector (`not-just`, now surfaced as
  "Negative parallelisms") also catches the trailing "X is A, not B" antithesis
  — the "…is a hypothesis, not a control" closing kicker LLMs favour. Previously
  only the "not just X, but Y" and "it's not X — it's Y" orderings were caught.

### Added

- AI Tells: **document-level page grading**. Alongside the per-phrase
  highlighter, a scan now computes a model-free stylometric grade from eight
  independent signals (sentence-length burstiness, em-dash density, transition
  and expletive openers, rule-of-three density, unicode-typography cluster,
  paragraph-length uniformity, and DOM bold-lead-in lists). The toolbar icon
  badge shows how many signals co-fired, tinted green→amber→orange→red by tier,
  and the popup gains an **Analysis panel** with the overall grade, a per-signal
  breakdown, and the "signals, not a verdict" false-positive caveat. Pages with
  too little text (< ~150 words) are deliberately left ungraded.
- Cross-browser builds: `npm run build` now emits `dist/chrome` (Chrome/Edge/
  Opera/Brave), `dist/firefox` (event-page background + gecko add-on id), and
  `dist/safari` (Xcode-convertible). Same code everywhere — only the manifest
  `background` key differs. Per-browser guide in `extension/docs/BROWSERS.md`.
- AI Tells: `hook-opener` detector — Twitter-style superlative
  engagement bait ("What I find most annoying about…", "The stupidest thing you
  could do is…"); and `cataphoric-teaser` extended with "it's not what you think".
  53 detectors. (Via @landosembery / @petermajewski threads.)
- AI Tells: `cataphoric-teaser` detector — the forward-referencing
  suspense hook ("Here's the part nobody tells you", "what most people get
  wrong"), the LLM descendant of clickbait (via a @yishan thread).
- AI Tells: ten research-backed phrase detectors (chatbot
  pleasantries, scene-setting openers, journey metaphors, "dive into", hype
  buzzwords, formulaic conclusions, vague appeals to research, corporate
  buzzwords, AI fiction clichés, "something for everyone") and a vocabulary
  detector expanded with words validated by post-ChatGPT frequency studies
  (Kobak/Liang et al.) — 51 detectors total, up from 41.
- `extension/docs/FUTURE_WORK.md` documenting a planned document-level
  statistical/stylometric "AI-likelihood" scoring layer.
- Repo-level `README.md` (GitHub-style), `LICENSE` (GNU GPL v3.0), and `NOTICE`
  with third-party attribution.
- AI Tells: three new Wikipedia-guide signs (copulative avoidance,
  vague association, canned notability) and extended vocabulary/chatbot-leftover
  detectors (newer-era words; Grok/Gemini/Perplexity markup artifacts) — 41
  detectors total, up from 38.
- **AI Tells** browser extension (`extension/`): highlights LLM
  writing clichés on any web page using the CSS Custom Highlight API, with a
  hover tooltip that names the matched signal and links out to read more.
  Detection engine (38 patterns) is ported verbatim from Simon Willison's
  llm-cliche-highlighter plus Wikipedia's "Signs of AI writing" guide. Allowlist
  auto-scan per site, click-to-scan elsewhere, and per-pattern toggles
  (`colon-triple` off by default). 201 vitest cases; 96% coverage on the logic
  modules.

### Changed

- Renamed the project to **AI Tells** (repo `ai-tells`) — across the manifest,
  package, Firefox add-on id, popup, READMEs, and NOTICE. New tagline: "helps you
  identify signs of probable AI usage".
- New icon: a magnifying glass framing a highlighted "AI" (`extension/icons/`,
  with an SVG master and a dependency-free generator).
- Relicensed the extension from MIT to GPL-3.0-or-later (`package.json`).
- README: reframed the intro around the project's origin (ported from Simon
  Willison's tool into a Chrome extension, then extended) and expanded Credits
  with the community X/Twitter sources for crowd-sourced signals; removed the
  misleading "Paste-free." lead. `NOTICE` gained a community-credits block.

### Deprecated

### Removed

### Fixed

- AI Tells: hover tooltip no longer stays stuck on screen after the
  cursor leaves the highlight or the tooltip. The injected `all: initial` rule
  had reset `display` and overridden the `[hidden]` attribute, so hiding never
  took visual effect.

### Security

- Bumped dev dependencies to latest — esbuild 0.25→0.28.2, vitest 2.1→4.1.11,
  @vitest/coverage-v8 2.1→4.1.11, jsdom 25→30.0.1. Clears the dev-only
  esbuild/vite advisories (the old vulnerable vite chain is gone; `npm audit` now
  reports 0 vulnerabilities). 287 tests still pass; build unaffected.
- AI Tells: fixed a ReDoS/denial-of-service where the
  question-chain, anaphora, and "no/did-not" chain detectors were O(n²) on
  terminator-free page text and could freeze the tab; quantifiers are now bounded
  (linear) and `scan()` caps input at 500k chars. Added a message-sender check in
  the content script and an allowlist type guard in the popup as defence-in-depth.
  Full review found no XSS, injection, exfiltration, prototype-pollution, or
  privilege issues.
