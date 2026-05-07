## Business Context
The T-Rex Runner game has stable core gameplay but limited
feature differentiation.

To increase engagement, power-up mechanics need to be introduced
without degrading stability, performance, or security.

## Business Problem
- No temporary gameplay modifiers
- Feature changes risk regression
- No automated validation for new mechanics

## Business Objectives
- Introduce collectible power-ups
- Ensure predictable activation and expiry
- Validate power-up behavior via automation
- Prevent security or score manipulation risks

## Initial Power-Ups Scope
- Shield: Prevents one collision
- Score Boost: Doubles score for limited time

## Success Criteria
- Power-ups activate and expire correctly
- Gameplay remains stable
- Tests validate power-up behavior
- CI/CD blocks insecure or failing changes
