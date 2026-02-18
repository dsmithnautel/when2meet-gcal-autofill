# Installation Instructions

## Load the Extension in Chrome

1. Open Chrome and go to: `chrome://extensions/`

2. **Enable "Developer mode"** (toggle in top-right corner)

3. Click **"Load unpacked"**

4. Select this folder: `c:\Users\Derek\vscode projects\when2meet-gcal-autofill`

5. The extension should now appear in your extensions list

## Test if Extension Loaded

1. Go to any When2Meet event (e.g., https://www.when2meet.com/)2. Open DevTools Console (F12)
3. **Type this in the filter box**: `When2Meet`
4. **Refresh the page** (Ctrl+Shift+R)
5. You should see: `When2Meet Autofill: Injected script loaded in MAIN world`

## If You Don't See Extension Logs

The extension isn't loading properly. Check:

- Is the extension enabled in `chrome://extensions/`?
- Are there any errors shown for the extension in `chrome://extensions/`?
- Did you hard-refresh the When2Meet page after loading the extension?

## Current Issue to Debug

The extension logs aren't appearing in console, which means the `injected.js` script isn't running. Once we see the logs, we can fix the event ID detection and complete the save mechanism.
