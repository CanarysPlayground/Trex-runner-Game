# SDLC Execution Plan — Power-Ups Feature (T-Rex Runner)

**TL;DR:** Introduce Shield and Score Boost power-ups into the T-Rex Runner by extending the game state machine, adding collectible spawn logic, enforcing server-side score integrity, and validating every power-up lifecycle through a full test pyramid wired into the existing CI/CD pipeline.

---

---

## Baseline Assessment

| Dimension | Current State |
|---|---|
| Core loop | Canvas-based runner; `idle → running → over` state machine |
| Difficulty | Three profiles (easy / medium / hard) with `scoreMultiplier` field already present |
| Score persistence | REST API `POST /score/:value` — accepts any integer; no server-side validation |
| Global exposure | `window.gameScore` is publicly mutable; no access control |
| Test coverage | Playwright E2E for jump, score progression, shield state (pre-existing) |
| Power-ups | None — no spawn, activation, timer, or expiry logic exists anywhere |

**Critical risk hotspots identified before any implementation begins:**

- `server.js`: `Number(req.params.value)` does not reject `Infinity`, `NaN`, or arbitrarily large integers → score injection vector
- `window.gameScore` on the global scope → client-side manipulation from browser console
- `scoreMultiplier` already exists in difficulty profiles — Score Boost interaction with hard-mode multiplier is **undefined and blocking**

---

| Constant | Current Value | File Location |
|---|---|---|
---

## Phase 1 — Game Design Contracts & Requirements Hardening

**Objective:** Convert business requirements into unambiguous, signed-off design contracts before any implementation begins. No implementation proceeds without this phase being complete.

### 1.1 Power-Up Design Contracts

**Shield**

| Attribute | Specification |
|---|---|
| Trigger | Dino collides with Shield collectible on canvas |
| Effect | Absorbs the next obstacle collision; game continues |
| Expiry | Immediately on use (single-collision absorption) |
| Stacking | Cannot stack — collecting a second Shield while active is a no-op |
| Visual state | HUD badge: visible when active, hidden when inactive |
| Accessibility | `aria-label="shield-active"` / `aria-label="shield-inactive"` on HUD element |

**Score Boost**

| Attribute | Specification |
|---|---|
| Trigger | Dino collides with Score Boost collectible on canvas |
| Effect | Doubles the per-tick score increment for a fixed duration (T seconds — value TBD in Phase 1) |
| Expiry | Timer-based; no early deactivation; discarded on game over |
| Stacking | Cannot stack — collecting a second Boost while active resets the timer (or is a no-op — **must be resolved**) |
| Visual state | HUD countdown timer visible during active boost |
| Accessibility | `aria-label="score-boost-timer"` on HUD countdown element |

### 1.2 Blocking Design Decisions (must resolve before Phase 2)

| Decision | Options | Impact |
|---|---|---|
| Score Boost + hard-mode `scoreMultiplier: 2` | (a) Additive: 2×2 = 4× total, (b) Override: Boost replaces multiplier at 2×, (c) Max: take whichever is higher | Affects score plausibility check on server; security and test contract |
| Score Boost duration (T) | 5 s / 10 s / 15 s | Affects server-side time-bounded validation |
| Score Boost stacking rule | Reset timer vs. no-op on second collection | Affects state machine and unit tests |
| Boost timer authority | Client-side tick count vs. server-issued token | Determines security architecture for Score Boost |

**Quality Gate:** All four decisions above documented and signed off. No Phase 2 work begins until this gate is passed.

### 1.3 Power-Up Interaction Matrix

| Scenario | Required Behaviour |
|---|---|
| Shield active + obstacle hit | Collision absorbed; shield deactivates; game continues |
| Shield active + Score Boost collected | Both active simultaneously; no conflict |
| Score Boost active + game over | Boost discarded; score submitted at base rate (no boost applied to final submission) |
| Shield + Shield collected (active) | Second collection ignored; no state change |
| Score Boost + Score Boost collected (active) | Per stacking rule resolved in 1.2 |
| Score Boost + hard difficulty | Per multiplier interaction rule resolved in 1.2 |

---

## Phase 2 — Architecture & State Design

**Objective:** Define all state machine extensions and data contracts. No code written.

### 2.1 Game State Machine Extension

Current top-level states: `idle | running | over`

Power-up sub-states (nested within `running`):

```
running
  ├── shield:     inactive | active
  └── scoreBoost: inactive | active | expiring
```

Rules:
- Sub-states are only valid while `state === 'running'`; both reset to `inactive` on transition to `over` or `idle`
- Sub-state transitions are triggered only by in-game collision events — never by external API calls, URL parameters, or global `window` property writes
- `expiring` is a visual-only sub-state for Score Boost countdown (≤ 3 s remaining); behaviour is identical to `active`

### 2.2 Power-Up Collectible Object Model

Each active collectible on the canvas carries:

| Field | Type | Description |
|---|---|---|
| `type` | `'shield' \| 'scoreBoost'` | Power-up identity |
| `x` | number | Current x position (moves left each frame) |
| `y` | number | Fixed y position (ground lane) |
| `width` | number | Hitbox width |
| `height` | number | Hitbox height |
| `collected` | boolean | Marked true on dino collision; removed from canvas next frame |

### 2.3 Spawn Design Contract

- Spawn is driven by an internal interval counter in the game loop — not by user input, URL params, or API responses
- Maximum one of each power-up type on canvas simultaneously
- Spawn y-position: ground lane (same as obstacles), or a fixed elevated lane — decided in Phase 1
- Spawn x-position: beyond canvas right edge (`x > W`)
- Spawn frequency per difficulty:

| Difficulty | Shield spawn interval | Score Boost spawn interval |
|---|---|---|
| Easy | More frequent (lower risk) | TBD |
| Medium | Standard | TBD |
| Hard | Less frequent | TBD |

Exact intervals to be confirmed as part of Phase 1 design sign-off.

### 2.4 Score Integrity Architecture

**The following constraint is a hard security gate — Score Boost cannot be merged until this is resolved.**

Current vulnerability: `POST /score/:value` accepts any integer. With Score Boost, a client could submit an inflated score as if Boost was active for longer than it was.

Two acceptable mitigations (choose one in Phase 1):

| Option | Description | Complexity |
|---|---|---|
| A — Server-side plausibility check | Server validates submitted score is ≤ max possible given elapsed game time and difficulty multiplier | Low — no client changes needed |
| B — Server-issued session token | On game start, server issues a signed token encoding start time and difficulty; client returns token with score submission; server validates | High — requires API schema change |

Option A is the recommended default given current architecture simplicity.

### 2.5 HUD Extension Design

- Power-up status area added to existing `#hud` strip
- Shield badge: binary visibility — `display:block` when active, `display:none` when inactive
- Score Boost: countdown number + label, visible only when active
- HUD additions must not alter `canvas` dimensions or disrupt existing score/highscore/difficulty elements
- All new HUD elements assigned `aria-label` attributes for Playwright targeting
- No new external dependencies (CSS-only styling)

---

## Phase 3 — Implementation Units (Handoff Contracts for UI Coding Agent)

**Objective:** Define discrete, independently implementable and testable units. Each unit is a formal handoff to the **T-Rex UI Coding Agent**.

| Unit | File | Description | Depends On |
|---|---|---|---|
| U1 | `game.js` | Power-up data model: types, state fields, timer variable | Nothing |
| U2 | `game.js` | Spawn logic: interval counter in game loop, push to collectibles array | U1 |
| U3 | `game.js` | Collision detection: AABB check between dino hitbox and each collectible | U2 |
| U4 | `game.js` | Shield activation/deactivation: state transition + collision override | U3 |
| U5 | `game.js` | Score Boost activation, timer decrement, expiry + score increment logic | U3 + Phase 1 design decisions |
| U6 | `index.html` | HUD indicators: shield badge + boost countdown elements | U4, U5 |
| U7 | `api/server.js` | Score validation hardening: reject out-of-range, `Infinity`, `NaN`, negative values | Independent |
| U8 | `game.js` | Canvas rendering: draw power-up sprites (SVG or canvas primitives) | U2 |

**Implementation order constraint:** U7 must be merged to the integration branch before U5 is merged. All other units may proceed in parallel after their declared dependencies.

---

## Phase 4 — Test Strategy

**Objective:** Full test pyramid covering state correctness, API security, E2E gameplay, and regression.

### 4.1 Unit / State Tests (Jest)

| Test Case | Assertion |
|---|---|
| Shield: `inactive → active` on collectible collision | State field equals `'active'` |
| Shield: `active → inactive` on obstacle collision | State field equals `'inactive'`; game does not end |
| Shield: no-op on second collection while active | State remains `'active'`; no reset |
| Shield: both `inactive` after game over | Sub-state reset on `state === 'over'` |
| Score Boost: `inactive → active` on collection | State field equals `'active'`; timer set to T |
| Score Boost: timer decrements per game tick | Timer value decreases by 1 each frame |
| Score Boost: `active → inactive` at timer = 0 | State equals `'inactive'`; score increment returns to base |
| Score Boost: score doubles exactly during active period | Score per tick equals base × 2 (or per agreed multiplier rule) |
| Score Boost: discarded on game over | Timer reset to 0; state `'inactive'` |
| Spawn: no spawn during `idle` or `over` states | Collectibles array empty when not `running` |
| Spawn: max one Shield on canvas at a time | Array contains at most one Shield object |

### 4.2 Integration Tests (API — `api/server.js`)

| Test Case | Expected Response |
|---|---|
| `POST /score/500` (valid integer) | `200 OK`; high score updated if higher |
| `POST /score/-1` (negative) | `400 Bad Request` |
| `POST /score/Infinity` | `400 Bad Request` |
| `POST /score/NaN` | `400 Bad Request` |
| `POST /score/abc` (non-numeric) | `400 Bad Request` |
| `POST /score/999999` (implausibly large) | `400 Bad Request` (if Option A plausibility check adopted) |
| `GET /score` after rejected posts | High score unchanged |

### 4.3 E2E Tests — Playwright (assigned to T-Rex Feature Testing Agent)

**New spec file:** `tests/powerups.spec.ts`

| Scenario | Risk | Key Assertion |
|---|---|---|
| Shield collectible renders on canvas | High | Canvas non-blank at expected position during play |
| Shield HUD badge appears on collection | High | `aria-label="shield-active"` element visible |
| Shield HUD badge disappears after absorption | High | Element becomes hidden after next obstacle hit |
| Obstacle + active Shield → game continues | High | `state` remains `'running'` |
| Obstacle + no Shield → game over | High | `state === 'over'` (regression guard) |
| Score Boost collectible renders on canvas | High | Canvas non-blank; distinct visual from Shield |
| Score Boost HUD countdown visible during active boost | High | `aria-label="score-boost-timer"` contains numeric value |
| Score increments at double rate during boost | High | Two score reads T ticks apart show 2× difference |
| Score returns to normal rate after boost expiry | Medium | Score rate equals base after countdown reaches 0 |
| High score persists correctly after boosted session | Medium | `GET /score` returns correct value post-game |
| No HUD layout shift from power-up elements | Medium | Existing score/highscore elements unchanged |

**Existing regression suite** (must pass unchanged):

- Jump interaction sets state to `running`
- Score progression monotonically non-decreasing
- Score resets to 0 after restart
- Shield state resets properly between games
- High score submission and retrieval

### 4.4 Test Execution Order (Blocking)

```
Unit Tests (Jest)
    │  ── any failure blocks ──▶ stop
    ▼
Integration Tests (API)
    │  ── any failure blocks ──▶ stop
    ▼
Playwright E2E — Regression Suite
    │  ── any failure blocks ──▶ stop
    ▼
Playwright E2E — Power-Up Suite
```

---

## Phase 5 — Security Considerations

**Objective:** Eliminate all exploit vectors introduced or exposed by power-up mechanics.

### 5.1 Threat Model

| Threat | Attack Vector | Mitigation | Phase |
|---|---|---|---|
| Score inflation via boosted submission | Client submits high score after boost expired | Server-side plausibility check (U7) | Phase 2 gate |
| Direct score injection via API | `POST /score/999999` from curl/devtools | Input validation: range + type check in `server.js` | U7 |
| Forced power-up activation via console | Write to `window.gameScore` or power-up state | Move power-up state to closure scope; remove from `window` | U1 |
| Spawn manipulation via devtools | Overwrite spawn interval on `window` | Do not expose spawn timer on global scope | U2 |
| Infinite shield via rapid collection | Two Shield objects spawned simultaneously | Max-one-per-type constraint in spawn logic | U2 |
| Score Boost replay attack | Resubmit a boosted score from a previous session | Server-side session plausibility or token validation | U7 |

### 5.2 OWASP Alignment

| OWASP Category | Applicable Risk | Required Control |
|---|---|---|
| A03 — Injection | `Number()` passes `Infinity`/`NaN` to score store | Explicit validation: `Number.isFinite()` + range check |
| A04 — Insecure Design | Score Boost multiplier trusted from client | Server applies/validates multiplier; client is never authoritative |
| A05 — Security Misconfiguration | `cors()` with no origin restriction | Scope CORS to known origin before any production deployment |
| A07 — Identification Failures | No session binding on score submission | Minimum: plausibility check; preferred: signed session token |

### 5.3 Security Quality Gates (Non-Negotiable)

| Gate | Condition to Pass |
|---|---|
| U7 merged before U5 | Score Boost code cannot be merged to integration branch until score validation is live |
| `npm audit` | Zero dependencies with CVSS ≥ 7.0 |
| Integration test suite | All API rejection cases return `400`; no bypass path |
| No global power-up state | `window` object does not expose power-up activation state or spawn timers |

---

## Phase 6 — CI/CD Validation Gates

**Objective:** Pipeline enforces all quality and security gates; no unsafe or failing change reaches `main`.

### 6.1 Pipeline Stages

```
Push / Pull Request
  │
  ├── Gate 1: npm audit
  │     Rule:   CVSS ≥ 7.0 → hard block
  │     Owner:  Trex DevOps Agent
  │
  ├── Gate 2: Unit Tests (Jest)
  │     Rule:   Any failure → hard block
  │     Covers: State machine, timer, spawn guards
  │     Owner:  Trex DevOps Agent
  │
  ├── Gate 3: Integration Tests (API)
  │     Rule:   Any score validation bypass → hard block
  │     Covers: Rejection of invalid/inflated score inputs
  │     Owner:  Trex DevOps Agent
  │
  ├── Gate 4: Playwright E2E — Regression Suite
  │     Rule:   Any pre-existing test failure → hard block
  │     Policy: Retry once; second failure is permanent block
  │     Owner:  T-Rex Feature Testing Agent
  │
  ├── Gate 5: Playwright E2E — Power-Up Suite
  │     Rule:   Any new power-up scenario failure → hard block
  │     Policy: Retry once; second failure is permanent block
  │     Owner:  T-Rex Feature Testing Agent
  │
  └── Gate 6: PR Review
        Rule:   Team lead approval required for merge to main
        Owner:  Human reviewer
```

### 6.2 Branch Strategy

| Branch | Purpose | Merge Condition |
|---|---|---|
| `feature/shield-powerup` | U1–U4, U6, U8 | Gates 1–5 green |
| `feature/score-validation` | U7 (security hardening) | Gates 1–3 green; merges to integration first |
| `feature/score-boost-powerup` | U5, U6 update | Gates 1–5 green **and** `feature/score-validation` already merged |
| `TCSDemoSession4` | Integration branch | Full regression green across all merged features |
| `main` | Production | Gates 1–6; PR review |

### 6.3 Merge Order Enforcement

`feature/score-validation` → integration branch → `feature/score-boost-powerup` begins.

This is enforced by a branch protection rule requiring the security integration test suite to be green before any Score Boost PR is opened.

---

## Agent Responsibility Matrix

| Agent | Phase(s) | Responsibilities |
|---|---|---|
| **T-Rex Power-Up Plan Agent** | 1–2 | Produce this plan; drive Phase 1 design decisions; maintain risk register |
| **T-Rex UI Coding Agent** | 3 | Implement U1–U8 in `game.js` and `index.html` per handoff contracts |
| **T-Rex Feature Testing Agent** | 4 | Author and validate all Playwright E2E tests for power-up scenarios and regression |
| **Trex DevOps Agent** | 6 | Wire Jest and Playwright stages into CI/CD; enforce branch protection rules; configure `npm audit` gate |

---

## Risk Register

| Risk ID | Risk | Likelihood | Impact | Status | Mitigation |
|---|---|---|---|---|---|
| R1 | Score Boost × hard-mode multiplier interaction undefined | High | High | **Open — blocking Phase 2** | Resolve as design decision in Phase 1 |
| R2 | Server score endpoint exploitable before Score Boost ships | High | High | **Open** | U7 must merge before U5 |
| R3 | `window.gameScore` globally mutable | Medium | High | Open | Move power-up state to closure scope in U1 |
| R4 | HUD changes shift canvas layout | Medium | Medium | Open | Visual regression snapshot assertion in E2E suite |
| R5 | Power-up spawns during `over` state | Medium | Medium | Open | State guard in U2; unit test required |
| R6 | E2E flakiness on timer-based assertions | Medium | Low | Open | Use deterministic tick-mock in unit tests; E2E asserts state not exact timing |
| R7 | Score Boost stacking rule undefined | Medium | Medium | **Open — blocking Phase 2** | Resolve as design decision in Phase 1 |
| R8 | CORS misconfiguration exposed to production | Low | High | Open | Scope `cors()` origin before any public deployment |

---

## Quality Gates Summary

| Gate | Type | Blocks | Owner |
|---|---|---|---|
| Phase 1 design decisions documented and signed off | Manual review | All Phase 2+ work | Plan Agent + team |
| Score multiplier interaction rule defined | Design decision | Score Boost implementation | Plan Agent |
| U7 score validation merged | Security | Score Boost (U5) merge | DevOps Agent |
| `npm audit` zero high/critical vulnerabilities | Automated | PR merge | DevOps Agent |
| Unit tests: all state transitions covered | Automated | PR merge | DevOps Agent |
| Integration tests: all API rejection cases pass | Automated | PR merge | DevOps Agent |
| E2E regression suite: zero failures | Automated | PR merge | Feature Testing Agent |
| E2E power-up suite: all scenarios pass | Automated | PR merge | Feature Testing Agent |
| PR review by team lead | Manual | Merge to `main` | Human reviewer |

---

## Sequencing & Dependencies

```
Phase 1 — Design Contracts (blocking gate for everything below)
     │
     ├── Phase 2 — Architecture & State Design
     │       │
     │       ├── U1 Power-up data model
     │       ├── U2 Spawn logic            ─┐
     │       ├── U3 Collision detection     │ parallel
     │       └── U7 Score validation ──────┤ U7 must merge before U5
     │                                      │
     │       U4 Shield logic (needs U3)    ─┤
     │       U8 Sprite rendering (needs U2) │
     │       U5 Score Boost (needs U3+U7)  ─┘
     │       U6 HUD indicators (needs U4+U5)
     │
     ├── Phase 4 — Tests (needs U1–U8 complete)
     │
     └── Phase 6 — CI/CD wiring (needs Phase 4 test files)
```

---

## Scope Boundaries

**In scope:** Shield power-up, Score Boost power-up, server-side score validation hardening, HUD indicators, unit/integration/E2E tests, CI/CD gate configuration.

**Out of scope:** Additional power-up types beyond Shield and Score Boost, per-power-up leaderboard tracking, server-side spawn authority, mobile touch target changes, power-up persistence across sessions, animated power-up transitions (deferred to future iteration).


---

## Phase 1 — Feature Scoping & Difficulty Profile Definition

**Objective:** Define the precise parameter values for each difficulty and lock the feature contract before any implementation begins.

**Activities:**
- Define the three difficulty profiles as a configuration contract:

| Parameter | Easy | Medium (current) | Hard |
|---|---|---|---|
| Obstacle speed (px/frame) | 4 | 6 | 9 |
| Obstacle respawn gap (px beyond W) | 250–450 | 0–200 | 0–100 |
| Score multiplier | ×1 | ×1 | ×2 |
| Cloud/bird speed scale | ×0.6 | ×1 | ×1.4 |

- Confirm **Medium** exactly matches current behaviour (backward compatibility requirement)
- Define session persistence scope: difficulty held in `window.selectedDifficulty`, reset only on page reload — **not** persisted to the API
- Confirm the selector is locked (disabled) once `startGame()` is called and re-enabled on game over

**Quality Gate:** Difficulty profile table signed off. Medium profile numerically matches current hardcoded values. No API schema changes required.

**Expected Outcome:** Unambiguous feature contract. Developers, QEs, and the pipeline agent all work from the same parameter table.

---

## Phase 2 — UI Design & DOM Changes

**Objective:** Define all changes to `ui/index.html` needed to surface difficulty selection without disrupting existing layout.

**Activities:**
- Add a difficulty selector control (three radio buttons or a `<select>` dropdown) to the `#controls` section in `index.html`, positioned above the Start button
- Assign accessible `aria-label` attributes to each option for Playwright test targeting:
  - Container: `aria-label="difficulty-selector"`
  - Options: `aria-label="difficulty-easy"`, `aria-label="difficulty-medium"`, `aria-label="difficulty-hard"`
- Set **Medium** as the default selected value to preserve current out-of-the-box behaviour
- Add a `#difficulty-display` element to the `#hud` strip to show the active difficulty during play
- The selector must be visually disabled (greyed out) while `state === 'running'` and re-enabled on `state === 'over'`

**Quality Gate:** DOM structure reviewed against existing `#hud`, `#controls`, and `#game-wrapper` layout. All new elements have `aria-label` attributes. No existing element IDs or `aria-label` values changed (test selector stability).

**Expected Outcome:** Minimal, non-breaking UI addition. All new elements are immediately targetable by Playwright without additional selectors or workarounds.

---

## Phase 3 — Gameplay Logic Impact Assessment

**Objective:** Identify every line in `game.js` that must change and define the change precisely — without ambiguity for the implementing developer.

**Affected areas in `ui/game.js`:**

| Location | Current Code | Change Required |
|---|---|---|
| `loop()` — obstacle move | `obsX -= 6` | Replace `6` with `diffConfig.obsSpeed` |
| `loop()` — obstacle reset | `Math.random()*200` | Replace with `diffConfig.obsGapMin + Math.random()*diffConfig.obsGapRange` |
| `loop()` — stripe scroll | `stripeOffset + 6` | Replace `6` with `diffConfig.obsSpeed` (stripes match ground speed) |
| `loop()` — score increment | `score++` | Replace with `score += diffConfig.scoreMultiplier` |
| Cloud speed values | Individual `speed` properties | Multiply each by `diffConfig.cloudSpeedScale` at `startGame()` |
| Bird speed values | Individual `speed` properties | Multiply each by `diffConfig.cloudSpeedScale` at `startGame()` |
| `startGame()` | Reads no config today | Must read `window.selectedDifficulty` and resolve `diffConfig` before resetting loop variables |

**New additions (no existing code deleted):**
- A `DIFFICULTY_PROFILES` constant object at the top of `game.js` mapping `'easy' | 'medium' | 'hard'` → parameter sets
- `window.selectedDifficulty` initialised to `'medium'` on page load, updated by the selector's `change` event
- A `getDiffConfig()` helper that returns the active profile — called once in `startGame()`

**Backward compatibility check:** With the selector defaulting to Medium and `DIFFICULTY_PROFILES.medium` matching current hardcoded values exactly, existing behaviour is preserved for users who never interact with the selector.

**Quality Gate:** Every hardcoded value identified above is replaced. No magic numbers remain in the loop. `DIFFICULTY_PROFILES.medium` values numerically match the current constants before removal.

**Expected Outcome:** Clean, parameterised game loop. Difficulty profiles are declarative and independently testable.

---

## Phase 4 — Testing Strategy

**Objective:** Validate all three difficulty paths, the selector UI, backward compatibility, and regression of existing gameplay — automatically.

### Unit Tests (Jest)

| Scenario | Assertion |
|---|---|
| `DIFFICULTY_PROFILES.easy` returns correct speed and gap values | Values match the agreed profile table |
| `DIFFICULTY_PROFILES.medium` matches former hardcoded constants | Speed = 6, gap range = 0–200, multiplier = 1 |
| `DIFFICULTY_PROFILES.hard` returns correct values | Speed = 9, gap range = 0–100, multiplier = 2 |
| `getDiffConfig('invalid')` falls back to medium | Returns medium profile without throwing |

### E2E Tests (Playwright) — new spec file: `tests/difficulty-levels.spec.ts`

| Scenario | Risk Level | Key Assertion |
|---|---|---|
| Difficulty selector is visible and defaults to Medium on page load | High | `aria-label="difficulty-medium"` is checked by default |
| Selecting Easy before start changes `window.selectedDifficulty` | High | `page.evaluate(() => window.selectedDifficulty) === 'easy'` |
| Selector is disabled once game starts | Medium | `aria-label="difficulty-selector"` has `disabled` attribute during `state=running` |
| Selector re-enables after game over | Medium | Attribute removed after collision |
| Active difficulty label is shown in HUD during play | Medium | `#difficulty-display` text matches selected level |
| Game starts and runs without error on all three difficulties | High | No console errors; `window.gameScore` increments on each level |
| Score increments at ×2 on Hard | High | After 1 obstacle cleared on Hard, `window.gameScore === 2` |

### Regression Tests (existing suite must still pass)

- All existing `game-start.spec.ts`, `score-submission.spec.ts`, `high-score.spec.ts` tests pass unchanged
- Default (Medium) gameplay produces identical behaviour to pre-feature baseline

**Quality Gate:**
- All new unit tests pass
- All new E2E scenarios pass in headless mode
- Zero regressions in existing Playwright suite
- `window.selectedDifficulty` is readable by tests (confirms `game.js` exposes it on `window`)

**Expected Outcome:** Every difficulty path is automatically validated. Regression is proven, not assumed. QE manual effort = exploratory edge cases only.

---

