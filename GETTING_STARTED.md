# Getting Started with Chrome MCP Server

Congratulations! Your Chrome MCP server has been successfully created. 🎉

## What You Got

This project is a fully functional **Model Context Protocol (MCP) server** that allows Claude Desktop to control your Google Chrome browser on macOS.

### Project Structure

```
chrome-mcp/
├── src/
│   ├── index.ts              # Main MCP server implementation
│   └── chrome-controller.ts  # Chrome automation controller
├── build/                     # Compiled JavaScript output
├── package.json              # Project dependencies and scripts
├── tsconfig.json             # TypeScript configuration
├── README.md                 # Full documentation
├── CLAUDE_DESKTOP_SETUP.md   # Step-by-step setup guide
└── .gitignore               # Git ignore rules
```

## Quick Start (3 Steps)

### Step 1: Verify Build (Already Done!)

The project has been built successfully. If you need to rebuild:

```bash
cd /Users/Apple/Documents/GitHub/chrome-mcp
pnpm run build
```

### Step 2: Configure Claude Desktop

Edit your Claude Desktop config:

```bash
open ~/Library/Application\ Support/Claude/claude_desktop_config.json
```

Add this configuration:

```json
{
  "mcpServers": {
    "chrome": {
      "command": "node",
      "args": ["/Users/Apple/Documents/GitHub/chrome-mcp/build/index.js"]
    }
  }
}
```

### Step 3: Enable Chrome Developer Mode

Open Chrome and enable: **View** → **Developer** → **Allow JavaScript from Apple Events**

Then restart Claude Desktop!

## What Can Claude Do Now?

Once connected, Claude can:

✅ **Navigate the web**
- "Open google.com in Chrome"
- "Go to github.com"

✅ **Interact with pages**
- "Click the search button"
- "Type 'hello world' in the search box"
- "Execute JavaScript to change the page background"

✅ **Inspect pages**
- "What's the title of this page?"
- "Get all the visible text from this webpage"
- "Take a screenshot"

✅ **Manage tabs**
- "Open a new tab"
- "List all my open Chrome tabs"
- "Close the current tab"

✅ **Navigate history**
- "Go back"
- "Go forward"
- "Reload the page"

## Available Tools (15 Total)

| Tool | Purpose |
|------|---------|
| `chrome_navigate` | Go to a URL |
| `chrome_get_current_url` | Get current page URL |
| `chrome_get_title` | Get page title |
| `chrome_get_content` | Get HTML content |
| `chrome_get_visible_text` | Get visible text |
| `chrome_execute_script` | Run JavaScript |
| `chrome_click` | Click an element |
| `chrome_type` | Type into an input |
| `chrome_screenshot` | Take screenshot |
| `chrome_open_new_tab` | Open new tab |
| `chrome_close_tab` | Close tab |
| `chrome_list_tabs` | List all tabs |
| `chrome_reload` | Reload page |
| `chrome_go_back` | Navigate back |
| `chrome_go_forward` | Navigate forward |

## Technical Details

### Technologies Used

- **TypeScript** - Type-safe JavaScript
- **@modelcontextprotocol/sdk** - MCP protocol implementation
- **chrome-launcher** - Launch and manage Chrome
- **chrome-remote-interface** - Chrome DevTools Protocol client
- **Node.js 18+** - Runtime environment

### How It Works

1. **MCP Server** (`src/index.ts`) runs as a stdio server
2. **Claude Desktop** communicates with it via MCP protocol
3. **ChromeController** (`src/chrome-controller.ts`) uses:
   - Chrome DevTools Protocol (CDP) for browser automation
   - AppleScript for Mac-specific features (tab management)

### Architecture

```
┌─────────────────┐
│ Claude Desktop  │
└────────┬────────┘
         │ MCP Protocol (stdio)
         │
┌────────▼────────┐
│  MCP Server     │ (Your server)
│  src/index.ts   │
└────────┬────────┘
         │
┌────────▼────────────┐
│ Chrome Controller   │
│ src/chrome-         │
│   controller.ts     │
└────────┬────────────┘
         │
    ┌────┴────┬────────────┐
    │         │            │
┌───▼──┐  ┌──▼──────┐ ┌──▼─────┐
│ CDP  │  │AppleScr.│ │Chrome  │
└──────┘  └─────────┘ └────────┘
```

## Development Commands

```bash
# Install dependencies
pnpm install

# Build the project
pnpm run build

# Watch mode (auto-rebuild on changes)
pnpm run watch

# Start the server standalone
pnpm start
```

## Next Steps

1. ✅ **Project created and built**
2. 📝 **Read CLAUDE_DESKTOP_SETUP.md** for detailed setup
3. 🔧 **Configure Claude Desktop** with the MCP server
4. 🚀 **Start using Chrome automation** with Claude!

## Documentation

- **README.md** - Full project documentation
- **CLAUDE_DESKTOP_SETUP.md** - Detailed setup instructions
- **This file** - Quick start guide

## Need Help?

### Common Issues

**Issue**: Chrome won't connect
**Solution**: Enable "Allow JavaScript from Apple Events" in Chrome

**Issue**: Permission denied
**Solution**: Grant accessibility permissions to your terminal

**Issue**: MCP server not showing in Claude
**Solution**: Check the path in `claude_desktop_config.json` is absolute

### Check Logs

```bash
# Claude Desktop logs
tail -f ~/Library/Logs/Claude/mcp*.log

# Check if Chrome remote debugging is active
lsof -i :9222
```

## Security Note

⚠️ This server has full control over your Chrome browser. Only use it with trusted AI assistants like Claude Desktop. Be careful when executing JavaScript or interacting with sensitive pages.

## Contributing

Feel free to extend this project:

- Add more Chrome DevTools Protocol features
- Implement additional automation capabilities
- Improve error handling
- Add tests

## License

MIT - Feel free to use and modify!

---

**Ready to go?** Read `CLAUDE_DESKTOP_SETUP.md` for the full setup process! 🚀

