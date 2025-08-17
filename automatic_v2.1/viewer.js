document.addEventListener('DOMContentLoaded', () => {
    const fileInput = document.getElementById('file-input');
    const linesPerPromptInput = document.getElementById('lines-per-prompt');
    const wrapperTemplateInput = document.getElementById('wrapper-template');
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
        const allPromptButtons = promptList.querySelectorAll('.prompt-item:not(.processed) button[data-prompt]');
        const allPrompts = Array.from(allPromptButtons).map(button => button.dataset.prompt);
        
        if (allPrompts.length > 0) {
             chrome.runtime.sendMessage({
                action: 'startBatchAutomation',
                prompts: allPrompts
            });
            // Mark all items as processed and update their UI
            allPromptButtons.forEach(button => {
                button.closest('.prompt-item').classList.add('processed');
                button.textContent = 'Launched ✓';
                button.disabled = true;
            });
            window.close();
        } else {
            alert('No remaining prompts to automate!');
        }
    });

    promptList.addEventListener('click', (event) => {
        const button = event.target.closest('button');
        
        if (button) {
            const item = button.closest('.prompt-item');
            if (item && !item.classList.contains('processed')) {
                const promptText = button.dataset.prompt;
                chrome.runtime.sendMessage({
                    action: 'startAutomation',
                    prompt: promptText
                });

                item.classList.add('processed');
                // *** NEW: Better user feedback on click ***
                button.textContent = 'Launched ✓';
                button.disabled = true;
            }
        }
    });
});
