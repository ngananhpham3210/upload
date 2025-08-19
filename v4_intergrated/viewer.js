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
    
    const readFileAsText = (file) => new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result);
        reader.onerror = () => reject(reader.error);
        reader.readAsText(file, 'UTF-8');
    });

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
    
    // --- TOOL 3: DUPLICATES REMOVAL ---
    (() => {
        const sourceFolderInput = document.getElementById('duplicates-source-folder-input');
        const sourceFolderName = document.getElementById('duplicates-source-folder-name');
        const largeFileInput = document.getElementById('duplicates-large-file-input');
        const largeFileName = document.getElementById('duplicates-large-file-name');
        const processButton = document.getElementById('duplicates-process-button');
        const logArea = document.getElementById('duplicates-log-area');
        const resultsPanel = document.getElementById('duplicates-results-panel');
        const downloadLink = document.getElementById('duplicates-download-link');
        const resultPreview = document.getElementById('duplicates-result-preview');
        const logger = (message) => log(message, logArea);
        let sourceFiles = [];
        let largeFile = null;

        const checkInputs = () => {
            processButton.disabled = !(sourceFiles.length > 0 && largeFile);
        };
        const processLine = (line) => {
            let processed = line.trim();
            if (processed.includes('->')) {
                const parts = processed.split('->');
                processed = parts[parts.length - 1].trim();
            }
            processed = processed.replace(/\s*\|\s*/g, '');
            return processed;
        };
        sourceFolderInput.addEventListener('change', (event) => {
            sourceFiles = Array.from(event.target.files).filter(f => f.name.endsWith('.txt'));
            if (sourceFiles.length > 0) {
                sourceFolderName.textContent = `${sourceFiles.length} .txt files selected`;
            } else {
                sourceFolderName.textContent = 'No .txt files found in folder';
            }
            checkInputs();
        });
        largeFileInput.addEventListener('change', (event) => {
            if (event.target.files.length > 0) {
                largeFile = event.target.files[0];
                largeFileName.textContent = largeFile.name;
            } else {
                largeFile = null;
                largeFileName.textContent = 'No file selected';
            }
            checkInputs();
        });
        processButton.addEventListener('click', async () => {
            processButton.disabled = true;
            processButton.textContent = 'Processing...';
            logArea.innerHTML = '';
            resultsPanel.style.display = 'none';
            logger('--- Stage 1: Building removal set from source files ---');
            const removalSet = new Set();
            try {
                for (const file of sourceFiles) {
                    logger(`Reading source file: ${file.name}`);
                    const content = await readFileAsText(file);
                    const lines = content.split('\n');
                    for (const line of lines) {
                        const processed = processLine(line);
                        if (processed) {
                            removalSet.add(processed);
                        }
                    }
                }
                logger(`Found ${removalSet.size} unique lines to use for de-duplication.\n`);
            } catch (error) {
                logger(`ERROR reading source files: ${error.message}`);
                processButton.disabled = false;
                processButton.textContent = 'Process and Clean';
                return;
            }
            logger(`--- Stage 2: Cleaning '${largeFile.name}' ---`);
            let linesRead = 0;
            let linesWritten = 0;
            const keptLines = [];
            try {
                const largeFileContent = await readFileAsText(largeFile);
                const originalLines = largeFileContent.split('\n');
                linesRead = originalLines.length;
                for (const originalLine of originalLines) {
                    const processed = processLine(originalLine);
                    if (!removalSet.has(processed)) {
                        keptLines.push(originalLine);
                        linesWritten++;
                    }
                }
            } catch (error) {
                logger(`ERROR processing large file: ${error.message}`);
                processButton.disabled = false;
                processButton.textContent = 'Process and Clean';
                return;
            }
            const resultText = keptLines.join('\n');
            const blob = new Blob([resultText], { type: 'text/plain;charset=utf-8' });
            const url = URL.createObjectURL(blob);
            downloadLink.href = url;
            downloadLink.download = `${largeFile.name.replace('.txt', '')}_cleaned.txt`;
            resultPreview.value = keptLines.slice(0, 200).join('\n');
            if (keptLines.length > 200) {
                resultPreview.value += `\n\n... and ${keptLines.length - 200} more lines.`;
            }
            resultsPanel.style.display = 'block';
            const linesRemoved = linesRead - linesWritten;
            logger('\n--- Summary ---');
            logger(`Processing complete.`);
            logger(`Total lines read from '${largeFile.name}': ${linesRead}`);
            logger(`Lines written to output: ${linesWritten}`);
            logger(`Lines removed: ${linesRemoved}`);
            processButton.disabled = false;
            processButton.textContent = 'Process and Clean';
        });

    })();
    
    // --- TOOL 4: JSON PROCESSOR (NEW LOGIC) ---
    (() => {
        // --- DOM Elements ---
        const folderInput = document.getElementById('processor-folder-input');
        const folderName = document.getElementById('processor-folder-name');
        const processButton = document.getElementById('processor-process-button');
        const logArea = document.getElementById('processor-log-area');
        const resultsPanel = document.getElementById('processor-results-panel');
        const downloadLinks = {
            same: document.getElementById('processor-download-same'),
            different: document.getElementById('processor-download-different'),
            keys: document.getElementById('processor-download-keys'),
            values: document.getElementById('processor-download-values'),
            modified: document.getElementById('processor-download-modified'),
        };
        const logger = (message) => log(message, logArea);

        // --- State ---
        let selectedFiles = [];

        // --- Event Listeners ---
        folderInput.addEventListener('change', (event) => {
            selectedFiles = Array.from(event.target.files).filter(f => f.name.endsWith('.txt'));
            if (selectedFiles.length > 0) {
                folderName.textContent = `${selectedFiles.length} .txt files selected`;
                processButton.disabled = false;
            } else {
                folderName.textContent = 'No .txt files found in folder';
                processButton.disabled = true;
            }
        });
        
        processButton.addEventListener('click', async () => {
            processButton.disabled = true;
            processButton.textContent = 'Processing...';
            logArea.innerHTML = '';
            resultsPanel.style.display = 'none';

            // --- Stage 1: Extract JSON from all files ---
            logger('--- Stage 1: Extracting JSON from source files ---');
            let allExtractedJson = [];
            let filesWithoutJson = [];
            for(const file of selectedFiles) {
                logger(`> Processing file: ${file.name}`);
                try {
                    const content = await readFileAsText(file);
                    const extracted = findAndExtractJson(content);
                    if (extracted.length > 0) {
                        allExtractedJson.push(...extracted);
                        logger(`  ✅ Extracted ${extracted.length} JSON object(s).`);
                    } else {
                        filesWithoutJson.push(file.name);
                        logger(`  - No valid JSON objects found.`);
                    }
                } catch (error) {
                    logger(`  ❌ ERROR processing ${file.name}: ${error.message}`);
                }
            }
            logger('\n--- Stage 1 Summary ---');
            logger(`Processed ${selectedFiles.length} files.`);
            logger(`Extracted a total of ${allExtractedJson.length} JSON objects.`);
            if (filesWithoutJson.length > 0) {
                logger(`Files without JSON (${filesWithoutJson.length}): ${filesWithoutJson.join(', ')}`);
            }
            
            // --- Stage 2: Process extracted JSON ---
            logger('\n--- Stage 2: Comparing keys and values ---');
            const samePairs = new Map();
            const differentPairs = new Map();

            for (const jsonObj of allExtractedJson) {
                if (typeof jsonObj !== 'object' || jsonObj === null || Array.isArray(jsonObj)) continue;
                
                for(const [key, value] of Object.entries(jsonObj)) {
                    const combinedValueStr = combineValueToString(value);
                    const outputLine = `"${key}": ${JSON.stringify(value)}`;
                    
                    if (key === combinedValueStr || key.replace(/\s+/g, '') === combinedValueStr) {
                        if (!samePairs.has(outputLine)) samePairs.set(outputLine, { key, value });
                    } else {
                        if (!differentPairs.has(outputLine)) differentPairs.set(outputLine, { key, value });
                    }
                }
            }
            logger(`Found ${samePairs.size} unique 'same' key-value pairs.`);
            logger(`Found ${differentPairs.size} unique 'different' key-value pairs.`);

            // --- Stage 3: Split 'same' file results ---
            logger(`\n--- Stage 3: Splitting 'same' pairs ---`);
            const keysOutput = [];
            const valuesOutput = [];
            const modifiedValuesOutput = [];

            for (const { key, value } of samePairs.values()) {
                keysOutput.push(key);
                valuesOutput.push(JSON.stringify(value));
                if (Array.isArray(value)) {
                    value.forEach(item => modifiedValuesOutput.push(String(item)));
                } else {
                    modifiedValuesOutput.push(String(value));
                }
            }
            logger(`Generated ${keysOutput.length} keys.`);
            logger(`Generated ${valuesOutput.length} value entries.`);
            logger(`Generated ${modifiedValuesOutput.length} modified value lines.`);
            
            // --- Final Step: Create download links ---
            createDownload('same.txt', [...samePairs.keys()].sort(), downloadLinks.same);
            createDownload('different.txt', [...differentPairs.keys()].sort(), downloadLinks.different);
            createDownload('keys', keysOutput, downloadLinks.keys);
            createDownload('values', valuesOutput, downloadLinks.values);
            createDownload('value_modified.txt', modifiedValuesOutput, downloadLinks.modified);
            
            resultsPanel.style.display = 'block';
            processButton.disabled = false;
            processButton.textContent = 'Extract & Process JSON';
            logger('\n--- Processing Complete! ---');
        });
        
        // --- Helper Functions for this tool ---
        const findAndExtractJson = (content) => {
            const results = [];
            let searchPos = 0;
            while (true) {
                const start = content.indexOf('{', searchPos);
                if (start === -1) break;

                let braceLevel = 1;
                let end = -1;
                for (let i = start + 1; i < content.length; i++) {
                    if (content[i] === '{') braceLevel++;
                    else if (content[i] === '}') braceLevel--;
                    if (braceLevel === 0) {
                        end = i + 1;
                        break;
                    }
                }

                if (end !== -1) {
                    const potentialJson = content.substring(start, end);
                    try {
                        results.push(JSON.parse(potentialJson));
                        searchPos = end;
                    } catch (e) {
                        searchPos = start + 1; // Invalid JSON, move one char forward
                    }
                } else {
                    break; // Unmatched brace, stop searching
                }
            }
            return results;
        };

        const combineValueToString = (value) => {
            if (typeof value === 'string') return value;
            if (value === null || typeof value === 'number' || typeof value === 'boolean') return String(value);
            if (Array.isArray(value)) return value.map(combineValueToString).join('');
            if (typeof value === 'object') return Object.values(value).map(combineValueToString).join('');
            return '';
        };

        const createDownload = (filename, linesArray, linkElement) => {
            const text = linesArray.join('\n');
            const blob = new Blob([text], { type: 'text/plain;charset=utf-8' });
            const url = URL.createObjectURL(blob);
            linkElement.href = url;
            linkElement.download = filename;
        };

    })();
});