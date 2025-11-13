/**
 * ValidationService - Input validation for all tool parameters
 *
 * Responsible for validating selectors, timeouts, URLs, and dimensions.
 * All methods are static as they don't require any state or dependencies.
 */
export class ValidationService {
  /**
   * Validate CSS selector syntax
   * @throws {Error} JSON error with details if validation fails
   */
  static validateSelector(selector: string): void {
    if (!selector || selector.trim() === '') {
      throw new Error(JSON.stringify({
        error: "INVALID_SELECTOR",
        field: "selector",
        message: "Selector cannot be empty",
        example: "button.primary"
      }));
    }
    if (selector.length > 1000) {
      throw new Error(JSON.stringify({
        error: "INVALID_SELECTOR",
        field: "selector",
        message: "Selector too long (max 1000 characters)",
        length: selector.length
      }));
    }
    // Basic bracket balance check
    let bracketCount = 0;
    for (const char of selector) {
      if (char === '[') bracketCount++;
      if (char === ']') bracketCount--;
      if (bracketCount < 0) {
        throw new Error(JSON.stringify({
          error: "INVALID_SELECTOR",
          field: "selector",
          message: "Invalid selector syntax: unbalanced brackets",
          example: "input[type='text']"
        }));
      }
    }
    if (bracketCount !== 0) {
      throw new Error(JSON.stringify({
        error: "INVALID_SELECTOR",
        field: "selector",
        message: "Invalid selector syntax: unbalanced brackets",
        example: "input[type='text']"
      }));
    }
  }

  /**
   * Validate timeout values (optional parameter)
   * @throws {Error} JSON error with details if validation fails
   */
  static validateTimeout(timeout: number | undefined, fieldName: string): void {
    if (timeout === undefined) return; // Optional
    if (typeof timeout !== 'number' || isNaN(timeout)) {
      throw new Error(JSON.stringify({
        error: "INVALID_TIMEOUT",
        field: fieldName,
        message: "Timeout must be a number",
        validRange: "0-30000"
      }));
    }
    if (timeout < 0 || timeout > 30000) {
      throw new Error(JSON.stringify({
        error: "INVALID_TIMEOUT",
        field: fieldName,
        message: `Timeout must be between 0-30000ms, got ${timeout}`,
        validRange: "0-30000"
      }));
    }
  }

  /**
   * Validate URL format and scheme
   * @throws {Error} JSON error with details if validation fails
   */
  static validateUrl(url: string): void {
    if (!url || url.trim() === '') {
      throw new Error(JSON.stringify({
        error: "INVALID_URL",
        field: "url",
        message: "URL cannot be empty",
        allowedSchemes: ["http", "https"]
      }));
    }

    let parsedUrl: URL;
    try {
      parsedUrl = new URL(url);
    } catch (error) {
      throw new Error(JSON.stringify({
        error: "INVALID_URL",
        field: "url",
        message: "Invalid URL format",
        allowedSchemes: ["http", "https"],
        example: "https://example.com"
      }));
    }

    const scheme = parsedUrl.protocol.toLowerCase();
    const dangerousSchemes = ['javascript:', 'data:', 'file:'];
    const allowedSchemes = ['http:', 'https:'];

    if (dangerousSchemes.includes(scheme)) {
      throw new Error(JSON.stringify({
        error: "INVALID_URL",
        field: "url",
        message: `Dangerous URL scheme not allowed: ${scheme.replace(':', '')}`,
        allowedSchemes: ["http", "https"]
      }));
    }

    if (!allowedSchemes.includes(scheme)) {
      throw new Error(JSON.stringify({
        error: "INVALID_URL",
        field: "url",
        message: `URL scheme not allowed: ${scheme.replace(':', '')}`,
        allowedSchemes: ["http", "https"]
      }));
    }
  }

  /**
   * Validate dimension values (optional parameter)
   * @throws {Error} JSON error with details if validation fails
   */
  static validateDimension(dimension: number | undefined): void {
    if (dimension === undefined) return; // Optional
    if (typeof dimension !== 'number' || isNaN(dimension)) {
      throw new Error(JSON.stringify({
        error: "INVALID_DIMENSION",
        field: "maxDimension",
        message: "Dimension must be a number",
        validRange: "100-10000"
      }));
    }
    if (dimension < 100 || dimension > 10000) {
      throw new Error(JSON.stringify({
        error: "INVALID_DIMENSION",
        field: "maxDimension",
        message: `Dimension must be between 100-10000px, got ${dimension}`,
        validRange: "100-10000"
      }));
    }
  }

  /**
   * Validate text content for interaction tools
   * @throws {Error} JSON error with details if validation fails
   */
  static validateText(text: string): void {
    if (!text || text.trim() === '') {
      throw new Error(JSON.stringify({
        error: "INVALID_TEXT",
        field: "text",
        message: "Text cannot be empty",
        example: "Sign In"
      }));
    }
    if (text.length > 1000) {
      throw new Error(JSON.stringify({
        error: "INVALID_TEXT",
        field: "text",
        message: `Text too long (max 1000 characters), got ${text.length}`,
        maxLength: 1000
      }));
    }
  }

  /**
   * Validate ARIA role values
   * @throws {Error} JSON error with details if validation fails
   */
  static validateRole(role: string | undefined): void {
    if (role === undefined) return; // Optional

    const validRoles = [
      'button', 'link', 'checkbox', 'radio', 'textbox', 'searchbox',
      'combobox', 'listbox', 'menuitem', 'tab', 'switch', 'slider'
    ];

    if (!validRoles.includes(role)) {
      throw new Error(JSON.stringify({
        error: "INVALID_ROLE",
        field: "role",
        message: `Invalid ARIA role: ${role}`,
        validRoles: validRoles,
        example: "button"
      }));
    }
  }

  /**
   * Validate property name for safe access
   * @throws {Error} JSON error with details if validation fails
   */
  static validatePropertyName(property: string): void {
    if (!property || property.trim() === '') {
      throw new Error(JSON.stringify({
        error: "INVALID_PROPERTY",
        field: "property",
        message: "Property name cannot be empty",
        example: "value"
      }));
    }

    // Only allow alphanumeric, underscore, and hyphen
    const validPattern = /^[a-zA-Z0-9_-]+$/;
    if (!validPattern.test(property)) {
      throw new Error(JSON.stringify({
        error: "INVALID_PROPERTY",
        field: "property",
        message: `Property name contains invalid characters: ${property}`,
        allowedPattern: "alphanumeric, underscore, hyphen only",
        example: "innerText"
      }));
    }
  }
}
