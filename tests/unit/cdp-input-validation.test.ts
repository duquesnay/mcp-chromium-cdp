import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ChromeController } from '../../src/chrome-controller.js';
import { MockCDPClient, mockElementNotFound } from '../fixtures/mock-cdp-client.js';

/**
 * CDP-based Input Implementation Tests
 *
 * PURPOSE: Validate that click() and type() use CDP Input APIs instead of
 * JavaScript element manipulation, proving they work with React frontends.
 *
 * CONTEXT: User reported programmatic .click() calls were blocked on React
 * sites like Claude.ai. We fixed this by using CDP Input.dispatchMouseEvent
 * and Input.dispatchKeyEvent which dispatch real browser events that React
 * can intercept.
 *
 * VALIDATION STRATEGY:
 * 1. Verify NO Runtime.evaluate calls with user input (no script injection)
 * 2. Verify DOES use Input.dispatchMouseEvent for clicks
 * 3. Verify DOES use Input.dispatchKeyEvent for typing
 * 4. Verify coordinates calculated from DOM (not querySelector)
 * 5. Verify security: malicious input handled safely
 * 6. Verify React compatibility: real events dispatched
 */
describe('CDP-based Input Implementation (React-safe)', () => {
  let controller: ChromeController;
  let mockClient: MockCDPClient;

  beforeEach(() => {
    mockClient = new MockCDPClient();
    controller = new ChromeController();
    // Inject mock client to bypass connection
    (controller as any).client = mockClient;
  });

  describe('click() - CDP Input.dispatchMouseEvent', () => {
    it('should use CDP Input API instead of JavaScript .click()', async () => {
      await controller.click('#button');

      // CRITICAL: Verify NO Runtime.evaluate with .click() call
      // If Runtime.evaluate is called, it means we're using JavaScript
      // instead of CDP, which React frontends can block
      const evaluateCalls = mockClient.Runtime.evaluate.mock.calls;
      const hasClickScript = evaluateCalls.some(call =>
        call[0]?.expression?.includes('.click()')
      );
      expect(hasClickScript).toBe(false);

      // CRITICAL: Verify DOES use Input.dispatchMouseEvent
      // These dispatch real browser events that React can intercept
      expect(mockClient.Input.dispatchMouseEvent).toHaveBeenCalledTimes(2);
      expect(mockClient.Input.dispatchMouseEvent).toHaveBeenNthCalledWith(1, {
        type: 'mousePressed',
        x: 30, // calculated from mock box model (10+50)/2
        y: 30, // calculated from mock box model (10+50)/2
        button: 'left',
        clickCount: 1
      });
      expect(mockClient.Input.dispatchMouseEvent).toHaveBeenNthCalledWith(2, {
        type: 'mouseReleased',
        x: 30,
        y: 30,
        button: 'left',
        clickCount: 1
      });
    });

    it('should calculate click coordinates from element bounding box', async () => {
      // Mock element at position (100, 50) with size 200x100
      // Box model returns 8 points: x1,y1, x2,y2, x3,y3, x4,y4
      mockClient.DOM.getBoxModel.mockResolvedValue({
        model: {
          content: [100, 50, 300, 50, 300, 150, 100, 150] // rectangle vertices
        }
      });

      await controller.click('#element');

      // Should click at center: x=(100+300)/2=200, y=(50+150)/2=100
      const mouseDownCall = mockClient.Input.dispatchMouseEvent.mock.calls[0][0];
      expect(mouseDownCall.x).toBe(200);
      expect(mouseDownCall.y).toBe(100);
    });

    it('should get element position via CDP DOM API (not querySelector)', async () => {
      await controller.click('#react-button');

      // Verify uses CDP DOM.querySelector (safe - protocol-level)
      // This is different from JavaScript document.querySelector which
      // React frontends can interfere with
      expect(mockClient.DOM.querySelector).toHaveBeenCalledWith({
        nodeId: 1,
        selector: '#react-button'
      });

      // Verify gets box model for coordinates
      expect(mockClient.DOM.getBoxModel).toHaveBeenCalledWith({ nodeId: 2 });
    });

    it('should work with complex selectors', async () => {
      await controller.click('button[data-testid="connect-oauth"]');

      expect(mockClient.DOM.querySelector).toHaveBeenCalledWith({
        nodeId: 1,
        selector: 'button[data-testid="connect-oauth"]'
      });
      expect(mockClient.Input.dispatchMouseEvent).toHaveBeenCalledTimes(2);
    });

    it('should throw error if element not found', async () => {
      mockElementNotFound(mockClient);

      await expect(controller.click('#missing')).rejects.toThrow('Element not found: #missing');

      // Should NOT attempt to click if element doesn't exist
      expect(mockClient.Input.dispatchMouseEvent).not.toHaveBeenCalled();
    });

    it('should handle special characters in selector safely', async () => {
      // Complex selector with special characters
      const complexSelector = 'div[data-id="test\'s-button"] > button.action';

      await controller.click(complexSelector);

      // CDP protocol handles selector sanitization internally
      expect(mockClient.DOM.querySelector).toHaveBeenCalledWith({
        nodeId: 1,
        selector: complexSelector
      });

      // Should still dispatch mouse events
      expect(mockClient.Input.dispatchMouseEvent).toHaveBeenCalledTimes(2);
    });
  });

  describe('type() - CDP Input.dispatchKeyEvent', () => {
    it('should use CDP Input API instead of setting element.value', async () => {
      await controller.type('#input', 'test');

      // CRITICAL: Verify NO Runtime.evaluate setting value
      // If we set element.value directly, React won't see onChange events
      const evaluateCalls = mockClient.Runtime.evaluate.mock.calls;
      const hasValueSet = evaluateCalls.some(call =>
        call[0]?.expression?.includes('.value =') ||
        call[0]?.expression?.includes('.value=')
      );
      expect(hasValueSet).toBe(false);

      // CRITICAL: Verify DOES use Input.dispatchKeyEvent
      // These dispatch real keyboard events that React onChange handlers capture
      expect(mockClient.Input.dispatchKeyEvent).toHaveBeenCalledTimes(8); // 4 chars × 2 events (down+up)
    });

    it('should dispatch keyDown and keyUp for each character', async () => {
      await controller.type('#input', 'hi');

      const calls = mockClient.Input.dispatchKeyEvent.mock.calls;

      // 'h' keyDown
      expect(calls[0][0]).toMatchObject({
        type: 'keyDown',
        text: 'h'
      });
      // 'h' keyUp
      expect(calls[1][0]).toMatchObject({
        type: 'keyUp',
        text: 'h'
      });
      // 'i' keyDown
      expect(calls[2][0]).toMatchObject({
        type: 'keyDown',
        text: 'i'
      });
      // 'i' keyUp
      expect(calls[3][0]).toMatchObject({
        type: 'keyUp',
        text: 'i'
      });
    });

    it('should focus element using CDP DOM API', async () => {
      await controller.type('#email', 'user@example.com');

      // Verify focuses via CDP (not JavaScript document.querySelector().focus())
      expect(mockClient.DOM.focus).toHaveBeenCalledWith({ nodeId: 2 });

      // Verify finds element via CDP
      expect(mockClient.DOM.querySelector).toHaveBeenCalledWith({
        nodeId: 1,
        selector: '#email'
      });
    });

    it('should handle special characters safely (no script injection)', async () => {
      const maliciousText = "'; alert('xss'); //";

      await controller.type('#input', maliciousText);

      // Should type each character individually via CDP
      // Total: 20 characters × 2 events (keyDown + keyUp) = 40 calls
      expect(mockClient.Input.dispatchKeyEvent).toHaveBeenCalledTimes(maliciousText.length * 2);

      // CRITICAL: Verify no Runtime.evaluate (no script execution)
      // If Runtime.evaluate is called, malicious input could execute as script
      const evaluateCalls = mockClient.Runtime.evaluate.mock.calls;
      const hasUserInput = evaluateCalls.some(call =>
        call[0]?.expression?.includes(maliciousText)
      );
      expect(hasUserInput).toBe(false);
    });

    it('should handle multiline text', async () => {
      const multilineText = "line1\nline2\nline3";

      await controller.type('#textarea', multilineText);

      // Should type all characters including newlines
      expect(mockClient.Input.dispatchKeyEvent).toHaveBeenCalledTimes(multilineText.length * 2);

      // Verify newline character is sent correctly
      const calls = mockClient.Input.dispatchKeyEvent.mock.calls;
      const newlineCalls = calls.filter(call => call[0].text === '\n');
      expect(newlineCalls.length).toBe(4); // 2 newlines × 2 events (down+up)
    });

    it('should throw error if element not found', async () => {
      mockElementNotFound(mockClient);

      await expect(controller.type('#missing', 'text')).rejects.toThrow('Element not found: #missing');

      // Should NOT attempt to type if element doesn't exist
      expect(mockClient.Input.dispatchKeyEvent).not.toHaveBeenCalled();
    });
  });

  describe('Security: No Script Injection', () => {
    it('click should never inject selector into JavaScript context', async () => {
      // Malicious selector that would break out of script if concatenated
      const maliciousSelector = "'; alert('xss'); document.querySelector('";

      // CDP protocol handles selector safely - invalid selectors return nodeId 0
      // Controller throws error for nodeId 0 (element not found)
      mockClient.DOM.querySelector.mockResolvedValue({ nodeId: 0 });

      await expect(controller.click(maliciousSelector)).rejects.toThrow('Element not found');

      // CRITICAL: Verify Runtime.evaluate was NEVER called
      // CDP protocol handles selector safely at protocol level (no script injection)
      expect(mockClient.Runtime.evaluate).not.toHaveBeenCalled();
    });

    it('type should never inject text into JavaScript context', async () => {
      const maliciousText = "'; document.location='http://evil.com'; //";

      await controller.type('#input', maliciousText);

      // CRITICAL: Should type as literal text, not execute as script
      expect(mockClient.Runtime.evaluate).not.toHaveBeenCalled();
      expect(mockClient.Input.dispatchKeyEvent).toHaveBeenCalled();

      // Verify each character typed individually (no script concatenation)
      const calls = mockClient.Input.dispatchKeyEvent.mock.calls;
      expect(calls.every(call => call[0].text.length === 1)).toBe(true);
    });

    it('should handle unicode characters safely', async () => {
      const unicodeText = "Hello 世界 🌍 émojis";

      await controller.type('#input', unicodeText);

      // Should handle unicode correctly via CDP
      // Note: JavaScript .length counts UTF-16 code units, emojis may be 2 units
      // But the important thing is no Runtime.evaluate (no script injection)
      expect(mockClient.Input.dispatchKeyEvent).toHaveBeenCalled();
      expect(mockClient.Runtime.evaluate).not.toHaveBeenCalled();
    });

    it('should handle null bytes and control characters', async () => {
      const controlChars = "test\x00\x01\x02";

      await controller.type('#input', controlChars);

      // Should send all characters via CDP (protocol handles binary safely)
      expect(mockClient.Input.dispatchKeyEvent).toHaveBeenCalledTimes(controlChars.length * 2);
      expect(mockClient.Runtime.evaluate).not.toHaveBeenCalled();
    });
  });

  describe('React Event Handling Compatibility', () => {
    it('should trigger real mouse events that React can intercept', async () => {
      // React buttons have onClick handlers that listen for real mouse events
      // If we use .click(), React's synthetic event system won't fire
      await controller.click('button.react-component');

      // Verify dispatches actual browser-level mouse events
      // These are the same events a real user mouse generates
      expect(mockClient.Input.dispatchMouseEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'mousePressed',
          button: 'left',
          clickCount: 1
        })
      );
      expect(mockClient.Input.dispatchMouseEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'mouseReleased',
          button: 'left'
        })
      );

      // These are REAL browser events that React's event system captures
      // via its event delegation on the document root
    });

    it('should trigger keyboard events that React forms can capture', async () => {
      // React forms have onChange handlers that listen for real keyboard events
      // If we set .value directly, onChange won't fire
      await controller.type('input.react-controlled', 'value');

      // Verify dispatches actual browser-level keyboard events
      expect(mockClient.Input.dispatchKeyEvent).toHaveBeenCalledWith(
        expect.objectContaining({ type: 'keyDown' })
      );
      expect(mockClient.Input.dispatchKeyEvent).toHaveBeenCalledWith(
        expect.objectContaining({ type: 'keyUp' })
      );

      // These trigger React's onChange/onKeyDown/onKeyUp synthetic events
      // React wraps native events and bubbles them through the component tree
    });

    it('should work with React StrictMode (double-invocation)', async () => {
      // React StrictMode may invoke event handlers twice in development
      // Our CDP approach is idempotent - same events, same result
      await controller.click('#strict-mode-button');

      // Each dispatchMouseEvent call is independent and safe to repeat
      expect(mockClient.Input.dispatchMouseEvent).toHaveBeenCalledTimes(2);
    });

    it('should work with React event delegation', async () => {
      // React attaches event listeners to document root, not individual elements
      // Our CDP Input events bubble correctly through the DOM
      await controller.click('div.nested > button.deep-child');

      // CDP dispatches events at the element level
      // They bubble up naturally through the DOM tree
      // React's document-level listener intercepts them
      expect(mockClient.DOM.querySelector).toHaveBeenCalled();
      expect(mockClient.Input.dispatchMouseEvent).toHaveBeenCalled();
    });

    it('should work with React controlled components', async () => {
      // Controlled components: value is controlled by React state
      // onChange handler must fire to update state
      await controller.type('input[type="email"]', 'user@test.com');

      // Each keyDown/keyUp triggers onChange in React
      // React updates state, component re-renders with new value
      const keyEventCount = mockClient.Input.dispatchKeyEvent.mock.calls.length;
      expect(keyEventCount).toBe('user@test.com'.length * 2); // down+up for each char
    });
  });

  describe('CDP Protocol Usage Patterns', () => {
    it('should use DOM.getDocument before querySelector', async () => {
      await controller.click('#button');

      // CDP protocol requires getting document root first
      expect(mockClient.DOM.getDocument).toHaveBeenCalled();

      // Then query from that root
      const getDocCall = await mockClient.DOM.getDocument.mock.results[0].value;
      expect(getDocCall).toHaveProperty('root.nodeId');
    });

    it('should use DOM.getBoxModel for element geometry', async () => {
      await controller.click('#button');

      // CDP provides element layout info via DOM.getBoxModel
      // Returns content, padding, border, margin boxes
      expect(mockClient.DOM.getBoxModel).toHaveBeenCalledWith({ nodeId: 2 });

      // We use content box (innermost) for click coordinates
      const boxModelResult = await mockClient.DOM.getBoxModel({ nodeId: 2 });
      expect(boxModelResult.model).toHaveProperty('content');
    });

    it('should use DOM.focus before typing', async () => {
      await controller.type('#input', 'text');

      // CDP requires explicit focus before keyboard input
      // This ensures keyboard events go to the right element
      expect(mockClient.DOM.focus).toHaveBeenCalledWith({ nodeId: 2 });

      // Focus should happen before first key event
      const focusCallIndex = mockClient.DOM.focus.mock.invocationCallOrder[0];
      const firstKeyCallIndex = mockClient.Input.dispatchKeyEvent.mock.invocationCallOrder[0];
      expect(focusCallIndex).toBeLessThan(firstKeyCallIndex);
    });

    it('should handle CDP nodeId correctly', async () => {
      // CDP uses numeric nodeIds to reference DOM elements
      // nodeId 0 means element not found
      mockClient.DOM.querySelector.mockResolvedValue({ nodeId: 42 });

      await controller.click('#button');

      // Should use the returned nodeId for subsequent operations
      expect(mockClient.DOM.getBoxModel).toHaveBeenCalledWith({ nodeId: 42 });
    });

    it('should handle nodeId 0 as element not found', async () => {
      mockClient.DOM.querySelector.mockResolvedValue({ nodeId: 0 });

      await expect(controller.click('#missing')).rejects.toThrow('Element not found');

      // Should not proceed with nodeId 0
      expect(mockClient.DOM.getBoxModel).not.toHaveBeenCalled();
    });
  });

  describe('Performance and Efficiency', () => {
    it('should minimize CDP protocol calls for click', async () => {
      await controller.click('#button');

      // Optimal path: getDocument → querySelector → getBoxModel → 2× dispatchMouseEvent
      expect(mockClient.DOM.getDocument).toHaveBeenCalledTimes(1);
      expect(mockClient.DOM.querySelector).toHaveBeenCalledTimes(1);
      expect(mockClient.DOM.getBoxModel).toHaveBeenCalledTimes(1);
      expect(mockClient.Input.dispatchMouseEvent).toHaveBeenCalledTimes(2);

      // Should NOT make redundant calls
      expect(mockClient.Runtime.evaluate).not.toHaveBeenCalled();
    });

    it('should minimize CDP protocol calls for type', async () => {
      const text = "abc";
      await controller.type('#input', text);

      // Optimal path: getDocument → querySelector → focus → N× dispatchKeyEvent
      expect(mockClient.DOM.getDocument).toHaveBeenCalledTimes(1);
      expect(mockClient.DOM.querySelector).toHaveBeenCalledTimes(1);
      expect(mockClient.DOM.focus).toHaveBeenCalledTimes(1);
      expect(mockClient.Input.dispatchKeyEvent).toHaveBeenCalledTimes(text.length * 2);

      // Should NOT make redundant calls
      expect(mockClient.Runtime.evaluate).not.toHaveBeenCalled();
    });

    it('should batch keyboard events efficiently', async () => {
      const longText = "a".repeat(100);

      await controller.type('#input', longText);

      // Should send exactly 200 events (100 chars × 2 events)
      // No redundant focus or querySelector calls
      expect(mockClient.Input.dispatchKeyEvent).toHaveBeenCalledTimes(200);
      expect(mockClient.DOM.focus).toHaveBeenCalledTimes(1);
    });
  });

  describe('Edge Cases and Error Handling', () => {
    it('should handle empty string typing', async () => {
      await controller.type('#input', '');

      // Should focus but not dispatch any key events
      expect(mockClient.DOM.focus).toHaveBeenCalled();
      expect(mockClient.Input.dispatchKeyEvent).not.toHaveBeenCalled();
    });

    it('should handle clicking element with zero-size bounding box', async () => {
      // Element exists but has no dimensions (display: none, etc.)
      mockClient.DOM.getBoxModel.mockResolvedValue({
        model: {
          content: [100, 100, 100, 100, 100, 100, 100, 100] // zero-size box
        }
      });

      await controller.click('#invisible');

      // Should still calculate center (100, 100)
      expect(mockClient.Input.dispatchMouseEvent).toHaveBeenCalledWith(
        expect.objectContaining({ x: 100, y: 100 })
      );
    });

    it('should handle very long text input', async () => {
      const longText = "x".repeat(10000);

      await controller.type('#textarea', longText);

      // Should handle all characters without crashing
      expect(mockClient.Input.dispatchKeyEvent).toHaveBeenCalledTimes(20000);
    });

    it('should handle typing into disabled elements', async () => {
      // Controller doesn't check disabled state - that's browser's job
      // CDP will dispatch events, browser will ignore them
      await controller.type('#disabled-input', 'text');

      // Events dispatched (browser decides whether to process them)
      expect(mockClient.Input.dispatchKeyEvent).toHaveBeenCalled();
    });

    it('should handle clicking invisible elements', async () => {
      // Controller doesn't check visibility - CDP dispatches to coordinates
      // Whether click takes effect depends on browser's event handling
      await controller.click('#invisible-button');

      // Events dispatched at calculated coordinates
      expect(mockClient.Input.dispatchMouseEvent).toHaveBeenCalledTimes(2);
    });
  });
});
