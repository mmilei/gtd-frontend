![React](https://img.shields.io/badge/React-19-61dafb?logo=react)
![TypeScript](https://img.shields.io/badge/TypeScript-5-3178c6?logo=typescript)
![Vite](https://img.shields.io/badge/Vite-6-646cff?logo=vite)
![Tailwind](https://img.shields.io/badge/Tailwind-v4-38bdf8?logo=tailwindcss)
![Version](https://img.shields.io/badge/version-2.1.1-orange)

# gtd-frontend

> A GTD dashboard built around low-friction capture: type in natural language, let the LLM file it, focus on one task at a time.

Frontend for [java-gtd](https://github.com/mmilei/java-gtd). Type or dictate anything — *"call the dentist tomorrow"* — and the backend classifies it into the right GTD bucket, tags it, and estimates how long it takes. The UI keeps **Today** front and center and pushes everything else out of the way.

**[Live demo →](https://mmilei.github.io/gtd-frontend)** (mock mode, no backend needed)

---

## Features

- **Capture bar** — persistent natural-language input with voice dictation (Whisper transcription via the backend). Every operation the LLM performs comes back as a card in a collapsible feed; cards are clickable and destructive edits ask for confirmation with a before/after diff.
- **Today, first** — the day's list is the protagonist. Tasks auto-order, show time estimates, and project when you'll finish.
- **Focus mode** — single-task view with a timer and completion chime. One thing at a time.
- **Guided triage** — walk the backlog item by item with keyboard shortcuts (1–4: today / skip / someday / dismiss) and get a summary at the end.
- **Weekly review** — stale tasks, upcoming due dates, and the week's completions in one overlay.
- **Undo everywhere** — every mutation (from the UI or the chat) shows an undo toast backed by the API's durable, restart-safe event log.
- **History panel** — a durable, cross-session log of every create/move/done/dismiss/undo (who did it — you or the LLM — and when), separate from the current session's capture feed.
- **Tag bar** — one-click context filtering within the active bucket.
- **Multi-provider** — switch the backend LLM between Groq and local Ollama from the header.
- **Ambient scene** — a subtle Three.js ember field that bursts on completions (disabled under `prefers-reduced-motion`).

## Design

"Quiet ledger" identity: warm graphite surfaces, copper accent, data in monospace, Space Grotesk display type, Lucide icons. The guiding principle: the app carries the organizational load — ordering, estimating, structuring the review — so the user only has to decide and act.

## Stack

React 19 · TypeScript · Vite 6 · Tailwind CSS v4 · Three.js · Lucide

## Getting started

```bash
npm install
npm run dev        # → http://localhost:5173
```

With the [java-gtd](https://github.com/mmilei/java-gtd) backend on `localhost:8080`, Vite proxies `/api/*` — no CORS config needed.

**No backend?** Run against the in-memory mock (same data shapes, seeded tasks):

```bash
VITE_MOCK=true npm run dev
```

The [live demo](https://mmilei.github.io/gtd-frontend) is this mock build, deployed to GitHub Pages on every push to `master`.

Other scripts: `npm run build` (type-check + bundle) · `npm run typecheck` · `npm test` (Vitest + Testing Library) · `npm run preview`.

## Project structure

```
src/
  App.tsx              app state: buckets, feed, overlays, undo
  components/
    CaptureBar.tsx     natural-language + voice input
    OpsFeed.tsx        chat feed: op cards, confirmation diffs
    ItemList.tsx       bucket views
    EditModal.tsx      full task editor (bucket, due, estimate, tags, people)
    FocusOverlay.tsx   single-task focus mode with timer
    TriageOverlay.tsx  keyboard-driven backlog triage
    ReviewOverlay.tsx  weekly review
    HistoryPanel.tsx   durable cross-session event log
    AmbientScene.tsx   Three.js ember field
  lib/
    api.ts             typed HTTP client for java-gtd
    api.mock.ts        in-memory mock (aliased in when VITE_MOCK=true)
    types.ts           shared API types
  state/               capture + bucket hooks
```

---

Built by [Maximiliano Milei](https://linkedin.com/in/maximiliano-milei-48901894)
