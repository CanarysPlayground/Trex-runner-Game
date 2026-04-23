The game currently supports:
- Difficulty levels (Easy / Medium / Hard)
- Obstacle avoidance gameplay
- Score tracking and persistence

As engagement grows, users expect dynamic gameplay elements
that reward skill and introduce strategic decision-making.

## New Feature Requirement – Power-Ups System

### Feature Description
Introduce collectible power-ups during gameplay.

Two power-ups will be supported initially:
1. Speed Boost – temporarily increases game speed and score rate
2. Shield – temporarily protects the player from one obstacle collision

Power-ups should:
- Appear randomly during gameplay
- Be visually identifiable
- Apply effects for a limited duration
- Be reflected in the HUD

## Business Problem
- Gameplay becomes repetitive over time
- No short-term rewards for skilled play
- No dynamic variation within a single run

## Business Objectives
The organization wants to:
1. Increase gameplay engagement
2. Introduce time-bound state changes
3. Validate complex state handling via automation
4. Demonstrate feature delivery using AI across the SDLC

## Non-Functional Requirements
- Power-ups must not break existing gameplay
- Effects must expire cleanly
- UI changes should remain minimal
- Feature must be fully testable via automation

## Success Criteria
- Power-ups spawn and can be collected
- Effects apply and expire correctly
- HUD reflects active power-ups
- Automated tests validate all behaviors
- CI/CD validates feature on every change
