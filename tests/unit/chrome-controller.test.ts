import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ChromeController } from '../../src/chrome-controller.js';
import {
  MockCDPClient,
  mockElementNotFound,
  mockScriptResult,
  mockScriptError,
  mockViewportDimensions
} from '../fixtures/mock-cdp-client.js';

describe('ChromeController', () => {
  let controller: ChromeController;
  let mockClient: MockCDPClient;

  beforeEach(() => {
    mockClient = new MockCDPClient();
    controller = new ChromeController();
    // Inject mock client to bypass connection
    (controller as any).client = mockClient;
  });

  describe('navigate()', () => {
    it('should navigate to URL using CDP Page API', async () => {
      const result = await controller.navigate('https://example.com');

      expect(mockClient.Page.navigate).toHaveBeenCalledWith({
        url: 'https://example.com'
      });
      expect(mockClient.Page.loadEventFired).toHaveBeenCalled();
      expect(result).toBe('Navigated to https://example.com');
    });

    it('should handle navigation errors', async () => {
      mockClient.Page.navigate.mockRejectedValue(new Error('Network error'));

      await expect(controller.navigate('https://example.com')).rejects.toThrow(
        'Failed to navigate'
      );
    });
  });

  describe('click()', () => {
    it('should click element using CDP Input API', async () => {
      const result = await controller.click('#button');

      expect(mockClient.DOM.getDocument).toHaveBeenCalled();
      expect(mockClient.DOM.querySelector).toHaveBeenCalled();
      expect(mockClient.DOM.getBoxModel).toHaveBeenCalledWith({ nodeId: 2 });
      expect(mockClient.Input.dispatchMouseEvent).toHaveBeenCalledTimes(2);
      // Result now includes readiness time
      expect(result).toMatch(/^Clicked on element: #button \(ready in \d+ms\)$/);
    });

    it('should throw error if element not found', async () => {
      mockElementNotFound(mockClient);

      await expect(controller.click('#missing')).rejects.toThrow('ELEMENT_NOT_FOUND');
    });

    it('should calculate correct click coordinates', async () => {
      await controller.click('#button');

      // Verify click coordinates are calculated from box model
      const mouseDownCall = mockClient.Input.dispatchMouseEvent.mock.calls[0][0];
      expect(mouseDownCall).toMatchObject({
        type: 'mousePressed',
        x: 30, // (10 + 50) / 2
        y: 30, // (10 + 50) / 2
        button: 'left',
        clickCount: 1
      });
    });
  });

  describe('type()', () => {
    it('should type text using CDP Input API', async () => {
      const result = await controller.type('#input', 'hello');

      expect(mockClient.DOM.focus).toHaveBeenCalledWith({ nodeId: 2 });
      expect(mockClient.Input.dispatchKeyEvent).toHaveBeenCalledTimes(10); // 5 chars × 2 events
      // Result now includes readiness time
      expect(result).toMatch(/^Typed text into: #input \(ready in \d+ms\)$/);
    });

    it('should send correct key events for each character', async () => {
      await controller.type('#input', 'ab');

      const calls = mockClient.Input.dispatchKeyEvent.mock.calls;
      expect(calls[0][0]).toMatchObject({ type: 'keyDown', text: 'a' });
      expect(calls[1][0]).toMatchObject({ type: 'keyUp', text: 'a' });
      expect(calls[2][0]).toMatchObject({ type: 'keyDown', text: 'b' });
      expect(calls[3][0]).toMatchObject({ type: 'keyUp', text: 'b' });
    });

    it('should throw error if element not found', async () => {
      mockElementNotFound(mockClient);

      await expect(controller.type('#missing', 'text')).rejects.toThrow(
        'ELEMENT_NOT_FOUND'
      );
    });
  });

  describe('executeScript()', () => {
    it('should execute JavaScript and return result', async () => {
      mockScriptResult(mockClient, 42);

      const result = await controller.executeScript('1 + 1');

      expect(mockClient.Runtime.evaluate).toHaveBeenCalledWith({
        expression: '1 + 1',
        returnByValue: true,
        awaitPromise: true
      });
      expect(result).toBe(42);
    });

    it('should handle script execution errors', async () => {
      mockScriptError(mockClient, 'ReferenceError: foo is not defined');

      await expect(controller.executeScript('foo')).rejects.toThrow(
        'Script execution failed'
      );
    });
  });

  describe('getTitle()', () => {
    it('should get page title using Runtime.evaluate', async () => {
      mockScriptResult(mockClient, 'Example Page');

      const title = await controller.getTitle();

      expect(mockClient.Runtime.evaluate).toHaveBeenCalledWith({
        expression: 'document.title',
        returnByValue: true
      });
      expect(title).toBe('Example Page');
    });
  });

  describe('getUrl()', () => {
    it('should get current URL using Runtime.evaluate', async () => {
      mockScriptResult(mockClient, 'https://example.com');

      const url = await controller.getUrl();

      expect(mockClient.Runtime.evaluate).toHaveBeenCalledWith({
        expression: 'window.location.href',
        returnByValue: true
      });
      expect(url).toBe('https://example.com');
    });
  });

  describe('screenshot()', () => {
    it('should capture screenshot without resize if within limits', async () => {
      mockViewportDimensions(mockClient, 1920, 1080);

      const result = await controller.screenshot(2000);

      expect(mockClient.Page.captureScreenshot).toHaveBeenCalledWith({
        format: 'png'
      });
      expect(result.metadata.wasResized).toBe(false);
      expect(result.metadata.originalDimensions).toEqual({ width: 1920, height: 1080 });
      expect(result.metadata.finalDimensions).toEqual({ width: 1920, height: 1080 });
    });

    it.skip('should indicate resize needed for oversized viewport', async () => {
      // Skip: This test requires mocking the sharp library which is complex
      // Integration tests will verify resize functionality with real screenshots
      mockViewportDimensions(mockClient, 3000, 2000);

      const result = await controller.screenshot(2000);

      expect(result.metadata.wasResized).toBe(true);
      expect(result.metadata.originalDimensions).toEqual({ width: 3000, height: 2000 });
      // Max dimension is 2000, so width should be scaled down
      expect(result.metadata.finalDimensions.width).toBeLessThanOrEqual(2000);
      expect(result.metadata.finalDimensions.height).toBeLessThanOrEqual(2000);
    });
  });

  describe('reload()', () => {
    it('should reload the page', async () => {
      const result = await controller.reload();

      expect(mockClient.Page.reload).toHaveBeenCalled();
      expect(result).toBe('Page reloaded');
    });
  });

  describe('goBack()', () => {
    it('should navigate back in history', async () => {
      const result = await controller.goBack();

      expect(mockClient.Page.getNavigationHistory).toHaveBeenCalled();
      expect(mockClient.Page.navigateToHistoryEntry).toHaveBeenCalledWith({
        entryId: 1 // Previous entry from currentIndex 1
      });
      expect(result).toBe('Navigated back');
    });

    it('should handle already at first page', async () => {
      mockClient.Page.getNavigationHistory.mockResolvedValue({
        currentIndex: 0,
        entries: [{ id: 1, url: 'https://example.com' }]
      });

      const result = await controller.goBack();

      expect(mockClient.Page.navigateToHistoryEntry).not.toHaveBeenCalled();
      expect(result).toBe('Already at the first page');
    });
  });

  describe('goForward()', () => {
    it('should navigate forward in history', async () => {
      const result = await controller.goForward();

      expect(mockClient.Page.getNavigationHistory).toHaveBeenCalled();
      expect(mockClient.Page.navigateToHistoryEntry).toHaveBeenCalledWith({
        entryId: 3 // Next entry from currentIndex 1
      });
      expect(result).toBe('Navigated forward');
    });

    it('should handle already at last page', async () => {
      mockClient.Page.getNavigationHistory.mockResolvedValue({
        currentIndex: 2,
        entries: [
          { id: 1, url: 'https://example.com/page1' },
          { id: 2, url: 'https://example.com/page2' },
          { id: 3, url: 'https://example.com/page3' }
        ]
      });

      const result = await controller.goForward();

      expect(mockClient.Page.navigateToHistoryEntry).not.toHaveBeenCalled();
      expect(result).toBe('Already at the last page');
    });
  });

  describe('checkPage()', () => {
    it('should return page state information', async () => {
      const mockPageState = {
        url: 'https://example.com',
        title: 'Example Page',
        loadState: 'complete',
        visibleErrors: [],
        formCount: 2,
        interactiveElementsCount: 15
      };
      mockScriptResult(mockClient, mockPageState);

      const result = await controller.checkPage();

      expect(result).toEqual(mockPageState);
      expect(mockClient.Runtime.evaluate).toHaveBeenCalled();
    });
  });

  describe('waitFor()', () => {
    it('should wait for element condition', async () => {
      // Mock element found
      mockClient.DOM.querySelector.mockResolvedValue({ nodeId: 5 });
      mockScriptResult(mockClient, 'https://example.com');

      const result = await controller.waitFor({
        element: '#success-message',
        timeout: 1000
      });

      expect(result.success).toBe(true);
      expect(result.conditions.element).toBe(true);
      expect(result.actualState.elementFound).toBe(true);
      expect(result.timeElapsed).toBeGreaterThanOrEqual(0);
    });

    it('should timeout and return current state', async () => {
      // Element never appears
      mockElementNotFound(mockClient);
      mockScriptResult(mockClient, 'https://example.com');

      const result = await controller.waitFor({
        element: '#missing',
        timeout: 100
      });

      expect(result.success).toBe(false);
      expect(result.conditions.element).toBe(false);
      expect(result.actualState.elementFound).toBe(false);
      expect(result.timeElapsed).toBeGreaterThanOrEqual(100);
    });
  });
});
