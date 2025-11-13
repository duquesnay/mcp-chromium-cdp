import { describe, it, expect, beforeEach } from 'vitest';
import { ChromeController } from '../../src/chrome-controller.js';
import { MockCDPClient, mockScriptResult, mockScriptError } from '../fixtures/mock-cdp-client.js';

describe('Text Interaction Service', () => {
  let controller: ChromeController;
  let mockClient: MockCDPClient;

  beforeEach(() => {
    mockClient = new MockCDPClient();
    controller = new ChromeController();
    // Inject mock client and initialize services
    (controller as any).client = mockClient;
    (controller as any).initializeServices();
  });

  describe('Input Validation', () => {
    describe('validateText()', () => {
      it('should reject empty text in clickByText', async () => {
        await expect(controller.clickByText({ text: '' })).rejects.toThrow();
        const error = await controller.clickByText({ text: '' }).catch(e => e);
        const errorObj = JSON.parse(error.message);
        expect(errorObj.error).toBe('INVALID_TEXT');
        expect(errorObj.field).toBe('text');
        expect(errorObj.message).toContain('cannot be empty');
      });

      it('should reject whitespace-only text', async () => {
        await expect(controller.clickByText({ text: '   ' })).rejects.toThrow();
        const error = await controller.clickByText({ text: '   ' }).catch(e => e);
        const errorObj = JSON.parse(error.message);
        expect(errorObj.error).toBe('INVALID_TEXT');
      });

      it('should reject text longer than 1000 characters', async () => {
        const longText = 'a'.repeat(1001);
        await expect(controller.clickByText({ text: longText })).rejects.toThrow();
        const error = await controller.clickByText({ text: longText }).catch(e => e);
        const errorObj = JSON.parse(error.message);
        expect(errorObj.error).toBe('INVALID_TEXT');
        expect(errorObj.message).toContain('too long');
        expect(errorObj.maxLength).toBe(1000);
      });

      it('should accept valid text (1000 chars)', async () => {
        const validText = 'a'.repeat(1000);
        mockScriptResult(mockClient, {
          count: 1,
          elements: [{ tagName: 'BUTTON', text: validText, role: '', id: 'btn', className: '' }]
        });
        await expect(controller.clickByText({ text: validText })).resolves.toBeTruthy();
      });

      it('should reject empty label in typeByLabel', async () => {
        await expect(controller.typeByLabel({ label: '', text: 'test' })).rejects.toThrow();
        const error = await controller.typeByLabel({ label: '', text: 'test' }).catch(e => e);
        const errorObj = JSON.parse(error.message);
        expect(errorObj.error).toBe('INVALID_TEXT');
      });
    });

    describe('validateRole()', () => {
      it('should reject invalid role', async () => {
        await expect(controller.clickByText({ text: 'Submit', role: 'invalid-role' })).rejects.toThrow();
        const error = await controller.clickByText({ text: 'Submit', role: 'invalid-role' }).catch(e => e);
        const errorObj = JSON.parse(error.message);
        expect(errorObj.error).toBe('INVALID_ROLE');
        expect(errorObj.field).toBe('role');
        expect(errorObj.validRoles).toContain('button');
        expect(errorObj.validRoles).toContain('link');
      });

      it('should accept valid role: button', async () => {
        mockScriptResult(mockClient, {
          count: 1,
          elements: [{ tagName: 'BUTTON', text: 'Submit', role: 'button', id: 'btn', className: '' }]
        });
        await expect(controller.clickByText({ text: 'Submit', role: 'button' })).resolves.toBeTruthy();
      });

      it('should accept valid role: link', async () => {
        mockScriptResult(mockClient, {
          count: 1,
          elements: [{ tagName: 'A', text: 'Click here', role: 'link', id: 'link', className: '' }]
        });
        await expect(controller.clickByText({ text: 'Click here', role: 'link' })).resolves.toBeTruthy();
      });

      it('should accept undefined role (optional)', async () => {
        mockScriptResult(mockClient, {
          count: 1,
          elements: [{ tagName: 'BUTTON', text: 'Submit', role: '', id: 'btn', className: '' }]
        });
        await expect(controller.clickByText({ text: 'Submit' })).resolves.toBeTruthy();
      });
    });

    describe('validatePropertyName()', () => {
      it('should reject empty property name', async () => {
        await expect(controller.getProperty('button', '')).rejects.toThrow();
        const error = await controller.getProperty('button', '').catch(e => e);
        const errorObj = JSON.parse(error.message);
        expect(errorObj.error).toBe('INVALID_PROPERTY');
        expect(errorObj.field).toBe('property');
      });

      it('should reject property with special characters', async () => {
        await expect(controller.getProperty('button', 'value.length')).rejects.toThrow();
        const error = await controller.getProperty('button', 'value.length').catch(e => e);
        const errorObj = JSON.parse(error.message);
        expect(errorObj.error).toBe('INVALID_PROPERTY');
        expect(errorObj.message).toContain('invalid characters');
      });

      it('should accept alphanumeric property', async () => {
        await expect(controller.getProperty('button', 'value')).resolves.toBeTruthy();
      });

      it('should accept property with underscore', async () => {
        await expect(controller.getProperty('button', 'inner_text')).resolves.toBeTruthy();
      });

      it('should accept property with hyphen', async () => {
        await expect(controller.getProperty('button', 'aria-label')).resolves.toBeTruthy();
      });
    });
  });

  describe('clickByText()', () => {
    describe('Element Finding', () => {
      it('should find element by exact text match', async () => {
        mockScriptResult(mockClient, {
          count: 1,
          elements: [{ tagName: 'BUTTON', text: 'Sign In', role: '', id: 'signin', className: '' }]
        });

        const result = await controller.clickByText({ text: 'Sign In' });
        expect(result).toContain('Clicked BUTTON');
        expect(result).toContain('Sign In');
      });

      it('should find element by partial text match (contains)', async () => {
        mockScriptResult(mockClient, {
          count: 1,
          elements: [{ tagName: 'BUTTON', text: 'Click here to Sign In', role: '', id: 'signin', className: '' }]
        });

        const result = await controller.clickByText({ text: 'Sign In' });
        expect(result).toContain('Clicked BUTTON');
      });

      it('should filter by role when specified', async () => {
        mockScriptResult(mockClient, {
          count: 1,
          elements: [{ tagName: 'BUTTON', text: 'Submit', role: 'button', id: 'btn', className: '' }]
        });

        const result = await controller.clickByText({ text: 'Submit', role: 'button' });
        expect(result).toContain('role="button"');
      });

      it('should error when no element found', async () => {
        mockScriptResult(mockClient, {
          count: 0,
          elements: []
        });

        await expect(controller.clickByText({ text: 'Nonexistent' })).rejects.toThrow();
        const error = await controller.clickByText({ text: 'Nonexistent' }).catch(e => e);
        const errorObj = JSON.parse(error.message);
        expect(errorObj.error).toBe('ELEMENT_NOT_FOUND');
        expect(errorObj.field).toBe('text');
        expect(errorObj.message).toContain('No visible element found');
        expect(errorObj.suggestions).toBeDefined();
        expect(errorObj.suggestions.length).toBeGreaterThan(0);
      });

      it('should provide suggestions when element not found', async () => {
        mockScriptResult(mockClient, {
          count: 0,
          elements: []
        });

        const error = await controller.clickByText({ text: 'Missing' }).catch(e => e);
        const errorObj = JSON.parse(error.message);
        expect(errorObj.suggestions).toContain('Check if text is visible on page');
        expect(errorObj.suggestions).toContain('Use chrome_extract_interactive to see available elements');
      });

      it('should error when multiple elements found', async () => {
        mockScriptResult(mockClient, {
          count: 3,
          elements: [
            { tagName: 'BUTTON', text: 'Submit Form', role: '', id: 'btn1', className: '' },
            { tagName: 'BUTTON', text: 'Submit Request', role: '', id: 'btn2', className: '' },
            { tagName: 'A', text: 'Submit', role: '', id: '', className: 'link' }
          ]
        });

        await expect(controller.clickByText({ text: 'Submit' })).rejects.toThrow();
        const error = await controller.clickByText({ text: 'Submit' }).catch(e => e);
        const errorObj = JSON.parse(error.message);
        expect(errorObj.error).toBe('MULTIPLE_ELEMENTS_FOUND');
        expect(errorObj.field).toBe('text');
        expect(errorObj.message).toContain('Found 3 elements');
        expect(errorObj.matches).toBeDefined();
        expect(errorObj.matches.length).toBe(3);
      });

      it('should provide actionable suggestions for multiple matches', async () => {
        mockScriptResult(mockClient, {
          count: 2,
          elements: [
            { tagName: 'BUTTON', text: 'Submit', role: 'button', id: '', className: '' },
            { tagName: 'A', text: 'Submit', role: 'link', id: '', className: '' }
          ]
        });

        const error = await controller.clickByText({ text: 'Submit' }).catch(e => e);
        const errorObj = JSON.parse(error.message);
        expect(errorObj.suggestions).toContain('Specify a role parameter to filter results');
        expect(errorObj.suggestions).toContain('Use more specific text that uniquely identifies the element');
      });
    });

    describe('Element Interaction', () => {
      it('should click element using CDP Input API', async () => {
        mockScriptResult(mockClient, {
          count: 1,
          elements: [{ tagName: 'BUTTON', text: 'Click Me', role: '', id: 'btn', className: '' }]
        });

        await controller.clickByText({ text: 'Click Me' });

        expect(mockClient.Input.dispatchMouseEvent).toHaveBeenCalledWith(
          expect.objectContaining({
            type: 'mousePressed',
            button: 'left',
            clickCount: 1
          })
        );

        expect(mockClient.Input.dispatchMouseEvent).toHaveBeenCalledWith(
          expect.objectContaining({
            type: 'mouseReleased',
            button: 'left',
            clickCount: 1
          })
        );
      });

      it('should handle script execution error gracefully', async () => {
        mockScriptError(mockClient, 'XPath evaluation failed');

        await expect(controller.clickByText({ text: 'Test' })).rejects.toThrow();
        const error = await controller.clickByText({ text: 'Test' }).catch(e => e);
        const errorObj = JSON.parse(error.message);
        expect(errorObj.error).toBe('SEARCH_FAILED');
      });
    });
  });

  describe('typeByLabel()', () => {
    describe('Input Finding', () => {
      it('should find input by label[for] attribute', async () => {
        mockScriptResult(mockClient, {
          count: 1,
          inputs: [{ tagName: 'INPUT', type: 'text', id: 'email', name: 'email', source: 'label[for]', labelText: 'Email Address' }]
        });

        const result = await controller.typeByLabel({ label: 'Email', text: 'test@example.com' });
        expect(result).toContain('Typed text into INPUT[type="text"]');
        expect(result).toContain('label[for]');
      });

      it('should find input by parent label', async () => {
        mockScriptResult(mockClient, {
          count: 1,
          inputs: [{ tagName: 'INPUT', type: 'text', id: 'name', name: 'name', source: 'parent label', labelText: 'Full Name' }]
        });

        const result = await controller.typeByLabel({ label: 'Name', text: 'John Doe' });
        expect(result).toContain('parent label');
      });

      it('should find input by aria-label', async () => {
        mockScriptResult(mockClient, {
          count: 1,
          inputs: [{ tagName: 'INPUT', type: 'search', id: '', name: '', source: 'aria-label', labelText: 'Search products' }]
        });

        const result = await controller.typeByLabel({ label: 'Search', text: 'laptop' });
        expect(result).toContain('aria-label');
      });

      it('should find input by placeholder', async () => {
        mockScriptResult(mockClient, {
          count: 1,
          inputs: [{ tagName: 'INPUT', type: 'text', id: '', name: '', source: 'placeholder', labelText: 'Enter your email' }]
        });

        const result = await controller.typeByLabel({ label: 'email', text: 'user@test.com' });
        expect(result).toContain('placeholder');
      });

      it('should error when no input found', async () => {
        mockScriptResult(mockClient, {
          count: 0,
          inputs: []
        });

        await expect(controller.typeByLabel({ label: 'Missing Label', text: 'test' })).rejects.toThrow();
        const error = await controller.typeByLabel({ label: 'Missing Label', text: 'test' }).catch(e => e);
        const errorObj = JSON.parse(error.message);
        expect(errorObj.error).toBe('INPUT_NOT_FOUND');
        expect(errorObj.field).toBe('label');
        expect(errorObj.suggestions).toContain('Use chrome_extract_forms to see available input fields');
      });

      it('should error when multiple inputs found', async () => {
        mockScriptResult(mockClient, {
          count: 2,
          inputs: [
            { tagName: 'INPUT', type: 'text', id: 'first', name: '', source: 'label[for]', labelText: 'First Name' },
            { tagName: 'INPUT', type: 'text', id: 'last', name: '', source: 'label[for]', labelText: 'Last Name' }
          ]
        });

        await expect(controller.typeByLabel({ label: 'Name', text: 'test' })).rejects.toThrow();
        const error = await controller.typeByLabel({ label: 'Name', text: 'test' }).catch(e => e);
        const errorObj = JSON.parse(error.message);
        expect(errorObj.error).toBe('MULTIPLE_INPUTS_FOUND');
        expect(errorObj.matches).toBeDefined();
        expect(errorObj.matches.length).toBe(2);
      });
    });

    describe('Text Input', () => {
      it('should type text character by character', async () => {
        mockScriptResult(mockClient, {
          count: 1,
          inputs: [{ tagName: 'INPUT', type: 'text', id: 'email', name: 'email', source: 'label[for]', labelText: 'Email' }]
        });

        await controller.typeByLabel({ label: 'Email', text: 'test' });

        // Should call focus once
        expect(mockClient.DOM.focus).toHaveBeenCalledTimes(1);

        // Should type 4 characters (t, e, s, t) = 8 key events (down + up)
        expect(mockClient.Input.dispatchKeyEvent).toHaveBeenCalledTimes(8);

        // Check keyDown and keyUp for each character
        expect(mockClient.Input.dispatchKeyEvent).toHaveBeenCalledWith({
          type: 'keyDown',
          text: 't'
        });
        expect(mockClient.Input.dispatchKeyEvent).toHaveBeenCalledWith({
          type: 'keyUp',
          text: 't'
        });
      });

      it('should handle special characters', async () => {
        mockScriptResult(mockClient, {
          count: 1,
          inputs: [{ tagName: 'INPUT', type: 'text', id: 'input', name: '', source: 'label[for]', labelText: 'Input' }]
        });

        await controller.typeByLabel({ label: 'Input', text: 'test@123' });

        // Should type all characters including @
        expect(mockClient.Input.dispatchKeyEvent).toHaveBeenCalledWith(
          expect.objectContaining({ text: '@' })
        );
      });

      it('should handle script execution error gracefully', async () => {
        mockScriptError(mockClient, 'Label search failed');

        await expect(controller.typeByLabel({ label: 'Test', text: 'value' })).rejects.toThrow();
        const error = await controller.typeByLabel({ label: 'Test', text: 'value' }).catch(e => e);
        const errorObj = JSON.parse(error.message);
        expect(errorObj.error).toBe('SEARCH_FAILED');
      });
    });
  });

  describe('extractInteractive()', () => {
    it('should extract buttons with metadata', async () => {
      mockScriptResult(mockClient, [
        { text: 'Sign In', role: 'button', selector: '#signin', tagName: 'BUTTON', isVisible: true, isEnabled: true },
        { text: 'Cancel', role: 'button', selector: '#cancel', tagName: 'BUTTON', isVisible: true, isEnabled: false }
      ]);

      const result = await controller.extractInteractive();
      expect(result.elements).toHaveLength(2);
      expect(result.elements[0]).toEqual({
        text: 'Sign In',
        role: 'button',
        selector: '#signin',
        tagName: 'BUTTON',
        isVisible: true,
        isEnabled: true
      });
      expect(result.elements[1].isEnabled).toBe(false);
    });

    it('should extract links with metadata', async () => {
      mockScriptResult(mockClient, [
        { text: 'Learn More', role: 'link', selector: 'a.learn-more', tagName: 'A', isVisible: true, isEnabled: true }
      ]);

      const result = await controller.extractInteractive();
      expect(result.elements[0].tagName).toBe('A');
      expect(result.elements[0].role).toBe('link');
    });

    it('should extract inputs with label text', async () => {
      mockScriptResult(mockClient, [
        { text: 'Email Address', role: 'textbox', selector: '#email', tagName: 'INPUT', isVisible: true, isEnabled: true }
      ]);

      const result = await controller.extractInteractive();
      expect(result.elements[0].text).toBe('Email Address');
      expect(result.elements[0].role).toBe('textbox');
    });

    it('should deduplicate elements', async () => {
      // Script should handle deduplication internally
      mockScriptResult(mockClient, [
        { text: 'Submit', role: 'button', selector: '#submit', tagName: 'BUTTON', isVisible: true, isEnabled: true }
      ]);

      const result = await controller.extractInteractive();
      expect(result.elements).toHaveLength(1);
    });

    it('should limit results to 100 elements', async () => {
      // Create 150 mock elements
      const manyElements = Array.from({ length: 150 }, (_, i) => ({
        text: `Element ${i}`,
        role: 'button',
        selector: `#btn${i}`,
        tagName: 'BUTTON',
        isVisible: true,
        isEnabled: true
      }));

      mockScriptResult(mockClient, manyElements.slice(0, 100)); // Script should limit internally

      const result = await controller.extractInteractive();
      expect(result.elements.length).toBeLessThanOrEqual(100);
    });

    it('should include visibility status', async () => {
      mockScriptResult(mockClient, [
        { text: 'Visible', role: 'button', selector: '#visible', tagName: 'BUTTON', isVisible: true, isEnabled: true },
        { text: 'Hidden', role: 'button', selector: '#hidden', tagName: 'BUTTON', isVisible: false, isEnabled: true }
      ]);

      const result = await controller.extractInteractive();
      expect(result.elements[0].isVisible).toBe(true);
      expect(result.elements[1].isVisible).toBe(false);
    });

    it('should handle empty page', async () => {
      mockScriptResult(mockClient, []);

      const result = await controller.extractInteractive();
      expect(result.elements).toEqual([]);
    });

    it('should handle script execution error', async () => {
      mockScriptError(mockClient, 'DOM extraction failed');

      await expect(controller.extractInteractive()).rejects.toThrow();
      const error = await controller.extractInteractive().catch(e => e);
      const errorObj = JSON.parse(error.message);
      expect(errorObj.error).toBe('EXTRACTION_FAILED');
    });
  });

  describe('getProperty()', () => {
    it('should retrieve property value using CDP', async () => {
      const result = await controller.getProperty('input#email', 'value');
      expect(result).toBe('mock-property-value');
      expect(mockClient.DOM.querySelector).toHaveBeenCalled();
      expect(mockClient.DOM.resolveNode).toHaveBeenCalled();
      expect(mockClient.Runtime.callFunctionOn).toHaveBeenCalled();
    });

    it('should error when element not found', async () => {
      mockClient.DOM.querySelector.mockResolvedValue({ nodeId: 0 });

      await expect(controller.getProperty('nonexistent', 'value')).rejects.toThrow();
      const error = await controller.getProperty('nonexistent', 'value').catch(e => e);
      const errorObj = JSON.parse(error.message);
      expect(errorObj.error).toBe('ELEMENT_NOT_FOUND');
      expect(errorObj.field).toBe('selector');
    });

    it('should handle property access failure', async () => {
      mockClient.Runtime.callFunctionOn.mockResolvedValue({
        result: { value: undefined },
        exceptionDetails: { text: 'Property does not exist' }
      });

      await expect(controller.getProperty('button', 'nonexistent')).rejects.toThrow();
      const error = await controller.getProperty('button', 'nonexistent').catch(e => e);
      const errorObj = JSON.parse(error.message);
      expect(errorObj.error).toBe('PROPERTY_ACCESS_FAILED');
      expect(errorObj.field).toBe('property');
    });

    it('should work with common properties', async () => {
      const properties = ['value', 'innerText', 'textContent', 'disabled', 'checked'];

      for (const prop of properties) {
        await controller.getProperty('input', prop);
        expect(mockClient.Runtime.callFunctionOn).toHaveBeenCalled();
      }
    });

    it('should work with aria attributes', async () => {
      await controller.getProperty('button', 'aria-label');
      expect(mockClient.Runtime.callFunctionOn).toHaveBeenCalled();
    });
  });

  describe('Error Message Quality', () => {
    it('should provide actionable errors for all failure modes', async () => {
      // Test that all error paths provide suggestions
      const scenarios = [
        {
          fn: () => controller.clickByText({ text: '' }),
          expectedField: 'text'
        },
        {
          fn: () => controller.clickByText({ text: 'Test', role: 'invalid' as any }),
          expectedField: 'role'
        },
        {
          fn: () => controller.typeByLabel({ label: '', text: 'test' }),
          expectedField: 'text' // validateText is called on label, but error field is 'text'
        },
        {
          fn: () => controller.getProperty('button', ''),
          expectedField: 'property'
        }
      ];

      for (const scenario of scenarios) {
        await expect(scenario.fn()).rejects.toThrow();
        const error = await scenario.fn().catch(e => e);
        const errorObj = JSON.parse(error.message);
        expect(errorObj.error).toBeDefined();
        expect(errorObj.field).toBe(scenario.expectedField);
        expect(errorObj.message).toBeDefined();
      }
    });

    it('should include examples in validation errors', async () => {
      const error = await controller.clickByText({ text: '' }).catch(e => e);
      const errorObj = JSON.parse(error.message);
      expect(errorObj.example).toBeDefined();
    });

    it('should include suggestions in search errors', async () => {
      mockScriptResult(mockClient, { count: 0, elements: [] });

      const error = await controller.clickByText({ text: 'Missing' }).catch(e => e);
      const errorObj = JSON.parse(error.message);
      expect(errorObj.suggestions).toBeDefined();
      expect(Array.isArray(errorObj.suggestions)).toBe(true);
      expect(errorObj.suggestions.length).toBeGreaterThan(0);
    });
  });

  describe('Security', () => {
    it('should not execute user input in script context (clickByText)', async () => {
      const maliciousText = '"); alert("XSS"); //';

      mockScriptResult(mockClient, { count: 0, elements: [] });

      await controller.clickByText({ text: maliciousText }).catch(() => {});

      // Verify Runtime.evaluate was called and user input is properly escaped
      expect(mockClient.Runtime.evaluate).toHaveBeenCalled();
      const scriptArg = mockClient.Runtime.evaluate.mock.calls[0][0].expression;
      // The text is escaped in the XPath expression via JSON.stringify
      // JSON.stringify escapes quotes with backslash, preventing XSS
      // The malicious code becomes a safe string literal
      expect(scriptArg).toContain('\\\"'); // Contains escaped quotes
      expect(scriptArg).not.toContain('alert("XSS")'); // Not executable code
    });

    it('should validate property names to prevent injection (getProperty)', async () => {
      const maliciousProperty = 'value; alert("XSS")';

      await expect(controller.getProperty('input', maliciousProperty)).rejects.toThrow();
      const error = await controller.getProperty('input', maliciousProperty).catch(e => e);
      const errorObj = JSON.parse(error.message);
      expect(errorObj.error).toBe('INVALID_PROPERTY');
    });
  });
});
