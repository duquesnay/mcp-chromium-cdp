import { describe, it, expect } from 'vitest';
import { ResponseBuilder, ToolResponse } from '../../src/utils/response-builder.js';

describe('ResponseBuilder', () => {
  describe('success()', () => {
    it('should create success response with data', () => {
      const data = { result: 'test' };
      const response = ResponseBuilder.success(data);

      expect(response.success).toBe(true);
      expect(response.data).toEqual(data);
      expect(response.error).toBeUndefined();
    });

    it('should include metadata when provided', () => {
      const data = { result: 'test' };
      const metadata = { timeElapsed: 100 };
      const response = ResponseBuilder.success(data, metadata);

      expect(response.success).toBe(true);
      expect(response.metadata).toEqual(metadata);
    });

    it('should work with different data types', () => {
      const stringResponse = ResponseBuilder.success('test');
      const numberResponse = ResponseBuilder.success(42);
      const arrayResponse = ResponseBuilder.success([1, 2, 3]);

      expect(stringResponse.data).toBe('test');
      expect(numberResponse.data).toBe(42);
      expect(arrayResponse.data).toEqual([1, 2, 3]);
    });
  });

  describe('error()', () => {
    it('should create error response with code and message', () => {
      const response = ResponseBuilder.error('TEST_ERROR', 'Test message');

      expect(response.success).toBe(false);
      expect(response.error?.code).toBe('TEST_ERROR');
      expect(response.error?.message).toBe('Test message');
      expect(response.data).toBeUndefined();
    });

    it('should include suggestions when provided', () => {
      const suggestions = ['Try this', 'Or that'];
      const response = ResponseBuilder.error('TEST_ERROR', 'Message', {
        suggestions
      });

      expect(response.error?.suggestions).toEqual(suggestions);
    });

    it('should include context fields', () => {
      const response = ResponseBuilder.error('TEST_ERROR', 'Message', {
        field: 'selector',
        additionalInfo: 'extra'
      });

      expect(response.error?.context?.field).toBe('selector');
      expect(response.error?.context?.additionalInfo).toBe('extra');
    });

    it('should separate suggestions from context', () => {
      const response = ResponseBuilder.error('TEST_ERROR', 'Message', {
        suggestions: ['Hint'],
        field: 'test',
        count: 5
      });

      expect(response.error?.suggestions).toEqual(['Hint']);
      expect(response.error?.context?.field).toBe('test');
      expect(response.error?.context?.count).toBe(5);
      expect(response.error?.context?.suggestions).toBeUndefined();
    });
  });

  describe('fromValidationError()', () => {
    it('should parse JSON error from ValidationService', () => {
      const errorObj = {
        error: 'INVALID_SELECTOR',
        field: 'selector',
        message: 'Selector cannot be empty',
        example: 'button.primary'
      };
      const error = new Error(JSON.stringify(errorObj));

      const response = ResponseBuilder.fromValidationError(error);

      expect(response.success).toBe(false);
      expect(response.error?.code).toBe('INVALID_SELECTOR');
      expect(response.error?.message).toBe('Selector cannot be empty');
      expect(response.error?.context?.field).toBe('selector');
      expect(response.error?.context?.example).toBe('button.primary');
    });

    it('should handle non-JSON errors', () => {
      const error = new Error('Plain error message');
      const response = ResponseBuilder.fromValidationError(error);

      expect(response.success).toBe(false);
      expect(response.error?.code).toBe('VALIDATION_ERROR');
      expect(response.error?.message).toBe('Plain error message');
    });
  });

  describe('withTiming()', () => {
    it('should add timeElapsed metadata to success response', async () => {
      const response = await ResponseBuilder.withTiming(async () => {
        await new Promise(resolve => setTimeout(resolve, 10));
        return ResponseBuilder.success({ result: 'test' });
      });

      expect(response.success).toBe(true);
      expect(response.metadata?.timeElapsed).toBeGreaterThanOrEqual(10);
    });

    it('should add timeElapsed metadata to error response', async () => {
      const response = await ResponseBuilder.withTiming(async () => {
        await new Promise(resolve => setTimeout(resolve, 10));
        return ResponseBuilder.error('TEST_ERROR', 'Test message');
      });

      expect(response.success).toBe(false);
      expect(response.metadata?.timeElapsed).toBeGreaterThanOrEqual(10);
    });

    it('should preserve existing metadata', async () => {
      const response = await ResponseBuilder.withTiming(async () => {
        return ResponseBuilder.success({ result: 'test' }, { custom: 'value' });
      });

      expect(response.metadata?.custom).toBe('value');
      expect(response.metadata?.timeElapsed).toBeDefined();
    });
  });

  describe('elementNotFound()', () => {
    it('should create standard element not found error', () => {
      const response = ResponseBuilder.elementNotFound('.button');

      expect(response.success).toBe(false);
      expect(response.error?.code).toBe('ELEMENT_NOT_FOUND');
      expect(response.error?.message).toContain('.button');
      expect(response.error?.context?.field).toBe('selector');
      expect(response.error?.suggestions).toHaveLength(3);
    });

    it('should accept custom suggestions', () => {
      const suggestions = ['Custom hint'];
      const response = ResponseBuilder.elementNotFound('.button', suggestions);

      expect(response.error?.suggestions).toEqual(suggestions);
    });
  });

  describe('multipleElementsFound()', () => {
    it('should create standard multiple elements error', () => {
      const response = ResponseBuilder.multipleElementsFound('.button', 5);

      expect(response.success).toBe(false);
      expect(response.error?.code).toBe('MULTIPLE_ELEMENTS_FOUND');
      expect(response.error?.message).toContain('5');
      expect(response.error?.context?.count).toBe(5);
      expect(response.error?.suggestions).toHaveLength(3);
    });
  });

  describe('elementNotReady()', () => {
    it('should create element not ready error with state details', () => {
      const state = {
        visible: false,
        enabled: true,
        stable: false
      };
      const response = ResponseBuilder.elementNotReady('.button', state);

      expect(response.success).toBe(false);
      expect(response.error?.code).toBe('ELEMENT_NOT_READY');
      expect(response.error?.message).toContain('not visible');
      expect(response.error?.message).toContain('position unstable');
      expect(response.error?.context?.state).toEqual(state);
    });

    it('should handle all states being false', () => {
      const state = {
        visible: false,
        enabled: false,
        stable: false
      };
      const response = ResponseBuilder.elementNotReady('.button', state);

      expect(response.error?.message).toContain('not visible');
      expect(response.error?.message).toContain('disabled');
      expect(response.error?.message).toContain('position unstable');
    });

    it('should handle disabled state only', () => {
      const state = {
        visible: true,
        enabled: false,
        stable: true
      };
      const response = ResponseBuilder.elementNotReady('.button', state);

      expect(response.error?.message).toContain('disabled');
      expect(response.error?.message).not.toContain('not visible');
      expect(response.error?.message).not.toContain('position unstable');
    });
  });

  describe('timeout()', () => {
    it('should create timeout error', () => {
      const response = ResponseBuilder.timeout('element click', 5000);

      expect(response.success).toBe(false);
      expect(response.error?.code).toBe('TIMEOUT');
      expect(response.error?.message).toContain('5000ms');
      expect(response.error?.message).toContain('element click');
      expect(response.error?.context?.timeoutMs).toBe(5000);
      expect(response.error?.suggestions).toHaveLength(3);
    });
  });
});
