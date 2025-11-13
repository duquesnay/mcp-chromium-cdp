import { vi } from 'vitest';

/**
 * Mock CDP Client for testing ChromeController without real browser
 * Implements the chrome-remote-interface protocol interface
 */
export class MockCDPClient {
  DOM = {
    enable: vi.fn().mockResolvedValue(undefined),
    getDocument: vi.fn().mockResolvedValue({
      root: { nodeId: 1 }
    }),
    querySelector: vi.fn().mockResolvedValue({ nodeId: 2 }),
    getBoxModel: vi.fn().mockResolvedValue({
      model: {
        content: [10, 10, 50, 10, 50, 50, 10, 50] // x1, y1, x2, y2, x3, y3, x4, y4
      }
    }),
    focus: vi.fn().mockResolvedValue(undefined)
  };

  Input = {
    dispatchMouseEvent: vi.fn().mockResolvedValue(undefined),
    dispatchKeyEvent: vi.fn().mockResolvedValue(undefined)
  };

  Page = {
    enable: vi.fn().mockResolvedValue(undefined),
    navigate: vi.fn().mockResolvedValue({ frameId: 'mock-frame' }),
    loadEventFired: vi.fn().mockResolvedValue(undefined),
    captureScreenshot: vi.fn().mockResolvedValue({
      data: Buffer.from('mock-screenshot').toString('base64')
    }),
    reload: vi.fn().mockResolvedValue(undefined),
    getNavigationHistory: vi.fn().mockResolvedValue({
      currentIndex: 1,
      entries: [
        { id: 1, url: 'https://example.com/page1' },
        { id: 2, url: 'https://example.com/page2' },
        { id: 3, url: 'https://example.com/page3' }
      ]
    }),
    navigateToHistoryEntry: vi.fn().mockResolvedValue(undefined)
  };

  Runtime = {
    enable: vi.fn().mockResolvedValue(undefined),
    evaluate: vi.fn().mockResolvedValue({
      result: { value: 'mock-result' }
    })
  };

  Network = {
    enable: vi.fn().mockResolvedValue(undefined),
    disable: vi.fn().mockResolvedValue(undefined),
    requestWillBeSent: vi.fn(),
    loadingFinished: vi.fn()
  };

  on = vi.fn();
  close = vi.fn().mockResolvedValue(undefined);
}

/**
 * Helper function to create a mock CDP client with custom behavior
 */
export function createMockCDPClient(overrides?: Partial<MockCDPClient>): MockCDPClient {
  const mock = new MockCDPClient();
  if (overrides) {
    Object.assign(mock, overrides);
  }
  return mock;
}

/**
 * Helper to simulate element not found
 */
export function mockElementNotFound(mock: MockCDPClient): void {
  mock.DOM.querySelector.mockResolvedValue({ nodeId: 0 });
}

/**
 * Helper to simulate script evaluation with custom result
 */
export function mockScriptResult(mock: MockCDPClient, value: any): void {
  mock.Runtime.evaluate.mockResolvedValue({
    result: { value }
  });
}

/**
 * Helper to simulate script evaluation error
 */
export function mockScriptError(mock: MockCDPClient, errorText: string): void {
  mock.Runtime.evaluate.mockResolvedValue({
    result: { value: undefined },
    exceptionDetails: { text: errorText }
  });
}

/**
 * Helper to simulate viewport dimensions
 */
export function mockViewportDimensions(
  mock: MockCDPClient,
  width: number,
  height: number
): void {
  mock.Runtime.evaluate.mockResolvedValue({
    result: { value: JSON.stringify({ width, height }) }
  });
}
