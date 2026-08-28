# Manual verification checklist

The content script, popup, and service worker depend on browser APIs that jsdom
does not implement (`CSS.highlights`, caret hit-testing, `chrome.*`). Unit tests
cover the detection engine and the DOM→buffer bridge; this checklist covers the
browser-integration layer.

## Setup

```
npm install
npm run build
```

Load `extension/dist/` as an unpacked extension (`chrome://extensions` →
Developer mode → Load unpacked).

## Checks

1. **On-demand scan.** Open an article with LLM-flavored prose (or paste the
   reference tool's example text into any editable page and view it). Click the
   toolbar icon → **Scan this page**. Expect: sentences highlighted, rhetorical
   tics in yellow, Wikipedia-group signals in blue. The popup status shows a
   match count.
2. **Hover tooltip + read more.** Hover a highlight. Expect a dark tooltip with
   the signal name (and chain count where relevant), its description, and a
   **Read more ↗** link. Move into the tooltip and click the link → it opens the
   correct page in a new tab (Wikipedia guide section for blue signals, the
   source tool for yellow ones).
3. **Chain badges.** On "No X, no Y, no Z" style text, the tooltip title includes
   the item count (e.g. "3 'no' items").
4. **Cross-node match.** On text where a match spans inline markup (e.g. a bolded
   word mid-phrase), the highlight still covers the whole phrase.
5. **No interference.** Confirm text in `<textarea>`, inputs, and code blocks is
   not highlighted, and typing into a page field is unaffected.
6. **Allowlist auto-scan.** In the popup, tick **Auto-scan this site on load**.
   Reload the page → highlights appear automatically without clicking Scan.
7. **Dynamic re-scan.** On an allowlisted infinite-scroll/SPA page, load more
   content → new matches get highlighted (debounced).
8. **Pattern toggles.** Untick `colon-triple` is the default; tick it and confirm
   colon-triple matches appear. Untick a pattern and confirm its highlights drop
   on the next scan.
9. **Clear.** Click **Clear** → all highlights and the tooltip disappear.
10. **Unsupported pages.** On `chrome://` or the extensions page, the popup shows
    "This page type can't be scanned" and the buttons are disabled.
```
