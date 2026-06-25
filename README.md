# gtd-frontend

Frontend for [java-gtd](https://github.com/mmilei/java-gtd) — a GTD chat interface with an animated Three.js background.

Built with **Vite + Three.js + Tailwind CSS**.

## Stack

- [Vite](https://vitejs.dev/) — dev server + bundler
- [Three.js](https://threejs.org/) — animated particle network background
- [Tailwind CSS](https://tailwindcss.com/) — utility-first styling

## Prerequisites

- Node.js 18+
- [java-gtd](https://github.com/mmilei/java-gtd) running on `localhost:8080`

## Setup

```bash
npm install
npm run dev   # → http://localhost:5173
```

Vite proxies `/api/*` to `localhost:8080`, so no CORS config needed.

## Features

- **Chat** — type anything in natural language, the backend classifies it via Groq (Llama 3.3-70b) and files it in your Obsidian vault
- **Sidebar** — tabs for Today / Backlog / Waiting / Someday with live item counts
- **Mark done** — checkmark on any item calls `POST /api/items/{file}/done`
- **API status** — header indicator shows online/offline/connecting in real time
- **Three.js scene** — particle network pulses on each chat response

## API

Connects to [java-gtd](https://github.com/mmilei/java-gtd):

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/chat` | Classify and file a natural language message |
| GET | `/api/today` | Items scheduled for today |
| GET | `/api/buckets` | All open items grouped by bucket |
| GET | `/api/buckets/{bucket}` | Items in a specific bucket |
| POST | `/api/items/{filename}/done` | Mark an item as done |

## Project structure

```
src/
  main.js      — chat UI, message rendering, app init
  scene.js     — Three.js particle network
  api.js       — fetch wrappers
  buckets.js   — sidebar state and rendering
  style.css    — Tailwind + glassmorphism theme
```
