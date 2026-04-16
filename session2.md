# Session 2 — GitHub Copilot for QE: Advanced Testing, Automation & Collaboration
**Audience:** QE Batch — Mobileum | **Duration:** 2 Hours | **Format:** Live Demo + Hands-On

---

## Session Overview

| # | Topic | Duration |
|---|-------|----------|
| 1 | Test Strategy & Test Planning | 15 min |
| 2 | Test Case Execution (Manual Checklists) | 10 min |
| 3 | Automation of Test Cases — Playwright | 15 min |
| 4 | Integration Testing | 10 min |
| 5 | System Testing & Non-Functional Testing | 10 min |
| 6 | Synthetic Data Generation | 10 min |
| 7 | Replacing Manual Tests with First-Time Automation | 10 min |
| 8 | CI/CD Pipeline — Wire Tests into CI | 15 min |
| 9 | MCP — External Data Integration | 10 min |
| 10 | Copilot Code Review — Test Quality Gates | 10 min |
| 11 | Copilot Spaces — Team Collaboration & Standards | 5 min |
| — | Buffer / Q&A | 10 min |

**Application Under Test:** T-Rex Runner — `http://127.0.0.1:8080` (game UI) + `http://localhost:3000` (high-score API)

---

## Pre-Demo Checklist

```bash
# Terminal 1 — Start API
cd trex-runner/api && node server.js

# Terminal 2 — Serve game UI
cd trex-runner/ui && npx http-server -p 8080
```

- [ ] Both servers running
- [ ] VS Code with Copilot Chat open
- [ ] Playwright initialised: `trex-runner/` contains `playwright.config.ts` and `tests/`
- [ ] `.github/` contains agent files from Session 1 (or create fresh ones below)
- [ ] MCP configured in `.vscode/mcp.json` (see Topic 9)
- [ ] GitHub Actions workflow directory `.github/workflows/` exists (create if needed)

---

## Topic 1 — Test Strategy & Test Planning (15 min)

### Concept
Turn requirements and risks into a structured test strategy. Copilot generates a full QE strategy document from a feature description in seconds.

### Demo Steps

**Step 1 — Open Copilot Chat in Ask mode.**

**Step 2 — Send Prompt 1a: Generate Test Strategy Document**

```
I am the QE lead for a browser-based canvas game (T-Rex Runner) with a Node.js high-score API.

Requirements:
- The game runs in a browser canvas at http://127.0.0.1:8080
- Player presses Space to jump over obstacles
- On collision, the game posts the score to POST http://localhost:3000/score/:value
- The game reloads after collision
- GET /score returns the persisted high score

Generate a complete Test Strategy document containing:
1. Scope (in-scope and out-of-scope features)
2. Test objectives (3–5 measurable goals)
3. Test levels: Unit, Integration, System, E2E, Non-Functional
4. Entry and exit criteria for each test level
5. Risk register (top 5 risks with mitigation)
6. Recommended tooling per test level
7. Test environment requirements
Format as a professional markdown document.
```

**Step 3 — Send Prompt 1b: Create Sprint Test Plan**

```
Based on the test strategy above, create a 2-week sprint test plan.
Assign these test types to each sprint week:
- Week 1: Unit tests (API logic) + Integration tests (API ↔ Game communication)
- Week 2: E2E automation (Playwright) + Non-functional + Security sweep

For each week include:
- Daily focus areas
- Deliverables (test files, reports)
- Definition of Done
- Blockers to watch for
```

**Step 4 — Save output as a reference, show audience the structure**

### Key Talking Points
- A test strategy takes a QE lead days — Copilot drafts it in 30 seconds
- Entry/exit criteria are often skipped — Copilot enforces them automatically
- This document becomes the anchor for all tests in sessions 1 and 2

---

## Topic 2 — Test Case Execution (Manual Checklists) (10 min)

### Concept
Create manual test cases and execution checklists that a tester can follow without Copilot — and then show how to automate them.

### Demo Steps

**Step 1 — Send Prompt 2a: Manual Test Cases**

```
Write manual test cases for the T-Rex Runner game in a step-by-step format.
Cover these scenarios:
1. Game Launch — verify canvas loads, high score shows 0
2. Spacebar Jump — player jumps, game continues
3. Collision Detection — obstacle hits, game over triggers, score posts to API
4. High Score Persistence — play twice, second score lower, high score unchanged

For each test case use this template:
- Test Case ID
- Test Case Title
- Preconditions
- Test Steps (numbered)
- Expected Result
- Pass/Fail checkbox
```

**Step 2 — Send Prompt 2b: Execution Checklist**

```
Convert the manual test cases above into a QE execution checklist in markdown format.
Group by test cycle (Smoke / Regression / Full).
Add a "tester name" and "date" field at the top.
Add a status column: [ ] Not Run | [x] Pass | [!] Fail | [-] Blocked
```

**Step 3 — Show the checklist, transition to "now let's automate this"**

### Key Talking Points
- Every manual test case should map 1:1 to an automated test
- The checklist becomes the baseline — automation proves it runs every build
- Transition line: "We just created the spec. Now let Copilot write the code."

---

## Topic 3 — Automation of Test Cases — Playwright (15 min)

### Concept
Generate automated Playwright tests aligned to the framework and coding standards established by your team's SKILL.md file.

### Demo Steps

**Step 1 — Create the 3 agents and shared SKILL.md (if not already done)**

Create `.github/skills/trex-automation/SKILL.md` with the content below, then create the 3 agent files.

#### SKILL.md Content
```markdown
---
name: trex-automation
description: Automate T-Rex Runner with Playwright. Includes locators, disableCollision, score assertions, and API patterns.
---

## Locators
| Element | Locator |
|---|---|
| Game canvas | `page.getByLabel('game-canvas')` |
| High score display | `page.getByLabel('high-score')` |

## Score (not in DOM — use evaluate)
```typescript
const score = await page.evaluate(() => (window as any).gameScore);
```

## Disable Collision (call BEFORE page.goto)
```typescript
async function disableCollision(page: any) {
  await page.route('http://127.0.0.1:8080/game.js', async (route: any) => {
    const response = await route.fetch();
    let body = await response.text();
    body = body.replace(
      'if(obs<70&&obs>50&&y>140)gameOver();\n else requestAnimationFrame(loop);',
      'requestAnimationFrame(loop);'
    );
    await route.fulfill({ response, body });
  });
}
```

## Canvas Size Assertion
```typescript
const box = await page.getByLabel('game-canvas').boundingBox();
expect(box?.width).toBe(800);
expect(box?.height).toBe(250);
```
```

#### Create Agent Files in `.github/`

**`trex-visual-agent.agent.md`**
```markdown
---
name: T-Rex Visual Validator
description: Validates T-Rex Runner visual state — canvas dimensions, high score display, page load errors.
tools:
  - playwright
  - read_file
  - create_file
---
You are a visual test automation specialist for the T-Rex Runner game.
Always use the skill file at .github/skills/trex-automation/SKILL.md for locators.
Only use getByLabel, getByRole, getByText — never CSS selectors or XPath.
Save generated tests to trex-runner/tests/trex-visual.spec.ts.
```

**`trex-gameplay-agent.agent.md`**
```markdown
---
name: T-Rex Gameplay Tester
description: Tests keyboard interactions, continuous gameplay, and score progression.
tools:
  - playwright
  - read_file
  - create_file
---
You are a gameplay test specialist for the T-Rex Runner game.
Always call disableCollision() before page.goto() in all gameplay tests.
Use window.gameScore via page.evaluate — never read score from DOM.
Save generated tests to trex-runner/tests/trex-gameplay.spec.ts.
```

**`trex-collision-agent.agent.md`**
```markdown
---
name: T-Rex Collision Tester
description: Tests natural collision detection, score POST to API, and game restart behaviour.
tools:
  - playwright
  - read_file
  - create_file
---
You are a collision and restart test specialist.
Do NOT disable collisions in these tests — you need natural game over.
Use page.waitForRequest to intercept POST /score/:value.
Use waitForNavigation to assert page reload after game over.
Save generated tests to trex-runner/tests/trex-collision.spec.ts.
```

**Step 2 — Switch Copilot Chat to T-Rex Visual Validator agent**

**Step 3 — Send Prompt 3a: Visual Test Generation**

```
Using the Playwright MCP tool and the SKILL.md patterns:
1. Navigate to http://127.0.0.1:8080
2. Confirm no JavaScript errors on load
3. Confirm game-canvas is visible and 800×250 pixels
4. Confirm high-score shows "High Score: 0"
5. Generate a Playwright TypeScript spec file with these assertions.
Save to trex-runner/tests/trex-visual.spec.ts.
```

**Step 4 — Switch to T-Rex Gameplay Tester agent, send Prompt 3b**

```
Write a Playwright TypeScript spec that:
1. Disables collision using the SKILL.md pattern
2. Navigates to http://127.0.0.1:8080
3. Presses Space to make the T-Rex jump
4. Waits 4 seconds while monitoring for JS errors
5. Asserts gameScore > 0
6. Asserts URL has not changed
Save to trex-runner/tests/trex-gameplay.spec.ts.
```

**Step 5 — Run the tests**

```bash
cd trex-runner
npx playwright test tests/trex-visual.spec.ts tests/trex-gameplay.spec.ts --reporter=list
```

### Key Talking Points
- SKILL.md is the "house style guide" for test automation — ensures consistency across all agents and testers
- No CSS selectors or XPath — accessibility locators only (resilient to UI changes)
- Agents remember your constraints — you never repeat "use getByLabel" in every prompt

---

## Topic 4 — Integration Testing (10 min)

### Concept
Verify the game UI and the score API communicate correctly end-to-end — the browser calls the right endpoint with the right payload.

### Demo Steps

**Step 1 — Switch to T-Rex Collision Tester agent**

**Step 2 — Send Prompt 4a: Integration — Game to API**

```
Write a Playwright integration test that verifies the T-Rex Runner game correctly 
calls the high-score API on collision.
The test should:
1. Navigate to http://127.0.0.1:8080 WITHOUT disabling collision
2. Intercept the POST request to http://localhost:3000/score/:value using page.waitForRequest
3. Allow the game to run naturally until game over
4. Assert the intercepted request:
   - Method is POST
   - URL matches /score/<number>
   - :value is a positive integer
5. Assert a page navigation (reload) happens after game over
Save to trex-runner/tests/trex-collision.spec.ts.
```

**Step 3 — Send Prompt 4b: API→UI State Sync Integration Test**

```
Write a Playwright integration test for high score persistence:
1. POST to http://localhost:3000/score/250 directly (using page.request or fetch)
2. Navigate to http://127.0.0.1:8080
3. Assert the high-score element shows "High Score: 250"
This verifies the UI correctly reads and displays the API state on load.
```

### Key Talking Points
- Integration tests catch the seam failures — game logic correct, API correct, but together they break
- `page.waitForRequest` is the Playwright way to assert API calls without mocking
- The score sync test is a real regression — if the high-score display breaks, this catches it

---

## Topic 5 — System Testing & Non-Functional Testing (10 min)

### Concept
System testing validates the full stack end-to-end. Non-functional testing covers performance, load, and accessibility.

### Demo Steps

**Step 1 — Send Prompt 5a: System Test — Full Flow**

```
Write a Playwright system test that validates the complete T-Rex Runner flow end-to-end:
1. Start with high score = 0 (POST /score/0 to reset, or use API mock)
2. Load the game — verify initial state
3. Play until score > 0 (disable collision, run for 5 seconds)
4. Trigger game over naturally (re-enable collision or call gameOver() via evaluate)
5. Intercept the POST score call — assert value > 0
6. After reload, verify high-score display updated
7. Reload the page again — verify high score persists across reloads
Label this as "Full System Flow Test".
```

**Step 2 — Send Prompt 5b: Non-Functional — Performance**

```
Write a Playwright performance test for the T-Rex Runner game:
1. Measure page load time using performance.timing via page.evaluate
2. Assert page loads in under 2 seconds
3. Measure canvas first paint time
4. Run the game for 10 seconds, sample gameScore every 2 seconds — assert score increases consistently (no frozen frames)
5. Assert no memory leaks: take heap snapshot before and after 10-second run (if Playwright supports it, otherwise document as manual step)
```

**Step 3 — Send Prompt 5c: Accessibility Test**

```
Write a Playwright accessibility test using @axe-core/playwright:
1. Navigate to http://127.0.0.1:8080
2. Run an axe accessibility scan
3. Assert zero critical or serious violations
4. Print a summary of any warnings found
5. Add a comment listing which WCAG 2.1 AA rules were checked
```

### Key Talking Points
- System tests are the QE sign-off gate — if this passes, the feature ships
- Performance assertions prevent score-freeze regressions (canvas games are perf-sensitive)
- Axe integration adds accessibility compliance to every build — zero extra effort

---

## Topic 6 — Synthetic Data Generation (10 min)

### Concept
Generate realistic, production-like test data without using real user data — covering boundary values, internationalization, and load scenarios.

### Demo Steps

**Step 1 — Open Copilot Chat in Ask mode.**

**Step 2 — Send Prompt 6a: Synthetic Score Data**

```
Generate a synthetic test data set for the T-Rex Runner high-score API.
Create a JavaScript array of 20 test cases, each with:
- inputScore: number (cover: 0, 1, boundary around max safe integer, negative, float, very large)
- expectedHighScore: number (what highScore should be after the POST)
- testLabel: string (human-readable description)

Seed the data with these constraints:
- At least 3 boundary values (0, 1, Number.MAX_SAFE_INTEGER)
- At least 2 negative values
- At least 2 float values
- At least 3 "no update" scenarios (new score lower than current high score)
Export as a TypeScript array for use in parameterised Jest tests.
```

**Step 3 — Send Prompt 6b: Parameterised Tests from Synthetic Data**

```
Using the synthetic test data array above, write parameterised Jest tests with test.each().
Each test should:
- POST /score/<inputScore>
- Assert the response highScore equals expectedHighScore
- Use testLabel as the test name
Group all tests in describe("Parameterised Score Tests — Synthetic Data").
```

**Step 4 — Send Prompt 6c: Bulk Load Simulation**

```
Write a Node.js script (not a test) that sends 100 POST /score/:value requests to 
the API in parallel using Promise.all().
Scores should be random integers between 1 and 10000.
After all requests complete, call GET /score and assert the returned highScore 
equals the maximum value from all the POSTed scores.
This simulates a load scenario for data integrity testing.
```

### Key Talking Points
- Synthetic data is safer than production data (GDPR, privacy)
- `test.each()` + generated data = 20 test cases in 3 lines
- The bulk load script is a lightweight stress test without a full load testing tool

---

## Topic 7 — Replacing Manual Testing with First-Time Automation (10 min)

### Concept
Take an existing manual test checklist and have Copilot convert it to a full automated suite — zero test automation experience required.

### Demo Steps

**Step 1 — Paste a sample manual checklist into chat**

```
I have this manual test checklist that my team runs every release:

Manual Test ID: TC-001
Steps: Open http://127.0.0.1:8080, check canvas is visible, check "High Score: 0" shows
Expected: Canvas visible, score shows 0

Manual Test ID: TC-002
Steps: Press Space bar, dino should jump, game should keep running
Expected: Dino jumps, no crash, score starts incrementing

Manual Test ID: TC-003
Steps: Let dino hit an obstacle, observe game over, check API was called
Expected: POST to /score/:value seen in Network tab, page reloads

Convert this manual checklist to a Playwright TypeScript spec file.
- Keep the Test ID as a comment above each test
- Use accessibility locators only
- Assert exactly what the manual test expects — nothing more
- Save as trex-runner/tests/trex-manual-to-auto.spec.ts
```

**Step 2 — Show the generated file side-by-side with the manual checklist**

**Step 3 — Run the automated suite**

```bash
cd trex-runner
npx playwright test tests/trex-manual-to-auto.spec.ts --reporter=list
```

### Key Talking Points
- This is the "day zero" automation path for teams with no automation experience
- Copilot maps steps to locators automatically — testers stay in plain English
- Once automated, the checklist never needs to be run manually again
- This approach scales: paste your entire test case spreadsheet, get a full spec

---

## Topic 8 — CI/CD Pipeline — Wire Tests into CI (15 min)

### Concept
Design and wire test runs into a GitHub Actions CI pipeline. Copilot writes the YAML so you don't have to.

### Demo Steps

**Step 1 — Open Copilot Chat in Ask mode.**

**Step 2 — Send Prompt 8a: Basic CI Pipeline**

```
Write a GitHub Actions workflow file (.github/workflows/playwright-tests.yml) that:
1. Triggers on push to main and on pull_requests
2. Runs on ubuntu-latest
3. Sets up Node.js 18
4. Installs dependencies: cd trex-runner && npm install && npx playwright install
5. Starts the API server in the background: cd trex-runner/api && node server.js &
6. Starts the UI server in the background: cd trex-runner/ui && npx http-server -p 8080 &
7. Waits 5 seconds for servers to be ready
8. Runs: npx playwright test tests/ --reporter=list
9. Uploads the Playwright HTML report as an artifact on failure
Name the job "playwright-tests".
```

**Step 3 — Send Prompt 8b: Tiered Test Pipeline**

```
Extend the GitHub Actions workflow with these improvements:
1. Add a "unit-tests" job that runs Jest tests (trex-runner/api) independently
2. Add a "playwright-tests" job that depends on "unit-tests" (needs:)
3. Add a test results summary using actions/upload-artifact
4. Add environment variables: BASE_URL=http://127.0.0.1:8080 and API_URL=http://localhost:3000
5. Add a job status badge comment at the top of the YAML file
6. Set timeout-minutes: 10 on the playwright job to prevent hanging runs
```

**Step 4 — Send Prompt 8c: Quality Gate**

```
Add a quality gate to the GitHub Actions workflow:
- If more than 10% of tests fail, fail the pipeline with exit code 1
- Add a step that posts a Slack notification (use a placeholder webhook URL) 
  when tests fail on the main branch
- Add a matrix strategy to run tests on chromium, firefox, and webkit
```

**Step 5 — Show the YAML file, highlight the dependency chain**

### Key Talking Points
- CI is where "it works on my machine" dies — Copilot writes the pipeline in minutes
- Tiered jobs (unit → E2E) fail fast — don't run slow E2E if unit tests break
- Matrix strategy: if it fails on webkit only, it's a browser-specific bug
- Artifacts ensure failing test screenshots survive the CI run

---

## Topic 9 — MCP — External Data Integration (10 min)

### Concept
Model Context Protocol gives Copilot agents access to live external data — test requirements, run history, defects, and environment data outside the repo.

### Demo Steps

**Step 1 — Show the `.vscode/mcp.json` configuration**

Create `.vscode/mcp.json`:
```json
{
  "servers": {
    "playwright": {
      "command": "npx",
      "args": ["@playwright/mcp@latest"],
      "env": {
        "PLAYWRIGHT_BROWSERS_PATH": "0"
      }
    }
  }
}
```

**Step 2 — Open Copilot Chat and switch to an agent that has the Playwright tool**

**Step 3 — Send Prompt 9a: Live Browser Inspection**

```
Using the Playwright MCP tool:
1. Navigate to http://127.0.0.1:8080
2. Take a full accessibility tree snapshot of the page
3. List all interactive elements found
4. Tell me the current high score value from the high-score element
5. Report any console errors you observe
```

**Step 4 — Explain the MCP architecture**

Draw/show this diagram verbally:
```
Copilot Agent
     ↓ (MCP protocol)
Playwright MCP Server
     ↓ (CDP / browser automation)
Real Chrome Browser
     ↓ (HTTP)
T-Rex Runner App
```

**Step 5 — Send Prompt 9b: External Data Pattern**

```
Describe how I would extend the MCP configuration to give Copilot agents access to:
1. A Jira board (test requirements and defects)
2. A TestRail run history (previous test results)
3. A staging environment variable file (environment data)
Show me what the mcp.json would look like and how an agent prompt would reference this data.
```

### Key Talking Points
- MCP = tool calls for agents — the agent can use any external system, not just the repo
- The accessibility tree is how Playwright MCP "sees" the page — no screenshots needed
- Jira + TestRail integration: agents can auto-create defects when tests fail
- This is the bridge between AI agents and your existing QE toolchain

---

## Topic 10 — Copilot Code Review — Test Quality Gates (10 min)

### Concept
Catch unreliable tests before they merge — missing assertions, flaky patterns, brittle mocks.

### Demo Steps

**Step 1 — Show a deliberately weak test (create inline in chat)**

```
Review this Playwright test for quality issues and flag any problems:

test('game loads', async ({ page }) => {
  await page.goto('http://127.0.0.1:8080');
  await page.waitForTimeout(3000);
  const canvas = await page.$('#canvas');
  expect(canvas).toBeTruthy();
});

Check for:
1. Missing assertions (what is actually being verified?)
2. Flaky patterns (setTimeout, waitForTimeout, polling)
3. Brittle locators (CSS selectors, IDs that might change)
4. Missing error handling (no pageerror listener)
5. Test isolation issues
6. Any OWASP or security concerns in test code
Provide a fixed version of the test with comments explaining each fix.
```

**Step 2 — Send Prompt 10b: Review a Real Test File**

```
Review the file trex-runner/tests/trex-gameplay.spec.ts for test quality.
Flag:
- Any test that has no expect() statement
- Any use of page.waitForTimeout() (flaky)
- Any hardcoded selector that isn't from the SKILL.md locator list
- Any test that doesn't clean up state (missing afterEach/afterAll)
- Any test that could give a false positive (always passing regardless of behaviour)
Return a quality report with: Issue | Location | Severity | Fix
```

**Step 3 — Show how this becomes a PR check prompt**

```
I want to add a Copilot code review step to every PR that touches trex-runner/tests/.
Write a GitHub Actions workflow step that:
1. On pull_request, runs: npx playwright test --list to enumerate tests
2. Checks each test for waitForTimeout usage (grep)
3. Checks each test file for at least one expect() call per test
4. Fails the PR check if any test has zero assertions
```

### Key Talking Points
- `waitForTimeout` is the #1 cause of flaky tests — Copilot catches it automatically
- "Assert nothing" tests always pass — they're worse than no test
- PR-level quality gates mean bad tests never merge to main
- This is Copilot as QA for your QA code

---

## Topic 11 — Copilot Spaces — Team Collaboration & Standards (5 min)

### Concept
Copilot Spaces let your team share context — SKILL.md files, test patterns, and QE standards — so every team member's Copilot gives consistent answers.

### Demo Steps (Conceptual — No Code Required)

**Step 1 — Explain Copilot Spaces**
- A Space = a shared context window for a team
- You add files, URLs, and notes that all team members' Copilot inherits
- Your SKILL.md, playwright.config.ts, and coding standards live in the Space

**Step 2 — Send Prompt 11a: Draft a Space Setup Description**

```
I want to create a Copilot Space for our QE team working on the T-Rex Runner test suite.
Describe what files and context I should add to the Space so that:
1. All team members get consistent Playwright locator suggestions
2. New team members immediately understand the project test structure
3. Copilot always suggests the disableCollision() pattern for gameplay tests
4. API base URLs are always correct (not hardcoded in tests)
List the exact files I should include and what instructions I should write in the Space description.
```

**Step 3 — Tie to SKILL.md**
- The `.github/skills/trex-automation/SKILL.md` file IS your team standard
- Adding it to a Space makes it available in every agent conversation automatically

### Key Talking Points
- Spaces scale QE knowledge — not just for one project, for the entire team
- Onboarding: new tester opens Space → Copilot already knows locators, patterns, standards
- Changes to SKILL.md propagate to all team members' Copilot instantly

---

## Session 2 Wrap-Up (5 min)

### What Was Demonstrated

| Copilot Feature Used | Where |
|---------------------|-------|
| Ask Mode — strategy document generation | Topic 1 |
| Manual → Automated test conversion | Topic 2, 7 |
| Agent Mode — Playwright spec generation | Topic 3 |
| Playwright MCP — live browser control | Topic 9 |
| Code review / quality gate prompts | Topic 10 |
| GitHub Actions YAML generation | Topic 8 |
| Synthetic data + parameterised tests | Topic 6 |
| Copilot Spaces — team standards | Topic 11 |

### 2-Session Journey Summary

```
Session 1                              Session 2
─────────────────────────────────────  ─────────────────────────────────────
Risk Matrix → Unit Tests               Test Strategy → Execution Checklists
API Negative Suite                     Playwright Automation (agents)
Contract Tests                         Integration + System + Non-functional
Security Testing                       CI/CD Pipeline + Quality Gates
                                       MCP + Synthetic Data + Team Standards
```

### Key Takeaway Message
> GitHub Copilot is not a test writer — it is a **QE force multiplier**. It takes your requirements, your risks, and your standards and translates them into working tests, pipelines, and documentation. The QE engineer stays in control; Copilot handles the repetition.

---

## Full Agent Reference — Both Sessions

### Agent Files to Create in `.github/`

| File | Agent Name | Used In |
|------|-----------|---------|
| `trex-visual-agent.agent.md` | T-Rex Visual Validator | Sessions 1 & 2 |
| `trex-gameplay-agent.agent.md` | T-Rex Gameplay Tester | Sessions 1 & 2 |
| `trex-collision-agent.agent.md` | T-Rex Collision Tester | Sessions 1 & 2 |
| `score-api-tester.agent.md` | Score API Tester | Session 1 |

### How to Create an Agent in VS Code

1. Open Copilot Chat (`Ctrl+Alt+I`)
2. Click the **Chat Customizations** icon (sparkle/gear icon near the mode dropdown)
3. Select **Agent** → **New agent (workspace)**
4. VS Code creates a new `.agent.md` file — paste the agent content from this guide
5. Save the file — the agent appears in the mode dropdown immediately
6. Reload window if the agent does not appear: `Ctrl+Shift+P` → `Developer: Reload Window`

---

## Master Prompt Reference — Session 2

| Topic | Prompt Purpose | Key Phrase to Use |
|-------|---------------|-------------------|
| Test Strategy | Generate full strategy doc | `"Generate a complete Test Strategy document containing..."` |
| Manual Test Cases | Structured test case format | `"Use this template: Test Case ID, Preconditions, Steps, Expected Result"` |
| Automation | Agent-based Playwright gen | `"Using the Playwright MCP tool and SKILL.md patterns..."` |
| Integration | Intercept API calls | `"Use page.waitForRequest to intercept POST /score/:value"` |
| System Test | Full flow end-to-end | `"Validate the complete T-Rex Runner flow end-to-end"` |
| Non-Functional | Performance baseline | `"Measure page load time using performance.timing"` |
| Synthetic Data | Parameterised test data | `"Generate a synthetic test data set... export as TypeScript array"` |
| Manual→Auto | Convert checklist | `"Convert this manual checklist to a Playwright TypeScript spec"` |
| CI/CD | GitHub Actions YAML | `"Write a GitHub Actions workflow file that..."` |
| Quality Gate | Test code review | `"Review this test for quality issues and flag any problems"` |
| MCP | Live browser data | `"Using the Playwright MCP tool: navigate to... take accessibility snapshot"` |
| Spaces | Team context | `"Describe what files I should add to a Copilot Space for my QE team"` |

---

## Appendix — Playwright Initialisation (If Not Done)

```bash
cd trex-runner
npm init playwright@latest
# Choose: TypeScript, tests/ folder, no GitHub Actions (we write it manually)
```

Then run your first test:

```bash
npx playwright test tests/ --reporter=list
npx playwright show-report
```
