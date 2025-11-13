# Claude Desktop Setup Instructions

## Quick Setup

Follow these steps to integrate the Chrome MCP server with Claude Desktop:

### 1. Open Claude Desktop Config

```bash
open ~/Library/Application\ Support/Claude/claude_desktop_config.json
```

Or navigate to: **Claude** → **Settings** → **Developer** → **Edit Config**

### 2. Add MCP Server Configuration

Add this configuration to your `claude_desktop_config.json`:

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

If you already have other MCP servers configured, add the `"chrome"` entry to the existing `"mcpServers"` object:

```json
{
  "mcpServers": {
    "existing-server": {
      "command": "...",
      "args": ["..."]
    },
    "chrome": {
      "command": "node",
      "args": ["/Users/Apple/Documents/GitHub/chrome-mcp/build/index.js"]
    }
  }
}
```

### 3. Enable Chrome Developer Features

#### Option A: Via Menu (Easiest)
1. Open Google Chrome
2. Click **View** → **Developer** → **Allow JavaScript from Apple Events**

#### Option B: Launch Chrome with Remote Debugging
```bash
/Applications/Google\ Chrome.app/Contents/MacOS/Google\ Chrome --remote-debugging-port=9222 &
```

You can add this to your shell profile (`~/.zshrc` or `~/.bash_profile`) to automatically launch Chrome with remote debugging:

```bash
alias chrome-debug='/Applications/Google\ Chrome.app/Contents/MacOS/Google\ Chrome --remote-debugging-port=9222'
```

### 4. Grant Accessibility Permissions

On first run, macOS will prompt for accessibility permissions:

1. Go to **System Preferences** → **Security & Privacy** → **Privacy** → **Accessibility**
2. Click the lock icon to make changes (you'll need to enter your password)
3. Find and enable your terminal application:
   - **Terminal** (if using macOS Terminal)
   - **iTerm2** (if using iTerm)
   - **Visual Studio Code** (if using VS Code terminal)
   - Or any other terminal you use

### 5. Restart Claude Desktop

Completely quit and restart Claude Desktop:

```bash
# Quit Claude
osascript -e 'quit app "Claude"'

# Wait a moment, then reopen
open -a Claude
```

Or use **Cmd+Q** to quit Claude, then reopen it normally.

## Verification

After setup, verify the integration:

1. Open Claude Desktop
2. Look for the 🔨 (hammer) icon in the chat interface - this indicates tools are available
3. Try a command like: "Open google.com in Chrome"
4. Claude should now have access to all Chrome control tools

## Troubleshooting

### MCP Server Not Loading

Check Claude Desktop logs for errors:

```bash
tail -f ~/Library/Logs/Claude/mcp*.log
```

### Chrome Connection Issues

Verify Chrome is accessible:

```bash
# Check if Chrome is running with remote debugging
lsof -i :9222

# If nothing shows, launch Chrome manually:
/Applications/Google\ Chrome.app/Contents/MacOS/Google\ Chrome --remote-debugging-port=9222 &
```

### Permission Errors

If you see permission errors:

1. Make sure "Allow JavaScript from Apple Events" is enabled in Chrome
2. Verify accessibility permissions are granted
3. Try running this test command:
   ```bash
   osascript -e 'tell application "Google Chrome" to get URL of active tab of front window'
   ```
   
   If this fails, permissions need to be fixed.

### Build Issues

If the server doesn't start, rebuild:

```bash
cd /Users/Apple/Documents/GitHub/chrome-mcp
pnpm install
pnpm run build
```

## Testing Without Claude Desktop

You can test the MCP server standalone:

```bash
cd /Users/Apple/Documents/GitHub/chrome-mcp
node build/index.js
```

The server will wait for MCP protocol messages on stdin. Press Ctrl+C to exit.

## Updating

To update the server after making changes:

```bash
cd /Users/Apple/Documents/GitHub/chrome-mcp
git pull  # if you made this a git repo
pnpm install
pnpm run build
# Restart Claude Desktop
```

## Uninstalling

To remove the Chrome MCP server:

1. Edit `~/Library/Application Support/Claude/claude_desktop_config.json`
2. Remove the `"chrome"` entry from `"mcpServers"`
3. Restart Claude Desktop

To completely remove:

```bash
cd /Users/Apple/Documents/GitHub/chrome-mcp
rm -rf node_modules build
# Then delete the directory if desired
```

