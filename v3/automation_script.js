// This script is injected to run the automation sequence for a prompt.

// Helper function to wait for a specific duration
function wait(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

// Helper function to wait for an element to appear on the page
function waitForElement(selector, timeout = 20000) {
    return new Promise((resolve, reject) => {
        const intervalTime = 500; // Check every 500ms
        const startTime = Date.now();

        console.log(`Waiting for element: ${selector}`);

        const interval = setInterval(() => {
            const element = document.querySelector(selector);
            if (element) {
                console.log(`Element "${selector}" found.`);
                clearInterval(interval);
                resolve(element);
            } else if (Date.now() - startTime > timeout) {
                clearInterval(interval);
                const errorMsg = `Timeout: Element "${selector}" not found within ${timeout / 1000} seconds.`;
                console.error(errorMsg);
                reject(new Error(errorMsg));
            }
        }, intervalTime);
    });
}


// Helper function to dispatch events to simulate user input
function triggerEvents(element) {
    element.dispatchEvent(new Event('input', { bubbles: true }));
    element.dispatchEvent(new Event('change', { bubbles: true }));
}

// Helper function to set a slider's value
function setSliderValue(selector, value) {
    const slider = document.querySelector(selector);
    if (slider) {
        console.log(`Setting slider '${selector}' to ${value}`);
        slider.value = value;
        triggerEvents(slider);
    } else {
        console.error(`Slider with selector '${selector}' not found.`);
    }
}

// Main async function to execute the automation sequence with delays
async function executeSequence(promptText) {
    try {
        console.log("Starting automation sequence...");

        // Wait for the textarea to appear, with a 20-second timeout.
        const textareaSelector = 'ms-text-chunk ms-autosize-textarea textarea';
        const textarea = await waitForElement(textareaSelector, 20000);

        // If we get here, the textarea was found. Proceed with the sequence.
        console.log("Textarea found, proceeding with automation.");

        // Set "Temperature" slider value
        setSliderValue('ms-slider input[type="range"], ms-slider input', 1.2);
        await wait(300);

        // Expand "Safety settings" if not already expanded
        const safetySettings = document.querySelector('ms-prompt-run-settings > div:nth-child(14)');
        if (safetySettings) {
            const header = safetySettings.firstElementChild;
            if (header && !safetySettings.classList.contains('expanded')) {
                console.log("Expanding safety settings...");
                header.click();
            }
        } else {
            console.error("Safety settings container not found.");
        }
        await wait(300);

        // Set "Top-K" slider value (now visible after expansion)
        setSliderValue('ms-prompt-run-settings .advanced-settings ms-slider input', 0.9);
        await wait(300);

        // Set prompt textarea value from the passed-in text
        console.log(`Setting textarea value to: "${promptText}"`);
        textarea.value = promptText;
        triggerEvents(textarea);
        await wait(300);

        // Click the "Run" button
        const runButton = document.querySelector('ms-prompt-input-wrapper run-button button');
        if (runButton) {
            console.log("Clicking run button...");
            runButton.click();
        } else {
            console.error("Run button not found.");
        }
        console.log("Automation sequence finished.");

        // Send completion message back to the background script ONLY on success
        chrome.runtime.sendMessage({ action: 'sequenceComplete' });

    } catch (error) {
        console.error("An error occurred during the automation sequence:", error);
        // If the error is a timeout, reload the page. The script will be re-injected by the background script.
        if (error.message.includes('Timeout: Element')) {
            console.log("Reloading page due to timeout.");
            location.reload();
        } else {
            // For other errors, send completion to avoid getting stuck in an infinite loop.
            console.log("Sending completion message due to non-timeout error to avoid getting stuck.");
            chrome.runtime.sendMessage({ action: 'sequenceComplete' });
        }
    }
}
