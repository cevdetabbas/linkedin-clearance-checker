const statusCard = document.querySelector("#statusCard");
const statusLabel = document.querySelector("#statusLabel");
const statusMessage = document.querySelector("#statusMessage");
const criticalAlert = document.querySelector("#criticalAlert");
const criticalMatches = document.querySelector("#criticalMatches");
const jobCard = document.querySelector("#jobCard");
const jobTitle = document.querySelector("#jobTitle");
const companyName = document.querySelector("#companyName");
const matchesCard = document.querySelector("#matchesCard");
const matchesList = document.querySelector("#matchesList");
const refreshButton = document.querySelector("#refreshButton");

const STATUS_COPY = {
  required: {
    label: "Clearance required",
    message:
      "The listing requires an active or specified level of security clearance."
  },
  obtainable: {
    label: "Must be able to obtain clearance",
    message:
      "Active clearance may not be required initially, but the candidate must be eligible to obtain it."
  },
  not_required: {
    label: "Clearance not required",
    message: "The listing explicitly states that clearance is not required."
  },
  review: {
    label: "Review manually",
    message:
      "The listing mentions clearance or a security review, but the requirement is unclear."
  },
  not_mentioned: {
    label: "Clearance not mentioned",
    message:
      "No known security clearance phrase was found in the job description."
  },
  no_job: {
    label: "Open a LinkedIn job listing",
    message:
      "Open a LinkedIn job listing to see its clearance result here."
  },
  loading: {
    label: "Reading job listing…",
    message: "Scanning the open LinkedIn job description."
  },
  error: {
    label: "Could not read the listing",
    message:
      "Refresh LinkedIn, open a job listing, and click “Scan again”."
  }
};

function setStatus(status, customMessage) {
  const copy = STATUS_COPY[status] || STATUS_COPY.error;
  statusCard.className = `card state-${status.replace("_", "-")}`;
  statusLabel.textContent = copy.label;
  statusMessage.textContent = customMessage || copy.message;
}

function renderResult(result) {
  setStatus(result.status, result.message);

  criticalMatches.replaceChildren();
  if (Array.isArray(result.criticalMatches) && result.criticalMatches.length) {
    for (const match of result.criticalMatches) {
      const item = document.createElement("li");
      item.textContent = match;
      criticalMatches.append(item);
    }
    criticalAlert.classList.remove("hidden");
  } else {
    criticalAlert.classList.add("hidden");
  }

  if (result.title || result.company) {
    jobTitle.textContent = result.title || "LinkedIn job listing";
    companyName.textContent = result.company || "";
    jobCard.classList.remove("hidden");
  } else {
    jobCard.classList.add("hidden");
  }

  matchesList.replaceChildren();
  if (Array.isArray(result.matches) && result.matches.length) {
    for (const match of result.matches) {
      const item = document.createElement("li");
      item.textContent = match;
      matchesList.append(item);
    }
    matchesCard.classList.remove("hidden");
  } else {
    matchesCard.classList.add("hidden");
  }
}

async function getActiveTab() {
  const [tab] = await chrome.tabs.query({
    active: true,
    currentWindow: true
  });
  return tab;
}

async function requestScan() {
  refreshButton.disabled = true;
  setStatus("loading");

  try {
    const tab = await getActiveTab();
    if (!tab?.id || !tab.url?.startsWith("https://www.linkedin.com/jobs/")) {
      renderResult({ status: "no_job", matches: [], criticalMatches: [] });
      return;
    }

    const result = await chrome.tabs.sendMessage(tab.id, {
      type: "REQUEST_CLEARANCE_SCAN"
    });
    result ? renderResult(result) : setStatus("error");
  } catch (error) {
    console.error(error);
    setStatus("error");
  } finally {
    refreshButton.disabled = false;
  }
}

chrome.runtime.onMessage?.addListener((message) => {
  if (message?.type === "CLEARANCE_RESULT" && message.result) {
    renderResult(message.result);
  }
});

chrome.tabs.onActivated?.addListener(requestScan);
chrome.tabs.onUpdated?.addListener((tabId, changeInfo, tab) => {
  if (tab.active && (changeInfo.status === "complete" || changeInfo.url)) {
    requestScan();
  }
});

refreshButton.addEventListener("click", requestScan);
requestScan();
