## Plan: Power-Ups SDLC Execution Plan — T-Rex Runner

**TL;DR:** Introduce Speed Boost and Shield power-ups across 5 sequenced phases — state model → gameplay logic → HUD → testing → CI/CD. Each phase has explicit dependencies and risk callouts based on the current codebase structure.

---

### Phase 1 — Game State & Data Model *(foundation; unblocks all phases)*

1. Define `activePowerUp` state object: `{ type: null | 'speedBoost' | 'shield', expiresAtTick: null }`
2. Define power-up spawn entity: `{ x, y, type, active }` with spawn probability constants and minimum cactus-gap guard
3. Define duration constants: `SPEED_BOOST_DURATION_TICKS`, `SHIELD_DURATION_TICKS`

**Risk:** `obsSpeed` is read directly from `DIFFICULTY_PROFILES` on every tick — a `tempSpeedMultiplier` variable must be introduced rather than mutating the profile object, or the boost would persist across restarts.

**Files:** `ui/game.js` top-level state block (~line 22)

---

### Phase 2 — Gameplay Logic Changes *(depends on Phase 1)*

4. **Spawn logic** — After cactus resets, probabilistically spawn a power-up; include distance guard to prevent overlap with obstacle
5. **Collection** — AABB check in `loop()` between dino bbox and power-up bbox; on hit → activate effect, mark collected
6. **Speed Boost effect** — Multiply effective `obsSpeed` and `scoreMultiplier` by `tempSpeedMultiplier` during active window
7. **Shield effect** — In the collision block: if `shieldActive` is `true`, absorb collision (flash visual), clear shield; do not call `gameOver()`
8. **Expiry** — Each tick check `activePowerUp.expiresAtTick <= tick`; reset speed multiplier or shield flag; clear HUD
9. **Restart reset** — `startGame()` must explicitly zero all power-up state

**Risks:**
- Speed Boost × Hard difficulty can overdrive the game; cap effective speed at a defined maximum
- Shield flash visual must use a canvas rect overlay — no new image assets needed
- `gameOver()` path must remain unmodified when shield is inactive (existing regression risk)

---

### Phase 3 — UI / HUD Changes *(parallel with Phase 2 HTML/CSS; wired after Phase 2 logic)*

10. Add `#powerup-status` span to `#hud` in `index.html` (between `#status` and `#difficulty-display`)
11. Speed Boost active → text: "⚡ Speed Boost: Ns" countdown; Shield active → "🛡 Shield: ACTIVE"
12. Expiry / no power-up → clear text or "—"
13. In-canvas secondary indicator: small colored rect near dino in `drawScene()` (no asset required)

**Risk:** `#status` uses `flex:1` — new HUD span must not absorb flex-grow; verify layout at 500px breakpoint

**Files:** `ui/index.html` `#hud`, `ui/game.js` `drawScene()`

---

### Phase 4 — Testing Strategy *(depends on Phases 2 & 3)*

| Layer | What to test |
|---|---|
| State / unit-equiv | Power-up spawns; collection sets `window.activePowerUp`; expiry resets state; restart clears state |
| Speed Boost | Effective speed increases during active window; normalises after expiry |
| Shield | Collision absorbed (no `gameOver`) when active; `gameOver` fires on next hit |
| HUD integration | Correct text shown/hidden for each state transition |
| Regression | Existing difficulty levels, score increment, high-score API unaffected |
| Edge cases | Two consecutive power-ups; shield absorption then death; Speed Boost at Hard difficulty |

**Approach:** Use `window.*` to expose `activePowerUp` and `powerUpEntity` for programmatic assertion in Playwright tests (`page.evaluate`). Advance ticks programmatically — do **not** use `setTimeout`-based waits (flaky on CI).

**Risk:** `scripts.test` in `package.json` is currently a no-op `echo`; must be wired to `npx playwright test` before CI can enforce gates.

---

### Phase 5 — CI/CD Implications *(depends on Phase 4)*

14. Update `package.json#scripts.test` → `npx playwright test`
15. Add CI pipeline stages: `install` → `test` (power-up + regression suite) → `deploy`
16. PR merge to `main` blocked on: all power-up tests green + full regression green
17. API smoke test (`GET /score`) stays in pipeline; `server.js` is not modified

**Risk — flaky timing:** Power-up duration is tick-counted, not wall-clock. Tests must drive state via `page.evaluate` loops, not `page.waitForTimeout`. Tests relying on real animation frames will fail non-deterministically in headless CI.

---

### Sequencing Summary

```
Phase 1 (State Model)
    └─► Phase 2 (Gameplay Logic)
            ├─► Phase 3 (HUD wiring — HTML/CSS parallel earlier, JS wired here)
            └─► Phase 4 (Tests — requires exposed window state)
                    └─► Phase 5 (CI/CD gate wiring)
```

---

### Scope Boundaries
- **In:** Speed Boost, Shield, HUD indicators, Playwright test suite, CI gate for `main`
- **Out:** Power-up stats persisted to API, sound effects, mobile touch collection, stacking multiple power-ups
- **Assumptions:** One active power-up at a time; duration in ticks for determinism; icons rendered as canvas primitives (no new assets)
