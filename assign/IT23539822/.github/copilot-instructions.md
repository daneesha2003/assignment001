# IT23539822 - Singlish-to-Sinhala Translator Test Suite

## Project Overview
Automated test suite for **SwiftTranslator** (https://www.swifttranslator.com/) - validates Singlish romanized text conversion to Sinhala script using **Playwright**.

**Purpose**: Demonstrates comprehensive test coverage with 8 passing scenarios (valid translations) and 5 intentionally failing scenarios (degraded quality inputs to show detection).

## Test Architecture

### Data-Driven Testing Pattern
- **Single file**: [tests/positive.spec.js](tests/positive.spec.js) (13 test cases)
- **First 7 scenarios** (`Pos_Fun_XXXX`): Expected PASS - valid Singlish → correct Sinhala output
- **Last 5 scenarios** (`Neg_Fun_XXXX`): Expected FAIL - degraded inputs (no spaces, typos, noise) show translator limitations
- **Format**: Array of objects `{ id, name, input, expected, shouldPass }`
- The `shouldPass` flag documents intent but all scenarios use uniform assertion logic

### Application Under Test
- **Target**: https://www.swifttranslator.com/
- **Input**: Singlish romanized Sinhala (e.g., `mama gedhara yanavaa.`)
- **Output**: Sinhala script (e.g., `මම ගෙදර යනවා.`)
- **Selector**: `div.whitespace-pre-wrap.overflow-y-auto`

## Test Resilience Patterns

### 1. Navigation Retry (lines 30-38)
Handles network timeouts with 2 attempts before failing:
```javascript
for (let attempt = 0; attempt < 2 && !navigated; attempt++) {
  try {
    await page.goto('https://www.swifttranslator.com/', { waitUntil: 'domcontentloaded', timeout: 60000 });
    navigated = true;
  } catch (err) {
    if (attempt === 1) throw err;
  }
}
```

### 2. Multi-Selector Input Detection (lines 45-56)
Tests 5 different selectors to find input element (UI may vary):
- `textarea`, `input[type="text"]`, `[contenteditable="true"]`, `[placeholder*="Singlish"]`, `div[role="textbox"]`

### 3. Element Type Handling (lines 58-67)
Detects element type and dispatches events correctly:
- **textarea/input**: `fill()` + `blur()` to trigger JS listeners
- **contenteditable/div**: `innerText` assignment + custom `input` event dispatch

### 4. Output Polling (lines 69-71)
Waits up to 15s for non-empty Sinhala output:
```javascript
await page.waitForFunction((sel) => {
  const el = document.querySelector(sel);
  return el && el.innerText && el.innerText.trim().length > 0;
}, outputSelector, { timeout: 15000 });
```

## Critical Workflows

### Running Tests
```bash
# From project root
cd C:\Users\Daneesha\Desktop\IT23539822

# Run all tests
npx playwright test

# View HTML report
npx playwright show-report

# Run with Playwright Inspector (interactive debugging)
npx playwright test --ui

# Run headed (see browser)
npx playwright test --headed

# Run single test by name
npx playwright test -g "Pos_Fun_0001"
```

## Pass/Fail Status Feature

### Test Output with Status Comparison
Each test now displays **detailed pass/fail status** with expected vs actual output:

```
TC ID: Pos_Fun_0001 | Status: ✓ PASS | Expected to PASS
  Expected: මම ගෙදර යනවා.
  Actual:   මම ගෙදර යනවා.
  Match: YES

TC ID: Neg_Fun_0001 | Status: ✓ PASS | Expected to FAIL  
  Expected: මමගෙදරයනවා
  Actual:    kerman ගෙදරයනවා
  Match: YES
```

**Status Indicators:**
- `✓ PASS` - Expected output matches actual output
- `✗ FAIL` - Expected output does NOT match actual output
- **Expected**: What the translator should output
- **Actual**: What the translator produced
- **Match**: YES/NO equality confirmation

This feature helps verify:
- Positive tests produce correct translations ✓
- Negative tests capture degraded outputs ✓
- Character encoding matches exactly ✓

### Adding New Test Cases
1. Add to `scenarios` array in [tests/positive.spec.js](tests/positive.spec.js)
2. Use naming convention:
   - `Pos_Fun_XXXX` for passing tests
   - `Neg_Fun_XXXX` for intentionally failing tests
3. All fields required: `id`, `name`, `input`, `expected`, `shouldPass`
4. Screenshots auto-saved to `screenshots/${id}.png` per test

## Project Structure
```
.
├── .github/
│   └── copilot-instructions.md    # This file
├── tests/
│   └── positive.spec.js           # Main suite (13 scenarios)
├── screenshots/                   # Auto-generated (13 images per run)
├── playwright-report/             # HTML report (generated after test run)
├── playwright.config.ts           # Playwright configuration
├── package.json                   # Dependencies
└── test-results/                  # Detailed error contexts
```

## Configuration & CI/CD ([playwright.config.ts](playwright.config.ts))

### Local Mode
- **Parallelization**: Enabled (`fullyParallel: true`)
- **Retries**: 0 (fail fast)
- **Workers**: Unlimited
- **Reporter**: HTML

### CI Mode (when `process.env.CI` set)
- **Retries**: 2 (handle flakiness)
- **Workers**: 1 (sequential)
- **forbidOnly**: true (prevent accidental `test.only`)
- **Trace**: Collected on first retry (for debugging)

## Dependencies & Integration
- **Runtime**: Node.js + @playwright/test
- **Target**: External web app (no local backend)
- **Mocking**: None - all tests run against live SwiftTranslator
- **Browsers**: Chromium only (Firefox/Safari configs commented out)

## Common Issues & Fixes

| Issue | Cause | Fix |
|-------|-------|-----|
| "Input area not found" | AUT UI changed | Update `possibleSelectors` array (line 45) |
| "Output not found in 15s" | Translator slow/unreachable | Increase `waitForFunction` timeout (line 69) |
| Test randomly fails | Network timeout | Already retried 2x before failing |
| Report shows "No report found" | Report not generated | Run `npx playwright test` before `show-report` |
| Sinhala text garbled in report | Encoding issue | HTML report uses UTF-8 (verify browser settings) |

## Test Results Summary
- **Passing**: 8/13 tests (Pos_Fun scenarios demonstrate correct translations)
- **Failing**: 5/13 tests (Neg_Fun scenarios intentionally show degraded quality)
- **Success Rate**: 62% (by design - failing tests prove edge case detection)
