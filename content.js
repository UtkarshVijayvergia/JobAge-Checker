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

async function fetchHTML(url) {
  return new Promise((resolve, reject) => {
    chrome.runtime.sendMessage({ action: "fetch_html", url }, response => {
      if (response && response.success) {
        resolve(response.data);
      } else {
        reject(response?.error || 'Unknown error');
      }
    });
  });
}

function parseTimeDifference(dateString) {
  // If the server provides a date without a timezone, it's usually in UTC.
  // JavaScript's new Date() may incorrectly assume it's Local Time, causing it to appear in the future.
  let parseString = dateString;
  const hasTimezone = /(Z|[+-]\d{2}:?\d{2}|UTC|GMT)/i.test(dateString);
  
  if (!hasTimezone) {
    if (!isNaN(new Date(dateString + " UTC").getTime())) {
      parseString = dateString + " UTC";
    } else if (dateString.includes('T')) {
      parseString = dateString + "Z";
    }
  }

  const postedDate = new Date(parseString);
  const now = new Date();
  
  const diffMs = now - postedDate;

  if (isNaN(diffMs)) return "Unknown date";

  // Properly handle formatting if somehow it's genuinely in the future
  const isNegative = diffMs < 0;
  const absDiff = Math.abs(diffMs);

  const diffMins = Math.floor(absDiff / 60000);
  const days = Math.floor(diffMins / 1440);
  const hours = Math.floor((diffMins % 1440) / 60);
  const minutes = diffMins % 60;

  const prefix = isNegative ? "In " : "";
  const suffix = isNegative ? "" : " ago";

  return `${prefix}${days} days, ${hours} hours, ${minutes} minutes${suffix}`;
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
    // 0. Universal Fallbacks
    // A) Google Jobs Schema (ld+json)
    const ldJsonScripts = document.querySelectorAll('script[type="application/ld+json"]');
    for (let script of ldJsonScripts) {
      try {
        const data = JSON.parse(script.textContent);
        
        function findDateInSchema(obj) {
          if (!obj || typeof obj !== 'object') return null;
          if (obj['@type'] === 'JobPosting' && obj.datePosted) return obj.datePosted;
          for (let key of Object.keys(obj)) {
            if (typeof obj[key] === 'object') {
              const res = findDateInSchema(obj[key]);
              if (res) return res;
            }
          }
          return null;
        }

        let date = findDateInSchema(data);
        if (date) {
          jobDate = date;
          recognized = true;
        }
      } catch(e) {}
    }

    // B) Common Meta Tags
    if (!jobDate) {
      const metaDate = document.querySelector('meta[name="datePosted"], meta[name="date_posted"], meta[name="publish_date"], meta[property="article:published_time"], meta[itemprop="datePosted"]');
      if (metaDate && metaDate.content) {
        jobDate = metaDate.content;
      }
    }

    // 1. GREENHOUSE
    if (!jobDate && (hostname.includes("greenhouse.io") || document.querySelector('meta[property="og:url"]')?.content.includes("greenhouse.io"))) {
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
    else if (!jobDate && hostname.includes("lever.co")) {
      recognized = true;
      let parts = pathname.split('/').filter(Boolean);
      if (parts.length >= 2) {
        const company = parts[0];
        const jobId = parts[1];
        
        // Fetch the main job description page HTML, even if we are on /apply
        const jobUrl = `https://jobs.lever.co/${company}/${jobId}`;
        try {
          const html = await fetchHTML(jobUrl);
          // Extract Google Jobs Schema datePosted
          const dateMatch = html.match(/"datePosted"\s*:\s*"([^"]+)"/);
          if (dateMatch && dateMatch[1]) {
            jobDate = dateMatch[1];
          } else {
            // Fallback to API
            const apiUrl = `https://api.lever.co/v0/postings/${company}/${jobId}`;
            const data = await fetchAPI(apiUrl);
            if (data && data.createdAt) jobDate = new Date(data.createdAt).toISOString();
          }
        } catch (e) {
          console.error("Lever HTML/API fetch failed", e);
        }
      }
    } 
    // 3. ASHBY
    else if (!jobDate && (hostname.includes("ashbyhq.com") || document.getElementById('__NEXT_DATA__'))) {
      const nextDataScript = document.getElementById('__NEXT_DATA__');
      
      // Robust Regex search for the date in the NEXT_DATA JSON string
      if (nextDataScript) {
        recognized = true;
        const text = nextDataScript.textContent;
        // Search for "publishedAt":"2023-..." or "createdAt":"..."
        const match = text.match(/"(?:publishedAt|createdAt)":"([^"]+)"/);
        if (match && match[1]) {
          jobDate = match[1];
        }
      }
    } 
    // 4. AMAZON JOBS
    else if (!jobDate && hostname.includes("amazon.jobs")) {
      recognized = true;
      
      // Amazon hides the date on the main page, so we use their public search API!
      const jobIdMatch = pathname.match(/\/jobs\/(\d+)/);
      if (jobIdMatch && jobIdMatch[1]) {
        const jobId = jobIdMatch[1];
        const apiUrl = `https://www.amazon.jobs/en/search.json?query=${jobId}`;
        try {
          const data = await fetchAPI(apiUrl);
          if (data && data.jobs && data.jobs.length > 0) {
             // The search might return multiple jobs if the ID matches a keyword, so we find the exact match
             const job = data.jobs.find(j => j.id_icims === jobId || j.job_path?.includes(jobId)) || data.jobs[0];
             jobDate = job.posted_date || job.updated_time || job.created_at;
          }
        } catch(e) {
          console.error("Amazon API fetch failed", e);
        }
      }

      // Scan the entire page source for embedded JSON variables for dates (Fallback)
      if (!jobDate) {
        const html = document.documentElement.innerHTML;
        const match = html.match(/"(?:date_posted|posted_date|publish_date|datePosted)"\s*:\s*"([^"]+)"/i) ||
                      html.match(/"updated_time"\s*:\s*"([^"]+)"/i) ||
                      html.match(/"posted_date"\s*:\s*"([^"]+)"/i);
        if (match && match[1]) {
          jobDate = match[1];
        }
      }
    }

    if (jobDate) {
      const timeStr = parseTimeDifference(jobDate);
      showBadge(`Posted ${timeStr} ago`);
    } else if (recognized) {
      showBadge("Could not extract job ID or date from this page.");
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
