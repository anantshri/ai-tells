# Detailed Changelog

The long-form companion to `CHANGELOG.md`. Where `CHANGELOG.md` says *what*
changed in one line, this file records *why* and *how* — enough for a future
reader to audit, reproduce, or roll back any change without re-deriving it.

Add a new entry (newest first) for every meaningful change. Use the template
below; drop sections that genuinely don't apply.

---

## 2026-11-20 — Dev toolchain upgrade (vitest 5, jsdom 31) + staccato ReDoS fix

**Summary:** User asked to upgrade undici and vite ("undic") and audit the
rest. Both turned out to be transitive devDependencies: `undici` 8.10.0 via
jsdom, `vite` 8.2.2 via vitest — and both carried open advisories (undici:
7, incl. GHSA-2m5v-pch6-74hx TLS validation bypass and GHSA-4w7w-5xrc-9h26
cache poisoning; vite 8.2.0–8.2.2: 3 high, incl. launch-editor command
injection). Fix: bump the direct deps that own them — vitest
4.1.11 → **5.1.1** (+ @vitest/coverage-v8 5.1.1) and jsdom 30.0.1 → **31.0.1** —
regenerating `package-lock.json` from scratch (`npm audit fix` alone failed
with an npm "edgesOut" internal error against the stale tree, and the pinned
majors would have kept the vulnerable vite anyway). Result: vite **8.3.8**,
undici **8.13.0**, esbuild unchanged at 0.28.2 (already latest), **`npm audit`
clean (0 vulnerabilities)**. Dev-only: the extension ships zero runtime deps.

**ReDoS regression caught by the first-ever in-container test run** (Node
v22.23.5 installed to /tmp from nodejs.org — the container has no Node):
running the suite after the upgrade showed `full pipeline over a large hostile
buffer is bounded` failing at 48s against its 3s budget. Profiling each of the
63 detectors on the exact hostile buffer (`'no what word, why did not and - '
× 6250`) pinned it on `staccato-fragments` — 48,076ms alone, everything else
≤359ms. Root cause: its sentence regex `[^.!?
]+[.!?]+` greedily matched the
entire 200KB terminator-free buffer, then backtracked char-by-char at every
position — O(n²), precisely the class of bug the repo already fixed in the
chain detectors by bounding quantifiers. Fix: bound the token to
`[^.!?
]{1,40}[.!?]+` (a ≤2-word fragment is ≤40 chars; longer runs yield no
token, and the finder's >3-char gap check still breaks runs across skipped
text, so semantics are unchanged). Re-profiled: **29ms**. Added a dedicated
adversarial entry for `staccato-fragments` to `security.test.js`.

**Test-count correction:** the detector-work commit's badge claimed 491 tests;
the true count there was 493 (a counting grep missed 2 double-quoted case
entries and under-derived the suite arithmetic). With the new security test
the suite is now **494 = 196 cases.js + 6 patterns engine tests + 245
new-signs + 9 security (4 explicit + 5 generated adversarial) + 9 detect +
6 meta + 23 stats**. Badge corrected.

**Commands / verification:**

- Node v22.23.5 (npm 10.9.9) installed from nodejs.org dist tarball into
  /tmp/opencode (arm64); PATH-prefixed per command.
- `npm outdated` → vitest/coverage 4.1.11→5.1.1, jsdom 30.0.1→31.0.1 major;
  esbuild current.
- `npm audit` (before): 6 vulnerabilities (3 moderate undici, 3 high vite).
- package.json majors bumped → `rm -rf node_modules package-lock.json` →
  `npm install` (77 packages) → `npm audit`: **0 vulnerabilities**.
- `npm test`: **494/494 pass** in 2.31s (was failing 1/493 at 49.8s pre-fix).
- `npx vitest run --coverage`: 95.8% lines on the logic modules; uncovered
  patterns.js lines are pre-existing window-merge/URL-helper branches.
- `npm run build`: dist/{chrome,firefox,safari} regenerated (dist/ is
  gitignored by design — not committed).
- `aidc-scan`: semgrep/gitleaks/vet/license-check clean.

**Notes:** `npm audit fix` was not used for the majors because it edits within
existing semver ranges (vite would stay 8.2.x under vitest 4's pin) and
errored on the stale tree; explicit major bumps + clean lockfile regeneration
is the reproducible path. No runtime dependencies exist, so the advisory
exposure was limited to the dev/build machine.

## 2026-11-20 — Five-source coverage audit: 5 new detectors, 8 extensions (58 → 63)

**Summary:** Asked to check the detector set against five external AI-ism
catalogues — Wikipedia's
[Signs of AI writing](https://en.wikipedia.org/wiki/Wikipedia:Signs_of_AI_writing),
[Oreate AI's AI-isms overview](https://discover.oreateai.com/discover/stop-writing-like-a-bot-by-eliminating-these-common-aiisms),
[ScriptGrain's counted AI-isms](https://scriptgrain.com/reference/ai-isms-in-marketing-copy),
[ContentBeta's overused-word list](https://www.contentbeta.com/blog/list-of-words-overused-by-ai/),
and [Hana LaRock's 10 ChatGPT-isms](https://www.hanalarockwriting.com/post/10-common-chatgpt-isms-what-to-watch-out-for-when-writing-content-with-ai-infographics).
The audit found ~75% coverage (details below), of which the prose-addressable
majority is now implemented: **five new detectors** (`transition-openers`,
`shapes-discussions`, `primary-source`, `literary-slop`, `staccato-fragments`)
and **eight regex extensions** to existing detectors. 58 → 63 detectors;
401 → 491 tests (89 new `new-signs.test.js` cases + 1 meta link test). No Node binary in the
container, so every new/extended regex was additionally verified by replaying
all 160 affected cases through a Python `re` harness that extracts the literals
verbatim from `patterns.js` (JS `\uXXXX` escapes decoded; `\b`/`\s`/`\d`
semantics identical), including a HEAD-vs-tree regression on the reference
EXAMPLE (zero drift on all 53 pre-existing `makeRegexFinder` detectors; the
five new detectors produce zero EXAMPLE hits, matching the `ADDED` set
invariant in `patterns.test.js`).

**Audit result (what was already covered vs. missing):**

- Wikipedia: strong. All language/grammar signs covered (ai-vocab, not-just,
  copulative-avoidance, participle-tail, vague-experts, despite-challenges,
  canned-notability, ai-leftovers…). Missing and now added: debate-shaping
  claims (§ "Claims that a topic has influenced discussions about related
  topics") and primary/tertiary-source identification (§ "Undue emphasis on
  identification by primary or tertiary sources"), plus placeholders and raw
  Markdown debris (§ "Phrasal templates and placeholder text", § "Markup
  irregularities"), and the trailing-offer/abrupt-cutoff family. The
  `ai-leftovers` read-more anchor `Internal_formatting_and_reference_markup_bugs`
  no longer exists in the live guide — retargeted to `Markup_irregularities`.
- ScriptGrain: phrase hits mostly covered; the *sentence shapes* were the gap
  (staccato/fragment cadence now caught; em-dash density, transition-opener
  ratio, uniform sentence length, rule-of-three and antithesis were already
  covered by `src/stats.js` at page-grade level; semicolon chains and
  no-contractions remain deferred — see FUTURE_WORK.md).
- ContentBeta: validated-study words covered via ai-vocab/promo/hype; the
  marketing tail (staccato fragments, "here's the deal", the hard truth,
  "not because X, but because Y", "Forget X. Think Y.", "Less X, more Y.")
  now added. Their bare-word tail (resonate, elevate, harness, supercharge,
  secret sauce…) is documented in FUTURE_WORK.md as a vocabulary extension,
  deliberately kept out of `ai-vocab` to preserve its frequency-study
  validation.
- HanaLaRock: weakest overlap. "bear in mind" and the uncertainty formulas
  added; passive voice, qualifier density, and balanced-tone are documented
  skips (too noisy for per-span highlighting).
- Oreate AI: "double-edged sword"/"strike a balance", bare "digital /
  competitive landscape", "since the dawn of time" added; "symphony",
  emoji-injection documented skips.

**What changed:**

- `extension/src/patterns.js`:
  - New `makeStaccatoFinder` factory (after `makeAnaphoraFinder`): runs of ≥3
    consecutive sentences of ≤2 words each; standalone abbreviation tokens
    ("Dr.", "Inc.") and letter-less tokens break runs; >3-char gaps break runs.
    The abbreviation regex requires `(?:^|\s)` before the word — the first draft
    matched word *suffixes* ("fa**st.**", "**no.**"), wrongly breaking runs; the
    two extra branch-coverage cases caught it.
  - Five new pattern entries appended after `ineffability` (three Rhetorical
    tics, two Wikipedia group — see CHANGELOG for the phrase families).
  - Eight regex extensions (note-that, scene-setting, landscape,
    heres-the-twist, hedge-stack, pseudo-wisdom, not-just, ai-leftovers), each
    description updated to name the new phrases.
  - One harness-caught fix during verification: `literary-slop` originally
    required "what could only be described as"; the natural form is "**that**
    could only be described as" — widened to `(?:what|that|which)`.
- `extension/src/meta.js` — `WIKI_ANCHORS` entries for `shapes-discussions` and
  `primary-source`; stale `ai-leftovers` anchor retargeted to
  `Markup_irregularities`; new `SCRIPTGRAIN_PATTERNS`/`CONTENTBETA_PATTERNS`
  link sets; header comment documents the two new sources.
- `extension/tests/new-signs.test.js` — 89 new cases (positive + negative for
  every added phrase family, including `arr[1]` vs `\[1\]` and
  "Would you like tea?" negatives guarding the markdown/offer additions, plus
  cases covering the finder's gap-break, letter-less-token, and
  person-initial branches, and precision guards added after fresh-eyes review:
  "Don't forget the intro", mid-sentence "; moreover,", "user[name]",
  "2 ** 3 ** 2", "example.com/tbd", "notes/dates" identification arms,
  "accepted the hard truth", "a broader debate", and "Yes. No. Maybe.").
- `extension/tests/meta.test.js` — one test asserting the new read-more links
  (ScriptGrain for `transition-openers`/`literary-slop`, ContentBeta for
  `staccato-fragments`, Wikipedia for the two new Wikipedia-group ids).
- `extension/tests/patterns.test.js` — the five new ids added to the `ADDED`
  set (not represented in the verbatim reference EXAMPLE).
- `README.md`, `extension/README.md` — 58 → 63 detectors; tests badge 401 → 491
  (decomposition: 196 cases.js + 6 patterns engine tests + 243 new-signs +
  8 security (4 explicit + 4 generated) + 9 detect + 6 meta + 23 stats);
  Credits section gains the five sources.
- `NOTICE` — attribution block for the four new catalogues.
- `extension/docs/FUTURE_WORK.md` — deferred signs recorded (see below).

**Deliberately skipped (documented, not built):** bare high-frequency words
(crucial/essential/notable/considerable — too common in human prose for
per-span flags), qualifier density, passive voice, balanced-tone, appositive
definitions, "the former… the latter", emoji injection, Wikipedia-only signs
(citations/DOIs, edit summaries, AfC).

**Fresh-eyes review fixes (2026-11-20, post-implementation):** an independent
review probed the new regexes and found four real + nine minor issues, all
fixed: `primary-source` dropped the temporal verbs ("records **date** from…",
"website **dates** from…") and the mundane "notes that" arm; the staccato
abbreviation guard now requires standalone words (`(?:^|\s)`) and includes
person initials, and "No." re-joined the fragment vocabulary (a ranking-list
"**No.** 5 ranked." shape can still false-positive — accepted, toggleable);
`transition-openers` boundaries tightened to sentence starts only (no more
"; moreover," mid-sentence hits) and its density claim moved to the page grade;
`shapes-discussions` widened its qualifier slot ("prompted **a broader** debate
about") and added plural "conversations"; `not-just`'s "Forget X. Think Y." arm
is now sentence-initial only ("Don't forget the intro; start with…" safe) and
the "Less X, more Y" tails stop at dashes; `ai-leftovers` markdown/placeholders
require word-initial brackets (`(?<=\s)`) and letters inside `**…**`, so
"user[name]", "2 ** 3 ** 2", and "example.com/tbd" no longer fire;
`heres-the-twist`'s "the hard truth" now requires "is/was" ("accepted the hard
truth" safe); the bare-"landscape" list dropped "modern" (art-history FP). The
staccato span now trims leading whitespace.

**Commands / verification:**

- Regex verification harness: `python3 /tmp/opencode/verify_patterns.py`
  (160/160 cases pass; EXAMPLE invariants hold).
- HEAD-vs-tree regression: `python3 /tmp/opencode/verify_example_regression.py`
  (53 pre-existing detectors, 0 drift; 4 new detectors, 0 EXAMPLE hits).
- `npm test` could not run in this container (no Node binary); CI must confirm
  the full suite. The Python replay replicates every case added today.

---

## 2026-09-11 — Topic-announcement + ineffability detectors ("The subject is measurement, and the obfuscated logic bypass that automation cannot finish")

**Summary:** A user offered a two-sentence sample as a classic AI tell and asked
why nothing fired. Traced the sentence through all 56 detectors: 0 matches,
because every tell in it is *structural* while the engine is lexical. Captured
the two prose-addressable halves as new detectors: `topic-announcement` and
`ineffability`. 56 → 58 detectors; 373 → 401 tests (the README badge said 366,
but decomposing the suite by hand — 196 `cases.js` + 6 engine invariants + 126
`new-signs` + 8 security + 9 detect + 5 meta + 23 stats — showed HEAD actually
held 373; the badge had gone stale and is corrected in this change).

**Why:** The sample —

> The subject is measurement, and the obfuscated logic bypass that automation
> cannot finish.

— contains four tells, and each slipped through a different way:

1. "assumes jadx, Smali, and Frida" — `colon-triple` hard-requires a literal
   colon; LLM prose drops the colon (near-miss, left as-is: colonless lists are
   too noisy to flag on their own).
2. "The subject is measurement" — third-person topic announcement; no detector
   owned the "the subject/story/takeaway/lesson (here) is…" family. → new
   `topic-announcement`.
3. "the obfuscated logic bypass that automation cannot finish" — the
   grandiose-negation flourish claiming the subject exceeds measurement; no
   detector owned "X that automation/no tool cannot/can…". → new `ineffability`.
4. Both sentences share a two-clause skeleton joined by ", and" with **zero
   lexical overlap** — `echo-triad` (shared 4-grams) and `sentence-anaphora`
   (3+ same openers, this/the skipped) are both blind to pure syntactic
   parallelism. Deliberately *not* regexed; this is the structural layer that
   `docs/FUTURE_WORK.md` reserves for the stylometric scorer.

The vocabulary is scrubbed — no ai-vocab, hype, or pseudo-wisdom hits — which is
exactly the "post-tell" register: clean words, formulaic shape.

**What changed:**

- `extension/src/patterns.js` — two new Rhetorical-tic (yellow) patterns,
  appended after `canned-notability`:
  - `topic-announcement` — `\bthe\s+(intensifier)?(subject|topic|theme|story|
    takeaway|lesson|upshot)\s+(here|there|really|actually)?\s*(is|was|becomes|
    boils down to|comes down to)` plus the colon form `\bthe\s+(noun)\s*[:?]`.
    Precision guards: optional intensifier list (real/actual/core/central/
    bigger/broader/larger/whole/only/simple) must sit between "the" and the
    noun, so "the subject **of this paper** is…" (ordinary academic
    boilerplate) can't match; "focus" is excluded entirely ("the focus is on"
    is standard release-note English); plurals ("the topics are") excluded.
  - `ineffability` — four bounded arms: (a) "that/which + no `<tool-noun>` +
    bare modal" ("a bypass that no benchmark can capture"), (b) "that/which +
    automation/static analysis/tooling/tests + **negated** modal" ("that
    automation cannot finish" — negation required so "tests that can run in
    parallel" stays clean), (c) "beyond the reach of / beyond what `<tool-noun>`"
    and "defies/eludes/resists + `<abstraction>`" ("defies easy
    categorization"), (d) "cannot be `<adverb>` `<capture-verb>`" ("cannot be
    fully automated" — the adverb is required so copyright notices ("cannot be
    reproduced") don't fire). All arms use bounded `{0,2}` adverb repetition —
    linear, no backtracking hazard.
- `extension/tests/new-signs.test.js` — +12 `topic-announcement` cases
  (7 positive / 5 negative) and +16 `ineffability` cases (11 positive /
  5 negative), including the user's verbatim sentence for both.
- `extension/tests/patterns.test.js` — added both ids to the `ADDED` set in the
  "example text trips every reference pattern exactly once" invariant (both are
  silent on the reference `EXAMPLE`; verified below).
- `README.md`, `extension/README.md` — 56 → 58 detectors, badge corrected to
  the hand-decomposed true count (373 → 401; the 366 it carried was stale).

**Commands:**

```
# No Node runtime in this container (verified: no node/npx/deno/bun binary), so
# the regexes were probed with a Python mirror of the final JS patterns before
# the edit — identical semantics for these patterns (no lookbehind, ASCII \b,
# bounded quantifiers):
python3 /tmp/opencode/probe.py
#   → 28/28 case expectations pass; EXAMPLE hits: topic=0 ineffability=0
#   → target spans: TOPIC 'The subject is', INEFF 'that automation cannot'
# (vitest must be re-run where Node exists: cd extension && npm test  # expect 401)
aidc-scan
```

**Verification:**

- Python probe: all 28 planned cases match expected counts (12 + 16), each half
  of the user's sentence produces its own highlight span, and both patterns are
  silent on the reference `EXAMPLE` (keeps the exactly-once invariant green).
- False-positive guards probed and locked in as negative cases: "tests that can
  run in parallel", "a file that tools can open", "he defies gravity",
  "beyond the reach of the original team", "cannot be reproduced without
  permission", "the subject of this paper is hashing", "the focus is on
  performance", "she changed the subject".
- `aidc-scan`: clean on changed files (see session log).

**Notes:**

- No NOTICE change: both detectors are original additions, not ported from
  Wikipedia / the reference tool / SlopDetector.
- `stats.js` page-grading signals untouched — the ineffability claim could
  later become a tenth *density* signal (per-1k rate) if it proves noisy as a
  phrase hit; kept phrase-level for now to match the user's ask.
- Remaining misses on the sample (colonless triple, ", and"-hinge syntactic
  parallelism) are documented as the standing case for the structural layer in
  `docs/FUTURE_WORK.md`.

---

## 2026-09-01 — Detector gaps found via a real sample (contracted reframe, ai-vocab hyphen guard, antithesis-density signal)

**Summary:** Investigated a GitHub issue
([momo5502/sogen#1315](https://github.com/momo5502/sogen/issues/1315)) a user
suspected was AI-written but the tool scored clean. Running both engine layers
over the verbatim body (543 words) confirmed the miss and pinpointed three
defects. Fixed two phrase-detector bugs and added a ninth page-grading signal.
366 → 375 tests. No behavioural regressions.

**Why:** The text is "competent slop" — it dodges the vocabulary clichés and
leans on *structural* tells instead. Diagnosis, corroborated by a friend's
independent run of the tool on `main` (`chatlog.txt` in the repo root):

1. `not-just` (patterns.js) matched "it's not X, it's Y" but not the contracted
   "it **isn't** X, it's Y" — the sample's backbone construction. A contraction
   technicality, not a design choice.
2. `ai-vocab` fired on "leverage" inside "the highest-**leverage** single
   change" — a hyphenated noun modifier, ordinary engineering English. `\b`
   treats a hyphen as a boundary, so the LLM-verb list matched inside compounds.
   This was the *only* phrase hit a default-settings user would have seen on the
   705-word sample, and it was a false positive.
3. No document-level detector for antithesis density — the reframe habit
   ("not X but Y", "it isn't X, it's Y", "X, not Y") that recurs ~1 per 90 words
   in the sample. `stats.js` had burstiness and rule-of-three but not this.

A **fourth** idea from the first-pass diagnosis — counting ASCII `--` as an
em-dash so `signalEmDash` fires — was **retracted**. The friend's run pointed
out that `--` (vs typographic `—`) is one of the strongest *human* signals:
LLMs emit `—`. Folding `--` into em-dash density would invert the signal's
meaning. Documented the reasoning in `docs/FUTURE_WORK.md` so it doesn't
resurface.

**What changed:**

- `extension/src/patterns.js`
  - `not-just` (id): extended the middle reframe alternative to accept a
    contracted copula — `(?:it|this|that)(?:(?:'s|\s+(?:is|was))\s+not|\s+(?:is|are|was|were)n't)\s+…`.
    Deliberately kept subject-restricted to it/this/that (so the phrase-level
    highlight stays tight); the subject-agnostic form is handled by the new
    stats signal instead.
  - `ai-vocab` (id): replaced the wrapping `\b…\b` with `(?<![\w-])…(?![\w-])`
    so a vocab word inside a hyphenated compound ("highest-leverage",
    "leverage-based") no longer matches. Standalone words and the list's own
    hyphenated entry "ever-evolving" still match.
- `extension/src/stats.js`
  - New `signalAntithesis` (key `antithesis`) + `ANTITHESIS_PATTERNS` /
    `countAntithesis`. Counts non-overlapping "not just X but Y", contracted and
    spelled-out "isn't/is not X, it's Y" reframes (subject-agnostic on the left),
    and "X, not <determiner> Y". Fires at ≥3 constructions **and** >5 per 1k
    words. "instead of" / "rather than" intentionally excluded — too common in
    ordinary prose to survive as a signal. Added to the `gradePage` signals
    array (now 9 signals; `tierOf` thresholds unchanged).

**Commands:**

```
# diagnosis
node scan.mjs        # phrase engine: 4 weak hits (one, ai-vocab "leverage", an FP)
node grade.mjs       # doc grader: 0/8 fired, tier Low
# after fixes
npx vitest run --coverage    # 375 passed; stats.js 100% lines, patterns.js changed lines covered
aidc-scan                    # semgrep + gitleaks clean; rest skipped (no matching files)
```

**Verification:**

- `not-just`: "It isn't perfection, it's coherence." → 1; "It isn't ready yet."
  → 0 (no reframe pivot); existing "It's not a bug — it's a feature." still 1.
- `ai-vocab`: "highest-leverage" / "leverage-based" → 0; "We leverage the
  platform to enhance results." → 2; "ever-evolving landscape" → 1 (unchanged).
- `antithesis`: fires on a 151-word negative-parallelism fixture (6 constructions,
  39.7/1k); silent on the human control; a lone "…a marathon, not a sprint."
  stays unfired (density floor). On the sogen sample it fires (3 constructions,
  5.5/1k) but the document stays **Low** (firedCount 1) — convergence correctly
  declines to convict, matching the manual read that the text leans human.

**Notes:**

- The engine reporting "clean" on this text is not evidence it's human — it means
  the text dodged the catalogued phrases. The manual read (and the friend's) put
  it at ~25% odds of meaningful AI involvement, i.e. probably human but mannered.
  These fixes improve what a *better* detector can see; they are not an accusation
  about this specific author.
- `chatlog.txt` (repo root, untracked) came from another environment on `main`;
  its detector counts (53/48) and line numbers predate this branch. Kept for
  reference, not treated as authoritative for `page-grade`.

---

## 2026-08-31 — SlopDetector-researched detectors (verb inflation, hedge stacking, pseudo-wisdom) + 5 detector extensions

**Summary:** Mined the pattern research behind
[AI-Writing-Rules](https://github.com/Abdulkader-Safi/AI-Writing-Rules) (an
MIT Claude Code plugin) for anything our engine lacked, and ported the genuine
gaps: three new detectors and added phrases across five existing ones. Pattern
research credited directly to its primary source — SlopDetector's
[12 measured patterns](https://slopdetector.org/blog/signs-of-ai-writing) —
with AI-Writing-Rules acknowledged as the curation we discovered it through.
53 → 56 detectors; 315 → 366 tests.

**Why:** Their 17 regex + 3 statistical rules overlap ours heavily (negative
parallelism, AI vocab, testament/role/landscape, vague attribution, outline
endings, participle tails, chat scaffolding, model artifacts, burstiness /
transition-stacking / rule-of-three — the latter three already in `stats.js`
with five more signals they lack). Diffed against our 53, three pattern
families had no coverage at all: Latinate verb swaps, stacked hedges, and
unfalsifiable wisdom sentences. Two of their noisy markdown rules (per-span
em-dash / curly-quote flagging) were deliberately NOT taken — they lint
Claude's own output where smart quotes are always a tell, but we judge live
web pages where CMSes auto-curl quotes and em-dashes are legitimate typography;
our doc-level `typography` cluster signal in `stats.js` is the right altitude.

**What changed:**
- `src/patterns.js` — three new detectors (Rhetorical tics group):
  - `verb-inflation` — Latinate swaps ("utilize", "facilitate", "commence",
    "ascertain", "endeavor") + connective padding ("in order to", "prior to",
    "subsequent to", "in the event that", "with regard to", "a number of",
    "the vast majority of"). Deliberately excludes "implement", "optimize",
    "terminate", "demonstrate" — literal vocabulary on technical pages, and
    over-matching them is the fastest way to make the extension feel noisy.
  - `hedge-stack` — "it could be argued that", "one could argue", "some might
    say", "may potentially", "can sometimes be", "to some extent", "generally
    speaking", "in certain contexts", "no one-size-fits-all". Common
    softeners ("tends to", bare "arguably") deliberately excluded — one hedge
    is honest writing; the tell is stacking.
  - `pseudo-wisdom` — "the key is to find the right balance", "true X comes
    from within", "context is everything", "the best approach is the one that
    works for you", "it comes down to your specific needs", "success comes
    down to…".
- `src/patterns.js` — extended detectors:
  - `scene-setting` += "in an era of", "in the digital age", sentence-initial
    "picture this" (anchored `(?:^|[.!?]\s+)` after a test caught "The picture
    this frame captures" as an FP), "imagine a world where", "it's no secret",
    "let's face it", "now more than ever", "as technology continues to".
  - `despite-challenges` += "moving forward", "as we look ahead", "challenges
    and (future) opportunities/prospects", "future outlook/prospects", "it's
    important to note".
  - `copulative-avoidance` += "represents a significant/key/pivotal…
    milestone/step/shift…", "marks a significant/key/pivotal…".
  - `journey-metaphor` += "set(s)/setting the stage", "underscores the
    importance of".
- `src/meta.js` — `SLOP_PATTERNS` set routes the read-more link for the three
  new detectors + `scene-setting` to the SlopDetector article (the page is
  client-rendered, no stable anchors — root URL, consistent with our
  anchor-drift fallback behaviour). `WIKI_ANCHORS` keeps precedence:
  `despite-challenges` stays deep-linked to Wikipedia's "Outline-like
  conclusions" section, which genuinely covers the added phrases.
- `NOTICE` / `README.md` — SlopDetector credited as the pattern-research
  source; AI-Writing-Rules noted as the curation vector. Detector counts
  53 → 56, test badge 287 → 365.
- Tests: `new-signs.test.js` +50 cases (positives, negatives, FP-guards incl.
  the deliberate-exclusion checks: "terminate()" and "demonstrated" must NOT
  trip verb-inflation); `patterns.test.js` ADDED-set updated for the three new
  ids; `meta.test.js` +1 SlopDetector-link case.

**How / commands run:**
```
npm test                    # 366 passed
npx vitest run --coverage   # patterns 86/91/85/90; meta 100/94/100/100
npm run build               # dist/{chrome,firefox,safari}
aidc-scan                   # semgrep + gitleaks clean
```

**Verification:** 366 tests passing, build OK across
all three targets, scan clean. FP guard verified live: "The picture this frame
captures is sharp." initially matched bare `picture\s+this` — caught by its
negative test case, fixed with the sentence-start anchor, regression-tested.
The deliberate-exclusion boundaries (terminate/demonstrate/optimize/
implement; tends to/arguably) are pinned by explicit 0-expectation cases.

**Notes:** Attribution chain decided with the user: credit SlopDetector and
Wikipedia directly (they're the primary researchers and our read-more links
target them); AI-Writing-Rules gets an honest mention in NOTICE as the
curation we found the research through, not as the pattern author. Their
"empty openers" / "vague attribution" extensions folded into existing
detectors rather than new ones to avoid duplicate firing on the same span.
Candidate NOT taken: per-span em-dash/curly-quote flags (too noisy for
arbitrary web pages, wrong altitude — handled at doc level in stats.js).

---

## 2026-08-29 — Document-level page grading + graded toolbar icon

**Summary:** Implemented the deferred document-level "AI-likelihood" scorer from
`extension/docs/FUTURE_WORK.md`. A scan now computes a model-free, O(n)
stylometric grade over the page's flattened text; the toolbar badge shows the
count of co-firing signals tinted by tier (green→red), and the popup gains an
Analysis panel with the per-signal breakdown and the false-positive caveat. The
badge, which last branch showed the raw phrase-match count, now shows the grade.

**Why:** The phrase highlighter is a per-span detector; well-edited AI prose can
trip zero phrase detectors yet still read as machine-made (the user's earlier
challenge paragraph did exactly that). A convergence-based document score is the
complementary modality the design doc scoped. User picked: badge = fired-signal
count + severity colour; scope = full (engine + icon + popup panel).

**What changed:**
- `src/stats.js` (new): pure engine.
  - Eight signals, each `{key,label,applicable,fired,value,display}`:
    sentence-length burstiness (CV < 0.4), paragraph-length uniformity (CV < 0.4,
    needs ≥4 paragraphs), em-dash density (> 10 per 1k words), transition-opener
    ratio (> 10% of sentences), expletive-opener ratio ("It is/There are/…",
    > 10%), rule-of-three density (≥2 triads and > 5 per 1k words), unicode
    typography cluster (curly quotes + ellipsis + em-dash all present), and a
    DOM bold-lead-in-list ratio (> 50% of ≥3 `<li>` led by `<strong>/<b>`).
  - `gradePage(buffer, doc?)` gates on `MIN_WORDS` (150) and `MIN_SENTENCES` (8),
    then returns `{eligible, words, sentences, signals[], applicableCount,
    firedCount, tier, tierLabel}`. `tierOf(n)`: 0–2 low, 3–4 some, 5–6 elevated,
    7+ high. `badgeForGrade(grade)` → `{text, color}` (fired count + tier colour)
    or `null` when the page is too short to grade.
- `src/content.js`: computes `gradePage(res.buffer, document)` at the end of
  `runScan()`, stores `state.lastGrade`, reports `{type:'pageGrade', badge}` to
  the worker (null on `deactivate()`), and returns the grade in the `scan`/`ping`
  message responses so the popup can render it.
- `src/background.js`: replaced the match-count path with a `pageGrade` handler
  that sets a **per-tab** badge text + background colour
  (`chrome.action.setBadgeBackgroundColor({tabId,color})`); still clears on
  `tabs.onUpdated` `loading`. `src/badge.js` (the old count formatter) and its
  test were removed.
- `src/popup.{html,css,js}`: new Analysis panel — coloured grade chip, tier +
  fired/applicable count, per-signal rows (fired = bold + red dot, n/a dimmed),
  and the caveat. Rendered from the `scan` response and from a `ping` on popup
  open (so an auto-scanned page shows its grade immediately).
- `tests/stats.test.js` (new, 22 cases): helpers, tier thresholds, eligibility
  gating (incl. non-string buffer), an AI fixture (converges ≥5 signals →
  elevated) vs a human fixture (eligible, 0 signals → green "0"), the DOM
  bold-list signal (fires / doesn't / n/a / no-lists), and display edge cases.
  `vitest.config.js`: swapped `badge.js` for `stats.js` in the coverage include.

**How / commands run:**
```
node /tmp/grade_probe*.mjs   # tuned AI/human fixtures against real thresholds
npm test -- --coverage       # 314 passed; stats.js 100% stmts/lines/funcs
npm run build                # dist/{chrome,firefox,safari}
aidc-scan                    # clean
```

**Verification:** stats.js at 100% statement/line/function coverage (remaining
uncovered branches are defensive divide-by-zero / type guards unreachable after
the eligibility check). Re-graded the user's challenge paragraph: 126 words →
**ineligible**, so the grader abstains — the intended behaviour for short text.
Confirmed both `content.js` and `background.js` bundles carry the `pageGrade`
path. Browser-integration behaviour (per-tab badge colour, popup panel) is
manual-verify per `docs/VERIFY.md` steps 2–3.

**Notes:** No new permissions. Thresholds are deliberately conservative and the
verdict is convergence-based (no single signal convicts), per the design doc's
non-negotiable caveat. Remaining `FUTURE_WORK` signals (MATTR lexical diversity,
nominalization/adverb ratio, punctuation-variety poverty) were left out to keep
the first cut high-precision; they can be added as further signals later.

---

## 2026-08-29 — Negative parallelism: catch the trailing "X, not Y" antithesis

**Summary:** Extended the `not-just` detector to catch the trailing antithesis
"X is A, not B" (e.g. "…is a hypothesis, not a control"), and renamed its
display label from "Not just X, but Y" to "Negative parallelisms" to reflect the
now-broader family. `id`, group, and Wikipedia anchor are unchanged.

**Why:** A user-supplied, near-certainly-AI paragraph tripped *zero* of the 53
detectors. Running the engine over it showed the strongest tell — the aphoristic
closing kicker "A rule that has not survived a bypass attempt is a hypothesis,
not a control." — was a negative parallelism our detector already owned but only
in the restatement-second ordering ("it's not X, it's Y"). The trailing
"…, not B" ordering slipped through on a word-order technicality. This is a
deliberate push to extend prose/phrase detection before building the planned
document-level statistical scorer (`docs/FUTURE_WORK.md`).

**What changed:**
- `src/patterns.js`: added a third alternation to the `not-just` find regex:
  `\b(?:is|are|was|were|be|been|being|['’]s|remains?|stays?|becomes?|became)\s+[^.!?\n,;:—–]{1,50}?,\s+not\s+(?:a|an|the)\s+[^.!?\n]{1,60}?(?=[.!?]|$)`.
  Precision guards, chosen from false-positive probing: requires a copula, a
  comma, and an **article** after "not" (so "here, not there" / "not great"
  don't fire), and anchors to sentence end via a zero-width lookahead (kept out
  of the highlight span). Name → "Negative parallelisms"; description expanded.
- `tests/cases.js`: 4 new true-positive cases (the paragraph's line, "marathon
  not a sprint", "feature not a bug", "a practice not a title") and 4
  false-positive guards (no-article, plain negation, no-copula imperative,
  mid-sentence "not great").

**How / commands run:**
```
node /tmp/probe2.mjs      # regex TP/FP probing before editing (5/5 TP, 7/7 FP clean)
npm test                  # 301 passed (was 293); EXAMPLE-trips-once invariant still holds
npm run build             # dist/{chrome,firefox,safari}
aidc-scan                 # clean
```

**Verification:** Re-ran the engine over the source paragraph: now 1 match
("is a hypothesis, not a control") where it previously found none. The
"example text trips every reference pattern exactly once" invariant test passed,
confirming the new arm doesn't double-fire on the reference EXAMPLE.

**Notes:** Deliberately conservative — the article requirement trades some
recall (misses "is red, not blue") for precision, since the real signal is the
*aphoristic* quality, which regex can't fully isolate from ordinary contrast.
Structural tells in the same paragraph (fake-precise "trivial ten percent",
uniform declarative cadence, "and so does an AI" symmetry) remain out of reach
for phrase matching and are the case for the statistical layer.

---

## 2026-08-29 — Toolbar match-count badge

**Summary:** After a page scan, the extension's toolbar action icon shows a
per-tab badge with the number of matches found. The badge clears when
highlights are cleared and when the tab navigates.

**Why:** The match count was only visible as transient text in the popup. A
persistent badge on the toolbar icon surfaces "this page looks AI-ish, and by
how much" at a glance — including on allowlisted sites that auto-scan without
the user ever opening the popup.

**What changed:**
- `src/badge.js` (new): pure `badgeText(count)` — returns `''` for zero /
  negative / non-finite input (hides the badge), floors fractional counts, and
  caps at `"999+"` so the text fits the toolbar badge. Isolated here so it is
  unit-testable without the `chrome.*` APIs.
- `src/background.js`: sets global badge colours (red bg `#DC2626`, white text
  where `setBadgeTextColor` exists); listens for `{type:'matchCount', count}`
  messages from the content script and renders them per-tab via
  `chrome.action.setBadgeText({tabId, text})` keyed on `sender.tab.id`; and
  clears a tab's badge on `chrome.tabs.onUpdated` `status === 'loading'` so a
  stale count can't linger across a navigation. Message sender is validated
  (`sender.id === chrome.runtime.id` and `sender.tab` present).
- `src/content.js`: `reportCount(count)` sends the count to the worker (wrapped
  in try/catch + `lastError` swallow for a torn-down extension context). Called
  with the match count at the end of `runScan()` and with `0` in `deactivate()`.
- `tests/badge.test.js` (new): covers `badgeText` — positive numbers, zero,
  negative/NaN/Infinity/string/undefined/null, numeric strings, fractional
  flooring, and the 999 cap.
- `vitest.config.js`: added `src/badge.js` to the coverage `include` list.
- Docs: `docs/VERIFY.md` new manual check for the badge (per-tab count, clear,
  navigation reset); `CHANGELOG.md` Unreleased/Added bullet.

**How / commands run:**
```
npm test -- --coverage   # 293 passed; badge.js 100% (statements 281/314 -> 286/319)
npm run build            # dist/{chrome,firefox,safari} rebuilt
aidc-scan                # security gate on changed files
```

**Verification:** Unit tests green with `badge.js` fully covered. The
chrome-glue layer (message passing, `chrome.action`, `tabs.onUpdated`) is
verified manually per `docs/VERIFY.md` step 2, matching the existing convention
that jsdom can't exercise the browser APIs.

**Notes:** No new manifest permissions — the action API is implicit in MV3 and
`tabs.onUpdated` needs only `tabId`/`status` (no host/`tabs` permission). Badge
text is per-tab, so each tab reflects its own last scan.

---

## 2026-08-29 — Renamed to "AI Tells" + new icon

**Summary:** Rebranded from "AI Cliché Highlighter" to **AI Tells** (repo/package
`ai-tells`) and replaced the placeholder icon with a real magnifying-glass-over-
"AI" mark.

**Why:** Chosen name. The old working name/slug (`chrome-ai-detector`) was
inaccurate — it's cross-browser and highlights *tells*, not a confident
"detector".

**What changed:**
- Identifiers: `manifest.json` name/default_title → "AI Tells"; `package.json` +
  `package-lock.json` name → `ai-tells`; `build.mjs` `GECKO_ID` →
  `ai-tells@users.noreply.github.com`; `content.js` CSS-highlight namespaces
  `aicliche-*` → `aitells-*`.
- User-facing: popup title/heading; `README.md` (title, icon image, tagline,
  "browser extension" wording); `extension/README.md` title; `NOTICE` header;
  `docs/BROWSERS.md` Safari app-name/bundle-id; CHANGELOG `[Unreleased]` product
  prefixes. Descriptions use the new tagline "helps you identify signs of
  probable AI usage".
- Icon: `extension/icons/generate.mjs` (dependency-free — SDF shapes + 4×
  supersample AA + a minimal PNG encoder) renders icon16/32/48/128.png; a magnifying
  glass (dark ring + handle) framing a bold "AI" with a highlighter swipe on a
  rounded highlighter-yellow tile. `extension/icons/icon.svg` is the vector master.

**How / commands run:**
```
sed / edits for identifiers + display names
node icons/generate.mjs     # regenerate PNGs
npm run build               # all three manifests now name "AI Tells"
npx vitest run              # 287 passed
aidc-scan                   # clean (incl. license-check on package.json change)
```

**Verification:** Built manifests confirmed `name: "AI Tells"` with correct
per-browser background + `ai-tells@…` gecko id; icon visually verified at 128/16.
Only the one historical DETAILED_CHANGELOG entry title keeps the old name (dated
record of when it was created). 287/287 tests; `aidc-scan` clean.

**Notes:** `.ai-container/project.env` (`AIDC_REPO_SLUG`, local `AIDC_WORKSPACE`
path) is container infra keyed to the local directory, left untouched. Placeholder
icon replaced — the new mark is ready, though a designer pass is welcome.

## 2026-08-29 — Cross-browser support (Chrome, Edge, Opera, Firefox, Safari)

**Summary:** The extension now targets all major engines. `build.mjs` emits a
package per browser under `dist/`.

**Why:** Requested — make it work on Chrome, Edge, Opera, Firefox, Safari.

**Research (authoritative, cited in the agent run):** The only cross-engine
divergence is the manifest `background` key — Chrome requires `service_worker`,
Firefox uses `background.scripts` (event page; no service worker), Safari's
service worker is buggy so it also uses `scripts`. Callback-style `chrome.*`
works on all five (native on Chromium, porting-aid on Firefox/Safari), so **no
code changes and no polyfill were needed**. Firefox requires
`browser_specific_settings.gecko.id` for `storage.sync`. CSS Custom Highlight API
floor: Chrome/Edge 105, Opera 91, Firefox 140, Safari 17.2 — the code already
feature-detects it and the caret APIs, so older versions no-op cleanly.

**What changed:**
- `extension/build.mjs` — rewritten to build per-target dirs `dist/{chrome,
  firefox,safari}`, applying a manifest transform per target (service_worker for
  Chromium; `scripts` + gecko id/`strict_min_version` 140 for Firefox; `scripts`
  only for Safari). esbuild target widened to chrome105/firefox140/safari17.
  Accepts an optional target arg (`node build.mjs firefox`).
- `extension/package.json` — `build:chrome` / `build:firefox` / `build:safari`
  scripts.
- `extension/docs/BROWSERS.md` (new) — compat table, min versions, per-browser
  load/build/package steps (incl. `xcrun safari-web-extension-converter`), and
  caveats. README/VERIFY paths updated (`dist` → `dist/chrome`); root README
  install section now per-browser; roadmap item checked off.

**How / commands run:**
```
npm run build     # -> dist/chrome, dist/firefox, dist/safari
npx vitest run    # 287 passed
aidc-scan         # clean
```

**Verification:** All three `manifest.json` files valid; the bundled
`content.js` is byte-identical across targets (md5 dedupe = 1 — only manifests
differ). Chrome=service_worker, Firefox=scripts+gecko(id, min 140),
Safari=scripts+no-gecko confirmed. 287/287 tests; `aidc-scan` clean.

**Notes / follow-ups:** Safari's final packaging needs macOS + Xcode (the
converter has no Linux path) — `dist/safari` is prepared and ready to convert.
Firefox can't apply `text-decoration` to custom highlights, so the underline is
dropped there; the yellow/blue background colours still distinguish the two
groups. Kept the `caretPositionFromPoint`→`caretRangeFromPoint` fallback so the
floor stays at the Highlight-API versions rather than Chrome 128 / Safari 26.2.

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
