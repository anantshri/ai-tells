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

Load `extension/dist/chrome/` as an unpacked extension (`chrome://extensions` →
Developer mode → Load unpacked). For Firefox/Safari builds see
[`BROWSERS.md`](BROWSERS.md).

## Checks

1. **On-demand scan.** Open an article with LLM-flavored prose (or paste the
   reference tool's example text into any editable page and view it). Click the
   toolbar icon → **Scan this page**. Expect: sentences highlighted, rhetorical
   tics in yellow, Wikipedia-group signals in blue. The popup status shows a
   match count.
2. **Graded toolbar badge.** After scanning a page with enough text (≈150+
   words), the toolbar icon shows a badge with the number of document-level AI
   signals that co-fired, tinted by tier: green (0–2), amber (3–4), orange (5–6),
   red (7+). Each tab shows its own grade. On a short page the badge stays empty
   (the grader abstains). Click **Clear** → the badge disappears. Navigate the
   tab → the badge clears (and re-appears after an allowlisted auto-scan).
3. **Popup Analysis panel.** After a scan (or on opening the popup on an
   auto-scanned page), the popup shows a coloured grade chip, the tier + fired /
   applicable signal count, and a per-signal breakdown (fired signals bold with
   a red dot; n/a signals dimmed). The false-positive caveat is visible. On a
   short page it reads "Not graded — needs ≥150 words".
4. **Hover tooltip + read more.** Hover a highlight. Expect a dark tooltip with
   the signal name (and chain count where relevant), its description, and a
   **Read more ↗** link. Move into the tooltip and click the link → it opens the
   correct page in a new tab (Wikipedia guide section for blue signals, the
   source tool for yellow ones).
5. **Chain badges.** On "No X, no Y, no Z" style text, the tooltip title includes
   the item count (e.g. "3 'no' items").
6. **Cross-node match.** On text where a match spans inline markup (e.g. a bolded
   word mid-phrase), the highlight still covers the whole phrase.
7. **No interference.** Confirm text in `<textarea>`, inputs, and code blocks is
   not highlighted, and typing into a page field is unaffected.
8. **Allowlist auto-scan.** In the popup, tick **Auto-scan this site on load**.
   Reload the page → highlights appear automatically without clicking Scan.
9. **Dynamic re-scan.** On an allowlisted infinite-scroll/SPA page, load more
   content → new matches get highlighted (debounced).
10. **Pattern toggles.** Untick `colon-triple` is the default; tick it and confirm
    colon-triple matches appear. Untick a pattern and confirm its highlights drop
    on the next scan.
11. **Clear.** Click **Clear** → all highlights and the tooltip disappear (and
    the toolbar badge + Analysis panel clear).
12. **Unsupported pages.** On `chrome://` or the extensions page, the popup shows
    "This page type can't be scanned" and the buttons are disabled.
```
