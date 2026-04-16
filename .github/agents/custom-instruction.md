# GitHub Copilot Custom Instructions – T Rex Runner

## General Guidelines
- Do not modify existing game logic unless explicitly requested
- Prefer Playwright for browser automation
- Use accessibility and JavaScript state instead of DOM scraping

## Testing Standards
- Validate gameplay using window.gameScore
- Avoid hard-coded waits
- Ensure reliability and readability in generated tests

## Security Standards
- Prefer parameterized queries in backend code
- Avoid introducing secrets or credentials
- Follow OWASP secure coding practices

## Delivery Standards
- CI/CD must fail on test or security violations
- Pipelines must trigger on push and pull_request
🎙️ Explain
“These instructions act like enterprise guardrails.
Every agent respects them automatically.”
