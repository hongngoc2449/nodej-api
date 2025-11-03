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
      const count = set.images ? set.images.length : 0;
      const isActive = activePatternSetIds.has(set.id);
      const isBuiltin = set.id === "builtin";
      
      // Check if can remove (not last pattern, allow builtin too)
      const canRemove = isActive && !isLastPattern;
      
      // Get preview images (first few)
      const images = set.images || [];
      const previewImages = images.slice(0, 10);
      const imagesHtml = previewImages
        .map((img) => {
          const src = getImageSrc(img);
          return `
            <div class="pattern-set-image-item" style="width: 40px; height: 40px;">
              <img src="${src}" alt="${img.char}" style="width: 100%; height: 100%; object-fit: contain;" />
            </div>
          `;
        })
        .join("");
      
      const moreCount = images.length > 10 ? images.length - 10 : 0;
      const moreHtml = moreCount > 0 
        ? `<div class="pattern-set-more" style="width: 40px; height: 40px; font-size: 10px;">+${moreCount}</div>`
        : "";
      
      let removeButtonHtml = '';
      if (isActive) {
        if (isLastPattern) {
          removeButtonHtml = `
            <button 
              class="modal-btn modal-btn-secondary"
              style="padding: 8px 16px; font-size: 12px; opacity: 0.5; cursor: not-allowed;"
              disabled
              title="Phải có ít nhất 1 pattern trong danh sách"
            >
              ➖ Xóa khỏi danh sách
            </button>
          `;
        } else {
          removeButtonHtml = `
            <button 
              class="modal-btn modal-btn-secondary"
              style="padding: 8px 16px; font-size: 12px;"
              data-remove-pattern-id="${set.id}"
            >
              ➖ Xóa khỏi danh sách
            </button>
          `;
        }
      }
      
      return `
        <div class="pattern-set-card" style="margin-bottom: 15px; ${isActive ? 'border: 2px solid #667eea;' : ''}">
          <div class="pattern-set-content">
            <div class="pattern-set-header" style="margin-bottom: 10px;">
              <div>
                <span class="pattern-set-name" style="font-weight: 600; font-size: 16px;">${set.name}</span>
                <span class="pattern-set-count">(${count} ảnh)</span>
                ${isActive ? '<span style="color: #667eea; margin-left: 10px; font-size: 12px;">✓ Đã thêm</span>' : ''}
                ${isBuiltin ? '<span style="color: #999; margin-left: 10px; font-size: 12px;">(Mặc định)</span>' : ''}
              </div>
              ${!isActive ? `
                <button 
                  class="modal-btn modal-btn-primary"
                  style="padding: 8px 16px; font-size: 12px;"
                  data-add-pattern-id="${set.id}"
                >
                  ➕ Thêm vào danh sách
                </button>
              ` : removeButtonHtml}
            </div>
            <div class="pattern-set-images" style="flex-wrap: wrap; gap: 5px;">
              ${imagesHtml}
              ${moreHtml}
            </div>
          </div>
        </div>
      `;
    })
    .join("");
  
  // Bind add buttons
  listContainer.querySelectorAll('[data-add-pattern-id]').forEach(btn => {
    btn.addEventListener('click', function() {
      const setId = this.dataset.addPatternId;
      addPatternToActiveList(setId);
    });
  });
  
  // Bind remove buttons
  listContainer.querySelectorAll('[data-remove-pattern-id]').forEach(btn => {
    btn.addEventListener('click', function() {
      const setId = this.dataset.removePatternId;
      removePatternFromActiveList(setId);
    });
  });
}

function addPatternToActiveList(setId) {
  if (!setId) return;
  
  const set = patternSets.find(s => s.id === setId);
  if (!set) return;
  
  // Add to active list
  activePatternSetIds.add(setId);
  
  // If no sets are selected, select this one
  if (selectedSetIds.size === 0) {
    selectedSetIds.add(setId);
    selectedSetId = setId;
  }
  
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
  
  // Remove from selected if selected
  selectedSetIds.delete(setId);
  
  // Remove from patternSetOrder if exists
  const orderIndex = patternSetOrder.indexOf(setId);
  if (orderIndex > -1) {
    patternSetOrder.splice(orderIndex, 1);
  }
  
  // Ensure at least one set is selected
  if (selectedSetIds.size === 0) {
    const firstActive = Array.from(activePatternSetIds)[0];
    if (firstActive) {
      selectedSetIds.add(firstActive);
      selectedSetId = firstActive;
    }
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

