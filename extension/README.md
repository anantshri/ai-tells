# AI Tells (browser extension)

Highlights LLM writing "tells" on any web page — the same signals as Simon
Willison's [llm-cliche-highlighter](https://tools.simonwillison.net/llm-cliche-highlighter)
plus the tells catalogued in Wikipedia's
[Signs of AI writing](https://en.wikipedia.org/wiki/Wikipedia:Signs_of_AI_writing)
guide. Hover a highlight to see which signal was picked and a link to read more.

## What it does

- **53 detectors** in two groups — "Rhetorical tics" (yellow) and "Signs of AI
  writing (Wikipedia)" (blue). The core engine is ported **verbatim** from the
  reference tool (38 detectors); 15 more were added on top — three
  Wikipedia-guide signs (copulative avoidance, vague association, canned
  notability) and twelve research-/community-sourced phrase detectors (chatbot
  pleasantries, scene-setting openers, journey metaphors, "dive into", hype
  buzzwords, formulaic conclusions, vague appeals to research, corporate
  buzzwords, AI fiction clichés, "something for everyone", the cataphoric teaser,
  and superlative hook openers) — and the vocabulary/chatbot-leftover detectors
  were extended with
  study-validated words and newer markup artifacts.
  A document-level statistical scoring layer is planned; see
  [`docs/FUTURE_WORK.md`](docs/FUTURE_WORK.md).
- **No DOM mutation.** Highlights are painted with the
  [CSS Custom Highlight API](https://developer.mozilla.org/en-US/docs/Web/API/CSS_Custom_Highlight_API)
  (`CSS.highlights` + `Range`), so pages and frameworks aren't disturbed.
- **Hover tooltip** naming the signal, its description, and a **Read more** link
  (Wikipedia guide section for the Wikipedia group; the source catalogue for the
  rhetorical tics).
- **Allowlist activation.** Opt a site in and it auto-scans on load and re-scans
  on DOM changes; everywhere else, click **Scan this page** in the popup.
- `colon-triple` ships **off** by default (noisy on technical pages); toggle any
  detector in the popup.

## How it works

The reference tool slices a flat string; a web page spreads text across many DOM
nodes. `src/detect.js` flattens the visible page text into one buffer (inserting
`\n` at block boundaries and skipping `script`/`style`/hidden/editable nodes),
runs the unchanged `collectMatches` from `src/patterns.js`, then maps each match
back onto a DOM `Range` (which may span nodes). `src/content.js` paints those
ranges and resolves hovers via caret hit-testing back through the buffer map.

```
src/patterns.js   detector engine (53 patterns + factories + dedup); 38 ported verbatim
src/meta.js       per-pattern group + "read more" URL
src/detect.js     DOM <-> buffer bridge, match -> Range mapping, hover lookup
src/content.js    highlight painting, interactive tooltip, MutationObserver
src/background.js  seeds default settings on install
src/popup.*        scan/clear, per-site auto-scan toggle, per-pattern toggles
```

## Build & load

```
npm install
npm run build            # emits dist/chrome, dist/firefox, dist/safari
# or one target: npm run build:chrome | build:firefox | build:safari
```

- **Chrome/Edge/Opera/Brave:** `chrome://extensions` → Developer mode → **Load
  unpacked** → `dist/chrome`
- **Firefox:** `about:debugging` → **Load Temporary Add-on…** → `dist/firefox/manifest.json`
- **Safari:** `xcrun safari-web-extension-converter dist/safari` (macOS + Xcode)

Full matrix and caveats: [`docs/BROWSERS.md`](docs/BROWSERS.md).

## Test

```
npm test                 # vitest
npx vitest run --coverage
```

`tests/patterns.test.js` runs the reference tool's own positive/negative cases
against the ported engine; `tests/detect.test.js` exercises the DOM bridge under
jsdom; `tests/meta.test.js` checks the read-more links. See
[`docs/VERIFY.md`](docs/VERIFY.md) for the manual in-browser checklist.

## Requirements

CSS Custom Highlight API support: Chrome/Edge 105+, Opera 91+, Firefox 140+,
Safari 17.2+. Below these it loads but no-ops (feature-detected). Runs in the top
frame only. See [`docs/BROWSERS.md`](docs/BROWSERS.md).

## License

[GPL-3.0-or-later](../LICENSE). The detection engine is adapted from Simon
Willison's llm-cliché-highlighter (Apache-2.0); see [`../NOTICE`](../NOTICE) for
attribution.
