import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ChromeController } from '../../src/chrome-controller.js';
import { MockCDPClient, mockScriptResult, mockElementNotFound } from '../fixtures/mock-cdp-client.js';

describe('Hover Service', () => {
  let controller: ChromeController;
  let mockClient: MockCDPClient;

  beforeEach(() => {
    mockClient = new MockCDPClient();
    controller = new ChromeController();
    // Inject mock client and initialize services
    (controller as any).client = mockClient;
    (controller as any).initializeServices();
  });

  describe('hover()', () => {
    it('should dispatch mouseMoved event to element center', async () => {
      const result = await controller.hover('button');

      // Verify DOM query
      expect(mockClient.DOM.querySelector).toHaveBeenCalledWith({
        nodeId: 1,
        selector: 'button'
      });

      // Verify getBoxModel called
      expect(mockClient.DOM.getBoxModel).toHaveBeenCalledWith({ nodeId: 2 });

      // Verify mouseMoved event dispatched (element center: (30, 30) from mock box model)
      expect(mockClient.Input.dispatchMouseEvent).toHaveBeenCalledWith({
        type: 'mouseMoved',
        x: 30,
        y: 30
      });

      // Verify success message
      expect(result).toContain('Hovered over element: button');
      expect(result).toContain('(30, 30)');
    });

    it('should throw error if element not found', async () => {
      mockElementNotFound(mockClient);

      await expect(controller.hover('button.missing')).rejects.toThrow();
      const error = await controller.hover('button.missing').catch(e => e);
      expect(error.message).toContain('Element not found');
    });

    it('should reject invalid selector', async () => {
      await expect(controller.hover('')).rejects.toThrow();
      const error = await controller.hover('').catch(e => e);
      const errorObj = JSON.parse(error.message);
      expect(errorObj.error).toBe('INVALID_SELECTOR');
    });
  });

  describe('detectSPAFramework()', () => {
    it('should detect React framework', async () => {
      mockScriptResult(mockClient, {
        detected: true,
        frameworks: [{ name: 'React', version: '18.2.0' }]
      });

      const result = await controller.detectSPAFramework();

      expect(result.detected).toBe(true);
      expect(result.frameworks).toHaveLength(1);
      expect(result.frameworks[0].name).toBe('React');
      expect(result.frameworks[0].version).toBe('18.2.0');
    });

    it('should detect Vue framework', async () => {
      mockScriptResult(mockClient, {
        detected: true,
        frameworks: [{ name: 'Vue', version: '3.3.4' }]
      });

      const result = await controller.detectSPAFramework();

      expect(result.detected).toBe(true);
      expect(result.frameworks[0].name).toBe('Vue');
    });

    it('should detect Angular framework', async () => {
      mockScriptResult(mockClient, {
        detected: true,
        frameworks: [{ name: 'Angular', version: '16.0.0' }]
      });

      const result = await controller.detectSPAFramework();

      expect(result.detected).toBe(true);
      expect(result.frameworks[0].name).toBe('Angular');
    });

    it('should detect Svelte framework', async () => {
      mockScriptResult(mockClient, {
        detected: true,
        frameworks: [{ name: 'Svelte', version: 'unknown' }]
      });

      const result = await controller.detectSPAFramework();

      expect(result.detected).toBe(true);
      expect(result.frameworks[0].name).toBe('Svelte');
    });

    it('should detect multiple frameworks', async () => {
      mockScriptResult(mockClient, {
        detected: true,
        frameworks: [
          { name: 'React', version: '18.2.0' },
          { name: 'Vue', version: '3.3.4' }
        ]
      });

      const result = await controller.detectSPAFramework();

      expect(result.detected).toBe(true);
      expect(result.frameworks).toHaveLength(2);
    });

    it('should return no frameworks when none detected', async () => {
      mockScriptResult(mockClient, {
        detected: false,
        frameworks: []
      });

      const result = await controller.detectSPAFramework();

      expect(result.detected).toBe(false);
      expect(result.frameworks).toHaveLength(0);
    });
  });

  describe('click() with ensureInteractive', () => {
    beforeEach(() => {
      // Mock element readiness checks
      mockClient.Runtime.evaluate.mockImplementation(async ({ expression }) => {
        // Mock element readiness checks
        if (expression && expression.includes('isVisible') && expression.includes('isEnabled')) {
          return {
            result: {
              value: {
                visible: true,
                enabled: true,
                boundingBox: { x: 100, y: 200, width: 50, height: 30 }
              }
            }
          };
        }
        // Mock stability check
        if (expression && expression.includes('rect.x') && expression.includes('rect.y')) {
          return {
            result: {
              value: { x: 100, y: 200, width: 50, height: 30 }
            }
          };
        }
        return { result: { value: 'mock-result' } };
      });
    });

    it('should perform standard click without ensureInteractive', async () => {
      const result = await controller.click('button');

      // Should click directly without hover or focus
      const mouseEvents = mockClient.Input.dispatchMouseEvent.mock.calls;
      expect(mouseEvents).toHaveLength(2); // mousePressed + mouseReleased
      expect(mouseEvents[0][0].type).toBe('mousePressed');
      expect(mouseEvents[1][0].type).toBe('mouseReleased');

      // Should NOT call focus
      expect(mockClient.DOM.focus).not.toHaveBeenCalled();

      // Verify message doesn't mention SPA sequence
      expect(result).not.toContain('SPA interactive sequence');
    });

    it('should perform SPA interaction sequence with ensureInteractive', async () => {
      const result = await controller.click('button', { ensureInteractive: true });

      // Verify hover (mouseMoved) called first
      const mouseEvents = mockClient.Input.dispatchMouseEvent.mock.calls;
      expect(mouseEvents[0][0].type).toBe('mouseMoved');

      // Verify focus called after hover
      expect(mockClient.DOM.focus).toHaveBeenCalledWith({ nodeId: 2 });

      // Verify click (mousePressed + mouseReleased) called last
      expect(mouseEvents[1][0].type).toBe('mousePressed');
      expect(mouseEvents[2][0].type).toBe('mouseReleased');

      // Total: 1 mouseMoved + 2 click events = 3
      expect(mouseEvents).toHaveLength(3);

      // Verify message mentions SPA sequence
      expect(result).toContain('with SPA interactive sequence');
    });

    it('should use same coordinates for hover and click', async () => {
      await controller.click('button', { ensureInteractive: true });

      const mouseEvents = mockClient.Input.dispatchMouseEvent.mock.calls;

      // Extract coordinates from all events
      const hoverCoords = { x: mouseEvents[0][0].x, y: mouseEvents[0][0].y };
      const clickPressedCoords = { x: mouseEvents[1][0].x, y: mouseEvents[1][0].y };
      const clickReleasedCoords = { x: mouseEvents[2][0].x, y: mouseEvents[2][0].y };

      // All should use element center (30, 30 from mock box model)
      expect(hoverCoords).toEqual({ x: 30, y: 30 });
      expect(clickPressedCoords).toEqual({ x: 30, y: 30 });
      expect(clickReleasedCoords).toEqual({ x: 30, y: 30 });
    });

    it('should wait 50ms between focus and click for React timing', async () => {
      const startTime = Date.now();
      await controller.click('button', { ensureInteractive: true });
      const endTime = Date.now();

      // Should take at least 50ms (allowing for test overhead)
      expect(endTime - startTime).toBeGreaterThanOrEqual(40);
    });

    it('should handle ensureInteractive=false explicitly', async () => {
      const result = await controller.click('button', { ensureInteractive: false });

      // Should NOT call focus
      expect(mockClient.DOM.focus).not.toHaveBeenCalled();

      // Should only have click events (no hover)
      const mouseEvents = mockClient.Input.dispatchMouseEvent.mock.calls;
      expect(mouseEvents).toHaveLength(2);
      expect(mouseEvents[0][0].type).toBe('mousePressed');
    });
  });

  describe('SPA Click Sequence Integration', () => {
    it('should perform hover → focus → wait → click in correct order', async () => {
      // Track call order
      const callOrder: string[] = [];

      mockClient.Input.dispatchMouseEvent.mockImplementation(async (params: any) => {
        callOrder.push(`Input.dispatchMouseEvent:${params.type}`);
      });

      mockClient.DOM.focus.mockImplementation(async () => {
        callOrder.push('DOM.focus');
      });

      // Mock readiness checks
      mockClient.Runtime.evaluate.mockImplementation(async ({ expression }) => {
        if (expression && expression.includes('isVisible') && expression.includes('isEnabled')) {
          return {
            result: {
              value: {
                visible: true,
                enabled: true,
                boundingBox: { x: 100, y: 200, width: 50, height: 30 }
              }
            }
          };
        }
        if (expression && expression.includes('rect.x') && expression.includes('rect.y')) {
          return {
            result: {
              value: { x: 100, y: 200, width: 50, height: 30 }
            }
          };
        }
        return { result: { value: 'mock-result' } };
      });

      await controller.click('button', { ensureInteractive: true });

      // Verify correct order: hover → focus → click
      expect(callOrder).toEqual([
        'Input.dispatchMouseEvent:mouseMoved',  // hover
        'DOM.focus',                             // focus
        'Input.dispatchMouseEvent:mousePressed', // click start
        'Input.dispatchMouseEvent:mouseReleased' // click end
      ]);
    });
  });

  describe('Backward Compatibility', () => {
    it('should maintain backward compatibility for existing click calls', async () => {
      // Mock readiness
      mockClient.Runtime.evaluate.mockImplementation(async ({ expression }) => {
        if (expression && expression.includes('isVisible') && expression.includes('isEnabled')) {
          return {
            result: {
              value: {
                visible: true,
                enabled: true,
                boundingBox: { x: 100, y: 200, width: 50, height: 30 }
              }
            }
          };
        }
        if (expression && expression.includes('rect.x') && expression.includes('rect.y')) {
          return {
            result: {
              value: { x: 100, y: 200, width: 50, height: 30 }
            }
          };
        }
        return { result: { value: 'mock-result' } };
      });

      // Old API: no options
      await controller.click('button');

      // Should work without errors
      expect(mockClient.Input.dispatchMouseEvent).toHaveBeenCalled();

      // Old API: with timeout only
      await controller.click('button', { timeout: 5000 });

      // Should work without errors
      expect(mockClient.Input.dispatchMouseEvent).toHaveBeenCalled();
    });
  });
});
