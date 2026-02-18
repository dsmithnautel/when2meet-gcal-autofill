# Setup Guide — When2Meet Google Calendar Autofill

## 1. Create a Google Cloud Project

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Click **Select a project** → **New Project**
3. Name it something like `When2Meet Autofill` → click **Create**

## 2. Enable the Google Calendar API

1. In your project, go to **APIs & Services** → **Library**
2. Search for **Google Calendar API**
3. Click it → click **Enable**

## 3. Configure the OAuth Consent Screen

1. Go to **APIs & Services** → **OAuth consent screen**
2. Select **External** user type → click **Create**
3. Fill in:
   - **App name**: `When2Meet Autofill`
   - **User support email**: your email
   - **Developer contact email**: your email
4. Click **Save and Continue** through the remaining steps
5. Under **Test users**, click **Add Users** and add your Google email address

> ⚠️ While the app is in "Testing" mode, only the test users you add can use it. This is fine for personal use.

## 4. Load the Extension in Chrome (to get the Extension ID)

1. Open Chrome and go to `chrome://extensions`
2. Enable **Developer mode** (toggle in top-right)
3. Click **Load unpacked** → select this project folder (`when2meet-gcal-autofill`)
4. Your extension will appear — **copy the Extension ID** (a long string like `abcdefghijklmnopqrstuvwxyz`)

## 5. Create an OAuth Client ID

1. Back in Google Cloud Console, go to **APIs & Services** → **Credentials**
2. Click **+ CREATE CREDENTIALS** → **OAuth client ID**
3. Application type: **Chrome Extension**
4. Name: `When2Meet Autofill`
5. **Item ID**: paste your Extension ID from step 4
6. Click **Create**
7. **Copy the Client ID** (looks like `123456789-xxxxxxxx.apps.googleusercontent.com`)

## 6. Add the Client ID to manifest.json

Open `manifest.json` in this folder and replace:
```json
"client_id": "YOUR_CLIENT_ID_HERE.apps.googleusercontent.com"
```
with your actual Client ID:
```json
"client_id": "123456789-xxxxxxxx.apps.googleusercontent.com"
```

## 7. Reload the Extension

1. Go back to `chrome://extensions`
2. Click the **refresh** button (🔄) on your extension card
3. Click the extension icon (puzzle piece) in your toolbar — you should see the sign-in screen!
   > Note: The extension uses the default icon as image generation was unavailable during setup. You can add your own icons to the `icons/` folder and update `manifest.json` later if desired.

## Usage

1. Navigate to a **When2Meet event page** (e.g., `https://www.when2meet.com/XXXXX`)
2. **Sign in** to your name on the When2Meet event (so the availability grid appears)
3. Click the **extension icon** in your Chrome toolbar
4. **Sign in with Google** (first time only)
5. Choose which calendars to include/ignore
6. Click **✨ Autofill Availability**
7. **Review** the green highlighted slots → click **✓ Confirm** or **✕ Cancel**
