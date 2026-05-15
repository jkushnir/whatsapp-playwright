# whatsapp-playwright

Read and send WhatsApp messages from the command line — no API key needed.

Uses [Playwright](https://playwright.dev) to automate WhatsApp Web in a headless Chromium browser. You link it once with your phone, and the session is saved so future runs are instant.

## Requirements

- Node.js 18+
- A WhatsApp account

## Setup

```bash
git clone https://github.com/jkushnir/whatsapp-playwright
cd whatsapp-playwright
npm install
npm run install-browsers   # downloads Chromium (~150MB, one-time)
```

## Link your phone (one-time)

```bash
node link.js +19175551234   # use your own number with country code
```

A browser window opens. The script enters your number and displays an 8-character code like `H3X3-YKZ1`. On your phone:

1. Open WhatsApp → **Settings** → **Linked Devices** → **Link a Device**
2. Tap **"Link with phone number instead"**
3. Enter the code

Done. The session is saved to `./session/` and all future runs are headless.

## Usage

### Read unread chats

```bash
node read.js
```

Output (pipe-delimited):
```
School parents|8|Congrats!|10:05|group
Work group|3|See you tomorrow|09:30|group
Mom|1|Call me|08:15|dm
```

Or as JSON:
```bash
node read.js --json
```

### Send a message

```bash
# By phone number
node send.js +19175551234 "Hey, are you free tonight?"

# By chat name (exact match)
node send.js "Mom" "On my way!"
```

## Notes

- The `session/` folder contains your WhatsApp login — keep it private, never commit it.
- WhatsApp limits linked devices to ~4. Check Settings → Linked Devices to manage them.
- If a session expires, just re-run `node link.js +<your_number>`.
