// A variable to keep track of the last element we highlighted
let lastElement = null;

// Listen for the 'mouseover' event on the entire document.
// This is more efficient than adding a listener to every single element.
document.addEventListener('mouseover', (event) => {
  // If we have highlighted an element before, remove the highlight class
  if (lastElement) {
    lastElement.classList.remove('extension-highlight-element');
  }

  // Get the element the mouse is currently over
  const currentElement = event.target;

  // Add the highlight class to the current element
  currentElement.classList.add('extension-highlight-element');

  // Update lastElement to be the current element for the next mouseover event
  lastElement = currentElement;
});

// Optional: If the mouse leaves the window, we might want to clear the last highlight.
document.addEventListener('mouseout', (event) => {
    if (lastElement) {
        lastElement.classList.remove('extension-highlight-element');
        lastElement = null;
    }
});