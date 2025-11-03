// Pattern Form Modal Management

let uploadedPatternImages = []; // Store uploaded images with URLs

// Helper: Sanitize pattern name to folder name
function sanitizeFolderName(patternName) {
  if (!patternName) return "";
  return patternName
    .replace(/[^a-zA-Z0-9\s]/g, "") // Remove special characters except spaces
    .replace(/\s+/g, "-") // Replace spaces with hyphens
    .replace(/-+/g, "-") // Replace multiple hyphens with single
    .replace(/^-|-$/g, "") // Remove leading/trailing hyphens
    .toLowerCase();
}

// Helper: Check if pattern name already exists
function isPatternNameExists(patternName) {
  if (!patternName) return false;
  const sanitized = sanitizeFolderName(patternName);

  // Check against existing uploaded pattern sets
  const uploadedSets = patternSets.filter((set) => set.source === "uploaded");
  return uploadedSets.some((set) => {
    const setSanitized = sanitizeFolderName(set.name);
    return setSanitized === sanitized;
  });
}

function openPatternFormModal() {
  const modal = document.getElementById("patternFormModal");
  if (modal) {
    modal.classList.add("show");
    // Reset form for new pattern creation
    document.getElementById("patternNameInput").value = "";
    uploadedPatternImages = []; // Reset uploaded images

    // Reset upload section to normal state
    resetUploadSection();

    // Update both previews
    updatePatternPreview(); // Show saved patterns (only char A)
    updateUploadPreview(); // Show uploaded preview (empty initially)
  }
}

function closePatternFormModal() {
  const modal = document.getElementById("patternFormModal");
  if (modal) {
    modal.classList.remove("show");
    // Reset form
    document.getElementById("patternNameInput").value = "";
    uploadedPatternImages = [];
    updatePatternPreview();
    updateUploadPreview();
    resetUploadSection();
  }
}

// Reset upload section to normal state
function resetUploadSection() {
  // Reset upload input
  const modalUploadInput = document.getElementById("modalUploadImageInput");
  if (modalUploadInput) {
    modalUploadInput.value = "";
  }

  // Reset upload button
  const modalUploadBtn = document.getElementById("modalUploadImageBtn");
  if (modalUploadBtn) {
    modalUploadBtn.disabled = false;
    modalUploadBtn.textContent = "📤 Upload toàn bộ ảnh";
  }

  // Reset upload status
  const modalUploadStatus = document.getElementById("modalUploadStatus");
  if (modalUploadStatus) {
    modalUploadStatus.style.display = "none";
    modalUploadStatus.textContent = "";
  }

  // Reset upload progress
  const modalUploadProgress = document.getElementById("modalUploadProgress");
  if (modalUploadProgress) {
    modalUploadProgress.style.display = "none";
  }

  const modalProgressBar = document.getElementById("modalProgressBar");
  if (modalProgressBar) {
    modalProgressBar.style.width = "0%";
  }

  const modalProgressText = document.getElementById("modalProgressText");
  if (modalProgressText) {
    modalProgressText.textContent = "";
  }

  // Clear uploaded images
  uploadedPatternImages = [];
  updateUploadPreview();
}

// Update Pattern Preview: Only show char A of saved patterns
function updatePatternPreview() {
  const preview = document.getElementById("patternPreview");
  if (!preview) return;

  // Find uploaded pattern sets (source === "uploaded")
  const uploadedSets = patternSets.filter((set) => set.source === "uploaded");

  if (uploadedSets.length === 0) {
    preview.innerHTML = `
      <div class="pattern-preview-empty">
        Chưa có pattern nào đã được lưu.
      </div>
    `;
    return;
  }

  // Collect only char 'A' from each saved pattern set
  const charAImages = [];
  uploadedSets.forEach((set) => {
    if (set.images && Array.isArray(set.images)) {
      const imageA = set.images.find(
        (img) => img.char && img.char.toUpperCase() === "A"
      );
      if (imageA) {
        charAImages.push({
          char: "A",
          url: imageA.url,
          patternName: set.name,
        });
      }
    }
  });

  if (charAImages.length === 0) {
    preview.innerHTML = `
      <div class="pattern-preview-empty">
        Không tìm thấy ký tự A trong các pattern đã lưu.
      </div>
    `;
    return;
  }

  // Show only char A previews with pattern name
  preview.innerHTML = charAImages
    .map((img) => {
      return `
        <div class="pattern-preview-item" style="border-color: #667eea; background: #f0f9ff;">
          <img src="${img.url}" alt="A" />
          <div class="char-label">A</div>
          <div class="pattern-name-label" style="font-size: 10px; color: #666; margin-top: 2px;">${img.patternName}</div>
        </div>
      `;
    })
    .join("");
}

// Update Upload Preview: Show all characters from currently uploaded images
function updateUploadPreview() {
  const preview = document.getElementById("uploadPreview");
  if (!preview) return;

  if (uploadedPatternImages.length === 0) {
    preview.innerHTML = `
      <div class="pattern-preview-empty">
        Chưa có pattern nào được upload. Hãy upload folder pattern để xem preview.
      </div>
    `;
    return;
  }

  // Show preview with all uploaded images, highlight 'A' if exists
  preview.innerHTML = uploadedPatternImages
    .sort((a, b) => {
      // Sort: A first, then alphabetically
      if (a.char === "A") return -1;
      if (b.char === "A") return 1;
      return (a.char || "").localeCompare(b.char || "");
    })
    .map((img) => {
      const isA = img.char && img.char.toUpperCase() === "A";
      return `
        <div class="pattern-preview-item" ${
          isA ? 'style="border-color: #667eea; background: #f0f9ff;"' : ""
        }>
          <img src="${img.url || img.preview}" alt="${img.char}" />
          <div class="char-label">${img.char}${isA ? " (Preview)" : ""}</div>
        </div>
      `;
    })
    .join("");
}

function initPatternFormHandlers() {
  const openBtn = document.getElementById("openPatternFormBtn");
  const closeBtn = document.getElementById("closePatternFormBtn");
  const cancelBtn = document.getElementById("cancelPatternFormBtn");
  const modal = document.getElementById("patternFormModal");
  const form = document.getElementById("patternForm");
  const modalUploadBtn = document.getElementById("modalUploadImageBtn");
  const modalUploadInput = document.getElementById("modalUploadImageInput");

  // Open modal
  if (openBtn) {
    openBtn.addEventListener("click", openPatternFormModal);
  }

  // Close modal
  if (closeBtn) {
    closeBtn.addEventListener("click", closePatternFormModal);
  }

  if (cancelBtn) {
    cancelBtn.addEventListener("click", closePatternFormModal);
  }

  // Close on overlay click
  if (modal) {
    modal.addEventListener("click", function (e) {
      if (e.target === modal) {
        closePatternFormModal();
      }
    });
  }

  // Real-time validation for pattern name input
  if (patternNameInput) {
    let validationTimeout;
    patternNameInput.addEventListener("input", function () {
      clearTimeout(validationTimeout);
      const name = this.value.trim();

      // Remove previous validation styling
      this.style.borderColor = "";
      const existingHint =
        this.parentElement.querySelector(".pattern-name-hint");
      if (existingHint) {
        existingHint.remove();
      }

      if (name) {
        validationTimeout = setTimeout(() => {
          if (isPatternNameExists(name)) {
            // Show warning
            this.style.borderColor = "#dc3545";
            const hint = document.createElement("div");
            hint.className = "pattern-name-hint";
            hint.style.color = "#dc3545";
            hint.style.fontSize = "12px";
            hint.style.marginTop = "5px";
            hint.textContent = "⚠️ Tên pattern này đã được sử dụng!";
            this.parentElement.appendChild(hint);
          } else {
            // Show success
            this.style.borderColor = "#28a745";
          }
        }, 500); // Debounce 500ms
      }
    });

    // Clear validation on blur if empty
    patternNameInput.addEventListener("blur", function () {
      if (!this.value.trim()) {
        this.style.borderColor = "";
        const existingHint =
          this.parentElement.querySelector(".pattern-name-hint");
        if (existingHint) {
          existingHint.remove();
        }
      }
    });
  }

  // Handle form submission
  if (form) {
    form.addEventListener("submit", function (e) {
      e.preventDefault();

      const patternName = document
        .getElementById("patternNameInput")
        .value.trim();
      if (!patternName) {
        alert("Vui lòng nhập tên pattern");
        return;
      }

      // Check if pattern name already exists
      if (isPatternNameExists(patternName)) {
        alert("⚠️ Tên pattern này đã được sử dụng! Vui lòng chọn tên khác.");
        document.getElementById("patternNameInput").focus();
        return;
      }

      if (uploadedPatternImages.length === 0) {
        alert("Vui lòng upload ít nhất một ảnh pattern");
        return;
      }

      // Process and save pattern
      // Convert uploadedPatternImages to pattern set format
      const patternImages = uploadedPatternImages.map((img) => ({
        char: img.char,
        filename: img.fileName,
        url: img.url,
      }));

      // Add to patternSets
      const id = `uploaded_${Date.now()}_${Math.random()
        .toString(36)
        .slice(2, 7)}`;
      patternSets.push({
        id,
        name: patternName,
        source: "uploaded",
        images: patternImages,
      });

      // Add to active list automatically
      activePatternSetIds.add(id);

      // Save to localStorage
      if (typeof savePatternSetsToStorage === "function") {
        savePatternSetsToStorage();
      }

      // Invalidate cache
      invalidateCharMapForSet(id);

      // Update UI
      if (typeof rebuildSetsList === "function") rebuildSetsList();
      if (typeof rebuildImageGrid === "function") rebuildImageGrid();
      if (typeof rebuildAvailablePatternsList === "function")
        rebuildAvailablePatternsList();

      // Update order list if rotate mode is on
      if (rotateMode) {
        // Update patternSetOrder to match patternSets order (filtered by selected sets)
        patternSetOrder = patternSets
          .filter((set) => selectedSetIds.has(set.id))
          .map((set) => set.id);
      }

      // Refresh UI
      const textInput = document.getElementById("text");
      if (textInput && textInput.value && typeof refreshUI === "function") {
        refreshUI();
      }

      // Update pattern preview after saving
      updatePatternPreview();

      // Reset upload section to normal state
      resetUploadSection();

      // Close modal and show success
      closePatternFormModal();
      alert(`✅ Pattern "${patternName}" đã được lưu thành công!`);
    });
  }

  // Handle modal upload
  if (modalUploadBtn && modalUploadInput) {
    modalUploadBtn.addEventListener("click", async function () {
      const files = Array.from(modalUploadInput.files || []);
      if (!files.length) {
        alert("Vui lòng chọn thư mục chứa ảnh trước khi upload");
        return;
      }

      // Get pattern name for folder
      const patternNameInput = document.getElementById("patternNameInput");
      const patternName = patternNameInput ? patternNameInput.value.trim() : "";

      if (!patternName) {
        alert("Vui lòng nhập tên pattern trước khi upload ảnh");
        return;
      }

      // Check if pattern name already exists
      if (isPatternNameExists(patternName)) {
        alert("⚠️ Tên pattern này đã được sử dụng! Vui lòng chọn tên khác.");
        patternNameInput.focus();
        return;
      }

      // Sanitize folder name (remove special characters, spaces)
      const folderName = sanitizeFolderName(patternName);

      // Filter only image files
      const imageFiles = files.filter((file) => file.type.startsWith("image/"));

      if (imageFiles.length === 0) {
        alert("Không tìm thấy ảnh nào trong thư mục");
        return;
      }

      // Show loading
      modalUploadBtn.disabled = true;
      modalUploadBtn.textContent = `⏳ Đang upload ${imageFiles.length} ảnh...`;
      const modalUploadStatus = document.getElementById("modalUploadStatus");
      const modalUploadProgress = document.getElementById(
        "modalUploadProgress"
      );
      const modalProgressBar = document.getElementById("modalProgressBar");
      const modalProgressText = document.getElementById("modalProgressText");

      if (modalUploadStatus) {
        modalUploadStatus.style.display = "block";
        modalUploadStatus.textContent = `Đang upload ${imageFiles.length} ảnh...`;
        modalUploadStatus.style.color = "#666";
      }
      if (modalUploadProgress) modalUploadProgress.style.display = "block";
      if (modalProgressBar) modalProgressBar.style.width = "0%";
      if (modalProgressText)
        modalProgressText.textContent = `0 / ${imageFiles.length}`;

      const newUploadedImages = [];
      let successCount = 0;
      let failCount = 0;

      // Upload all files
      for (let i = 0; i < imageFiles.length; i++) {
        const file = imageFiles[i];
        try {
          const imageUrl = await uploadImage(file, folderName);
          if (imageUrl) {
            // Extract character from filename
            const name = file.name || "";
            const base = name.replace(/\.[^.]+$/, "");
            const ch = (base[0] || "").toUpperCase();

            newUploadedImages.push({
              char: ch,
              fileName: file.name,
              url: imageUrl,
              preview: imageUrl,
              success: true,
            });
            successCount++;
          } else {
            failCount++;
          }
        } catch (error) {
          console.error("Upload error for", file.name, ":", error);
          failCount++;
        }

        // Update progress
        const progress = ((i + 1) / imageFiles.length) * 100;
        if (modalProgressBar) modalProgressBar.style.width = progress + "%";
        if (modalProgressText)
          modalProgressText.textContent = `${i + 1} / ${imageFiles.length}`;
      }

      // Hide progress
      if (modalUploadProgress) modalUploadProgress.style.display = "none";

      if (successCount > 0) {
        // Add to uploadedPatternImages
        uploadedPatternImages.push(...newUploadedImages);

        if (modalUploadStatus) {
          modalUploadStatus.textContent = `✅ Upload thành công ${successCount}/${
            imageFiles.length
          } ảnh${failCount > 0 ? ` (${failCount} thất bại)` : ""}`;
          modalUploadStatus.style.color = "#28a745";
        }

        // Update upload preview (pattern vừa upload)
        updateUploadPreview();
      } else {
        if (modalUploadStatus) {
          modalUploadStatus.textContent = "❌ Upload thất bại tất cả ảnh.";
          modalUploadStatus.style.color = "#dc3545";
        }
      }

      // Reset button
      modalUploadBtn.disabled = false;
      modalUploadBtn.textContent = "📤 Upload toàn bộ ảnh";
    });
  }
}
