# MCP Chromium CDP - Product Backlog

**Project Goal**: Enable autonomous task completion without human intervention

**Target Workflow**: Agent executes "Configure Miro OAuth" end-to-end without human intervention

---

## Sprint Status

### Sprint 2 - COMPLETE ✅
**Goal**: Resolve all P0 blockers, make Sprint 1 features mergeable

**Delivered**:
- Security: Zero vulnerabilities (SECURE1, SECURE2)
- Tests: 103 passing (38.67% coverage)
- Performance: Memory leak fixed, 10x speedup on forms
- Architecture: 6 service classes, 55% code reduction
- Input validation: All tools validate inputs
- **Result**: AUTO1, AUTO2, AUTO3, AUTO6 ready for merge

**Commits**: 8e9db95, 77b084c, 1854a0d, 739170c, 14bb9a2, 42b78af

### Sprint 3 - COMPLETE ✅
**Goal**: Deliver text-based interaction (AUTO4.5) + Start P1 improvements

**Delivered**:
- AUTO4.5: Text-based interaction (chrome_click_text, chrome_type_text, chrome_extract_interactive, chrome_get_property)
- Tests: 153 passing (50 new tests for text interaction)
- Security: Zero script injection vulnerabilities
- Commits: 3cea901, 3c32608, 3bacdfe, 174d652, afd3a5a, 7452799

**Remaining (Sprint 4)**:
- PERF-IMP1: Optimize checkPage() O(n×18) → O(n)
- PERF-IMP2: Adaptive polling in waitFor()
- QUALITY-IMP1: Split large methods
- QUALITY-IMP2: API consistency fixes

---

## Product Backlog

### P0 - Critical Blockers (Sprint 2)

**[✅] SECURE1: Eliminate JavaScript injection vulnerabilities**
- As a security engineer, I want all user inputs safely handled so that no code injection is possible
- Status: ✅ COMPLETE (Commit: 1854a0d)
- Acceptance:
  - click(), type(), waitFor() use CDP APIs only
  - Zero Runtime.evaluate with user input
  - 34 validation tests pass

**[✅] SECURE2: Redact sensitive data in form extraction**
- As a security engineer, I want password/SSN/CVV fields redacted so that credentials aren't exposed
- Status: ✅ COMPLETE (Commit: 1854a0d)
- Acceptance:
  - isSensitiveField() detects password/SSN/CVV fields
  - Returns '[REDACTED]' for sensitive values
  - 21 validation tests pass

**[✅] TEST1: Establish test infrastructure**
- As a developer, I want comprehensive tests so that I can refactor safely
- Status: ✅ COMPLETE (Commit: 8e9db95)
- Acceptance:
  - Vitest configured with v8 coverage
  - MockCDPClient fixture complete
  - 55 tests passing (21 unit + 34 CDP validation)

**[✅] TEST2: Security test suite**
- As a security engineer, I want regression tests so that injection vulnerabilities don't return
- Status: ✅ COMPLETE (Merged with TEST3 - Commit: 8e9db95)
- Acceptance:
  - Test malicious inputs handled safely
  - Verify CDP APIs used, not script injection
  - 34 CDP validation tests pass

**[✅] TEST3: Validate React frontend compatibility**
- As an agent, I want to click React elements so that I can automate OAuth workflows
- Status: ✅ COMPLETE (Commit: 8e9db95)
- Acceptance:
  - Verify CDP Input.dispatchMouseEvent used
  - Verify real browser events dispatched
  - 34 automated tests prove React compatibility

**[✅] PERF1: Fix memory leak in waitFor()**
- As an agent, I want reliable long-running workflows so that the browser doesn't crash
- Status: ✅ COMPLETE (Commit: 1854a0d)
- Acceptance:
  - try/finally ensures Network.disable() called
  - Cleanup occurs even on timeout/error
  - Tests verify cleanup execution

**[✅] PERF2: Optimize extractForms() complexity**
- As an agent, I want fast form extraction so that workflows aren't delayed
- Status: ✅ COMPLETE (Commit: 1854a0d)
- Acceptance:
  - O(n) complexity using label lookup Map
  - 22-field form completes in <10ms
  - Backward compatible output

**[✅] QUALITY2: Extract configuration constants**
- As a developer, I want named constants so that behavior is clear and tunable
- Status: ✅ COMPLETE (Commit: 77b084c)
- Acceptance:
  - 13 static readonly constants extracted
  - No magic numbers remain
  - Self-documenting code

**[✅] VALIDATE1: Input validation layer**
- As a security engineer, I want inputs validated so that DoS/XSS attacks are prevented
- Status: ✅ COMPLETE (Commit: 739170c)
- Acceptance:
  - ValidationService validates selectors, timeouts, URLs, dimensions
  - Structured JSON errors with actionable info
  - 49 validation tests pass

**[✅] ARCH1: Refactor to service classes**
- As a developer, I want SRP compliance so that code is testable and maintainable
- Status: ✅ COMPLETE (Commit: 42b78af)
- Acceptance:
  - ChromeController reduced 55% (1299→573 lines)
  - 6 service classes extracted
  - Orchestrator pattern with dependency injection
  - 103 tests pass

---

### P1 - Ready for Merge (Sprint 1)

**[✅] AUTO1: Screenshot with auto-resize**
- As an agent, I want screenshots that fit API limits so that I can perceive page state
- Status: ✅ READY FOR MERGE
- Implementation: ScreenshotService (114 lines)
- Blockers resolved: SECURE1, TEST1, VALIDATE1, ARCH1

**[✅] AUTO2: Quick page state checks**
- As an agent, I want fast page checks so that I can verify state without screenshots
- Status: ✅ READY FOR MERGE
- Implementation: PageCheckingService (120 lines)
- Blockers resolved: TEST1, VALIDATE1, ARCH1

**[✅] AUTO3: Form extraction**
- As an agent, I want structured form data so that I can fill forms without custom scripts
- Status: ✅ READY FOR MERGE
- Implementation: FormExtractionService (265 lines)
- Blockers resolved: SECURE1, SECURE2, PERF2, TEST1, VALIDATE1, ARCH1

**[✅] AUTO6: Wait for UI changes**
- As an agent, I want to wait for conditions so that I can verify actions succeeded
- Status: ✅ READY FOR MERGE
- Implementation: WaitService (232 lines)
- Blockers resolved: SECURE1, PERF1, TEST1, VALIDATE1, ARCH1

---

### P1 - Performance Improvements (Sprint 3)

**[ ] PERF-IMP1: Optimize checkPage() complexity**
- As an agent, I want fast page checks so that workflows aren't slowed
- Status: ⏸️ PLANNED (Sprint 3)
- Acceptance:
  - Single-pass element collection (O(n) vs O(n×18))
  - Complex page completes in <200ms
  - Backward compatible output
- Effort: 2-3 hours

**[ ] PERF-IMP2: Adaptive polling in waitFor()**
- As an agent, I want fast condition detection so that workflows respond quickly
- Status: ⏸️ PLANNED (Sprint 3)
- Acceptance:
  - Start 10ms, backoff to 100ms
  - MutationObserver for DOM changes
  - Fast changes detected in <50ms
- Effort: 3-4 hours

---

### P1 - Code Quality Improvements (Sprint 3)

**[ ] QUALITY-IMP1: Split large methods**
- As a developer, I want focused functions so that code is readable and testable
- Status: ⏸️ PLANNED (Sprint 3)
- Acceptance:
  - extractForms(), waitFor(), checkPage() split into helpers
  - Each function <100 lines
  - Test coverage maintained
- Effort: 4-5 hours

**[ ] QUALITY-IMP2: API consistency**
- As an agent, I want consistent responses so that error handling is simpler
- Status: ⏸️ PLANNED (Sprint 3)
- Acceptance:
  - Standard format: {success, data?, error?}
  - All tools adopt pattern
  - Migration guide provided
- Effort: 2-3 hours

---

### P2 - Feature Development (Sprint 3+)

**[✅] AUTO4.5: Text-based interaction**
- As an agent, I want to click by text/role so that selectors don't break on React apps
- Status: ✅ MERGED (Commits: 3cea901, 3c32608, 3bacdfe, 174d652, afd3a5a, 7452799)
- Implementation: TextInteractionService (523 lines)
- Tools added:
  - chrome_click_text({text: "Connect", role: "button"})
  - chrome_type_text({label: "Client ID", text: "..."})
  - chrome_extract_interactive() returns all clickable elements
  - chrome_get_property(selector, property) for safe property access
- Acceptance:
  - ✅ Uses CDP DOM + Input.dispatchMouseEvent (zero script injection)
  - ✅ 50 comprehensive tests (validation, element finding, interaction, security)
  - ✅ Actionable error messages with suggestions
  - ✅ Security validated (XPath safety, property validation)
- Impact: Reduces chrome_execute_script reliance from 36% → <10% target
- Test Results: 153 tests passing (all automation tests green)

**[ ] AUTO4: Tables/lists extraction**
- As an agent, I want structured table data so that I can read configuration pages
- Status: ⏸️ DEFERRED
- Acceptance:
  - chrome_extract_table returns headers, rows, cells
  - chrome_extract_list returns items, hierarchy
  - Works with HTML/div tables and virtualized lists
- Effort: 1-2 days

**[ ] AUTO5: Error/success message detection**
- As an agent, I want to detect messages so that I can verify actions succeeded
- Status: ⏸️ DEFERRED
- Acceptance:
  - chrome_extract_messages returns type, text, severity
  - Detects toasts, banners, field errors, modals, console errors
  - Works with Material, Bootstrap, Ant Design
- Effort: 2-3 days

**[ ] AUTO7: Interactive element verification**
- As an agent, I want to wait for interactive elements so that clicks don't fail
- Status: ⏸️ DEFERRED
- Acceptance:
  - chrome_click/type auto-wait for visible, enabled, stable
  - Returns success/failure with reason
  - Optional timeout parameter
- Effort: 1-2 days

**[ ] AUTO8: Screenshot failure recovery**
- As an agent, I want graceful screenshot failures so that conversations don't halt
- Status: ⏸️ DEFERRED
- Acceptance:
  - Failure returns structured state (URL, title, error, suggestions)
  - Includes alternative perception options
  - Agent can continue with alternative methods
- Effort: 1 day

**[ ] AUTO9: Screenshot comparison**
- As an agent, I want to compare screenshots so that I can verify UI changes
- Status: ⏸️ DEFERRED
- Acceptance:
  - chrome_compare_screenshots returns difference %, regions changed
  - Can compare full page, element, or region
  - Highlights visual differences
- Effort: 2-3 days

**[ ] AUTO10: Element screenshots**
- As an agent, I want element-only screenshots so that I save tokens
- Status: ⏸️ DEFERRED
- Acceptance:
  - chrome_screenshot accepts optional selector
  - Captures bounding box + 10px margin
  - Significantly smaller file size
- Effort: 1 day

**[ ] AUTO11: Actionable error messages**
- As an agent, I want recovery suggestions so that I can self-recover from errors
- Status: ⏸️ DEFERRED
- Acceptance:
  - All errors return: code, message, suggested actions, context
  - Errors categorized: TRANSIENT, INVALID_INPUT, PAGE_STATE, BROWSER_FAILURE
  - Agent can parse suggested actions programmatically
- Effort: 2-3 days

**[ ] AUTO12: Failure pattern detection**
- As an agent, I want automatic pattern detection so that I can recover from common failures
- Status: ⏸️ DEFERRED
- Acceptance:
  - Detects: auth redirect, session timeout, rate limit, network error
  - Returns pattern, confidence, suggested recovery
  - Can configure auto-recovery per pattern
- Effort: 3-4 days

**[ ] AUTO13: Interactive element extraction**
- As an agent, I want to discover actions so that I don't try selectors blindly
- Status: ⏸️ DEFERRED
- Acceptance:
  - chrome_extract_interactive returns buttons, links, inputs, dropdowns
  - Grouped by functionality
  - Indicates visibility and interactivity state
- Effort: 1-2 days

**[ ] AUTO14: Batch form filling**
- As an agent, I want to fill forms in one operation so that workflows are faster
- Status: ⏸️ DEFERRED
- Acceptance:
  - chrome_fill_form accepts JSON field data
  - Fills all fields in single operation
  - Returns success/failure per field
  - Optional auto-submit
- Effort: 2-3 days

---

### P3 - Nice to Have (Future)

**[ ] AUTO15: Session state management**
- As an agent, I want to save/restore sessions so that I can resume workflows
- Status: ⏸️ FUTURE
- Acceptance:
  - chrome_save_session captures cookies, storage, URL
  - chrome_restore_session reapplies state
  - Named sessions with expiration

**[ ] AUTO16: Workflow checkpoints**
- As an agent, I want checkpoints so that I can rollback on failure
- Status: ⏸️ FUTURE
- Acceptance:
  - chrome_checkpoint creates savepoint
  - chrome_rollback restores to checkpoint
  - Automatic cleanup after 24h

**[ ] AUTO17: Performance issue detection**
- As an agent, I want to detect hung pages so that I can decide to reload/abort
- Status: ⏸️ FUTURE
- Acceptance:
  - chrome_check_performance returns load time, errors, memory
  - Detects page hung, memory leak, slow network
  - Returns recommendation: wait, reload, abort

**[ ] AUTO18: Network request monitoring**
- As an agent, I want to verify API calls so that I know actions succeeded
- Status: ⏸️ FUTURE
- Acceptance:
  - chrome_monitor_network captures URL, method, status
  - Returns recent requests matching pattern
  - Can filter by URL, method, status, time

---

## MCP Advanced Features (Exploration)

**[ ] AUTO19: Page structure templates**
- As an agent, I want page templates so that I understand structure upfront
- Status: ⏸️ EXPLORATION

**[ ] AUTO20: Workflow guidance prompts**
- As an agent, I want workflow suggestions so that I learn optimal approaches
- Status: ⏸️ EXPLORATION

**[ ] AUTO21: Selector auto-completion**
- As an agent, I want selector completions so that I avoid errors
- Status: ⏸️ EXPLORATION

---

## Metrics

**Sprint 2 Results**:
- Security: 0 vulnerabilities (was 5 HIGH)
- Performance: 10x speedup on forms, zero memory leaks
- Tests: 103 passing (was 0)
- Coverage: 38.67% (was 0%)
- Architecture: 6 services, 55% code reduction
- Sprint 1 features: 4 ready for merge (AUTO1, AUTO2, AUTO3, AUTO6)

**Sprint 3 Results**:
- Tests: 153 passing (+50 from text interaction) - ALL GREEN
- Architecture: 7 services (added TextInteractionService)
- Tools: 4 new semantic interaction tools
- Impact: Execute_script usage target reduced 36% → <10%
- Lines added: 1,362 (service 523 + tests 606 + integration 233)
- Commits: 6 atomic commits (service + tools + integration + validation + mocks + tests)

**Technical Investment Ratio**: 30% (GREEN ZONE)
- Target achieved: <30% through feature delivery (AUTO4.5)
- Quality bar maintained: 100% test pass rate, zero security vulnerabilities
