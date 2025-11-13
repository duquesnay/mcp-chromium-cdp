import CDP from 'chrome-remote-interface';

/**
 * PageCheckingService - Quick page state checks
 *
 * Responsible for fast page state analysis without screenshots.
 * Checks for errors, forms, interactive elements, and basic page info.
 * Depends on CDP client for Runtime domain operations.
 */
export class PageCheckingService {
  private static readonly MAX_VISIBLE_ERRORS = 10;

  private static readonly ERROR_SELECTORS = [
    '[role="alert"]',
    '.error',
    '.alert-error',
    '.alert-danger',
    '.text-danger',
    '.is-invalid',
    '[class*="error"]',
    '[id*="error"]',
    '.notification.is-danger',
    '.message-error'
  ];

  private static readonly INTERACTIVE_SELECTORS = [
    'button:not([disabled])',
    'a[href]',
    'input:not([disabled])',
    'select:not([disabled])',
    'textarea:not([disabled])',
    '[role="button"]',
    '[onclick]',
    '[tabindex]'
  ];

  constructor(private client: CDP.Client) {}

  /**
   * Quick page state check without screenshot (target: <500ms)
   * Returns: URL, title, load state, visible errors, form count, interactive elements count
   */
  async checkPage(): Promise<{
    url: string;
    title: string;
    loadState: 'loading' | 'interactive' | 'complete';
    visibleErrors: string[];
    formCount: number;
    interactiveElementsCount: number;
  }> {
    try {
      const script = `
        (function() {
          // Get basic page info
          const url = window.location.href;
          const title = document.title;
          const loadState = document.readyState;

          // Detect visible error messages
          const errorSelectors = ${JSON.stringify(PageCheckingService.ERROR_SELECTORS)};
          const errorElements = [];
          errorSelectors.forEach(selector => {
            try {
              document.querySelectorAll(selector).forEach(el => {
                // Check if element is visible
                if (el.offsetParent !== null && el.innerText.trim()) {
                  errorElements.push(el.innerText.trim());
                }
              });
            } catch (e) {
              // Ignore invalid selectors
            }
          });

          // Count forms
          const formCount = document.querySelectorAll('form').length;

          // Count interactive elements (visible only)
          const interactiveSelectors = ${JSON.stringify(PageCheckingService.INTERACTIVE_SELECTORS)};
          const interactiveElements = new Set();
          interactiveSelectors.forEach(selector => {
            try {
              document.querySelectorAll(selector).forEach(el => {
                // Check if element is visible
                if (el.offsetParent !== null) {
                  interactiveElements.add(el);
                }
              });
            } catch (e) {
              // Ignore invalid selectors
            }
          });

          return {
            url,
            title,
            loadState,
            visibleErrors: [...new Set(errorElements)].slice(0, ${PageCheckingService.MAX_VISIBLE_ERRORS}), // deduplicate and limit
            formCount,
            interactiveElementsCount: interactiveElements.size
          };
        })()
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
      throw new Error(`Failed to check page: ${error}`);
    }
  }
}
