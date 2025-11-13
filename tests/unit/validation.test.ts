import { describe, it, expect, beforeEach } from 'vitest';
import { ChromeController } from '../../src/chrome-controller.js';
import { MockCDPClient } from '../fixtures/mock-cdp-client.js';

describe('Input Validation', () => {
  let controller: ChromeController;
  let mockClient: MockCDPClient;

  beforeEach(() => {
    mockClient = new MockCDPClient();
    controller = new ChromeController();
    // Inject mock client to bypass connection
    (controller as any).client = mockClient;
  });

  describe('Selector Validation', () => {
    describe('click()', () => {
      it('should reject empty selector', async () => {
        await expect(controller.click('')).rejects.toThrow();
        const error = await controller.click('').catch(e => e);
        const errorObj = JSON.parse(error.message);
        expect(errorObj.error).toBe('INVALID_SELECTOR');
        expect(errorObj.field).toBe('selector');
        expect(errorObj.message).toContain('cannot be empty');
      });

      it('should reject whitespace-only selector', async () => {
        await expect(controller.click('   ')).rejects.toThrow();
        const error = await controller.click('   ').catch(e => e);
        const errorObj = JSON.parse(error.message);
        expect(errorObj.error).toBe('INVALID_SELECTOR');
      });

      it('should reject selector longer than 1000 characters', async () => {
        const longSelector = 'a'.repeat(1001);
        await expect(controller.click(longSelector)).rejects.toThrow();
        const error = await controller.click(longSelector).catch(e => e);
        const errorObj = JSON.parse(error.message);
        expect(errorObj.error).toBe('INVALID_SELECTOR');
        expect(errorObj.message).toContain('too long');
        expect(errorObj.length).toBe(1001);
      });

      it('should reject selector with unbalanced brackets', async () => {
        await expect(controller.click('input[type="text"')).rejects.toThrow();
        const error = await controller.click('input[type="text"').catch(e => e);
        const errorObj = JSON.parse(error.message);
        expect(errorObj.error).toBe('INVALID_SELECTOR');
        expect(errorObj.message).toContain('unbalanced brackets');
      });

      it('should reject selector with extra closing bracket', async () => {
        await expect(controller.click('input]')).rejects.toThrow();
        const error = await controller.click('input]').catch(e => e);
        const errorObj = JSON.parse(error.message);
        expect(errorObj.error).toBe('INVALID_SELECTOR');
        expect(errorObj.message).toContain('unbalanced brackets');
      });

      it('should accept valid simple selector', async () => {
        mockClient.DOM.querySelector.mockResolvedValue({ nodeId: 5 });
        await expect(controller.click('button.primary')).resolves.toBeTruthy();
      });

      it('should accept valid complex selector with balanced brackets', async () => {
        mockClient.DOM.querySelector.mockResolvedValue({ nodeId: 5 });
        await expect(controller.click('input[type="text"][name="email"]')).resolves.toBeTruthy();
      });
    });

    describe('type()', () => {
      it('should reject empty selector', async () => {
        await expect(controller.type('', 'text')).rejects.toThrow();
        const error = await controller.type('', 'text').catch(e => e);
        const errorObj = JSON.parse(error.message);
        expect(errorObj.error).toBe('INVALID_SELECTOR');
      });

      it('should reject selector longer than 1000 characters', async () => {
        const longSelector = 'a'.repeat(1001);
        await expect(controller.type(longSelector, 'text')).rejects.toThrow();
      });

      it('should accept valid selector', async () => {
        mockClient.DOM.querySelector.mockResolvedValue({ nodeId: 5 });
        await expect(controller.type('#email', 'test@example.com')).resolves.toBeTruthy();
      });
    });

    describe('extractForms()', () => {
      it('should reject empty selector', async () => {
        await expect(controller.extractForms('')).rejects.toThrow();
        const error = await controller.extractForms('').catch(e => e);
        const errorObj = JSON.parse(error.message);
        expect(errorObj.error).toBe('INVALID_SELECTOR');
      });

      it('should reject selector with unbalanced brackets', async () => {
        await expect(controller.extractForms('form[id="login"')).rejects.toThrow();
      });

      it('should accept valid selector', async () => {
        mockClient.Runtime.evaluate.mockResolvedValue({
          result: { value: { forms: [] } },
          exceptionDetails: undefined
        });
        await expect(controller.extractForms('form.login-form')).resolves.toBeTruthy();
      });

      it('should accept undefined selector', async () => {
        mockClient.Runtime.evaluate.mockResolvedValue({
          result: { value: { forms: [] } },
          exceptionDetails: undefined
        });
        await expect(controller.extractForms()).resolves.toBeTruthy();
      });
    });

    describe('waitFor()', () => {
      it('should reject empty element selector', async () => {
        await expect(controller.waitFor({ element: '' })).rejects.toThrow();
        const error = await controller.waitFor({ element: '' }).catch(e => e);
        const errorObj = JSON.parse(error.message);
        expect(errorObj.error).toBe('INVALID_SELECTOR');
      });

      it('should reject element selector with unbalanced brackets', async () => {
        await expect(controller.waitFor({ element: 'div[class="test"' })).rejects.toThrow();
      });

      it('should accept valid element selector', async () => {
        mockClient.DOM.querySelector.mockResolvedValue({ nodeId: 5 });
        mockClient.Runtime.evaluate.mockResolvedValue({
          result: { value: 'https://example.com' },
          exceptionDetails: undefined
        });
        const result = await controller.waitFor({ element: '#success', timeout: 100 });
        expect(result.success).toBe(true);
      });
    });
  });

  describe('Timeout Validation', () => {
    describe('waitFor()', () => {
      it('should reject negative timeout', async () => {
        await expect(controller.waitFor({ element: '#test', timeout: -1 })).rejects.toThrow();
        const error = await controller.waitFor({ element: '#test', timeout: -1 }).catch(e => e);
        const errorObj = JSON.parse(error.message);
        expect(errorObj.error).toBe('INVALID_TIMEOUT');
        expect(errorObj.field).toBe('timeout');
        expect(errorObj.validRange).toBe('0-30000');
      });

      it('should reject timeout greater than 30000ms', async () => {
        await expect(controller.waitFor({ element: '#test', timeout: 30001 })).rejects.toThrow();
        const error = await controller.waitFor({ element: '#test', timeout: 30001 }).catch(e => e);
        const errorObj = JSON.parse(error.message);
        expect(errorObj.error).toBe('INVALID_TIMEOUT');
        expect(errorObj.message).toContain('30001');
      });

      it('should reject non-number timeout', async () => {
        await expect(controller.waitFor({ element: '#test', timeout: 'abc' as any })).rejects.toThrow();
        const error = await controller.waitFor({ element: '#test', timeout: 'abc' as any }).catch(e => e);
        const errorObj = JSON.parse(error.message);
        expect(errorObj.error).toBe('INVALID_TIMEOUT');
        expect(errorObj.message).toContain('must be a number');
      });

      it('should reject NaN timeout', async () => {
        await expect(controller.waitFor({ element: '#test', timeout: NaN })).rejects.toThrow();
      });

      it('should accept timeout at lower boundary (0ms)', async () => {
        mockClient.DOM.querySelector.mockResolvedValue({ nodeId: 5 });
        mockClient.Runtime.evaluate.mockResolvedValue({
          result: { value: 'https://example.com' },
          exceptionDetails: undefined
        });
        await expect(controller.waitFor({ element: '#test', timeout: 0 })).resolves.toBeTruthy();
      });

      it('should accept timeout at upper boundary (30000ms)', async () => {
        mockClient.DOM.querySelector.mockResolvedValue({ nodeId: 5 });
        mockClient.Runtime.evaluate.mockResolvedValue({
          result: { value: 'https://example.com' },
          exceptionDetails: undefined
        });
        await expect(controller.waitFor({ element: '#test', timeout: 30000 })).resolves.toBeTruthy();
      });

      it('should accept valid timeout in range', async () => {
        mockClient.DOM.querySelector.mockResolvedValue({ nodeId: 5 });
        mockClient.Runtime.evaluate.mockResolvedValue({
          result: { value: 'https://example.com' },
          exceptionDetails: undefined
        });
        await expect(controller.waitFor({ element: '#test', timeout: 5000 })).resolves.toBeTruthy();
      });

      it('should accept undefined timeout (uses default)', async () => {
        mockClient.DOM.querySelector.mockResolvedValue({ nodeId: 5 });
        mockClient.Runtime.evaluate.mockResolvedValue({
          result: { value: 'https://example.com' },
          exceptionDetails: undefined
        });
        await expect(controller.waitFor({ element: '#test' })).resolves.toBeTruthy();
      });
    });
  });

  describe('URL Validation', () => {
    describe('navigate()', () => {
      it('should reject empty URL', async () => {
        await expect(controller.navigate('')).rejects.toThrow();
        const error = await controller.navigate('').catch(e => e);
        const errorObj = JSON.parse(error.message);
        expect(errorObj.error).toBe('INVALID_URL');
        expect(errorObj.field).toBe('url');
        expect(errorObj.message).toContain('cannot be empty');
      });

      it('should reject whitespace-only URL', async () => {
        await expect(controller.navigate('   ')).rejects.toThrow();
        const error = await controller.navigate('   ').catch(e => e);
        const errorObj = JSON.parse(error.message);
        expect(errorObj.error).toBe('INVALID_URL');
      });

      it('should reject invalid URL format', async () => {
        await expect(controller.navigate('not-a-url')).rejects.toThrow();
        const error = await controller.navigate('not-a-url').catch(e => e);
        const errorObj = JSON.parse(error.message);
        expect(errorObj.error).toBe('INVALID_URL');
        expect(errorObj.message).toContain('Invalid URL format');
      });

      it('should reject javascript: scheme', async () => {
        await expect(controller.navigate('javascript:alert(1)')).rejects.toThrow();
        const error = await controller.navigate('javascript:alert(1)').catch(e => e);
        const errorObj = JSON.parse(error.message);
        expect(errorObj.error).toBe('INVALID_URL');
        expect(errorObj.message).toContain('Dangerous URL scheme');
        expect(errorObj.message).toContain('javascript');
      });

      it('should reject data: scheme', async () => {
        await expect(controller.navigate('data:text/html,<script>alert(1)</script>')).rejects.toThrow();
        const error = await controller.navigate('data:text/html,<script>alert(1)</script>').catch(e => e);
        const errorObj = JSON.parse(error.message);
        expect(errorObj.error).toBe('INVALID_URL');
        expect(errorObj.message).toContain('Dangerous URL scheme');
        expect(errorObj.message).toContain('data');
      });

      it('should reject file: scheme', async () => {
        await expect(controller.navigate('file:///etc/passwd')).rejects.toThrow();
        const error = await controller.navigate('file:///etc/passwd').catch(e => e);
        const errorObj = JSON.parse(error.message);
        expect(errorObj.error).toBe('INVALID_URL');
        expect(errorObj.message).toContain('Dangerous URL scheme');
        expect(errorObj.message).toContain('file');
      });

      it('should reject ftp: scheme', async () => {
        await expect(controller.navigate('ftp://example.com')).rejects.toThrow();
        const error = await controller.navigate('ftp://example.com').catch(e => e);
        const errorObj = JSON.parse(error.message);
        expect(errorObj.error).toBe('INVALID_URL');
        expect(errorObj.message).toContain('URL scheme not allowed');
        expect(errorObj.message).toContain('ftp');
      });

      it('should accept http: URL', async () => {
        mockClient.Page.navigate.mockResolvedValue({ frameId: 'frame123' });
        await expect(controller.navigate('http://example.com')).resolves.toBeTruthy();
      });

      it('should accept https: URL', async () => {
        mockClient.Page.navigate.mockResolvedValue({ frameId: 'frame123' });
        await expect(controller.navigate('https://example.com')).resolves.toBeTruthy();
      });

      it('should accept HTTPS: URL (uppercase scheme)', async () => {
        mockClient.Page.navigate.mockResolvedValue({ frameId: 'frame123' });
        await expect(controller.navigate('HTTPS://example.com')).resolves.toBeTruthy();
      });

      it('should accept URL with port', async () => {
        mockClient.Page.navigate.mockResolvedValue({ frameId: 'frame123' });
        await expect(controller.navigate('https://example.com:8080')).resolves.toBeTruthy();
      });

      it('should accept URL with path and query', async () => {
        mockClient.Page.navigate.mockResolvedValue({ frameId: 'frame123' });
        await expect(controller.navigate('https://example.com/path?query=value')).resolves.toBeTruthy();
      });
    });
  });

  describe('Dimension Validation', () => {
    describe('screenshot()', () => {
      beforeEach(() => {
        // Mock viewport and screenshot
        mockClient.Runtime.evaluate.mockResolvedValue({
          result: { value: JSON.stringify({ width: 1920, height: 1080 }) },
          exceptionDetails: undefined
        });
        mockClient.Page.captureScreenshot.mockResolvedValue({ data: 'base64data' });
      });

      it('should reject dimension less than 100px', async () => {
        await expect(controller.screenshot(99)).rejects.toThrow();
        const error = await controller.screenshot(99).catch(e => e);
        const errorObj = JSON.parse(error.message);
        expect(errorObj.error).toBe('INVALID_DIMENSION');
        expect(errorObj.field).toBe('maxDimension');
        expect(errorObj.validRange).toBe('100-10000');
      });

      it('should reject dimension greater than 10000px', async () => {
        await expect(controller.screenshot(10001)).rejects.toThrow();
        const error = await controller.screenshot(10001).catch(e => e);
        const errorObj = JSON.parse(error.message);
        expect(errorObj.error).toBe('INVALID_DIMENSION');
        expect(errorObj.message).toContain('10001');
      });

      it('should reject non-number dimension', async () => {
        await expect(controller.screenshot('1000' as any)).rejects.toThrow();
        const error = await controller.screenshot('1000' as any).catch(e => e);
        const errorObj = JSON.parse(error.message);
        expect(errorObj.error).toBe('INVALID_DIMENSION');
        expect(errorObj.message).toContain('must be a number');
      });

      it('should reject NaN dimension', async () => {
        await expect(controller.screenshot(NaN)).rejects.toThrow();
      });

      it.skip('should accept dimension at lower boundary (100px)', async () => {
        // Skip: This test requires mocking the sharp library for image resizing
        // Integration tests verify screenshot functionality with real images
        const result = await controller.screenshot(100);
        expect(result).toHaveProperty('screenshot');
        expect(result).toHaveProperty('metadata');
      });

      it('should accept dimension at upper boundary (10000px)', async () => {
        const result = await controller.screenshot(10000);
        expect(result).toHaveProperty('screenshot');
        expect(result).toHaveProperty('metadata');
      });

      it('should accept valid dimension in range', async () => {
        const result = await controller.screenshot(2000);
        expect(result).toHaveProperty('screenshot');
        expect(result).toHaveProperty('metadata');
      });

      it('should accept undefined dimension (uses default)', async () => {
        const result = await controller.screenshot();
        expect(result).toHaveProperty('screenshot');
        expect(result).toHaveProperty('metadata');
      });
    });
  });

  describe('Error Message Structure', () => {
    it('should provide structured error with all required fields for selector', async () => {
      const error = await controller.click('').catch(e => e);
      const errorObj = JSON.parse(error.message);

      expect(errorObj).toHaveProperty('error');
      expect(errorObj).toHaveProperty('field');
      expect(errorObj).toHaveProperty('message');
      expect(errorObj).toHaveProperty('example');
      expect(typeof errorObj.error).toBe('string');
      expect(typeof errorObj.field).toBe('string');
      expect(typeof errorObj.message).toBe('string');
    });

    it('should provide structured error with all required fields for timeout', async () => {
      const error = await controller.waitFor({ element: '#test', timeout: -1 }).catch(e => e);
      const errorObj = JSON.parse(error.message);

      expect(errorObj).toHaveProperty('error');
      expect(errorObj).toHaveProperty('field');
      expect(errorObj).toHaveProperty('message');
      expect(errorObj).toHaveProperty('validRange');
      expect(typeof errorObj.error).toBe('string');
      expect(typeof errorObj.field).toBe('string');
      expect(typeof errorObj.message).toBe('string');
      expect(typeof errorObj.validRange).toBe('string');
    });

    it('should provide structured error with all required fields for URL', async () => {
      const error = await controller.navigate('javascript:alert(1)').catch(e => e);
      const errorObj = JSON.parse(error.message);

      expect(errorObj).toHaveProperty('error');
      expect(errorObj).toHaveProperty('field');
      expect(errorObj).toHaveProperty('message');
      expect(errorObj).toHaveProperty('allowedSchemes');
      expect(Array.isArray(errorObj.allowedSchemes)).toBe(true);
      expect(errorObj.allowedSchemes).toContain('http');
      expect(errorObj.allowedSchemes).toContain('https');
    });

    it('should provide structured error with all required fields for dimension', async () => {
      const error = await controller.screenshot(50).catch(e => e);
      const errorObj = JSON.parse(error.message);

      expect(errorObj).toHaveProperty('error');
      expect(errorObj).toHaveProperty('field');
      expect(errorObj).toHaveProperty('message');
      expect(errorObj).toHaveProperty('validRange');
      expect(typeof errorObj.error).toBe('string');
      expect(typeof errorObj.field).toBe('string');
      expect(typeof errorObj.message).toBe('string');
      expect(typeof errorObj.validRange).toBe('string');
    });
  });
});
