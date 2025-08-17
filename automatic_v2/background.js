const targetUrl = "https://aistudio.google.com/prompts/new_chat";

chrome.action.onClicked.addListener(async (tab) => {
  const viewerUrl = chrome.runtime.getURL('viewer.html');
  const viewerTabs = await chrome.tabs.query({ url: viewerUrl });
  if (viewerTabs.length > 0) {
      chrome.tabs.update(viewerTabs[0].id, { active: true });
      chrome.windows.update(viewerTabs[0].windowId, { focused: true });
  } else {
      chrome.tabs.create({ url: viewerUrl });
  }
});

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.action === 'startAutomation') {
        openAndInjectInAITab(message.prompt);
    } else if (message.action === 'startBatchAutomation') {
        if (message.prompts && message.prompts.length > 0) {
            processPromptQueue(message.prompts);
        }
    }
    // No need to return true for this new implementation
});

// Processes a queue of prompts sequentially using a robust message-based approach
async function processPromptQueue(prompts) {
  for (const prompt of prompts) {
    console.log(`Processing next prompt in batch. ${prompts.length - prompts.indexOf(prompt)} remaining.`);

    // 1. Create a new tab for this prompt
    const newTab = await chrome.tabs.create({ url: targetUrl, active: true });

    // 2. Wait for the tab to fully load AND for the content script to finish
    await new Promise(resolve => {
      const listener = async (tabId, changeInfo, tab) => {
        if (tabId === newTab.id && changeInfo.status === 'complete') {
          // Tab is loaded, now inject and run the script
          await injectAndExecute(tabId, prompt);

          // Now we wait for a completion message from content.js
          const messageListener = (message, sender) => {
              if (message.action === 'sequenceComplete' && sender.tab.id === tabId) {
                  console.log(`Completion signal received from tab ${tabId}.`);
                  // Clean up both listeners
                  chrome.runtime.onMessage.removeListener(messageListener);
                  chrome.tabs.onUpdated.removeListener(listener);
                  // Resolve the promise to move to the next prompt in the for...of loop
                  resolve();
              }
          };
          chrome.runtime.onMessage.addListener(messageListener);
        }
      };
      chrome.tabs.onUpdated.addListener(listener);
    });

    // Optional: close the tab after it has completed its task
    // await chrome.tabs.remove(newTab.id);
  }

  console.log("Batch automation fully finished.");
}

async function openAndInjectInAITab(promptText) {
  const tabs = await chrome.tabs.query({ url: targetUrl });

  if (tabs.length > 0) {
    const targetTab = tabs[0];
    await chrome.tabs.update(targetTab.id, { active: true });
    await chrome.windows.update(targetTab.windowId, { focused: true });
    await injectAndExecute(targetTab.id, promptText);
  } else {
    const newTab = await chrome.tabs.create({ url: targetUrl });
    chrome.tabs.onUpdated.addListener(function listener(tabId, changeInfo) {
      if (tabId === newTab.id && changeInfo.status === 'complete') {
        injectAndExecute(tabId, promptText);
        chrome.tabs.onUpdated.removeListener(listener);
      }
    });
  }
}

async function injectAndExecute(tabId, prompt) {
  await chrome.scripting.executeScript({
    target: { tabId: tabId },
    files: ['content.js'],
  });
  
  await chrome.scripting.executeScript({
    target: { tabId: tabId },
    func: (promptForTab) => {
      executeSequence(promptForTab);
    },
    args: [prompt]
  });
}
