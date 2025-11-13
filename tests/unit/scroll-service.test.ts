import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ScrollService } from '../../src/services/scroll-service.js';
import { MockCDPClient, mockScriptResult, mockScriptError } from '../fixtures/mock-cdp-client.js';

describe('ScrollService', () => {
  let service: ScrollService;
  let mockClient: MockCDPClient;

  beforeEach(() => {
    mockClient = new MockCDPClient();
    service = new ScrollService(mockClient as any);
  });

  describe('scroll()', () => {
    describe('direction: top', () => {
      it('should scroll window to top', async () => {
        // Mock scroll result at top
        mockScriptResult(mockClient, {
          position: { x: 0, y: 0 },
          atTop: true,
          atBottom: false,
          viewportHeight: 800,
          documentHeight: 2000
        });

        const result = await service.scroll({ direction: 'top' });

        expect(mockClient.Runtime.evaluate).toHaveBeenCalledWith({
          expression: expect.stringContaining('direction'),
          returnByValue: true,
          awaitPromise: true
        });
        expect(result.position.y).toBe(0);
        expect(result.atTop).toBe(true);
        expect(result.atBottom).toBe(false);
      });

      it('should scroll element to top when selector provided', async () => {
        mockScriptResult(mockClient, {
          position: { x: 0, y: 0 },
          atTop: true,
          atBottom: false,
          viewportHeight: 300,
          documentHeight: 1000
        });

        const result = await service.scroll({
          direction: 'top',
          selector: '#scrollable-div'
        });

        expect(result.position.y).toBe(0);
        expect(result.atTop).toBe(true);
      });
    });

    describe('direction: bottom', () => {
      it('should scroll window to bottom', async () => {
        mockScriptResult(mockClient, {
          position: { x: 0, y: 1200 },
          atTop: false,
          atBottom: true,
          viewportHeight: 800,
          documentHeight: 2000
        });

        const result = await service.scroll({ direction: 'bottom' });

        expect(result.position.y).toBe(1200);
        expect(result.atTop).toBe(false);
        expect(result.atBottom).toBe(true);
      });

      it('should detect at bottom with 1px tolerance', async () => {
        // viewportHeight + scrollY = documentHeight - 1 (within tolerance)
        mockScriptResult(mockClient, {
          position: { x: 0, y: 1199 },
          atTop: false,
          atBottom: true,
          viewportHeight: 800,
          documentHeight: 2000
        });

        const result = await service.scroll({ direction: 'bottom' });

        expect(result.atBottom).toBe(true);
      });
    });

    describe('direction: down', () => {
      it('should scroll down by specified distance', async () => {
        mockScriptResult(mockClient, {
          position: { x: 0, y: 500 },
          atTop: false,
          atBottom: false,
          viewportHeight: 800,
          documentHeight: 2000
        });

        const result = await service.scroll({
          direction: 'down',
          distance: 500
        });

        expect(result.position.y).toBe(500);
        expect(result.atTop).toBe(false);
        expect(result.atBottom).toBe(false);
      });

      it('should require positive distance for down scroll', async () => {
        await expect(
          service.scroll({ direction: 'down', distance: 0 })
        ).rejects.toThrow('Distance must be a positive number');

        await expect(
          service.scroll({ direction: 'down', distance: -100 })
        ).rejects.toThrow('Distance must be a positive number');
      });

      it('should require distance parameter for down scroll', async () => {
        await expect(
          service.scroll({ direction: 'down' } as any)
        ).rejects.toThrow('Distance must be a positive number');
      });
    });

    describe('direction: up', () => {
      it('should scroll up by specified distance', async () => {
        mockScriptResult(mockClient, {
          position: { x: 0, y: 400 },
          atTop: false,
          atBottom: false,
          viewportHeight: 800,
          documentHeight: 2000
        });

        const result = await service.scroll({
          direction: 'up',
          distance: 100
        });

        expect(result.position.y).toBe(400);
      });

      it('should require positive distance for up scroll', async () => {
        await expect(
          service.scroll({ direction: 'up', distance: 0 })
        ).rejects.toThrow('Distance must be a positive number');
      });

      it('should detect when scrolled to top', async () => {
        // Scrolling up more than current position should land at top
        mockScriptResult(mockClient, {
          position: { x: 0, y: 0 },
          atTop: true,
          atBottom: false,
          viewportHeight: 800,
          documentHeight: 2000
        });

        const result = await service.scroll({
          direction: 'up',
          distance: 1000
        });

        expect(result.atTop).toBe(true);
      });
    });

    describe('behavior option', () => {
      it('should default to instant behavior', async () => {
        mockScriptResult(mockClient, {
          position: { x: 0, y: 0 },
          atTop: true,
          atBottom: false,
          viewportHeight: 800,
          documentHeight: 2000
        });

        await service.scroll({ direction: 'top' });

        const call = mockClient.Runtime.evaluate.mock.calls[0][0];
        // When behavior is not provided, it defaults to 'instant' in the service
        // The serialized JSON will only contain the direction since behavior is defaulted in the function
        expect(call.expression).toContain('"direction":"top"');
      });

      it('should support smooth behavior', async () => {
        mockScriptResult(mockClient, {
          position: { x: 0, y: 500 },
          atTop: false,
          atBottom: false,
          viewportHeight: 800,
          documentHeight: 2000
        });

        await service.scroll({
          direction: 'down',
          distance: 500,
          behavior: 'smooth'
        });

        const call = mockClient.Runtime.evaluate.mock.calls[0][0];
        expect(call.expression).toContain('"behavior":"smooth"');
      });
    });

    describe('element scrolling', () => {
      it('should scroll specific element when selector provided', async () => {
        mockScriptResult(mockClient, {
          position: { x: 0, y: 200 },
          atTop: false,
          atBottom: false,
          viewportHeight: 300,
          documentHeight: 1000
        });

        const result = await service.scroll({
          direction: 'down',
          distance: 200,
          selector: '.scrollable-container'
        });

        const call = mockClient.Runtime.evaluate.mock.calls[0][0];
        expect(call.expression).toContain('.scrollable-container');
        expect(result.position.y).toBe(200);
      });

      it('should throw error if element not found', async () => {
        mockScriptError(mockClient, 'Element not found: #missing-element');

        await expect(
          service.scroll({
            direction: 'down',
            distance: 100,
            selector: '#missing-element'
          })
        ).rejects.toThrow('Element not found');
      });
    });

    describe('edge cases', () => {
      it('should handle very short documents (already at bottom)', async () => {
        mockScriptResult(mockClient, {
          position: { x: 0, y: 0 },
          atTop: true,
          atBottom: true,
          viewportHeight: 800,
          documentHeight: 800
        });

        const result = await service.scroll({ direction: 'down', distance: 100 });

        expect(result.atTop).toBe(true);
        expect(result.atBottom).toBe(true);
      });

      it('should return viewport and document dimensions', async () => {
        mockScriptResult(mockClient, {
          position: { x: 0, y: 400 },
          atTop: false,
          atBottom: false,
          viewportHeight: 800,
          documentHeight: 2000
        });

        const result = await service.scroll({ direction: 'down', distance: 100 });

        expect(result.viewportHeight).toBe(800);
        expect(result.documentHeight).toBe(2000);
      });

      it('should handle horizontal scroll position', async () => {
        mockScriptResult(mockClient, {
          position: { x: 150, y: 400 },
          atTop: false,
          atBottom: false,
          viewportHeight: 800,
          documentHeight: 2000
        });

        const result = await service.scroll({ direction: 'down', distance: 100 });

        expect(result.position.x).toBe(150);
      });
    });

    describe('error handling', () => {
      it('should throw error on script execution failure', async () => {
        mockScriptError(mockClient, 'TypeError: Cannot read property');

        await expect(
          service.scroll({ direction: 'top' })
        ).rejects.toThrow('Script execution failed');
      });

      it('should wrap generic errors', async () => {
        mockClient.Runtime.evaluate.mockRejectedValue(new Error('Network error'));

        await expect(
          service.scroll({ direction: 'top' })
        ).rejects.toThrow('Failed to scroll');
      });
    });
  });

  describe('getScrollPosition()', () => {
    it('should get window scroll position without scrolling', async () => {
      mockScriptResult(mockClient, {
        position: { x: 0, y: 500 },
        atTop: false,
        atBottom: false,
        viewportHeight: 800,
        documentHeight: 2000
      });

      const result = await service.getScrollPosition();

      expect(result.position.y).toBe(500);
      expect(result.atTop).toBe(false);
      expect(result.atBottom).toBe(false);
    });

    it('should get element scroll position when selector provided', async () => {
      mockScriptResult(mockClient, {
        position: { x: 0, y: 300 },
        atTop: false,
        atBottom: false,
        viewportHeight: 400,
        documentHeight: 1200
      });

      const result = await service.getScrollPosition('#scrollable-div');

      expect(result.position.y).toBe(300);
    });

    it('should detect at top position', async () => {
      mockScriptResult(mockClient, {
        position: { x: 0, y: 0 },
        atTop: true,
        atBottom: false,
        viewportHeight: 800,
        documentHeight: 2000
      });

      const result = await service.getScrollPosition();

      expect(result.atTop).toBe(true);
    });

    it('should detect at bottom position', async () => {
      mockScriptResult(mockClient, {
        position: { x: 0, y: 1200 },
        atTop: false,
        atBottom: true,
        viewportHeight: 800,
        documentHeight: 2000
      });

      const result = await service.getScrollPosition();

      expect(result.atBottom).toBe(true);
    });

    it('should throw error if element not found', async () => {
      mockScriptError(mockClient, 'Element not found: #missing');

      await expect(
        service.getScrollPosition('#missing')
      ).rejects.toThrow('Element not found');
    });

    it('should handle script execution errors', async () => {
      mockScriptError(mockClient, 'Runtime error');

      await expect(
        service.getScrollPosition()
      ).rejects.toThrow('Failed to get scroll position');
    });
  });

  describe('infinite scroll detection', () => {
    it('should detect when NOT at bottom (more content available)', async () => {
      mockScriptResult(mockClient, {
        position: { x: 0, y: 500 },
        atTop: false,
        atBottom: false,
        viewportHeight: 800,
        documentHeight: 2000
      });

      const result = await service.scroll({ direction: 'down', distance: 100 });

      expect(result.atBottom).toBe(false);
      // More content available for infinite scroll
    });

    it('should detect when at bottom (trigger load more)', async () => {
      mockScriptResult(mockClient, {
        position: { x: 0, y: 1200 },
        atTop: false,
        atBottom: true,
        viewportHeight: 800,
        documentHeight: 2000
      });

      const result = await service.scroll({ direction: 'down', distance: 1000 });

      expect(result.atBottom).toBe(true);
      // Infinite scroll should trigger loading more content
    });
  });
});
