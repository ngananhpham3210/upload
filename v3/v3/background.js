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
});

async function processPromptQueue(prompts) {
  for (const prompt of prompts) {
    console.log(`Processing next prompt in batch. ${prompts.length - prompts.indexOf(prompt)} remaining.`);

    const newTab = await chrome.tabs.create({ url: targetUrl, active: true });

    await new Promise(resolve => {
      const listener = async (tabId, changeInfo, tab) => {
        if (tabId === newTab.id && changeInfo.status === 'complete') {
          await injectAndExecute(tabId, prompt);

          const messageListener = (message, sender) => {
              if (message.action === 'sequenceComplete' && sender.tab.id === tabId) {
                  console.log(`Completion signal received from tab ${tabId}.`);
                  chrome.runtime.onMessage.removeListener(messageListener);
                  chrome.tabs.onUpdated.removeListener(listener);
                  resolve();
              }
          };
          chrome.runtime.onMessage.addListener(messageListener);
        }
      };
      chrome.tabs.onUpdated.addListener(listener);
    });
  }

  console.log("Batch automation fully finished.");
}

async function openAndInjectInAITab(promptText) {
  const newTab = await chrome.tabs.create({ url: targetUrl, active: true });

  const listener = (tabId, changeInfo) => {
    if (tabId === newTab.id && changeInfo.status === 'complete') {
      injectAndExecute(tabId, promptText);
      chrome.tabs.onUpdated.removeListener(listener);
    }
  };
  chrome.tabs.onUpdated.addListener(listener);
}

async function injectAndExecute(tabId, prompt) {
  await chrome.scripting.executeScript({
    target: { tabId: tabId },
    files: ['automation_script.js'],
  });
  
  await chrome.scripting.executeScript({
    target: { tabId: tabId },
    func: (promptForTab) => {
      executeSequence(promptForTab);
    },
    args: [prompt]
  });
}
