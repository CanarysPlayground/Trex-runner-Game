---
description: Apply when implementing or modifying UI game logic including canvas rendering or obstacles
# applyTo: "ui/game.js"
---

# UI Development Guidelines

## Rendering Principles
- Use Canvas API only
- Maintain 60 FPS (avoid blocking logic)
- Keep drawing functions separate:
  - drawDino()
  - drawCactus()
  - drawBird()

## Bird Rendering Rules
- Bird must:
  - Fly at variable Y positions
  - Animate wings (simple sine or frame change)
  - Move left like cactus

## Physics Compatibility
- Ensure bird collision works when:
  - Dino is jumping
  - Dino is grounded

## Spawn Logic
- Maintain randomness:
  - Do NOT overlap cactus and bird unfairly
- Spawn spacing must feel playable

## Collision Priority
1. Shield absorbs collision
2. Then check bird hit
3. Then cactus hit

## HUD
- Do NOT modify existing HUD layout
- Only update status if needed

## Code Style
- Small reusable functions
- No deeply nested logic
- Use constants for tuning
