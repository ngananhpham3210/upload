document.addEventListener('DOMContentLoaded', () => {
    // DOM Element References
    const folderInput = document.getElementById('folder-input');
    const folderNameDisplay = document.getElementById('folder-name');
    const processButton = document.getElementById('process-button');
    const removeKanjiOnlyCheckbox = document.getElementById('remove-kanji-only');
    const logOutput = document.getElementById('log-output');
    const resultsDiv = document.getElementById('results');
    const downloadLink = document.getElementById('download-link');
    const resultPreview = document.getElementById('result-preview');

    let selectedFiles = [];

    // --- Event Listeners ---
    folderInput.addEventListener('change', (event) => {
        selectedFiles = Array.from(event.target.files);
        if (selectedFiles.length > 0) {
            folderNameDisplay.textContent = `${selectedFiles.length} files in folder`;
            processButton.disabled = false;
            log('Folder selected. Click "Process Files" to start.');
        } else {
            folderNameDisplay.textContent = 'No folder selected';
            processButton.disabled = true;
        }
    });

    processButton.addEventListener('click', async () => {
        if (selectedFiles.length === 0) {
            log('Error: No files selected.');
            return;
        }

        processButton.disabled = true;
        processButton.textContent = "Processing...";
        log('Processing started...');
        resultsDiv.style.display = 'none';

        const removeKanjiOnly = removeKanjiOnlyCheckbox.checked;
        const allJapaneseLines = [];
        let totalKanjiOnlyRemoved = 0;
        let totalLinesSplit = 0;

        const jsonFiles = selectedFiles.filter(file => file.name.endsWith('.json'));
        log(`Found ${jsonFiles.length} JSON files.`);

        for (const file of jsonFiles) {
            log(`\nProcessing: ${file.webkitRelativePath}`);
            try {
                const content = await readFileAsText(file);
                const data = JSON.parse(content);
                const fileTextLines = extractTextFromJson(data);
                
                let fileJapaneseLines = [];
                let fileKanjiOnlyRemoved = 0;
                let fileLinesSplit = 0;

                for (const line of fileTextLines) {
                    if (isPureJapaneseText(line) && line.trim().length > 1) {
                        const splitLines = splitOnPunctuation(line);
                        if (splitLines.length > 1) fileLinesSplit++;

                        for (const splitLine of splitLines) {
                            if (splitLine.trim().length > 1) {
                                if (removeKanjiOnly && isKanjiOnlyLine(splitLine)) {
                                    fileKanjiOnlyRemoved++;
                                } else {
                                    fileJapaneseLines.push(splitLine);
                                }
                            }
                        }
                    }
                }
                
                allJapaneseLines.push(...fileJapaneseLines);
                totalKanjiOnlyRemoved += fileKanjiOnlyRemoved;
                totalLinesSplit += fileLinesSplit;
                
                log(`  - Extracted ${fileJapaneseLines.length} Japanese lines.`);
                if (removeKanjiOnly && fileKanjiOnlyRemoved > 0) log(`  - Removed ${fileKanjiOnlyRemoved} kanji-only lines.`);
            } catch (error) {
                log(`  - ERROR: ${error.message}`);
            }
        }
        
        const uniqueJapaneseLines = [...new Set(allJapaneseLines)];
        
        log('\n--- Summary ---');
        log(`✓ Total unique lines: ${uniqueJapaneseLines.length}`);
        log(`✓ Removed ${allJapaneseLines.length - uniqueJapaneseLines.length} duplicates.`);
        if (removeKanjiOnly) {
            log(`✓ Removed a total of ${totalKanjiOnlyRemoved} kanji-only lines.`);
        }
        log('✓ Processing complete.');
        
        displayResults(uniqueJapaneseLines);
        processButton.disabled = false;
        processButton.textContent = "Process Files";
    });

    // --- Helper Functions ---
    const log = (message) => {
        logOutput.textContent += `\n${message}`;
        logOutput.scrollTop = logOutput.scrollHeight; // Auto-scroll to bottom
    };
    
    const readFileAsText = (file) => {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => resolve(reader.result);
            reader.onerror = () => reject(reader.error);
            reader.readAsText(file, 'UTF-8');
        });
    };
    
    const isPureJapaneseText = (text) => {
        if (!text || !text.trim()) return false;
        // This regex tests for any character that is NOT a common Japanese character, CJK punctuation, or whitespace.
        const nonJapaneseRegex = /[^\u3040-\u309F\u30A0-\u30FF\u4E00-\u9FAF\u3400-\u4DBF\u3000-\u303F\uFF00-\uFFEF\s。、！？「」『』（）【】・〜ー～]/u;
        return !nonJapaneseRegex.test(text);
    };
    
    const isKanjiOnlyLine = (text) => {
        // This regex checks if a line consists ONLY of kanji and whitespace.
        const kanjiOnlyRegex = /^[\s\u4E00-\u9FAF\u3400-\u4DBF]+$/u;
        return kanjiOnlyRegex.test(text.trim());
    };

    const extractTextFromJson = (obj, textLines = []) => {
        if (typeof obj === 'string') {
            obj.split('\n').forEach(line => {
                const trimmedLine = line.trim();
                if (trimmedLine) textLines.push(trimmedLine);
            });
        } else if (Array.isArray(obj)) {
            obj.forEach(item => extractTextFromJson(item, textLines));
        } else if (typeof obj === 'object' && obj !== null) {
            Object.values(obj).forEach(value => extractTextFromJson(value, textLines));
        }
        return textLines;
    };
    
    const splitOnPunctuation = (text) => {
        const parts = text.split(/[。、！？・〜ー～]/);
        return parts.map(p => p.trim()).filter(p => p);
    };

    const displayResults = (lines) => {
        const resultText = lines.join('\n');
        
        const blob = new Blob([resultText], { type: 'text/plain;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        downloadLink.href = url;
        
        resultPreview.value = lines.slice(0, 100).join('\n');
        if (lines.length > 100) {
            resultPreview.value += `\n\n... and ${lines.length - 100} more lines.`;
        }
        
        resultsDiv.style.display = 'flex';
    };
});