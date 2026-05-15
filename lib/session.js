/**
 * session.js — persistent Chromium session manager
 *
 * Saves the browser profile to disk so you only need to link once.
 * First run: opens a visible browser window for linking.
 * Subsequent runs: headless, reuses the saved session.
 */

import { chromium } from 'playwright';
import { existsSync, mkdirSync } from 'fs';
import { join } from 'path';

const SESSION_DIR = join(import.meta.dirname, '..', 'session');

export async function getSession() {
  const isNew = !existsSync(SESSION_DIR);
  if (isNew) mkdirSync(SESSION_DIR, { recursive: true });

  const browser = await chromium.launchPersistentContext(SESSION_DIR, {
    headless: !isNew,
    viewport: isNew ? { width: 1280, height: 900 } : null,
    userAgent:
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 '
      + '(KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    args: ['--disable-blink-features=AutomationControlled'],
    ignoreDefaultArgs: ['--enable-automation'],
    locale: 'en-US',
  });

  return { browser, isNew };
}

export async function closeSession(browser) {
  try { await browser.close(); } catch (_) {}
}
