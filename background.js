async function enableActionClickPanel() {
  try {
    if (!chrome.sidePanel?.setPanelBehavior) {
      console.warn("Bu Chrome sürümü sidePanel davranış API'sini desteklemiyor.");
      return;
    }

    await chrome.sidePanel.setPanelBehavior({
      openPanelOnActionClick: true
    });
  } catch (error) {
    console.error("Side panel ayarlanamadı:", error);
  }
}

chrome.runtime.onInstalled?.addListener(enableActionClickPanel);
chrome.runtime.onStartup?.addListener(enableActionClickPanel);
enableActionClickPanel();
