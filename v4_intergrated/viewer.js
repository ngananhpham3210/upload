document.addEventListener('DOMContentLoaded', () => {

    // --- THEME SWITCHER LOGIC ---
    (() => {
        const themeToggle = document.getElementById('theme-toggle');
        const docElement = document.documentElement;

        const applyTheme = (theme) => {
            docElement.setAttribute('data-theme', theme);
        };

        const getInitialTheme = () => {
            const savedTheme = localStorage.getItem('theme');
            if (savedTheme) {
                return savedTheme;
            }
            const prefersDark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
            return prefersDark ? 'dark' : 'light';
        };
        
        const currentTheme = getInitialTheme();
        applyTheme(currentTheme);
        themeToggle.checked = currentTheme === 'dark';

        themeToggle.addEventListener('change', () => {
            const newTheme = themeToggle.checked ? 'dark' : 'light';
            applyTheme(newTheme);
            localStorage.setItem('theme', newTheme);
        });
    })();
    
    // --- CENTRALIZED JAPANESE LANGUAGE CONFIGURATION ---
    const JAPANESE_CONFIG = {
        RANGES: {
            HIRAGANA: '\\u3040-\\u309F',
            KATAKANA: '\\u30A0-\\u30FF',
            KANJI: '\\u4E00-\\u9FAF\\u3400-\\u4DBF', 
            PUNCTUATION: '\\u3000-\\u303F\\uFF00-\\uFFEF',
            COMMON_SYMBOLS: '。、！？「」『』（）【】・〜ー～|｜()　'
        },
        REGEX: {}
    };

    (() => {
        const R = JAPANESE_CONFIG.RANGES;
        const allChars = `${R.HIRAGANA}${R.KATAKANA}${R.KANJI}${R.PUNCTUATION}${R.COMMON_SYMBOLS}`;
        JAPANESE_CONFIG.REGEX = {
            NON_JAPANESE_CHAR: new RegExp(`[^${allChars}\\s]`, 'u'),
            IS_KANJI_ONLY: new RegExp(`^[${R.KANJI}\\s]+$`, 'u'),
            CONTAINS_KANA: new RegExp(`[${R.HIRAGANA}${R.KATAKANA}]`, 'u'),
            SEPARATORS: new RegExp(`[${R.COMMON_SYMBOLS}]`, 'g')
        };
    })();

    // --- GENERIC UTILITIES ---
    const log = (message, logElement) => {
        const p = document.createElement('p');
        p.textContent = message;
        logElement.appendChild(p);
        logElement.scrollTop = logElement.scrollHeight;
    };

    // --- TAB SWITCHING LOGIC ---
    const tabs = document.querySelectorAll('.tab-link');
    const tabContents = document.querySelectorAll('.tab-content');
    tabs.forEach(tab => {
        tab.addEventListener('click', () => {
            tabs.forEach(t => t.classList.remove('active'));
            tabContents.forEach(c => c.classList.remove('active'));
            tab.classList.add('active');
            document.getElementById(tab.dataset.tab + '-tab').classList.add('active');
        });
    });

    // --- TOOL 1: EXTRACTOR ---
    (() => {
        const folderInput = document.getElementById('extractor-folder-input');
        const folderNameDisplay = document.getElementById('extractor-folder-name');
        const processButton = document.getElementById('extractor-process-button');
        const removeKanjiCheckbox = document.getElementById('extractor-remove-kanji');
        const logArea = document.getElementById('extractor-log-area');
        const resultsPanel = document.getElementById('extractor-results-panel');
        const downloadLink = document.getElementById('extractor-download-link');
        const resultPreview = document.getElementById('extractor-result-preview');
        let selectedFiles = [];
        const logger = (message) => log(message, logArea);

        folderInput.addEventListener('change', (event) => {
            selectedFiles = Array.from(event.target.files);
            if (selectedFiles.length > 0) {
                folderNameDisplay.textContent = `${selectedFiles.length} files in folder`;
                processButton.disabled = false;
                logArea.innerHTML = '';
                logger('Folder selected. Click "Process Files" to start.');
            } else {
                folderNameDisplay.textContent = 'No folder selected';
                processButton.disabled = true;
            }
        });

        processButton.addEventListener('click', async () => {
            if (selectedFiles.length === 0) { logger('Error: No files selected.'); return; }
            processButton.disabled = true;
            processButton.textContent = "Processing...";
            logArea.innerHTML = '';
            logger('Processing started...');
            resultsPanel.style.display = 'none';

            const removeKanjiOnly = removeKanjiCheckbox.checked;
            const allJapaneseLines = new Set();
            let totalKanjiOnlyRemoved = 0;
            let initialLineCount = 0;
            const jsonFiles = selectedFiles.filter(file => file.name.endsWith('.json'));
            logger(`Found ${jsonFiles.length} JSON files.`);

            for (const file of jsonFiles) {
                logger(`\n> Processing: ${file.webkitRelativePath}`);
                try {
                    const content = await readFileAsText(file);
                    const data = JSON.parse(content);
                    const fileTextLines = extractTextFromJson(data);
                    let fileJapaneseLines = 0, fileKanjiOnlyRemoved = 0;
                    for (const line of fileTextLines) {
                        if (isPureJapaneseText(line)) {
                             const splitLines = line.split(JAPANESE_CONFIG.REGEX.SEPARATORS).map(l => l.trim()).filter(l => l.length > 1);
                             for (const splitLine of splitLines) {
                                initialLineCount++;
                                if (removeKanjiOnly && JAPANESE_CONFIG.REGEX.IS_KANJI_ONLY.test(splitLine)) {
                                    fileKanjiOnlyRemoved++;
                                } else {
                                    allJapaneseLines.add(splitLine);
                                    fileJapaneseLines++;
                                }
                            }
                        }
                    }
                    totalKanjiOnlyRemoved += fileKanjiOnlyRemoved;
                    logger(`  - Extracted ${fileJapaneseLines} Japanese lines.`);
                    if (removeKanjiOnly && fileKanjiOnlyRemoved > 0) logger(`  - Removed ${fileKanjiOnlyRemoved} kanji-only lines.`);
                } catch (error) { logger(`  - ERROR: ${error.message}`); }
            }
            
            const uniqueJapaneseLines = Array.from(allJapaneseLines);
            logger('\n--- Summary ---');
            logger(`✓ Total unique lines: ${uniqueJapaneseLines.length}`);
            logger(`✓ Removed ${initialLineCount - uniqueJapaneseLines.length} duplicates.`);
            if (removeKanjiOnly) { logger(`✓ Removed a total of ${totalKanjiOnlyRemoved} kanji-only lines.`); }
            logger('✓ Processing complete.');
            
            displayResults(uniqueJapaneseLines);
            processButton.disabled = false;
            processButton.textContent = "Process Files";
        });

        const isPureJapaneseText = (text) => text && text.trim() && !JAPANESE_CONFIG.REGEX.NON_JAPANESE_CHAR.test(text);
        const readFileAsText = (file) => new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => resolve(reader.result);
            reader.onerror = () => reject(reader.error);
            reader.readAsText(file, 'UTF-8');
        });
        const extractTextFromJson = (obj, textLines = []) => {
            if (typeof obj === 'string') {
                obj.split('\n').forEach(line => { if (line.trim()) textLines.push(line.trim()); });
            } else if (Array.isArray(obj)) {
                obj.forEach(item => extractTextFromJson(item, textLines));
            } else if (typeof obj === 'object' && obj !== null) {
                Object.values(obj).forEach(value => extractTextFromJson(value, textLines));
            }
            return textLines;
        };
        const displayResults = (lines) => {
            const resultText = lines.join('\n');
            const blob = new Blob([resultText], { type: 'text/plain;charset=utf-8' });
            const url = URL.createObjectURL(blob);
            downloadLink.href = url;
            resultPreview.value = lines.slice(0, 100).join('\n');
            if (lines.length > 100) { resultPreview.value += `\n\n... and ${lines.length - 100} more lines.`; }
            resultsPanel.style.display = 'block';
        };
    })();

    // --- TOOL 2: CLEANER ---
    (() => {
        const inputText = document.getElementById('cleaner-inputText');
        const sortMode = document.getElementById('cleaner-sort-mode');
        const processButton = document.getElementById('cleaner-process-button');
        const outputText = document.getElementById('cleaner-outputText');
        const copyButton = document.getElementById('cleaner-copy-button');
        const downloadButton = document.getElementById('cleaner-download-button');
        const logArea = document.getElementById('cleaner-log-area');
        const logger = (message) => log(message, logArea);

        processButton.addEventListener('click', () => {
            logArea.innerHTML = '';
            logger("--- Starting Processing ---");
            const rawContent = inputText.value;
            if (!rawContent.trim()) { logger("Error: Input text is empty."); return; }
            logger("Successfully read input text.");
            
            const normalizedContent = rawContent.replace(JAPANESE_CONFIG.REGEX.SEPARATORS, '\n');
            const allLines = normalizedContent.split('\n').map(line => line.trim()).filter(line => line.length > 0);
            logger(`Found ${allLines.length} potential lines after normalization.`);

            const filteredLines = allLines.filter(line => {
                if (line.length <= 1) return false;
                if (JAPANESE_CONFIG.REGEX.IS_KANJI_ONLY.test(line)) return false;
                if (!JAPANESE_CONFIG.REGEX.CONTAINS_KANA.test(line)) return false;
                return true;
            });
            logger(`${filteredLines.length} lines remaining after filtering.`);

            const uniqueLines = [...new Set(filteredLines)];
            logger(`${uniqueLines.length} lines remaining after removing duplicates.`);
            let finalLines = [...uniqueLines];
            logger(`Applying sort mode: '${sortMode.value}'`);

            switch (sortMode.value) {
                case 'alphabetical_asc': finalLines.sort((a, b) => a.localeCompare(b, 'ja')); break;
                case 'alphabetical_desc': finalLines.sort((a, b) => b.localeCompare(a, 'ja')); break;
                case 'length_asc': finalLines.sort((a, b) => a.length - b.length); break;
                case 'length_desc': finalLines.sort((a, b) => b.length - a.length); break;
                case 'random':
                    for (let i = finalLines.length - 1; i > 0; i--) {
                        const j = Math.floor(Math.random() * (i + 1));
                        [finalLines[i], finalLines[j]] = [finalLines[j], finalLines[i]];
                    }
                    break;
            }
            outputText.value = finalLines.join('\n');
            logger("\n--- Processing Complete! ---");
            logger(`Final lines written to output: ${finalLines.length}`);
        });

        copyButton.addEventListener('click', () => {
            if (!outputText.value) return;
            navigator.clipboard.writeText(outputText.value).then(() => {
                const originalText = copyButton.textContent;
                copyButton.textContent = 'Copied!';
                setTimeout(() => { copyButton.textContent = originalText; }, 2000);
            }).catch(err => console.error('Failed to copy text: ', err));
        });

        downloadButton.addEventListener('click', () => {
            if (!outputText.value) return;
            const blob = new Blob([outputText.value], { type: 'text/plain;charset=utf-8' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = 'cleaned_text.txt';
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
        });
    })();
});