# Cross-browser support

The extension runs on all major engines. The detection/UI code is identical
everywhere (callback-style `chrome.*` works in every target, and the code
feature-detects the CSS Custom Highlight API and caret APIs). Only the manifest's
`background` key differs, so `npm run build` emits a package per engine:

```
dist/chrome/    Chrome, Edge, Opera, Brave, and any other Chromium browser
dist/firefox/   Firefox  (background.scripts + gecko add-on id)
dist/safari/    Safari   (background.scripts; convert with Xcode — see below)
```

Build everything with `npm run build`, or one target with
`npm run build:chrome` / `build:firefox` / `build:safari`.

## Minimum versions

Driven by the CSS Custom Highlight API (the newest thing we use). Below these the
extension loads but simply does nothing (the code no-ops via feature detection).

| Browser | Minimum | Notes |
| --- | --- | --- |
| Chrome / Edge | **105** | Chromium; `dist/chrome` |
| Opera | **91** | Chromium; `dist/chrome` |
| Brave / other Chromium | 105 | `dist/chrome` |
| Firefox | **140** | Highlight API shipped in FF 140 (Jun 2025); `dist/firefox` |
| Safari | **17.2** | Highlight API since 17.2; `dist/safari` + Xcode |

We keep the legacy `caretRangeFromPoint` fallback alongside the standard
`caretPositionFromPoint`, so hover works without raising the floor to Chrome 128 /
Safari 26.2.

## Chrome / Edge / Opera / Brave

`npm run build` then load `dist/chrome/` unpacked:

- **Chrome/Brave:** `chrome://extensions` → Developer mode → Load unpacked → `dist/chrome`
- **Edge:** `edge://extensions` → Developer mode → Load unpacked → `dist/chrome`
- **Opera:** `opera://extensions` → Developer mode → Load unpacked → `dist/chrome`

No per-browser tweaks — they're all Chromium and use the `service_worker`
background.

## Firefox

Load `dist/firefox/` temporarily:

1. `about:debugging#/runtime/this-firefox`
2. **Load Temporary Add-on…** → select `dist/firefox/manifest.json`

The manifest carries a `browser_specific_settings.gecko.id` — this is **required**
for `storage.sync` to work in Firefox (synced storage is keyed to the add-on id)
and for signing. For a permanent install, sign the package via
[AMO / `web-ext sign`](https://extensionworkshop.com/documentation/publish/signing-and-distribution-overview/).

Caveats:
- Firefox uses an **event-page** background (`background.scripts`), not a service
  worker.
- Firefox can't apply `text-decoration` to custom highlights, so the underline is
  dropped — the yellow/blue **background colours** still distinguish the two
  groups.

## Safari

Safari packaging requires **macOS + Xcode** and can't be produced in a Linux CI.
The `dist/safari/` package is Safari-ready (event-page background, no service
worker); convert it on a Mac:

```bash
xcrun safari-web-extension-converter dist/safari \
  --app-name "AI Tells" \
  --bundle-identifier dev.aitells.extension
```

This generates an Xcode project; build and run it, then enable the extension in
Safari → Settings → Extensions (and allow unsigned extensions via Develop →
"Allow Unsigned Extensions" during development). Distribution is via a signed app
through the App Store or notarised direct download.

## Why the split (for maintainers)

| Concern | Chrome/Edge/Opera | Firefox | Safari |
| --- | --- | --- | --- |
| Background | `service_worker` | `scripts` (event page) | `scripts` (SW is buggy) |
| Add-on id | not needed | **required** (`gecko.id`) | set in Xcode project |
| `chrome.*` callbacks | native | porting-aid (works) | supported |
| Packaging | load unpacked / zip | zip / signed | Xcode converter |

Everything else — permissions (`storage`, `activeTab`, `scripting`), the
`<all_urls>` content script, the popup, and all detection code — is shared
verbatim across targets.
