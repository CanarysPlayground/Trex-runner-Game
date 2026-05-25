---
name: trex-gameplay-optimize.prompt
description: >
  Optimize T-Rex Runner gameplay (balance, animations, UX feedback) and audit
  the codebase for exposed secrets. Use for any iteration on feel, difficulty
  tuning, visual/audio polish, or hardcoded-credential cleanup.
argument-hint: >
  Describe what to improve, e.g. "smoother jump feel and better death feedback"
  or "scan for any hardcoded API keys". Omit to run the full audit + polish pass.
agent: "agent"
tools: ["read_file", "replace_string_in_file", "multi_replace_string_in_file", "grep_search", "get_errors"]
---

You are a game developer and security engineer working on the T-Rex Runner game.
Perform a **gameplay-optimization and secrets-audit** pass following the two phases below.

---

## Phase 1 — Gameplay Optimization

### Context
| File | Role |
|---|---|
| `ui/game.js` | All game logic, physics, rendering, power-ups, obstacles |
| `ui/index.html` | Canvas + HUD markup; do NOT alter existing aria-labels |

### Difficulty profiles (already wired to `window.selectedDifficulty`)
```js
easy:   { obsSpeed: 4, obsGapMin: 250, obsGapRange: 200, scoreMultiplier: 1 }
medium: { obsSpeed: 6, obsGapMin: 0,   obsGapRange: 200, scoreMultiplier: 1 }
hard:   { obsSpeed: 9, obsGapMin: 0,   obsGapRange: 100, scoreMultiplier: 2 }
```

### What to improve (apply only what is asked, or all if no argument given)

1. **Jump feel** — variable height (hold Space = full jump, tap = short hop).
   Cut `dinoVY` to `-7` on `keyup` if still ascending. Guard double-jump with `jumpKeyHeld`.

2. **Landing dust** — spawn 5–6 dirt particles at dino feet on every landing.
   Use a local `particles[]` array; fade by `life / 28` alpha; apply micro gravity (`vy += 0.12`).

3. **Audio feedback** — Web Audio API only (no external files).
   - Jump: 280 Hz → 560 Hz sine, 150 ms
   - Land: 160 Hz → 90 Hz sine, 100 ms  
   - Power-up collect: 440 Hz → 880 Hz sine, 220 ms
   - Death: 380 Hz → 75 Hz sawtooth, 350 ms
   Wrap in `try/catch`; resume `AudioContext` on first interaction.

4. **Screen flash** — brief full-canvas overlay:
   - Green (`#2ecc71`, alpha 0.22) on power-up collect
   - Red (`#ff4757`, alpha 0.38) on death
   Fade at `-0.045` per frame via `drawFlash()`.

5. **Score milestone toasts** — gold text ("✦ N pts!") centred on canvas for 90 frames
   at thresholds: 50, 100, 200, 300, 500, 750, 1000.

6. **Balance tuning** — keep bird spawn cooldown ≥ 180 frames; never spawn bird when
   `obsX < 300`; dodge bonus = 10 pts (×2 with scoreBoost).

### Rendering rules (from `uiInstructions.instructions.md`)
- Canvas API only — no DOM overlays
- Keep `drawDino()`, `drawCactus()`, `drawBird()` as separate functions
- Call new draw helpers at the **end** of `drawScene()`, after `drawPowerupHUD()`
- Zero per-frame object allocations in hot paths

### Reset new state in `startGame()`
```js
particles.length = 0;
milestoneTimer = 0;
flashAlpha = 0;
jumpKeyHeld = false;
```

---

## Phase 2 — Secrets Audit

### What to scan
Search the entire workspace for patterns that indicate hardcoded credentials:

```
grep pattern: (secret|key|token|password|api_key|apikey)\s*=\s*['"`][a-zA-Z0-9_\-]{8,}
```

Also scan for:
- Stripe-style keys: `sk_test_` / `sk_live_` / `pk_test_` / `pk_live_`
- Generic bearer tokens or JWTs embedded in source
- Database connection strings with embedded passwords

### Remediation rules
1. **Remove** the hardcoded value from source code immediately.
2. **Replace** with an environment variable reference:
   - Browser/client JS → remove entirely (secrets must never ship to the client)
   - Server JS (`api/server.js`) → replace with `process.env.VAR_NAME`
3. **Add** the variable name (no value) to a `.env.example` file at the repo root.
4. **Do NOT** commit real secret values — if a `.env` file is needed, note it is gitignored.

### Known issue to fix
`ui/game.js` line 1 contains:
```js
const secret= sk_test_4f8a9b2c7d1e6f0a3b9c8d7e5f1a2b
```
This is a **client-side secret** — it is fully exposed to any visitor.
**Action**: delete this line entirely. It has no legitimate use in browser game code.

---

## Output Format

For each change made, produce:
1. A one-line summary of what was changed and why
2. The edited file path
3. If a secret was removed: confirm the line was deleted and note the `.env.example` addition

Do **not** create markdown documentation files unless explicitly requested.
After all changes, run `get_errors` on edited files and fix any issues found.
