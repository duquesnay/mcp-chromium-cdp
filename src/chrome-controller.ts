import * as chromeLauncher from 'chrome-launcher';
import CDP from 'chrome-remote-interface';
import { existsSync } from 'fs';
import { ValidationService } from './services/validation-service.js';
import { ScreenshotService } from './services/screenshot-service.js';
import { NavigationService } from './services/navigation-service.js';
import { PageCheckingService } from './services/page-checking-service.js';
import { FormExtractionService } from './services/form-extraction-service.js';
import { WaitService } from './services/wait-service.js';
import { TextInteractionService } from './services/text-interaction-service.js';
import { MessageDetectionService, UIMessage } from './services/message-detection-service.js';
import { ElementReadinessService, ReadinessResult } from './services/element-readiness-service.js';
import { ScrollService } from './services/scroll-service.js';
import { HoverService } from './services/hover-service.js';

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
 * ChromeController - Orchestrator for browser automation
 *
 * Responsibilities:
 * - Connection management (connect, reconnect, disconnect)
 * - Service instantiation and lifecycle
 * - Delegation to specialized services
 *
 * Environment variables:
 * - CHROMIUM_PATH: Path to Chromium binary (optional)
 * - CHROMIUM_USER_DATA_DIR: Path to user profile directory (optional)
 *
 * Auto-reconnection: If Chromium disconnects or crashes, the controller will
 * automatically attempt to reconnect up to 5 times with a 2-second delay between attempts.
 */
export class ChromeController {
  // Connection configuration
  private static readonly CDP_REMOTE_DEBUGGING_PORT = 9222;
  private static readonly MAX_RECONNECTION_RETRIES = 5;
  private static readonly RECONNECTION_RETRY_DELAY_MS = 2000;

  // Instance properties
  private client: CDP.Client | null = null;
  private chrome: chromeLauncher.LaunchedChrome | null = null;
  private reconnecting = false;
  private maxRetries = ChromeController.MAX_RECONNECTION_RETRIES;
  private retryDelay = ChromeController.RECONNECTION_RETRY_DELAY_MS;

  // Services (instantiated after connection)
  private screenshotService: ScreenshotService | null = null;
  private navigationService: NavigationService | null = null;
  private formExtractionService: FormExtractionService | null = null;
  private waitService: WaitService | null = null;
  private pageCheckingService: PageCheckingService | null = null;
  private textInteractionService: TextInteractionService | null = null;
  private messageDetectionService: MessageDetectionService | null = null;
  private elementReadinessService: ElementReadinessService | null = null;
  private scrollService: ScrollService | null = null;
  private hoverService: HoverService | null = null;

  /**
   * Initialize all service instances with the current CDP client
   */
  private initializeServices(): void {
    if (!this.client) {
      throw new Error('Cannot initialize services without CDP client');
    }

    this.screenshotService = new ScreenshotService(this.client);
    this.navigationService = new NavigationService(this.client);
    this.formExtractionService = new FormExtractionService(this.client);
    this.waitService = new WaitService(this.client);
    this.pageCheckingService = new PageCheckingService(this.client);
    this.textInteractionService = new TextInteractionService(this.client);
    this.messageDetectionService = new MessageDetectionService(this.client);
    this.elementReadinessService = new ElementReadinessService(this.client);
    this.scrollService = new ScrollService(this.client);
    this.hoverService = new HoverService(this.client);
  }

  /**
   * Ensure connection to Chromium with automatic reconnection
   */
  private async ensureConnected(): Promise<void> {
    // Check if already connected AND services are initialized
    if (this.client && this.screenshotService) return;

    // If client exists but services don't, initialize them
    if (this.client && !this.screenshotService) {
      this.initializeServices();
      return;
    }

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

      // Instantiate services after connection
      this.initializeServices();
    } catch (error) {
      throw new Error(`Failed to connect to Chrome: ${error}`);
    }
  }

  /**
   * Navigate to a URL
   */
  async navigate(url: string): Promise<string> {
    ValidationService.validateUrl(url);
    await this.ensureConnected();
    return this.navigationService!.navigate(url);
  }

  /**
   * Get the current URL
   */
  async getUrl(): Promise<string> {
    await this.ensureConnected();
    return this.navigationService!.getUrl();
  }

  /**
   * Get the current page title
   */
  async getTitle(): Promise<string> {
    await this.ensureConnected();
    return this.navigationService!.getTitle();
  }

  /**
   * Reload the current page
   */
  async reload(): Promise<string> {
    await this.ensureConnected();
    return this.navigationService!.reload();
  }

  /**
   * Go back in history
   */
  async goBack(): Promise<string> {
    await this.ensureConnected();
    return this.navigationService!.goBack();
  }

  /**
   * Go forward in history
   */
  async goForward(): Promise<string> {
    await this.ensureConnected();
    return this.navigationService!.goForward();
  }

  /**
   * Take a screenshot with automatic resizing to fit API limits
   */
  async screenshot(maxDimension?: number): Promise<{
    screenshot: string;
    metadata: {
      originalDimensions: { width: number; height: number };
      finalDimensions: { width: number; height: number };
      wasResized: boolean;
      format: string;
    };
  }> {
    ValidationService.validateDimension(maxDimension);
    await this.ensureConnected();
    return this.screenshotService!.screenshot(maxDimension);
  }

  /**
   * Quick page state check without screenshot
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
    return this.pageCheckingService!.checkPage();
  }

  /**
   * Extract structured form data
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
    if (formSelector !== undefined) {
      ValidationService.validateSelector(formSelector);
    }
    await this.ensureConnected();
    return this.formExtractionService!.extractForms(formSelector);
  }

  /**
   * Wait for UI state changes after actions
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
    // Validate inputs
    if (options.element !== undefined) {
      ValidationService.validateSelector(options.element);
    }
    if (options.timeout !== undefined) {
      ValidationService.validateTimeout(options.timeout, 'timeout');
    }

    await this.ensureConnected();
    return this.waitService!.waitFor(options);
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
   * Auto-waits for element to be ready (visible, enabled, stable)
   *
   * @param selector - CSS selector for the element to click
   * @param options.timeout - Maximum time to wait for element readiness
   * @param options.ensureInteractive - If true, performs hover → focus → wait → click sequence for SPA compatibility
   */
  async click(selector: string, options?: { timeout?: number; ensureInteractive?: boolean }): Promise<string> {
    ValidationService.validateSelector(selector);
    await this.ensureConnected();

    try {
      // For SPA elements, we need to hover BEFORE checking readiness
      // because hover activates React synthetic event handlers that make elements interactive

      // Step 1: Get element position (needed for both hover and click)
      const { root } = await this.client!.DOM.getDocument();
      const { nodeId } = await this.client!.DOM.querySelector({
        nodeId: root.nodeId,
        selector: selector
      });

      if (!nodeId) {
        throw new Error(
          JSON.stringify({
            error: 'ELEMENT_NOT_FOUND',
            field: 'selector',
            message: `Element not found: ${selector}`,
            selector,
            suggestions: [
              'Verify selector using chrome_check_page or chrome_extract_interactive',
              'Check if element is in the DOM (may not have loaded yet)',
              'Try waiting before clicking (element may load asynchronously)'
            ]
          })
        );
      }

      const { model } = await this.client!.DOM.getBoxModel({ nodeId });
      const x = (model.content[0] + model.content[2]) / 2;
      const y = (model.content[1] + model.content[5]) / 2;

      // Step 2: If ensureInteractive, perform pre-interaction sequence for SPA compatibility
      // This activates lazy-loaded event handlers before readiness check
      if (options?.ensureInteractive) {
        // Hover element (activates React synthetic event handlers)
        await this.client!.Input.dispatchMouseEvent({
          type: 'mouseMoved',
          x,
          y
        });

        // Focus element (ensures focus state for React)
        await this.client!.DOM.focus({ nodeId });

        // Wait 50ms for React synthetic event system to initialize
        await new Promise(resolve => setTimeout(resolve, 50));
      }

      // Step 3: Now check element readiness (after SPA activation if ensureInteractive)
      const readiness = await this.elementReadinessService!.waitForReady(
        selector,
        options?.timeout
      );

      if (!readiness.ready) {
        const reasons = this.elementReadinessService!.getBlockingReasons(
          readiness.state
        );
        throw new Error(
          JSON.stringify({
            error: 'ELEMENT_NOT_READY',
            field: 'selector',
            message: `Element not ready for click: ${reasons.join(', ')}`,
            selector,
            state: readiness.state,
            timeElapsed: readiness.timeElapsed,
            suggestions: [
              'Wait for page to finish loading',
              'Check if element is covered by another element',
              'Increase timeout if element takes longer to appear',
              options?.ensureInteractive ? 'Element may require JavaScript interaction not triggered by hover' : 'Try using ensureInteractive: true for SPA elements'
            ]
          })
        );
      }

      // Step 4: Perform click using Input API
      await this.client!.Input.dispatchMouseEvent({
        type: 'mousePressed',
        x,
        y,
        button: 'left',
        clickCount: 1
      });

      await this.client!.Input.dispatchMouseEvent({
        type: 'mouseReleased',
        x,
        y,
        button: 'left',
        clickCount: 1
      });

      const interactiveNote = options?.ensureInteractive ? ' (with SPA interactive sequence)' : '';
      return `Clicked on element: ${selector} (ready in ${readiness.timeElapsed}ms)${interactiveNote}`;
    } catch (error) {
      throw new Error(`Failed to click: ${error}`);
    }
  }

  /**
   * Type text into an input field
   * Auto-waits for element to be ready (visible, enabled, stable)
   */
  async type(
    selector: string,
    text: string,
    options?: { timeout?: number }
  ): Promise<string> {
    ValidationService.validateSelector(selector);
    await this.ensureConnected();

    try {
      // Step 1: First check if element exists in DOM
      const { root } = await this.client!.DOM.getDocument();
      const { nodeId } = await this.client!.DOM.querySelector({
        nodeId: root.nodeId,
        selector: selector
      });

      if (!nodeId) {
        throw new Error(
          JSON.stringify({
            error: 'ELEMENT_NOT_FOUND',
            field: 'selector',
            message: `Element not found: ${selector}`,
            selector,
            suggestions: [
              'Verify selector using chrome_check_page or chrome_extract_interactive',
              'Check if element is in the DOM (may not have loaded yet)',
              'Try waiting before typing (element may load asynchronously)'
            ]
          })
        );
      }

      // Step 2: Now check if element is ready for interaction
      const readiness = await this.elementReadinessService!.waitForReady(
        selector,
        options?.timeout
      );

      if (!readiness.ready) {
        const reasons = this.elementReadinessService!.getBlockingReasons(
          readiness.state
        );
        throw new Error(
          JSON.stringify({
            error: 'ELEMENT_NOT_READY',
            field: 'selector',
            message: `Element not ready for typing: ${reasons.join(', ')}`,
            selector,
            state: readiness.state,
            timeElapsed: readiness.timeElapsed,
            suggestions: [
              'Wait for page to finish loading',
              'Check if input field is enabled',
              'Verify element is not readonly'
            ]
          })
        );
      }

      // Step 3: Focus element
      await this.client!.DOM.focus({ nodeId });

      // Step 4: Type each character using Input API
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

      return `Typed text into: ${selector} (ready in ${readiness.timeElapsed}ms)`;
    } catch (error) {
      throw new Error(`Failed to type: ${error}`);
    }
  }

  /**
   * Open a new tab using CDP Target API (cross-platform)
   */
  async openNewTab(url?: string): Promise<string> {
    if (url) {
      ValidationService.validateUrl(url);
    }
    await this.ensureConnected();

    try {
      const targetUrl = url || 'about:blank';
      const { targetId } = await this.client!.Target.createTarget({
        url: targetUrl
      });

      return url
        ? `Opened new tab with URL: ${url} (targetId: ${targetId})`
        : `Opened new blank tab (targetId: ${targetId})`;
    } catch (error) {
      throw new Error(`Failed to open new tab: ${error}`);
    }
  }

  /**
   * Close the current tab using CDP Target API (cross-platform)
   */
  async closeTab(): Promise<string> {
    await this.ensureConnected();

    try {
      // Get current target info
      const { targetInfos } = await this.client!.Target.getTargets();
      const currentTarget = targetInfos.find(
        (t: { type: string; attached: boolean }) => t.type === 'page' && t.attached
      );

      if (!currentTarget) {
        throw new Error('No active tab found to close');
      }

      await this.client!.Target.closeTarget({
        targetId: currentTarget.targetId
      });

      return `Closed tab (targetId: ${currentTarget.targetId})`;
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
   * Click an element by its visible text content
   */
  async clickByText(options: { text: string; role?: string }): Promise<string> {
    ValidationService.validateText(options.text);
    ValidationService.validateRole(options.role);
    await this.ensureConnected();
    return this.textInteractionService!.clickByText(options);
  }

  /**
   * Type text into an input field by its associated label
   */
  async typeByLabel(options: { label: string; text: string }): Promise<string> {
    ValidationService.validateText(options.label);
    await this.ensureConnected();
    return this.textInteractionService!.typeByLabel(options);
  }

  /**
   * Extract all interactive elements with their text and metadata
   */
  async extractInteractive(): Promise<{
    elements: Array<{
      text: string;
      role: string;
      selector: string;
      tagName: string;
      isVisible: boolean;
      isEnabled: boolean;
    }>;
  }> {
    await this.ensureConnected();
    return this.textInteractionService!.extractInteractive();
  }

  /**
   * Get a property value from an element
   */
  async getProperty(selector: string, property: string): Promise<any> {
    ValidationService.validateSelector(selector);
    ValidationService.validatePropertyName(property);
    await this.ensureConnected();
    return this.textInteractionService!.getProperty(selector, property);
  }

  /**
   * Extract UI messages from the page
   * Detects toasts, banners, field errors, modals, and console messages
   */
  async extractMessages(): Promise<UIMessage[]> {
    await this.ensureConnected();
    return this.messageDetectionService!.extractMessages();
  }

  /**
   * Wait for a specific message to appear
   * Useful after form submissions or actions that trigger feedback
   */
  async waitForMessage(options: {
    text?: string;
    type?: UIMessage['type'];
    severity?: UIMessage['severity'];
    timeout?: number;
  }): Promise<UIMessage | null> {
    await this.ensureConnected();
    return this.messageDetectionService!.waitForMessage(options);
  }

  /**
   * Check element readiness for interaction
   * Returns current state without waiting
   */
  async checkElementReadiness(selector: string): Promise<ReadinessResult> {
    ValidationService.validateSelector(selector);
    await this.ensureConnected();

    const state = await this.elementReadinessService!.checkElementState(
      selector
    );

    return {
      ready:
        state.visible && state.enabled && state.stable,
      state,
      timeElapsed: 0
    };
  }

  /**
   * Scroll the page or an element
   *
   * Supports direction-based scrolling with distance specification.
   * Returns scroll position, boundary detection (top/bottom), and dimensions.
   * Useful for infinite scroll detection and pagination.
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
    if (options.selector) {
      ValidationService.validateSelector(options.selector);
    }
    await this.ensureConnected();
    return this.scrollService!.scroll(options);
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
    if (selector) {
      ValidationService.validateSelector(selector);
    }
    await this.ensureConnected();
    return this.scrollService!.getScrollPosition(selector);
  }

  /**
   * Hover over an element
   * Essential for React SPAs where hover activates synthetic event handlers
   */
  async hover(selector: string): Promise<string> {
    ValidationService.validateSelector(selector);
    await this.ensureConnected();
    return this.hoverService!.hover(selector);
  }

  /**
   * Detect SPA framework on the page
   * Checks for React, Vue, Angular, Svelte
   */
  async detectSPAFramework(): Promise<{
    detected: boolean;
    frameworks: Array<{ name: string; version?: string }>;
  }> {
    await this.ensureConnected();
    return this.hoverService!.detectSPAFramework();
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
