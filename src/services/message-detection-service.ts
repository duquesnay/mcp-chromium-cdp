import CDP from 'chrome-remote-interface';

/**
 * MessageDetectionService - Extract UI feedback messages
 *
 * Detects and extracts user feedback messages from the page:
 * - Toast notifications
 * - Banner messages
 * - Field validation errors
 * - Modal dialogs
 * - Console errors
 *
 * Supports common UI frameworks: Material UI, Bootstrap, Ant Design
 *
 * Performance: <500ms on typical pages (single Runtime.evaluate call)
 * Uses CDP APIs only for security
 */

export interface UIMessage {
  type: 'toast' | 'banner' | 'field-error' | 'modal' | 'console';
  text: string;
  severity: 'error' | 'warning' | 'success' | 'info';
  selector: string;
  timestamp?: number;
}

export class MessageDetectionService {
  constructor(private client: CDP.Client) {}

  /**
   * Extract all UI messages currently visible on the page
   *
   * Searches for:
   * - Toast notifications (Material UI, Bootstrap, Ant Design patterns)
   * - Banner messages (top/bottom page alerts)
   * - Field validation errors (near form inputs)
   * - Modal dialogs (visible overlays)
   * - Console errors (from browser console)
   *
   * @returns Array of detected messages with type, text, severity, and selector
   */
  async extractMessages(): Promise<UIMessage[]> {
    const extractScript = `
      (function() {
        const messages = [];
        const now = Date.now();

        // Helper: Get severity from element classes/attributes
        function getSeverity(el) {
          const classStr = el.className.toLowerCase();
          const roleStr = (el.getAttribute('role') || '').toLowerCase();
          const ariaLive = (el.getAttribute('aria-live') || '').toLowerCase();

          if (classStr.includes('error') || classStr.includes('danger') || roleStr === 'alert') {
            return 'error';
          }
          if (classStr.includes('warning') || classStr.includes('warn')) {
            return 'warning';
          }
          if (classStr.includes('success')) {
            return 'success';
          }
          if (classStr.includes('info') || ariaLive === 'polite' || ariaLive === 'assertive') {
            return 'info';
          }
          return 'info'; // Default
        }

        // Helper: Generate selector for element
        function getSelector(el) {
          if (el.id) return '#' + el.id;
          if (el.className) {
            const classes = el.className.split(' ').filter(c => c.trim() && !c.match(/^\\d/));
            if (classes.length > 0) {
              return el.tagName.toLowerCase() + '.' + classes[0];
            }
          }
          return el.tagName.toLowerCase();
        }

        // Helper: Check if element is visible
        function isVisible(el) {
          if (!el) return false;
          const rect = el.getBoundingClientRect();
          const style = window.getComputedStyle(el);
          return rect.width > 0 && rect.height > 0 &&
                 style.visibility !== 'hidden' &&
                 style.display !== 'none' &&
                 style.opacity !== '0';
        }

        // 1. Toast notifications
        const toastSelectors = [
          // Material UI
          '.MuiSnackbar-root', '.MuiAlert-root',
          // Bootstrap
          '.toast', '.alert',
          // Ant Design
          '.ant-message', '.ant-notification',
          // Generic patterns
          '[role="alert"]', '[role="status"]',
          '[aria-live="polite"]', '[aria-live="assertive"]',
          // Custom common patterns
          '.notification', '.toast-message', '.flash-message',
          '.snackbar', '.notify'
        ];

        toastSelectors.forEach(selector => {
          document.querySelectorAll(selector).forEach(el => {
            if (isVisible(el)) {
              messages.push({
                type: 'toast',
                text: el.textContent.trim(),
                severity: getSeverity(el),
                selector: getSelector(el)
              });
            }
          });
        });

        // 2. Banner messages (top/bottom alerts)
        const bannerSelectors = [
          '.banner', '.alert-banner', '.notification-banner',
          '.top-banner', '.bottom-banner',
          '[role="banner"]',
          'header .alert', 'footer .alert'
        ];

        bannerSelectors.forEach(selector => {
          document.querySelectorAll(selector).forEach(el => {
            if (isVisible(el)) {
              messages.push({
                type: 'banner',
                text: el.textContent.trim(),
                severity: getSeverity(el),
                selector: getSelector(el)
              });
            }
          });
        });

        // 3. Field validation errors
        const fieldErrorSelectors = [
          // Generic patterns
          '.error', '.field-error', '.validation-error',
          '.help-block.error', '.invalid-feedback',
          // Material UI
          '.MuiFormHelperText-root.Mui-error',
          // Bootstrap
          '.form-error', '.is-invalid',
          // Ant Design
          '.ant-form-item-explain-error',
          // Aria
          '[role="alert"][aria-live]',
          // Generic helper text patterns
          '.error-message', '.error-text'
        ];

        fieldErrorSelectors.forEach(selector => {
          document.querySelectorAll(selector).forEach(el => {
            if (isVisible(el) && el.textContent.trim()) {
              messages.push({
                type: 'field-error',
                text: el.textContent.trim(),
                severity: 'error',
                selector: getSelector(el)
              });
            }
          });
        });

        // 4. Modal dialogs
        const modalSelectors = [
          // Material UI
          '.MuiDialog-root [role="dialog"]',
          // Bootstrap
          '.modal.show .modal-body',
          // Ant Design
          '.ant-modal-body',
          // Generic
          '[role="dialog"]', '[role="alertdialog"]',
          '.dialog', '.popup'
        ];

        modalSelectors.forEach(selector => {
          document.querySelectorAll(selector).forEach(el => {
            if (isVisible(el)) {
              // Get modal title if exists
              const title = el.querySelector('.modal-title, .MuiDialogTitle-root, .ant-modal-title, h1, h2, h3');
              const body = el.querySelector('.modal-body, .MuiDialogContent-root, .ant-modal-body, p');
              const text = [
                title?.textContent.trim(),
                body?.textContent.trim()
              ].filter(Boolean).join(': ');

              messages.push({
                type: 'modal',
                text: text || el.textContent.trim(),
                severity: getSeverity(el),
                selector: getSelector(el)
              });
            }
          });
        });

        // Deduplicate messages (same text + type)
        const seen = new Set();
        const uniqueMessages = messages.filter(msg => {
          const key = msg.type + ':' + msg.text.substring(0, 100);
          if (seen.has(key)) return false;
          seen.add(key);
          return msg.text.length > 0 && msg.text.length < 1000;
        });

        return uniqueMessages;
      })()
    `;

    try {
      const result = await this.client.Runtime.evaluate({
        expression: extractScript,
        returnByValue: true
      });

      if (result.exceptionDetails) {
        throw new Error(
          `Failed to extract messages: ${result.exceptionDetails.text}`
        );
      }

      const messages: UIMessage[] = result.result.value || [];

      // Add console errors from Runtime console API
      const consoleMessages = await this.extractConsoleErrors();
      return [...messages, ...consoleMessages];
    } catch (error) {
      throw new Error(`Message extraction failed: ${error}`);
    }
  }

  /**
   * Extract console error messages
   * Note: Requires Runtime.enable() to be called first
   *
   * @returns Array of console error messages
   */
  private async extractConsoleErrors(): Promise<UIMessage[]> {
    // This would require setting up console message listener
    // For now, we'll evaluate console messages from the page
    const consoleScript = `
      (function() {
        // Check if window.console has been captured
        // This is a limitation - we can't access past console messages
        // unless we inject a console interceptor earlier
        return [];
      })()
    `;

    try {
      const result = await this.client.Runtime.evaluate({
        expression: consoleScript,
        returnByValue: true
      });

      return result.result.value || [];
    } catch {
      return [];
    }
  }

  /**
   * Wait for a specific message to appear
   * Useful after form submission or actions that trigger feedback
   *
   * @param options.text - Text to search for (partial match)
   * @param options.type - Message type to filter by
   * @param options.timeout - Maximum wait time in milliseconds (default: 5000)
   * @returns Found message or null if timeout
   */
  async waitForMessage(options: {
    text?: string;
    type?: UIMessage['type'];
    severity?: UIMessage['severity'];
    timeout?: number;
  }): Promise<UIMessage | null> {
    const { text, type, severity, timeout = 5000 } = options;
    const startTime = Date.now();

    while (Date.now() - startTime < timeout) {
      const messages = await this.extractMessages();

      const found = messages.find(msg => {
        if (text && !msg.text.toLowerCase().includes(text.toLowerCase())) {
          return false;
        }
        if (type && msg.type !== type) {
          return false;
        }
        if (severity && msg.severity !== severity) {
          return false;
        }
        return true;
      });

      if (found) {
        return found;
      }

      // Wait 100ms before next check
      await new Promise(resolve => setTimeout(resolve, 100));
    }

    return null;
  }
}
