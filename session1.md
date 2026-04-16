# Session 1 — GitHub Copilot for QE: Foundations of AI-Assisted Testing
**Audience:** QE Batch — Mobileum | **Duration:** 2 Hours | **Format:** Live Demo + Hands-On

---

## Session Overview

| # | Topic | Duration |
|---|-------|----------|
| 1 | Risk-Based Test Matrix | 20 min |
| 2 | Unit Tests for Business Logic | 20 min |
| 3 | REST API Negative Suite | 20 min |
| 4 | Contract Tests | 20 min |
| 5 | Security Edge Cases & Security Testing | 20 min |
| — | Buffer / Q&A | 20 min |

**Application Under Test:** T-Rex Runner — `http://127.0.0.1:8080` (game UI) + `http://localhost:3000` (high-score API)

---

## Pre-Demo Checklist

Before you start:

```bash
# Terminal 1 — Start API
cd trex-runner/api && node server.js
# Expect: API running on 3000

# Terminal 2 — Serve game UI
cd trex-runner/ui && npx http-server -p 8080
# Expect: Available on http://127.0.0.1:8080
```

- [ ] VS Code open with GitHub Copilot Chat (`Ctrl+Alt+I`)
- [ ] Copilot Chat is in **Ask** mode for prompts 1–5
- [ ] Both servers running (API port 3000, UI port 8080)
- [ ] `trex-runner/api/server.js` open in editor for reference
- [ ] Browser tab open at `http://127.0.0.1:8080`

---

## Topic 1 — Risk-Based Test Matrix (20 min)



### Concept
Prompt engineering → requirements first, then coverage. Use Copilot to turn a feature description into a structured risk matrix before writing a single test.

### Demo Steps

**Step 1 — Open Copilot Chat (Ask mode). Share the API code as context by opening `server.js` in editor.**

**Step 2 — Send Prompt 1a: Generate Risk Matrix**

```
I have a high-score REST API with these endpoints:
  GET  /score          → returns { highScore: number }
  POST /score/:value   → updates highScore if :value > current highScore

Using risk-based testing principles, create a test matrix for this API with:
- Feature area
- Risk level (High / Medium / Low)
- Test type (Unit / Integration / E2E / Security)
- Test scenario description
- Expected outcome

Return as a markdown table.
```

**Step 3 — Send Prompt 1b: Extend to the Game UI**

```
Extend the risk matrix to cover the T-Rex Runner canvas game UI at http://127.0.0.1:8080.
Add risks for:
- Canvas rendering failure
- Score not incrementing
- Game over not triggering API call
- Rapid user input causing freeze
Keep the same table format.
```

**Step 4 — Debrief with audience**
- Point out how Copilot assigns risk levels automatically
- Show that High-risk items map to Unit + Integration tests
- Explain how this matrix will guide every test we write in this session

### Key Talking Points
- Risk-based testing prioritises effort — not every scenario needs E2E
- Copilot reads code structure and infers risks you might miss
- The matrix becomes a living document — re-run the prompt when requirements change

---

## Topic 2 — Unit Tests for Business Logic (20 min)

### Concept
Functional testing — happy path, edge cases, boundary conditions. Use Copilot to generate a complete Jest/Vitest suite for the `server.js` score logic.

### Demo Steps

**Step 1 — Open `trex-runner/api/server.js` in editor**

**Step 2 — Send Prompt 2a: Happy Path Unit Tests**

```
Write Jest unit tests for the high-score Express API in the open file.
Use supertest to call the endpoints directly (no real HTTP server needed).
Cover these scenarios in separate describe/it blocks:
1. GET /score returns { highScore: 0 } on startup
2. POST /score/100 updates highScore to 100
3. POST /score/50 does NOT update highScore (50 < 100)
4. GET /score after POST returns the updated value
Use beforeEach to reset state between tests.
```

**Step 3 — Send Prompt 2b: Edge Cases and Boundary Conditions**

```
Add these edge case tests to the same suite:
- POST /score/0  → should NOT update (0 is not greater than 0)
- POST /score/-1 → should NOT update (negative value)
- POST /score/NaN → should handle gracefully, not crash
- POST /score/99999999 → very large number, sets highScore correctly
- Two rapid POSTs: /score/200 then /score/150 → highScore stays 200
Label these in a describe block called "Edge Cases & Boundary Conditions".
```

**Step 4 — Save the file as `trex-runner/api/server.test.js` and run it**

```bash
cd trex-runner/api
npx jest server.test.js --verbose
```

**Step 5 — Show the output, point out passing/failing tests**

### Key Talking Points
- Copilot generates `describe`/`it` structure automatically — no boilerplate writing
- Edge cases around `NaN` and negative values are often missed manually
- `beforeEach` reset pattern ensures test isolation — Copilot adds this unprompted
- Demo boundary condition: 0 vs 0 (not greater than, so no update)

---

## Topic 3 — REST API Negative Suite (20 min)

### Concept
API testing — auth, schema, invalid inputs. Use Copilot to build a negative test suite covering all the ways the API can be called incorrectly.

### Demo Steps

**Step 1 — Keep `server.js` open. Open Copilot Chat.**

**Step 2 — Send Prompt 3a: Auth Negative Tests**

```
The high-score API currently has no authentication.
Write a negative test suite using supertest that:
1. Sends a request with an invalid Authorization header: "Bearer invalid_token"
   → Currently returns 200 (document this as a security gap in a comment)
2. Creates a recommendation test that shows what the response SHOULD be (401) 
   once auth is added
3. Tests missing Content-Type header on POST
Label the suite: "REST API — Auth & Header Negative Suite"
```

**Step 3 — Send Prompt 3b: Schema and Input Validation Negative Tests**

```
Write negative tests for invalid inputs to the high-score API:
- POST /score/abc       → non-numeric value, expect 400 or graceful handling
- POST /score/          → missing value segment, expect 404
- POST /score/1.5       → float value, document actual vs expected behavior
- GET  /score/extra     → extra path segments, expect 404
- DELETE /score         → unsupported method, expect 405
- Request body with { "score": 100 } as JSON instead of path param → document gap
Use supertest. Add a comment above each test explaining why it's a negative test.
```

**Step 4 — Send Prompt 3c: Negative Suite Summary Comment**

```
Add a JSDoc comment block at the top of the negative test file that summarises:
- Total number of negative scenarios
- Which ones reveal actual API gaps vs which ones pass correctly
- Recommended fixes for the gaps found
```

**Step 5 — Show the generated file, highlight the gap documentation**

### Key Talking Points
- Copilot finds gaps you didn't ask for (missing auth, unsupported methods)
- Negative tests are often skipped in manual testing — Copilot makes them effortless
- "Document the gap" pattern: tests as living spec documentation
- Float inputs and path segment edge cases are real production bugs

---

## Topic 4 — Contract Tests (20 min)

### Concept
Integration testing — verifying that the consumer (game UI) and provider (score API) honour a shared contract. Use Copilot to write Pact-style contract tests.

### Demo Steps

**Step 1 — Open Copilot Chat. Explain to audience: contract = agreement between frontend and backend.**

**Step 2 — Send Prompt 4a: Define the Contract**

```
The T-Rex Runner game UI (consumer) calls the high-score API (provider).
Based on these two interactions:
  Consumer calls: POST http://localhost:3000/score/150
  Consumer expects: { highScore: 150 }

  Consumer calls: GET http://localhost:3000/score
  Consumer expects: { highScore: <number> }

Write a Pact consumer contract test using @pact-foundation/pact for Node.js that:
1. Defines the consumer as "TrexGameUI" and provider as "ScoreAPI"
2. Sets up the Pact mock server on port 1234
3. Tests both interactions above
4. Writes the pact file to ./pacts/
Use TypeScript syntax.
```

**Step 3 — Send Prompt 4b: Provider Verification**

```
Write the Pact provider verification test for the ScoreAPI (server.js).
It should:
1. Start the Express app on a test port
2. Load and verify the pact file from ./pacts/
3. Use @pact-foundation/pact StateHandlers to reset state before each interaction
4. Assert that the provider honours all consumer expectations
```

**Step 4 — Send Prompt 4c: Contract Drift Scenario**

```
Show me what happens when the API breaks the contract.
Modify the GET /score response shape to return { score: 150 } instead of { highScore: 150 }.
Then explain how the Pact provider verification would catch this contract drift.
Add a comment in the test file marking this as a "contract drift detection" example.
```

**Step 5 — Show the pact JSON file, explain it becomes the contract artifact in CI**

### Key Talking Points
- Contract tests run without the real consumer or provider — fast, isolated
- Pact files are version-controlled — breaking changes are caught before deployment
- This pattern scales: every microservice pair gets a contract
- Copilot writes both sides of the contract from a single description

---

## Topic 5 — Security Edge Cases & Security Testing (20 min)

### Concept
Security testing — injection, auth bypass, information exposure. Use Copilot to generate OWASP-aligned security test cases for the API and game.

### Demo Steps

**Step 1 — Open Copilot Chat.**

**Step 2 — Send Prompt 5a: OWASP Top 10 — Injection**

```
Write security test cases for the high-score API targeting OWASP Top 10 injection risks.
Focus on these attack vectors against POST /score/:value:
1. SQL injection attempt: POST /score/1;DROP TABLE scores--
2. NoSQL injection: POST /score/{"$gt":0}
3. Command injection: POST /score/100;ls
4. Path traversal: POST /score/../admin
5. Script injection: POST /score/<script>alert(1)</script>

For each test:
- Send the malicious value using supertest
- Assert the API either returns a non-500 status OR sanitises the input
- Add a comment with the OWASP Top 10 category it covers
Use Jest + supertest. Label the suite "Security — Injection Attack Suite".
```

**Step 3 — Send Prompt 5b: Information Exposure and Headers**

```
Write security tests for information exposure in the high-score API:
1. Check response headers for X-Powered-By: Express (should be hidden in production)
2. Verify no stack traces are returned in error responses
3. Check that 404 responses don't reveal server internals
4. Test that CORS allows only expected origins (document current open CORS as a finding)
5. Verify no sensitive data in GET /score response beyond { highScore: number }
Format as a Jest suite. Add a "Security Finding" comment where the API fails a check.
```

**Step 4 — Send Prompt 5c: Security Test Report Prompt**

```
Generate a security test summary report in markdown format based on the tests we just wrote.
Include:
- Findings table: Vulnerability | Severity | OWASP Category | Status (Pass/Fail/Gap)
- Remediation recommendations for each finding
- Priority order for fixes (Critical → High → Medium → Low)
This will be used as a security sign-off document for the QE team.
```

**Step 5 — Open the generated report, walk through the findings table**

### Key Talking Points
- Copilot knows OWASP Top 10 — no security specialist needed to get started
- "Document the gap" pattern again: failing tests become remediation tickets
- Security testing is usually an afterthought — Copilot makes it a first-class step
- The report prompt bridges QE and SecOps communication

---

## Session 1 Wrap-Up (5 min)

### What Was Demonstrated

| Copilot Feature Used | Where |
|---------------------|-------|
| Ask Mode — requirements → risk matrix | Topic 1 |
| Code context from open editor | Topics 2, 3 |
| Multi-turn prompt refinement | Topics 2, 3 |
| Structured output (markdown tables, JSDoc) | Topics 1, 4, 5 |
| OWASP-aware security generation | Topic 5 |

### Key Takeaway Message
> GitHub Copilot doesn't just write code — it helps you **think through testing strategy**, then **execute it**. From risk matrix to security report, every artefact was produced in minutes with precise prompts.

---

## Appendix — Agents for Session 1

### When to Use Agents (vs Ask Mode)

Use **Ask Mode** for Topics 1–5 (above) — they are prompt-heavy and exploratory.
Switch to **Agent Mode** when you need Copilot to **read files + write tests + run them** in a single step.

### Agent: `score-api-tester` (Optional Advanced Demo)

Create `.github/score-api-tester.agent.md`:

```markdown
---
name: Score API Tester
description: Writes and runs Jest tests for the T-Rex Runner high-score API. Covers unit, negative, contract, and security scenarios.
tools:
  - read_file
  - create_file
  - run_in_terminal
  - semantic_search
---

You are a QE specialist for the T-Rex Runner high-score API.
The API is in trex-runner/api/server.js.
Endpoints: GET /score, POST /score/:value.

When asked to generate tests:
1. Always read server.js first to understand current implementation.
2. Generate tests using Jest + supertest.
3. Save to trex-runner/api/<suite-name>.test.js.
4. Run: cd trex-runner/api && npx jest <suite-name>.test.js --verbose
5. Report pass/fail count and flag any unexpected failures.
```

### Effective Agent Prompts for Session 1

```
# Risk Matrix Agent Prompt
@score-api-tester Generate a risk-based test matrix for server.js, then create test files 
for all HIGH risk items. Run them and report results.

# Security Sweep Agent Prompt  
@score-api-tester Read server.js and write a complete OWASP Top 10 security test suite.
Save it as security.test.js. Run it. For every failing test, add a comment: 
"SECURITY FINDING: <description>".

# Contract Coverage Agent Prompt
@score-api-tester Write consumer contract tests for the game UI calling the score API.
Use @pact-foundation/pact. Save consumer tests to pacts/consumer.test.ts and 
provider tests to pacts/provider.test.ts.
```

---

## Appendix — Quick Reference Prompts

| Scenario | Copy-Paste Prompt Starter |
|----------|--------------------------|
| Risk matrix from code | `"Create a risk-based test matrix for [paste endpoint list]. Include risk level, test type, scenario, expected outcome."` |
| Happy path unit tests | `"Write Jest unit tests for [function/endpoint]. Cover happy path, then add edge cases."` |
| Negative API suite | `"Write negative tests for [endpoint]. Cover invalid inputs, missing params, wrong methods."` |
| Contract definition | `"Write a Pact consumer test where [consumer] calls [provider endpoint] and expects [response shape]."` |
| OWASP injection tests | `"Write security tests for [endpoint] targeting OWASP injection risks. Use [test framework]."` |
| Security report | `"Generate a security findings markdown report from the tests above. Include severity and remediation."` |
