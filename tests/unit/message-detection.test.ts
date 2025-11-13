import { describe, it, expect, beforeEach, vi } from 'vitest';
import { MessageDetectionService } from '../../src/services/message-detection-service.js';
import { MockCDPClient } from '../fixtures/mock-cdp-client.js';

describe('MessageDetectionService', () => {
  let service: MessageDetectionService;
  let mockClient: MockCDPClient;

  beforeEach(() => {
    mockClient = new MockCDPClient();
    service = new MessageDetectionService(mockClient as any);
  });

  describe('extractMessages()', () => {
    it('should extract toast notifications', async () => {
      const mockMessages = [
        {
          type: 'toast',
          text: 'Successfully saved',
          severity: 'success',
          selector: '.MuiSnackbar-root'
        }
      ];

      // First call returns main messages, second call returns empty console errors
      mockClient.Runtime.evaluate
        .mockResolvedValueOnce({
          result: { value: mockMessages }
        })
        .mockResolvedValueOnce({
          result: { value: [] }
        });

      const messages = await service.extractMessages();

      expect(messages).toHaveLength(1);
      expect(messages[0].type).toBe('toast');
      expect(messages[0].severity).toBe('success');
      expect(messages[0].text).toBe('Successfully saved');
    });

    it('should extract banner messages', async () => {
      const mockMessages = [
        {
          type: 'banner',
          text: 'Site maintenance scheduled',
          severity: 'info',
          selector: '.banner'
        }
      ];

      mockClient.Runtime.evaluate.mockResolvedValue({
        result: { value: mockMessages }
      });

      const messages = await service.extractMessages();

      expect(messages[0].type).toBe('banner');
      expect(messages[0].text).toBe('Site maintenance scheduled');
    });

    it('should extract field validation errors', async () => {
      const mockMessages = [
        {
          type: 'field-error',
          text: 'Email is required',
          severity: 'error',
          selector: '.error-message'
        }
      ];

      mockClient.Runtime.evaluate.mockResolvedValue({
        result: { value: mockMessages }
      });

      const messages = await service.extractMessages();

      expect(messages[0].type).toBe('field-error');
      expect(messages[0].severity).toBe('error');
    });

    it('should extract modal messages', async () => {
      const mockMessages = [
        {
          type: 'modal',
          text: 'Confirm deletion: Are you sure?',
          severity: 'warning',
          selector: '.modal.show'
        }
      ];

      mockClient.Runtime.evaluate.mockResolvedValue({
        result: { value: mockMessages }
      });

      const messages = await service.extractMessages();

      expect(messages[0].type).toBe('modal');
      expect(messages[0].text).toContain('Confirm deletion');
    });

    it('should extract multiple messages of different types', async () => {
      const mockMessages = [
        {
          type: 'toast',
          text: 'Saved',
          severity: 'success',
          selector: '.toast'
        },
        {
          type: 'field-error',
          text: 'Invalid email',
          severity: 'error',
          selector: '.error'
        }
      ];

      // First call returns main messages, second call returns empty console errors
      mockClient.Runtime.evaluate
        .mockResolvedValueOnce({
          result: { value: mockMessages }
        })
        .mockResolvedValueOnce({
          result: { value: [] }
        });

      const messages = await service.extractMessages();

      expect(messages).toHaveLength(2);
      expect(messages[0].type).toBe('toast');
      expect(messages[1].type).toBe('field-error');
    });

    it('should return empty array when no messages found', async () => {
      mockClient.Runtime.evaluate.mockResolvedValue({
        result: { value: [] }
      });

      const messages = await service.extractMessages();

      expect(messages).toEqual([]);
    });

    it('should handle script evaluation errors', async () => {
      mockClient.Runtime.evaluate.mockResolvedValue({
        exceptionDetails: {
          text: 'Script error'
        }
      });

      await expect(service.extractMessages()).rejects.toThrow(
        'Failed to extract messages'
      );
    });

    it('should include console errors in results', async () => {
      mockClient.Runtime.evaluate
        .mockResolvedValueOnce({
          result: {
            value: [
              {
                type: 'toast',
                text: 'Success',
                severity: 'success',
                selector: '.toast'
              }
            ]
          }
        })
        .mockResolvedValueOnce({
          result: { value: [] }
        });

      const messages = await service.extractMessages();

      expect(messages).toHaveLength(1);
    });
  });

  describe('waitForMessage()', () => {
    it('should return message when text matches', async () => {
      const mockMessages = [
        {
          type: 'toast' as const,
          text: 'Successfully saved',
          severity: 'success' as const,
          selector: '.toast'
        }
      ];

      mockClient.Runtime.evaluate.mockResolvedValue({
        result: { value: mockMessages }
      });

      const message = await service.waitForMessage({
        text: 'saved',
        timeout: 1000
      });

      expect(message).not.toBeNull();
      expect(message?.text).toBe('Successfully saved');
    });

    it('should filter by message type', async () => {
      const mockMessages = [
        {
          type: 'toast' as const,
          text: 'Toast message',
          severity: 'info' as const,
          selector: '.toast'
        },
        {
          type: 'banner' as const,
          text: 'Banner message',
          severity: 'info' as const,
          selector: '.banner'
        }
      ];

      mockClient.Runtime.evaluate.mockResolvedValue({
        result: { value: mockMessages }
      });

      const message = await service.waitForMessage({
        type: 'banner',
        timeout: 1000
      });

      expect(message).not.toBeNull();
      expect(message?.type).toBe('banner');
    });

    it('should filter by severity', async () => {
      const mockMessages = [
        {
          type: 'toast' as const,
          text: 'Info message',
          severity: 'info' as const,
          selector: '.toast'
        },
        {
          type: 'toast' as const,
          text: 'Error message',
          severity: 'error' as const,
          selector: '.toast'
        }
      ];

      mockClient.Runtime.evaluate.mockResolvedValue({
        result: { value: mockMessages }
      });

      const message = await service.waitForMessage({
        severity: 'error',
        timeout: 1000
      });

      expect(message).not.toBeNull();
      expect(message?.severity).toBe('error');
    });

    it('should return null on timeout', async () => {
      mockClient.Runtime.evaluate.mockResolvedValue({
        result: { value: [] }
      });

      const message = await service.waitForMessage({
        text: 'nonexistent',
        timeout: 100
      });

      expect(message).toBeNull();
    });

    it('should use case-insensitive text matching', async () => {
      const mockMessages = [
        {
          type: 'toast' as const,
          text: 'Successfully Saved',
          severity: 'success' as const,
          selector: '.toast'
        }
      ];

      mockClient.Runtime.evaluate.mockResolvedValue({
        result: { value: mockMessages }
      });

      const message = await service.waitForMessage({
        text: 'successfully',
        timeout: 1000
      });

      expect(message).not.toBeNull();
    });

    it('should combine multiple filters', async () => {
      const mockMessages = [
        {
          type: 'toast' as const,
          text: 'Error: Invalid input',
          severity: 'error' as const,
          selector: '.toast'
        }
      ];

      mockClient.Runtime.evaluate.mockResolvedValue({
        result: { value: mockMessages }
      });

      const message = await service.waitForMessage({
        text: 'invalid',
        type: 'toast',
        severity: 'error',
        timeout: 1000
      });

      expect(message).not.toBeNull();
      expect(message?.text).toContain('Invalid');
    });
  });
});
