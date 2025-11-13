import CDP from 'chrome-remote-interface';
import sharp from 'sharp';

/**
 * ScreenshotService - Screenshot capture and resizing
 *
 * Responsible for taking screenshots with automatic resizing to fit API limits.
 * Depends on CDP client for Page domain operations and sharp for image processing.
 */
export class ScreenshotService {
  private static readonly DEFAULT_MAX_SCREENSHOT_DIMENSION = 2000;

  constructor(private client: CDP.Client) {}

  /**
   * Take a screenshot with automatic resizing to fit API limits
   * @param maxDimension Maximum width or height (default: 2000px for Claude API compatibility)
   * @returns Object containing base64 screenshot and metadata about dimensions/resize
   */
  async screenshot(maxDimension: number = ScreenshotService.DEFAULT_MAX_SCREENSHOT_DIMENSION): Promise<{
    screenshot: string;
    metadata: {
      originalDimensions: { width: number; height: number };
      finalDimensions: { width: number; height: number };
      wasResized: boolean;
      format: string;
    };
  }> {
    try {
      // Get viewport size
      const viewport = await this.client.Runtime.evaluate({
        expression:
          'JSON.stringify({width: window.innerWidth, height: window.innerHeight})',
        returnByValue: true,
      });
      const { width: originalWidth, height: originalHeight } = JSON.parse(
        viewport.result.value
      );

      // Take screenshot
      const screenshot = await this.client.Page.captureScreenshot({
        format: 'png',
      });

      const needsResize =
        originalWidth > maxDimension || originalHeight > maxDimension;

      if (needsResize) {
        const { width: targetWidth, height: targetHeight } =
          this.calculateOptimalDimensions(
            originalWidth,
            originalHeight,
            maxDimension
          );

        // Resize with sharp
        const buffer = Buffer.from(screenshot.data, 'base64');
        const resized = await sharp(buffer)
          .resize(targetWidth, targetHeight, { fit: 'inside' })
          .png()
          .toBuffer();

        return {
          screenshot: resized.toString('base64'),
          metadata: {
            originalDimensions: { width: originalWidth, height: originalHeight },
            finalDimensions: { width: targetWidth, height: targetHeight },
            wasResized: true,
            format: 'png',
          },
        };
      }

      return {
        screenshot: screenshot.data,
        metadata: {
          originalDimensions: { width: originalWidth, height: originalHeight },
          finalDimensions: { width: originalWidth, height: originalHeight },
          wasResized: false,
          format: 'png',
        },
      };
    } catch (error) {
      throw new Error(`Failed to take screenshot: ${error}`);
    }
  }

  /**
   * Calculate optimal dimensions to fit within API limits
   * Maintains aspect ratio while ensuring max dimension doesn't exceed limit
   */
  private calculateOptimalDimensions(
    width: number,
    height: number,
    maxDimension: number
  ): { width: number; height: number } {
    if (width <= maxDimension && height <= maxDimension) {
      return { width, height };
    }

    const ratio = width / height;
    if (width > height) {
      return {
        width: maxDimension,
        height: Math.round(maxDimension / ratio),
      };
    } else {
      return {
        width: Math.round(maxDimension * ratio),
        height: maxDimension,
      };
    }
  }
}
