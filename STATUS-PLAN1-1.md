Below is the definitive `STATUS-PLAN.md` for **MathLive Pro** – fully updated to incorporate viewport lock/free modes (Sprint 3 & 4) and the live Classroom DVR feature (Sprint 5). It includes all granular detail, user‑journey explanations, current code architecture, and a clear roadmap for the remaining sprints. The document is designed so that another developer or LLM can seamlessly continue the project.

---

# MathLive Pro – Status & Implementation Plan

**Last updated:** 2026‑05‑30 after Sprint 1 core (real‑time whiteboard collaboration working, viewport and rewind features accepted)  
**Total estimated duration:** ~24 weeks from Sprint 0 start  
**Current phase:** Sprint 1 complete; whiteboard sync, room management, and reconnection logic functional.  
**Philosophy:** Progressive enhancement, MVP‑first, every sprint delivers a deployable, testable product that can be validated by real users.

---

## Project Structure (Monorepo)

```
mathlive-pro/
├── .github/workflows/ci.yml          # GitHub Actions CI
├── STATUS-PLAN.md                     # this file
├── render.yaml                        # Render Blueprint for server deployment
├── pnpm-workspace.yaml                # pnpm workspaces config
├── package.json                       # root scripts (dev, build, test, lint, typecheck)
├── packages/                          # future shared packages
├── server/                            # Express + WebSocket server
│   ├── package.json
│   ├── tsconfig.json
│   ├── vitest.config.ts
│   └── src/
│       ├── index.ts                   # HTTP + WS server, message routing, heartbeat, subscribeToRoom helper
│       ├── rooms.ts                   # Room manager (in‑memory pub/sub with EventEmitter)
│       ├── logger.ts                  # Structured logger
│       ├── logger.test.ts
│       └── rooms.test.ts
└── client/                            # React + Vite PWA
    ├── package.json
    ├── vite.config.ts                 # Vite + React + PWA plugin + Vitest config
    ├── tsconfig.json
    ├── index.html
    ├── public/
    │   ├── icon-192.png               # 192x192 solid indigo PNG (generated)
    │   └── icon-512.png               # 512x512 solid indigo PNG (generated)
    └── src/
        ├── main.tsx                   # Entry point, registers SW
        ├── App.tsx                    # Main component: room creation/joining, whiteboard
        ├── index.css                  # Global styles including reconnection banner
        ├── service-worker-registration.ts
        ├── test-setup.ts              # jsdom mocks (matchMedia, navigator.storage)
        ├── logger.ts                  # Client‑side structured logger
        ├── App.test.tsx
        ├── hooks/
        │   └── useWebSocket.ts        # Robust WebSocket hook with reconnection state machine
        └── components/
            ├── ReconnectionBanner.tsx # Connection status banner
            └── Whiteboard.tsx         # Infinite canvas (local + remote strokes)
```

---

## Technology Stack

- **Monorepo manager:** pnpm workspaces
- **Frontend:** React 18+ with TypeScript, Vite 8, VitePWA for PWA generation, Vitest for testing, React Testing Library.
- **Backend:** Node.js 20 LTS (Render pinned to 20.11.0), Express, `ws` (WebSocket), TypeScript.
- **Deployment:**  
  - Client → Vercel (auto‑deploy from `main` branch) – URL: `https://mathlive-pro-client.vercel.app`  
  - Server → Render (auto‑deploy from `main` via `render.yaml` blueprint) – URL: `https://mathlive-pro.onrender.com`
- **CI:** GitHub Actions runs lint (`tsc --noEmit`), typecheck, and Vitest tests on every push.

---

## Complete User Journey (End Goal)

### Onboarding & First Contact
**Teacher (Ms. Adebayo):**  
Opens `mathlive.pro` in Chrome on her laptop. The PWA service worker loads the app shell instantly (<200ms). A custom install prompt appears; she installs it as a standalone app. When she clicks “Create a Room”, the app requests microphone access and persistent storage. She sees a responsive layout with a slide‑building panel (left) and an infinite whiteboard canvas (right). A room code is displayed at the top.

**Student (Emeka):**  
Taps the room link on his mid‑range Android phone. The PWA shell loads instantly. A splash screen with “Join Live Audio Class” button ensures autoplay policies are met. He enters his display name and enters the room. His screen adapts: a floating, draggable card shows the current slide, and the main canvas fills the rest. A bottom toolbar provides quick access to tools and camera.

### Setting Up the Class – Slide Deck
**Teacher:**  
Creates slides with rich text, math expressions (live KaTeX), and images (auto‑optimised, uploaded via signed URL). Clicks “Go Live” on a slide; all students see it instantly.

**Student:**  
Sees the slide appear on his floating card. He can pinch‑zoom the card independently of the canvas.

### Live Teaching – Whiteboard & Audio
**Teacher:**  
Draws on the infinite canvas with a stylus. Strokes appear in real time on all student canvases. She uses a radial menu (long‑press on touch, right‑click on mouse) to switch tools, colours, undo/redo. Audio is broadcast with low latency (<120ms). Students are muted; a “raise hand” indicator lets her unmute one.

**Student:**  
Watches the teacher’s strokes appear smoothly. He can also draw locally (future: assignment mode). Audio is clear.

#### Viewport Control (LOCKED / SANDBOX)
**Teacher:**  
From her control panel, she can toggle between **Locked** and **Free Roam** modes.  
- In **Locked mode**, students cannot pan or zoom; their viewport follows the teacher’s exactly. When the teacher pans, all students’ screens move simultaneously.  
- In **Free Roam** mode, students can explore the whiteboard independently. The teacher can at any time press **Summon Class**, which instantly and smoothly animates all students’ viewports back to her exact position and zoom level. This gives the teacher authority without stifling student curiosity.

**Student:**  
- In Locked mode, his pan/zoom gestures are disabled; his viewport is slaved to the teacher’s.  
- In Free Roam, he can pan/zoom at will. If the teacher summons the class, his screen smoothly pans back to the teacher’s current view, and he can resume exploring after.

#### Classroom DVR (Live Rewind)
**Student:**  
If Emeka misses a point, he can tap a **“⏪ Rewind 30s”** button on his screen.  
- His canvas immediately jumps back 30 seconds and begins replaying the last 30 seconds of strokes (at normal speed), while the audio from the same time window is played from a local buffer.  
- A floating badge says **“🔴 Live is at 12:34 – Tap to catch up”**.  
- When he taps it, his audio jumps back to the live stream, and his canvas instantly snaps to the current live state.  
- This works entirely client‑side, using a rolling buffer of strokes and audio, imposing zero extra load on the server.

### Transition to Assignment Mode
**Teacher:**  
Clicks “Assign Practice”, selects the current slide, optionally enables AI hints, and sends to class. The server broadcasts a start‑assignment message.

**Student:**  
His canvas switches to a private, full‑screen mode. The problem slide is locked as a background. He can solve independently, with “Snap Paper” to digitise written work and AI‑powered hints.

### Monitoring Dashboard & Grading
**Teacher:**  
Sees a grid of live student canvases with coloured status rings (green = correct, yellow = idle, red = error, blue = help request). She can annotate directly on a student’s canvas, initiate a private voice chat, and review AI‑generated grades before releasing feedback.

### Premium Features
**Teacher (Pro):**  
Generates personalised practice questions based on class performance. Gets deep process analysis and long‑term analytics. Manages subscription via Stripe.

### Offline Resilience
**Student:**  
Continues working in a dead zone; strokes and snapshots are cached locally. Upon reconnection, data syncs seamlessly.

**Teacher:**  
Sees a grey ring for offline students and the last known state. No data is lost.

---

## Current User Journey (After Sprint 1)

### What a Teacher Can Do Now
- **Open the app** on any device (PWA, installable on home screen).  
- **Create a room** by clicking “Create Room” – a unique 6‑character code is shown.  
- **Draw on the canvas** with mouse/touch; strokes stay visible after lifting.  
- **Invite a student** to join via the room code.

### What a Student Can Do Now
- **Open the app** and click “Join Room”, enter the code.  
- **See the teacher’s drawings** in real time (as long as both are connected).  
- **Draw on his own canvas**, which also appears on the teacher’s screen instantly.  
- **Experience automatic reconnection** if the WebSocket drops, with a visible banner (“Reconnecting…”).

### Limitations (Missing Features)
- **No slide deck** – only a blank canvas.  
- **No audio** – collaboration is purely visual.  
- **No viewport sync** – the canvas does not pan or zoom; fixed window size.  
- **No stroke history** – a student who joins after the teacher has started drawing sees an empty canvas. Past strokes are not replayed (this will be added in Sprint 4).  
- **No tools** – only a single pen colour and size.  
- **No participant list** – you don’t see who else is in the room.  
- **No offline recording or live rewind** – not yet available.  
- **No assignment mode, AI, or grading** – those come later.

Despite these limitations, the core real‑time collaboration is solid, which is the true MVP of a live teaching platform.

---

## Completed Sprints (Detailed)

### Sprint 0 – Project Scaffolding, PWA Shell & CI/CD ✅ (completed)

**Goal:** Establish the project foundation, ensure installable PWA, and set up automated deployment.

**Deliverables:**
- Monorepo with `client/` and `server/` workspaces.
- Client: React + Vite + TypeScript, PWA manifest, service worker caching app shell, custom install prompt, persistent storage request.
- Server: Express with health endpoint, WebSocket echo server, structured logger, global error handler.
- Icons generated (192×192 and 512×512 indigo PNGs) and placed in `client/public/`.
- Testing: Vitest configured for both client and server; logger and room manager tests pass.
- CI: GitHub Actions runs lint, typecheck, tests on every push.
- Deployment: Vercel auto‑deploys client; Render auto‑deploys server via `render.yaml`.

**User journey covered:**  
App is installable and loads instantly. The foundation for offline resilience is laid.

---

### Sprint 1 – Basic Collaborative Whiteboard (Core Complete, further items deferred)

**Goal:** Enable real‑time drawing collaboration between teacher and students.

**What was built (completed):**
- **Server room management:** `rooms.ts` with in‑memory map of rooms (6‑char codes). Each room has a `Set` of participant connection IDs and an `EventEmitter` for pub/sub. Functions: `createRoom`, `joinRoom`, `leaveAllRooms`, `findRoomByConnection`, `resetRooms` (for test isolation).
- **Server message routing:** Handles `create-room`, `join-room`, `stroke`, `viewport`, `pong`. Heartbeat `ping` every 15s. The `subscribeToRoom` helper attaches event listeners for strokes, viewport changes, and participant joins **both** when a room is created and when a client joins, ensuring two‑way sync.
- **Client WebSocket hook (`useWebSocket`):**  
  - States: `CONNECTING`, `OPEN`, `RECONNECTING`, `CLOSED`.  
  - Exponential backoff (1s, 2s, 4s, … capped at 30s) with ±30% jitter.  
  - Automatically reconnects on browser `online` event and when the tab becomes visible.  
  - Returns `state` and `send` function.
- **Reconnection banner:** A fixed banner at the top displays connection status.
- **Whiteboard component (`Whiteboard.tsx`):**  
  - Uses HTML5 Canvas with `touch-action: none` to prevent scrolling.  
  - Maintains a local `completedStrokes` array and an `incomingStrokes` array.  
  - Draws all completed strokes (local + remote) and the in‑progress stroke on every render via `useEffect`.  
  - Sends completed strokes to server via `onStroke` callback.  
  - Drawing persists after lifting finger.
- **Basic UI in `App.tsx`:**  
  - “Create Room” / “Join Room” buttons with prompt.  
  - Displays room code when created.  
  - Hides buttons when joined, shows whiteboard.

**What is deferred (to later sprints):**
- Viewport synchronisation (pan/zoom) – needed for infinite canvas.
- Stroke compression (RDP) – currently sending raw points.
- Multi‑touch filtering (one‑finger draw, two‑finger pan).
- Stroke history (late joiner sees empty canvas).
- Participant list display.
- Undo/redo, tools, radial menu.

**User journey covered (after Sprint 1 core):**  
Teacher creates a room, draws, student joins and sees strokes in real time; both can draw and see each other’s work. Connection loss automatically recovers.

---

## Remaining Sprints (Detailed)

### Sprint 2 – Real‑Time Audio (2 weeks)
**User experience after completion:**  
Teacher speaks; students hear with low latency. Students are muted by default; raise‑hand to request unmute. A splash screen with “Join Live Audio Class” button enables autoplay. Basic participant roster with mute indicators.  
*Key deliverables:* Mediasoup SFU integration, microphone capture with echo cancellation, mute/unmute, raise‑hand signalling, audio state UI.

### Sprint 3 – Canvas Interaction Enhancement (2 weeks)  
*(Previously: “Stroke Compression & Radial Menu”; now expanded to include viewport engine.)*

**User experience after completion:**  
Drawing feels smoother and uses less bandwidth. Teacher can long‑press (touch) or right‑click (mouse) to open a radial menu with tools: pen, highlighter, eraser, shapes, undo/redo, and colour picker. Undo/redo removes entire strokes; the menu stays open for multiple operations. **The canvas now supports panning and zooming with world coordinates.** The teacher can lock student viewports or let them roam freely, with a “Summon” mechanism.

**Key deliverables:**
- **World coordinate system and viewport transforms:** Every stroke point is stored in an infinite virtual plane. Each client maintains a local viewport `{x, y, scale}`.
- **Multi‑touch gesture recognition:** One‑finger draw (already), two‑finger pinch‑to‑zoom and pan, gesture disable in locked mode.
- **Viewport modes (client side):** `LOCKED` (student viewport slaved to teacher’s) and `FREE` (student can pan/zoom). Teacher’s mode change broadcast via WebSocket.
- **`FORCE_SYNC` message:** Teacher can send this to smoothly animate all students’ viewports to her current view. Client implements easing animation via `requestAnimationFrame`.
- **Stroke compression:** Adaptive Ramer‑Douglas‑Peucker applied every 16ms.
- **Radial menu** with tools and colour sub‑menu.
- **Undo/redo stacks** per user.

### Sprint 4 – Slide Deck, Teacher Controls & Stroke History (2 weeks)  
*(Expanded with viewport control UI and late‑joiner catch‑up.)*

**User experience after completion:**  
Teacher can build slides with math (KaTeX) and images (auto‑optimised, uploaded via signed URL). Slides switch in real time. Overlay mode pins annotations to the slide. Students see a floating, draggable card for slides on mobile. **Late‑joining students see all past strokes** (history replay). Teacher has a dedicated control panel for viewport: Lock/Free toggle and “Summon Class” button.

**Key deliverables:**
- Slide editor with KaTeX live preview, image upload pipeline (Web Worker contrast equalisation, signed URL generation).
- Slide switching (`SET_SLIDE`) and overlay mode.
- Responsive layout: teacher 30/70 split, student floating card.
- **Stroke history (late‑joiner catch‑up):** Per‑room stroke log stored in memory; replay all past strokes to a new participant upon join, alongside current slide state.
- **Teacher control panel:** “Lock Viewport” / “Free Roam” toggle, “Summon Class” button (sends `FORCE_SYNC`), viewport status display.

### Sprint 5 – Lecture Recording, Playback & Live Rewind (2 weeks)  
*(Renamed and expanded with Classroom DVR feature.)*

**User experience after completion:**  
Teacher can record a lecture; strokes, slide changes, and audio are saved locally as a compact archive (~12 MB/h). Students can replay recorded lectures offline with vector‑based quality. **During a live class, students have a “Rewind 30s” button.** Tapping it replays the last 30 seconds of strokes and audio from a local buffer, while a badge shows they are behind live. They can tap “Catch Up” to instantly snap back to the live stream.

**Key deliverables:**
- Offline recorder (Web Worker) capturing strokes, tool changes, slide switches with timestamps.
- Audio recording via `MediaRecorder` (Opus) and storage in IndexedDB alongside stroke log.
- Playback engine that replays strokes/slides in sync with audio, with pause, seek, pinch‑zoom.
- **Live rewind system:**
  - `useStrokeBuffer` hook: accumulates incoming strokes for the last 60 seconds, pruning old data.
  - `useAudioBuffer` hook: captures remote audio stream using `MediaRecorder` with timeslice (or AudioWorklet) and maintains a rolling blob buffer.
  - `TimeShiftedPlayback` component: renders strokes from buffer filtered by a playhead offset, and plays delayed audio.
  - UI: “⏪ Rewind 30s” button and “🔴 Live is at … – Tap to catch up” badge.
  - Catch‑up mechanism: seamless switch back to live stream and full stroke history.

### Sprint 6 – Assignment Mode & On‑Device Handwriting Recognition (2 weeks)
**User experience after completion:**  
Teacher can push assignments; students get a private canvas with the problem as locked background. Handwritten math (drawn or captured from paper) is converted to math tokens on‑device via Gemini Nano. Raw data never leaves the device; only token stream sent to server.  
*Key deliverables:* `START_ASSIGNMENT` broadcast, private canvas mode, Gemini Nano integration in a Web Worker, assignment submission.

### Sprint 7 – Paper‑to‑Canvas Scanning, Local Step‑Checking & Hints (2 weeks)
**User experience after completion:**  
Student can snap a photo of paper work; the app automatically captures and binarises the image (Sauvola), placing it on the canvas. A “Ask for Help” button enforces a 15‑second thinking period before providing a micro‑hint generated locally via WASM CAS and Gemini Flash‑Lite.  
*Key deliverables:* Camera view with contour detection, auto‑capture, Sauvola binarisation, hint damping timer, step‑checking CAS, Flash‑Lite hint generation.

### Sprint 8 – AI Grading & Basic Monitoring Dashboard (2 weeks)
**User experience after completion:**  
Teacher sees a live grid of student canvases with coloured status rings (green/red/yellow/blue/grey) and idle alerts. Submitted assignments are auto‑graded by Gemini Flash; the teacher reviews and approves feedback before release.  
*Key deliverables:* Grading queue, AI draft with confidence score, review gate, monitoring dashboard with 3‑second updates.

### Sprint 9 – Advanced Monitoring & Interventions (2 weeks)
**User experience after completion:**  
Teacher can anonymise student names (Alpha, Beta), sort by urgency, and see throttled alerts. She can draw a correction directly on a student’s canvas and send it, or initiate a private 1‑on‑1 voice chat.  
*Key deliverables:* Anonymised triage, smart ranking, alert throttling, direct canvas annotation, private WebRTC voice chat.

### Sprint 10 – Offline Live Session Resilience (2 weeks)
**User experience after completion:**  
If a student’s network drops, a banner appears, and all new strokes/snapshots are cached locally. The teacher sees a grey ring. On reconnection, data syncs in stages (metadata first, then strokes, then images). Nothing is lost.  
*Key deliverables:* Offline detection, IndexedDB caching, grey ring status, staged re‑sync with priority.

### Sprint 11 – Premium AI & Monetization (3 weeks)
**User experience after completion:**  
Pro teacher can generate personalised practice questions (validated by CAS), view deep process analysis, and access class‑level analytics. Subscription managed via Stripe. Free tier remains fully functional.  
*Key deliverables:* Stripe integration, Gemini Pro adaptive generation, CAS verification, capability gates, premium analytics.

### Sprint 12 – Accessibility, Performance & Security Hardening (2 weeks)
**User experience after completion:**  
Screen readers read math aloud; high‑contrast mode available. App passes Lighthouse PWA/accessibility scores ≥95. WebSocket and audio are load‑tested. Security headers set.  
*Key deliverables:* ARIA‑live, Speech‑Rule‑Engine math verbalisation, high‑contrast theme, load testing (k6/Artillery), penetration test, final E2E tests with Playwright.

---

## Error Handling & Testing Architecture

- **Structured logger:** `[MODULE] <ISO timestamp> [LEVEL] message {data}` on both client and server.
- **Every async operation** wrapped in try/catch with logging before re‑throw or fallback.
- **Express global error handler** catches unhandled rejections.
- **React error boundaries** planned for major components (Canvas, Dashboard, etc.).
- **WebSocket message validation:** malformed JSON or unknown types result in `{ type: "error", error: "..." }` and are logged.
- **Reconnection:** Automatic, with visible banner.
- **Tests:** Vitest for unit/integration; React Testing Library for components; Playwright for E2E (added later).

---

## How to Continue Development

1. **Local development:** Run `pnpm dev` from the root. Both server (port 4000) and client (port 5173) start concurrently.
2. **Client WS URL:** Defined in `client/.env.development` as `VITE_WS_URL=ws://localhost:4000`. Production fallback is `wss://mathlive-pro.onrender.com`.
3. **Server rooms:** All room logic is in `server/src/rooms.ts`. The server entry `server/src/index.ts` uses `subscribeToRoom` to attach listeners for both `create-room` and `join-room`. Strokes are relayed only to participants other than the sender.
4. **Whiteboard:** `client/src/components/Whiteboard.tsx` holds `completedStrokes` (local) and receives `incomingStrokes` (remote) via props. It redraws everything on change.
5. **Reconnection:** `useWebSocket` hook provides `state` and `send`. The hook’s file is `client/src/hooks/useWebSocket.ts`.
6. **Testing:** `pnpm test` runs all tests. Server tests use Vitest with Node environment; client tests use jsdom with mocks from `test-setup.ts`.

---

## Key Code Patterns

- **Room IDs:** 6‑character uppercase string, generated randomly (excluding easily confused characters).
- **Connection IDs:** Sequential `conn_1`, `conn_2`, … mapped to WebSocket instances.
- **Heartbeat:** Server sends `{ "type": "ping" }` every 15 seconds; client responds with `{ "type": "pong" }`.
- **Stroke messages:** `{ "type": "stroke", "points": [...], "color": "#...", "lineWidth": number }`.
- **EventEmitter per room:** Enables lightweight pub/sub; easily swappable to Redis later.

---

## Deployment Details

- **Render:** Free web service; spins down after 15 min inactivity. Health check at `/api/health`. Auto‑deploys on push to `main`.
- **Vercel:** Static site (client) with Vite build. Auto‑deploys on push to `main`. PWA manifest and service worker generated by VitePWA.
- **GitHub CI:** Workflow file `.github/workflows/ci.yml` runs `pnpm lint`, `pnpm typecheck`, `pnpm test`.

---

**This document is the single source of truth for MathLive Pro. It captures the complete user journey, the current working state, and the precise roadmap ahead. Any developer or LLM can pick up from here and continue building with complete context.**
