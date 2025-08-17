document.addEventListener('DOMContentLoaded', () => {
    // --- THEME TOGGLE LOGIC ---
    const themeToggle = document.getElementById('theme-toggle');
    const docElement = document.documentElement;

    // Function to apply theme
    const applyTheme = (theme) => {
        docElement.setAttribute('data-theme', theme);
    };

    // Event listener for the toggle
    themeToggle.addEventListener('change', () => {
        if (themeToggle.checked) {
            applyTheme('dark');
            localStorage.setItem('theme', 'dark');
        } else {
            applyTheme('light');
            localStorage.setItem('theme', 'light');
        }
    });

    // Initial theme setup on load
    const savedTheme = localStorage.getItem('theme');
    const prefersDark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;

    if (savedTheme === 'dark' || (!savedTheme && prefersDark)) {
        themeToggle.checked = true;
        applyTheme('dark');
    } else {
        // Default is 'light'
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

    // --- ORIGINAL APP LOGIC ---
    const fileInput = document.getElementById('file-input');
    const linesPerPromptInput = document.getElementById('lines-per-prompt');
    const wrapperTemplateInput = document.getElementById('wrapper-template');
    const filenameSuffixInput = document.getElementById('filename-suffix');
    const generateButton = document.getElementById('generate-button');
    const promptList = document.getElementById('prompt-list');
    const automateAllButton = document.getElementById('automate-all-button');

    let fileContent = '';

    const defaultWrapper = '```Insert | between component words\n\n{{content}}\n```';
    wrapperTemplateInput.value = defaultWrapper;

    fileInput.addEventListener('change', (event) => {
        const file = event.target.files[0];
        if (!file) {
            fileContent = '';
            return;
        }
        const reader = new FileReader();
        reader.onload = (e) => {
            fileContent = e.target.result;
        };
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

        promptList.innerHTML = ''; // Clear previous list
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

        if (promptsGenerated > 0) {
            automateAllButton.disabled = false;
        } else {
            automateAllButton.disabled = true;
            promptList.innerHTML = '<p class="placeholder">No prompts were generated. Check your file and settings.</p>';
        }
    });
    
    automateAllButton.addEventListener('click', () => {
        const allPromptItems = promptList.querySelectorAll('.prompt-item:not(.processed)');
        const allPrompts = Array.from(allPromptItems).map(item => item.querySelector('button[data-prompt]').dataset.prompt);

        if (allPrompts.length === 0) {
            alert('No remaining prompts to automate!');
            return;
        }

        const filenameSuffix = filenameSuffixInput.value.trim().replace(/[^a-zA-Z0-9_-]/g, '') || '';
        const timeString = getTimeString();
        const filenameQueue = [];

        allPromptItems.forEach(item => {
            const h3 = item.querySelector('h3');
            const promptNumber = h3.textContent.match(/\d+/)[0];

            let filename = `Prompt_${promptNumber}`;
            if (filenameSuffix) {
                filename += `_${filenameSuffix}`;
            }
            filename += `_${timeString}.txt`;
            filenameQueue.push(filename);
        });

        chrome.storage.local.set({ filenameQueue: filenameQueue }, () => {
            console.log('Filename queue saved to storage:', filenameQueue);
            chrome.runtime.sendMessage({
                action: 'startBatchAutomation',
                prompts: allPrompts
            });
            allPromptItems.forEach(item => {
                const button = item.querySelector('button');
                item.classList.add('processed');
                button.textContent = 'Launched ✓';
                button.disabled = true;
            });
            window.close();
        });
    });

    promptList.addEventListener('click', (event) => {
        const button = event.target.closest('button');
        
        if (button) {
            const item = button.closest('.prompt-item');
            if (item && !item.classList.contains('processed')) {
                const promptText = button.dataset.prompt;

                const filenameSuffix = filenameSuffixInput.value.trim().replace(/[^a-zA-Z0-9_-]/g, '') || '';
                const timeString = getTimeString();
                const h3 = item.querySelector('h3');
                const promptNumber = h3.textContent.match(/\d+/)[0];
                
                let filename = `Prompt_${promptNumber}`;
                if (filenameSuffix) {
                    filename += `_${filenameSuffix}`;
                }
                filename += `_${timeString}.txt`;
                
                chrome.storage.local.set({ filenameQueue: [filename] }, () => {
                    chrome.runtime.sendMessage({
                        action: 'startAutomation',
                        prompt: promptText
                    });

                    item.classList.add('processed');
                    button.textContent = 'Launched ✓';
                    button.disabled = true;
                });
            }
        }
    });
});
