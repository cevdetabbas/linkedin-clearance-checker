const ICON_SIZES = [16, 32, 48, 128];
const CLEARANCE_STATUSES = new Set(["required", "obtainable"]);

function drawIcon(size, hasClearance) {
  const canvas = new OffscreenCanvas(size, size);
  const context = canvas.getContext("2d");
  const scale = size / 128;

  context.clearRect(0, 0, size, size);

  context.beginPath();
  context.arc(size / 2, size / 2, 56 * scale, 0, Math.PI * 2);
  context.fillStyle = hasClearance ? "#dc2626" : "#0a66c2";
  context.fill();

  if (hasClearance) {
    context.lineWidth = Math.max(1, 5 * scale);
    context.strokeStyle = "#7f1d1d";
    context.stroke();
  }

  context.fillStyle = "#ffffff";
  context.font = `800 ${Math.round(76 * scale)}px Arial, sans-serif`;
  context.textAlign = "center";
  context.textBaseline = "middle";
  context.fillText("L", size / 2, size / 2 + 3 * scale);

  return context.getImageData(0, 0, size, size);
}

function iconSet(hasClearance) {
  return Object.fromEntries(
    ICON_SIZES.map((size) => [size, drawIcon(size, hasClearance)])
  );
}

async function setClearanceIcon(tabId, hasClearance) {
  const options = {
    imageData: iconSet(hasClearance)
  };
  if (Number.isInteger(tabId)) {
    options.tabId = tabId;
  }

  await chrome.action.setIcon(options);

  if (Number.isInteger(tabId)) {
    await chrome.action.setTitle({
      tabId,
      title: hasClearance
        ? "Clearance required — open Clearance Check"
        : "Open Clearance Check"
    });
  }
}

async function configureExtension() {
  try {
    await chrome.sidePanel.setPanelBehavior({
      openPanelOnActionClick: true
    });
    await setClearanceIcon(undefined, false);
  } catch (error) {
    console.error("Could not configure the extension:", error);
  }
}

chrome.runtime.onMessage.addListener((message, sender) => {
  if (message?.type !== "CLEARANCE_RESULT" || !sender.tab?.id) {
    return;
  }

  const hasClearance = CLEARANCE_STATUSES.has(message.result?.status);
  setClearanceIcon(sender.tab.id, hasClearance).catch((error) => {
    console.error("Could not update the clearance icon:", error);
  });
});

chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (
    changeInfo.url &&
    !tab.url?.startsWith("https://www.linkedin.com/jobs/")
  ) {
    setClearanceIcon(tabId, false).catch(() => {});
  }
});

chrome.runtime.onInstalled.addListener(configureExtension);
chrome.runtime.onStartup.addListener(configureExtension);
configureExtension();
