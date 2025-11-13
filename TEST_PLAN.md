# Test Plan pour mcp-chromium-cdp

## Test de Reconnexion Automatique

### Pré-requis
- Chromium lancé avec CDP : `~/.claude-memories/scripts/launch-chromium-cdp.sh`
- Serveur configuré : `claude mcp list | grep chromium-cdp` → ✓ Connected

### Scénario de Test

#### 1. Test Initial (Chromium Running) ✅

Demander à Claude Code :
```
Using the chromium-cdp tools, get the current URL
```

**Résultat attendu** : URL actuelle retournée (ex: "chrome-error://chromewebdata/" ou URL de page ouverte)

---

#### 2. Simuler Disconnexion 🔴

Dans le terminal :
```bash
# Tuer Chromium
pkill -f "Chromium.app"

# Attendre 2 secondes
sleep 2
```

**Résultat attendu** : Chromium fermé, port 9222 libéré

---

#### 3. Relancer Chromium 🔄

```bash
~/.claude-memories/scripts/launch-chromium-cdp.sh
```

**Résultat attendu** :
```
✅ Chromium launched successfully
📍 CDP endpoint: http://localhost:9222
```

---

#### 4. Test Reconnexion Automatique ✅

Demander à nouveau à Claude Code :
```
Using the chromium-cdp tools, get the current URL again
```

**Résultat attendu** :
- Logs stderr montrent :
  ```
  [Reconnect] Attempting to reconnect to Chromium...
  [Reconnect] Successfully reconnected to Chromium
  ```
- URL retournée avec succès

---

## Outils Disponibles

```
chrome_navigate          - Navigate to a URL
chrome_get_current_url   - Get current page URL
chrome_get_title         - Get page title
chrome_get_content       - Get page HTML
chrome_get_visible_text  - Get visible text
chrome_execute_script    - Execute JavaScript
chrome_click             - Click element by selector
chrome_type              - Type text into input
chrome_screenshot        - Take screenshot
chrome_open_new_tab      - Open new tab
chrome_close_tab         - Close current tab
chrome_list_tabs         - List all tabs
chrome_reload            - Reload page
chrome_go_back           - Navigate back
chrome_go_forward        - Navigate forward
```

## Vérification des Logs

Les logs de reconnexion sont sur **stderr** :
```bash
# Si vous lancez le serveur manuellement :
node ~/dev/tools/mcp/mcp-chromium-cdp/build/index.js 2>&1 | grep -E "\[Reconnect\]|\[Connection\]"
```

Avec Claude Code, les logs stderr apparaissent dans la sortie du MCP server.

## Variables d'Environnement (Optionnel)

```bash
# Spécifier path Chromium custom
CHROMIUM_PATH=/path/to/chromium mcp-chromium-cdp

# Utiliser un profil custom
CHROMIUM_USER_DATA_DIR=~/.config/chromium-test mcp-chromium-cdp
```

## Test de Launch Automatique

Si Chromium n'est **pas** lancé, le serveur devrait le lancer automatiquement :

```bash
# Tuer Chromium
pkill -f "Chromium.app"

# Appeler un outil via Claude Code
# Le serveur devrait lancer Chromium automatiquement
```

**Résultat attendu** : Chromium se lance automatiquement, outil fonctionne
