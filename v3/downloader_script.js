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
let isAutoDownloadEnabled = false;
let turnCheckIntervalId = null;
let contentCheckIntervalId = null;

function stopAutoDownloadMonitoring() {
    console.log("Stopping all auto-download monitoring tasks.");
    if (turnCheckIntervalId) {
        clearInterval(turnCheckIntervalId);
        turnCheckIntervalId = null;
    }
    if (contentCheckIntervalId) {
        clearInterval(contentCheckIntervalId);
        contentCheckIntervalId = null;
    }
    isMonitoring = false;
}

function startAutoDownloadMonitoring() {
    if (!isAutoDownloadEnabled || isMonitoring) return;
    
    isMonitoring = true;
    console.log("Starting auto-download monitoring...");
    
    // Check for 3+ turns every 5 seconds
    turnCheckIntervalId = setInterval(() => {
        const turns = document.querySelectorAll('[id^="turn-"]');
        console.log(`Current turns count: ${turns.length}`);
        
        if (turns.length >= 3) {
            clearInterval(turnCheckIntervalId);
            turnCheckIntervalId = null;
            console.log("Found 3 turns, starting 3rd turn content stability monitoring...");
            startContentStabilityCheck();
        }
    }, 5000);
}

function startContentStabilityCheck() {
    let checkCount = 0;
    let lastContent = '';
    const maxChecks = 5;

    const stopContentCheck = () => {
        if (contentCheckIntervalId) {
            clearInterval(contentCheckIntervalId);
            contentCheckIntervalId = null;
        }
        isMonitoring = false;
    };
    
    contentCheckIntervalId = setInterval(() => {
        const turns = document.querySelectorAll('[id^="turn-"]');
        
        if (turns.length < 3) {
            stopContentCheck();
            return;
        }
        
        const thirdTurn = turns[2];
        if (!thirdTurn) {
            stopContentCheck();
            return;
        }
        
        const textChunk = thirdTurn.querySelector('ms-text-chunk');
        if (!textChunk) {
            stopContentCheck();
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
                stopContentCheck();
                downloadThirdTurn();
                return;
            }
        } else {
            console.log("Content changed, resetting stability check...");
            lastContent = currentContent;
            checkCount = 1;
        }
        
        if (checkCount > 20) {
            console.log("Max checks exceeded, stopping monitoring");
            stopContentCheck();
        }
    }, 3000);
}

// --- 3. UI CREATION ---
const container = document.createElement('div');
container.id = 'download-controls-container';

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

const checkboxLabel = document.createElement('label');
checkboxLabel.className = 'auto-download-label';
checkboxLabel.htmlFor = 'auto-download-checkbox';
checkboxLabel.title = 'Enable/Disable Auto-Download'; // More descriptive tooltip

const checkbox = document.createElement('input');
checkbox.type = 'checkbox';
checkbox.id = 'auto-download-checkbox';

// The text span is no longer needed
checkboxLabel.appendChild(checkbox);

container.appendChild(button);
container.appendChild(checkboxLabel);
document.body.appendChild(container);

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
            container.style.top = data.buttonPosition.top;
            container.style.left = data.buttonPosition.left;
        } else {
            container.style.top = '100px';
            container.style.left = '20px';
        }
    });
}

container.addEventListener('mousedown', (e) => {
    // Only drag if the mousedown is on the button, not the checkbox/label
    if (e.target.closest('.auto-download-label')) {
        return;
    }
    e.preventDefault();
    isDragging = true;
    hasDragged = false;
    offsetX = e.clientX - container.getBoundingClientRect().left;
    offsetY = e.clientY - container.getBoundingClientRect().top;
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
    const btnWidth = container.offsetWidth;
    const btnHeight = container.offsetHeight;

    if (newLeft < 0) newLeft = 0;
    if (newTop < 0) newTop = 0;
    if (newLeft + btnWidth > vpWidth) newLeft = vpWidth - btnWidth;
    if (newTop + btnHeight > vpHeight) newTop = vpHeight - btnHeight;

    container.style.top = `${newTop}px`;
    container.style.left = `${newLeft}px`;
}

function onMouseUp() {
    if (!isDragging) return;
    isDragging = false;
    document.removeEventListener('mousemove', onMouseMove);
    document.removeEventListener('mouseup', onMouseUp);
    
    if (hasDragged) {
        savePosition(container.style.top, container.style.left);
    }
}

// --- 5. INITIALIZATION ---
checkbox.addEventListener('change', () => {
    isAutoDownloadEnabled = checkbox.checked;
    chrome.storage.local.set({ autoDownloadEnabled: isAutoDownloadEnabled });
    if (isAutoDownloadEnabled) {
        console.log("Auto-download enabled by user.");
        startAutoDownloadMonitoring();
    } else {
        console.log("Auto-download disabled by user.");
        stopAutoDownloadMonitoring();
    }
});

function initialize() {
    loadPosition();

    chrome.storage.local.get('autoDownloadEnabled', (data) => {
        isAutoDownloadEnabled = !!data.autoDownloadEnabled;
        checkbox.checked = isAutoDownloadEnabled;
        if (isAutoDownloadEnabled) {
            console.log("Auto-download is enabled from saved state.");
            startAutoDownloadMonitoring();
        }
    });

    const observer = new MutationObserver((mutations) => {
        mutations.forEach((mutation) => {
            if (mutation.addedNodes.length > 0) {
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
}

initialize();
