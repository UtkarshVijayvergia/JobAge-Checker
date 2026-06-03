# Job Age Checker Chrome Extension

Create a Chrome extension that determines how long ago a job was posted on various recruiting platforms (Greenhouse, Ashby, Lever).

## User Review Required

> [!IMPORTANT]
> Please review the updated plan based on your comments. If this looks good, give me the go-ahead and I will begin coding.

## Open Questions (Resolving Feedback)

1. **The Lever & Click Behavior:** You requested a "lever" (toggle) to switch between auto-injection and manual fetch, and you also requested that clicking the extension icon should directly fetch the date (rather than opening an irritating popup). 
   - *My Proposal:* Since Chrome extensions cannot both open a popup *and* act as a one-click action button simultaneously, I propose we remove the popup entirely. Clicking the extension icon will fetch and display the job age in a non-intrusive on-screen "toast" notification. To toggle the "Auto-Inject" lever, I will add an option to the right-click context menu of the extension icon (e.g., Right-click -> "Enable Auto-Injection"). Let me know if this works!
2. **Python vs. JavaScript:** You mentioned using a virtual environment if I use `pip`. Because we can fetch these APIs directly from the browser background script, we do not need a Python backend at all! It will be a pure JavaScript extension, making it extremely fast. Let me know if you still want a Python environment setup for other reasons.

## Proposed Architecture

We will build a simple, lightweight Chrome Extension (Manifest V3) in `c:\Users\utkar\OneDrive\Desktop\JobAge-Checker`:

### 1. `manifest.json`
Configuration file requesting permissions: `activeTab`, `scripting`, `contextMenus`, `storage` (to remember the lever state), and host permissions for the recruiting APIs.

### 2. Background Script (`background.js`)
- **State Management:** Manages the "Auto-Inject" toggle state using `chrome.storage`.
- **Context Menu:** Registers the right-click toggle for Auto-Injection.
- **Click Listener:** Listens for `chrome.action.onClicked`. When you left-click the extension icon, it signals the content script to fetch and display the date.
- **Tab Updates:** Listens for page loads. If Auto-Injection is ON, it signals the content script to automatically fetch and inject the date badge.

### 3. Content Script (`content.js`)
- Runs in the context of the job page.
- **Parsing:** Cleans the URL (ignoring `?gh_id=...` or `&gh_id=...` parameters) to identify the platform, company name, and job ID.
- **API Fetching:** Calls the respective platform's API (Greenhouse, Ashby, Lever).
- **Time Calculation:** Calculates the difference between now and the posted date, formatting it exactly as: `X days, Y hours, Z minutes`.
- **UI Injection:** Displays the badge on the page (either near the job title if auto-injecting, or as a floating toast notification if clicked manually).

### 4. Platform API Strategies
- **Greenhouse:** Parse URL `boards.greenhouse.io/{company}/jobs/{job_id}` -> Fetch `https://boards-api.greenhouse.io/v1/boards/{company}/jobs/{job_id}` -> Read `updated_at`.
- **Lever:** Parse URL `jobs.lever.co/{company}/{job_id}` -> Fetch `https://api.lever.co/v0/postings/{company}/{job_id}` -> Read `createdAt`.
- **Ashby:** Parse URL `jobs.ashbyhq.com/{company}/{job_id}` -> Fetch `https://api.ashbyhq.com/posting-api/job-board/{company}/posting/{job_id}` -> Read `publishedAt`.

## Verification Plan

### Manual Verification
1. Load the unpacked extension in Chrome.
2. Navigate to a known Greenhouse job posting. Ensure URL parameters are ignored.
3. Test Manual Mode: Click the extension and verify the age is shown as "X days, Y hours, Z minutes" within 30 seconds.
4. Test Auto-Inject Mode: Toggle the right-click context menu option, refresh the page, and verify the badge appears automatically.
5. Repeat for Ashby and Lever.
