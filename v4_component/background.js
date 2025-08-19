// This script runs in the background.
// It listens for a click on the extension's icon.
chrome.action.onClicked.addListener((tab) => {
  // When the icon is clicked, open the viewer.html page in a new tab.
  chrome.tabs.create({
    url: chrome.runtime.getURL('viewer.html')
  });
});