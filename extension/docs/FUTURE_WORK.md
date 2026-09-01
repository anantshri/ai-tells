# Future work

Ideas evaluated and deferred, with enough detail to pick up later.

## Document-level statistical / stylometric scoring (partially implemented)

**Status (2026-08-29): shipped a first cut** — `src/stats.js` computes a
document-level grade during each scan, the toolbar badge shows the co-firing
signal count tinted by tier, and the popup has an Analysis panel with the
per-signal breakdown and caveat. Implemented signals: sentence-length
burstiness, paragraph-length uniformity, em-dash density, transition openers,
expletive openers, rule-of-three density, unicode-typography cluster, the
DOM bold-lead-in-list ratio, and (2026-09-01) **antithesis / negative-parallelism
density**. **Still deferred** (kept out to stay high-precision): lexical
diversity (MATTR), nominalization↑/adverb↓, and punctuation-variety poverty —
see the table below.

> **Note on em-dash density (2026-09-01):** `signalEmDash` counts only the
> typographic em-dash `—` (U+2014), deliberately *not* the ASCII `--` double
> hyphen. A friend's run of the tool on plain-text `--`-heavy prose was a useful
> reminder why: LLMs overwhelmingly emit `—`, while someone typing in a plain
> editor produces `--`, so a high `--` rate leans *human*, not AI. Folding `--`
> into the em-dash signal would invert its meaning. If `--` ever becomes a
> signal it belongs as its own (toward-human) feature, tracked separately.

The current tool is a **per-span highlighter** — it flags specific words/phrases.
The complementary capability is a **document-level "AI-likelihood" score**
computed from stylometric signals. These are all **model-free and O(n)** over the
page's visible text (no API, no ML), so they fit a client-side extension.

### Candidate signals (with formulas and thresholds from the research)

| Signal | Computation | AI direction / threshold | FP risk |
| --- | --- | --- | --- |
| **Sentence-length burstiness (CV)** | `stdev(sentenceWordCounts) / mean(...)` | Low variance ⇒ AI. Human ≈ 0.6–1.2, AI ≈ 0.2–0.4; flag `< 0.4` | Low–Med |
| **Em-dash density** | `count('—' U+2014) / words × 1000` | Human ≈ 3.7–10/1k; flag `> 10` elevated, `> 20` strong | Low |
| **Transition-opener ratio** | fraction of paragraphs starting with Moreover/Furthermore/Additionally/Consequently/Notably/Ultimately/… | flag `> 0.5` | Med |
| **Bold-lead-in-list ratio** | `<li>` whose first child is `<strong>/<b>` + `:` ÷ total list items (DOM-level) | dominant pattern ⇒ AI | Low |
| **Rule-of-three density** | polished `X, Y, and Z` triplets per words | `> 1 per 200 words` | Med |
| **Unicode-typography co-occurrence** | curly quotes `“ ” ‘ ’`, ellipsis `…`, em-dash present together in otherwise-plain text | co-occurrence ⇒ "typeset" AI output | Med |
| **Lexical diversity (MATTR)** | moving-window (50–100 words) unique/total, averaged | low vs. length ⇒ AI | Med |
| **Paragraph-length uniformity (CV)** | `stdev(paraWordCounts)/mean(...)` | low ⇒ AI | Med |
| **Nominalization↑ / adverb↓** | `-tion/-ment/-ity/…` count vs `-ly` count, per words | high nominal + low adverb ⇒ AI | Med–High |
| **Expletive openers** | fraction of sentences starting "It is / There are / This is" | elevated ⇒ AI | Med–High |
| **Punctuation-variety poverty** | distinct punctuation types; semicolon/colon/paren rate per 1k | narrow set ⇒ AI | Med |

### The non-negotiable caveat

Every source is emphatic: **no single signal convicts.** Each has an innocent
explanation (formal registers, non-native English writers, careful editing, CMS
smart-quote filters). Detectors relying on these have flagged the U.S.
Constitution and the Bible as "AI". A responsible implementation must:

1. require a **minimum text size** (≈150+ words, ≈8+ sentences) before scoring;
2. require **convergence** — surface a verdict only when ≥3 independent signals
   co-fire — and present it as *signals detected*, not a definitive judgement;
3. show the **per-signal breakdown**, not just a single number;
4. never over-claim — frame it as "this text has N stylistic markers of AI
   writing", with the false-positive caveat visible.

### Suggested shape if built

- New `src/stats.js` — pure functions computing each signal from the flattened
  buffer (reuse `detect.flatten`) plus a couple DOM-level ones (bold-lead lists).
- Popup "Analysis" panel — overall score + per-signal bars + the caveat.
- Highlight-model alternative (smaller): promote a couple of signals into
  density-gated highlight detectors (e.g. only flag em-dashes/triads when the
  page-level rate exceeds threshold), no separate score UI.

### Highest value-to-cost order

1. Sentence-length burstiness (CV)
2. Em-dash density per 1k words
3. Transition-opener ratio
4. Bold-lead-in-list ratio (DOM)
5. Unicode-typography co-occurrence

### Key sources

- Kobak et al., *Excess vocabulary / "Delving into LLM-assisted writing"*,
  Science Advances 2025 (arXiv 2406.07016)
- Liang et al., *Monitoring AI-Modified Content at Scale*, ICML 2024 (arXiv 2403.07183)
- SlopDetector, "Signs of AI writing" (reproducible thresholds)
- *The Last Fingerprint* (arXiv 2603.27006) — em-dash / markdown-leakage
- *Linguistic Characteristics of AI-Generated Text* survey (arXiv 2510.05136)
- *Lightweight stylometric detection* (arXiv 2511.21744)

## Other deferred items

- **Dynamic content-script registration** — replace the static `<all_urls>`
  content script with `chrome.scripting.registerContentScripts` per allowlisted
  origin (privilege minimisation; smoother Web Store review). Not a vulnerability.
- **Real icons** — replace the placeholder solid-colour PNGs before any store
  submission.
- **Firefox build** — `browser.*` namespace + MV3 differences.
- **More phrase packs** — the research surfaced language-specific "translationese"
  slop packs (slop-gate) and larger fiction-slop dictionaries that could be added
  behind toggles if there's demand.
