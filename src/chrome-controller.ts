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
   * Take a screenshot
   */
  async screenshot(): Promise<string> {
    await this.ensureConnected();

    try {
      const screenshot = await this.client!.Page.captureScreenshot({
        format: 'png'
      });
      return screenshot.data;
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
      const script = `
        (function() {
          const element = document.querySelector('${selector.replace(/'/g, "\\'")}');
          if (!element) {
            throw new Error('Element not found: ${selector}');
          }
          element.click();
          return 'Clicked on element: ${selector}';
        })()
      `;
      const result = await this.executeScript(script);
      return result;
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
      const script = `
        (function() {
          const element = document.querySelector('${selector.replace(/'/g, "\\'")}');
          if (!element) {
            throw new Error('Element not found: ${selector}');
          }
          element.value = '${text.replace(/'/g, "\\'")}';
          element.dispatchEvent(new Event('input', { bubbles: true }));
          element.dispatchEvent(new Event('change', { bubbles: true }));
          return 'Typed text into: ${selector}';
        })()
      `;
      const result = await this.executeScript(script);
      return result;
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
