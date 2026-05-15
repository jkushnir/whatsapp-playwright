#!/usr/bin/env node
/**
 * link.js — link WhatsApp Web to your phone (one-time setup)
 *
 * Usage:
 *   node link.js +1234567890
 *
 * The script opens a browser window, navigates to WhatsApp Web,
 * enters your phone number, and shows you an 8-character code.
 * Enter that code in your WhatsApp app to complete the link.
 *
 * After linking, the session is saved and all future runs are headless.
 */

import { getSession, closeSession } from './lib/session.js';
import { writeFileSync } from 'fs';

const phoneNumber = process.argv[2];
if (!phoneNumber || !/^\+\d{7,15}$/.test(phoneNumber)) {
  console.error('Usage: node link.js +<country_code><number>');
  console.error('Example: node link.js +19175551234');
  process.exit(1);
}

const { browser, isNew } = await getSession();
const page = browser.pages()[0] || await browser.newPage();

await page.goto('https://web.whatsapp.com', { waitUntil: 'domcontentloaded' });
await page.waitForTimeout(5000);

// Already linked?
const chatSearch = await page.$('input[placeholder*="Search"], input[aria-label*="Search"]');
if (chatSearch) {
  console.log('Already linked! Session is valid.');
  await closeSession(browser);
  process.exit(0);
}

// Click "Log in with phone number"
console.log('Clicking "Log in with phone number"...');
const clicked = await page.evaluate(() => {
  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
  let node;
  while ((node = walker.nextNode())) {
    if (node.textContent?.trim() === 'Log in with phone number') {
      node.parentElement.click();
      return true;
    }
  }
  return false;
});

if (!clicked) {
  await page.screenshot({ path: '/tmp/wa-link-debug.png' });
  console.error('Could not find "Log in with phone number". Screenshot: /tmp/wa-link-debug.png');
  await closeSession(browser);
  process.exit(1);
}

await page.waitForTimeout(2500);

// Fill phone number (pass the full +country+number — WA auto-selects country)
console.log(`Entering phone number ${phoneNumber}...`);
const phoneInput = await page.$('input[type="tel"], input[aria-label*="phone"], input[placeholder*="phone"]');
if (phoneInput) {
  await phoneInput.click({ clickCount: 3 });
  await page.keyboard.press('Backspace');
  await page.keyboard.type(phoneNumber, { delay: 60 });
} else {
  console.error('Phone number input not found.');
  await closeSession(browser);
  process.exit(1);
}

await page.waitForTimeout(800);

// Click Next
try {
  await page.click('button:has-text("Next"), [data-testid="link-device-phone-number-next-btn"]', { timeout: 3000 });
} catch {
  await page.keyboard.press('Enter');
}

await page.waitForTimeout(3000);

// Extract the 8-character link code (displayed as individual boxes: XXXX-XXXX)
console.log('Waiting for link code...');
let code = null;
const deadline = Date.now() + 90_000;

while (Date.now() < deadline && !code) {
  await page.waitForTimeout(1500);

  code = await page.evaluate(() => {
    // Specific testid
    const codeEl = document.querySelector('[data-testid="link-device-phone-number-code"]');
    if (codeEl) return codeEl.textContent?.replace(/\s/g, '') || null;

    // Each character is in its own leaf element — find the run of 9: XXXX-XXXX
    const leaves = Array.from(document.querySelectorAll('*')).filter(
      el => el.children.length === 0 && /^[A-Z0-9-]$/.test((el.textContent || '').trim())
    );
    for (let i = 0; i <= leaves.length - 9; i++) {
      const run = leaves.slice(i, i + 9).map(e => e.textContent.trim());
      if (run[4] === '-' && run.filter(c => c !== '-').length === 8) {
        return run.join('');
      }
    }
    return null;
  });
}

if (!code) {
  await page.screenshot({ path: '/tmp/wa-code-debug.png' });
  const pageText = await page.evaluate(() => document.body.innerText?.slice(0, 1000));
  console.error('Could not extract code. Page text:\n' + pageText);
  console.error('Screenshot: /tmp/wa-code-debug.png');
  await closeSession(browser);
  process.exit(1);
}

console.log('\n╔══════════════════════╗');
console.log('║  LINK CODE: ' + code.padEnd(10) + '║');
console.log('╚══════════════════════╝');
console.log('\nOn your phone:');
console.log('  1. Open WhatsApp');
console.log('  2. Go to Settings → Linked Devices → Link a Device');
console.log('  3. Tap "Link with phone number instead"');
console.log('  4. Enter the code above\n');
console.log('Waiting up to 5 minutes for you to enter the code...');

// Wait for chat list = successfully linked
try {
  await page.waitForSelector(
    '[data-testid="chat-list"], #pane-side, input[placeholder*="Search"]',
    { timeout: 300_000 }
  );
  console.log('\nLinked! Session saved. You can now use read.js and send.js.');
} catch {
  console.log('Timed out. If you entered the code, re-run link.js to verify.');
}

await closeSession(browser);
