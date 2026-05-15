#!/usr/bin/env node
/**
 * read.js — list unread WhatsApp chats
 *
 * Usage:
 *   node read.js
 *   node read.js --json
 *
 * Default output (pipe-delimited, one chat per line):
 *   chat_name|unread_count|last_message|timestamp|chat_type
 *
 * With --json: pretty JSON array
 *
 * Exit codes:
 *   0 — success (may be empty if nothing unread)
 *   1 — session not linked (run link.js first)
 */

import { getSession, closeSession } from './lib/session.js';

const asJson = process.argv.includes('--json');

const { browser, isNew } = await getSession();

if (isNew) {
  console.error('No saved session. Run: node link.js +<your_number>');
  await closeSession(browser);
  process.exit(1);
}

const page = browser.pages()[0] || await browser.newPage();
await page.goto('https://web.whatsapp.com', { waitUntil: 'domcontentloaded' });

// Wait for chat list
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

await page.waitForTimeout(2000);

const chats = await page.evaluate(() => {
  const results = [];
  const items = document.querySelectorAll('[data-testid="cell-frame-container"]');

  for (const item of items) {
    const badge = item.querySelector('[data-testid="icon-unread-count"]');
    if (!badge) continue;

    const unread = parseInt(badge.textContent.trim(), 10) || 1;
    const nameEl = item.querySelector('[data-testid="cell-frame-title"] span[dir="auto"]');
    const chatName = nameEl?.getAttribute('title') || nameEl?.textContent?.trim() || 'Unknown';
    const msgEl = item.querySelector('span[data-testid="last-msg-status"]');
    const lastMessage = msgEl?.getAttribute('title') || msgEl?.textContent?.trim() || '';
    const tsEl = item.querySelector('[data-testid="cell-frame-primary-detail"] span');
    const timestamp = tsEl?.textContent?.trim() || '';
    const isGroup = !!item.querySelector('[data-icon*="group"]');

    results.push({ chatName, unread, lastMessage, timestamp, type: isGroup ? 'group' : 'dm' });
  }

  return results;
});

await closeSession(browser);

if (chats.length === 0) {
  if (asJson) console.log('[]');
  process.exit(0);
}

if (asJson) {
  console.log(JSON.stringify(chats, null, 2));
} else {
  for (const c of chats) {
    console.log([c.chatName, c.unread, c.lastMessage, c.timestamp, c.type].join('|'));
  }
}
