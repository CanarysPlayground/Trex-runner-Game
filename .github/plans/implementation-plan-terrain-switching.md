# Technical Implementation Plan: Dynamic Terrain Switching (Desert → Ice)

**Status**: Ready for Sprint 2 Implementation  
**Aligned with**: 4-Sprint Business Plan  
**Requirement**: Score >= 5 in Easy Mode triggers terrain switch  

---

## 1. Feature Decomposition

### Score Trigger Mechanism
- **Condition**: `score >= 5` AND `difficulty === 'easy'`
- **One-Way Switch**: Once Desert → Ice, remains Ice until game over
- **Restart Behavior**: Restart resets terrain to Desert

### Easy Mode Condition Validation
- Easy Mode guard checked during terrain trigger evaluation
- Changing difficulty DURING gameplay resets terrain to Desert
- If player switches to Medium/Hard while score > 5, terrain reverts to Desert

### Terrain State Transition Logic
- **State Machine**: Two states (Desert, Ice)
- **Trigger Check**: Occurs every frame in main game loop
- **Single Transition**: Only triggers once per game session
- **No Re-triggers**: `terrainSwitchTriggered` flag prevents duplicate transitions

---

## 2. UI Update Strategy

### Canvas Rendering Approach
**Decision**: Pure canvas rendering (no DOM/CSS changes)
- Modify existing `drawSky()`, `drawGround()`, `drawClouds()` functions
- Accept `terrain` parameter to conditionally select color palettes
- No performance overhead (colors computed at function entry)

### Color Palettes

#### Desert Theme
```javascript
{
  skyGradient: ['#5ba3d9', '#acd8f0', '#d4ecfb'],
  groundColor: '#c8a96e',
  roadColor: '#7a7a7a',
  cloudColor: 'rgba(255,255,255,0.92)',
  stripeColor: '#ffff99'
}
```

#### Ice Theme
```javascript
{
  skyGradient: ['#87ceeb', '#b3d9e8', '#d8f0ff'],  // Cooler blues
  groundColor: '#e8f4f8',                          // Icy white
  roadColor: '#a0c8d8',                            // Frozen road
  cloudColor: 'rgba(240,248,255,0.95)',            // Brighter clouds
  stripeColor: '#66bbff'                           // Icy stripes
}
```

### Visual Transition Mechanics
- **Transition Type**: Immediate (no animation)
- **Frame Render**: Canvas redraws with new colors on next frame (~16ms)
- **User Perception**: Seamless, no stutter or flicker
- **Performance**: No extra draw calls or allocations

---

## 3. State Management Plan

### Terrain State Variables
```javascript
// Add to game state at initialization:
let terrain = 'desert';                // 'desert' | 'ice'
let terrainSwitchTriggered = false;    // Prevents duplicate triggers
let terrainSwitchScore = -1;           // Score at which switch occurred
```

### Observer Pattern for Score Updates
```javascript
// Read-only observer: no modification to existing score logic
function onScoreUpdate(newScore) {
  if (state === 'running' && selectedDifficulty === 'easy') {
    if (newScore >= 5 && !terrainSwitchTriggered) {
      checkAndApplyTerrainSwitch(newScore);
    }
  }
}

// Hook this into existing score increment logic
// WITHOUT modifying score calculation
```

### Constraint: Preserve Score Logic
- **Score increment**: UNCHANGED
- **Score multiplier**: UNCHANGED
- **API calls**: UNCHANGED
- **Power-up effects**: UNCHANGED
- Terrain state is **orthogonal** to scoring system

---

## 4. Testing Strategy

### Unit Tests (Jest)
**File**: `tests/terrain-switch.spec.ts`

#### Terrain Trigger Tests (5 tests)
1. ✅ Terrain remains 'desert' when score < 5
2. ✅ Terrain switches to 'ice' when score >= 5 (Easy Mode)
3. ✅ Terrain switch triggers only once per game
4. ✅ Terrain does NOT switch in Medium/Hard modes at score 5
5. ✅ Terrain resets to 'desert' on game restart

#### State Transition Tests (4 tests)
6. ✅ `terrainSwitchTriggered` flag set to true after switch
7. ✅ `terrainSwitchScore` records the trigger score
8. ✅ Changing difficulty resets terrain mid-game
9. ✅ Terrain state survives across multiple frames

#### Integration Tests (3 tests)
10. ✅ Collision detection works in both terrains (bird/cactus)
11. ✅ Power-ups collect in both terrains
12. ✅ Score API receives numeric score (terrain-agnostic)

### E2E Tests (Playwright)
**File**: `tests/terrain-switch.spec.ts`

#### Terrain Switch Scenarios (5 tests)
1. ✅ **Easy Mode < 5 points**: Desert terrain visible
2. ✅ **Easy Mode = 5 points**: Terrain switches to Ice
3. ✅ **Easy Mode > 5 points**: Terrain remains Ice
4. ✅ **Medium/Hard Mode at score 5**: No terrain switch
5. ✅ **Game Over**: Terrain snapshot captured

#### Restart & Mode Switching (4 tests)
6. ✅ **Restart after Ice terrain**: Resets to Desert
7. ✅ **Switch difficulty mid-game**: Terrain reverts to Desert
8. ✅ **Difficulty selector disabled during play**: No accidental switches
9. ✅ **Change mode after terrain switch**: Desert persists

#### Edge Cases (3 tests)
10. ✅ **Collision at score 4 vs 5**: No terrain artifact interference
11. ✅ **Power-up collection**: Same behavior in desert/ice
12. ✅ **Window resize**: Terrain visual integrity maintained

---

## 5. Regression Prevention

### Obstacle Collision Protection
- **Collision Detection**: Unchanged (AABB calculations unchanged)
- **Hitbox Geometry**: No terrain-based modifications
- **Bird Path**: Unaffected by terrain color
- **Cactus Placement**: Unaffected by terrain theme
- **Test**: Full collision suite runs in both terrains

### Power-up System Validation
- **Shield**: Works in both terrains
- **Score Boost**: Applied identically in desert/ice
- **Slow Motion**: Mechanics unchanged
- **Collection**: AABB detection unchanged
- **Test**: 5+ power-up scenarios in each terrain

### Score API Integration Check
- **POST /score/{score}**: Receives numeric score only
- **GET /score**: Returns high score (terrain-agnostic)
- **Behavior**: API unaware of terrain state
- **Constraint**: Terrain state is CLIENT-SIDE ONLY
- **Test**: API calls logged during transitions

---

## 6. CI Validation Approach

### Playwright E2E Test Integration
```yaml
# .github/workflows/terrain-switch.yml
name: Terrain Switch E2E Tests
on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v2
      - name: Install dependencies
        run: npm install
      - name: Run Playwright tests
        run: npx playwright test tests/terrain-switch.spec.ts
      - name: Upload test results
        if: always()
        uses: actions/upload-artifact@v2
        with:
          name: playwright-report
          path: playwright-report/
```

### Visual Regression Baselines
- **Capture Points**: 
  - Score = 4 (desert only)
  - Score = 5 (transition frame)
  - Score = 6 (ice stable)
- **Tool**: Playwright screenshot comparison
- **Threshold**: 2% pixel diff tolerance
- **Baseline Storage**: `.github/baselines/terrain-switch/`

### Performance Metrics (FPS Monitoring)
```javascript
// Add to game loop during CI runs
if (window.CI_MODE) {
  let frameCount = 0;
  let lastTime = performance.now();
  
  // Every 60 frames, log FPS
  if (frameCount % 60 === 0) {
    const currentTime = performance.now();
    const fps = 60000 / (currentTime - lastTime);
    console.log(`FPS: ${fps.toFixed(1)}`);
    if (fps < 60) {
      process.exit(1); // Fail CI
    }
  }
}
```

### CI Gates (Auto-fail conditions)
- ❌ Any Playwright test fails
- ❌ FPS < 60 during terrain switch
- ❌ Visual regression > 2% pixel diff
- ❌ Memory usage increase > 5MB
- ❌ Collision detection regression

---

## 7. Implementation Roadmap

### Code Change Locations & Sequence

| Step | Function | Change | Sprint | Week | Notes |
|------|----------|--------|--------|------|-------|
| 1 | Game init | Add `terrain`, `terrainSwitchTriggered`, `terrainSwitchScore` vars | 2 | 1 | State setup |
| 2 | Game loop (loop()) | Call `checkTerrainTrigger()` after score update | 2 | 1 | Hook observer |
| 3 | **NEW** | `checkTerrainTrigger()` | NEW function | 2 | 1 | Trigger logic |
| 4 | **NEW** | `applyTerrainSwitch()` | NEW function | 2 | 1 | State mutation |
| 5 | `drawSky()` | Add `terrain` param, conditional colors | 2 | 2 | Visual changes |
| 6 | `drawGround()` | Add `terrain` param, conditional colors | 2 | 2 | Visual changes |
| 7 | `drawClouds()` | Add `terrain` param, conditional colors | 2 | 2 | Visual changes |
| 8 | `drawScene()` | Pass `terrain` to draw functions | 2 | 2 | Prop threading |
| 9 | `startGame()` | Reset terrain to 'desert' | 2 | 2 | Restart handling |
| 10 | Difficulty listener | Reset terrain on mode change | 2 | 2 | Mode switching |
| 11 | Unit tests | Write 12+ unit tests | 2 | 2-3 | Validation |
| 12 | E2E tests | Write 12+ Playwright tests | 2 | 3 | E2E validation |
| 13 | CI pipeline | Add terrain-switch.yml workflow | 2 | 3 | CI integration |
| 14 | Performance profile | Baseline FPS + memory | 3 | 1 | Sprint 3 baseline |
| 15 | Regression suite | Run full gameplay tests | 3 | 2 | Regression check |
| 16 | Accessibility | aria-labels, screen reader test | 3 | 2 | A11y validation |
| 17 | Sign-off | PR review + merge to main | 3 | 3 | Production ready |

### Function Dependencies Flow
```
startGame()
  ├─> Reset terrain to 'desert'
  └─> Initialize game loop
      └─> loop()
          ├─> Update score
          ├─> checkTerrainTrigger()
          │   ├─> If score >= 5 AND easy mode
          │   └─> applyTerrainSwitch()
          └─> drawScene(terrain)
              ├─> drawSky(terrain)
              ├─> drawGround(terrain)
              ├─> drawClouds(terrain)
              └─> [obstacles, score, etc. unchanged]
```

---

## 8. Sprint Allocation & Milestones

### Sprint 2: Core Implementation (Weeks 4-6)

**Week 1 (Days 1-5)**
- [ ] Add terrain state variables (game init)
- [ ] Implement `checkTerrainTrigger()` function
- [ ] Implement `applyTerrainSwitch()` function
- [ ] Write unit tests (trigger logic)
- **Deliverable**: Terrain state machine tested

**Week 2 (Days 6-10)**
- [ ] Refactor `drawSky()`, `drawGround()`, `drawClouds()` for terrain awareness
- [ ] Update `drawScene()` to pass terrain param
- [ ] Handle game restart (terrain reset)
- [ ] Write E2E Playwright tests (basic scenarios)
- **Deliverable**: Visual rendering working, E2E tests passing

**Week 3 (Days 11-15)**
- [ ] Polish canvas rendering (color accuracy)
- [ ] Add difficulty change handler (terrain reset)
- [ ] Complete CI pipeline setup
- [ ] Capture visual regression baselines
- **Deliverable**: Ready for Sprint 3 testing

### Sprint 3: Testing & Optimization (Weeks 7-9)

**Week 1 (Days 1-5)**
- [ ] Run full regression suite (20+ tests)
- [ ] Profile FPS during terrain switch
- [ ] Capture performance baseline
- **Milestone**: Zero regressions confirmed

**Week 2 (Days 6-10)**
- [ ] Optimize rendering if needed (unlikely)
- [ ] Add accessibility labels
- [ ] Run accessibility audit
- **Milestone**: A11y compliant

**Week 3 (Days 11-15)**
- [ ] Final QA sign-off
- [ ] PR review + merge to main
- [ ] Deploy to production
- **Milestone**: Feature shipped ✅

---

## 9. Risk Mitigation Matrix

| Risk | Likelihood | Impact | Mitigation | Validation |
|------|-----------|--------|-----------|-----------|
| FPS drop during switch | Medium | High | Profile in Sprint 1, CI gate on FPS < 60 | Sprint 3 baseline + Gate |
| Collision artifacts | Low | Critical | Unit tests on hitboxes, regression suite | 20+ collision tests |
| State desync | Low | Medium | Terrain state isolated, no score mutation | Unit tests for state consistency |
| Asset colors mismatched | Medium | Medium | Design mockups Sprint 1, test early | Visual regression tests |
| API breakage | Very Low | Critical | API receives score only, terrain client-side | API integration tests |

---

## 10. Definition of Done

### Sprint 2 Exit Criteria
- ✅ Terrain switches at score >= 5 in Easy Mode
- ✅ Desert → Ice visuals render correctly
- ✅ No FPS degradation (measured)
- ✅ Obstacles functional (no collision changes)
- ✅ Restart resets terrain to desert
- ✅ All E2E tests pass
- ✅ CI pipeline configured & green

### Sprint 3 Exit Criteria
- ✅ All regression tests pass (20+)
- ✅ FPS maintained @ 60 (profiling report approved)
- ✅ No gameplay regressions
- ✅ Accessibility audit passed
- ✅ Code reviewed & merged
- ✅ Feature branch deleted
- ✅ Changelog updated

---

## Appendix: Color Constants

```javascript
const TERRAIN_COLORS = {
  desert: {
    skyGradient: ['#5ba3d9', '#acd8f0', '#d4ecfb'],
    groundColor: '#c8a96e',
    roadColor: '#7a7a7a',
    roadEdgeLine: '#ffffff',
    cloudColor: 'rgba(255,255,255,0.92)',
    stripeColor: '#ffff99'
  },
  ice: {
    skyGradient: ['#87ceeb', '#b3d9e8', '#d8f0ff'],
    groundColor: '#e8f4f8',
    roadColor: '#a0c8d8',
    roadEdgeLine: '#d0e8f0',
    cloudColor: 'rgba(240,248,255,0.95)',
    stripeColor: '#66bbff'
  }
};
```

---

**This plan is ready for Sprint 2 implementation. All team members should review before kickoff.**
