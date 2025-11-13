# MCP Chromium CDP - User Stories

---

## Completed Stories (Sprint 2-5)

### SECURE1: Eliminate JavaScript injection vulnerabilities

**User**: Security engineer auditing browser automation tool
**Outcome**: All user inputs safely handled with zero code injection possible
**Context**: Runtime.evaluate with user input created HIGH severity injection vulnerabilities

**Acceptance Criteria**:
- click(), type(), waitFor() use CDP APIs only (no Runtime.evaluate)
- Zero Runtime.evaluate calls with user input
- 34 validation tests pass proving React compatibility
- All malicious inputs handled safely

**Implementation Notes**:
- Use CDP Input.dispatchMouseEvent for clicks
- Use CDP Input.insertText for typing
- Use CDP DOM.querySelector for selectors

**Source**: SECURITY_AUDIT (Sprint 2)

---

### SECURE2: Redact sensitive data in form extraction

**User**: Security engineer protecting user credentials
**Outcome**: Password/SSN/CVV fields redacted so credentials aren't exposed in logs
**Context**: Form extraction exposed sensitive field values in API responses

**Acceptance Criteria**:
- isSensitiveField() detects password/SSN/CVV/credit card fields
- Returns '[REDACTED]' for all sensitive field values
- 21 validation tests pass
- Field metadata preserved (name, type, label) while value redacted

**Implementation Notes**:
- Check field type, name, autocomplete attributes
- Patterns for SSN, credit card, CVV fields

**Source**: SECURITY_AUDIT (Sprint 2)

---

### TEST1: Establish test infrastructure

**User**: Developer refactoring automation code safely
**Outcome**: Comprehensive tests enable confident refactoring without breaking functionality
**Context**: Zero tests prevented safe code improvements

**Acceptance Criteria**:
- Vitest configured with v8 coverage reporting
- MockCDPClient fixture complete for all CDP APIs
- 55 tests passing (21 unit + 34 CDP validation)
- Coverage tracking enabled and reported

**Implementation Notes**:
- Use Vitest for test runner (fast, TypeScript native)
- Mock CDP protocol for unit tests
- Integration tests verify React compatibility

**Source**: QUALITY_FOUNDATION (Sprint 2)

---

### TEST2: Security test suite

**User**: Security engineer preventing regression of injection vulnerabilities
**Outcome**: Regression tests ensure injection vulnerabilities don't return
**Context**: Fixed vulnerabilities could return without automated checks

**Acceptance Criteria**:
- Test malicious inputs handled safely (SQL injection, XSS, script injection)
- Verify CDP APIs used instead of script injection
- 34 CDP validation tests pass
- Integrated with CI/CD pipeline

**Implementation Notes**:
- Merged with TEST3 for efficiency
- Tests verify actual CDP calls made

**Source**: SECURITY_AUDIT (Sprint 2)

---

### TEST3: Validate React frontend compatibility

**User**: AI agent automating OAuth workflows on React apps
**Outcome**: React elements clickable, OAuth workflows completable
**Context**: Uncertain if CDP Input.dispatchMouseEvent triggers React event handlers

**Acceptance Criteria**:
- Verify CDP Input.dispatchMouseEvent dispatches real browser events
- React onClick handlers triggered by CDP clicks
- 34 automated tests prove React compatibility
- OAuth button clicks work reliably

**Implementation Notes**:
- Test with actual React components
- Verify event bubbling works correctly

**Source**: AUTOMATION_REQUIREMENT (Sprint 2)

---

### PERF1: Fix memory leak in waitFor()

**User**: AI agent running long-duration automation workflows
**Outcome**: Reliable workflows without browser crashes from memory exhaustion
**Context**: Network.enable without cleanup caused memory leaks in long-running waits

**Acceptance Criteria**:
- try/finally ensures Network.disable() called in all cases
- Cleanup occurs even on timeout or error
- Tests verify cleanup execution
- No memory growth over 1000+ wait operations

**Implementation Notes**:
- Use try/finally pattern consistently
- Mock tests verify cleanup called

**Source**: PERFORMANCE_ISSUE (Sprint 2)

---

### PERF2: Optimize extractForms() complexity

**User**: AI agent extracting forms on complex pages
**Outcome**: Fast form extraction so workflows aren't delayed
**Context**: O(n²) label lookup caused 2+ second delays on 22-field forms

**Acceptance Criteria**:
- O(n) complexity using label lookup Map
- 22-field form completes in <10ms (was 2000ms)
- Backward compatible output format
- All form extraction tests pass

**Implementation Notes**:
- Build label→field Map in single pass
- Reuse across all field label lookups

**Source**: PERFORMANCE_PROFILING (Sprint 2)

---

### QUALITY2: Extract configuration constants

**User**: Developer tuning automation behavior
**Outcome**: Named constants make behavior clear and tunable without code diving
**Context**: 13 magic numbers scattered through code required reading implementation

**Acceptance Criteria**:
- 13 static readonly constants extracted
- Zero magic numbers remain in core logic
- Constants documented with purpose
- Self-documenting code

**Implementation Notes**:
- Use static readonly class properties
- Group related constants (timeouts, limits, thresholds)

**Source**: CODE_QUALITY_REVIEW (Sprint 2)

---

### VALIDATE1: Input validation layer

**User**: Security engineer preventing DoS and XSS attacks
**Outcome**: All inputs validated, attacks prevented before execution
**Context**: Unvalidated inputs allowed malicious selectors, extreme timeouts

**Acceptance Criteria**:
- ValidationService validates selectors, timeouts, URLs, dimensions
- Structured JSON errors with actionable information
- 49 validation tests pass
- All tools use validation before CDP calls

**Implementation Notes**:
- Centralized ValidationService class
- Specific validators per input type
- Error messages guide corrective action

**Source**: SECURITY_HARDENING (Sprint 2)

---

### ARCH1: Refactor to service classes

**User**: Developer modifying automation logic
**Outcome**: SRP compliance makes code testable and maintainable
**Context**: 1299-line ChromeController violated SRP, hard to test and modify

**Acceptance Criteria**:
- ChromeController reduced 55% (1299→573 lines)
- 6 service classes extracted (Screenshot, PageChecking, FormExtraction, Wait, Validation, Interaction)
- Orchestrator pattern with dependency injection
- 103 tests pass after refactoring
- Each service has single responsibility

**Implementation Notes**:
- Extract services by feature domain
- Inject CDP client into services
- Controller orchestrates service calls

**Source**: ARCHITECTURE_REVIEW (Sprint 2)

---

### AUTO1: Screenshot with auto-resize

**User**: AI agent perceiving page state through vision
**Outcome**: Screenshots fit API limits so agent can see without errors
**Context**: Full-page screenshots exceeded Claude API 5MB limit

**Acceptance Criteria**:
- Screenshots auto-resize to fit 5MB limit
- Base64 or file output supported
- Quality preserved at reduced size
- Works on pages of any dimensions

**Implementation Notes**:
- ScreenshotService (114 lines)
- Progressive quality reduction until size fits

**Source**: AUTOMATION_REQUIREMENT (Sprint 1)

---

### AUTO2: Quick page state checks

**User**: AI agent verifying state changes without vision
**Outcome**: Fast state verification without screenshot overhead
**Context**: Screenshots slow and token-heavy for simple checks

**Acceptance Criteria**:
- chrome_check_page returns URL, title, text content, interactive elements
- Completes in <100ms on typical pages
- Structured JSON output
- No screenshot required

**Implementation Notes**:
- PageCheckingService (120 lines)
- Use CDP DOM queries
- Return structured data for parsing

**Source**: AUTOMATION_REQUIREMENT (Sprint 1)

---

### AUTO3: Form extraction

**User**: AI agent filling forms without custom scripts
**Outcome**: Structured form data enables filling without page-specific code
**Context**: Every form required custom script to extract fields

**Acceptance Criteria**:
- chrome_extract_forms returns fields with labels, types, values, options
- Handles all input types (text, select, checkbox, radio, textarea)
- Sensitive fields redacted (SECURE2)
- Works with label association patterns
- Fast extraction (PERF2: <10ms for 22 fields)

**Implementation Notes**:
- FormExtractionService (265 lines)
- Label lookup via for/id, nesting, aria-label
- Redaction for password/SSN/CVV fields

**Source**: AUTOMATION_REQUIREMENT (Sprint 1)

---

### AUTO6: Wait for UI changes

**User**: AI agent verifying actions succeeded
**Outcome**: Wait for conditions so agent knows when state changed
**Context**: Immediate checks after actions failed due to async updates

**Acceptance Criteria**:
- chrome_wait_for supports: selector, text, network idle, URL change
- Configurable timeout with default
- Returns success/failure with reason
- No memory leaks (PERF1)

**Implementation Notes**:
- WaitService (232 lines)
- Use CDP Network, DOM, Page events
- try/finally cleanup pattern

**Source**: AUTOMATION_REQUIREMENT (Sprint 1)

---

### AUTO4.5: Text-based interaction

**User**: AI agent clicking elements on React apps without brittle selectors
**Outcome**: Click by text/role so selectors don't break on React app updates
**Context**: 36% of operations used chrome_execute_script due to selector brittleness

**Acceptance Criteria**:
- chrome_click_text({text, role}) clicks by visible text and ARIA role
- chrome_type_text({label, text}) types into labeled fields
- chrome_extract_interactive() returns all clickable elements with text/role
- chrome_get_property(selector, property) safely accesses properties
- Uses CDP DOM + Input (zero script injection)
- 50 comprehensive tests pass
- Security validated (XPath safety, property validation)

**Implementation Notes**:
- TextInteractionService (523 lines)
- XPath for text search with security escaping
- CDP Input.dispatchMouseEvent for clicks
- Actionable error messages with suggestions

**Source**: AUTOMATION_REQUIREMENT (Sprint 3)

---

### QUALITY-IMP2: API consistency

**User**: AI agent handling errors across tools
**Outcome**: Consistent responses simplify error handling logic
**Context**: Each tool had different success/error formats

**Acceptance Criteria**:
- Standard format: {success: boolean, data?, error?, metadata?}
- Helper methods: success(), error(), timeout(), elementNotFound()
- 19 tests passing
- Used by AUTO5 and AUTO7 tools
- All tools migrated to standard format

**Implementation Notes**:
- ResponseBuilder utility (150 lines)
- Type-safe response construction
- Consistent error codes

**Source**: CODE_QUALITY_REVIEW (Sprint 4)

---

### AUTO5: Error/success message detection

**User**: AI agent verifying actions succeeded through UI feedback
**Outcome**: Detect messages so agent knows if action worked
**Context**: No programmatic way to verify success without screenshots

**Acceptance Criteria**:
- chrome_extract_messages returns type, text, severity
- Detects toasts, banners, field errors, modals, console errors
- Works with Material, Bootstrap, Ant Design frameworks
- <500ms detection time
- Zero script injection vulnerabilities

**Implementation Notes**:
- Pattern matching for common message containers
- CSS selectors for framework components
- Console.messageAdded for console errors

**Source**: AUTOMATION_REQUIREMENT (Sprint 4)

---

### AUTO7: Interactive element verification

**User**: AI agent avoiding click failures on non-interactive elements
**Outcome**: Auto-wait for interactive elements so clicks don't fail
**Context**: Clicks on loading/disabled elements caused workflow failures

**Acceptance Criteria**:
- chrome_click/type auto-wait for visible, enabled, stable
- Returns success/failure with reason
- Optional timeout parameter
- <10ms fast path for already-interactive elements
- Detailed failure reasons (hidden, disabled, moving, covered)

**Implementation Notes**:
- Integrate into click/type tools
- Check visibility, interactivity, stability
- Retry until ready or timeout

**Source**: AUTOMATION_REQUIREMENT (Sprint 4)

---

### AUTO13: Scrolling tool

**User**: AI agent navigating long pages and infinite scroll
**Outcome**: Scroll pages without chrome_execute_script for common operations
**Context**: Scrolling required unsafe script execution

**Acceptance Criteria**:
- chrome_scroll supports: direction (up/down/top/bottom), distance (pixels), target element (selector)
- Returns: position (x, y), atBottom, atTop, viewport height, document height
- Detects scroll completion (useful for infinite scroll)
- Optional behavior: smooth vs instant (default: instant)
- 27 comprehensive tests passing
- Zero script injection

**Implementation Notes**:
- ScrollService (215 lines)
- CDP Input.dispatchMouseEvent for wheel events
- CDP Runtime.evaluate for position queries only (no user input)

**Source**: AUTOMATION_REQUIREMENT (Sprint 5)

---

## In Progress Stories (Sprint 6)

### AUTO-SPA: SPA interaction support (hover + focus + click)

**User**: AI agent triggering React/SPA interactions in OAuth workflows
**Outcome**: Modal dialogs and synthetic event handlers trigger reliably
**Context**: CDP click dispatches mouse events but doesn't trigger React synthetic event handlers - buttons click successfully but modals don't appear, blocking OAuth workflows

**Acceptance Criteria**:
- chrome_hover tool implemented for pre-interaction state setup
- chrome_click enhanced with optional pre-hover/focus sequence
- SPA framework detection (React, Vue, Angular) guides interaction strategy
- Modal/dialog triggering works on React apps
- OAuth workflow buttons trigger expected dialogs
- Zero script injection (CDP Input events only)
- Comprehensive tests for SPA interaction patterns

**Implementation Notes**:
- Create HoverService for CDP Input.dispatchMouseEvent (hover events)
- Enhance InteractionService.click() with hover → focus → click sequence
- Add framework detection heuristics (check for React, Vue, Angular globals/attributes)
- Pattern: hover (mouseover) → focus (mousedown without release) → click (full sequence)
- Research: React synthetic events vs native events, event bubbling paths

**Technical Details**:
- **Problem**: CDP Input.dispatchMouseEvent fires native events, but React uses synthetic event system
- **Root Cause**: React synthetic event handlers require full interaction sequence (hover → focus → click), not just click
- **Solution**: Multi-step interaction mimicking real user behavior
- **Risk**: Framework-specific edge cases, timing between events

**Test Scenarios**:
- Button triggers modal on React app
- OAuth flow "Create app" button opens dialog
- Dropdown menus expand on hover + click
- Form submission after field focus
- Event handler verification (mouseenter, mouseover, mousedown, mouseup, click sequence)

**Source**: REAL_WORLD_USAGE (Sprint 6, Critical Blocker)

---

## Planned Stories (Sprint 6+)

### PERF-IMP1: Optimize checkPage() complexity

**User**: AI agent checking complex pages quickly
**Outcome**: Fast page checks so workflows aren't slowed by state verification
**Context**: O(n×18) complexity causes 1+ second delays on pages with 100+ elements

**Acceptance Criteria**:
- Single-pass element collection (O(n) vs O(n×18))
- Complex page completes in <200ms (vs 1000ms currently)
- Backward compatible output format
- All checkPage tests pass

**Implementation Notes**:
- Collect all element data in single CDP query
- Build lookup structures in one pass
- Benchmark on real complex pages

**Source**: PERFORMANCE_PROFILING (Sprint 6)

---

### PERF-IMP2: Adaptive polling in waitFor()

**User**: AI agent detecting fast UI changes
**Outcome**: Fast condition detection so workflows respond quickly to changes
**Context**: Fixed 100ms polling misses fast changes, wastes time on slow changes

**Acceptance Criteria**:
- Start 10ms polling, backoff to 100ms if no change
- MutationObserver for DOM changes (instant detection)
- Fast changes detected in <50ms (vs 100ms currently)
- Reduced CPU usage on long waits

**Implementation Notes**:
- Exponential backoff: 10ms → 20ms → 50ms → 100ms
- MutationObserver for DOM waits
- NetworkObserver already exists for network waits

**Source**: PERFORMANCE_OPTIMIZATION (Sprint 6)

---

### QUALITY-IMP1: Split large methods

**User**: Developer reading and testing automation code
**Outcome**: Focused functions make code readable and testable
**Context**: extractForms() (265 lines), waitFor() (232 lines), checkPage() (120 lines) hard to understand and test

**Acceptance Criteria**:
- Each function <100 lines
- Helper functions with clear single purposes
- Test coverage maintained (230 tests still pass)
- No behavior changes

**Implementation Notes**:
- Extract field label lookup (extractForms)
- Extract condition checking (waitFor)
- Extract element collection (checkPage)

**Source**: CODE_QUALITY_REVIEW (Sprint 6)

---

## Deferred Stories (Future)

### AUTO4: Tables/lists extraction

**User**: AI agent reading configuration pages with tabular data
**Outcome**: Structured table data enables parsing without custom scripts
**Context**: Tables require page-specific scraping code

**Acceptance Criteria**:
- chrome_extract_table returns headers, rows, cells
- chrome_extract_list returns items, hierarchy
- Works with HTML tables, div-based tables, virtualized lists
- Handles nested tables and lists

**Implementation Notes**:
- TableExtractionService
- Support semantic HTML and ARIA roles
- Handle dynamic content

**Source**: AUTOMATION_REQUIREMENT (Deferred)

---

### AUTO8: Screenshot failure recovery

**User**: AI agent continuing workflows when screenshots fail
**Outcome**: Graceful failures so conversations don't halt on screenshot errors
**Context**: Screenshot failures stop entire workflow

**Acceptance Criteria**:
- Failure returns structured state (URL, title, error, suggestions)
- Includes alternative perception options (extract_interactive, check_page)
- Agent can continue with alternative methods
- Error categorized: MEMORY, RENDER, SIZE, BROWSER

**Implementation Notes**:
- Try/catch screenshot capture
- Return structured error with alternatives
- Suggest chrome_check_page or chrome_extract_interactive

**Source**: RELIABILITY_IMPROVEMENT (Deferred)

---

### AUTO9: Screenshot comparison

**User**: AI agent verifying UI changes programmatically
**Outcome**: Compare screenshots to confirm visual changes occurred
**Context**: No way to verify visual changes without human review

**Acceptance Criteria**:
- chrome_compare_screenshots returns difference %, regions changed
- Can compare full page, element, or region
- Highlights visual differences
- Tolerates minor rendering differences

**Implementation Notes**:
- Pixel-by-pixel comparison
- Difference highlighting
- Threshold for minor differences

**Source**: AUTOMATION_ADVANCED (Deferred)

---

### AUTO10: Element screenshots

**User**: AI agent capturing specific UI elements efficiently
**Outcome**: Element-only screenshots save tokens on large pages
**Context**: Full-page screenshots waste tokens when only one element matters

**Acceptance Criteria**:
- chrome_screenshot accepts optional selector
- Captures bounding box + 10px margin
- Significantly smaller file size (50-90% reduction typical)
- Auto-scrolls element into view

**Implementation Notes**:
- Get element bounding box via CDP
- Clip screenshot to bounds
- Handle scrolling for off-screen elements

**Source**: TOKEN_OPTIMIZATION (Deferred)

---

### AUTO11: Actionable error messages

**User**: AI agent recovering from errors autonomously
**Outcome**: Recovery suggestions enable self-recovery without human help
**Context**: Generic errors require human interpretation and retry

**Acceptance Criteria**:
- All errors return: code, message, suggested actions, context
- Errors categorized: TRANSIENT, INVALID_INPUT, PAGE_STATE, BROWSER_FAILURE
- Agent can parse suggested actions programmatically
- Suggestions specific to error context

**Implementation Notes**:
- Error taxonomy with recovery patterns
- Context-aware suggestions
- Machine-readable action format

**Source**: AUTOMATION_ADVANCED (Deferred)

---

### AUTO12: Failure pattern detection

**User**: AI agent recovering from common failure patterns
**Outcome**: Automatic pattern detection enables recovery without explicit programming
**Context**: Common failures (auth redirect, timeout, rate limit) require manual handling

**Acceptance Criteria**:
- Detects: auth redirect, session timeout, rate limit, network error
- Returns pattern name, confidence, suggested recovery
- Can configure auto-recovery per pattern
- Learning from repeated failures

**Implementation Notes**:
- Pattern library for common failures
- Heuristic matching
- Confidence scoring
- Auto-recovery hooks

**Source**: AUTOMATION_ADVANCED (Deferred)

---

### AUTO14: Batch form filling

**User**: AI agent filling multi-field forms efficiently
**Outcome**: Fill forms in one operation for faster workflows
**Context**: Sequential field filling slow (network round-trips per field)

**Acceptance Criteria**:
- chrome_fill_form accepts JSON field data
- Fills all fields in single operation
- Returns success/failure per field
- Optional auto-submit parameter
- Validates field existence before filling

**Implementation Notes**:
- Batch CDP Input commands
- Field validation upfront
- Per-field error reporting

**Source**: AUTOMATION_OPTIMIZATION (Deferred)

---

### AUTO15: Session state management

**User**: AI agent resuming interrupted workflows
**Outcome**: Save/restore sessions to resume workflows after interruption
**Context**: Browser restart or network interruption loses all progress

**Acceptance Criteria**:
- chrome_save_session captures cookies, localStorage, sessionStorage, URL
- chrome_restore_session reapplies state to new browser instance
- Named sessions with expiration
- Handles authentication state

**Implementation Notes**:
- CDP Network.getCookies for cookies
- CDP Runtime.evaluate for storage
- Session persistence to disk

**Source**: RESILIENCE_FEATURE (Future)

---

### AUTO16: Workflow checkpoints

**User**: AI agent safely experimenting with workflows
**Outcome**: Checkpoints enable rollback on failure
**Context**: Failed actions leave browser in inconsistent state

**Acceptance Criteria**:
- chrome_checkpoint creates savepoint (cookies, storage, URL, DOM)
- chrome_rollback restores to checkpoint
- Automatic cleanup after 24h
- Multiple named checkpoints supported

**Implementation Notes**:
- Similar to AUTO15 but with DOM snapshots
- CDP DOMSnapshot for page state
- Restore via navigation + state reapply

**Source**: RESILIENCE_FEATURE (Future)

---

### AUTO17: Performance issue detection

**User**: AI agent detecting hung pages
**Outcome**: Detect hung pages so agent can decide to reload/abort
**Context**: Hung pages cause indefinite waits, waste time

**Acceptance Criteria**:
- chrome_check_performance returns load time, errors, memory usage
- Detects: page hung, memory leak, slow network
- Returns recommendation: wait, reload, abort
- Configurable thresholds

**Implementation Notes**:
- CDP Performance metrics
- Heuristics for hung detection
- Memory growth analysis

**Source**: RELIABILITY_FEATURE (Future)

---

### AUTO18: Network request monitoring

**User**: AI agent verifying API calls succeeded
**Outcome**: Verify API calls so agent knows backend actions worked
**Context**: UI feedback insufficient for API verification

**Acceptance Criteria**:
- chrome_monitor_network captures URL, method, status, payload
- Returns recent requests matching pattern
- Can filter by URL, method, status, time range
- Request/response body capture optional

**Implementation Notes**:
- CDP Network.requestWillBeSent/responseReceived
- Request history buffer
- Pattern matching filters

**Source**: DEBUGGING_FEATURE (Future)

---

### AUTO19: Page structure templates

**User**: AI agent understanding page structure upfront
**Outcome**: Page templates reduce trial-and-error exploration
**Context**: Agent must explore each page to understand structure

**Acceptance Criteria**:
- MCP resources expose page templates
- Templates describe common element locations
- Agent can query template before interaction
- Community-contributed templates

**Implementation Notes**:
- JSON schema for page templates
- Template library
- MCP resource integration

**Source**: MCP_EXPLORATION (Exploration)

---

### AUTO20: Workflow guidance prompts

**User**: AI agent learning optimal workflow approaches
**Outcome**: Workflow suggestions teach agent best practices
**Context**: Agent learns through trial-and-error inefficiently

**Acceptance Criteria**:
- MCP prompts suggest workflows for common tasks
- Context-aware suggestions (e.g., OAuth flow)
- Agent can request guidance via tool
- Community-contributed workflows

**Implementation Notes**:
- Workflow library in MCP prompts
- Context detection
- Integration with tool descriptions

**Source**: MCP_EXPLORATION (Exploration)

---

### AUTO21: Selector auto-completion

**User**: AI agent avoiding selector errors
**Outcome**: Selector completions reduce invalid selector attempts
**Context**: Invalid selectors cause workflow delays

**Acceptance Criteria**:
- Tool returns valid selectors from page
- Fuzzy matching for partial selectors
- Suggests similar selectors on error
- Performance <100ms for completion

**Implementation Notes**:
- Extract all valid selectors via CDP
- Fuzzy search index
- Integration with chrome_extract_interactive

**Source**: MCP_EXPLORATION (Exploration)
