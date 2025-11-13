import CDP from 'chrome-remote-interface';

/**
 * HoverService - Mouse hover interaction
 *
 * Responsible for hovering over elements using CDP Input API.
 * Critical for React SPA compatibility where hover triggers synthetic event setup.
 * All operations use CDP APIs only for security and reliability.
 * Depends on CDP client for DOM and Input operations.
 */
export class HoverService {
  constructor(private client: CDP.Client) {}

  /**
   * Hover over an element using its selector
   *
   * Dispatches mouseMoved event to trigger hover state.
   * Essential for React SPAs where hover activates synthetic event handlers.
   *
   * Performance: O(1) DOM lookup + single Input.dispatchMouseEvent call
   *
   * Security: Uses CDP DOM API for element lookup, no script injection
   *
   * @param selector - CSS selector for the element to hover
   * @returns Success message with element position
   * @throws Error if element not found or hover fails
   */
  async hover(selector: string): Promise<string> {
    try {
      // Find element using CDP's DOM API
      const { root } = await this.client.DOM.getDocument();
      const { nodeId } = await this.client.DOM.querySelector({
        nodeId: root.nodeId,
        selector: selector
      });

      if (!nodeId) {
        throw new Error(JSON.stringify({
          error: "ELEMENT_NOT_FOUND",
          field: "selector",
          message: `Element not found: ${selector}`,
          suggestion: "Verify selector using chrome_check_page or chrome_extract_interactive"
        }));
      }

      // Get element position for hover
      const { model } = await this.client.DOM.getBoxModel({ nodeId });
      const x = (model.content[0] + model.content[2]) / 2;
      const y = (model.content[1] + model.content[5]) / 2;

      // Dispatch mouseMoved event to trigger hover state
      await this.client.Input.dispatchMouseEvent({
        type: 'mouseMoved',
        x,
        y
      });

      return `Hovered over element: ${selector} at position (${x.toFixed(0)}, ${y.toFixed(0)})`;
    } catch (error) {
      throw new Error(`Failed to hover: ${error}`);
    }
  }

  /**
   * Detect SPA framework on the page
   *
   * Checks for common SPA framework globals: React, Vue, Angular, Svelte.
   * Useful for determining if ensureInteractive pattern is needed.
   *
   * Performance: Single Runtime.evaluate call, O(1) framework checks
   *
   * Security: No user input in script execution context
   *
   * @returns Object with detected frameworks and their versions (if available)
   */
  async detectSPAFramework(): Promise<{
    detected: boolean;
    frameworks: Array<{ name: string; version?: string }>;
  }> {
    const detectionScript = `
      (function() {
        const frameworks = [];

        // Check for React
        if (typeof window.React !== 'undefined' ||
            document.querySelector('[data-reactroot], [data-reactid]')) {
          const version = window.React?.version || 'unknown';
          frameworks.push({ name: 'React', version });
        }

        // Check for Vue
        if (typeof window.Vue !== 'undefined' ||
            document.querySelector('[data-v-app], [data-v-]')) {
          const version = window.Vue?.version || 'unknown';
          frameworks.push({ name: 'Vue', version });
        }

        // Check for Angular
        if (typeof window.ng !== 'undefined' ||
            document.querySelector('[ng-version], [ng-app]')) {
          const version = window.ng?.version?.full || 'unknown';
          frameworks.push({ name: 'Angular', version });
        }

        // Check for Svelte (harder to detect, look for Svelte-specific attributes)
        if (document.querySelector('[class*="svelte-"]')) {
          frameworks.push({ name: 'Svelte', version: 'unknown' });
        }

        return {
          detected: frameworks.length > 0,
          frameworks
        };
      })()
    `;

    try {
      const result = await this.client.Runtime.evaluate({
        expression: detectionScript,
        returnByValue: true
      });

      if (result.exceptionDetails) {
        throw new Error(JSON.stringify({
          error: "DETECTION_FAILED",
          message: "Failed to detect SPA frameworks",
          details: result.exceptionDetails.text
        }));
      }

      return result.result.value;
    } catch (error) {
      throw new Error(`Failed to detect SPA framework: ${error}`);
    }
  }
}
