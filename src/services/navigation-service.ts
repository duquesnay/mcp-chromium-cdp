import CDP from 'chrome-remote-interface';

/**
 * NavigationService - Page navigation and history
 *
 * Responsible for page navigation, URL/title retrieval, and history operations.
 * Depends on CDP client for Page and Runtime domain operations.
 */
export class NavigationService {
  constructor(private client: CDP.Client) {}

  /**
   * Navigate to a URL
   */
  async navigate(url: string): Promise<string> {
    try {
      const { frameId } = await this.client.Page.navigate({ url });
      await this.client.Page.loadEventFired();
      return `Navigated to ${url}`;
    } catch (error) {
      throw new Error(`Failed to navigate: ${error}`);
    }
  }

  /**
   * Get the current URL
   */
  async getUrl(): Promise<string> {
    try {
      const result = await this.client.Runtime.evaluate({
        expression: 'window.location.href',
        returnByValue: true
      });
      return result.result.value;
    } catch (error) {
      throw new Error(`Failed to get URL: ${error}`);
    }
  }

  /**
   * Get the current page title
   */
  async getTitle(): Promise<string> {
    try {
      const result = await this.client.Runtime.evaluate({
        expression: 'document.title',
        returnByValue: true
      });
      return result.result.value;
    } catch (error) {
      throw new Error(`Failed to get title: ${error}`);
    }
  }

  /**
   * Reload the current page
   */
  async reload(): Promise<string> {
    try {
      await this.client.Page.reload();
      return 'Page reloaded';
    } catch (error) {
      throw new Error(`Failed to reload: ${error}`);
    }
  }

  /**
   * Go back in history
   */
  async goBack(): Promise<string> {
    try {
      const history = await this.client.Page.getNavigationHistory();
      const currentIndex = history.currentIndex;

      if (currentIndex > 0) {
        const entry = history.entries[currentIndex - 1];
        await this.client.Page.navigateToHistoryEntry({ entryId: entry.id });
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
    try {
      const history = await this.client.Page.getNavigationHistory();
      const currentIndex = history.currentIndex;

      if (currentIndex < history.entries.length - 1) {
        const entry = history.entries[currentIndex + 1];
        await this.client.Page.navigateToHistoryEntry({ entryId: entry.id });
        return 'Navigated forward';
      } else {
        return 'Already at the last page';
      }
    } catch (error) {
      throw new Error(`Failed to go forward: ${error}`);
    }
  }
}
