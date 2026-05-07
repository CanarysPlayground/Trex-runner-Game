# T-Rex Runner — Testing with GitHub Copilot Agents

> **Audience:** Developers, QA Engineers, Tech Leads &nbsp;|&nbsp; **Pre-requisites:** GitHub Copilot subscription, Node.js 18+, VS Code

---

## Overview

A browser-based **T-Rex Runner** canvas game with a Node.js high-score API, used as a playground for writing automated Playwright tests with GitHub Copilot agents.

| Component | Tech | URL |
|-----------|------|-----|
| Game UI | HTML5 Canvas + Vanilla JS | `http://127.0.0.1:8080` |
| High-Score API | Node.js + Express | `http://localhost:3000` |
| Test results | Playwright (Chromium) | `test-results/` |

---

## Repository Structure

```
├── ui/
│   ├── index.html        # Game shell — HUD, difficulty selector, Start button
│   └── game.js           # Game engine — physics, rendering, scoring, difficulty
├── api/
│   ├── server.js         # Express high-score API
│   └── package.json
├── tests/                # Playwright test specs (add specs here)
├── test-results/         # Last Playwright run output (Chromium)
└── package.json          # Root — Playwright dev dependency, http-server start script
```

---

## Prerequisites

- [VS Code](https://code.visualstudio.com/download) with the [GitHub Copilot Chat extension](https://marketplace.visualstudio.com/items?itemName=GitHub.copilot-chat)
- [Node.js 18+](https://nodejs.org/) and npm
- [Git CLI](https://git-scm.com/install/)
- GitHub Copilot subscription (Individual, Business, or Enterprise)

---

## Game Features

### Difficulty Selector

Three difficulty modes selectable before each game via radio buttons. The selector is disabled during play and re-enabled on game over.

| Mode | Obstacle Speed | Gap Range | Score Multiplier | Cloud/Bird Speed |
|------|---------------|-----------|-----------------|-----------------|
| Easy | 4 px/frame | 250–450 px | ×1 | ×0.6 |
| Medium _(default)_ | 6 px/frame | 0–200 px | ×1 | ×1.0 |
| Hard | 9 px/frame | 0–100 px | ×2 | ×1.4 |

`window.selectedDifficulty` exposes the active mode for test access.

### Game States

| State | Description |
|-------|-------------|
| `idle` | Animated preview loop — clouds and birds drift, dino stands |
| `running` | Active gameplay — physics, obstacle, score, collision active |
| `over` | Frozen scene, score POSTed to API, selector re-enabled |

### Controls

- **Space / any key** — jump (only while `running` and dino is grounded)
- **Start button** (`aria-label="start-button"`) — starts or restarts the game

### Scoring

- Score increments each time the obstacle passes the dino, weighted by `scoreMultiplier`.
- `window.gameScore` is kept in sync with the canvas score each frame — readable by Playwright via `page.evaluate(() => window.gameScore)`.
- On game over the score is POSTed to `http://localhost:3000/score/:value`; the HUD high-score updates from the API response.

### Collision Detection

AABB check between the dino sprite (x: 40–84, y: `dinoY`–28) and the cactus. Triggers `gameOver()` on overlap.

### Visual Scene

- Animated sky gradient, scrolling road with dashed centre stripes
- Drifting clouds (4) and flapping birds (3) — speed scaled by difficulty
- Dino and cactus rendered as inline SVG sprites

---

## High-Score API (`api/server.js`)

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/score` | Returns `{ highScore }` |
| POST | `/score/:value` | Updates high score if `:value` is greater; returns `{ highScore }` |

- In-memory store (resets on server restart).
- CORS enabled for all origins.
- Exports `app` and `reset()` for unit testing.

---

## Getting Started

```bash
# 1. Clone and open in VS Code
git clone https://github.com/CanarysPlayground/Trex-runner-Game.git
cd Trex-runner-Game

# 2. Install API dependencies
cd api && npm install

# 3. Start the API server (Terminal A)
node server.js          # API running at http://localhost:3000

# 4. Serve the game UI (Terminal B)
cd ..
npm start               # UI at http://127.0.0.1:8080
```

---

## Running Playwright Tests

```bash
# Install Playwright (first time)
npx playwright install --with-deps chromium

# Run all specs in the tests/ folder
npx playwright test --reporter=list

# View the HTML report
npx playwright show-report test-results/html-report
```

### Test Coverage (current `test-results/`)

| Test | Status |
|------|--------|
| Jump Interaction — sets status to `running` state | Chromium |
| Score Progression — increments during sustained gameplay | Chromium |
| Score Progression — monotonically non-decreasing | Chromium |
| Score Progression — resets to 0 after Restart | Chromium |
| Shield Powerup — picks up and activates protection | Chromium |
| Shield State — manages properly between games | Chromium |

---

## Key Global Variables (accessible in Playwright via `page.evaluate`)

| Variable | Type | Description |
|----------|------|-------------|
| `window.gameScore` | `number` | Current in-game score, updated every frame |
| `window.selectedDifficulty` | `string` | Active difficulty: `'easy'` \| `'medium'` \| `'hard'` |

---

## Further Learning

| Resource | Link |
|----------|------|
| Playwright MCP — Getting Started | [playwright.dev/docs/getting-started-mcp](https://playwright.dev/docs/getting-started-mcp) |
| GitHub Copilot Chat Docs | [docs.github.com/en/copilot](https://docs.github.com/en/copilot) |
| Playwright Documentation | [playwright.dev/docs/intro](https://playwright.dev/docs/intro) |
| GitHub Copilot Documentation | [docs.github.com/en/copilot](https://docs.github.com/en/copilot) |
| Integrate MCP with Copilot | [github.com/skills/integrate-mcp-with-copilot](https://github.com/skills/integrate-mcp-with-copilot) |
| E2E AI SDLC with GitHub Copilot | [CanarysAutomations/E2E-AI-SDLC](https://github.com/CanarysAutomations/E2E-AI-SDLC-Build-with-Github-Copilot) |
| Debugging and Automation with GHCP | [CanarysAutomations/Debugging-Automation](https://github.com/CanarysAutomations/Debugging-and-Automation-with-GHCP) |

---



