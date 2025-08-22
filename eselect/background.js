// This function creates the context menu item.
chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.create({
    id: "copy-css-selector",
    title: "Copy Full CSS Selector",
    contexts: ["all"] // Show this for any element on the page
  });
});

// This function listens for a click on our context menu item.
chrome.contextMenus.onClicked.addListener((info, tab) => {
  if (info.menuItemId === "copy-css-selector") {
    // When clicked, send a message to the content script in the active tab.
    chrome.tabs.sendMessage(tab.id, {
      action: "getSelector"
    });
  }
});