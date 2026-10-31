# LOOPFRAME AI — V4 Creator Intelligence Studio

**Positioning:** Clip review that remembers your corrections and shows its receipts.

LOOPFRAME helps expert-led creators review a small set of transcript-grounded clip candidates, preserve context, save explicit editorial rules, and verify that future recommendations obey those rules.

---

## 1. How to Run the App

```bash
npm install
npm run dev      # Starts Express + Vite full-stack server on http://0.0.0.0:3000
npm test         # Runs deterministic unit tests (src/lib/loopframe.test.ts)
npm run build    # Builds production frontend bundle
```

---

## 2. Architecture & Persistence Choice

- **Frontend:** React 19 + TypeScript + Tailwind CSS v4 with a persistent multi-page shell (`Projects`, `Memory`, `Library`, plus `Welcome/Onboarding` and `Settings/Profile`) and HTML5 History API routing (`/projects`, `/projects/new`, `/projects/:projectId`, `/memory`, `/library`, `/settings`, `/welcome`).
- **Backend (`server.ts`):** Node/Express server hosting `/api/parse-transcript`, `/api/generate-candidates`, `/api/parse-feedback`, and `/api/regenerate-candidate` using `@google/genai` (`gemini-3.8-flash`) with structured JSON schema validation, 1-retry correction loop, and clearly labelled deterministic fallback (`DEMO FALLBACK`).
- **Persistence Adapter:** Isolated local storage adapter (`loopframe_v4_store_v1`) labelled honestly as a **Single-User Local Demo Store**. Persists projects, immutable transcript segments, candidates, creator feedback events, confirmed preference rules, approved library items, and audit events across browser refreshes.

---

## 3. Environment Variables

Defined in `.env.example`:
- `GEMINI_API_KEY`: Server-side key for `@google/genai` (`gemini-3.8-flash`). Never exposed to the browser. When not configured, the server automatically falls back to deterministic candidate generation and rule-aware rewriting explicitly labelled `DEMO FALLBACK`.
- `APP_URL`: Runtime service URL injected by AI Studio.

---

## 4. Three-Minute Demo Instructions

1. **Projects & Source Evidence:** From **Projects**, click **Open sample project** (`Ep. 42 — Building Mental Models for Complex Systems`). Inspect the 3 initial candidates, their verbatim transcript excerpts assembled from segment IDs (`seg-02`–`seg-05`, `seg-06`–`seg-07`, `seg-11`–`seg-13`), and the 7 deterministic checks vs. 4 AI-advisory checks.
2. **Context Expansion:** Select Candidate 2 (`Concept Mapping Before Reading Chapters`) to see the missing qualification warning for `seg-08` (*"However, that rapid mapping only works if you have already built the foundational vocabulary first..."*). Click **+ Append seg-08** in the centre pane to expand the clip boundary and re-run all checks.
3. **Creator Edit Intelligence Loop:** Select Candidate 1 (`Coarse Mental Models vs. Linear Highlighting`), which has an exaggerated hook (*"This 10x Secret Learning Hack..."*) and a pending rule proposal (`AVOID_EXAGGERATED_HOOKS`). Click **Confirm & Save Rule to Memory**, then click **Regenerate with Active Rules** to watch the regenerated hook pass the deterministic rule test. Click **Test Failure Case** to verify that a failing output is honestly reported as `DETERMINISTIC FAIL` with a matched phrase receipt.
4. **Memory & Prototype Evaluation:** Open **Memory** to edit, pause, or delete rules (with Undo toast support) and inspect the 24-case **Small Prototype Evaluation** dataset covering all 10 P0 rule types, negative controls, false positives, and false negatives.
5. **Library & Export:** Approve any candidate, open **Library**, and export the hook, caption, verbatim excerpt, and timecodes for Instagram Reels and YouTube Shorts.

---

## 5. What Is Genuinely Implemented vs. Simulated

### Genuinely Implemented
- Deterministic timestamped transcript parser with exact line-number validation for malformed or non-monotonic timestamps.
- Verbatim source excerpt assembly and timestamp/duration derivation in code from immutable segment IDs.
- 7 deterministic context integrity checks separated from 4 clearly-labelled AI advisory checks.
- Closed 10-rule P0 taxonomy (`AVOID_EXAGGERATED_HOOKS`, `AVOID_CLICKBAIT`, `PRESERVE_QUALIFICATIONS`, `PRESERVE_EDUCATIONAL_CONTEXT`, `AVOID_UNSUPPORTED_CLAIMS`, `PREFER_CONCISE_HOOKS`, `PREFER_CONVERSATIONAL_TONE`, `AVOID_JARGON`, `INCLUDE_CLEAR_TOPIC`, `CUSTOM_REVIEW_REQUIRED`).
- Deterministic post-generation rule verification engine (`Pass`, `Fail` with matched phrase, or `Advisory`) and 24-case evaluation suite.
- Server-side Gemini API integration (`gemini-3.8-flash`) with schema validation, retry, and labelled `DEMO FALLBACK`.

### Simulated / Known Limitations in P0
- Persistence uses a single-user local browser store adapter (`loopframe_v4_store_v1`) rather than multi-user cloud authentication.
- Heuristic lexicon and word-count checks are deterministic rules, not full natural-language entailment verifiers; semantic rules (`PRESERVE_EDUCATIONAL_CONTEXT`, `PREFER_CONVERSATIONAL_TONE`) are honestly marked `AI Advisory Only`.
- Video/audio file upload, speech-to-text transcription, video clip rendering, social auto-publishing, calendars, and performance analytics are out of scope for P0 and belong to the P1/P2 roadmap.
