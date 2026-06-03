// Manage Auto-Inject toggle state
let autoInjectEnabled = false;

chrome.runtime.onInstalled.addListener(() => {
  chrome.storage.local.get(['autoInjectEnabled'], (result) => {
    autoInjectEnabled = result.autoInjectEnabled || false;
    updateContextMenu();
  });

  chrome.contextMenus.create({
    id: "toggle-auto-inject",
    title: "Enable Auto-Injection",
    contexts: ["action"]
  });
});

function updateContextMenu() {
  chrome.contextMenus.update("toggle-auto-inject", {
    title: autoInjectEnabled ? "Disable Auto-Injection" : "Enable Auto-Injection"
  });
}

chrome.contextMenus.onClicked.addListener((info, tab) => {
  if (info.menuItemId === "toggle-auto-inject") {
    autoInjectEnabled = !autoInjectEnabled;
    chrome.storage.local.set({ autoInjectEnabled });
    updateContextMenu();
  }
});

// Load state on startup
chrome.startup?.onStartup.addListener(() => {
  chrome.storage.local.get(['autoInjectEnabled'], (result) => {
    autoInjectEnabled = result.autoInjectEnabled || false;
    updateContextMenu();
  });
});

// When icon is clicked, trigger manual fetch
chrome.action.onClicked.addListener((tab) => {
  chrome.tabs.sendMessage(tab.id, { action: "manual_fetch" }).catch(err => {
    console.error("Could not send manual fetch message, is it a recruiting page?", err);
  });
});

// Handle proxy API fetches to bypass CORS
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === "fetch_api") {
    fetch(request.url, request.options || {})
      .then(res => res.json())
      .then(data => sendResponse({ success: true, data }))
      .catch(error => sendResponse({ success: false, error: error.message }));
    return true; // Keep message channel open for async response
  }
  
  if (request.action === "check_auto_inject") {
    chrome.storage.local.get(['autoInjectEnabled'], (result) => {
      sendResponse({ autoInjectEnabled: result.autoInjectEnabled || false });
    });
    return true;
  }
});
