# Voice Practice Demo

Offline, zero-cost web demo of three ways to add voice to citizenship (naturalization civics) study:

1. **Listen** — hands-free question → think gap → answer
2. **Speak & Self-Check** — record, reveal, self-grade
3. **Mock Interview** — on-device speech recognition grades answers

Built so leadership can compare options before the React Native port. See the implementation spec for hard constraints (offline after setup, no cloud STT/TTS, studio audio only).

## Quick start

```bash
npm install
npm run dev
npm test
```

Open `http://localhost:5173`. Use Chrome 139+ for on-device Web Speech; Whisper is the cross-browser fallback. Add `?dev=1` for the engine picker.

## Content

- Questions: `public/content/questions.json`
- Audio: `public/audio/q/{id}.m4a` and `public/audio/a/{id}.m4a`
- Validate: `npm run validate-content` (fails until studio files are present)
- In **dev only**, missing audio falls back to `speechSynthesis` with a visible badge

## Scripts

| Script | Purpose |
|--------|---------|
| `npm run dev` | Vite dev server |
| `npm test` | Vitest unit tests (`src/core/`) |
| `npm run build` | Production build |
| `npm run validate-content` | Ensure every referenced audio file exists |
| `npm run preview` | Preview production build |

## Offline

Use **Prepare for offline** on first run to cache audio and prepare the speech engine. Then DevTools → Network → Offline and hard-reload to verify.

## Notes for Alex

- `SIM_QUESTION_COUNT` / `SIM_PASS_PERCENT` in `src/config.ts` are unconfirmed demo placeholders.
- Dynamic (officeholder) questions show an “answer may change” badge and are excluded from Mock Interview by default.
- Optional: set `VITE_FEEDBACK_FORM_URL` for a “Submit your pick” link on Results.
