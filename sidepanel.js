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
const reloadButton = document.querySelector("#reloadButton");

const STATUS_COPY = {
  required: {
    label: "Clearance required",
    message: "The job explicitly requires an existing security clearance."
  },
  obtainable: {
    label: "Must be able to obtain clearance",
    message: "The job requires eligibility or the ability to obtain a clearance."
  },
  not_required: {
    label: "Clearance not required",
    message: "The description explicitly says a clearance is not required."
  },
  review: {
    label: "Mentioned — review manually",
    message: "A clearance term appears, but the text does not clearly make it a requirement."
  },
  not_mentioned: {
    label: "No clearance requirement",
    message: "No explicit clearance requirement was found in the selected job description."
  },
  no_job: {
    label: "Open a LinkedIn job",
    message: "Select a job on LinkedIn to check its About the job section."
  },
  loading: {
    label: "Reading job…",
    message: "Waiting for the selected job description to load."
  },
  error: {
    label: "Could not read this job",
    message: "Reload LinkedIn, select a job, and scan again."
  }
};

function setStatus(status, customMessage) {
  const copy = STATUS_COPY[status] || STATUS_COPY.error;
  statusCard.className = `card state-${status.replaceAll("_", "-")}`;
  statusLabel.textContent = copy.label;
  statusMessage.textContent = customMessage || copy.message;
}

function renderResult(result) {
  setStatus(result.status, result.message);

  criticalMatches.replaceChildren();
  if (result.criticalMatches?.length) {
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
    jobTitle.textContent = result.title || "LinkedIn job";
    companyName.textContent = result.company || "";
    jobCard.classList.remove("hidden");
  } else {
    jobCard.classList.add("hidden");
  }

  matchesList.replaceChildren();
  if (result.matches?.length) {
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

async function activeTab() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  return tab;
}

async function sendWithInjection(tab, message) {
  try {
    return await chrome.tabs.sendMessage(tab.id, message);
  } catch (error) {
    if (!tab.url?.startsWith("https://www.linkedin.com/jobs/")) throw error;

    await chrome.scripting.insertCSS({
      target: { tabId: tab.id },
      files: ["linkedin.css"]
    });
    await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      files: ["clearance-detector.js", "content.js"]
    });
    return chrome.tabs.sendMessage(tab.id, message);
  }
}

async function requestScan() {
  refreshButton.disabled = true;
  setStatus("loading");

  try {
    const tab = await activeTab();
    if (!tab?.id || !tab.url?.startsWith("https://www.linkedin.com/jobs/")) {
      renderResult({ status: "no_job", matches: [], criticalMatches: [] });
      return;
    }

    const result = await sendWithInjection(tab, {
      type: "REQUEST_CLEARANCE_SCAN"
    });
    renderResult(result || { status: "error" });
  } catch (error) {
    console.error(error);
    setStatus("error");
  } finally {
    refreshButton.disabled = false;
  }
}

chrome.runtime.onMessage.addListener((message) => {
  if (message?.type === "CLEARANCE_RESULT" && message.result) {
    renderResult(message.result);
  }
});

chrome.tabs.onActivated.addListener(requestScan);
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (tab.active && (changeInfo.status === "complete" || changeInfo.url)) {
    requestScan();
  }
});

refreshButton.addEventListener("click", requestScan);
reloadButton.addEventListener("click", () => chrome.runtime.reload());
requestScan();
