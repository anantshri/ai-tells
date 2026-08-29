# Detailed Changelog

The long-form companion to `CHANGELOG.md`. Where `CHANGELOG.md` says *what*
changed in one line, this file records *why* and *how* — enough for a future
reader to audit, reproduce, or roll back any change without re-deriving it.

Add a new entry (newest first) for every meaningful change. Use the template
below; drop sections that genuinely don't apply.

---

## 2026-08-29 — Cataphoric-teaser detector (from a @yishan thread)

**Summary:** Added a `cataphoric-teaser` detector for the forward-referencing
suspense hook that manufactures cheap curiosity — the LLM descendant of clickbait.
51 → 52.

**Why:** A @yishan thread (x.com/yishan/status/2093268215853985869) noted this
"annoying tell of AI text" has a linguistic name — the *cataphoric teaser* — with
examples ("Here's the part that nobody tells you…", "Here's what most people get
wrong…", "The part most people sleep on…"). Confirmed our existing
`heres-the-twist` / `thats-the-part` detectors did **not** catch these (fixed
noun lists + required trailing punctuation), so it was a genuine gap.

**What changed:**
- `extension/src/patterns.js` — new `cataphoric-teaser` detector matching
  "here's what/the … (that) nobody/most people/no one …", "the part/secret/… (that)
  nobody/most people …", "what most people get wrong", "what nobody tells you",
  "nobody talks about", "most people sleep on/miss/overlook".
- `extension/tests/new-signs.test.js` (+6 cases); `tests/patterns.test.js` ADDED
  set; README/count bumps.

**How / commands run:**
```
# X blocks anonymous fetch (402 / Jina 403); pulled the tweet via the
# fxtwitter + vxtwitter JSON APIs (no auth).
npx vitest run             # 279 passed
# ReDoS check: 2ms on 336k-char adversarial input (linear)
npm run build              # dist/content.js 50.2kb
aidc-scan                  # clean
```

**Verification:** All of yishan's examples match; negatives clean ("Here is your
coffee", "The part number is 4032", "What most people ordered was pizza" → 0);
does not fire on the reference EXAMPLE. 279/279 tests; build/scan clean.

**Notes:** Overlaps slightly with `heres-the-twist`/`thats-the-part`; overlap
dedup (first-by-start wins) keeps a single highlight per span.

## 2026-08-29 — Research-backed detectors (phrases + validated vocabulary)

**Summary:** Researched quantitative AI-word studies, open-source slop-detector
codebases, and structural/statistical AI-text signals, then added the highest-
precision, lowest-false-positive findings as new detectors. 41 → 47.

**Why:** Requested — leverage internet research and existing codebases to improve
the tool's ability to catch AI clichés/text.

**What changed (`extension/src/patterns.js`):**
- Six new phrase detectors (in the "Rhetorical tics" group): `chat-boilerplate`
  (assistant pleasantries — "Certainly!", "I'd be happy to help", "feel free
  to"), `scene-setting` ("in today's fast-paced world", "in the realm of", "when
  it comes to"), `journey-metaphor` ("embark on a journey", "navigating the
  complexities of", "pave the way", "unlock the potential", "shed light on"),
  `dive-in` ("dive into", "deep dive", "let's explore"), `hype-buzzwords`
  ("game-changer", "cutting-edge", "paradigm shift", …), and `conclusion-wrapper`
  (sentence-initial "In conclusion / In summary / Ultimately,").
- `ai-vocab` extended with study-validated rare, high-precision words: elucidate,
  delineate, juxtapose, streamline, catalyze, transcend, unveil, illuminate,
  spearhead, exemplify, encapsulate, propel, burgeoning, noteworthy,
  groundbreaking, unparalleled, transformative, nuanced, renowned, invaluable,
  versatile, myriad, prowess.
- `extension/tests/new-signs.test.js` — +30 positive/negative cases;
  `tests/patterns.test.js` — EXAMPLE-invariant ADDED set updated; README counts.

**How / commands run:**
```
# three parallel research agents: (1) quantitative word-frequency studies
# (Kobak et al. Science Advances 2025; Liang et al. ICML 2024), (2) OSS slop
# detectors (slop-gate, proselint, write-good, SlopDetector tiers), (3)
# structural/statistical signals (burstiness, em-dash density, MATTR).
npx vitest run --coverage   # 259 passed; logic modules 96.55% lines
# ReDoS spot-check: new detectors ~1-3ms on 336k-char adversarial input (linear)
npm run build               # dist/content.js 46.3kb
aidc-scan                   # clean
```

**Errors encountered & resolution:** None. Deliberately EXCLUDED the studies'
high-frequency common words (potential, crucial, additionally, significant,
comprehensive, notably) — they carry the largest raw excess but over-trigger on
normal writing; the research is emphatic that those only signal in aggregate, not
per-hit. Only rare, high-precision items were added.

**Verification:** 259/259 tests; every new detector spot-checked for positives
and negatives (e.g. "He absolutely nailed it", "the ultimate frisbee match",
"the pelican dove into the sea" do not match). `aidc-scan` clean; build loadable.

**Follow-up (same day):** After review, added four more high-precision phrase
detectors — `false-authority` ("studies have shown", "research suggests", "the
data speaks for itself"), `corporate-buzzwords` ("holistic approach", "seamless
integration", "synergy"), `fiction-slop` ("a shiver ran down her spine", "took a
deep breath", "little did they know"), and `something-for-everyone`. 47 → 51.
Tests 259 → 273; build/scan clean.

**Notes / follow-ups:** The biggest remaining capability leap identified by the
research is a **document-level statistical layer** — sentence-length burstiness
(CV), em-dash density per 1k words, transition-opener ratio, bold-lead-in-list
ratio, and a Unicode-typography co-occurrence check — surfaced as a convergence-
based "AI-likelihood" score rather than per-span highlights. Per the user's
decision it is **deferred and documented** as future work in
`extension/docs/FUTURE_WORK.md` (with formulas, thresholds, the convergence/min-
size caveats, and a suggested implementation shape). All signals are O(n) and
model-free but belong behind an explicit score UI to avoid over-flagging
non-native/formal writers.

## 2026-08-28 — Project README, GPL-3.0 license, and attribution

**Summary:** Added a GitHub-style repo `README.md`, a `LICENSE` (GNU GPL v3.0),
and a `NOTICE` file; relicensed the extension from MIT to GPL-3.0-or-later.

**Why:** The project became a standalone git repository and needed a proper
landing page and an explicit license (user chose GPL-3.0).

**What changed:**
- `README.md` (new, repo root) — features, install-from-source, usage, how-it-
  works, development, testing, security, requirements, roadmap, license, credits,
  with shields.io badges.
- `LICENSE` (new) — verbatim GNU GPL v3.0 text (fetched from gnu.org).
- `NOTICE` (new) — attribution: the ported detection engine
  (`extension/src/patterns.js`) derives from Simon Willison's
  llm-cliché-highlighter, which is **Apache-2.0** (GPL-3.0-compatible), and the
  Wikipedia-group detectors from Wikipedia's CC BY-SA guide.
- `extension/package.json` — `license` MIT → `GPL-3.0-or-later`.
- `extension/README.md` — added a License section.

**How / commands run:**
```
curl -s https://raw.githubusercontent.com/simonw/tools/master/LICENSE   # -> Apache-2.0
curl -s https://www.gnu.org/licenses/gpl-3.0.txt -o LICENSE             # 674 lines
aidc-scan   # license-check + vet now in scope (LICENSE + manifest changed) -> clean
```

**Errors encountered & resolution:** None. Verified Apache-2.0 → GPL-3.0
compatibility for the ported code (permissive-into-copyleft is allowed with
attribution retained); the original credit and the noted modifications already
live in the `patterns.js` header.

**Verification:** `aidc-scan` clean including `license-check` and `vet` (both now
triggered by the LICENSE/manifest change). `LICENSE` is the full GPL-3.0 text
(35,149 bytes, ends with the "How to Apply" appendix).

**Notes / follow-ups:** License field uses the SPDX `GPL-3.0-or-later`; switch to
`GPL-3.0-only` if you want to pin to exactly v3. Keeping `patterns.js` under its
original Apache-2.0 attribution satisfies Apache §4 (retain notice, state
changes).

## 2026-08-28 — Security review + ReDoS fix

**Summary:** Thorough security review of the extension (DOM/XSS/exfiltration
surface and privilege/messaging/permissions/build surface). One real issue found
and fixed: a ReDoS/DoS in the detectors. Everything else came back clean.

**Why:** Requested security review to ensure no issues before shipping.

**What changed:**
- `extension/src/patterns.js` — bounded the previously-unbounded negated-class
  quantifiers that caused O(n²) backtracking on terminator-free input:
  `makeQuestionChainFinder` and `makeAnaphoraFinder` sentence classes now
  `[^.!?\n]{1,400}`, and the `no-chain` / `did-not-chain` chain-body classes now
  `[^,.;:!?\n…]{0,400}`. Detection is now linear; normal prose is unaffected
  (real sentences/items are far shorter than 400 chars).
- `extension/src/detect.js` — `scan()` caps detection at `MAX_SCAN_CHARS`
  (500,000) as defence-in-depth and returns a `truncated` flag; range mapping
  still uses the full segment list.
- `extension/src/content.js` — `chrome.runtime.onMessage` now rejects messages
  whose `sender.id !== chrome.runtime.id` (explicit trust boundary).
- `extension/src/popup.js` — guards `allowlist`/`disabledPatterns` with
  `Array.isArray` against a corrupted stored value.
- `extension/tests/security.test.js` — new: ReDoS timing guards (pathological
  200k-char inputs finish < 3s), correctness-after-bounding checks, and
  input-cap/truncation tests.

**How / commands run:**
```
# empirical ReDoS confirmation before/after
node ... timing harness   # before: stacked-questions/anaphora O(n^2), 62->218->854->3691ms
                          # after:  linear, ~300ms at 400k chars
npx vitest run --coverage # 232 passed; logic modules 96.4% lines
npm run build             # dist/content.js 41.8kb
aidc-scan                 # clean
```

**Errors encountered & resolution:** A new truncation test used `toContain` on
an array (exact-element) when the raw match string includes a trailing word;
switched to a substring `some(...includes)` assertion.

**Verification:** Reviewed all six source files across two threat surfaces.
Confirmed clean: no `innerHTML`/HTML-injection (tooltip is `textContent`/
`createElement` only), the "Read more" `href` is provably a hardcoded `https://`
constant (never page-derived), no prototype-pollution sink, no page→extension
channel, listeners removed symmetrically, no page data leaves the page, zero
runtime dependencies, no `postinstall`, no `web_accessible_resources`, and the
allowlist origin check (`allowlist.includes(location.origin)`) is exact-origin
with no subdomain/port/scheme/case bypass. Fixed the one MEDIUM (ReDoS). Re-ran
tests (232/232) and `aidc-scan` (clean).

**Notes / follow-ups:** Reviewers also suggested (non-blocking, low-medium)
replacing the static `<all_urls>` content-script declaration with per-allowlisted
-origin `chrome.scripting.registerContentScripts` so the extension isn't present
on every site the user visits — a privilege-minimisation improvement (the idle
script only reads its own storage, so not a vulnerability) and smoother Web Store
review. Deferred as an architecture change.

## 2026-08-28 — New "Signs of AI writing" detectors from the updated guide

**Summary:** Re-checked Wikipedia's "Signs of AI writing" guide against the
extension's Wikipedia-group detectors and added the newly-catalogued prose-level
signs. Detector count 38 → 41.

**Why:** The guide has expanded considerably since the reference tool was built.
User approved adding all four candidate groups after a gap analysis.

**What changed:**
- `extension/src/patterns.js`:
  - `ai-leftovers` extended with new model-specific markup artifacts — Grok
    (`grok_render_citation_card_json`, `grok_card`), Perplexity
    (`ppl-ai-file-upload`, `attached_file`), Gemini (`[cite: N]`, `start_span`/
    `end_span`), and `:::writing`.
  - `ai-vocab` extended with newer-era words: showcase, foster, leverage,
    enhance, "align with".
  - New detectors `copulative-avoidance` ("serves/stands/functions as a"),
    `vague-association` ("in connection with", "associated with"), and
    `canned-notability` ("active social media presence", "featured in … media
    outlets", "garnered widespread coverage/acclaim").
- `extension/src/meta.js` — "Read more" section anchors for the three new ids.
- `extension/tests/new-signs.test.js` — 23 positive/negative cases for the added
  signs; `tests/patterns.test.js` — the "trips every pattern once" invariant now
  excludes the three additions (they aren't in the reference EXAMPLE).
- `extension/README.md` — count updated to 41 (38 ported + 3 added).

**How / commands run:**
```
npx vitest run --coverage   # 224 passed (was 201); logic modules 96.34% lines
npm run build               # dist/content.js 41.5kb
aidc-scan                   # clean
```

**Errors encountered & resolution:** Adding patterns broke the EXAMPLE-coverage
invariant test (EXAMPLE only exercises the 38 ported patterns); updated the test
to assert the added ids are absent from EXAMPLE while every reference pattern
still trips exactly once.

**Verification:** 224/224 vitest; `aidc-scan` clean; build produces loadable
`dist/`. New detectors spot-checked for positives and negatives (e.g. "serves
coffee" and "connected the wires" do not match).

**Notes / follow-ups:** The three new prose detectors are inherently a bit noisier
than the ported set (esp. `vague-association`'s "associated with" and
`canned-notability`); all remain individually toggleable and ship enabled.
Wikipedia-internal/formatting signs (title case, heading levels, DOIs, edit
summaries, em-dash/boldface overuse, etc.) were deliberately not added — they
don't apply to highlighting prose on a general web page. Section anchors are
best-effort; a wrong anchor lands at the guide top, never a broken page.

## 2026-08-28 — Fix: hover tooltip stuck on screen

**Summary:** The extension's hover tooltip would not disappear after the cursor
moved off the highlight or the tooltip.

**Why:** The injected tooltip style used `#tooltip { all: initial; }` to insulate
it from page CSS. `all: initial` resets `display` to `inline` and, being an
`#id` rule, outranks the user-agent `[hidden] { display: none }` rule — so
`tip.hidden = true` had no visual effect and the tooltip stayed visible.

**What changed:**
- `extension/src/content.js` — added `display: block` to the tooltip base rule
  and a higher-specificity `#tooltip[hidden] { display: none; }` rule so the
  `hidden` toggle actually hides it. Added a `documentElement` `mouseleave`
  listener (registered in `runScan`, removed in `deactivate`) so the tooltip also
  hides when the pointer leaves the page/window with no further `mousemove`.

**How / commands run:**
```
npm run build            # dist/content.js 39.0kb
npx vitest run           # 201/201 passed
aidc-scan                # clean
```

**Verification:** Rebuilt; unit suite still 201/201 (the tooltip is browser-only
so it's covered by the manual checklist). Re-scanned clean. Manual: hovering a
highlight shows the tooltip; moving off the highlight or tooltip, scrolling,
pressing Escape, or leaving the window now dismisses it.

**Notes / follow-ups:** Keeps `all: initial` for page-CSS insulation; the hidden
state is enforced by the more-specific attribute selector rather than the UA
default.

## 2026-08-28 — AI Cliché Highlighter Chrome extension

**Summary:** Added a Manifest V3 Chrome extension under `extension/` that
highlights LLM writing "tells" on live web pages. It reuses the detection logic
from Simon Willison's [llm-cliche-highlighter](https://tools.simonwillison.net/llm-cliche-highlighter)
(and the Wikipedia "Signs of AI writing" tells it bundles) and adds a page-aware
rendering/hover layer. Hovering a highlight shows which signal was picked plus a
"Read more" link.

**Why:** Requested — extract every regex/heuristic the reference tool uses and
turn it into an extension that highlights matches on any page rather than in a
textarea.

**What changed:**
- `extension/src/patterns.js` — the reference "impl" block ported verbatim (38
  detectors + 5 factories + `collectMatches`/`buildRegions`/`sentenceBounds`),
  with ES-module exports appended. One deliberate deviation: the two chain
  regexes were hoisted from `new RegExp(head, ...)` to hardcoded literals to
  clear semgrep's detect-non-literal-regexp (ReDoS) rule; behaviour is identical
  and proven by the ported test cases.
- `extension/src/meta.js` — per-pattern group + "Read more" URL (Wikipedia guide
  section anchors for the Wikipedia group, the source tool for the rhetorical
  tics).
- `extension/src/detect.js` — new DOM↔buffer bridge: flattens visible page text
  into a buffer with a text-node offset map (skipping script/style/hidden/
  editable nodes, inserting `\n` at block boundaries), runs the unchanged
  detectors, and maps matches back to DOM `Range`s (multi-node safe). Also the
  reverse lookup used for hover hit-testing.
- `extension/src/content.js` — paints ranges via `CSS.highlights` (two colours by
  group), interactive hover tooltip with the signal name/description/read-more
  link resolved through caret hit-testing, and a debounced `MutationObserver`.
- `extension/src/background.js` + `popup.*` — settings defaults on install; popup
  for scan/clear, per-site auto-scan allowlist, and per-pattern toggles.
- `extension/manifest.json`, `build.mjs` (esbuild bundle src→dist),
  `package.json`, `vitest.config.js`, generated placeholder icons.
- `extension/tests/` — `patterns.test.js` runs the reference tool's own
  positive/negative cases against the port; `detect.test.js` (jsdom) covers the
  DOM bridge incl. cross-node ranges and node exclusion; `meta.test.js` checks
  the links. `README.md` + `docs/VERIFY.md` (manual browser checklist).

**How / commands run:**
```
# port the impl block verbatim from the fetched reference HTML
node -e '...split on the impl/tests marker comments...' > src/patterns.js
npm install
npm run build            # dist/: content 38.5kb, popup 28.9kb, background 416b
npx vitest run --coverage  # 201 passed; logic modules 96.21% lines
aidc-scan                # clean after the chain-regex fix
```

**Errors encountered & resolution:**
- Initial hand-count of "32 patterns" in planning was wrong — the reference array
  actually has 38 (27 rhetorical tics + 11 Wikipedia). The verbatim port is the
  source of truth; docs updated to 38.
- `aidc-scan` (semgrep) flagged `new RegExp` built from the chain finder's `head`
  argument as a ReDoS smell. Fixed per semgrep's guidance by converting the two
  chain regexes to hardcoded literals and passing them into `makeChainFinder`;
  re-ran tests (still 201/201) and re-scanned (clean).
- `npm audit` shows dev-only advisories (esbuild dev-server chain via vitest);
  `npm audit --omit=dev` (what the gate uses) reports 0. Bumped our direct
  esbuild to ^0.25 anyway.

**Verification:** `npx vitest run` → 201/201; coverage 96.21% lines on
patterns/detect/meta. `aidc-scan` → all scanners clean. `npm run build` produces
a loadable `dist/`. Browser-integration layer to be verified via
`extension/docs/VERIFY.md` (jsdom can't exercise `CSS.highlights`/`chrome.*`).

**Notes / follow-ups:** Rendering uses the CSS Custom Highlight API (Chrome
105+); matches straddling block boundaries are trimmed to the nearest text.
Wikipedia deep-link anchors fall back to the guide root if a heading ever drifts.
Placeholder icons are solid-colour PNGs — replace before any store submission.

## YYYY-MM-DD — <short title>

**Summary:** One or two sentences on what changed and the user-facing effect.

**Why:** The problem, request, or constraint that prompted this. Link the issue
/ ticket / discussion if there is one.

**What changed:**
- File-by-file or component-by-component list of the edits.

**How / commands run:**
```
# exact commands executed, with the relevant output
```

**Errors encountered & resolution:** Anything that went wrong and how it was
fixed (or why it was left as-is).

**Verification:** How the change was proven to work — tests run, scanners,
manual checks, screenshots.

**Notes / follow-ups:** Design choices, trade-offs, and anything deferred.
