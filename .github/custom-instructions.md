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
#architecture 
- Modular design: Separate concerns (game logic, UI, testing)
- Testable components: Ensure new features are easily testable

