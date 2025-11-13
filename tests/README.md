# Test Suite

Comprehensive test infrastructure for mcp-chromium-cdp browser automation.

## Test Structure

```
tests/
├── unit/                    # Unit tests with mocked dependencies
│   └── chrome-controller.test.ts
├── integration/            # Integration tests with real browser
│   └── chrome-automation.test.ts
├── fixtures/               # Test fixtures and mocks
│   └── mock-cdp-client.ts
└── helpers/                # Test utilities
```

## Running Tests

```bash
# Run all tests
npm test

# Run tests in watch mode
npm run test:watch

# Run tests with UI
npm run test:ui

# Generate coverage report
npm run test:coverage
```

## Test Coverage

Current coverage: ~38% (target: 60-80%)

**Coverage by module:**
- `chrome-controller.ts`: 50% (21 tests)
- `index.ts`: 0% (MCP server integration - needs integration tests)

## Unit Tests

Unit tests use mock CDP client to test ChromeController methods without real browser.

**Tested methods:**
- `navigate()` - URL navigation
- `click()` - Element clicking with coordinate calculation
- `type()` - Text input with key events
- `executeScript()` - JavaScript execution
- `getTitle()` / `getUrl()` - Page metadata
- `screenshot()` - Screenshot capture (no resize mock)
- `reload()` - Page reload
- `goBack()` / `goForward()` - History navigation
- `checkPage()` - Quick page state check
- `waitFor()` - Wait for conditions

**Run unit tests only:**
```bash
npm test tests/unit
```

## Integration Tests

Integration tests require real Chrome/Chromium browser. All tests are skipped by default.

**Setup:**
1. Launch Chrome with debugging: `chrome --remote-debugging-port=9222`
2. Run: `npm test tests/integration`

**Planned tests:**
- Real browser connection
- Real page navigation and interaction
- Screenshot capture with real images
- Form extraction from real pages
- Reconnection after browser restart

## Mock CDP Client

The `MockCDPClient` fixture provides a complete mock of the Chrome DevTools Protocol client.

**Features:**
- All CDP domains: DOM, Input, Page, Runtime, Network
- Helper functions for common scenarios
- Easy to customize for specific test cases

**Example usage:**
```typescript
import { MockCDPClient, mockElementNotFound } from '../fixtures/mock-cdp-client';

const mockClient = new MockCDPClient();
mockElementNotFound(mockClient); // Simulate missing element
```

## Test Helpers

Available helper functions in `mock-cdp-client.ts`:
- `createMockCDPClient()` - Create mock with overrides
- `mockElementNotFound()` - Simulate element not found
- `mockScriptResult()` - Set script evaluation result
- `mockScriptError()` - Simulate script error
- `mockViewportDimensions()` - Set viewport size

## Coverage Reports

Coverage reports are generated in `coverage/` directory:
- `coverage/index.html` - Interactive HTML report
- `coverage/coverage-final.json` - JSON data
- `coverage/lcov.info` - LCOV format

View HTML report:
```bash
npm run test:coverage
open coverage/index.html
```

## Adding New Tests

### Unit Test Template

```typescript
import { describe, it, expect, beforeEach } from 'vitest';
import { ChromeController } from '../../src/chrome-controller.js';
import { MockCDPClient } from '../fixtures/mock-cdp-client.js';

describe('NewFeature', () => {
  let controller: ChromeController;
  let mockClient: MockCDPClient;

  beforeEach(() => {
    mockClient = new MockCDPClient();
    controller = new ChromeController();
    (controller as any).client = mockClient;
  });

  it('should do something', async () => {
    const result = await controller.newMethod();
    expect(result).toBe('expected');
  });
});
```

### Integration Test Template

```typescript
import { describe, it, expect } from 'vitest';
import { ChromeController } from '../../src/chrome-controller.js';

describe('NewFeature Integration', () => {
  it.skip('should work with real browser', async () => {
    const controller = new ChromeController();
    await controller.connect();

    // Test implementation

    await controller.disconnect();
  });
});
```

## CI/CD Integration

Tests can be run in CI/CD pipelines:

```yaml
# GitHub Actions example
- name: Run tests
  run: npm test

- name: Upload coverage
  run: npm run test:coverage
```

## Known Limitations

1. **Screenshot resize tests** - Mocking sharp library is complex, skipped in unit tests
2. **Integration tests** - Require manual browser setup, all skipped by default
3. **MCP server tests** - Not yet implemented (index.ts coverage 0%)

## Next Steps

To increase coverage to 60%:
1. Add tests for remaining ChromeController methods (extractForms, checkPage)
2. Add MCP server integration tests
3. Add error handling edge cases
4. Test reconnection logic
5. Test cross-platform path finding
