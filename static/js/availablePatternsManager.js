// Manage available patterns modal and add/remove patterns from active list

function openAvailablePatternsModal() {
  const modal = document.getElementById("availablePatternsModal");
  if (!modal) return;
  
  modal.style.display = "flex";
  rebuildAvailablePatternsList();
}

function closeAvailablePatternsModal() {
  const modal = document.getElementById("availablePatternsModal");
  if (!modal) return;
  
  modal.style.display = "none";
}

function rebuildAvailablePatternsList() {
  const listContainer = document.getElementById("availablePatternsList");
  if (!listContainer) return;
  
  if (!patternSets.length) {
    listContainer.innerHTML = '<div class="hint">Chưa có pattern nào khả dụng.</div>';
    return;
  }
  
  // Count active patterns
  const activeCount = activePatternSetIds.size;
  const isLastPattern = activeCount === 1;
  
  listContainer.innerHTML = patternSets
    .map((set) => {
      const isActive = activePatternSetIds.has(set.id);
      const isBuiltin = set.id === "builtin";
      
      // Find image with char 'A'
      const images = set.images || [];
      const imageA = images.find(img => img.char && img.char.toUpperCase() === "A");
      
      if (!imageA) {
        return ''; // Skip patterns without 'A'
      }
      
      const src = getImageSrc(imageA);
      const activeClass = isActive ? 'border: 2px solid #059669; background: #ecfdf5;' : '';
      
      return `
        <div 
          class="available-pattern-item" 
          style="
            display: flex;
            flex-direction: column;
            align-items: center;
            padding: 10px;
            background: white;
            border-radius: 8px;
            border: 2px solid #e1e5e9;
            cursor: pointer;
            transition: all 0.2s ease;
            min-width: 100px;
            ${activeClass}
          "
          data-pattern-id="${set.id}"
          title="${set.name}${isActive ? ' (Đã thêm - Click để xóa)' : ' (Click để thêm)'}"
          onmouseover="this.style.transform='translateY(-2px)'; this.style.boxShadow='0 4px 8px rgba(0,0,0,0.1)';"
          onmouseout="this.style.transform='translateY(0)'; this.style.boxShadow='none';"
        >
          <img 
            src="${src}" 
            alt="A" 
            style="width: 60px; height: 60px; object-fit: contain; margin-bottom: 8px;"
          />
          <div style="font-size: 12px; font-weight: 600; color: #333; text-align: center;">
            ${set.name}
          </div>
          ${isActive ? '<div style="font-size: 10px; color: #059669; margin-top: 4px;">✓ Đã thêm</div>' : ''}
        </div>
      `;
    })
    .filter(html => html !== '') // Remove empty patterns
    .join("");
  
  // Bind click events to add/remove patterns
  listContainer.querySelectorAll('[data-pattern-id]').forEach(item => {
    item.addEventListener('click', function() {
      const setId = this.dataset.patternId;
      const isActive = activePatternSetIds.has(setId);
      
      if (isActive) {
        // Remove from active list
        removePatternFromActiveList(setId);
      } else {
        // Add to active list
        addPatternToActiveList(setId);
      }
    });
  });
}

function addPatternToActiveList(setId) {
  if (!setId) return;
  
  const set = patternSets.find(s => s.id === setId);
  if (!set) return;
  
  // Add to active list
  activePatternSetIds.add(setId);
  
  // Rebuild lists
  rebuildAvailablePatternsList();
  rebuildSetsList();
  rebuildImageGrid();
  
  if (typeof refreshUI === "function") {
    refreshUI();
  }
}

function removePatternFromActiveList(setId) {
  if (!setId) return;
  
  const set = patternSets.find(s => s.id === setId);
  if (!set) return;
  
  // Don't allow removing if it's the last pattern
  if (activePatternSetIds.size === 1) {
    alert("Phải có ít nhất 1 pattern trong danh sách.");
    return;
  }
  
  // Remove from active list
  activePatternSetIds.delete(setId);
  
  // Remove from patternSetOrder if exists
  const orderIndex = patternSetOrder.indexOf(setId);
  if (orderIndex > -1) {
    patternSetOrder.splice(orderIndex, 1);
  }
  
  // Rebuild lists
  rebuildAvailablePatternsList();
  rebuildSetsList();
  rebuildImageGrid();
  
  if (typeof refreshUI === "function") {
    refreshUI();
  }
}

function initAvailablePatternsHandlers() {
  const openBtn = document.getElementById("openAvailablePatternsBtn");
  const closeBtn1 = document.getElementById("closeAvailablePatternsBtn");
  const closeBtn2 = document.getElementById("closeAvailablePatternsBtn2");
  const modal = document.getElementById("availablePatternsModal");
  
  if (openBtn) {
    openBtn.addEventListener("click", openAvailablePatternsModal);
  }
  
  if (closeBtn1) {
    closeBtn1.addEventListener("click", closeAvailablePatternsModal);
  }
  
  if (closeBtn2) {
    closeBtn2.addEventListener("click", closeAvailablePatternsModal);
  }
  
  // Close on overlay click
  if (modal) {
    modal.addEventListener("click", function(e) {
      if (e.target === modal) {
        closeAvailablePatternsModal();
      }
    });
  }
}

