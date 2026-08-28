# AI Cliché Highlighter (Chrome extension)

Highlights LLM writing "tells" on any web page — the same signals as Simon
Willison's [llm-cliche-highlighter](https://tools.simonwillison.net/llm-cliche-highlighter)
plus the tells catalogued in Wikipedia's
[Signs of AI writing](https://en.wikipedia.org/wiki/Wikipedia:Signs_of_AI_writing)
guide. Hover a highlight to see which signal was picked and a link to read more.

## What it does

- **41 detectors** in two groups — "Rhetorical tics" (yellow) and "Signs of AI
  writing (Wikipedia)" (blue). The core engine is ported **verbatim** from the
  reference tool (38 detectors); three more Wikipedia-guide signs were added on
  top (copulative avoidance, vague association, canned notability), and the
  vocabulary/chatbot-leftover detectors were extended with newer signs.
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
src/patterns.js   detector engine (41 patterns + factories + dedup); 38 ported verbatim
src/meta.js       per-pattern group + "read more" URL
src/detect.js     DOM <-> buffer bridge, match -> Range mapping, hover lookup
src/content.js    highlight painting, interactive tooltip, MutationObserver
src/background.js  seeds default settings on install
src/popup.*        scan/clear, per-site auto-scan toggle, per-pattern toggles
```

## Build & load

```
npm install
npm run build            # bundles src/ -> dist/ with esbuild
```

Then in Chrome: `chrome://extensions` → enable Developer mode → **Load unpacked**
→ select the `extension/dist/` folder.

## Test

```
npm test                 # vitest, 201 cases
npx vitest run --coverage
```

`tests/patterns.test.js` runs the reference tool's own positive/negative cases
against the ported engine; `tests/detect.test.js` exercises the DOM bridge under
jsdom; `tests/meta.test.js` checks the read-more links. See
[`docs/VERIFY.md`](docs/VERIFY.md) for the manual in-browser checklist.

## Requirements

Chrome 105+ (CSS Custom Highlight API). Runs in the top frame only.

## License

[GPL-3.0-or-later](../LICENSE). The detection engine is adapted from Simon
Willison's llm-cliché-highlighter (Apache-2.0); see [`../NOTICE`](../NOTICE) for
attribution.
