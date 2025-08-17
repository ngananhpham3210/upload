document.addEventListener('DOMContentLoaded', () => {
    // --- THEME TOGGLE LOGIC ---
    const themeToggle = document.getElementById('theme-toggle');
    const docElement = document.documentElement;

    const applyTheme = (theme) => {
        docElement.setAttribute('data-theme', theme);
    };

    themeToggle.addEventListener('change', () => {
        if (themeToggle.checked) {
            applyTheme('dark');
            localStorage.setItem('theme', 'dark');
        } else {
            applyTheme('light');
            localStorage.setItem('theme', 'light');
        }
    });

    const savedTheme = localStorage.getItem('theme');
    const prefersDark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;

    if (savedTheme === 'dark' || (!savedTheme && prefersDark)) {
        themeToggle.checked = true;
        applyTheme('dark');
    } else {
        themeToggle.checked = false;
        applyTheme('light');
    }
    
    // --- UTILITY ---
    function getTimeString() {
        const now = new Date();
        const hours = now.getHours().toString().padStart(2, '0');
        const minutes = now.getMinutes().toString().padStart(2, '0');
        const seconds = now.getSeconds().toString().padStart(2, '0');
        return `${hours}${minutes}${seconds}`;
    }

    // --- DOM ELEMENTS ---
    const fileInput = document.getElementById('file-input');
    const linesPerPromptInput = document.getElementById('lines-per-prompt');
    const wrapperTemplateInput = document.getElementById('wrapper-template');
    const filenameSuffixInput = document.getElementById('filename-suffix');
    const generateButton = document.getElementById('generate-button');
    const promptList = document.getElementById('prompt-list');
    
    const automateAllButton = document.getElementById('automate-all-button');
    const minPromptInput = document.getElementById('min-prompt');
    const maxPromptInput = document.getElementById('max-prompt');
    const automateRangeButton = document.getElementById('automate-range-button');
    const automateSequenceButton = document.getElementById('automate-sequence-button');
    const sequenceSizeInput = document.getElementById('sequence-size');

    let fileContent = '';
    const defaultWrapper = 'Insert pipeline between Japanese component words\n\n{{content}}';
    wrapperTemplateInput.value = defaultWrapper;

    fileInput.addEventListener('change', (event) => {
        const file = event.target.files[0];
        if (!file) {
            fileContent = '';
            return;
        }
        const reader = new FileReader();
        reader.onload = (e) => { fileContent = e.target.result; };
        reader.readAsText(file);
    });

    generateButton.addEventListener('click', () => {
        if (!fileContent) {
            alert('Please select a text file first.');
            return;
        }

        const lines = fileContent.split('\n').filter(line => line.trim() !== '');
        const chunkSize = parseInt(linesPerPromptInput.value, 10);
        const wrapperTemplate = wrapperTemplateInput.value;
        
        if (chunkSize <= 0) {
            alert('Number of lines per prompt must be at least 1.');
            return;
        }

        promptList.innerHTML = '';
        let promptsGenerated = 0;

        for (let i = 0; i < lines.length; i += chunkSize) {
            promptsGenerated++;
            const chunk = lines.slice(i, i + chunkSize);
            const content = chunk.join('\n');
            const finalPrompt = wrapperTemplate.replace('{{content}}', content);
            
            const item = document.createElement('div');
            item.className = 'prompt-item';
            const displayPreview = finalPrompt.replace(/</g, "&lt;").replace(/>/g, "&gt;");
            
            item.innerHTML = `
                <div class="card-content-wrapper">
                    <h3>Prompt ${promptsGenerated}</h3>
                    <div class="prompt-preview">${displayPreview}</div>
                    <div class="prompt-footer">
                         <button data-prompt="${finalPrompt}">Automate This</button>
                    </div>
                </div>
            `;
            promptList.appendChild(item);
        }

        const hasPrompts = promptsGenerated > 0;
        automateAllButton.disabled = !hasPrompts;
        automateRangeButton.disabled = !hasPrompts;
        automateSequenceButton.disabled = !hasPrompts;

        if (!hasPrompts) {
            promptList.innerHTML = '<p class="placeholder">No prompts were generated. Check your file and settings.</p>';
        }
    });

    // --- AUTOMATION LAUNCH LOGIC ---
    function launchAutomationForItems(itemsToProcess) {
        if (!itemsToProcess || itemsToProcess.length === 0) {
            alert('No remaining prompts to automate for this selection!');
            return;
        }

        const promptsToAutomate = itemsToProcess.map(item => item.querySelector('button[data-prompt]').dataset.prompt);
        const filenameSuffix = filenameSuffixInput.value.trim().replace(/[^a-zA-Z0-9_-]/g, '') || '';
        const timeString = getTimeString();
        const filenameQueue = [];

        itemsToProcess.forEach(item => {
            const h3 = item.querySelector('h3');
            const promptNumber = h3.textContent.match(/\d+/)[0];
            let filename = `Prompt_${promptNumber}`;
            if (filenameSuffix) filename += `_${filenameSuffix}`;
            filename += `_${timeString}.txt`;
            filenameQueue.push(filename);
        });

        // Append to existing queue in case of rapid clicks
        chrome.storage.local.get('filenameQueue', (data) => {
            const existingQueue = data.filenameQueue || [];
            const newQueue = existingQueue.concat(filenameQueue);

            chrome.storage.local.set({ filenameQueue: newQueue }, () => {
                console.log('Filename queue updated in storage:', newQueue);
                chrome.runtime.sendMessage({
                    action: 'startBatchAutomation',
                    prompts: promptsToAutomate
                });

                itemsToProcess.forEach(item => {
                    const button = item.querySelector('button');
                    item.classList.add('processed');
                    button.textContent = 'Launched ✓';
                    button.disabled = true;
                });
            });
        });
    }

    automateSequenceButton.addEventListener('click', () => {
        const batchSize = parseInt(sequenceSizeInput.value, 10);
        if (isNaN(batchSize) || batchSize < 1) {
            alert('Please enter a valid sequence size of 1 or more.');
            return;
        }

        const unprocessedItems = document.querySelectorAll('.prompt-item:not(.processed)');
        if (unprocessedItems.length === 0) {
            alert('All prompts have been launched!');
            return;
        }

        const itemsToProcess = Array.from(unprocessedItems).slice(0, batchSize);
        launchAutomationForItems(itemsToProcess);
    });

    automateRangeButton.addEventListener('click', () => {
        const totalPrompts = document.querySelectorAll('.prompt-item').length;
        const min = parseInt(minPromptInput.value, 10);
        const max = parseInt(maxPromptInput.value, 10);

        if (isNaN(min) || isNaN(max)) {
            alert('Please enter valid numbers for Min and Max.');
            return;
        }
        if (min < 1 || max > totalPrompts || min > max) {
            alert(`Invalid range. Please ensure:\n- Min is at least 1\n- Max is no more than ${totalPrompts}\n- Min is not greater than Max`);
            return;
        }

        const itemsToProcess = Array.from(document.querySelectorAll('.prompt-item:not(.processed)'))
            .filter(item => {
                const promptNumber = parseInt(item.querySelector('h3').textContent.match(/\d+/)[0], 10);
                return promptNumber >= min && promptNumber <= max;
            });

        launchAutomationForItems(itemsToProcess);
        minPromptInput.value = '';
        maxPromptInput.value = '';
    });
    
    automateAllButton.addEventListener('click', () => {
        const allPromptItems = document.querySelectorAll('.prompt-item:not(.processed)');
        launchAutomationForItems(Array.from(allPromptItems));
        // Only the "Automate All" button should close the viewer window
        setTimeout(() => window.close(), 300); 
    });

    promptList.addEventListener('click', (event) => {
        const button = event.target.closest('button');
        if (button) {
            const item = button.closest('.prompt-item');
            if (item && !item.classList.contains('processed')) {
                // This is for a single prompt, so we don't use the batch launcher
                const promptText = button.dataset.prompt;
                const filenameSuffix = filenameSuffixInput.value.trim().replace(/[^a-zA-Z0-9_-]/g, '') || '';
                const timeString = getTimeString();
                const promptNumber = item.querySelector('h3').textContent.match(/\d+/)[0];
                
                let filename = `Prompt_${promptNumber}`;
                if (filenameSuffix) filename += `_${filenameSuffix}`;
                filename += `_${timeString}.txt`;
                
                chrome.storage.local.set({ filenameQueue: [filename] }, () => {
                    chrome.runtime.sendMessage({ action: 'startAutomation', prompt: promptText });
                    item.classList.add('processed');
                    button.textContent = 'Launched ✓';
                    button.disabled = true;
                });
            }
        }
    });
});
