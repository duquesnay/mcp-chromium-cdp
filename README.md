# mcp-chromium-cdp

Model Context Protocol (MCP) server for controlling Chromium/Chrome via Chrome DevTools Protocol. Cross-platform with automatic reconnection support.

## ✨ Key Features

- ✅ **Cross-platform**: Works on macOS, Linux, and Windows
- ✅ **Chromium-first**: Detects and launches Chromium, falls back to Chrome
- ✅ **Auto-reconnection**: Automatically reconnects if browser crashes or restarts (up to 5 retries)
- ✅ **Auto-launch**: Launches browser automatically if not running
- ✅ **Custom profiles**: Support for custom browser profiles via environment variables
- ✅ **Stdio transport**: Native integration with Claude Desktop and Claude Code

## Installation

### Global Installation

```bash
npm install -g mcp-chromium-cdp
```

### Local Installation

```bash
npm install mcp-chromium-cdp
```

### From Source

```bash
git clone https://github.com/duquesnay/mcp-chromium-cdp.git
cd mcp-chromium-cdp
npm install
npm run build
```

## Configuration

### Claude Desktop (macOS)

Add to `~/Library/Application Support/Claude/claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "chromium": {
      "command": "npx",
      "args": ["-y", "mcp-chromium-cdp"]
    }
  }
}
```

### Claude Code

```bash
claude mcp add chromium -- npx -y mcp-chromium-cdp
```

Or with local build:

```bash
claude mcp add chromium -- node /path/to/mcp-chromium-cdp/build/index.js
```

## Environment Variables

### `CHROMIUM_PATH`
Override Chromium binary path:

```bash
CHROMIUM_PATH=/usr/bin/chromium-browser mcp-chromium-cdp
```

### `CHROMIUM_USER_DATA_DIR`
Use custom browser profile:

```bash
CHROMIUM_USER_DATA_DIR=~/.config/chromium-mcp mcp-chromium-cdp
```

## Available Tools

| Tool | Description |
|------|-------------|
| `chrome_navigate` | Navigate to a specific URL |
| `chrome_get_current_url` | Get the current page URL |
| `chrome_get_title` | Get the page title |
| `chrome_get_content` | Get the page HTML content |
| `chrome_get_visible_text` | Get visible text from the page |
| `chrome_execute_script` | Execute JavaScript in the page |
| `chrome_click` | Click an element by CSS selector |
| `chrome_type` | Type text into an input field |
| `chrome_screenshot` | Take a screenshot (base64) |
| `chrome_open_new_tab` | Open a new tab |
| `chrome_close_tab` | Close the current tab |
| `chrome_list_tabs` | List all open tabs |
| `chrome_reload` | Reload the current page |
| `chrome_go_back` | Navigate back in history |
| `chrome_go_forward` | Navigate forward in history |

## Usage Examples

### With Claude

```
Using chromium tools, navigate to https://example.com and get the page title
```

### Programmatic Usage

```typescript
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';

const transport = new StdioClientTransport({
  command: 'npx',
  args: ['-y', 'mcp-chromium-cdp']
});

const client = new Client({
  name: 'my-client',
  version: '1.0.0'
}, {
  capabilities: {}
});

await client.connect(transport);

// Navigate to URL
await client.callTool({
  name: 'chrome_navigate',
  arguments: { url: 'https://example.com' }
});

// Get page title
const result = await client.callTool({
  name: 'chrome_get_title',
  arguments: {}
});

console.log(result.content[0].text);
```

## Auto-Reconnection

If Chromium crashes or is restarted, the server will automatically attempt to reconnect:

- **Max retries**: 5 attempts
- **Retry delay**: 2 seconds between attempts
- **Logs**: Reconnection attempts logged to stderr

Example log output:
```
[Connection] Chromium disconnected
[Reconnect] Attempting to reconnect to Chromium...
[Reconnect] Successfully reconnected to Chromium
```

## Chromium Detection

The server automatically detects Chromium in standard locations:

**macOS:**
- `/Applications/Chromium.app/Contents/MacOS/Chromium`
- `~/Applications/Chromium.app/Contents/MacOS/Chromium`

**Linux:**
- `/usr/bin/chromium`
- `/usr/bin/chromium-browser`
- `/snap/bin/chromium`

**Windows:**
- `%LOCALAPPDATA%\Chromium\Application\chrome.exe`
- `%PROGRAMFILES%\Chromium\Application\chrome.exe`
- `%PROGRAMFILES(X86)%\Chromium\Application\chrome.exe`

If Chromium is not found, the server falls back to Chrome via `chrome-launcher`.

## Development

```bash
# Install dependencies
npm install

# Build
npm run build

# Watch mode
npm run watch
```

## Architecture

This project consists of two main components:

1. **ChromeController** (`src/chrome-controller.ts`):
   - Manages Chrome DevTools Protocol (CDP) connections
   - Implements browser automation methods
   - Handles auto-launch and reconnection logic
   - Cross-platform Chromium detection

2. **MCP Server** (`src/index.ts`):
   - Implements the Model Context Protocol server
   - Exposes Chrome control methods as MCP tools
   - Handles communication via stdio

## Troubleshooting

### Chromium/Chrome Not Found

If the server can't find Chromium:

1. Install Chromium from [chromium.org](https://www.chromium.org/getting-involved/download-chromium/)
2. Or specify path manually:
   ```bash
   CHROMIUM_PATH=/path/to/chromium mcp-chromium-cdp
   ```

### Connection Issues

If the server can't connect:

1. Check if another process is using port 9222:
   ```bash
   lsof -i :9222
   ```

2. The server will auto-launch Chromium if not running
3. Check logs for reconnection attempts

### MCP Server Not Showing in Claude

1. Verify configuration in Claude Desktop/Code
2. Check that `build/index.js` exists
3. Look at Claude logs for errors

## Differences from chrome-mcp

This project is based on the original `chrome-mcp` package by [@moe03](https://github.com/moe03) with the following enhancements:

- ✅ **Chromium-first** detection (instead of Chrome-only)
- ✅ **Automatic reconnection** on disconnection
- ✅ **Cross-platform** Chromium path detection
- ✅ **Environment variable** configuration
- ✅ **TypeScript source** code included
- ✅ **Improved error handling** and logging

## Credits

**Original code** by [@moe03](https://github.com/moe03) (chrome-mcp package).

**Enhanced** with auto-reconnection and cross-platform support by [@duquesnay](https://github.com/duquesnay).

Built using:
- [@modelcontextprotocol/sdk](https://github.com/modelcontextprotocol/sdk) - MCP SDK
- [chrome-launcher](https://github.com/GoogleChrome/chrome-launcher) - Chrome launcher
- [chrome-remote-interface](https://github.com/cyrus-and/chrome-remote-interface) - Chrome DevTools Protocol client

## License

MIT

## Contributing

Contributions welcome! Please open an issue or PR on [GitHub](https://github.com/duquesnay/mcp-chromium-cdp).

## Support

- **Issues**: [GitHub Issues](https://github.com/duquesnay/mcp-chromium-cdp/issues)
- **Discussions**: [GitHub Discussions](https://github.com/duquesnay/mcp-chromium-cdp/discussions)
