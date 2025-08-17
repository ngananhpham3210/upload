// This script is injected into the aistudio.google.com page
// and contains the functions for the automation sequence.

// Helper function to wait
function wait(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
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
        const textarea = document.querySelector('ms-text-chunk ms-autosize-textarea textarea');
        if (textarea) {
            console.log(`Setting textarea value to: "${promptText}"`);
            textarea.value = promptText;
            triggerEvents(textarea);
        } else {
            console.error("Prompt textarea not found.");
        }
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

    } catch (error) {
        console.error("An error occurred during the automation sequence:", error);
    } finally {
        // *** NEW: Send completion message back to the background script ***
        // This message is sent whether the sequence succeeded or failed.
        chrome.runtime.sendMessage({ action: 'sequenceComplete' });
    }
}
