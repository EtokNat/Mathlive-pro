# MathLive Pro – Status & Implementation Plan

**Last updated:** 2026‑05‑30 (Sprint 0 fully complete, server live, client PWA verified)  
**Total estimated duration:** ~24 weeks from Sprint 0 start  
**Cadence:** 2‑week sprints (Sprint 0 took 1 week)  
**Philosophy:** Progressive enhancement, MVP‑first, continuous delivery; every sprint ends with a deployable, testable product.

---

## Sprint 0 – Project Scaffolding, PWA Shell & CI/CD ✅ COMPLETED

### What was built (detailed checklist)

- **Monorepo:** `pnpm` workspaces with `client/`, `server/`, and `packages/` directories; root scripts to run all services concurrently (`pnpm dev`).
- **Client (React + Vite + TypeScript):**
  - Vite project created with React‑TS template.
  - `vite-plugin-pwa` added with `registerType: 'autoUpdate'` and a valid manifest (name, short_name, theme_color, background_color, display, start_url).
  - Service worker registration via custom `registerSW()` function using `navigator.serviceWorker.register('/sw.js')` with robust error logging.
  - Custom `beforeinstallprompt` handling: banner appears when install prompt is available; users can click to install; persistent storage requested via `navigator.storage.persist()` and status shown on the UI.
  - **Icons:** Originally empty files caused manifest errors. Fixed by generating actual 192×192 and 512×512 solid indigo‑blue PNGs using a Node.js script, placed in `client/public/`, and referenced in manifest via standard file paths (`/icon-192.png`, `/icon-512.png`).
  - Logger utility (`createLogger(module)`) that prefixes module name and timestamp.
  - Test setup (`test-setup.ts`) with mocks for `window.matchMedia` and `navigator.storage` for jsdom compatibility.
  - App component test (`App.test.tsx`) verifying welcome message renders.
  - **Verified PWA installability:** The “Add to Home screen” option appears in Chrome on mobile; the custom banner triggers when `beforeinstallprompt` fires.
- **Server (Express + WebSocket + TypeScript):**
  - HTTP server with Express, CORS, JSON parsing.
  - Root route (`/`) returns friendly message; `/api/health` returns JSON status (used by Render health check).
  - WebSocket server (`ws`) attached to same HTTP server; on connection, echoes any JSON message back with error handling for malformed JSON.
  - Global Express error handler and structured logger.
  - Graceful SIGTERM shutdown for WS and HTTP.
  - **Deployment to Render** via `render.yaml` blueprint: service named `mathlive-server`, `rootDir: .`, build command installs all dependencies and compiles only the server; start command runs compiled JS; health check path set to `/api/health`; Node version pinned to 20.11.0.
  - Server is live at `https://mathlive-pro.onrender.com` and `curl` to `/api/health` returns 200 OK.
- **CI/CD:**
  - GitHub Actions workflow (`.github/workflows/ci.yml`) runs `pnpm lint`, `pnpm typecheck`, and `pnpm test` on every push to `main`.
  - Both Vercel (client) and Render (server) auto‑deploy on push to `main`.
- **Testing:**
  - Server test (`logger.test.ts`) validates logger output format.
  - Client test (`App.test.tsx`) renders welcome message.
  - All tests pass from root with `pnpm test`.

### Key decisions & fixes made during Sprint 0

- **Node.js version:** Noted that the environment uses Node v26.2.0, but Render will use 20.11.0 (pinned via env var). No issues observed during local dev.
- **pnpm approve‑builds:** Required for `esbuild` postinstall scripts; resolved by running `pnpm approve-builds` and selecting esbuild.
- **Filter syntax in root scripts:** Changed from `--filter client` to `--filter './client'` to avoid workspace name mismatches.
- **Client test failure:** `window.matchMedia` not implemented in jsdom → added mock in `test-setup.ts` to resolve.
- **Missing server test file:** Created `server/src/logger.test.ts` after initial test run failure.
- **PWA icons:** Generated correct PNG files and committed them; manifest now loads without errors.
- **Root route missing:** Added `app.get('/')` to prevent “cannot GET /” on Render; added `healthCheckPath` to `render.yaml` so Render dashboard shows green.

### User journey covered (Sprint 0)

- Teacher/student initial access: PWA shell loads instantly; service worker registration; persistent storage prompt; custom install banner; manual “Add to Home screen” available.
- Onboarding & first contact partially done (full onboarding with permissions will be completed in Sprint 2).

---

## Remaining Sprints – Detailed Plan

### Sprint 1 – Basic Collaborative Whiteboard (2 weeks)

**Goal:** Teacher and student draw together in real time on an infinite canvas.

#### Deliverables
- **Server:**
  - Room management: create room (generates unique code), join room, room state stored in memory with a `PubSub` abstraction (EventEmitter) for future Redis swap.
  - Message relay: strokes, viewport changes, room events forwarded to all other participants in the room.
  - Ping/pong heartbeat every 15s to detect stale connections.
- **Client:**
  - `useWebSocket` custom hook with full reconnection state machine:
    - States: CONNECTING, OPEN, RECONNECTING, CLOSED.
    - Exponential backoff (1s, 2s, 4s, … up to 30s) with jitter.
    - Automatic resume on browser `online` event and `visibilitychange`.
    - Heartbeat: expects server ping; if no pong within 30s, closes socket and reconnects.
    - User‑visible status banner (“Reconnecting…”, “Offline – changes saved locally”).
  - Infinite canvas component using HTML5 Canvas (or a lightweight library): captures pointer events in world coordinates, draws local ink immediately, sends compressed points (raw initially) via WebSocket.
  - Viewport sync: teacher’s pan gesture (two‑finger on touch, middle‑button drag on desktop) sends `VIEWPORT_SCROLL`; students apply transform matrix locally.
  - Minimal responsive layout: full‑screen canvas on both teacher and student views.
- **Integration:**
  - Client WebSocket URL configured via environment variable `VITE_WS_URL` pointing to Render server (e.g., `wss://mathlive-pro.onrender.com`).
  - End‑to‑end test: open two browser tabs, create a room, draw on one, verify strokes appear on the other.
- **Testing & error handling:**
  - Server room logic unit tests.
  - Canvas viewport matrix calculation tests.
  - WebSocket reconnect unit tests (mock timers).
  - Error logging for all WS failures and invalid messages.

#### User journey covered
- Teacher creates a room, gets room code, starts drawing; student joins via code, sees strokes in real time; panning syncs viewport.

---

### Sprint 2 – Real‑Time Audio (2 weeks)

**Goal:** Add live voice communication, completing the core live‑teaching loop.

#### Deliverables
- **Server:**
  - Mediasoup SFU process (or integration) for audio streaming; room‑based routing.
  - Audio signalling via existing WebSocket (join/leave audio room).
- **Client:**
  - Microphone capture with `getUserMedia` (echoCancellation, noiseSuppression, autoGainControl).
  - Splash screen with “Join Live Audio Class” button to satisfy autoplay policies (resume AudioContext).
  - Mute/unmute controls; raise‑hand button that sends signal to teacher; teacher can remotely unmute a student.
  - Participant roster with mute state display.
- **Testing & error handling:**
  - Simulate audio device unavailable → fallback to “listen only”.
  - Mediasoup worker crash recovery with logging.
  - WebRTC connection failure logging (ICE, DTLS state changes).

#### User journey covered
- Teacher’s voice broadcast; student muted by default; raise‑hand and remote unmute; audio and drawing combined in live session.

---

### Sprint 3 – Stroke Compression & Radial Menu (2 weeks)

**Goal:** Drawing becomes smooth and expressive; teacher gains full toolset.

#### Deliverables
- **Client:**
  - Adaptive Ramer‑Douglas‑Peucker compression every 16ms before sending strokes.
  - Multi‑touch filter: single finger draws, two fingers pan.
  - Radial menu: long‑press (touch) / right‑click (mouse) / Spacebar (keyboard) to open; slices for pen, highlighter, eraser, undo, redo, color sub‑menu (concentric arc). Menu stays open for multiple undos.
  - Stroke‑based undo/redo stack for each user.
- **Testing & error handling:**
  - Unit tests for RDP compression.
  - Touch event simulation for radial menu.
  - Decompression fallback to raw points if corrupted.

#### User journey covered
- Teacher uses full whiteboard tools; undo/redo; expressive drawing with colors and highlighter.

---

### Sprint 4 – Slide Deck & Responsive Layout (2 weeks)

**Goal:** Teacher prepares and presents slides; student gets an adaptive workspace.

#### Deliverables
- **Client:**
  - Left‑panel slide editor with visual markdown, live KaTeX rendering for math.
  - Image drag‑and‑drop upload: client‑side contrast equalization in a Web Worker, then upload via signed URL (server endpoint).
  - Slide switching: teacher clicks a slide → server broadcasts `SET_SLIDE`.
  - Overlay mode: slide becomes fixed background layer, annotations anchored to slide viewport.
  - Responsive layout: teacher 30/70 split; student floating card (draggable, minimizable, zoomable) with bottom toolbar.
- **Testing & error handling:**
  - LaTeX compilation errors shown in editor.
  - Image upload failure with retry and toast notification.
  - Signed URL generation failure returns 500 logged error.

#### User journey covered
- Full lesson prep and delivery with slides and overlay annotations.

---

### Sprint 5 – Offline Lecture Recording & Playback (2 weeks)

**Goal:** Lectures can be recorded locally and replayed with perfect sync, even offline.

#### Deliverables
- **Client:**
  - Offline recorder (Web Worker): captures strokes, tool changes, slide switches, viewport changes with `performance.now()` timestamps.
  - Audio recording via `MediaRecorder` (Opus); chunks saved alongside stroke log in IndexedDB.
  - Playback engine: loads archive, decodes Opus, uses `requestAnimationFrame` to replay strokes/slides in sync with audio. Controls: play, pause, seek, pinch‑zoom.
  - Storage management: quota estimation, old recording cleanup.
- **Testing & error handling:**
  - Storage quota exceeded → message to free space.
  - Playback desync detection and auto‑correction.
  - IndexedDB transaction errors logged and retried.

#### User journey covered
- Teacher records class; student watches recording offline with vector quality.

---

### Sprint 6 – Assignment Mode & On‑Device Handwriting Recognition (2 weeks)

**Goal:** Teacher pushes assignments; students solve on private canvas with digitized ink.

#### Deliverables
- **Server:**
  - `START_ASSIGNMENT` broadcast; problem slide as locked background.
- **Client:**
  - Private canvas mode: strokes stored locally, not broadcast.
  - On‑device token extraction: Gemini Nano (Chrome Prompt API) in a Web Worker processes strokes (or later paper image) into token stream; raw strokes never leave device.
  - Submission: token log + optional canvas replay sent to server.
- **Testing & error handling:**
  - Gemini Nano unavailable → fallback message; raw strokes submitted.
  - Private canvas state isolation tests.

#### User journey covered
- Assignment mode end‑to‑end; privacy‑preserving digitization.

---

### Sprint 7 – Paper‑to‑Canvas Scanning, Local Step‑Checking & Hints (2 weeks)

**Goal:** Paper solving becomes digital; AI hints guide students without revealing answers.

#### Deliverables
- **Client:**
  - “Snap Paper” button: PiP camera view with real‑time contour detection (OpenCV WASM), auto‑capture when stable.
  - Sauvola binarization in Web Worker → crisp black‑white image placed on canvas.
  - “Ask for Help” button with hint damping timer (15s first time, 5s if repeated).
  - Local WASM CAS (Giac) checks step equivalence; Gemini Flash‑Lite (cloud, only on hint request) generates micro‑hint displayed in chat bubble.
- **Testing & error handling:**
  - Camera unavailable → disabled button with explanation.
  - OpenCV/Sauvola failure → raw image fallback.
  - Hint generation failure → generic message.

#### User journey covered
- Student solves on paper, snaps photo, gets local AI hints.

---

### Sprint 8 – AI Grading & Basic Monitoring Dashboard (2 weeks)

**Goal:** Auto‑grade assignments; teacher sees live class status.

#### Deliverables
- **Server:**
  - Grading queue (Redis/in‑memory) with Gemini 2.5 Flash worker; produces draft score, feedback, confidence index.
- **Client (teacher):**
  - Review gate: list of submissions with replay, AI draft, approve/edit/reject. Draft never visible to student.
  - Monitoring dashboard: grid of student canvases updated every 3s, colored status rings (green=valid, yellow=idle, red=error, blue=help, grey=offline). Idle alerts.
- **Testing & error handling:**
  - Grading worker crash → retry with backoff.
  - Low confidence → forced manual review.
  - Dashboard throttle on WebSocket updates.

#### User journey covered
- Teacher monitors class progress; AI grading with teacher oversight.

---

### Sprint 9 – Advanced Monitoring & Interventions (2 weeks)

**Goal:** Privacy‑respecting, powerful class management tools.

#### Deliverables
- **Client (teacher):**
  - Anonymized Triage toggle (Student Alpha, Beta…).
  - Smart Triage Ranking: red→blue→yellow sorting.
  - Alert throttling: multiple red rings → banner with details on expansion.
  - Direct annotation on student canvas (teacher draws correction; student sees it).
  - Private voice chat: teacher can unmute one student for brief 1‑on‑1 call.
- **Testing & error handling:**
  - Annotation delivery retry.
  - Private chat setup failure → fallback to text.

#### User journey covered
- Deep pedagogical intervention tools without cognitive overload.

---

### Sprint 10 – Offline Live Session Resilience (2 weeks)

**Goal:** Uninterrupted work during network drops.

#### Deliverables
- **Client:**
  - Network monitor: online/offline events, banner when offline.
  - IndexedDB caching of new strokes and paper snapshots during offline.
  - Grey ring in teacher dashboard for offline student.
  - Staged reconnection sync: metadata → strokes → images.
  - Sync progress indicator; ring turns green on completion.
- **Testing & error handling:**
  - Simulated network drops with Chrome DevTools.
  - Conflict resolution (last‑write‑wins with timestamps).
  - Quota exceeded prompt to free space.

#### User journey covered
- Student works uninterrupted in dead zone; teacher sees offline status; seamless re‑sync.

---

### Sprint 11 – Premium AI & Monetization (3 weeks)

**Goal:** Premium teacher features and Stripe integration.

#### Deliverables
- Stripe Checkout / Customer Portal; server capability gates; UI reflects premium status.
- Adaptive question generation: Gemini 2.5 Pro with CAS verification; generated questions editable by teacher.
- Advanced Process Analysis for individual submissions.
- Premium expiry grace: read‑only access to generated content; clear upgrade prompts.
- Analytics dashboard for class trends.

#### User journey covered
- Pro teacher generates personalized exercises; deep insights; seamless subscription management.

---

### Sprint 12 – Accessibility Hardening, Performance, Security (2 weeks)

**Goal:** Production‑ready, inclusive, and secure app.

#### Deliverables
- ARIA‑live regions for AI text; math verbalization via Speech‑Rule‑Engine.
- High‑contrast theme, large cursor, keyboard navigation audit.
- Performance: bundle splitting, lazy loading, canvas optimizations.
- Load testing (k6/Artillery) for WebSocket and audio.
- Security audit: CSP headers, WS origin check, dependency scan.
- Final E2E tests with Playwright.

#### User journey covered
- Accessible, fast, and secure for all users.

---

## Error Handling & Testing Architecture (Established)

- Structured logger on both client and server with `[MODULE]` prefix.
- Every async operation wrapped in try/catch with logging.
- React error boundaries for major components.
- WebSocket message validation; malformed messages discarded with warning.
- Network/audio failures always produce user‑visible notifications and logs.
- All tests run in CI; E2E added from Sprint 1 onwards.

---

## Mapping to Complete User Journey

| User Journey Section | Sprint(s) |
|----------------------|-----------|
| 1. Onboarding & First Contact | Sprint 0 (✅), Sprint 2 |
| 2. Setting Up the Class – Slide Deck | Sprint 4 |
| 3. Live Teaching – Whiteboard & Audio | Sprint 1, 2, 3, 4 |
| 4. Transition to Assignment Mode | Sprint 6 |
| 5. Paper‑to‑Canvas & AI Hints | Sprint 6, 7 |
| 6. Teacher Monitoring Dashboard | Sprint 8, 9 |
| 7. AI Grading & Teacher Review | Sprint 8 |
| 8. Adaptive Question Generation | Sprint 11 |
| 9. Offline Resilience (Live Session) | Sprint 10 |
| 10. Lecture Recording & Playback | Sprint 5 |
| 11. Accessibility | Sprint 12 |
| 12. Account Management & Premium Controls | Sprint 11 |

No gaps. Every interaction described in the full user journey is explicitly assigned to a sprint.

---

## Current Deployment Status

- **Client:** Vercel auto‑deploy from `main`, URL: `https://mathlive-pro-client.vercel.app` (PWA installable, icons valid).
- **Server:** Render auto‑deploy from `main`, URL: `https://mathlive-pro.onrender.com` (health check green, WebSocket echo working).
- **CI:** GitHub Actions runs tests on push.

---

## Ready for Sprint 1

All prerequisites are in place. The next step is to implement the real‑time collaborative whiteboard as described. The `useWebSocket` hook and server room logic will be the first modules built.

**No further preparation needed.** Begin Sprint 1 when ready.
