# Job Age Checker Walkthrough

The Job Age Checker Chrome Extension has been successfully built and initialized in your workspace!

## What was Accomplished

- **Project Initialization:** Created the workspace at `c:\Users\utkar\OneDrive\Desktop\JobAge-Checker` and initialized a Git repository.
- **Pure JavaScript Extension:** The extension is entirely client-side, making it extremely fast without needing a Python backend.
- **Manifest Setup:** Created `manifest.json` with host permissions limited *only* to the specific recruiting domains (`boards.greenhouse.io`, `jobs.lever.co`, `jobs.ashbyhq.com`), so it won't interfere with your normal browsing.
- **Background Service Worker:** Created `background.js` to securely proxy API calls around CORS restrictions, listen to the extension icon clicks, and manage the toggle state via the Chrome storage and Context Menus.
- **Content Script:** Created `content.js` to parse URLs (ignoring query parameters like `?gh_id=`), dynamically fetch from APIs (Greenhouse/Lever) or page metadata (Ashby's `__NEXT_DATA__`), and calculate the precise `X days, Y hours, Z minutes` difference.
- **Aesthetic Toast UI:** Created `styles.css` for a sleek, dark-themed, and non-intrusive toast notification that slides in at the bottom right and automatically fades out after 15 seconds.

## How to Install and Test

Since this is an unpacked extension, you'll need to load it into Chrome manually:

1. Open Google Chrome and navigate to `chrome://extensions/`.
2. Turn on **"Developer mode"** (toggle in the top right corner).
3. Click **"Load unpacked"** in the top left.
4. Select the `JobAge-Checker` folder on your desktop: `c:\Users\utkar\OneDrive\Desktop\JobAge-Checker`.

## Usage Guide

- **Manual Fetch:** Navigate to a supported job posting (e.g., `boards.greenhouse.io/...`). Left-click the extension icon in your Chrome toolbar. A toast notification will pop up in the bottom right corner showing exactly how long ago the job was posted!
- **Auto-Inject Toggle:** Right-click the extension icon and click **"Enable Auto-Injection"**. Now, whenever you open a job posting on supported sites, the date badge will automatically appear without you needing to click anything. Right-click again to disable it!
