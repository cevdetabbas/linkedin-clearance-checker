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
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message?.type !== "RELOAD_EXTENSION") return;

  (async () => {
    const tabId =
      sender.tab?.id ||
      (
        await chrome.tabs.query({
          active: true,
          currentWindow: true
        })
      )[0]?.id;

    if (tabId) {
      await chrome.scripting.executeScript({
        target: { tabId },
        world: "MAIN",
        func: () => {
          setTimeout(() => location.reload(), 1600);
        }
      });
    }

    sendResponse({ ok: true });
    setTimeout(() => chrome.runtime.reload(), 120);
  })().catch((error) => {
    console.error("Could not reload the extension:", error);
    sendResponse({ ok: false, error: error.message });
  });

  return true;
});
enableActionClickPanel();
