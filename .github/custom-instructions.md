# Copilot Custom Instructions – T-Rex Runner

## General
- Preserve existing gameplay logic unless explicitly changing it
- Keep feature implementations incremental and backward compatible

## UI
- Use simple HTML controls for new UI features
- Ensure UI elements are testable (IDs or labels)

## Testing
- Validate feature behavior across all difficulty levels
- Prefer state-based assertions over visual checks

## Delivery
- CI/CD must validate both existing and new functionality
- Fail pipelines on test failures

## Terrain Switching Standards
- Terrain updates must not reload the page
- Preserve existing game loop
- Use CSS classes or canvas state updates
- Avoid modifying obstacle collision logic
- Terrain transitions must remain testable

