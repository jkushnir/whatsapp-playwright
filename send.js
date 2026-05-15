#!/usr/bin/env node
/**
 * send.js — send a WhatsApp message
 *
 * Usage:
 *   node send.js +19175551234 "Hello!"          # by phone number
 *   node send.js "Chat Name" "Hello!"            # by exact chat name
 *
 * Exit codes:
 *   0 — sent
 *   1 — session not linked
 *   2 — chat not found
 *   3 — error
 */

import { getSession, closeSession } from './lib/session.js';

const [, , target, ...parts] = process.argv;
const message = parts.join(' ');

if (!target || !message) {
  console.error('Usage: node send.js <phone_or_chat_name> <message>');
  process.exit(3);
}

const { browser, isNew } = await getSession();

if (isNew) {
  console.error('No saved session. Run: node link.js +<your_number>');
  await closeSession(browser);
  process.exit(1);
}

const page = browser.pages()[0] || await browser.newPage();
await page.goto('https://web.whatsapp.com', { waitUntil: 'domcontentloaded' });

try {
  await page.waitForSelector(
    '#side, [data-testid="chat-list"], input[placeholder*="Search"]',
    { timeout: 30_000 }
  );
} catch {
  console.error('Session expired. Run: node link.js +<your_number>');
  await closeSession(browser);
  process.exit(1);
}

// Open the chat
let opened = false;
const isPhone = /^\+?\d{7,15}$/.test(target.replace(/[\s()-]/g, ''));

if (isPhone) {
  const digits = target.replace(/\D/g, '');
  await page.goto(`https://web.whatsapp.com/send?phone=${digits}`, { waitUntil: 'domcontentloaded' });
  try {
    await page.waitForSelector(
      '[data-testid="conversation-compose-box-input"], [contenteditable][aria-label*="message" i]',
      { timeout: 15_000 }
    );
    opened = true;
  } catch (_) { /* fall through to search */ }
}

if (!opened) {
  await page.goto('https://web.whatsapp.com', { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('input[placeholder*="Search"]', { timeout: 15_000 });

  const searchInput = await page.$('input[placeholder*="Search"]');
  if (searchInput) {
    await searchInput.click();
    await searchInput.type(target, { delay: 40 });
    await page.waitForTimeout(2000);

    // Click via Playwright element handle — triggers full conversation navigation
    const items = await page.$$('[data-testid="cell-frame-container"]');
    for (const item of items) {
      const match = await item.evaluate((el, name) => {
        const nameEl = el.querySelector('[data-testid="cell-frame-title"] span[dir="auto"]');
        const t = nameEl?.getAttribute('title') || nameEl?.textContent?.trim() || '';
        return t.toLowerCase().includes(name.toLowerCase());
      }, target);
      if (match) {
        await item.click();
        await page.waitForTimeout(2000);
        opened = true;
        break;
      }
    }
  }
}

if (!opened) {
  console.error(`Chat not found: ${target}`);
  await closeSession(browser);
  process.exit(2);
}

// Type and send
const inputSel =
  '[data-testid="conversation-compose-box-input"], '
  + '[contenteditable][aria-label*="message" i], '
  + '[contenteditable][data-tab="10"]';

await page.waitForSelector(inputSel, { timeout: 10_000 });
const input = await page.$(inputSel);
await input.click();
await input.type(message, { delay: 30 });
await page.keyboard.press('Enter');
await page.waitForTimeout(1500);

console.log('sent');
await closeSession(browser);
