# Changelog

All notable changes to this project are documented here.
Format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and
[Semantic Versioning](https://semver.org/spec/v2.0.0.html).

Keep this file high-level: one bullet per user-visible change, grouped under the
right heading. Record the blow-by-blow detail (commands, diffs, reasoning) in
`DETAILED_CHANGELOG.md` instead.

## [Unreleased]

### Added

- AI Cliché Highlighter: `hook-opener` detector — Twitter-style superlative
  engagement bait ("What I find most annoying about…", "The stupidest thing you
  could do is…"); and `cataphoric-teaser` extended with "it's not what you think".
  53 detectors. (Via @landosembery / @petermajewski threads.)
- AI Cliché Highlighter: `cataphoric-teaser` detector — the forward-referencing
  suspense hook ("Here's the part nobody tells you", "what most people get
  wrong"), the LLM descendant of clickbait (via a @yishan thread).
- AI Cliché Highlighter: ten research-backed phrase detectors (chatbot
  pleasantries, scene-setting openers, journey metaphors, "dive into", hype
  buzzwords, formulaic conclusions, vague appeals to research, corporate
  buzzwords, AI fiction clichés, "something for everyone") and a vocabulary
  detector expanded with words validated by post-ChatGPT frequency studies
  (Kobak/Liang et al.) — 51 detectors total, up from 41.
- `extension/docs/FUTURE_WORK.md` documenting a planned document-level
  statistical/stylometric "AI-likelihood" scoring layer.
- Repo-level `README.md` (GitHub-style), `LICENSE` (GNU GPL v3.0), and `NOTICE`
  with third-party attribution.
- AI Cliché Highlighter: three new Wikipedia-guide signs (copulative avoidance,
  vague association, canned notability) and extended vocabulary/chatbot-leftover
  detectors (newer-era words; Grok/Gemini/Perplexity markup artifacts) — 41
  detectors total, up from 38.
- **AI Cliché Highlighter** Chrome extension (`extension/`): highlights LLM
  writing clichés on any web page using the CSS Custom Highlight API, with a
  hover tooltip that names the matched signal and links out to read more.
  Detection engine (38 patterns) is ported verbatim from Simon Willison's
  llm-cliche-highlighter plus Wikipedia's "Signs of AI writing" guide. Allowlist
  auto-scan per site, click-to-scan elsewhere, and per-pattern toggles
  (`colon-triple` off by default). 201 vitest cases; 96% coverage on the logic
  modules.

### Changed

- Relicensed the extension from MIT to GPL-3.0-or-later (`package.json`).
- README: reframed the intro around the project's origin (ported from Simon
  Willison's tool into a Chrome extension, then extended) and expanded Credits
  with the community X/Twitter sources for crowd-sourced signals; removed the
  misleading "Paste-free." lead. `NOTICE` gained a community-credits block.

### Deprecated

### Removed

### Fixed

- AI Cliché Highlighter: hover tooltip no longer stays stuck on screen after the
  cursor leaves the highlight or the tooltip. The injected `all: initial` rule
  had reset `display` and overridden the `[hidden]` attribute, so hiding never
  took visual effect.

### Security

- AI Cliché Highlighter: fixed a ReDoS/denial-of-service where the
  question-chain, anaphora, and "no/did-not" chain detectors were O(n²) on
  terminator-free page text and could freeze the tab; quantifiers are now bounded
  (linear) and `scan()` caps input at 500k chars. Added a message-sender check in
  the content script and an allowlist type guard in the popup as defence-in-depth.
  Full review found no XSS, injection, exfiltration, prototype-pollution, or
  privilege issues.
