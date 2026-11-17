# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

An offline, zero-cost web demo (Vite + React 19 + TypeScript + Tailwind v4, PWA) comparing three ways to add voice to US naturalization civics study, built for leadership review before a React Native port. Hard constraints: works offline after setup, **no cloud STT/TTS**, studio-recorded audio only.

The three modes map to routes in `src/App.tsx`: `/listen` (hands-free question → think gap → answer), `/speak` (record, reveal, self-grade), `/mock` (on-device speech recognition grades answers). `/setup` handles "Prepare for offline"; `/results` shows attempts/feedback.

## Commands

```bash
npm run dev                 # Vite dev server at http://localhost:5173 (add ?dev=1 for engine picker panel)
npm test                    # Vitest, runs src/**/*.test.ts (node env)
npx vitest run src/core/matcher.test.ts       # single test file
npx vitest run -t "some test name"            # single test by name
npm run lint                # oxlint src
npm run build               # tsc -b && vite build, then copies index.html -> 404.html (SPA fallback for Pages)
npm run build:pages         # build with GitHub Pages base path (/voice-practice-demo/)
npm run validate-content    # fail if any audio referenced in questions.json is missing under public/
```

Use Chrome 139+ for on-device Web Speech; Whisper is the cross-browser fallback.

## Architecture

- **`src/core/`** — pure, tested logic with no DOM dependencies.
  - `matcher.ts` grades a transcript against a `Question`'s `acceptedAnswers` using normalization (`normalize.ts`: articles, number words, etc.), Levenshtein similarity, and double-metaphone phonetic matching. Honors `answerMode` (`any` / `all` / `count` with `requiredCount`) and strict vs lenient thresholds from `config.ts`.
  - `session.ts` is a pure reducer (`reduceSession(state, event)`) driving the Mock Interview state machine (`IDLE → PLAYING_QUESTION → LISTENING → PROCESSING → RESULT → SUMMARY`). `MockInterview.tsx` calls it directly via `setState(reduceSession(...))`. Pass/fail uses `SIM_QUESTION_COUNT` / `SIM_PASS_PERCENT`.
- **`src/engines/`** — pluggable STT behind the `SpeechEngine` interface (`checkAvailability` / `prepare` / `listen` / `cancel`). Two implementations: `chromeOnDevice` (Chrome on-device Web Speech) and `whisperWeb` (Transformers.js Whisper in `whisper.worker.ts`, capture-then-transcribe with RMS energy gating to avoid hallucinations). `resolveDefaultEngine()` picks a user-preferred engine (localStorage) else Chrome if ready/downloadable else Whisper.
- **`src/audio/player.ts`** — `AudioPlayer` for studio clips with playback speed and preloading. In **dev only** (`import.meta.env.DEV`), missing audio falls back to `speechSynthesis` with a visible badge; this must never run in production.
- **Content** — `public/content/questions.json`, validated at load by zod (`src/content/schema.ts`). Each question `id` is also the audio filename stem: `public/audio/q/{id}.m4a` and `public/audio/a/{id}.m4a`. `public/content/audio-index.csv` records how raw studio WAV files mapped to ids (some source labels were swapped). `dynamic: true` questions (officeholders) show an "answer may change" badge and are excluded from Mock Interview unless `INCLUDE_DYNAMIC_IN_SIM`.
- **Config & persistence** — tunables (thresholds, think-gap, listen timeouts, Whisper model id) live in `src/config.ts`. Attempts, review events, feedback, offline-ready flag, and preferred engine are stored in localStorage via `src/lib/storage.ts` using `STORAGE_KEYS`.
- **Offline / PWA** — `vite.config.ts` configures `vite-plugin-pwa` (workbox precaches json/m4a/wav; runtime CacheFirst for `/audio/` and Hugging Face model downloads).

## Base path gotcha (GitHub Pages)

The app is deployed under `/<repo>/`. `vite.config.ts` derives `base` from `VITE_BASE` or `GITHUB_REPOSITORY`. Therefore:
- Always reference public assets through `assetUrl()` (`src/lib/assetUrl.ts`), never a hard-coded leading `/`.
- The router uses `basename` from `import.meta.env.BASE_URL`.

Pushing to `main` runs `.github/workflows/deploy-pages.yml` (npm ci → test → build → deploy). To preview the Pages build locally: `GITHUB_REPOSITORY=AlexWallaceAptly/voice-practice-demo npm run build && npx vite preview`.

## Open items

- `SIM_QUESTION_COUNT` / `SIM_PASS_PERCENT` in `src/config.ts` are unconfirmed demo placeholders (confirm real USCIS 2025 format).
- Optional `VITE_FEEDBACK_FORM_URL` (see `.env.example`) adds a "Submit your pick" link on Results.
