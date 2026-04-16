# Testing with GitHub Copilot Agents

> **Audience:** Developers, QA Engineers, Tech Leads &nbsp;|&nbsp; **Duration:** ~90 min &nbsp;|&nbsp; **Pre-requisites:** GitHub Copilot subscription, Node.js 18+, VS Code

---

## What You Will Build

An automated Playwright test suite for the **T-Rex Runner** — a browser-based canvas game with a Node.js high-score API — written entirely by GitHub Copilot agents. You write the prompts; Copilot writes the tests.

| Component | Tech | URL |
|-----------|------|-----|
| Game UI | HTML + Vanilla JS canvas | `http://127.0.0.1:8080` |
| High-Score API | Node.js + Express | `http://localhost:3000` |
| Test specs | Playwright TypeScript | `trex-runner/tests/` |


---

## Prerequisites

- [VS Code](https://code.visualstudio.com/download) with the [GitHub Copilot Chat extension](https://marketplace.visualstudio.com/items?itemName=GitHub.copilot-chat)
- [Node.js 18+](https://nodejs.org/) and npm
- [Git CLI](https://git-scm.com/install/)
- GitHub Copilot subscription (Individual, Business, or Enterprise)
- Playwright MCP server — configured in `.vscode/mcp.json` during [Exercise 05](workshop-automation/exercise-05-game-launch.md)


---


---

## Key Features Covered

### GitHub Copilot Features

| Feature | Exercise |
|---------|----------|
| Copilot Chat — Ask Mode: scaffold `playwright.config.ts` from a single prompt | [Ex 03](workshop-automation/exercise-03-initialize-playwright.md) |
| Custom Agents (`.agent.md`): scoped role, tools, and system prompt per agent | [Ex 04](workshop-automation/exercise-04-create-agents.md) |
| Shared Skill File (`SKILL.md`): centralised locators and patterns reused by all agents | [Ex 04](workshop-automation/exercise-04-create-agents.md) |
| Copilot Chat — Agent Mode: natural language prompt → full test file generated | [Ex 04–10](workshop-automation/exercise-04-create-agents.md) |
| Playwright MCP Server: agent controls a real browser via accessibility tree | [Ex 05–10](workshop-automation/exercise-05-game-launch.md) |
| VS Code Browser Tab Sharing: Quick Open Browser Tab → share active tab with agents | [Ex 05–10](workshop-automation/exercise-05-game-launch.md) |

### Testing Techniques

| Technique | Exercise |
|-----------|----------|
| Accessibility-only locators — `getByLabel`, `getByRole`, `getByText`; no CSS or XPath | [Ex 05–10](workshop-automation/exercise-05-game-launch.md) |
| Canvas visibility + `boundingBox()` dimension assertion | [Ex 05](workshop-automation/exercise-05-game-launch.md) |
| `page.on('pageerror')` — capture silent JS errors during gameplay | [Ex 05, 07, 09](workshop-automation/exercise-07-continuous-gameplay.md) |
| `page.press('Space')` — keyboard interaction and page stability check | [Ex 06](workshop-automation/exercise-06-keyboard-interaction.md) |
| `page.evaluate(() => window.gameScore)` — read game state not exposed in the DOM | [Ex 06–10](workshop-automation/exercise-06-keyboard-interaction.md) |
| `disableCollision()` — runtime `page.evaluate()` override, zero source changes | [Ex 06, 07, 09](workshop-automation/exercise-06-keyboard-interaction.md) |
| URL stability check — detect silent reload loops | [Ex 06, 07, 09](workshop-automation/exercise-07-continuous-gameplay.md) |
| 4-second continuous gameplay monitoring — errors, frozen score, URL drift | [Ex 07](workshop-automation/exercise-07-continuous-gameplay.md) |
| `page.waitForRequest()` — intercept natural collision POST to `/score/:value` | [Ex 08](workshop-automation/exercise-08-collision-restart.md) |
| `waitForNavigation()` — assert `location.reload()` fires on game-over | [Ex 08, 10](workshop-automation/exercise-08-collision-restart.md) |
| Rapid input stress test — 10 × Space at 200 ms intervals | [Ex 09](workshop-automation/exercise-09-multiple-jumps.md) |
| Post-restart full state validation — canvas, high score, game loop | [Ex 10](workshop-automation/exercise-10-canvas-after-restart.md) |


---

## Getting Started

```bash
# 1. Clone and open in VS Code
git clone https://github.com/CanarysAutomations/Testing-with-Agents-GHCP.git
cd Testing-with-Agents-GHCP

# 2. Install API dependencies
cd trex-runner/api && npm install

# 3. Start the API server (Terminal A)
node server.js          # API running at http://localhost:3000

# 4. Serve the game UI (Terminal B)
cd ../ui && npx http-server -p 8080   # UI at http://127.0.0.1:8080
```

Then open [Exercise 01](workshop-automation/exercise-01-setup-and-copilot.md) and work through the exercises in order.

### Run the full test suite

```bash
cd trex-runner
npx playwright test tests/trex-visual.spec.ts tests/trex-gameplay.spec.ts tests/trex-collision.spec.ts --reporter=list
npx playwright show-report
```

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



