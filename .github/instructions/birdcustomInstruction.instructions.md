---
description: Load this for all Trex Runner tasks involving new feature development, especially obstacles like birds
# applyTo: "/ui/.js, **/api/.js, /tests/*.ts"
---

# Project Context — T-Rex Runner Game

## Architecture Overview
- Frontend: HTML5 Canvas + Vanilla JS
- Backend: Node.js + Express
- Communication: REST (fetch API)
- State:
  - Client → gameplay logic
  - Server → high score persistence

## Current Game Behavior
- Dinosaur runs continuously
- Obstacles: cactus (ground only)
- Power-ups: shield, scoreBoost
- Collision logic: AABB detection

## New Feature: Bird Obstacle
- Bird should act as a moving airborne obstacle
- Requires:
  - New rendering logic (canvas)
  - New spawn pattern
  - Collision detection (air + ground interaction)

## Coding Guidelines

### General
- Keep all logic in ui/game.js (single file constraint)
- No external libraries
- Keep functions modular and readable

### Naming
- Use meaningful names:
  - birdX, birdY, birdSpeed
  - spawnBird(), drawBird()

### Performance
- Reuse existing animation loop
- Avoid heavy object allocation per frame

### Collision
- Follow existing AABB model
- Dino hitbox must work for:
  - jumping
  - grounded state

### UI Behavior
- Do NOT break:
  - power-ups
  - scoring
  - cactus logic

## Testing Guidelines
- Expose test hooks on window
- Keep deterministic behavior for Playwright

## Constraints
- No backend changes required
- No database persistence for bird state
