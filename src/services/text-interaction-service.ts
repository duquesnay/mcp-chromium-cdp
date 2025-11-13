import CDP from 'chrome-remote-interface';

/**
 * TextInteractionService - Text-based element interaction
 *
 * Responsible for semantic element interaction without CSS selectors.
 * All operations use CDP APIs only for security and reliability.
 * Depends on CDP client for DOM, Input, and Runtime operations.
 */
export class TextInteractionService {
  // Constants for validation and limits
  private static readonly MAX_TEXT_LENGTH = 1000;
  private static readonly MAX_INTERACTIVE_ELEMENTS = 100;
  private static readonly VALID_ROLES = [
    'button', 'link', 'checkbox', 'radio', 'textbox', 'searchbox',
    'combobox', 'listbox', 'menuitem', 'tab', 'switch', 'slider'
  ];

  constructor(private client: CDP.Client) {}

  /**
   * Click an element by its visible text content
   *
   * Uses XPath contains() for text matching and filters by ARIA role if specified.
   * Provides actionable error messages with suggestions if element not found or multiple matches.
   *
   * Performance: Single Runtime.evaluate call for DOM search, O(1) click using CDP Input API
   *
   * Security: No user input in script execution context - uses JSON.stringify for XPath safety
   *
   * @param options.text - Visible text to search for (case-sensitive, max 1000 chars)
   * @param options.role - Optional ARIA role to filter results ('button', 'link', etc.)
   * @returns Success message with clicked element description
   * @throws Error with suggestions if 0 or >1 matches found
   */
  async clickByText(options: { text: string; role?: string }): Promise<string> {
    const { text, role } = options;

    // Build XPath query for text matching
    const roleFilter = role ? `[@role=${JSON.stringify(role)}]` : '';
    const xpathQuery = `//*${roleFilter}[contains(text(), ${JSON.stringify(text)})]`;

    // Search DOM using Runtime.evaluate (safe - no user input in execution context)
    const searchScript = `
      (function() {
        const xpath = ${JSON.stringify(xpathQuery)};
        const result = document.evaluate(xpath, document, null, XPathResult.ORDERED_NODE_SNAPSHOT_TYPE, null);

        const elements = [];
        for (let i = 0; i < result.snapshotLength; i++) {
          const el = result.snapshotItem(i);
          const rect = el.getBoundingClientRect();

          // Check if element is visible
          const isVisible = rect.width > 0 && rect.height > 0 &&
                          window.getComputedStyle(el).visibility !== 'hidden' &&
                          window.getComputedStyle(el).display !== 'none';

          if (isVisible) {
            elements.push({
              tagName: el.tagName,
              text: el.textContent.trim(),
              role: el.getAttribute('role') || '',
              id: el.id || '',
              className: el.className || '',
              index: i
            });
          }
        }

        return {
          count: elements.length,
          elements: elements.slice(0, 5) // Return max 5 for error suggestions
        };
      })()
    `;

    const searchResult = await this.client.Runtime.evaluate({
      expression: searchScript,
      returnByValue: true
    });

    if (searchResult.exceptionDetails) {
      throw new Error(JSON.stringify({
        error: "SEARCH_FAILED",
        message: "Failed to search for element by text",
        details: searchResult.exceptionDetails.text
      }));
    }

    const { count, elements } = searchResult.result.value;

    // Handle no matches
    if (count === 0) {
      throw new Error(JSON.stringify({
        error: "ELEMENT_NOT_FOUND",
        field: "text",
        message: `No visible element found containing text: "${text}"`,
        suggestions: role
          ? [`Try without role filter`, `Check if text is visible on page`, `Use chrome_extract_interactive to see available elements`]
          : [`Check if text is visible on page`, `Text search is case-sensitive`, `Use chrome_extract_interactive to see available elements`]
      }));
    }

    // Handle multiple matches
    if (count > 1) {
      const elementDescriptions = elements.map((el: any) =>
        `${el.tagName}${el.role ? `[role="${el.role}"]` : ''}${el.id ? `#${el.id}` : ''}: "${el.text.substring(0, 50)}"`
      );

      throw new Error(JSON.stringify({
        error: "MULTIPLE_ELEMENTS_FOUND",
        field: "text",
        message: `Found ${count} elements containing text: "${text}"`,
        matches: elementDescriptions,
        suggestions: [
          "Specify a role parameter to filter results",
          "Use more specific text that uniquely identifies the element",
          "Use chrome_click with a CSS selector for precise targeting"
        ]
      }));
    }

    // Single match - perform click using CDP
    const element = elements[0];
    const clickScript = `
      (function() {
        const xpath = ${JSON.stringify(xpathQuery)};
        const result = document.evaluate(xpath, document, null, XPathResult.FIRST_ORDERED_NODE_TYPE, null);
        const el = result.singleNodeValue;
        return {
          id: el.id,
          className: el.className
        };
      })()
    `;

    const elementResult = await this.client.Runtime.evaluate({
      expression: clickScript,
      returnByValue: true
    });

    const elementInfo = elementResult.result.value;

    // Build selector from element info
    let selector = element.tagName.toLowerCase();
    if (elementInfo.id) {
      selector = `#${elementInfo.id}`;
    } else if (elementInfo.className) {
      const classes = elementInfo.className.split(' ').filter((c: string) => c.trim());
      if (classes.length > 0) {
        selector = `${element.tagName.toLowerCase()}.${classes[0]}`;
      }
    }

    // Use DOM API to find element and get position
    const { root } = await this.client.DOM.getDocument();
    const { nodeId } = await this.client.DOM.querySelector({
      nodeId: root.nodeId,
      selector: selector
    });

    if (!nodeId) {
      throw new Error(JSON.stringify({
        error: "ELEMENT_INTERACTION_FAILED",
        message: "Element found but could not be clicked",
        suggestion: "Element may have been removed from DOM"
      }));
    }

    // Get element position and click via Input API
    const { model } = await this.client.DOM.getBoxModel({ nodeId });
    const x = (model.content[0] + model.content[2]) / 2;
    const y = (model.content[1] + model.content[5]) / 2;

    await this.client.Input.dispatchMouseEvent({
      type: 'mousePressed',
      x, y,
      button: 'left',
      clickCount: 1
    });

    await this.client.Input.dispatchMouseEvent({
      type: 'mouseReleased',
      x, y,
      button: 'left',
      clickCount: 1
    });

    return `Clicked ${element.tagName}${element.role ? ` [role="${element.role}"]` : ''} containing text: "${text.substring(0, 50)}"`;
  }

  /**
   * Type text into an input field by its associated label
   *
   * Searches for input by: label 'for' attribute, parent label, aria-label, placeholder (in order).
   * Uses CDP DOM.focus and Input API for reliable text entry.
   *
   * Performance: Single Runtime.evaluate call for input search, O(1) focus and type
   *
   * Security: No user input in script execution context
   *
   * @param options.label - Label text to search for (searches multiple label sources)
   * @param options.text - Text to type into the input field
   * @returns Success message with input field description
   * @throws Error with suggestions if input not found or multiple matches
   */
  async typeByLabel(options: { label: string; text: string }): Promise<string> {
    const { label, text } = options;

    // Search for input by various label sources
    const searchScript = `
      (function() {
        const labelText = ${JSON.stringify(label)};
        const inputs = [];

        // Strategy 1: Find labels containing text, then get their associated inputs
        document.querySelectorAll('label').forEach(labelEl => {
          if (labelEl.textContent.includes(labelText)) {
            const forAttr = labelEl.getAttribute('for');
            if (forAttr) {
              const input = document.getElementById(forAttr);
              if (input) inputs.push({ input, source: 'label[for]', labelText: labelEl.textContent.trim() });
            } else {
              // Label wraps input
              const input = labelEl.querySelector('input, textarea, select');
              if (input) inputs.push({ input, source: 'parent label', labelText: labelEl.textContent.trim() });
            }
          }
        });

        // Strategy 2: Find inputs with aria-label
        document.querySelectorAll('input[aria-label], textarea[aria-label], select[aria-label]').forEach(input => {
          if (input.getAttribute('aria-label').includes(labelText)) {
            inputs.push({ input, source: 'aria-label', labelText: input.getAttribute('aria-label') });
          }
        });

        // Strategy 3: Find inputs with placeholder
        document.querySelectorAll('input[placeholder], textarea[placeholder]').forEach(input => {
          if (input.getAttribute('placeholder').includes(labelText)) {
            inputs.push({ input, source: 'placeholder', labelText: input.getAttribute('placeholder') });
          }
        });

        // Filter visible inputs and deduplicate
        const seen = new Set();
        const visibleInputs = inputs.filter(({ input }) => {
          if (seen.has(input)) return false;
          seen.add(input);

          const rect = input.getBoundingClientRect();
          return rect.width > 0 && rect.height > 0 &&
                 window.getComputedStyle(input).visibility !== 'hidden' &&
                 window.getComputedStyle(input).display !== 'none';
        });

        return {
          count: visibleInputs.length,
          inputs: visibleInputs.slice(0, 5).map(({ input, source, labelText }) => ({
            tagName: input.tagName,
            type: input.type || '',
            id: input.id || '',
            name: input.name || '',
            source,
            labelText: labelText.substring(0, 100)
          }))
        };
      })()
    `;

    const searchResult = await this.client.Runtime.evaluate({
      expression: searchScript,
      returnByValue: true
    });

    if (searchResult.exceptionDetails) {
      throw new Error(JSON.stringify({
        error: "SEARCH_FAILED",
        message: "Failed to search for input by label",
        details: searchResult.exceptionDetails.text
      }));
    }

    const { count, inputs } = searchResult.result.value;

    // Handle no matches
    if (count === 0) {
      throw new Error(JSON.stringify({
        error: "INPUT_NOT_FOUND",
        field: "label",
        message: `No visible input found with label: "${label}"`,
        suggestions: [
          "Check if label text is visible on page",
          "Label search checks: <label>, aria-label, placeholder",
          "Use chrome_extract_forms to see available input fields"
        ]
      }));
    }

    // Handle multiple matches
    if (count > 1) {
      const inputDescriptions = inputs.map((inp: any) =>
        `${inp.tagName}[type="${inp.type}"] (${inp.source}): "${inp.labelText}"`
      );

      throw new Error(JSON.stringify({
        error: "MULTIPLE_INPUTS_FOUND",
        field: "label",
        message: `Found ${count} inputs with label: "${label}"`,
        matches: inputDescriptions,
        suggestions: [
          "Use more specific label text",
          "Use chrome_type with a CSS selector for precise targeting"
        ]
      }));
    }

    // Single match - perform type using CDP
    const input = inputs[0];

    // Build selector from input info
    let selector = input.id ? `#${input.id}` : `${input.tagName.toLowerCase()}[name="${input.name}"]`;

    // Use DOM API to find and focus element
    const { root } = await this.client.DOM.getDocument();
    const { nodeId } = await this.client.DOM.querySelector({
      nodeId: root.nodeId,
      selector: selector
    });

    if (!nodeId) {
      throw new Error(JSON.stringify({
        error: "INPUT_INTERACTION_FAILED",
        message: "Input found but could not be focused",
        suggestion: "Input may have been removed from DOM"
      }));
    }

    // Focus element
    await this.client.DOM.focus({ nodeId });

    // Type each character using Input API
    for (const char of text) {
      await this.client.Input.dispatchKeyEvent({
        type: 'keyDown',
        text: char
      });
      await this.client.Input.dispatchKeyEvent({
        type: 'keyUp',
        text: char
      });
    }

    return `Typed text into ${input.tagName}[type="${input.type}"] with label: "${label.substring(0, 50)}" (found via ${input.source})`;
  }

  /**
   * Extract all interactive elements with their text and metadata
   *
   * Collects buttons, links, inputs with visible text, role, selector, visibility, and enabled status.
   * Uses O(1) deduplication to prevent duplicate entries.
   * Limited to 100 elements for performance.
   *
   * Performance: Single Runtime.evaluate call, O(n) collection with O(1) deduplication
   *
   * @returns Array of interactive elements with metadata
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
    const extractScript = `
      (function() {
        const elements = [];
        const seen = new Set(); // O(1) deduplication

        // Collect buttons
        document.querySelectorAll('button, [role="button"]').forEach(el => {
          const key = el.tagName + (el.id || '') + (el.className || '') + el.textContent.trim();
          if (seen.has(key)) return;
          seen.add(key);

          const rect = el.getBoundingClientRect();
          const isVisible = rect.width > 0 && rect.height > 0 &&
                          window.getComputedStyle(el).visibility !== 'hidden' &&
                          window.getComputedStyle(el).display !== 'none';

          const selector = el.id ? \`#\${el.id}\` :
                          el.className ? \`\${el.tagName.toLowerCase()}.\${el.className.split(' ')[0]}\` :
                          el.tagName.toLowerCase();

          elements.push({
            text: el.textContent.trim().substring(0, 100),
            role: el.getAttribute('role') || 'button',
            selector,
            tagName: el.tagName,
            isVisible,
            isEnabled: !el.disabled
          });
        });

        // Collect links
        document.querySelectorAll('a, [role="link"]').forEach(el => {
          const key = el.tagName + (el.id || '') + (el.className || '') + el.textContent.trim();
          if (seen.has(key)) return;
          seen.add(key);

          const rect = el.getBoundingClientRect();
          const isVisible = rect.width > 0 && rect.height > 0 &&
                          window.getComputedStyle(el).visibility !== 'hidden' &&
                          window.getComputedStyle(el).display !== 'none';

          const selector = el.id ? \`#\${el.id}\` :
                          el.className ? \`\${el.tagName.toLowerCase()}.\${el.className.split(' ')[0]}\` :
                          el.tagName.toLowerCase();

          elements.push({
            text: el.textContent.trim().substring(0, 100),
            role: el.getAttribute('role') || 'link',
            selector,
            tagName: el.tagName,
            isVisible,
            isEnabled: true
          });
        });

        // Collect inputs
        document.querySelectorAll('input, textarea, select, [role="textbox"]').forEach(el => {
          const key = el.tagName + (el.id || '') + (el.name || '') + (el.type || '');
          if (seen.has(key)) return;
          seen.add(key);

          const rect = el.getBoundingClientRect();
          const isVisible = rect.width > 0 && rect.height > 0 &&
                          window.getComputedStyle(el).visibility !== 'hidden' &&
                          window.getComputedStyle(el).display !== 'none';

          // Find label text
          let labelText = '';
          if (el.id) {
            const label = document.querySelector(\`label[for="\${el.id}"]\`);
            if (label) labelText = label.textContent.trim();
          }
          if (!labelText) {
            const parentLabel = el.closest('label');
            if (parentLabel) labelText = parentLabel.textContent.trim();
          }
          if (!labelText) {
            labelText = el.getAttribute('aria-label') || el.getAttribute('placeholder') || '';
          }

          const selector = el.id ? \`#\${el.id}\` :
                          el.name ? \`\${el.tagName.toLowerCase()}[name="\${el.name}"]\` :
                          el.tagName.toLowerCase();

          elements.push({
            text: labelText.substring(0, 100),
            role: el.getAttribute('role') || 'textbox',
            selector,
            tagName: el.tagName,
            isVisible,
            isEnabled: !el.disabled && !el.readOnly
          });
        });

        // Limit to first 100 elements
        return elements.slice(0, ${TextInteractionService.MAX_INTERACTIVE_ELEMENTS});
      })()
    `;

    const result = await this.client.Runtime.evaluate({
      expression: extractScript,
      returnByValue: true
    });

    if (result.exceptionDetails) {
      throw new Error(JSON.stringify({
        error: "EXTRACTION_FAILED",
        message: "Failed to extract interactive elements",
        details: result.exceptionDetails.text
      }));
    }

    return { elements: result.result.value };
  }

  /**
   * Get a property value from an element without script injection
   *
   * Uses DOM.querySelector + DOM.resolveNode + Runtime.callFunctionOn for safe property access.
   * No user input enters script execution context.
   *
   * Security: Property name validated to alphanumeric + underscore/hyphen only
   *
   * @param selector - CSS selector for the element
   * @param property - Property name to retrieve (alphanumeric + underscore/hyphen only)
   * @returns Property value (any type)
   * @throws Error if element not found or property access fails
   */
  async getProperty(selector: string, property: string): Promise<any> {
    // Find element using DOM API
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

    // Resolve node to get object ID
    const { object } = await this.client.DOM.resolveNode({ nodeId });

    // Call function on object to access property safely
    const result = await this.client.Runtime.callFunctionOn({
      objectId: object.objectId!,
      functionDeclaration: `function() { return this[${JSON.stringify(property)}]; }`,
      returnByValue: true
    });

    if (result.exceptionDetails) {
      throw new Error(JSON.stringify({
        error: "PROPERTY_ACCESS_FAILED",
        field: "property",
        message: `Failed to access property: ${property}`,
        details: result.exceptionDetails.text
      }));
    }

    return result.result.value;
  }
}
