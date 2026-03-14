document.addEventListener('DOMContentLoaded', () => {
  const container = document.getElementById('container');
  const viewport = document.getElementById('viewport');
  
  const zoomInBtn = document.getElementById('zoomInBtn');
  const zoomOutBtn = document.getElementById('zoomOutBtn');
  const resetBtn = document.getElementById('resetViewBtn');

  let scale = 1;
  let translateX = 0;
  let translateY = -50; 
  // -50 to keep it centered vertically based on our CSS transform-origin: 0 50%;
  
  let isDragging = false;
  let startX, startY;
  
  function updateTransform() {
    container.style.transform = `translate(${translateX}px, calc(50% + ${translateY}px)) scale(${scale})`;
  }

  // Initial calculation to place root near left edge but visible
  translateX = 40;
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
    scale = 1;
    translateX = 40;
    translateY = -50; // offset reset
    updateTransform();
  });
});
