---
name: Power-Up Feature Instructions
description: Custom instructions for implementing and testing power-up features in the T-Rex Runner game.
applyTo: "ui/game.js,ui/index.html,api/server.js,api/**/*.test.js"
---

# T-Rex Runner — Power-Up Feature Specification

## Overview

Power-ups are collectible items that appear on the road during gameplay. The dino automatically collects a power-up by running into it (no jump required). Each power-up provides a timed benefit.

---

## Power-Up Types

| ID | Name | Icon | Colour | Duration | Effect |
|----|------|------|--------|----------|--------|
| `shield` | Shield | 🛡️ | Blue (`#4dabf7`) | 5 seconds | Absorbs one fatal collision with a cactus |
| `boost` | Speed Boost | ⚡ | Yellow (`#ffd43b`) | 6 seconds | Doubles the score increment per cactus passed |
| `slow` | Slow-Mo | ⏱️ | Purple (`#cc5de8`) | 5 seconds | Halves obstacle speed |

---

## Spawn Rules

- A power-up spawns after every **5 cacti** passed (score multiples of 5).
- Only **one** power-up can be active on screen at a time.
- Power-ups appear at `y = GROUND` (same ground level as the dino).
- Power-up type is selected randomly each spawn.
- Power-ups move left at obstacle speed.
- If a power-up exits left without being collected it is discarded; next spawn at the next multiple-of-5 score.

---

## Collision / Collection

- **Collection box (AABB):** power-up `x` range ±20 px, `y` range `GROUND-30` to `GROUND`.
- On collection: activate the power-up effect, remove from screen, start countdown timer.
- Only one power-up effect can be active at a time; collecting a new one replaces the old one.

---

## Power-Up Effects

### Shield (`shield`)
- Sets `window.powerUp.active = 'shield'`.
- On the next cactus collision that would normally trigger `gameOver()`:
  - Cancel the game-over.
  - Remove the shield.
  - Flash the dino briefly (3 red frames).
- If the shield timer expires before absorbing a hit, it deactivates normally.

### Speed Boost (`boost`)
- Sets `window.powerUp.active = 'boost'`.
- While active: each cactus passed increments score by **2** instead of **1**.
- Visual: a yellow aura ring around the dino.

### Slow-Mo (`slow`)
- Sets `window.powerUp.active = 'slow'`.
- While active: obstacle X movement is `obsSpeed * 0.5` instead of `obsSpeed`.
- Visual: a purple time-distortion ripple behind the dino.

---

## HUD

- Add a `<span id="powerup-status" aria-label="powerup-status">` element to the HUD row in `index.html`.
- While a power-up is active display: `[Icon] [Name] [Xs]` — e.g. `🛡️ Shield 4s`.
- When no power-up is active, the element is empty or shows `—`.

---

## API Extensions

No new API endpoints are required for the initial power-up implementation. The existing `POST /score/:value` and `GET /score` endpoints remain unchanged.

Future iteration (out of scope): add `POST /powerup/:type` to log power-up usage per session.

---

## Test Requirements

### Unit Tests (`api/server.test.js`)

Cover the following scenarios with Jest + supertest:

**Happy Path**
- `GET /score` returns `{ highScore: 0 }` on startup.
- `POST /score/100` sets highScore to 100 and returns `{ highScore: 100 }`.
- `POST /score/50` does NOT lower highScore; returns `{ highScore: 100 }`.
- `GET /score` after POST returns the updated value.

**Edge Cases**
- `POST /score/0` — not greater than 0, no update.
- `POST /score/-1` — negative value rejected, no update.
- `POST /score/NaN` (non-numeric string `abc`) — handles gracefully, no crash.
- `POST /score/99999999` — very large number, sets highScore correctly.
- Two rapid POSTs: `/score/200` then `/score/150` — highScore stays 200.

**Isolation**: use `beforeEach` to call the exported `reset()` function between tests.

---

## Window Globals (for Playwright tests)

```js
window.powerUp = {
  active: null,       // 'shield' | 'boost' | 'slow' | null
  timeLeft: 0,        // seconds remaining
};
```

These globals allow Playwright tests to assert power-up state via `page.evaluate`.
