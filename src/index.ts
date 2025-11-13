#!/usr/bin/env node
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';
import { ChromeController } from './chrome-controller.js';

// Create Chrome controller instance
const chromeController = new ChromeController();

// Define available tools
const TOOLS = [
  {
    name: 'chrome_navigate',
    description: 'Navigate to a specific URL in Chrome',
    inputSchema: {
      type: 'object',
      properties: {
        url: {
          type: 'string',
          description: 'The URL to navigate to',
        },
      },
      required: ['url'],
    },
  },
  {
    name: 'chrome_get_current_url',
    description: 'Get the current URL of the active tab',
    inputSchema: {
      type: 'object',
      properties: {},
    },
  },
  {
    name: 'chrome_get_title',
    description: 'Get the title of the current page',
    inputSchema: {
      type: 'object',
      properties: {},
    },
  },
  {
    name: 'chrome_get_content',
    description: 'Get the HTML content of the current page',
    inputSchema: {
      type: 'object',
      properties: {},
    },
  },
  {
    name: 'chrome_get_visible_text',
    description: 'Get the visible text content of the current page',
    inputSchema: {
      type: 'object',
      properties: {},
    },
  },
  {
    name: 'chrome_execute_script',
    description: 'Execute JavaScript in the current page and return the result',
    inputSchema: {
      type: 'object',
      properties: {
        script: {
          type: 'string',
          description: 'JavaScript code to execute',
        },
      },
      required: ['script'],
    },
  },
  {
    name: 'chrome_click',
    description: 'Click on an element using a CSS selector',
    inputSchema: {
      type: 'object',
      properties: {
        selector: {
          type: 'string',
          description: 'CSS selector for the element to click',
        },
      },
      required: ['selector'],
    },
  },
  {
    name: 'chrome_type',
    description: 'Type text into an input field using a CSS selector',
    inputSchema: {
      type: 'object',
      properties: {
        selector: {
          type: 'string',
          description: 'CSS selector for the input element',
        },
        text: {
          type: 'string',
          description: 'Text to type into the input field',
        },
      },
      required: ['selector', 'text'],
    },
  },
  {
    name: 'chrome_screenshot',
    description: 'Take a screenshot of the current page with automatic resizing to fit API limits (returns base64 encoded PNG with metadata)',
    inputSchema: {
      type: 'object',
      properties: {
        maxDimension: {
          type: 'number',
          description: 'Maximum width or height in pixels (default: 2000px for Claude API compatibility)',
        },
      },
    },
  },
  {
    name: 'chrome_open_new_tab',
    description: 'Open a new tab in Chrome, optionally with a URL',
    inputSchema: {
      type: 'object',
      properties: {
        url: {
          type: 'string',
          description: 'Optional URL to open in the new tab',
        },
      },
    },
  },
  {
    name: 'chrome_close_tab',
    description: 'Close the current tab',
    inputSchema: {
      type: 'object',
      properties: {},
    },
  },
  {
    name: 'chrome_list_tabs',
    description: 'List all open tabs with their titles and URLs',
    inputSchema: {
      type: 'object',
      properties: {},
    },
  },
  {
    name: 'chrome_reload',
    description: 'Reload the current page',
    inputSchema: {
      type: 'object',
      properties: {},
    },
  },
  {
    name: 'chrome_go_back',
    description: 'Go back in browser history',
    inputSchema: {
      type: 'object',
      properties: {},
    },
  },
  {
    name: 'chrome_go_forward',
    description: 'Go forward in browser history',
    inputSchema: {
      type: 'object',
      properties: {},
    },
  },
  {
    name: 'chrome_check_page',
    description: 'Quick page state check without screenshot (fast health-check for autonomous agents). Returns URL, title, load state, visible errors, form count, and interactive elements count. Response time < 500ms.',
    inputSchema: {
      type: 'object',
      properties: {},
    },
  },
  {
    name: 'chrome_extract_forms',
    description: 'Extract structured form data without custom scripting. Returns fields (name, type, value, placeholder, required, label, validation rules), submit buttons, and fieldsets. Works with standard forms, React forms, and Shadow DOM forms. Identifies filled vs empty fields.',
    inputSchema: {
      type: 'object',
      properties: {
        formSelector: {
          type: 'string',
          description: 'Optional CSS selector to target a specific form (e.g., "#login-form"). If not provided, extracts all forms on the page.',
        },
      },
    },
  },
  {
    name: 'chrome_wait_for',
    description: 'Wait for UI state changes after actions. Returns success status, which conditions were met, actual state, and time elapsed. On timeout, returns current state (not error) so agent can decide next action. Can chain multiple conditions.',
    inputSchema: {
      type: 'object',
      properties: {
        element: {
          type: 'string',
          description: 'CSS selector for element to wait for (waits until element appears and is visible)',
        },
        text: {
          type: 'string',
          description: 'Text content to wait for (waits until text is visible on page)',
        },
        url: {
          type: 'string',
          description: 'URL pattern to wait for (regex pattern, waits until URL matches)',
        },
        networkIdle: {
          type: 'number',
          description: 'Wait for network idle (milliseconds of no network activity)',
        },
        timeout: {
          type: 'number',
          description: 'Maximum time to wait in milliseconds (default: 5000ms, max: 30000ms)',
        },
      },
    },
  },
];

// Create MCP server
const server = new Server(
  {
    name: 'chrome-mcp',
    version: '1.0.0',
  },
  {
    capabilities: {
      tools: {},
    },
  }
);

// Handle tool listing
server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: TOOLS,
  };
});

// Handle tool execution
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  try {
    switch (name) {
      case 'chrome_navigate': {
        const url = args?.url as string | undefined;
        if (!url) {
          throw new Error('URL is required');
        }
        const result = await chromeController.navigate(url);
        return {
          content: [{ type: 'text', text: result }],
        };
      }

      case 'chrome_get_current_url': {
        const url = await chromeController.getUrl();
        return {
          content: [{ type: 'text', text: url }],
        };
      }

      case 'chrome_get_title': {
        const title = await chromeController.getTitle();
        return {
          content: [{ type: 'text', text: title }],
        };
      }

      case 'chrome_get_content': {
        const content = await chromeController.getContent();
        return {
          content: [{ type: 'text', text: content }],
        };
      }

      case 'chrome_get_visible_text': {
        const text = await chromeController.getVisibleText();
        return {
          content: [{ type: 'text', text: text }],
        };
      }

      case 'chrome_execute_script': {
        const script = args?.script as string | undefined;
        if (!script) {
          throw new Error('Script is required');
        }
        const result = await chromeController.executeScript(script);
        return {
          content: [{ type: 'text', text: JSON.stringify(result, null, 2) }],
        };
      }

      case 'chrome_click': {
        const selector = args?.selector as string | undefined;
        if (!selector) {
          throw new Error('Selector is required');
        }
        const result = await chromeController.click(selector);
        return {
          content: [{ type: 'text', text: result }],
        };
      }

      case 'chrome_type': {
        const selector = args?.selector as string | undefined;
        const text = args?.text as string | undefined;
        if (!selector || !text) {
          throw new Error('Selector and text are required');
        }
        const result = await chromeController.type(selector, text);
        return {
          content: [{ type: 'text', text: result }],
        };
      }

      case 'chrome_screenshot': {
        const maxDimension = (args?.maxDimension as number | undefined) || 2000;
        const result = await chromeController.screenshot(maxDimension);
        return {
          content: [
            {
              type: 'image',
              data: result.screenshot,
              mimeType: 'image/png',
            },
            {
              type: 'text',
              text: `Screenshot metadata:\n${JSON.stringify(result.metadata, null, 2)}`,
            },
          ],
        };
      }

      case 'chrome_open_new_tab': {
        const url = args?.url as string | undefined;
        const result = await chromeController.openNewTab(url);
        return {
          content: [{ type: 'text', text: result }],
        };
      }

      case 'chrome_close_tab': {
        const result = await chromeController.closeTab();
        return {
          content: [{ type: 'text', text: result }],
        };
      }

      case 'chrome_list_tabs': {
        const tabs = await chromeController.listTabs();
        return {
          content: [{ type: 'text', text: JSON.stringify(tabs, null, 2) }],
        };
      }

      case 'chrome_reload': {
        const result = await chromeController.reload();
        return {
          content: [{ type: 'text', text: result }],
        };
      }

      case 'chrome_go_back': {
        const result = await chromeController.goBack();
        return {
          content: [{ type: 'text', text: result }],
        };
      }

      case 'chrome_go_forward': {
        const result = await chromeController.goForward();
        return {
          content: [{ type: 'text', text: result }],
        };
      }

      case 'chrome_check_page': {
        const result = await chromeController.checkPage();
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(result, null, 2),
            },
          ],
        };
      }

      case 'chrome_extract_forms': {
        const formSelector = args?.formSelector as string | undefined;
        const result = await chromeController.extractForms(formSelector);
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(result, null, 2),
            },
          ],
        };
      }

      case 'chrome_wait_for': {
        const options = {
          element: args?.element as string | undefined,
          text: args?.text as string | undefined,
          url: args?.url as string | undefined,
          networkIdle: args?.networkIdle as number | undefined,
          timeout: args?.timeout as number | undefined,
        };
        const result = await chromeController.waitFor(options);
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(result, null, 2),
            },
          ],
        };
      }

      default:
        throw new Error(`Unknown tool: ${name}`);
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    return {
      content: [{ type: 'text', text: `Error: ${errorMessage}` }],
      isError: true,
    };
  }
});

// Start the server
async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error('Chrome MCP Server running on stdio');
  console.error('Available tools:', TOOLS.map(t => t.name).join(', '));
}

main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
