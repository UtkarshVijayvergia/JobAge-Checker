// Main content script for parsing and fetching job age

async function getAutoInjectState() {
  return new Promise(resolve => {
    chrome.runtime.sendMessage({ action: "check_auto_inject" }, response => {
      resolve(response?.autoInjectEnabled || false);
    });
  });
}

async function fetchAPI(url) {
  return new Promise((resolve, reject) => {
    chrome.runtime.sendMessage({ action: "fetch_api", url }, response => {
      if (response && response.success) {
        resolve(response.data);
      } else {
        reject(response?.error || 'Unknown error');
      }
    });
  });
}

function parseTimeDifference(dateString) {
  const postedDate = new Date(dateString);
  const now = new Date();
  const diffMs = now - postedDate;

  if (isNaN(diffMs)) return "Unknown date";

  const diffMins = Math.floor(diffMs / 60000);
  const days = Math.floor(diffMins / 1440);
  const hours = Math.floor((diffMins % 1440) / 60);
  const minutes = diffMins % 60;

  return `${days} days, ${hours} hours, ${minutes} minutes`;
}

function showBadge(text) {
  let existing = document.getElementById("job-age-checker-badge");
  if (existing) existing.remove();

  const badge = document.createElement("div");
  badge.id = "job-age-checker-badge";
  badge.innerHTML = `<span>🕒 ${text}</span>`;
  document.body.appendChild(badge);

  setTimeout(() => {
    badge.classList.add("fade-out");
    setTimeout(() => badge.remove(), 500);
  }, 15000);
}

async function processJobAge(isManualClick) {
  const url = new URL(window.location.href);
  const hostname = url.hostname;
  const pathname = url.pathname;
  
  let jobDate = null;
  let recognized = false;

  try {
    // 1. GREENHOUSE
    if (hostname.includes("greenhouse.io") || document.querySelector('meta[property="og:url"]')?.content.includes("greenhouse.io")) {
      recognized = true;
      let parts = pathname.split('/').filter(Boolean);
      
      let company = null;
      let jobId = null;

      // Match boards.greenhouse.io/company/jobs/12345
      if (parts.length >= 3 && parts[1] === "jobs") {
        company = parts[0];
        jobId = parts[2];
      } 
      // Match job-boards.greenhouse.io/embed/job_app?for=company&token=12345
      else if (pathname.includes("/embed/job_app")) {
        company = url.searchParams.get("for");
        jobId = url.searchParams.get("token");
      }

      if (company && jobId) {
        const apiUrl = `https://boards-api.greenhouse.io/v1/boards/${company}/jobs/${jobId}`;
        const data = await fetchAPI(apiUrl);
        if (data && data.updated_at) jobDate = data.updated_at;
      }
    } 
    // 2. LEVER
    else if (hostname.includes("lever.co")) {
      recognized = true;
      let parts = pathname.split('/').filter(Boolean);
      if (parts.length >= 2) {
        const company = parts[0];
        const jobId = parts[1];
        const apiUrl = `https://api.lever.co/v0/postings/${company}/${jobId}`;
        const data = await fetchAPI(apiUrl);
        if (data && data.createdAt) jobDate = new Date(data.createdAt).toISOString();
      }
    } 
    // 3. ASHBY
    else {
      // Ashby often uses custom domains, but the page source contains __NEXT_DATA__
      const nextDataScript = document.getElementById('__NEXT_DATA__');
      if (nextDataScript) {
        const nextData = JSON.parse(nextDataScript.textContent);
        const posting = nextData?.props?.pageProps?.jobBoard?.jobPosting;
        if (posting) {
          recognized = true;
          jobDate = posting.publishedAt || posting.createdAt;
        }
      }
    }

    if (jobDate) {
      const timeStr = parseTimeDifference(jobDate);
      showBadge(`Posted ${timeStr} ago`);
    } else if (recognized) {
      showBadge("Could not extract job ID from this page.");
    } else if (isManualClick) {
      // Show warning only if user manually clicked, avoiding spam on auto-inject
      showBadge("Not a recognized job page.");
    }
  } catch (err) {
    console.error("Job Age Checker Error:", err);
    if (isManualClick) showBadge("Error fetching job age.");
  }
}

// Manual trigger via icon click
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === "manual_fetch") {
    processJobAge(true);
    sendResponse({ success: true });
  }
});

// Auto-inject logic on load
async function init() {
  const autoInject = await getAutoInjectState();
  if (autoInject) {
    processJobAge(false);
  }
}

if (document.readyState === "complete" || document.readyState === "interactive") {
  init();
} else {
  window.addEventListener("DOMContentLoaded", init);
}
