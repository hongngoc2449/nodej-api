// UI management and rendering functions

// Cache for cropped+scaled previews to reduce lag
// key: `${url}|${previewMaxH}` => { dataUrl, width, height }
const previewImageCache = new Map();

function getCachedPreview(url, previewMaxH) {
  const key = `${url}|${previewMaxH}`;
  return previewImageCache.get(key);
}

function setCachedPreview(url, previewMaxH, value) {
  const key = `${url}|${previewMaxH}`;
  previewImageCache.set(key, value);
}

async function renderResultImages(result, originalText) {
  // Try to find inline result images first (new layout)
  let resultImages = document.querySelector(".result-images-inline");

  // Fallback to old layout if exists
  if (!resultImages) {
    const resultSection = document.querySelector(".result-section");
    if (resultSection) {
      resultImages = resultSection.querySelector(".result-images");
    }
  }

  if (!resultImages) return;

  const words = groupIntoWords(result);

  // Read spacing controls (fallback to defaults if missing)
  const charSpacing = parseInt(
    document.getElementById("characterSpacingInput")?.value || 0
  );
  const wordSpacing = parseInt(
    document.getElementById("wordSpacingInput")?.value || 40
  );

  const previewMaxH = 60;
  const wordHtmlArr = await Promise.all(
    words.map(async (word) => {
      const itemsHtml = await Promise.all(
        word.map(async (item, idx, arr) => {
          const isLast = idx === arr.length - 1;
          const marginRight = isLast ? 0 : charSpacing;
          if (item.missing) {
            return `<div class="result-image" style="background: #fee; border: 1px solid #fcc; line-height: 0; width: 60px; height: 60px; overflow: hidden; margin-right: ${marginRight}px;"><div style="width: 100%; height: 100%; display: flex; align-items: center; justify-content: center; background: #fcc; color: #c33; font-weight: bold; line-height: 1;">${item.char}</div></div>`;
          }
          // Load image, compute bounds and draw cropped preview at scaled height
          const url = getImageSrc(item);
          const cached = getCachedPreview(url, previewMaxH);
          if (cached) {
            return `<div class="result-image" style="margin-right: ${marginRight}px; width:${cached.width}px; height:${cached.height}px; display:inline-block; line-height:0;"><img src="${cached.dataUrl}" alt="${item.char}" style="display:block; width:${cached.width}px; height:${cached.height}px;"/></div>`;
          }
          const img = await new Promise((res, rej) => {
            const i = new Image();
            i.crossOrigin = "anonymous";
            i.onload = () => res(i);
            i.onerror = () => rej();
            i.src = url;
          }).catch(() => null);
          if (!img) {
            return `<div class="result-image" style="margin-right: ${marginRight}px;"><img src="${url}" alt="${item.char}" style="max-height:${previewMaxH}px;"/></div>`;
          }
          const bounds = getImageBounds(img);
          const scale = bounds.height ? previewMaxH / bounds.height : 1;
          const outW = Math.max(1, Math.round(bounds.width * scale));
          const outH = Math.max(1, Math.round(bounds.height * scale));
          const canvas = document.createElement("canvas");
          canvas.width = outW;
          canvas.height = outH;
          const ctx = canvas.getContext("2d");
          ctx.drawImage(
            img,
            bounds.x,
            bounds.y,
            bounds.width,
            bounds.height,
            0,
            0,
            outW,
            outH
          );
          const dataUrl = canvas.toDataURL();
          setCachedPreview(url, previewMaxH, { dataUrl, width: outW, height: outH });
          return `<div class="result-image" style="margin-right: ${marginRight}px; width:${outW}px; height:${outH}px; display:inline-block; line-height:0;"><img src="${dataUrl}" alt="${item.char}" style="display:block; width:${outW}px; height:${outH}px;"/></div>`;
        })
      );
      return `<div class="word-container" style="margin-right: ${wordSpacing}px;">${itemsHtml.join("")}</div>`;
    })
  );
  resultImages.innerHTML = wordHtmlArr.join("");

}

// Global flag to prevent drag when interacting with checkbox/delete button
let isInteractingWithInteractive = false;

function rebuildSetsList() {
  const patternSetsList = document.getElementById("patternSetsList");
  if (!patternSetsList) return;
  
  // Filter to only show active patterns
  const activePatterns = patternSets.filter(set => activePatternSetIds.has(set.id));
  
  if (!activePatterns.length) {
    patternSetsList.innerHTML = '<div class="hint">Chưa có bộ pattern. Hãy thêm pattern từ danh sách khả dụng.</div>';
    return;
  }

  // Display active pattern sets as cards (all patterns are always used for conversion)
  patternSetsList.innerHTML = activePatterns
    .map((set) => {
      const count = set.images ? set.images.length : 0;

      // Get images for display (show all, allow horizontal scrolling)
      const images = set.images || [];
      const imagesHtml = images
        .map((img) => {
          const src = getImageSrc(img);
          return `
            <div class="pattern-set-image-item">
              <img src="${src}" alt="${img.char}" />
              <span class="pattern-set-char">${img.char}</span>
            </div>
          `;
        })
        .join("");

      // Check if this is the last pattern in active list
      const isLastPattern = activePatterns.length === 1;
      // Can delete if not the last pattern (allow deleting builtin too)
      const canDelete = !isLastPattern;
      
      return `
        <div class="pattern-set-card" draggable="true" data-set-id="${set.id}">
          <div class="pattern-set-drag-handle" title="Kéo để sắp xếp thứ tự">
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
              <line x1="2" y1="3" x2="10" y2="3" stroke="#666" stroke-width="1.5" stroke-linecap="round"/>
              <line x1="2" y1="6" x2="10" y2="6" stroke="#666" stroke-width="1.5" stroke-linecap="round"/>
              <line x1="2" y1="9" x2="10" y2="9" stroke="#666" stroke-width="1.5" stroke-linecap="round"/>
            </svg>
          </div>
          <div class="pattern-set-content">
            <div class="pattern-set-header">
              <div>
                <span class="pattern-set-name">${set.name}</span>
                <span class="pattern-set-count">(${count} ảnh)</span>
              </div>
              ${
                canDelete
                  ? `
                <button 
                  class="pattern-set-delete-btn" 
                  data-set-id="${set.id}"
                  title="Xóa pattern khỏi danh sách"
                  style="
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    width: 24px;
                    height: 24px;
                    padding: 0;
                    background: none;
                    border: none;
                    cursor: pointer;
                    color: #dc3545;
                  "
                >
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <polyline points="3 6 5 6 21 6"></polyline>
                    <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                    <line x1="10" y1="11" x2="10" y2="17"></line>
                    <line x1="14" y1="11" x2="14" y2="17"></line>
                  </svg>
                </button>
              `
                  : ""
              }
            </div>
            <div class="pattern-set-images">
              ${imagesHtml}
            </div>
          </div>
        </div>
      `;
    })
    .join("");

  // Bind drag and drop events - Simple direct approach
  const cards = patternSetsList.querySelectorAll(".pattern-set-card");
  let draggedCard = null;

  cards.forEach((card) => {
    const deleteBtn = card.querySelector(".pattern-set-delete-btn");

    // Stop event propagation for interactive elements
    if (deleteBtn) {
      deleteBtn.addEventListener("mousedown", (e) => e.stopPropagation());
      deleteBtn.addEventListener("click", (e) => e.stopPropagation());
    }

    card.addEventListener("dragstart", function (e) {
      // Don't drag if clicking on delete button
      if (
        e.target === deleteBtn ||
        deleteBtn?.contains(e.target)
      ) {
        e.preventDefault();
        return false;
      }

      // Apply styles immediately - BEFORE creating drag image
      this.classList.add("dragging");
      patternSetsList.classList.add("dragging-active");
      document.body.classList.add("dragging-active");

      // Force immediate style application
      void this.offsetHeight;

      draggedCard = this;

      e.dataTransfer.effectAllowed = "move";
      e.dataTransfer.setData("text/plain", "");

      // Use a simple empty image or small transparent image for faster drag
      // This avoids delay from cloning complex DOM
      const emptyImg = document.createElement("img");
      emptyImg.src =
        "data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7";
      e.dataTransfer.setDragImage(emptyImg, 0, 0);
    });

    card.addEventListener("dragend", function (e) {
      this.classList.remove("dragging");
      patternSetsList.classList.remove("dragging-active");
      document.body.classList.remove("dragging-active");

      patternSetsList
        .querySelectorAll(".drag-over")
        .forEach((c) => c.classList.remove("drag-over"));

      // Update order when drag ends (even if drop event didn't fire)
      // Get current order from DOM
      const currentOrder = Array.from(
        patternSetsList.querySelectorAll(".pattern-set-card")
      ).map((c) => c.dataset.setId);

      // Check if order actually changed
      const oldOrder = patternSets.map((s) => s.id);
      const orderChanged = JSON.stringify(currentOrder) !== JSON.stringify(oldOrder);

      if (orderChanged) {

        // Reorder active patterns in patternSets array
        const activePatterns = patternSets.filter(set => activePatternSetIds.has(set.id));
        const reorderedActivePatterns = currentOrder
          .map((id) => activePatterns.find((s) => s.id === id))
          .filter(Boolean);
        
        // Get non-active patterns
        const nonActivePatterns = patternSets.filter(set => !activePatternSetIds.has(set.id));
        
        // Reorder patternSets: active patterns first (in new order), then non-active
        patternSets.length = 0;
        patternSets.push(...reorderedActivePatterns, ...nonActivePatterns);

        // Update patternSetOrder if rotate mode is on
        // BUT do NOT reassign text - keep existing conversion intact
        if (rotateMode) {
          const selectedOrder = patternSets
            .filter((set) => activePatternSetIds.has(set.id))
            .map((set) => set.id);
          patternSetOrder = selectedOrder;
        }

        // Rebuild list to reflect new order (this will rebind event listeners)
        rebuildSetsList();
        
        // Only refresh UI to show updated list, NOT to reassign text
        if (typeof refreshUI === "function") {
          refreshUI();
        }
      }

      draggedCard = null;
    });

    card.addEventListener("dragenter", function (e) {
      if (!draggedCard || draggedCard === this) return;

      e.preventDefault();
      this.classList.add("drag-over");

      // Move card immediately when entering card area
      // Use a more generous threshold - top 60% goes before, bottom 40% goes after
      const rect = this.getBoundingClientRect();
      const mouseY = e.clientY;
      const relativeY = mouseY - rect.top;
      const threshold = rect.height * 0.6; // Top 60% of card

      // Determine insertion point - more sensitive to entry point
      let insertBefore = relativeY < threshold;

      // Insert immediately when entering card area - don't wait for center
      if (insertBefore) {
        if (this.previousSibling !== draggedCard) {
          patternSetsList.insertBefore(draggedCard, this);
        }
      } else {
        if (this.nextSibling !== draggedCard) {
          if (this.nextSibling) {
            patternSetsList.insertBefore(draggedCard, this.nextSibling);
          } else {
            patternSetsList.appendChild(draggedCard);
          }
        }
      }
    });

    card.addEventListener("dragover", function (e) {
      if (!draggedCard || draggedCard === this) {
        if (draggedCard === this) {
          e.preventDefault();
        }
        return;
      }

      e.preventDefault();
      e.dataTransfer.dropEffect = "move";

      // Continue to update position while dragging over card
      // Use same threshold as dragenter for consistency
      const rect = this.getBoundingClientRect();
      const mouseY = e.clientY;
      const relativeY = mouseY - rect.top;
      const threshold = rect.height * 0.6; // Top 60% goes before

      // Determine insertion point
      let insertBefore = relativeY < threshold;

      // Update position continuously while over card
      if (insertBefore) {
        if (this.previousSibling !== draggedCard) {
          patternSetsList.insertBefore(draggedCard, this);
        }
      } else {
        if (this.nextSibling !== draggedCard) {
          if (this.nextSibling) {
            patternSetsList.insertBefore(draggedCard, this.nextSibling);
          } else {
            patternSetsList.appendChild(draggedCard);
          }
        }
      }

      // Add visual feedback
      if (!this.classList.contains("drag-over")) {
        this.classList.add("drag-over");
      }
    });

    card.addEventListener("dragleave", function (e) {
      if (!this.contains(e.relatedTarget)) {
        this.classList.remove("drag-over");
      }
    });

    card.addEventListener("drop", function (e) {
      e.preventDefault();
      e.stopPropagation();

      if (!draggedCard || draggedCard === this) {
        return;
      }

      // Clean up visual states
      patternSetsList
        .querySelectorAll(".drag-over")
        .forEach((c) => c.classList.remove("drag-over"));

      // Get new order from DOM (which reflects the current visual order)
      const newOrder = Array.from(
        patternSetsList.querySelectorAll(".pattern-set-card")
      ).map((c) => c.dataset.setId);

      // Update activePatternSetIds to match new order (keep all IDs, just update order)
      // The order in patternSets should follow the drag-and-drop order for active patterns
      // We need to reorder the active patterns in patternSets array
      const activePatterns = patternSets.filter(set => activePatternSetIds.has(set.id));
      const reorderedActivePatterns = newOrder
        .map((id) => activePatterns.find((s) => s.id === id))
        .filter(Boolean);
      
      // Get non-active patterns
      const nonActivePatterns = patternSets.filter(set => !activePatternSetIds.has(set.id));
      
      // Reorder patternSets: active patterns first (in new order), then non-active
      patternSets.length = 0;
      patternSets.push(...reorderedActivePatterns, ...nonActivePatterns);

        // Update patternSetOrder if rotate mode is on
        // BUT do NOT reassign text - keep existing conversion intact
        if (rotateMode) {
          const activeOrder = patternSets
            .filter((set) => activePatternSetIds.has(set.id))
            .map((set) => set.id);
          patternSetOrder = activeOrder;
        }

      // Rebuild list to reflect new order
      rebuildSetsList();
      
      // Only refresh UI to show updated list, NOT to reassign text
      if (typeof refreshUI === "function") {
        refreshUI();
      }
    });
  });

  // Bind delete button events
  const deleteButtons = patternSetsList.querySelectorAll(
    ".pattern-set-delete-btn"
  );
  deleteButtons.forEach((btn) => {
    btn.addEventListener("click", function (e) {
      e.stopPropagation(); // Prevent event bubbling
      const setId = this.dataset.setId;

      // Find the pattern set
      const set = patternSets.find((s) => s.id === setId);
      if (!set) return;
      
      // Don't allow removing if it's the last pattern
      if (activePatternSetIds.size === 1) {
        alert("Phải có ít nhất 1 pattern trong danh sách.");
        return;
      }

      // Remove from active list (not from patternSets)
      activePatternSetIds.delete(setId);

      // Remove from patternSetOrder if exists
      const orderIndex = patternSetOrder.indexOf(setId);
      if (orderIndex > -1) {
        patternSetOrder.splice(orderIndex, 1);
      }

      // Rebuild UI
      rebuildSetsList();
      rebuildImageGrid();
      if (typeof rebuildAvailablePatternsList === "function") rebuildAvailablePatternsList();
      if (typeof refreshUI === "function") {
        refreshUI();
      }
    });
  });
}

function rebuildImageGrid() {
  const imageGrid = document.querySelector(".image-grid");
  if (!imageGrid) return;

  // Use first active set for grid display (or builtin if none active)
  const firstActiveId =
    activePatternSetIds.size > 0 ? Array.from(activePatternSetIds)[0] : "builtin";
  const current = patternSets.find((s) => s.id === firstActiveId);
  const merged = current && current.images ? current.images : [];
  if (!merged || merged.length === 0) {
    imageGrid.innerHTML = '<div class="no-images">Không có ảnh nào</div>';
    return;
  }
  imageGrid.innerHTML = merged
    .map((img) => {
      return `
        <div class="image-item" data-char="${img.char}">
          <img src="${getImageSrc(img)}" alt="${img.char}" />
          <div class="char">${img.char}</div>
        </div>
      `;
    })
    .join("");

  // Rebind selection handlers
  const imageItems = imageGrid.querySelectorAll(".image-item");
  imageItems.forEach((item) => {
    item.addEventListener("click", function () {
      imageItems.forEach((i) => i.classList.remove("selected"));
      this.classList.add("selected");
      const char = this.dataset.char;
      const hidden = document.getElementById("selectedChar");
      if (hidden) hidden.value = char;
    });
  });
}
