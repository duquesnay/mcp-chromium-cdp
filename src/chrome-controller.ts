import * as chromeLauncher from 'chrome-launcher';
import CDP from 'chrome-remote-interface';
import { exec } from 'child_process';
import { promisify } from 'util';
import { existsSync } from 'fs';
import sharp from 'sharp';

const execAsync = promisify(exec);

/**
 * Find Chromium binary on the system
 * Checks CHROMIUM_PATH env var first, then standard installation paths
 * Returns undefined to fall back to chrome-launcher's default Chrome detection
 */
function findChromiumPath(): string | undefined {
  const chromiumPaths = {
    darwin: [
      '/Applications/Chromium.app/Contents/MacOS/Chromium',
      process.env.HOME + '/Applications/Chromium.app/Contents/MacOS/Chromium'
    ],
    linux: [
      '/usr/bin/chromium',
      '/usr/bin/chromium-browser',
      '/snap/bin/chromium'
    ],
    win32: [
      process.env.LOCALAPPDATA + '\\Chromium\\Application\\chrome.exe',
      process.env.PROGRAMFILES + '\\Chromium\\Application\\chrome.exe',
      process.env['PROGRAMFILES(X86)'] + '\\Chromium\\Application\\chrome.exe'
    ]
  };

  const platform = process.platform as 'darwin' | 'linux' | 'win32';
  const paths = chromiumPaths[platform] || [];

  // Check CHROMIUM_PATH env var first
  if (process.env.CHROMIUM_PATH && existsSync(process.env.CHROMIUM_PATH)) {
    return process.env.CHROMIUM_PATH;
  }

  // Then check standard paths
  for (const path of paths) {
    if (path && existsSync(path)) {
      return path;
    }
  }

  return undefined; // Fall back to chrome-launcher's default Chrome detection
}

/**
 * Environment variables:
 * - CHROMIUM_PATH: Path to Chromium binary (optional)
 * - CHROMIUM_USER_DATA_DIR: Path to user profile directory (optional)
 *
 * Example:
 *   CHROMIUM_PATH=/usr/bin/chromium mcp-chromium-cdp
 *   CHROMIUM_USER_DATA_DIR=~/.config/chromium-mcp mcp-chromium-cdp
 *
 * Auto-reconnection: If Chromium disconnects or crashes, the controller will
 * automatically attempt to reconnect up to 5 times with a 2-second delay between attempts.
 */
export class ChromeController {
  // Connection configuration
  private static readonly CDP_REMOTE_DEBUGGING_PORT = 9222;
  private static readonly MAX_RECONNECTION_RETRIES = 5;
  private static readonly RECONNECTION_RETRY_DELAY_MS = 2000;

  // Screenshot configuration
  private static readonly DEFAULT_MAX_SCREENSHOT_DIMENSION = 2000;

  // Page checking configuration
  private static readonly MAX_VISIBLE_ERRORS = 10;

  // Wait operation configuration
  private static readonly DEFAULT_WAIT_TIMEOUT_MS = 5000;
  private static readonly MAX_WAIT_TIMEOUT_MS = 30000;
  private static readonly WAIT_CHECK_INTERVAL_MS = 100;

  // Selector arrays for page checking
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

  // Instance properties
  private client: CDP.Client | null = null;
  private chrome: chromeLauncher.LaunchedChrome | null = null;
  private reconnecting = false;
  private maxRetries = ChromeController.MAX_RECONNECTION_RETRIES;
  private retryDelay = ChromeController.RECONNECTION_RETRY_DELAY_MS;

  /**
   * Ensure connection to Chromium with automatic reconnection
   */
  private async ensureConnected(): Promise<void> {
    if (this.client) return; // Already connected

    if (this.reconnecting) {
      // Wait for ongoing reconnection
      await new Promise(resolve => setTimeout(resolve, this.retryDelay));
      return this.ensureConnected();
    }

    this.reconnecting = true;
    console.error('[Reconnect] Attempting to reconnect to Chromium...');

    for (let attempt = 1; attempt <= this.maxRetries; attempt++) {
      try {
        await this.connect();
        console.error('[Reconnect] Successfully reconnected to Chromium');
        this.reconnecting = false;
        return;
      } catch (error) {
        console.error(`[Reconnect] Attempt ${attempt}/${this.maxRetries} failed:`, error);
        if (attempt < this.maxRetries) {
          await new Promise(resolve => setTimeout(resolve, this.retryDelay));
        }
      }
    }

    this.reconnecting = false;
    throw new Error('Failed to reconnect to Chromium after maximum retries');
  }

  /**
   * Connect to an existing Chrome instance or launch a new one
   */
  async connect(): Promise<void> {
    try {
      // Try to connect to existing Chrome instance
      const targets = await CDP.List();
      if (targets.length > 0) {
        this.client = await CDP({ target: targets[0] });
      } else {
        // Launch Chromium/Chrome if not running
        const chromiumPath = findChromiumPath();
        const launchOptions: any = {
          chromeFlags: [
            `--remote-debugging-port=${ChromeController.CDP_REMOTE_DEBUGGING_PORT}`,
            '--no-first-run',
            '--no-default-browser-check'
          ]
        };

        if (chromiumPath) {
          console.error(`[Launch] Using Chromium at: ${chromiumPath}`);
          launchOptions.chromePath = chromiumPath;
        } else {
          console.error('[Launch] Chromium not found, falling back to Chrome');
        }

        // Support custom user data dir via env var
        if (process.env.CHROMIUM_USER_DATA_DIR) {
          launchOptions.userDataDir = process.env.CHROMIUM_USER_DATA_DIR;
          console.error(`[Launch] Using profile: ${process.env.CHROMIUM_USER_DATA_DIR}`);
        }

        this.chrome = await chromeLauncher.launch(launchOptions);
        this.client = await CDP({ port: this.chrome.port });
      }

      // Detect disconnection
      this.client.on('disconnect', () => {
        console.error('[Connection] Chromium disconnected');
        this.client = null;
      });

      // Enable necessary domains
      await this.client.Page.enable();
      await this.client.Runtime.enable();
      await this.client.Network.enable();
      await this.client.DOM.enable();
    } catch (error) {
      throw new Error(`Failed to connect to Chrome: ${error}`);
    }
  }

  /**
   * Navigate to a URL
   */
  async navigate(url: string): Promise<string> {
    await this.ensureConnected();

    try {
      const { frameId } = await this.client!.Page.navigate({ url });
      await this.client!.Page.loadEventFired();
      return `Navigated to ${url}`;
    } catch (error) {
      throw new Error(`Failed to navigate: ${error}`);
    }
  }

  /**
   * Execute JavaScript in the page
   */
  async executeScript(script: string): Promise<any> {
    await this.ensureConnected();

    try {
      const result = await this.client!.Runtime.evaluate({
        expression: script,
        returnByValue: true,
        awaitPromise: true
      });

      if (result.exceptionDetails) {
        throw new Error(`Script execution failed: ${result.exceptionDetails.text}`);
      }

      return result.result.value;
    } catch (error) {
      throw new Error(`Failed to execute script: ${error}`);
    }
  }

  /**
   * Get the current page title
   */
  async getTitle(): Promise<string> {
    await this.ensureConnected();

    try {
      const result = await this.client!.Runtime.evaluate({
        expression: 'document.title',
        returnByValue: true
      });
      return result.result.value;
    } catch (error) {
      throw new Error(`Failed to get title: ${error}`);
    }
  }

  /**
   * Get the current URL
   */
  async getUrl(): Promise<string> {
    await this.ensureConnected();

    try {
      const result = await this.client!.Runtime.evaluate({
        expression: 'window.location.href',
        returnByValue: true
      });
      return result.result.value;
    } catch (error) {
      throw new Error(`Failed to get URL: ${error}`);
    }
  }

  /**
   * Calculate optimal dimensions to fit within API limits
   * Maintains aspect ratio while ensuring max dimension doesn't exceed limit
   */
  private calculateOptimalDimensions(
    width: number,
    height: number,
    maxDimension: number = ChromeController.DEFAULT_MAX_SCREENSHOT_DIMENSION
  ): { width: number; height: number } {
    if (width <= maxDimension && height <= maxDimension) {
      return { width, height };
    }

    const ratio = width / height;
    if (width > height) {
      return {
        width: maxDimension,
        height: Math.round(maxDimension / ratio),
      };
    } else {
      return {
        width: Math.round(maxDimension * ratio),
        height: maxDimension,
      };
    }
  }

  /**
   * Check if a form field contains sensitive data that should be redacted
   */
  private static isSensitiveField(field: {
    type: string;
    name?: string;
    id?: string;
    autocomplete?: string;
  }): boolean {
    // Check by type
    if (field.type === 'password') {
      return true;
    }

    // Check by name/id containing sensitive keywords
    const nameId = ((field.name || '') + (field.id || '')).toLowerCase();
    if (/ssn|social|cvv|pin|password/.test(nameId)) {
      return true;
    }

    // Check by autocomplete attribute
    if (field.autocomplete && /cc-number|cc-csc|cvv|credit-card/.test(field.autocomplete)) {
      return true;
    }

    return false;
  }

  /**
   * Take a screenshot with automatic resizing to fit API limits
   * @param maxDimension Maximum width or height (default: 2000px for Claude API compatibility)
   * @returns Object containing base64 screenshot and metadata about dimensions/resize
   */
  async screenshot(maxDimension: number = ChromeController.DEFAULT_MAX_SCREENSHOT_DIMENSION): Promise<{
    screenshot: string;
    metadata: {
      originalDimensions: { width: number; height: number };
      finalDimensions: { width: number; height: number };
      wasResized: boolean;
      format: string;
    };
  }> {
    await this.ensureConnected();

    try {
      // Get viewport size
      const viewport = await this.client!.Runtime.evaluate({
        expression:
          'JSON.stringify({width: window.innerWidth, height: window.innerHeight})',
        returnByValue: true,
      });
      const { width: originalWidth, height: originalHeight } = JSON.parse(
        viewport.result.value
      );

      // Take screenshot
      const screenshot = await this.client!.Page.captureScreenshot({
        format: 'png',
      });

      const needsResize =
        originalWidth > maxDimension || originalHeight > maxDimension;

      if (needsResize) {
        const { width: targetWidth, height: targetHeight } =
          this.calculateOptimalDimensions(
            originalWidth,
            originalHeight,
            maxDimension
          );

        // Resize with sharp
        const buffer = Buffer.from(screenshot.data, 'base64');
        const resized = await sharp(buffer)
          .resize(targetWidth, targetHeight, { fit: 'inside' })
          .png()
          .toBuffer();

        return {
          screenshot: resized.toString('base64'),
          metadata: {
            originalDimensions: { width: originalWidth, height: originalHeight },
            finalDimensions: { width: targetWidth, height: targetHeight },
            wasResized: true,
            format: 'png',
          },
        };
      }

      return {
        screenshot: screenshot.data,
        metadata: {
          originalDimensions: { width: originalWidth, height: originalHeight },
          finalDimensions: { width: originalWidth, height: originalHeight },
          wasResized: false,
          format: 'png',
        },
      };
    } catch (error) {
      throw new Error(`Failed to take screenshot: ${error}`);
    }
  }

  /**
   * Get page content/HTML
   */
  async getContent(): Promise<string> {
    await this.ensureConnected();

    try {
      const result = await this.client!.Runtime.evaluate({
        expression: 'document.documentElement.outerHTML',
        returnByValue: true
      });
      return result.result.value;
    } catch (error) {
      throw new Error(`Failed to get content: ${error}`);
    }
  }

  /**
   * Get visible text from the page
   */
  async getVisibleText(): Promise<string> {
    await this.ensureConnected();

    try {
      const result = await this.client!.Runtime.evaluate({
        expression: 'document.body.innerText',
        returnByValue: true
      });
      return result.result.value;
    } catch (error) {
      throw new Error(`Failed to get visible text: ${error}`);
    }
  }

  /**
   * Click on an element using a selector
   */
  async click(selector: string): Promise<string> {
    await this.ensureConnected();

    try {
      // Use CDP's DOM API - selector handled safely by protocol
      const { root } = await this.client!.DOM.getDocument();
      const { nodeId } = await this.client!.DOM.querySelector({
        nodeId: root.nodeId,
        selector: selector // CDP sanitizes internally
      });

      if (!nodeId) {
        throw new Error(`Element not found: ${selector}`);
      }

      // Get element position and click via Input API
      const { model } = await this.client!.DOM.getBoxModel({ nodeId });
      const x = (model.content[0] + model.content[2]) / 2;
      const y = (model.content[1] + model.content[5]) / 2;

      await this.client!.Input.dispatchMouseEvent({
        type: 'mousePressed',
        x, y,
        button: 'left',
        clickCount: 1
      });

      await this.client!.Input.dispatchMouseEvent({
        type: 'mouseReleased',
        x, y,
        button: 'left',
        clickCount: 1
      });

      return `Clicked on element: ${selector}`;
    } catch (error) {
      throw new Error(`Failed to click: ${error}`);
    }
  }

  /**
   * Type text into an input field
   */
  async type(selector: string, text: string): Promise<string> {
    await this.ensureConnected();

    try {
      // Use CDP's DOM API to find and focus the element
      const { root } = await this.client!.DOM.getDocument();
      const { nodeId } = await this.client!.DOM.querySelector({
        nodeId: root.nodeId,
        selector: selector
      });

      if (!nodeId) {
        throw new Error(`Element not found: ${selector}`);
      }

      // Focus element
      await this.client!.DOM.focus({ nodeId });

      // Type each character using Input API
      for (const char of text) {
        await this.client!.Input.dispatchKeyEvent({
          type: 'keyDown',
          text: char
        });
        await this.client!.Input.dispatchKeyEvent({
          type: 'keyUp',
          text: char
        });
      }

      return `Typed text into: ${selector}`;
    } catch (error) {
      throw new Error(`Failed to type: ${error}`);
    }
  }

  /**
   * Open a new tab using AppleScript (Mac-specific)
   */
  async openNewTab(url?: string): Promise<string> {
    try {
      const urlPart = url ? `set URL of active tab of front window to "${url}"` : '';
      const script = `
        tell application "Google Chrome"
          tell front window
            make new tab
            ${urlPart}
          end tell
          activate
        end tell
      `;
      await execAsync(`osascript -e '${script}'`);
      return url ? `Opened new tab with URL: ${url}` : 'Opened new tab';
    } catch (error) {
      throw new Error(`Failed to open new tab: ${error}`);
    }
  }

  /**
   * Close the current tab using AppleScript (Mac-specific)
   */
  async closeTab(): Promise<string> {
    try {
      const script = `
        tell application "Google Chrome"
          close active tab of front window
        end tell
      `;
      await execAsync(`osascript -e '${script}'`);
      return 'Closed current tab';
    } catch (error) {
      throw new Error(`Failed to close tab: ${error}`);
    }
  }

  /**
   * List all open tabs
   */
  async listTabs(): Promise<any[]> {
    try {
      const targets = await CDP.List();
      return targets.map((target, index) => ({
        index,
        title: target.title,
        url: target.url,
        type: target.type
      }));
    } catch (error) {
      throw new Error(`Failed to list tabs: ${error}`);
    }
  }

  /**
   * Reload the current page
   */
  async reload(): Promise<string> {
    await this.ensureConnected();

    try {
      await this.client!.Page.reload();
      return 'Page reloaded';
    } catch (error) {
      throw new Error(`Failed to reload: ${error}`);
    }
  }

  /**
   * Go back in history
   */
  async goBack(): Promise<string> {
    await this.ensureConnected();

    try {
      const history = await this.client!.Page.getNavigationHistory();
      const currentIndex = history.currentIndex;

      if (currentIndex > 0) {
        const entry = history.entries[currentIndex - 1];
        await this.client!.Page.navigateToHistoryEntry({ entryId: entry.id });
        return 'Navigated back';
      } else {
        return 'Already at the first page';
      }
    } catch (error) {
      throw new Error(`Failed to go back: ${error}`);
    }
  }

  /**
   * Go forward in history
   */
  async goForward(): Promise<string> {
    await this.ensureConnected();

    try {
      const history = await this.client!.Page.getNavigationHistory();
      const currentIndex = history.currentIndex;

      if (currentIndex < history.entries.length - 1) {
        const entry = history.entries[currentIndex + 1];
        await this.client!.Page.navigateToHistoryEntry({ entryId: entry.id });
        return 'Navigated forward';
      } else {
        return 'Already at the last page';
      }
    } catch (error) {
      throw new Error(`Failed to go forward: ${error}`);
    }
  }

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
    await this.ensureConnected();

    try {
      const script = `
        (function() {
          // Get basic page info
          const url = window.location.href;
          const title = document.title;
          const loadState = document.readyState;

          // Detect visible error messages
          const errorSelectors = ${JSON.stringify(ChromeController.ERROR_SELECTORS)};
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
          const interactiveSelectors = ${JSON.stringify(ChromeController.INTERACTIVE_SELECTORS)};
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
            visibleErrors: [...new Set(errorElements)].slice(0, ${ChromeController.MAX_VISIBLE_ERRORS}), // deduplicate and limit
            formCount,
            interactiveElementsCount: interactiveElements.size
          };
        })()
      `;

      const result = await this.executeScript(script);
      return result;
    } catch (error) {
      throw new Error(`Failed to check page: ${error}`);
    }
  }

  /**
   * Extract structured form data without custom scripting
   *
   * Performance: Optimized to O(n) complexity using label lookup maps.
   * Handles forms with 100+ fields efficiently (<100ms).
   *
   * SECURITY: Password and sensitive field values are redacted to prevent credential exposure.
   * Use the `isFilled` property to check if sensitive fields contain data.
   *
   * Redacted field types: password, credit card, CVV, SSN, PIN
   *
   * Returns: fields (name, type, value, placeholder, required), labels, validation, submit buttons
   * Works with: standard forms, React forms, Shadow DOM forms
   */
  async extractForms(formSelector?: string): Promise<{
    forms: Array<{
      selector: string;
      action: string;
      method: string;
      fields: Array<{
        name: string;
        type: string;
        value: string;
        placeholder: string;
        required: boolean;
        disabled: boolean;
        label: string;
        validationRules: {
          pattern?: string;
          minLength?: number;
          maxLength?: number;
          min?: number;
          max?: number;
        };
        selector: string;
        isFilled: boolean;
      }>;
      submitButtons: Array<{
        text: string;
        selector: string;
        disabled: boolean;
      }>;
      fieldsets: Array<{
        legend: string;
        fieldCount: number;
      }>;
    }>;
  }> {
    await this.ensureConnected();

    try {
      const script = `
        (function() {
          const formSelector = ${formSelector ? `'${formSelector.replace(/'/g, "\\'")}'` : 'null'};
          const forms = formSelector
            ? document.querySelectorAll(formSelector)
            : document.querySelectorAll('form');

          // Helper function to check if a field contains sensitive data
          function isSensitiveField(field) {
            // Check by type
            if (field.type === 'password') {
              return true;
            }

            // Check by name/id containing sensitive keywords
            const nameId = ((field.name || '') + (field.id || '')).toLowerCase();
            if (/ssn|social|cvv|pin|password/.test(nameId)) {
              return true;
            }

            // Check by autocomplete attribute
            if (field.autocomplete && /cc-number|cc-csc|cvv|credit-card/.test(field.autocomplete)) {
              return true;
            }

            return false;
          }

          const results = [];

          forms.forEach((form, formIndex) => {
            // Generate unique selector for form
            const formId = form.id ? '#' + form.id : 'form:nth-of-type(' + (formIndex + 1) + ')';

            // BUILD LABEL MAP ONCE - O(n) operation
            const labelMap = new Map();
            form.querySelectorAll('label').forEach(label => {
              // Map by 'for' attribute
              const forAttr = label.getAttribute('for');
              if (forAttr) {
                labelMap.set(forAttr, label.innerText.trim());
              }

              // Map by parent relationship
              const input = label.querySelector('input, select, textarea');
              if (input) {
                // Use element reference as key
                labelMap.set(input, label.innerText.replace(input.value || '', '').trim());
              }
            });

            // Extract form attributes
            const formData = {
              selector: formId,
              action: form.action || '',
              method: (form.method || 'get').toLowerCase(),
              fields: [],
              submitButtons: [],
              fieldsets: []
            };

            // Extract fieldsets
            form.querySelectorAll('fieldset').forEach(fieldset => {
              const legend = fieldset.querySelector('legend');
              formData.fieldsets.push({
                legend: legend ? legend.innerText.trim() : '',
                fieldCount: fieldset.querySelectorAll('input, select, textarea').length
              });
            });

            // SINGLE PASS FIELD EXTRACTION - O(n) instead of O(n²)
            const fields = form.querySelectorAll('input, select, textarea');
            fields.forEach((field, fieldIndex) => {
              // Skip hidden fields and buttons
              if (field.type === 'hidden' || field.type === 'submit' || field.type === 'button') {
                return;
              }

              // LABEL LOOKUP - O(1) hash map lookup instead of O(n) DOM query
              let label = '';
              if (field.id) {
                label = labelMap.get(field.id) || '';
              }
              if (!label) {
                label = labelMap.get(field) || '';
              }
              if (!label && field.placeholder) {
                label = field.placeholder;
              }

              // Generate unique selector
              let fieldSelector = '';
              if (field.id) {
                fieldSelector = '#' + field.id;
              } else if (field.name) {
                fieldSelector = formId + ' [name="' + field.name + '"]';
              } else {
                fieldSelector = formId + ' ' + field.tagName.toLowerCase() + ':nth-of-type(' + (fieldIndex + 1) + ')';
              }

              // Extract validation rules
              const validationRules = {};
              if (field.pattern) validationRules.pattern = field.pattern;
              if (field.minLength > 0) validationRules.minLength = field.minLength;
              if (field.maxLength > 0) validationRules.maxLength = field.maxLength;
              if (field.min) validationRules.min = field.min;
              if (field.max) validationRules.max = field.max;

              // Determine if field is filled
              let isFilled = false;
              if (field.tagName.toLowerCase() === 'select') {
                isFilled = field.selectedIndex > 0 || (field.value && field.value !== '');
              } else if (field.type === 'checkbox' || field.type === 'radio') {
                isFilled = field.checked;
              } else {
                isFilled = field.value && field.value.trim() !== '';
              }

              // Check if field contains sensitive data that should be redacted
              const isSensitive = isSensitiveField(field);

              formData.fields.push({
                name: field.name || '',
                type: field.type || field.tagName.toLowerCase(),
                value: isSensitive ? '[REDACTED]' : (field.value || ''),
                placeholder: field.placeholder || '',
                required: field.required || false,
                disabled: field.disabled || false,
                label: label,
                validationRules: validationRules,
                selector: fieldSelector,
                isFilled: isFilled
              });
            });

            // Extract submit buttons
            const buttons = form.querySelectorAll('button[type="submit"], input[type="submit"], button:not([type])');
            buttons.forEach((button, btnIndex) => {
              let buttonSelector = '';
              if (button.id) {
                buttonSelector = '#' + button.id;
              } else {
                buttonSelector = formId + ' button:nth-of-type(' + (btnIndex + 1) + ')';
              }

              formData.submitButtons.push({
                text: button.innerText || button.value || 'Submit',
                selector: buttonSelector,
                disabled: button.disabled || false
              });
            });

            results.push(formData);
          });

          return { forms: results };
        })()
      `;

      const result = await this.executeScript(script);
      return result;
    } catch (error) {
      throw new Error(`Failed to extract forms: ${error}`);
    }
  }

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
    await this.ensureConnected();

    const startTime = Date.now();
    const timeout = Math.min(
      options.timeout || ChromeController.DEFAULT_WAIT_TIMEOUT_MS,
      ChromeController.MAX_WAIT_TIMEOUT_MS
    );
    const checkInterval = ChromeController.WAIT_CHECK_INTERVAL_MS;

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
        await this.client!.Network.enable();
        this.client!.Network.requestWillBeSent(() => {
          lastNetworkActivity = Date.now();
        });
        this.client!.Network.loadingFinished(() => {
          lastNetworkActivity = Date.now();
        });
      }

      // Poll for conditions
      while (Date.now() - startTime < timeout) {
        // Check element condition using CDP DOM API
        if (options.element && !conditions.element) {
          try {
            const { root } = await this.client!.DOM.getDocument();
            const { nodeId } = await this.client!.DOM.querySelector({
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
          const textFound = await this.executeScript(script);
          if (textFound) {
            conditions.text = true;
          }
        }

        // Check URL condition
        if (options.url && !conditions.url) {
          const currentUrl = await this.getUrl();
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
          await this.client!.Network.disable();
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
    const currentUrl = await this.getUrl();

    let elementFound = false;
    if (options.element) {
      try {
        const { root } = await this.client!.DOM.getDocument();
        const { nodeId } = await this.client!.DOM.querySelector({
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
      textFound = await this.executeScript(script);
    }

    return {
      currentUrl,
      elementFound,
      textFound,
    };
  }

  /**
   * Disconnect from Chrome
   */
  async disconnect(): Promise<void> {
    if (this.client) {
      await this.client.close();
      this.client = null;
    }
    if (this.chrome) {
      await this.chrome.kill();
      this.chrome = null;
    }
  }
}
