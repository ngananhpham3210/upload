// This script is injected via the manifest to add the download button.

// --- 0. HELPERS ---
function getTimeString() {
    const now = new Date();
    const hours = now.getHours().toString().padStart(2, '0');
    const minutes = now.getMinutes().toString().padStart(2, '0');
    const seconds = now.getSeconds().toString().padStart(2, '0');
    return `${hours}${minutes}${seconds}`;
}

// Helper function to contain the actual download logic
function performDownload(text, filename) {
    const lines = text.split('\n').filter(line => line.trim());
    if (lines.length === 0) {
        // Use alert for consistency with other functions
        alert("The turn has no text content to save.");
        return;
    }

    const blob = new Blob([lines.join('\n')], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);

    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.style.display = 'none';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    console.log(`Saved as: ${filename}`);
}


// --- 1. CORE FUNCTION: The download logic ---
function downloadLastTurn() {
    const lastTurn = [...document.querySelectorAll('[id^="turn-"]')].pop();
    if (!lastTurn) {
        alert("No chat turns found on the page.");
        return;
    }
    
    const textChunk = lastTurn.querySelector('ms-text-chunk');
    if (textChunk) {
        const text = textChunk.innerText;
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const filename = `turn-chunk-${timestamp}.txt`;
        performDownload(text, filename);
    } else {
        alert("Could not find a text chunk in the last turn.");
    }
}

function downloadThirdTurn() {
    const turns = document.querySelectorAll('[id^="turn-"]');
    
    if (turns.length < 3) {
        alert("Less than 3 turns found on the page.");
        return;
    }
    
    const thirdTurn = turns[2]; // Index 2 for the 3rd turn
    const textChunk = thirdTurn.querySelector('ms-text-chunk');

    if (!textChunk) {
        alert("Could not find a text chunk in the third turn.");
        return;
    }

    const text = textChunk.innerText;

    // Get filename from queue or generate fallback
    chrome.storage.local.get('filenameQueue', (data) => {
        let filename;
        const queue = data.filenameQueue;

        if (queue && queue.length > 0) {
            filename = queue.shift(); // Get the first filename
            // Save the updated (shorter) queue back to storage
            chrome.storage.local.set({ filenameQueue: queue }, () => {
                console.log(`Using filename from queue: ${filename}. Queue size now ${queue.length}.`);
                performDownload(text, filename);
            });
        } else {
            // Fallback for manual navigation or if queue is empty
            const timeString = getTimeString();
            filename = `Prompt_ManualDownload_${timeString}.txt`;
            console.log(`Filename queue empty or not found. Using fallback name: ${filename}`);
            performDownload(text, filename);
        }
    });
}

// --- 2. AUTO-DOWNLOAD MONITORING LOGIC ---
let isMonitoring = false;
let monitoringInterval = null;

function startAutoDownloadMonitoring() {
    if (isMonitoring) return;
    
    isMonitoring = true;
    console.log("Starting auto-download monitoring...");
    
    // Check for 3+ turns every 3 seconds
    const turnCheckInterval = setInterval(() => {
        const turns = document.querySelectorAll('[id^="turn-"]');
        console.log(`Current turns count: ${turns.length}`);
        
        if (turns.length >= 3) {
            clearInterval(turnCheckInterval);
            console.log("Found 3 turns, starting 3rd turn content stability monitoring...");
            startContentStabilityCheck();
        }
    }, 5000);
}

function startContentStabilityCheck() {
    let checkCount = 0;
    let lastContent = '';
    const maxChecks = 5;
    
    const contentCheckInterval = setInterval(() => {
        const turns = document.querySelectorAll('[id^="turn-"]');
        
        // Check if we still have at least 3 turns
        if (turns.length < 3) {
            clearInterval(contentCheckInterval);
            isMonitoring = false;
            return;
        }
        
        // Get the 3rd turn (index 2)
        const thirdTurn = turns[2];
        
        if (!thirdTurn) {
            clearInterval(contentCheckInterval);
            isMonitoring = false;
            return;
        }
        
        const textChunk = thirdTurn.querySelector('ms-text-chunk');
        if (!textChunk) {
            clearInterval(contentCheckInterval);
            isMonitoring = false;
            return;
        }
        
        const currentContent = textChunk.innerText;
        checkCount++;
        
        console.log(`Content stability check ${checkCount}/${maxChecks} (monitoring 3rd turn)`);
        console.log(`Content length: ${currentContent.length}`);
        
        if (checkCount === 1) {
            lastContent = currentContent;
        } else if (currentContent === lastContent) {
            console.log(`Content stable for check ${checkCount}`);
            
            if (checkCount >= maxChecks) {
                console.log("Content stable for 5 checks, auto-downloading 3rd turn...");
                clearInterval(contentCheckInterval);
                isMonitoring = false;
                downloadThirdTurn();
                return;
            }
        } else {
            // Content changed, reset the check
            console.log("Content changed, resetting stability check...");
            lastContent = currentContent;
            checkCount = 1;
        }
        
        // Safety check to prevent infinite monitoring
        if (checkCount > 20) {
            console.log("Max checks exceeded, stopping monitoring");
            clearInterval(contentCheckInterval);
            isMonitoring = false;
        }
    }, 3000); // Check every 3 seconds
}

// --- 3. BUTTON CREATION ---
const button = document.createElement('button');
button.id = 'download-last-turn-btn';
button.setAttribute('data-tooltip', 'Download Last Turn');

button.innerHTML = `
    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="pointer-events: none;">
        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
        <polyline points="7 10 12 15 17 10"></polyline>
        <line x1="12" y1="15" x2="12" y2="3"></line>
    </svg>
`;

document.body.appendChild(button);

// --- 4. DRAG AND DROP & POSITION SAVING LOGIC ---
let isDragging = false;
let hasDragged = false;
let offsetX, offsetY;

button.addEventListener('click', () => {
    if (!hasDragged) {
        downloadLastTurn();
    }
});

function savePosition(top, left) {
    chrome.storage.local.set({ buttonPosition: { top, left } });
}

function loadPosition() {
    chrome.storage.local.get('buttonPosition', (data) => {
        if (data.buttonPosition) {
            button.style.top = data.buttonPosition.top;
            button.style.left = data.buttonPosition.left;
        } else {
            button.style.top = '100px';
            button.style.left = '20px';
        }
    });
}

button.addEventListener('mousedown', (e) => {
    e.preventDefault();
    isDragging = true;
    hasDragged = false;
    offsetX = e.clientX - button.getBoundingClientRect().left;
    offsetY = e.clientY - button.getBoundingClientRect().top;
    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseup', onMouseUp);
});

function onMouseMove(e) {
    if (!isDragging) return;
    hasDragged = true;

    let newTop = e.clientY - offsetY;
    let newLeft = e.clientX - offsetX;
    
    const vpWidth = document.documentElement.clientWidth;
    const vpHeight = document.documentElement.clientHeight;
    const btnWidth = button.offsetWidth;
    const btnHeight = button.offsetHeight;

    if (newLeft < 0) newLeft = 0;
    if (newTop < 0) newTop = 0;
    if (newLeft + btnWidth > vpWidth) newLeft = vpWidth - btnWidth;
    if (newTop + btnHeight > vpHeight) newTop = vpHeight - btnHeight;

    button.style.top = `${newTop}px`;
    button.style.left = `${newLeft}px`;
}

function onMouseUp() {
    if (!isDragging) return;
    isDragging = false;
    document.removeEventListener('mousemove', onMouseMove);
    document.removeEventListener('mouseup', onMouseUp);
    
    if (hasDragged) {
        savePosition(button.style.top, button.style.left);
    }
}

loadPosition();

// --- 5. START AUTO-DOWNLOAD MONITORING ---
// Start monitoring when the script loads
startAutoDownloadMonitoring();

// Also start monitoring when new content is added to the page
const observer = new MutationObserver((mutations) => {
    mutations.forEach((mutation) => {
        if (mutation.addedNodes.length > 0) {
            // Check if new turns were added
            const newTurns = Array.from(mutation.addedNodes).some(node => 
                node.nodeType === Node.ELEMENT_NODE && 
                (node.id && node.id.startsWith('turn-') || 
                 node.querySelector && node.querySelector('[id^="turn-"]'))
            );
            
            if (newTurns && !isMonitoring) {
                console.log("New turns detected, restarting monitoring...");
                startAutoDownloadMonitoring();
            }
        }
    });
});

observer.observe(document.body, {
    childList: true,
    subtree: true
});
