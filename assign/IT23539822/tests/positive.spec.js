const { test, expect } = require('@playwright/test');
const fs = require('fs');
const path = require('path');

// Data-driven cases: first 5 are expected to PASS, next 5 are intentionally WRONG to produce FAILS
const scenarios = [
  { id: 'Pos_Fun_0001', name: 'Convert a simple sentence', input: 'mama gedhara yanavaa.', expected: 'මම ගෙදර යනවා.', shouldPass: true },
  { id: 'Pos_Fun_0002', name: 'Convert interrogative greeting', input: 'oyaage saepa sanipa kohomadha?.', expected: 'ඔයාගෙ සැප සනිප කොහොමද?.', shouldPass: true },
  { id: 'Pos_Fun_0003', name: 'Compound sentence with conjunction', input: 'api kaeema kanna yanavaa saha passe chithrapatayakuth balanavaa.', expected: 'අපි කෑම කන්න යනවා සහ පස්සෙ චිත්‍රපටයකුත් බලනවා.', shouldPass: true },
  { id: 'Pos_Fun_0004', name: 'Complex sentence (condition)', input: 'oya enavaanam mama balan innavaa.', expected: 'ඔය එනවානම් මම බලන් ඉන්නවා.', shouldPass: true },
  { id: 'Pos_Fun_0005', name: 'Interrogative greeting with punctuation', input: 'oyaata kohomadha?', expected: 'ඔයාට කොහොමද?', shouldPass: true },
  { id: 'Pos_Fun_0009', name: 'Convert Negative Sentence', input: 'mama ehema karannea naehae', expected: 'මම එහෙම කරන්නේ නැහැ', shouldPass: true },
  { id: 'Pos_Fun_0010', name: 'Convert polite request', input: 'karuNaakaralaa mata podi udhavvak karanna puLuvandha?', expected: 'කරුණාකරලා මට පොඩි උදව්වක් කරන්න පුළුවන්ද?', shouldPass: true },

  // Intentionally degraded inputs - expected outputs show translator limitations
  { id: 'Neg_Fun_0001', name: 'Joined words (no spaces) degrade conversion', input: 'mamagedharayanavaa', expected: 'මමගෙදරයනවා', shouldPass: false },
  { id: 'Neg_Fun_0002', name: 'Missing spacing inside phrase', input: 'matapaankannaoonee', expected: 'මටපාන්කන්නඕනේ', shouldPass: false },
  { id: 'Neg_Fun_0004', name: 'Multiple typos and character elongation', input: 'mama gedhara yanavaa', expected: 'මම ගෙදර යනවා', shouldPass: false },
  { id: 'Neg_Fun_0006', name: 'Slang with discourse particle', input: 'adoo vaedak baaragaththaanam eeka hariyata karapanko', expected: 'අඩෝ වැඩක් බාරගත්තානම් ඒක හරියට කරපන්කො', shouldPass: false },
  { id: 'Neg_Fun_0008', name: 'Punctuation noise', input: 'mama..?? yanne??', expected: 'මම..?? යන්නෙ??', shouldPass: false },
  { id: 'Neg_Fun_0011', name: 'Mixed Singlish with typo and informal spelling causes incorrect conversion', input: 'mata meeting ekak thiyenava mata eka hinda oyala ekka enna bariweyi oyala yanna', expected: 'මට meeting එකක් තියෙනව මට එක හින්ඩ ඔයල එක්ක එන්න බරිwඑයි ඔයල යන්න', shouldPass: false },
];

for (const scenario of scenarios) {
  test(`${scenario.id}: ${scenario.name}`, async ({ page }) => {
    // Navigate with larger timeout and retry with delay to handle network interruptions
    let navigated = false;
    for (let attempt = 0; attempt < 3 && !navigated; attempt++) {
      try {
        // Use 'load' instead of 'domcontentloaded' for more complete page loading
        await page.goto('https://www.swifttranslator.com/', { waitUntil: 'load', timeout: 90000 });
        navigated = true;
      } catch (err) {
        console.warn(`Attempt ${attempt + 1} to navigate failed: ${err.message}`);
        if (attempt < 2) {
          // Wait 3 seconds before retrying
          await page.waitForTimeout(3000);
        } else {
          throw err;
        }
      }
    }

    // Ensure screenshots directory exists
    const screenshotsDir = path.join(__dirname, '..', 'screenshots');
    fs.mkdirSync(screenshotsDir, { recursive: true });

    // Robustly find an input element (textarea, input, or contenteditable)
    const possibleSelectors = [
      'textarea',
      'input[type="text"]',
      '[contenteditable="true"]',
      '[placeholder*="Singlish"]',
      'div[role="textbox"]'
    ];

    let inputHandle = null;
    for (const sel of possibleSelectors) {
      const loc = page.locator(sel).first();
      if (await loc.count() > 0) {
        inputHandle = loc;
        break;
      }
    }

    if (!inputHandle) {
      throw new Error('Input area not found - selectors tried: ' + possibleSelectors.join(', '));
    }

    // Set input value depending on the element type
    const tag = await inputHandle.evaluate((el) => el.tagName.toLowerCase());
    if (tag === 'textarea' || tag === 'input') {
      await inputHandle.fill('');
      await inputHandle.fill(scenario.input);
      // blur to trigger any JS listeners
      await inputHandle.evaluate((el) => el.blur());
    } else {
      // contenteditable or div
      await inputHandle.click();
      await inputHandle.evaluate((el, value) => {
        el.innerText = value;
        const ev = new Event('input', { bubbles: true });
        el.dispatchEvent(ev);
      }, scenario.input);
    }

    // Wait for translator to process - give it time
    await page.waitForTimeout(2000);

    // Wait for output: poll until non-empty or timeout
    const outputSelector = 'div.whitespace-pre-wrap.overflow-y-auto';
    
    // Try to wait for output with extended timeout
    try {
      await page.waitForFunction((sel) => {
        const el = document.querySelector(sel);
        return el && el.innerText && el.innerText.trim().length > 0;
      }, outputSelector, { timeout: 60000 });
    } catch (e) {
      // If timeout, check if selector exists at all
      const selectorExists = await page.evaluate((sel) => {
        return document.querySelector(sel) !== null;
      }, outputSelector);
      
      if (!selectorExists) {
        throw new Error(`Output selector not found: ${outputSelector}`);
      }
      throw e; // Re-throw original error if selector exists
    }
    
    // Additional wait for stability
    await page.waitForTimeout(500);

    const outputDiv = page.locator(outputSelector).first();
    const actualOutput = (await outputDiv.innerText()).trim();
    
    // Determine status: PASS if actual matches expected, FAIL otherwise
    const isMatch = actualOutput === scenario.expected;
    const status = isMatch ? '✓ PASS' : '✗ FAIL';
    const expectedStatus = scenario.shouldPass ? 'Expected to PASS' : 'Expected to FAIL';
    
    console.log(`TC ID: ${scenario.id} | Status: ${status} | ${expectedStatus}`);
    console.log(`  Expected: ${scenario.expected}`);
    console.log(`  Actual:   ${actualOutput}`);
    console.log(`  Match: ${isMatch ? 'YES' : 'NO'}`);

    // Save screenshot for report evidence
    await page.screenshot({ path: path.join(screenshotsDir, `${scenario.id}.png`) });

    // Assert: check if actual matches expected
    expect(actualOutput).toBe(scenario.expected);
  });
}