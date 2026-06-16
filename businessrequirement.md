# Business Requirements – Power-Ups (Easy Mode)

## Business Context
The T-Rex Runner game currently lacks dynamic gameplay elements.

## Business Requirement
Introduce power-ups in Easy Mode only.

## Functional Requirements
- Activate when score >= 5
- Only in Easy Mode
- Types:
  - Shield → absorbs 1 collision
  - Slow Motion → reduces speed temporarily

## Non Functional Requirements
- Do not modify core physics
- Must be testable
- No FPS drop

## Success Criteria
- Power-ups activate correctly
- Expire correctly
- No regression in gameplay
