/**
 * ResponseBuilder - Standard response format utility
 *
 * Provides consistent success/error response structure across all tools.
 * Implements ToolResponse interface for standardized API responses.
 *
 * Usage:
 *   ResponseBuilder.success({ data: result })
 *   ResponseBuilder.error('ERROR_CODE', 'Message', { suggestions: [...] })
 */

export interface ToolResponse<T = any> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
    suggestions?: string[];
    context?: Record<string, any>;
  };
  metadata?: {
    timeElapsed?: number;
    [key: string]: any;
  };
}

export class ResponseBuilder {
  /**
   * Create a successful response
   * @param data - Response payload
   * @param metadata - Optional metadata (timeElapsed, etc.)
   */
  static success<T>(data: T, metadata?: Record<string, any>): ToolResponse<T> {
    return {
      success: true,
      data,
      ...(metadata && { metadata })
    };
  }

  /**
   * Create an error response
   * @param code - Error code (e.g., 'ELEMENT_NOT_FOUND')
   * @param message - Human-readable error message
   * @param context - Additional context (suggestions, field, etc.)
   */
  static error(
    code: string,
    message: string,
    context?: {
      suggestions?: string[];
      field?: string;
      [key: string]: any;
    }
  ): ToolResponse<never> {
    return {
      success: false,
      error: {
        code,
        message,
        ...(context?.suggestions && { suggestions: context.suggestions }),
        ...(context && {
          context: Object.fromEntries(
            Object.entries(context).filter(([key]) => key !== 'suggestions')
          )
        })
      }
    };
  }

  /**
   * Create error response from validation failure
   * Parses JSON error format from ValidationService
   */
  static fromValidationError(error: Error): ToolResponse<never> {
    try {
      const errorObj = JSON.parse(error.message);
      return ResponseBuilder.error(
        errorObj.error,
        errorObj.message,
        {
          field: errorObj.field,
          ...errorObj
        }
      );
    } catch {
      // Not a JSON error, return generic error
      return ResponseBuilder.error('VALIDATION_ERROR', error.message);
    }
  }

  /**
   * Wrap a function with timing metadata
   * Automatically adds timeElapsed to response metadata
   */
  static async withTiming<T>(
    fn: () => Promise<ToolResponse<T>>
  ): Promise<ToolResponse<T>> {
    const startTime = Date.now();
    try {
      const response = await fn();
      const timeElapsed = Date.now() - startTime;

      return {
        ...response,
        metadata: {
          ...response.metadata,
          timeElapsed
        }
      };
    } catch (error) {
      const timeElapsed = Date.now() - startTime;
      if ((error as any).success === false) {
        // Already a ToolResponse error
        return {
          ...(error as ToolResponse<T>),
          metadata: {
            ...(error as ToolResponse<T>).metadata,
            timeElapsed
          }
        };
      }
      throw error;
    }
  }

  /**
   * Common pattern: Element not found error
   */
  static elementNotFound(
    selector: string,
    suggestions?: string[]
  ): ToolResponse<never> {
    return ResponseBuilder.error(
      'ELEMENT_NOT_FOUND',
      `Element not found: ${selector}`,
      {
        field: 'selector',
        suggestions: suggestions || [
          'Verify selector using chrome_check_page',
          'Check if element is visible on page',
          'Use chrome_extract_interactive to find available elements'
        ]
      }
    );
  }

  /**
   * Common pattern: Multiple elements found error
   */
  static multipleElementsFound(
    selector: string,
    count: number,
    suggestions?: string[]
  ): ToolResponse<never> {
    return ResponseBuilder.error(
      'MULTIPLE_ELEMENTS_FOUND',
      `Found ${count} matching elements`,
      {
        field: 'selector',
        count,
        suggestions: suggestions || [
          'Use more specific selector',
          'Add ID or class to narrow results',
          'Use :first-of-type or :nth-child to select specific instance'
        ]
      }
    );
  }

  /**
   * Common pattern: Element not ready for interaction
   */
  static elementNotReady(
    selector: string,
    state: {
      visible?: boolean;
      enabled?: boolean;
      stable?: boolean;
    },
    suggestions?: string[]
  ): ToolResponse<never> {
    const reasons = [];
    if (state.visible === false) reasons.push('not visible');
    if (state.enabled === false) reasons.push('disabled');
    if (state.stable === false) reasons.push('position unstable');

    return ResponseBuilder.error(
      'ELEMENT_NOT_READY',
      `Element not ready for interaction: ${reasons.join(', ')}`,
      {
        field: 'selector',
        selector,
        state,
        suggestions: suggestions || [
          'Wait for page to finish loading',
          'Use chrome_wait_for to wait for element state',
          'Check if element is covered by another element'
        ]
      }
    );
  }

  /**
   * Common pattern: Timeout error
   */
  static timeout(
    operation: string,
    timeoutMs: number,
    suggestions?: string[]
  ): ToolResponse<never> {
    return ResponseBuilder.error(
      'TIMEOUT',
      `Operation timed out after ${timeoutMs}ms: ${operation}`,
      {
        operation,
        timeoutMs,
        suggestions: suggestions || [
          'Increase timeout value',
          'Check if page is loading slowly',
          'Verify element selector is correct'
        ]
      }
    );
  }
}
