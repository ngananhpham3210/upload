// Listen for when the user clicks on the extension's action icon
chrome.action.onClicked.addListener((tab) => {
  // Create a new tab with the viewer.html page
  chrome.tabs.create({
    url: chrome.runtime.getURL('viewer.html')
  });
});