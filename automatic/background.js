const targetUrl = "https://aistudio.google.com/prompts/new_chat";

// Listen for a click on the extension's action icon (toolbar button).
chrome.action.onClicked.addListener(async (tab) => {
  // Check if a tab with the target URL already exists.
  const tabs = await chrome.tabs.query({ url: targetUrl });

  if (tabs.length > 0) {
    // If a tab exists, focus it and inject the script.
    const targetTab = tabs[0];
    chrome.tabs.update(targetTab.id, { active: true });
    // Make sure the window is focused as well
    chrome.windows.update(targetTab.windowId, { focused: true });
    injectScript(targetTab.id);
  } else {
    // If no such tab exists, create a new one.
    const newTab = await chrome.tabs.create({ url: targetUrl });
    // The script will be injected once the new tab is fully loaded.
    // We use a listener to wait for the 'complete' status.
    chrome.tabs.onUpdated.addListener(function listener(tabId, changeInfo) {
      if (tabId === newTab.id && changeInfo.status === 'complete') {
        // The tab is fully loaded, now we can inject the script.
        injectScript(tabId);
        // Remove this listener to avoid it firing again.
        chrome.tabs.onUpdated.removeListener(listener);
      }
    });
  }
});

// Function to inject the content script into the specified tab.
function injectScript(tabId) {
  chrome.scripting.executeScript({
    target: { tabId: tabId },
    files: ['content.js']
  });
}
