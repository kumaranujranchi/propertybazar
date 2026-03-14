document.addEventListener('DOMContentLoaded', () => {
  const container = document.getElementById('container');
  const viewport = document.getElementById('viewport');
  
  const zoomInBtn = document.getElementById('zoomInBtn');
  const zoomOutBtn = document.getElementById('zoomOutBtn');
  const resetBtn = document.getElementById('resetViewBtn');

  let scale = window.innerWidth < 768 ? 0.4 : 0.8; 
  let translateX = window.innerWidth < 768 ? 20 : 50;
  let translateY = viewport.clientHeight / 2;
  
  let isDragging = false;
  let startX, startY;
  
  // Expand/Collapse Logic
  const allNodes = document.querySelectorAll('.node');
  allNodes.forEach((node, index) => {
    // Check if node has a sibling UL (children)
    const childrenUl = node.nextElementSibling;
    if (childrenUl && childrenUl.tagName === 'UL') {
      node.classList.add('expandable');
      
      // Auto-collapse logic: Collapse everything except the root's direct children
      const isRoot = node.classList.contains('root-node');
      const li = node.parentElement;
      
      // We start with branches collapsed to show it is dynamic
      if (!isRoot) {
        li.classList.add('li-collapsed');
      }

      // Add pointerdown to stop viewport from capturing
      node.addEventListener('pointerdown', (e) => {
        e.stopPropagation();
      });

      node.addEventListener('click', (e) => {
        e.stopPropagation(); // Just in case
        
        // Prevent click if we were dragging (small threshold)
        // Note: For simplicity, a direct click works best
        li.classList.toggle('li-collapsed');
        
        // Add a "pop" animation feedback
        node.animate([
          { transform: 'scale(1)' },
          { transform: 'scale(1.15)' },
          { transform: 'scale(1)' }
        ], { duration: 200, easing: 'ease-out' });
      });
    }
  });

  function updateTransform() {
    // Pure pixel-based transform for better reliability
    container.style.opacity = '1';
    container.style.transform = `translate(${translateX}px, ${translateY}px) scale(${scale})`;
  }

  // Set initial opacity to 0 for fade-in effect
  container.style.opacity = '0';
  setTimeout(updateTransform, 100);

  // Initial calculation
  updateTransform();

  // PAN logic
  viewport.addEventListener('pointerdown', (e) => {
    // Only drag on left click or touch
    if(e.button !== 0 && e.pointerType === 'mouse') return;
    isDragging = true;
    startX = e.clientX - translateX;
    startY = e.clientY - translateY;
    viewport.setPointerCapture(e.pointerId);
  });

  viewport.addEventListener('pointermove', (e) => {
    if (!isDragging) return;
    translateX = e.clientX - startX;
    translateY = e.clientY - startY;
    updateTransform();
  });

  viewport.addEventListener('pointerup', (e) => {
    isDragging = false;
    viewport.releasePointerCapture(e.pointerId);
  });
  
  viewport.addEventListener('pointercancel', (e) => {
    isDragging = false;
  });

  // ZOOM logic (Mouse Wheel)
  viewport.addEventListener('wheel', (e) => {
    e.preventDefault();
    const zoomFactor = 0.1;
    let oldScale = scale;
    
    if (e.deltaY < 0) {
      // Zoom in
      scale += zoomFactor;
    } else {
      // Zoom out
      scale -= zoomFactor;
    }
    
    // Limits
    scale = Math.min(Math.max(scale, 0.3), 3);
    
    // Note: A true robust zoom-to-pointer math can get complicated due to the CSS structure.
    // Setting transform-origin in CSS helps minimize jumping.
    updateTransform();
  }, { passive: false });

  // BUTTON Controls
  zoomInBtn.addEventListener('click', () => {
    scale += 0.2;
    scale = Math.min(scale, 3);
    updateTransform();
  });

  zoomOutBtn.addEventListener('click', () => {
    scale -= 0.2;
    scale = Math.max(scale, 0.3);
    updateTransform();
  });

  resetBtn.addEventListener('click', () => {
    scale = window.innerWidth < 768 ? 0.4 : 0.8;
    translateX = window.innerWidth < 768 ? 20 : 50;
    translateY = viewport.clientHeight / 2;
    updateTransform();
  });
});
