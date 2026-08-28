<div align="center">

# 🖍️ AI Cliché Highlighter

**A Chrome extension that highlights LLM writing clichés on any web page — and tells you which "tell" it caught.**

[![License: GPL v3](https://img.shields.io/badge/License-GPLv3-blue.svg)](./LICENSE)
[![Manifest V3](https://img.shields.io/badge/Manifest-V3-4285F4.svg?logo=googlechrome&logoColor=white)](./extension/manifest.json)
[![Tests](https://img.shields.io/badge/tests-232%20passing-brightgreen.svg)](./extension/tests)
[![Coverage](https://img.shields.io/badge/coverage-96%25-brightgreen.svg)](#testing)
[![Zero runtime deps](https://img.shields.io/badge/runtime%20deps-0-success.svg)](./extension/package.json)

</div>

---

Paste-free. It reads the text already on the page, highlights the sentences that
match known LLM writing tells, and on hover shows **which signal** it matched
plus a link to **read more** about it. The detection engine is ported from Simon
Willison's [llm-cliché-highlighter](https://tools.simonwillison.net/llm-cliche-highlighter),
extended with tells from Wikipedia's
[Signs of AI writing](https://en.wikipedia.org/wiki/Wikipedia:Signs_of_AI_writing)
guide.

> **Why:** LLM prose has recognisable habits — "not just X, but Y", "stands as a
> testament", "delve", stacked rhetorical questions, "no fluff, no filler". This
> surfaces them in place so you can judge a page for yourself.

## Features

- **41 detectors** in two groups — *Rhetorical tics* (yellow) and *Signs of AI
  writing (Wikipedia)* (blue).
- **No DOM mutation** — highlights are painted with the
  [CSS Custom Highlight API](https://developer.mozilla.org/en-US/docs/Web/API/CSS_Custom_Highlight_API),
  so pages and web apps aren't disturbed.
- **Hover to explain** — an interactive tooltip names the signal, describes it,
  and links to the source (Wikipedia guide section, or the original tool).
- **Per-site allowlist** — opt a site in and it auto-scans on load and re-scans
  as the page changes; everywhere else, scan on demand from the popup.
- **Toggle any detector** — 41 individually switchable; the noisy `colon-triple`
  ships off by default.
- **Private & self-contained** — everything runs locally, **zero runtime
  dependencies**, no network calls, nothing leaves your browser.

## Install (from source)

Chrome / Edge / Brave (any Chromium 105+):

```bash
git clone <your-repo-url>
cd <repo>/extension
npm install
npm run build          # bundles src/ -> dist/
```

Then load it:

1. Open `chrome://extensions`
2. Enable **Developer mode** (top-right)
3. Click **Load unpacked** and select the `extension/dist/` folder

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
| `extension/src/patterns.js` | Detector engine — 41 patterns, factories, dedup (38 ported verbatim) |
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

- **232 tests** (Vitest) — including the reference tool's own positive/negative
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

Chromium-based browser, version **105+** (for the CSS Custom Highlight API and
caret hit-testing). Runs in the top frame only.

## Roadmap

- [ ] Replace placeholder icons with a real mark
- [ ] Dynamic per-allowlisted-origin content-script registration (tighter
      permissions than the current `<all_urls>` declaration)
- [ ] Optional Firefox (`browser.*`) build

## License

[GNU General Public License v3.0 or later](./LICENSE).

The detection engine is adapted from Simon Willison's *llm-cliché-highlighter*
([Apache-2.0](https://github.com/simonw/tools)), and several Wikipedia-group
detectors from Wikipedia's *Signs of AI writing* guide (CC BY-SA). See
[`NOTICE`](./NOTICE) for full attribution.

## Credits

- Detection heuristics: **Simon Willison** — [llm-cliché-highlighter](https://tools.simonwillison.net/llm-cliche-highlighter)
- Additional signs: **Wikipedia** — [Signs of AI writing](https://en.wikipedia.org/wiki/Wikipedia:Signs_of_AI_writing)
