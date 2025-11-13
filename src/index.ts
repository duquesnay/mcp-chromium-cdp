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
    description: 'Take a screenshot of the current page (returns base64 encoded PNG)',
    inputSchema: {
      type: 'object',
      properties: {},
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
        const screenshot = await chromeController.screenshot();
        return {
          content: [
            {
              type: 'image',
              data: screenshot,
              mimeType: 'image/png',
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
