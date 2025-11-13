import CDP from 'chrome-remote-interface';

/**
 * ScrollService - Page scrolling and position detection
 *
 * Responsible for scrolling operations with direction control, distance specification,
 * and scroll position detection (top/bottom). Supports element scrolling via selector.
 * Depends on CDP client for Runtime domain operations (safe script evaluation).
 */
export class ScrollService {
  constructor(private client: CDP.Client) {}

  /**
   * Scroll the page or an element
   *
   * @param options.direction - Scroll direction: 'up', 'down', 'top', 'bottom'
   * @param options.distance - Distance in pixels (for 'up'/'down' only)
   * @param options.selector - Optional CSS selector for element to scroll (default: window)
   * @param options.behavior - Scroll behavior: 'instant' (default) or 'smooth'
   * @returns Scroll state including position, bounds detection, and dimensions
   */
  async scroll(options: {
    direction: 'up' | 'down' | 'top' | 'bottom';
    distance?: number;
    selector?: string;
    behavior?: 'instant' | 'smooth';
  }): Promise<{
    position: { x: number; y: number };
    atTop: boolean;
    atBottom: boolean;
    viewportHeight: number;
    documentHeight: number;
  }> {
    try {
      const { direction, distance, selector, behavior = 'instant' } = options;

      // Validate inputs
      if (direction === 'up' || direction === 'down') {
        if (distance === undefined || distance <= 0) {
          throw new Error('Distance must be a positive number for up/down scrolling');
        }
      }

      // Build scroll script using JSON.stringify for safe parameter passing
      const script = `
        (function(params) {
          const { direction, distance, selector, behavior } = params;

          // Get scroll target (element or window)
          let target;
          let isWindow = !selector;

          if (selector) {
            target = document.querySelector(selector);
            if (!target) {
              throw new Error('Element not found: ' + selector);
            }
          } else {
            target = window;
          }

          // Calculate scroll position based on direction
          let scrollOptions = { behavior };

          if (direction === 'top') {
            if (isWindow) {
              scrollOptions.top = 0;
              window.scrollTo(scrollOptions);
            } else {
              target.scrollTop = 0;
            }
          } else if (direction === 'bottom') {
            if (isWindow) {
              scrollOptions.top = document.documentElement.scrollHeight;
              window.scrollTo(scrollOptions);
            } else {
              target.scrollTop = target.scrollHeight;
            }
          } else if (direction === 'up') {
            if (isWindow) {
              scrollOptions.top = window.scrollY - distance;
              window.scrollBy({ top: -distance, behavior });
            } else {
              target.scrollTop -= distance;
            }
          } else if (direction === 'down') {
            if (isWindow) {
              scrollOptions.top = window.scrollY + distance;
              window.scrollBy({ top: distance, behavior });
            } else {
              target.scrollTop += distance;
            }
          }

          // Wait a moment for scroll to complete (especially for smooth behavior)
          return new Promise((resolve) => {
            setTimeout(() => {
              // Get current scroll position
              const scrollX = isWindow ? window.scrollX : target.scrollLeft;
              const scrollY = isWindow ? window.scrollY : target.scrollTop;

              // Get dimensions
              const viewportHeight = isWindow
                ? window.innerHeight
                : target.clientHeight;
              const documentHeight = isWindow
                ? document.documentElement.scrollHeight
                : target.scrollHeight;

              // Detect if at top or bottom (with 1px tolerance)
              const atTop = scrollY <= 1;
              const atBottom = scrollY + viewportHeight >= documentHeight - 1;

              resolve({
                position: { x: scrollX, y: scrollY },
                atTop,
                atBottom,
                viewportHeight,
                documentHeight
              });
            }, behavior === 'smooth' ? 300 : 50);
          });
        })(${JSON.stringify(options)})
      `;

      const result = await this.client.Runtime.evaluate({
        expression: script,
        returnByValue: true,
        awaitPromise: true
      });

      if (result.exceptionDetails) {
        throw new Error(`Script execution failed: ${result.exceptionDetails.text}`);
      }

      return result.result.value;
    } catch (error) {
      throw new Error(`Failed to scroll: ${error}`);
    }
  }

  /**
   * Get current scroll position without scrolling
   * Useful for checking scroll state before/after actions
   */
  async getScrollPosition(selector?: string): Promise<{
    position: { x: number; y: number };
    atTop: boolean;
    atBottom: boolean;
    viewportHeight: number;
    documentHeight: number;
  }> {
    try {
      const script = `
        (function(selector) {
          let target;
          let isWindow = !selector;

          if (selector) {
            target = document.querySelector(selector);
            if (!target) {
              throw new Error('Element not found: ' + selector);
            }
          } else {
            target = window;
          }

          // Get current scroll position
          const scrollX = isWindow ? window.scrollX : target.scrollLeft;
          const scrollY = isWindow ? window.scrollY : target.scrollTop;

          // Get dimensions
          const viewportHeight = isWindow
            ? window.innerHeight
            : target.clientHeight;
          const documentHeight = isWindow
            ? document.documentElement.scrollHeight
            : target.scrollHeight;

          // Detect if at top or bottom (with 1px tolerance)
          const atTop = scrollY <= 1;
          const atBottom = scrollY + viewportHeight >= documentHeight - 1;

          return {
            position: { x: scrollX, y: scrollY },
            atTop,
            atBottom,
            viewportHeight,
            documentHeight
          };
        })(${JSON.stringify(selector)})
      `;

      const result = await this.client.Runtime.evaluate({
        expression: script,
        returnByValue: true,
        awaitPromise: true
      });

      if (result.exceptionDetails) {
        throw new Error(`Script execution failed: ${result.exceptionDetails.text}`);
      }

      return result.result.value;
    } catch (error) {
      throw new Error(`Failed to get scroll position: ${error}`);
    }
  }
}
