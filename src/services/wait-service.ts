import CDP from 'chrome-remote-interface';

/**
 * WaitService - Waiting for UI state changes
 *
 * Responsible for polling and waiting for various conditions to be met.
 * Supports element presence, text visibility, URL patterns, and network idle.
 * Depends on CDP client for DOM, Runtime, and Network domain operations.
 */
export class WaitService {
  private static readonly DEFAULT_WAIT_TIMEOUT_MS = 5000;
  private static readonly MAX_WAIT_TIMEOUT_MS = 30000;
  private static readonly WAIT_CHECK_INTERVAL_MS = 100;

  constructor(private client: CDP.Client) {}

  /**
   * Wait for UI state changes after actions
   *
   * Conditions: element (selector), text (content visible), url (pattern match), networkIdle (no requests for Xms)
   * Returns: success boolean, actual state achieved, time elapsed
   *
   * IMPORTANT: Network monitoring is automatically cleaned up when method returns.
   * Multiple concurrent calls are safe - each manages its own Network domain subscription.
   */
  async waitFor(options: {
    element?: string;
    text?: string;
    url?: string;
    networkIdle?: number;
    timeout?: number;
  }): Promise<{
    success: boolean;
    conditions: {
      element?: boolean;
      text?: boolean;
      url?: boolean;
      networkIdle?: boolean;
    };
    actualState: {
      currentUrl: string;
      elementFound: boolean;
      textFound: boolean;
    };
    timeElapsed: number;
  }> {
    const startTime = Date.now();
    const timeout = Math.min(
      options.timeout || WaitService.DEFAULT_WAIT_TIMEOUT_MS,
      WaitService.MAX_WAIT_TIMEOUT_MS
    );
    const checkInterval = WaitService.WAIT_CHECK_INTERVAL_MS;

    try {
      const conditions = {
        element: options.element ? false : undefined,
        text: options.text ? false : undefined,
        url: options.url ? false : undefined,
        networkIdle: options.networkIdle !== undefined ? false : undefined,
      };

      let lastNetworkActivity = Date.now();
      if (options.networkIdle !== undefined) {
        // Monitor network activity
        await this.client.Network.enable();
        this.client.Network.requestWillBeSent(() => {
          lastNetworkActivity = Date.now();
        });
        this.client.Network.loadingFinished(() => {
          lastNetworkActivity = Date.now();
        });
      }

      // Poll for conditions
      while (Date.now() - startTime < timeout) {
        // Check element condition using CDP DOM API
        if (options.element && !conditions.element) {
          try {
            const { root } = await this.client.DOM.getDocument();
            const { nodeId } = await this.client.DOM.querySelector({
              nodeId: root.nodeId,
              selector: options.element
            });
            conditions.element = (nodeId !== undefined && nodeId !== 0);
          } catch {
            conditions.element = false;
          }
        }

        // Check text condition using JSON.stringify for safety
        if (options.text && !conditions.text) {
          const script = `
            (function(textToFind) {
              return document.body.innerText.includes(textToFind);
            })(${JSON.stringify(options.text)})
          `;
          const result = await this.client.Runtime.evaluate({
            expression: script,
            returnByValue: true,
            awaitPromise: true
          });

          if (result.exceptionDetails) {
            throw new Error(`Script execution failed: ${result.exceptionDetails.text}`);
          }

          const textFound = result.result.value;
          if (textFound) {
            conditions.text = true;
          }
        }

        // Check URL condition
        if (options.url && !conditions.url) {
          const result = await this.client.Runtime.evaluate({
            expression: 'window.location.href',
            returnByValue: true
          });
          const currentUrl = result.result.value;
          const urlPattern = new RegExp(options.url);
          if (urlPattern.test(currentUrl)) {
            conditions.url = true;
          }
        }

        // Check network idle condition
        if (options.networkIdle !== undefined && !conditions.networkIdle) {
          const idleTime = Date.now() - lastNetworkActivity;
          if (idleTime >= options.networkIdle) {
            conditions.networkIdle = true;
          }
        }

        // Check if all conditions are met
        const allConditionsMet = Object.values(conditions).every(
          (value) => value === undefined || value === true
        );

        if (allConditionsMet) {
          // Get actual state
          const actualState = await this.getActualState(options);
          return {
            success: true,
            conditions,
            actualState,
            timeElapsed: Date.now() - startTime,
          };
        }

        // Wait before next check
        await new Promise((resolve) => setTimeout(resolve, checkInterval));
      }

      // Timeout reached - return current state without throwing error
      const actualState = await this.getActualState(options);
      return {
        success: false,
        conditions,
        actualState,
        timeElapsed: Date.now() - startTime,
      };
    } catch (error) {
      throw new Error(`Failed to wait for conditions: ${error}`);
    } finally {
      // CLEANUP: Disable Network domain to detach event handlers
      if (options.networkIdle !== undefined) {
        try {
          await this.client.Network.disable();
        } catch (error) {
          // Ignore cleanup errors (client might be disconnected)
          console.error('[waitFor] Network cleanup failed:', error);
        }
      }
    }
  }

  /**
   * Helper method to get actual state for waitFor
   */
  private async getActualState(options: {
    element?: string;
    text?: string;
  }): Promise<{
    currentUrl: string;
    elementFound: boolean;
    textFound: boolean;
  }> {
    const urlResult = await this.client.Runtime.evaluate({
      expression: 'window.location.href',
      returnByValue: true
    });
    const currentUrl = urlResult.result.value;

    let elementFound = false;
    if (options.element) {
      try {
        const { root } = await this.client.DOM.getDocument();
        const { nodeId } = await this.client.DOM.querySelector({
          nodeId: root.nodeId,
          selector: options.element
        });
        elementFound = (nodeId !== undefined && nodeId !== 0);
      } catch {
        elementFound = false;
      }
    }

    let textFound = false;
    if (options.text) {
      const script = `
        (function(textToFind) {
          return document.body.innerText.includes(textToFind);
        })(${JSON.stringify(options.text)})
      `;
      const result = await this.client.Runtime.evaluate({
        expression: script,
        returnByValue: true,
        awaitPromise: true
      });

      if (!result.exceptionDetails) {
        textFound = result.result.value;
      }
    }

    return {
      currentUrl,
      elementFound,
      textFound,
    };
  }
}
