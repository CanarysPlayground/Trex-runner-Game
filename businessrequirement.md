# Business Requirements – Dynamic Terrain Switching

## Business Context
The T Rex Runner currently supports:
- Dino gameplay
- Bird and cactus obstacles
- Power-ups
- High score API
- Start/restart functionality

The product team now wants gameplay variety
without introducing additional power-up mechanics.

## Business Requirement
When the player reaches 5 points
while playing in Easy Mode:
- Terrain should dynamically switch
- Background visuals should change
- Gameplay should continue seamlessly

## Functional Requirements
- Terrain switch triggers at score >= 5
- Applies only in Easy Mode
- Terrain changes from Desert → Ice
- Existing obstacles continue functioning
- No page reload allowed

## Non Functional Requirements
- No FPS degradation
- Existing gameplay logic must remain stable
- Feature must be testable automatically

## Success Criteria
- Terrain changes automatically at 5 points
- No gameplay interruption
- Automated tests validate switching
- CI pipeline validates feature
