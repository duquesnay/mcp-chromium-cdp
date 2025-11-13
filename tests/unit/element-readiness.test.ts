import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ElementReadinessService } from '../../src/services/element-readiness-service.js';
import { MockCDPClient } from '../fixtures/mock-cdp-client.js';

describe('ElementReadinessService', () => {
  let service: ElementReadinessService;
  let mockClient: MockCDPClient;

  beforeEach(() => {
    mockClient = new MockCDPClient();
    service = new ElementReadinessService(mockClient as any);
  });

  describe('checkElementState()', () => {
    it('should return ready state for visible, enabled, stable element', async () => {
      mockClient.DOM.getDocument.mockResolvedValue({
        root: { nodeId: 1 }
      });
      mockClient.DOM.querySelector.mockResolvedValue({ nodeId: 5 });
      mockClient.Runtime.evaluate
        .mockResolvedValueOnce({
          result: {
            value: {
              visible: true,
              enabled: true,
              boundingBox: { x: 100, y: 200, width: 50, height: 30 }
            }
          }
        })
        .mockResolvedValueOnce({
          result: {
            value: { x: 100, y: 200, width: 50, height: 30 }
          }
        });

      const state = await service.checkElementState('.button');

      expect(state.visible).toBe(true);
      expect(state.enabled).toBe(true);
      expect(state.stable).toBe(true);
      expect(state.boundingBox).toBeDefined();
    });

    it('should detect invisible element', async () => {
      mockClient.DOM.getDocument.mockResolvedValue({
        root: { nodeId: 1 }
      });
      mockClient.DOM.querySelector.mockResolvedValue({ nodeId: 5 });
      mockClient.Runtime.evaluate.mockResolvedValue({
        result: {
          value: {
            visible: false,
            enabled: true,
            boundingBox: { x: 0, y: 0, width: 0, height: 0 }
          }
        }
      });

      const state = await service.checkElementState('.button');

      expect(state.visible).toBe(false);
      expect(state.stable).toBe(false);
    });

    it('should detect disabled element', async () => {
      mockClient.DOM.getDocument.mockResolvedValue({
        root: { nodeId: 1 }
      });
      mockClient.DOM.querySelector.mockResolvedValue({ nodeId: 5 });
      mockClient.Runtime.evaluate
        .mockResolvedValueOnce({
          result: {
            value: {
              visible: true,
              enabled: false,
              boundingBox: { x: 100, y: 200, width: 50, height: 30 }
            }
          }
        })
        .mockResolvedValueOnce({
          result: {
            value: { x: 100, y: 200, width: 50, height: 30 }
          }
        });

      const state = await service.checkElementState('.button');

      expect(state.enabled).toBe(false);
      expect(state.visible).toBe(true);
    });

    it('should detect unstable element (position changing)', async () => {
      mockClient.DOM.getDocument.mockResolvedValue({
        root: { nodeId: 1 }
      });
      mockClient.DOM.querySelector.mockResolvedValue({ nodeId: 5 });
      mockClient.Runtime.evaluate
        .mockResolvedValueOnce({
          result: {
            value: {
              visible: true,
              enabled: true,
              boundingBox: { x: 100, y: 200, width: 50, height: 30 }
            }
          }
        })
        .mockResolvedValueOnce({
          result: {
            value: { x: 105, y: 205, width: 50, height: 30 }
          }
        });

      const state = await service.checkElementState('.button');

      expect(state.stable).toBe(false);
    });

    it('should return not ready when element not found', async () => {
      mockClient.DOM.getDocument.mockResolvedValue({
        root: { nodeId: 1 }
      });
      mockClient.DOM.querySelector.mockResolvedValue({ nodeId: 0 });

      const state = await service.checkElementState('.button');

      expect(state.visible).toBe(false);
      expect(state.enabled).toBe(false);
      expect(state.stable).toBe(false);
    });

    it('should handle script evaluation errors', async () => {
      mockClient.DOM.getDocument.mockResolvedValue({
        root: { nodeId: 1 }
      });
      mockClient.DOM.querySelector.mockResolvedValue({ nodeId: 5 });
      mockClient.Runtime.evaluate.mockResolvedValue({
        exceptionDetails: { text: 'Error' }
      });

      const state = await service.checkElementState('.button');

      expect(state.visible).toBe(false);
      expect(state.enabled).toBe(false);
      expect(state.stable).toBe(false);
    });
  });

  describe('waitForReady()', () => {
    it('should return immediately if element already ready (fast path)', async () => {
      mockClient.DOM.getDocument.mockResolvedValue({
        root: { nodeId: 1 }
      });
      mockClient.DOM.querySelector.mockResolvedValue({ nodeId: 5 });
      mockClient.Runtime.evaluate
        .mockResolvedValueOnce({
          result: {
            value: {
              visible: true,
              enabled: true,
              boundingBox: { x: 100, y: 200, width: 50, height: 30 }
            }
          }
        })
        .mockResolvedValueOnce({
          result: {
            value: { x: 100, y: 200, width: 50, height: 30 }
          }
        });

      const startTime = Date.now();
      const result = await service.waitForReady('.button');
      const elapsed = Date.now() - startTime;

      expect(result.ready).toBe(true);
      expect(result.state.visible).toBe(true);
      expect(result.state.enabled).toBe(true);
      expect(result.state.stable).toBe(true);
      // Fast path includes stability check (100ms wait) + some overhead
      expect(elapsed).toBeLessThan(150); // Should be ~100ms for stability check
    });

    it('should poll until element becomes ready', async () => {
      mockClient.DOM.getDocument.mockResolvedValue({
        root: { nodeId: 1 }
      });
      mockClient.DOM.querySelector.mockResolvedValue({ nodeId: 5 });

      let callCount = 0;
      mockClient.Runtime.evaluate.mockImplementation(async () => {
        callCount++;
        if (callCount <= 2) {
          // First check: not visible
          return {
            result: {
              value: {
                visible: false,
                enabled: true,
                boundingBox: { x: 0, y: 0, width: 0, height: 0 }
              }
            }
          };
        } else if (callCount <= 4) {
          // Second check: visible but disabled
          if (callCount % 2 === 1) {
            return {
              result: {
                value: {
                  visible: true,
                  enabled: false,
                  boundingBox: { x: 100, y: 200, width: 50, height: 30 }
                }
              }
            };
          } else {
            return {
              result: {
                value: { x: 100, y: 200, width: 50, height: 30 }
              }
            };
          }
        } else {
          // Third check: ready
          if (callCount % 2 === 1) {
            return {
              result: {
                value: {
                  visible: true,
                  enabled: true,
                  boundingBox: { x: 100, y: 200, width: 50, height: 30 }
                }
              }
            };
          } else {
            return {
              result: {
                value: { x: 100, y: 200, width: 50, height: 30 }
              }
            };
          }
        }
      });

      const result = await service.waitForReady('.button', 1000);

      expect(result.ready).toBe(true);
      expect(callCount).toBeGreaterThan(2);
    });

    it('should timeout and return final state if not ready', async () => {
      mockClient.DOM.getDocument.mockResolvedValue({
        root: { nodeId: 1 }
      });
      mockClient.DOM.querySelector.mockResolvedValue({ nodeId: 5 });
      mockClient.Runtime.evaluate.mockResolvedValue({
        result: {
          value: {
            visible: false,
            enabled: false,
            boundingBox: { x: 0, y: 0, width: 0, height: 0 }
          }
        }
      });

      const result = await service.waitForReady('.button', 200);

      expect(result.ready).toBe(false);
      expect(result.timeElapsed).toBeGreaterThanOrEqual(200);
      expect(result.state.visible).toBe(false);
    });

    it('should respect custom timeout', async () => {
      mockClient.DOM.getDocument.mockResolvedValue({
        root: { nodeId: 1 }
      });
      mockClient.DOM.querySelector.mockResolvedValue({ nodeId: 5 });
      mockClient.Runtime.evaluate.mockResolvedValue({
        result: {
          value: {
            visible: false,
            enabled: false,
            boundingBox: { x: 0, y: 0, width: 0, height: 0 }
          }
        }
      });

      const customTimeout = 150;
      const startTime = Date.now();
      const result = await service.waitForReady('.button', customTimeout);
      const elapsed = Date.now() - startTime;

      expect(result.ready).toBe(false);
      expect(elapsed).toBeGreaterThanOrEqual(customTimeout);
      // Each check includes 100ms stability wait + polling overhead
      // Allow generous buffer for timing variations in test environment
      expect(elapsed).toBeLessThan(customTimeout + 250);
    });
  });

  describe('getBlockingReasons()', () => {
    it('should return empty array for ready element', () => {
      const state = {
        visible: true,
        enabled: true,
        stable: true
      };

      const reasons = service.getBlockingReasons(state);

      expect(reasons).toEqual([]);
    });

    it('should identify visibility issue', () => {
      const state = {
        visible: false,
        enabled: true,
        stable: true
      };

      const reasons = service.getBlockingReasons(state);

      expect(reasons).toHaveLength(1);
      expect(reasons[0]).toContain('not visible');
    });

    it('should identify disabled state', () => {
      const state = {
        visible: true,
        enabled: false,
        stable: true
      };

      const reasons = service.getBlockingReasons(state);

      expect(reasons).toHaveLength(1);
      expect(reasons[0]).toContain('disabled');
    });

    it('should identify unstable position', () => {
      const state = {
        visible: true,
        enabled: true,
        stable: false
      };

      const reasons = service.getBlockingReasons(state);

      expect(reasons).toHaveLength(1);
      expect(reasons[0]).toContain('unstable');
    });

    it('should identify multiple issues', () => {
      const state = {
        visible: false,
        enabled: false,
        stable: false
      };

      const reasons = service.getBlockingReasons(state);

      expect(reasons).toHaveLength(3);
      expect(reasons.some(r => r.includes('visible'))).toBe(true);
      expect(reasons.some(r => r.includes('disabled'))).toBe(true);
      expect(reasons.some(r => r.includes('unstable'))).toBe(true);
    });
  });

  describe('isImmediatelyReady()', () => {
    it('should return true for ready element', async () => {
      mockClient.DOM.getDocument.mockResolvedValue({
        root: { nodeId: 1 }
      });
      mockClient.DOM.querySelector.mockResolvedValue({ nodeId: 5 });
      mockClient.Runtime.evaluate
        .mockResolvedValueOnce({
          result: {
            value: {
              visible: true,
              enabled: true,
              boundingBox: { x: 100, y: 200, width: 50, height: 30 }
            }
          }
        })
        .mockResolvedValueOnce({
          result: {
            value: { x: 100, y: 200, width: 50, height: 30 }
          }
        });

      const ready = await service.isImmediatelyReady('.button');

      expect(ready).toBe(true);
    });

    it('should return false for not ready element', async () => {
      mockClient.DOM.getDocument.mockResolvedValue({
        root: { nodeId: 1 }
      });
      mockClient.DOM.querySelector.mockResolvedValue({ nodeId: 5 });
      mockClient.Runtime.evaluate.mockResolvedValue({
        result: {
          value: {
            visible: false,
            enabled: false,
            boundingBox: { x: 0, y: 0, width: 0, height: 0 }
          }
        }
      });

      const ready = await service.isImmediatelyReady('.button');

      expect(ready).toBe(false);
    });
  });
});
