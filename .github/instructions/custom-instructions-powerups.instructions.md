---
description: Powerup development rules, testing rules, and security rules for the T-Rex Runner game.
applyTo:  '**/**' 
---
## Power-Up Development Rules
- Power-ups must be time-bound or event-bound
- Core physics must not be modified
- Power-up state must be externally observable for testing

## Testing Rules
- Expose power-up state via window.activePowerUps
- Tests must validate activation and expiry
- Avoid visual-only assertions

## Security Rules
- Power-ups must not manipulate scores directly
- Backend score validation must remain authoritative
🎙️ Explain:
“This prevents Copilot from accidentally breaking core gameplay.”
