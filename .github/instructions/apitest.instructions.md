---
description: Use when creating, updating, or reviewing basic API tests for score endpoints in the Trex Runner project.
applyTo: api/**/*.js, tests/**/*.{js,ts}
---

# API Testing Basics

## Scope
- Focus on score API behavior in [api/server.js](api/server.js).
- Cover API-related tests in [tests](tests).

## Test Coverage Requirements
- Validate happy path responses for GET and POST score endpoints.
- Validate invalid input handling (non-numeric, negative, empty, malformed).
- Validate boundary behavior (score 0, very high score, repeated same score).
- Validate state behavior (high score updates only when new score is greater).

## Test Design Rules
- Arrange tests using clear setup, action, and assertion flow.
- Add at least one assertion per meaningful step.
- Use readable names that describe expected behavior.
- Keep tests isolated and deterministic.

## API Assertions
- Check HTTP status code.
- Check response body shape and required fields.
- Check highScore value transitions after POST operations.
- Check error payload for invalid requests.

## Failure and Reliability Checks
- Include at least one negative test per endpoint.
- Include at least one boundary test per endpoint.
- Include simple timing/performance sanity check for response completion.

## Reporting Format
- Prefer concise bullet lists or small tables for:
	- Endpoint
	- Scenario type (positive, negative, boundary)
	- Expected result
	- Actual result

## Tooling Preferences
- Prefer Playwright request testing for API verification in end-to-end flows.
- If unit-level API tests are added, keep selectors and fixtures readable and minimal.