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
2. **Toolbar badge.** After a scan finds matches, the extension's toolbar icon
   shows a red badge with the match count for that tab (capped at "999+"). With
   several tabs open, each tab shows its own count. Click **Clear** → the badge
   disappears. Navigate the tab to a fresh page → the badge clears (and, on an
   allowlisted site, re-appears with the new page's count after the auto-scan).
3. **Hover tooltip + read more.** Hover a highlight. Expect a dark tooltip with
   the signal name (and chain count where relevant), its description, and a
   **Read more ↗** link. Move into the tooltip and click the link → it opens the
   correct page in a new tab (Wikipedia guide section for blue signals, the
   source tool for yellow ones).
4. **Chain badges.** On "No X, no Y, no Z" style text, the tooltip title includes
   the item count (e.g. "3 'no' items").
5. **Cross-node match.** On text where a match spans inline markup (e.g. a bolded
   word mid-phrase), the highlight still covers the whole phrase.
6. **No interference.** Confirm text in `<textarea>`, inputs, and code blocks is
   not highlighted, and typing into a page field is unaffected.
7. **Allowlist auto-scan.** In the popup, tick **Auto-scan this site on load**.
   Reload the page → highlights appear automatically without clicking Scan.
8. **Dynamic re-scan.** On an allowlisted infinite-scroll/SPA page, load more
   content → new matches get highlighted (debounced).
9. **Pattern toggles.** Untick `colon-triple` is the default; tick it and confirm
   colon-triple matches appear. Untick a pattern and confirm its highlights drop
   on the next scan.
10. **Clear.** Click **Clear** → all highlights and the tooltip disappear (and
    the toolbar badge clears).
11. **Unsupported pages.** On `chrome://` or the extensions page, the popup shows
    "This page type can't be scanned" and the buttons are disabled.
```
