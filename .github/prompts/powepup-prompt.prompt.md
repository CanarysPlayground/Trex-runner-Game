---
name: powerup-implementation
description: "Implement power-ups in the T-Rex Runner game. Use when adding new gameplay features that enhance player abilities without altering core mechanics or physics."
model: gemini-2.5-pro

---
# Power-Up Implementation Prompt
When adding power-ups:

- Only in Easy Mode
- Activate at score >= 5
- Use window.activePowerUps
- Include:
  - shield
  - slow motion

Constraints:
- No physics changes
- No DOM scraping
- Keep modular

Output:
- Minimal JS changes
