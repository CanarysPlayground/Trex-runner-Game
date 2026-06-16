# T-Rex Runner — GitHub Copilot Agents Demo

> **Audience:** Developers, QA Engineers, Tech Leads &nbsp;|&nbsp; **Pre-requisites:** GitHub Copilot subscription, Node.js 18+, VS Code

---

## Overview

A browser-based **T-Rex Runner** canvas game with a Node.js high-score API and a Playwright test suite generated with GitHub Copilot agents.

| Component | Tech | URL |
|-----------|------|-----|
| Game UI | HTML + Vanilla JS (canvas) | `http://127.0.0.1:8080/ui/` |
| High-Score API | Node.js + Express | `http://localhost:3000` |
| Test specs | Playwright (JS + TS) | `tests/` |

---

## Project Structure

```
├── ui/
│   ├── index.html        # Game shell — HUD, difficulty selector, canvas
│   └── game.js           # Game loop, obstacles, power-ups, terrain, difficulty logic
├── api/
│   ├── server.js         # Express high-score API (in-memory)
│   └── package.json
├── tests/
│   ├── trex-e2e.spec.js        # Full end-to-end suite (11 categories)
│   ├── trex-jump.spec.js       # Jump mechanics and bird-unlock tests
│   ├── bird-obstacle.spec.ts   # Bird obstacle behaviour (TypeScript)
│   └── terrain-switch.spec.ts  # Terrain switching Desert ↔ Ice (TypeScript)
├── package.json
└── playwright.config.js
```

---

## Game Features

### Difficulty Selector
Three profiles selectable before the game starts (radio buttons in the HUD):

| Level | Obstacle Speed | Score Multiplier | Gap |
|-------|---------------|-----------------|-----|
| Easy | 4 | ×1 | wide |
| Medium | 6 | ×1 | default |
| Hard | 9 | ×2 | narrow |

> Changing difficulty mid-game resets the terrain back to Desert.

### Terrain Switching (Dynamic Desert ↔ Ice)
- Triggers **once per game** in **Easy mode** when `score >= 5`
- Desert → Ice: sky, ground, road, cloud, and stripe colours all switch to an icy palette
- `checkTerrainTrigger()` is exposed as a global for test control
- `terrainSwitchTriggered` flag prevents duplicate transitions; resets on game restart

| Terrain | Sky | Ground | Road |
|---------|-----|--------|------|
| Desert | Blue gradient | Sandy tan (`#c8a96e`) | Grey (`#7a7a7a`) |
| Ice | Pale-blue gradient | Icy white-blue (`#e8f4f8`) | Ice blue (`#a0c8d8`) |

### Bird Obstacle
- Spawns only when `score >= 5`
- Two heights: **low** (160 px — must jump) and **high** (82 px — timing challenge near jump apex)
- Spawn cooldown resets after each bird

### Power-ups (spawn when `score >= 5`)
| Power-up | Duration | Effect |
|----------|----------|--------|
| Shield | ~5 s (300 frames) | Absorbs one bird hit; grants dodge bonus |
| Score Boost | ~8 s (480 frames) | Multiplies score gain |
| Slow Motion | ~6 s (360 frames) | Reduces obstacle speed |

### Sound Effects
Web Audio API oscillator sounds for:
- **Jump** — sine wave sweep 280 Hz → 560 Hz
- **Collect** — power-up pickup tone
- **Game Over** — collision sound

### Visuals
- SVG sprites for dino and cactus (inline data URIs, no external assets)
- Animated background birds (decorative, 3 birds at varying heights and speeds)
- Animated road stripes that scroll with obstacle speed
- Animated clouds with per-terrain colour tinting

### HUD Elements
- `#highscore` — persisted via API between reloads
- `#status` — shows `Press Start to play` / `Running` / `Game Over`
- `#difficulty-display` — reflects active difficulty
- `#startBtn` — disabled while game is running

---

## API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/score` | Returns `{ highScore }` |
| `POST` | `/score/:value` | Updates high score if `:value` is greater |

---

## Prerequisites

- [VS Code](https://code.visualstudio.com/download) with [GitHub Copilot Chat](https://marketplace.visualstudio.com/items?itemName=GitHub.copilot-chat)
- [Node.js 18+](https://nodejs.org/) and npm
- [Git CLI](https://git-scm.com/install/)
- GitHub Copilot subscription (Individual, Business, or Enterprise)

---

## Getting Started

```bash
# 1. Clone the repo
git clone https://github.com/CanarysPlayground/Trex-runner-Game.git
cd Trex-runner-Game

# 2. Install root dependencies (Playwright)
npm install

# 3. Install API dependencies
cd api && npm install && cd ..

# 4. Start the API server (Terminal A)
node api/server.js          # → http://localhost:3000

# 5. Serve the game UI (Terminal B)
npm start                   # → http://127.0.0.1:8080/ui/
```

---

## Running Tests

```bash
# Run all specs
npm test

# Run a specific suite
npx playwright test tests/trex-e2e.spec.js --reporter=list
npx playwright test tests/bird-obstacle.spec.ts --reporter=list

# Open the HTML report after a run
npx playwright show-report
```

Set `TREX_GAME_URL` to override the default game URL:

```bash
TREX_GAME_URL=http://localhost:8080/ui/ npx playwright test
```

---

## Test Coverage

| Spec | Areas Covered |
|------|--------------|
| `trex-e2e.spec.js` | UI init, dino physics, cactus, difficulty profiles, bird obstacle, shield, score boost, slow motion, power-up interactions, game-over/restart, high-score API |
| `trex-jump.spec.js` | Jump mechanics, keyboard interaction, bird-unlock threshold |
| `bird-obstacle.spec.ts` | Bird spawn threshold, height variants, shield absorption, dodge bonus |
| `terrain-switch.spec.ts` | Terrain switch trigger (Easy + score ≥ 5), canvas pixel colour validation, restart resets terrain, difficulty change resets terrain, edge cases |

---

## Key Testing Techniques

- Accessibility-only locators — `getByLabel`, `getByRole` (no CSS/XPath)
- `page.evaluate()` — read/write `window.gameScore`, `score`, `birdActive` to control game state
- `page.on('pageerror')` — catch silent JS errors during gameplay
- `page.waitForRequest()` — intercept `POST /score/:value` on collision
- Canvas `boundingBox()` dimension assertions
- Difficulty-aware speed/multiplier validation

---

## Further Learning

| Resource | Link |
|----------|------|
| Playwright MCP — Getting Started | [playwright.dev/docs/getting-started-mcp](https://playwright.dev/docs/getting-started-mcp) |
| Playwright Documentation | [playwright.dev/docs/intro](https://playwright.dev/docs/intro) |
| GitHub Copilot Documentation | [docs.github.com/en/copilot](https://docs.github.com/en/copilot) |
| Integrate MCP with Copilot | [github.com/skills/integrate-mcp-with-copilot](https://github.com/skills/integrate-mcp-with-copilot) |
| E2E AI SDLC with GitHub Copilot | [CanarysAutomations/E2E-AI-SDLC](https://github.com/CanarysAutomations/E2E-AI-SDLC-Build-with-Github-Copilot) |
| Debugging and Automation with GHCP | [CanarysAutomations/Debugging-Automation](https://github.com/CanarysAutomations/Debugging-and-Automation-with-GHCP) |

---



