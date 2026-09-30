# Tidal Loom

[Play in your browser](https://waytzhang.github.io/tidal-loom/). No installation or account is needed.

[Download the web-host build](https://github.com/waytzhang/tidal-loom/releases/tag/v0.1.0-web). The ZIP is for HTML5 hosting; opening it directly from disk has not been verified.

[Watch the short demo](https://waytzhang.github.io/tidal-loom/tidal-loom-demo.mp4). Actual desktop and IWER canvas footage, edited to 1:18.90, silent, with labeled simulator close-ups. It is not physical headset footage.

[Share feedback or report a bug](https://github.com/waytzhang/tidal-loom/issues/new) after playing. GitHub sign-in is required to post.

A small water-channel puzzle played on a floating tabletop. Turn the islands, follow the spring and connect every garden without leaving a spill. Three authored puzzles introduce branching paths, with growing flowers and optional synthesized chimes as feedback.

The same puzzle works with a mouse, labeled keyboard-accessible buttons or WebXR hands. In XR, pinch and twist a channel, then release; a short pinch makes a quarter turn. Undo, Reset, Next and Exit are on the board, so play does not depend on a controller or a browser-side menu.

## Run

Requires Node.js 24 (or a compatible version supported by IWSDK).

```sh
npm ci --ignore-scripts
npm run dev
```

Open the local URL printed by Vite. For browser-based hands testing, use **Try hand simulator**, then **Enter hand simulator**. This explicitly selects Meta's IWER emulator; ordinary browser play and headset use do not override native WebXR.

```sh
npm test
npm run build
```

The static build is in `docs/site`. It needs no application server, API key, cloud model, payment or login. Progress stays in browser site storage; no household or personal data is sent. Audio is synthesized in the application, disabled by default, and uses no licensed system voice.

## Implementation

- Official Immersive Web SDK `@iwsdk/core` 1.0.0-rc.2 and its hand/pointer/grab components.
- IWER and its developer UI 2.5.0, loaded only in explicit simulator mode.
- Procedural Three.js geometry, materials, flowers and application-owned canvas text.
- Pure cardinal-port puzzle logic; every garden must be connected and every wet open edge accounted for.
- Undo, restart, storage validation, refresh persistence and reduced-motion support.

## Verification and limits

The production build was separately browser tested. All three islands were solved at the public HTTPS address. IWER also verified the board's Undo and Next buttons with a hand ray and pinch. A production startup cycle caused by awaiting the SDK initializer at module scope was fixed by starting asynchronously after module evaluation.

Five logic checks verify the authored solutions, disconnected starting positions, blocked inlets, disconnected gardens, rotation and corrupt saves. Browser verification exercised a direct 3D click, Undo, all three complete islands, replay and refresh persistence. IWER entered an actual hand-mode XR session; moving, pinching, turning and releasing the emulated right hand changed the spring channel and the garden count. Exiting XR preserved the completed board and turn count. This is emulator evidence, not physical headset testing.

An optional `?capture=1` mode adds a **Record demo** button. It records only the rendered game canvas, without audio, camera, microphone or screen permission; stop and use **Download recorded demo** to keep the video locally. Combine it with `?simulate=1&capture=1` to capture simulator play. This is a development aid, not a physical-device performance benchmark.

Physical Meta device comfort, hand-tracking reliability and 60fps performance have not been verified. The original prototype began on September 29, 2026, with Codex assistance in implementation, checks and documentation. There is no claim of Meta affiliation, funding, contest registration, Start membership or prize winnings.

Original application code and procedural assets are MIT licensed. Dependencies retain their own licenses. See `docs/CONTEST.md` for the candidate competition and remaining entry requirements.
