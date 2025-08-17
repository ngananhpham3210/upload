// --- 1. CORE FUNCTION: The download logic you provided ---
function downloadLastTurn() {
    const lastTurn = [...document.querySelectorAll('[id^="turn-"]')].pop();
    if (!lastTurn) {
        alert("No chat turns found on the page.");
        return;
    }
    
    const textChunk = lastTurn.querySelector('ms-text-chunk');
    if (textChunk) {
        const text = textChunk.innerText;
        const lines = text.split('\n').filter(line => line.trim());

        if (lines.length === 0) {
            alert("Last turn has no text content to save.");
            return;
        }

        // Create filename with timestamp
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const filename = `turn-chunk-${timestamp}.txt`;

        // Create blob and download
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
        console.log('Content preview:', lines.slice(0, 3).join('\n'));
    } else {
        alert("Could not find a text chunk in the last turn.");
    }
}

// --- 2. BUTTON CREATION ---
const button = document.createElement('button');
button.id = 'download-last-turn-btn';
button.setAttribute('data-tooltip', 'Download Last Turn');

// SVG icon for the button (a simple download arrow)
button.innerHTML = `
    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="pointer-events: none;">
        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
        <polyline points="7 10 12 15 17 10"></polyline>
        <line x1="12" y1="15" x2="12" y2="3"></line>
    </svg>
`;

document.body.appendChild(button);

// --- 3. DRAG AND DROP & POSITION SAVING LOGIC ---
let isDragging = false;
let hasDragged = false; // <<< CHANGE 1: Add a flag to track if a drag occurred.
let offsetX, offsetY;

// Attach the download function to the button's click event
// <<< CHANGE 2: Modify the click listener to check the flag.
button.addEventListener('click', () => {
    // Only execute download if the button was NOT dragged.
    if (!hasDragged) {
        downloadLastTurn();
    }
});

// Function to save position
function savePosition(top, left) {
    chrome.storage.local.set({ buttonPosition: { top, left } });
}

// Function to load position
function loadPosition() {
    chrome.storage.local.get('buttonPosition', (data) => {
        if (data.buttonPosition) {
            button.style.top = data.buttonPosition.top;
            button.style.left = data.buttonPosition.left;
        } else {
            // Default position if none is saved
            button.style.top = '100px';
            button.style.left = '20px';
        }
    });
}

button.addEventListener('mousedown', (e) => {
    // Prevent text selection while dragging
    e.preventDefault();
    
    isDragging = true;
    hasDragged = false; // <<< CHANGE 3: Reset the flag on every new mousedown.
    
    // Calculate the offset from the top-left of the button
    offsetX = e.clientX - button.getBoundingClientRect().left;
    offsetY = e.clientY - button.getBoundingClientRect().top;
    
    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseup', onMouseUp);
});

function onMouseMove(e) {
    if (!isDragging) return;
    
    hasDragged = true; // <<< CHANGE 4: If mouse moves, set the flag to true.

    let newTop = e.clientY - offsetY;
    let newLeft = e.clientX - offsetX;
    
    // Constrain the button within the viewport
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
    
    // Save the final position only if it was a drag
    if (hasDragged) {
        savePosition(button.style.top, button.style.left);
    }
}

// Load the button's position when the script starts
loadPosition();
