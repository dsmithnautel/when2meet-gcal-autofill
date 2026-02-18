# When2Meet Google Calendar Autofill

A Chrome extension to automatically fill your [When2Meet](https://www.when2meet.com) availability based on your Google Calendar events.

## Features

- **Google Calendar Integration**: Sign in with your Google account to fetch your busy times.
- **Auto-Selection**: Automatically highlights and selects available slots on the When2Meet grid.
- **Smart Filtering**: Choose which calendars to include or ignore.
- **Two-Step Saving**: Simulates user interaction (clicks) AND sends a direct server request to ensure availability is saved reliably without refreshing.

## How to Install

### Option A: Install from Chrome Web Store (Recommended for Users)
**Note to Developer**: To make this link work for others, the developer must publish the extension to the Chrome Web Store.
> [Link to Chrome Web Store would go here]

### Option B: Load Unpacked (Developer Mode)
Use this method for development or if the extension is not published.

1.  Download or clone this repository.
2.  Open Chrome and go to `chrome://extensions`.
3.  Enable **Developer mode** (toggle in top-right).
4.  Click **Load unpacked** and select the extension folder.
5.  **Important**: You must configure a Google Cloud Project for OAuth to work. See [SETUP.md](SETUP.md) for details.



## Privacy Policy
This extension requests access to your Google Calendar only to identify "busy" times. It does not store your data on any external servers other than communicating directly with When2Meet to highlight your availability.

## License
MIT
