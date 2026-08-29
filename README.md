<div align="center">

<img src="extension/icons/icon128.png" width="96" height="96" alt="AI Tells icon">

# AI Tells

**A browser extension that helps you identify signs of probable AI usage — it highlights LLM writing tells on any web page and tells you which one it caught.**

[![License: GPL v3](https://img.shields.io/badge/License-GPLv3-blue.svg)](./LICENSE)
[![Manifest V3](https://img.shields.io/badge/Manifest-V3-4285F4.svg?logo=googlechrome&logoColor=white)](./extension/manifest.json)
[![Tests](https://img.shields.io/badge/tests-287%20passing-brightgreen.svg)](./extension/tests)
[![Coverage](https://img.shields.io/badge/coverage-96%25-brightgreen.svg)](#testing)
[![Zero runtime deps](https://img.shields.io/badge/runtime%20deps-0-success.svg)](./extension/package.json)

</div>

---

It reads the text already on the page, highlights the sentences that match known
LLM writing tells, and on hover shows **which signal** it matched plus a link to
**read more** about it.

It started as **Simon Willison's
[llm-cliché-highlighter](https://tools.simonwillison.net/llm-cliche-highlighter)**
— a paste-in-a-textarea tool — whose detection engine we ported into a browser
extension so it works on any live page. From there we grew the signal set well
beyond the original: tells from Wikipedia's
[Signs of AI writing](https://en.wikipedia.org/wiki/Wikipedia:Signs_of_AI_writing)
guide, word lists validated by post-ChatGPT frequency studies, and a batch of
**crowd-sourced signals** contributed by the community (see [Credits](#credits)).

> **Why:** LLM prose has recognisable habits — "not just X, but Y", "stands as a
> testament", "delve", stacked rhetorical questions, "no fluff, no filler". This
> surfaces them in place so you can judge a page for yourself.

## Features

- **53 detectors** in two groups — *Rhetorical tics* (yellow) and *Signs of AI
  writing (Wikipedia)* (blue) — including research-backed phrase clichés and a
  vocabulary list validated by post-ChatGPT word-frequency studies.
- **No DOM mutation** — highlights are painted with the
  [CSS Custom Highlight API](https://developer.mozilla.org/en-US/docs/Web/API/CSS_Custom_Highlight_API),
  so pages and web apps aren't disturbed.
- **Hover to explain** — an interactive tooltip names the signal, describes it,
  and links to the source (Wikipedia guide section, or the original tool).
- **Per-site allowlist** — opt a site in and it auto-scans on load and re-scans
  as the page changes; everywhere else, scan on demand from the popup.
- **Toggle any detector** — 53 individually switchable; the noisy `colon-triple`
  ships off by default.
- **Private & self-contained** — everything runs locally, **zero runtime
  dependencies**, no network calls, nothing leaves your browser.

## Install (from source)

Works on **Chrome, Edge, Opera, Brave, Firefox, and Safari**. Build once:

```bash
git clone <your-repo-url>
cd <repo>/extension
npm install
npm run build          # emits dist/chrome, dist/firefox, dist/safari
```

Then load the package for your browser:

- **Chrome / Edge / Opera / Brave** — `chrome://extensions` → **Developer mode**
  → **Load unpacked** → `extension/dist/chrome`
- **Firefox** — `about:debugging#/runtime/this-firefox` → **Load Temporary
  Add-on…** → `extension/dist/firefox/manifest.json`
- **Safari** — needs macOS + Xcode:
  `xcrun safari-web-extension-converter extension/dist/safari`

Full per-browser instructions, minimum versions, and caveats are in
[`extension/docs/BROWSERS.md`](./extension/docs/BROWSERS.md).

## Usage

1. Click the toolbar icon → **Scan this page**. Matches light up: yellow for
   rhetorical tics, blue for Wikipedia-guide signals.
2. **Hover a highlight** to see which signal it is, a short description, and a
   **Read more ↗** link.
3. Tick **Auto-scan this site on load** to add the current site to your
   allowlist — it will then highlight automatically and re-scan on updates.
4. Open **Patterns** in the popup to toggle individual detectors.

## How it works

The original tool operates on a flat string in a textarea. A web page spreads
text across many DOM nodes, so this extension adds a bridge:

```
flatten the visible page text ──▶ run the (unchanged) detectors ──▶ map matches
into one buffer + offset map      over the buffer                   back to DOM
(skip script/style/hidden/                                          Ranges and
 editable nodes; \n at blocks)                                      paint them
```

| File | Responsibility |
| --- | --- |
| `extension/src/patterns.js` | Detector engine — 53 patterns, factories, dedup (38 ported verbatim) |
| `extension/src/detect.js`   | DOM ↔ buffer bridge; match → `Range` mapping; hover lookup; input cap |
| `extension/src/meta.js`     | Per-pattern group + "read more" URL |
| `extension/src/content.js`  | Highlight painting, interactive tooltip, `MutationObserver` |
| `extension/src/background.js` / `popup.*` | Settings, allowlist, per-pattern toggles |

See [`extension/README.md`](./extension/README.md) for the deeper dev notes.

## Development

```bash
cd extension
npm install
npm run build            # esbuild bundle src/ -> dist/
npm test                 # vitest
npx vitest run --coverage
```

The extension is plain ES modules bundled by esbuild — no framework. `patterns.js`
and `detect.js` are unit-tested directly; the browser-integration layer is
verified via [`extension/docs/VERIFY.md`](./extension/docs/VERIFY.md).

## Testing

- **287 tests** (Vitest) — including the reference tool's own positive/negative
  cases run against the port, jsdom tests for the DOM bridge (cross-node ranges,
  node exclusion), and ReDoS/input-cap guards.
- **~96% line coverage** on the detection/bridge modules.

```bash
cd extension && npx vitest run --coverage
```

## Security

- No third-party runtime dependencies; no network egress; nothing exfiltrated.
- Highlights use the Custom Highlight API (no DOM injection); the tooltip is
  built with `textContent` only and its "Read more" link is a hardcoded
  `https://` constant.
- Detectors are bounded (linear) and input is capped to guard against ReDoS on
  hostile pages. See the security entry in
  [`DETAILED_CHANGELOG.md`](./DETAILED_CHANGELOG.md).

Found something? Please open an issue (or a private report for anything
sensitive) rather than a public PoC.

## Requirements

A browser with the CSS Custom Highlight API: **Chrome/Edge 105+, Opera 91+,
Firefox 140+, Safari 17.2+**. Below these the extension loads but does nothing
(it feature-detects and no-ops). Runs in the top frame only. See
[`extension/docs/BROWSERS.md`](./extension/docs/BROWSERS.md) for the full matrix.

## Roadmap

- [ ] **Document-level "AI-likelihood" scoring** — model-free stylometric signals
      (sentence-length burstiness, em-dash density, transition-opener ratio,
      bold-lead-in-list ratio, Unicode-typography co-occurrence) surfaced as a
      convergence-based score in the popup. Design + rationale in
      [`extension/docs/FUTURE_WORK.md`](./extension/docs/FUTURE_WORK.md).
- [ ] Replace placeholder icons with a real mark
- [ ] Dynamic per-allowlisted-origin content-script registration (tighter
      permissions than the current `<all_urls>` declaration)
- [x] Cross-browser builds — Chrome/Edge/Opera/Brave, Firefox, and Safari

## 🤖 AI-Assisted Development

This project was developed with the assistance of AI tools, most notably Cursor
IDE, Claude Code, and Qwen3-Coder. These tools helped accelerate development and
improve velocity. All AI-generated code has been carefully reviewed and validated
through human inspection to ensure it aligns with the project's intended
functionality and quality standards.

## License

[GNU General Public License v3.0 or later](./LICENSE).

The detection engine is adapted from Simon Willison's *llm-cliché-highlighter*
([Apache-2.0](https://github.com/simonw/tools)), and several Wikipedia-group
detectors from Wikipedia's *Signs of AI writing* guide (CC BY-SA). See
[`NOTICE`](./NOTICE) for full attribution.

## Credits

This project began as **Simon Willison's
[llm-cliché-highlighter](https://tools.simonwillison.net/llm-cliche-highlighter)**
(Apache-2.0); we ported its detection engine into this Chrome extension and then
added many more signals — several of them **crowd-sourced from the community**.

- **Detection engine & original heuristics** — Simon Willison,
  [llm-cliché-highlighter](https://tools.simonwillison.net/llm-cliche-highlighter)
- **"Signs of AI writing" detectors** — Wikipedia,
  [Signs of AI writing](https://en.wikipedia.org/wiki/Wikipedia:Signs_of_AI_writing)
- **Vocabulary word lists** — post-ChatGPT frequency studies (Kobak et al.,
  *Science Advances* 2025; Liang et al., ICML 2024)

Community-sourced signals (via X/Twitter):

- **[@yishan](https://x.com/yishan)** — the "cataphoric teaser"
  ([tweet](https://x.com/yishan/status/2093268215853985869)) and "negative
  parallelism" ([tweet](https://x.com/yishan/status/2093268324306284780))
- **[@landosembery](https://x.com/landosembery)** — superlative hook openers
  ([tweet](https://x.com/landosembery/status/2093277440432828554))
- **[@petermajewski](https://x.com/petermajewski)** — more cataphoric-teaser
  examples ([tweet](https://x.com/petermajewski/status/2093481467812688010))
