document.addEventListener('DOMContentLoaded', () => {
    // --- Get references to HTML elements ---
    const inputText = document.getElementById('inputText');
    const sortMode = document.getElementById('sortMode');
    const processButton = document.getElementById('processButton');
    const outputText = document.getElementById('outputText');
    const copyButton = document.getElementById('copyButton');
    const downloadButton = document.getElementById('downloadButton');
    const logArea = document.getElementById('logArea');

    // --- Logger Function ---
    const log = (message) => {
        const p = document.createElement('p');
        p.textContent = `> ${message}`;
        logArea.appendChild(p);
        logArea.scrollTop = logArea.scrollHeight; // Auto-scroll to bottom
    };

    // --- Helper Functions (Translated from Python) ---
    const isOnlyKanji = (line) => {
        if (!line) return false;
        // CJK Unified Ideographs range: U+4E00 to U+9FFF
        const kanjiRegex = /^[\u4e00-\u9fff]+$/;
        return kanjiRegex.test(line);
    };

    const containsKana = (line) => {
        // Hiragana (U+3040-U+309F) or Katakana (U+30A0-U+30FF)
        const kanaRegex = /[\u3040-\u309f\u30a0-\u30ff]/;
        return kanaRegex.test(line);
    };
    
    // --- Main Processing Logic ---
    processButton.addEventListener('click', () => {
        logArea.innerHTML = ''; // Clear previous logs
        log("--- Starting Processing ---");
        
        // === Phase 1: Ingestion & Normalization ===
        const rawContent = inputText.value;
        if (!rawContent.trim()) {
            log("Error: Input text is empty.");
            return;
        }
        log("Successfully read input text.");
        
        const specialCharsRegex = /[|｜「」『』【】（）()、。・　？！～〜]/g;
        const normalizedContent = rawContent.replace(specialCharsRegex, '\n');
        
        const allLines = normalizedContent.split('\n')
            .map(line => line.trim())
            .filter(line => line.length > 0);
        log(`Found ${allLines.length} potential lines after normalization.`);

        // === Phase 2: Filtering ===
        const filteredLines = allLines.filter(line => {
            if (line.length === 1) return false;
            if (isOnlyKanji(line)) return false;
            if (!containsKana(line)) return false;
            return true;
        });
        log(`${filteredLines.length} lines remaining after filtering.`);

        // === Phase 3: Deduplication ===
        const uniqueLines = [...new Set(filteredLines)];
        log(`${uniqueLines.length} lines remaining after removing duplicates.`);

        // === Phase 4: Sorting ===
        const selectedSortMode = sortMode.value;
        let finalLines = [];
        log(`Applying sort mode: '${selectedSortMode}'`);

        switch (selectedSortMode) {
            case 'alphabetical_asc':
                finalLines = [...uniqueLines].sort((a, b) => a.localeCompare(b, 'ja'));
                log("Lines sorted alphabetically (A-Z).");
                break;
            case 'alphabetical_desc':
                finalLines = [...uniqueLines].sort((a, b) => b.localeCompare(a, 'ja'));
                log("Lines sorted in reverse alphabetical order (Z-A).");
                break;
            case 'length_asc':
                finalLines = [...uniqueLines].sort((a, b) => a.length - b.length);
                log("Lines sorted by length (shortest first).");
                break;
            case 'length_desc':
                finalLines = [...uniqueLines].sort((a, b) => b.length - a.length);
                log("Lines sorted by length (longest first).");
                break;
            case 'random':
                // Fisher-Yates shuffle algorithm
                finalLines = [...uniqueLines];
                for (let i = finalLines.length - 1; i > 0; i--) {
                    const j = Math.floor(Math.random() * (i + 1));
                    [finalLines[i], finalLines[j]] = [finalLines[j], finalLines[i]];
                }
                log("Lines sorted in random order.");
                break;
            case 'none':
            default:
                finalLines = uniqueLines;
                log("No sorting applied.");
                break;
        }

        // === Phase 5: Output ===
        outputText.value = finalLines.join('\n');
        log("\n--- Processing Complete! ---");
        log(`Final lines written to output: ${finalLines.length}`);
    });

    // --- Extra UI Functionality ---
    copyButton.addEventListener('click', () => {
        if (!outputText.value) return;
        navigator.clipboard.writeText(outputText.value).then(() => {
            const originalText = copyButton.textContent;
            copyButton.textContent = 'Copied!';
            setTimeout(() => { copyButton.textContent = originalText; }, 2000);
        }).catch(err => {
            console.error('Failed to copy text: ', err);
        });
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
});