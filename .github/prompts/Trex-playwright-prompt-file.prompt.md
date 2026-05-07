---
name: Trex-playwright-prompt-file
description: Describe when to use this prompt
---
  
When generating Playwright tests:

- Always read power-up state via window.activePowerUps
- Do not interact with canvas elements directly
- Validate:
  - Pickup detection
  - Activation timing
  - Expiry behavior
  - Impact on score or collisions
- Ensure tests are deterministic

Output TypeScript Playwright tests only.
