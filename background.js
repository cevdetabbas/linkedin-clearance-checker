async function enableActionClickPanel() {
  try {
    if (!chrome.sidePanel?.setPanelBehavior) {
      console.warn("This Chrome version does not support the side panel behavior API.");
      return;
    }

    await chrome.sidePanel.setPanelBehavior({
      openPanelOnActionClick: true
    });
  } catch (error) {
    console.error("Could not configure the side panel:", error);
  }
}

chrome.runtime.onInstalled?.addListener(enableActionClickPanel);
chrome.runtime.onStartup?.addListener(enableActionClickPanel);
enableActionClickPanel();
