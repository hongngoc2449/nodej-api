// Pattern Form Modal Management

let uploadedPatternImages = []; // Store uploaded images with URLs (preview only)
let pendingPatternFiles = []; // Store file objects for actual upload when saving

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
    pendingPatternFiles = []; // Reset pending files

    // Reset upload section to normal state
    resetUploadSection();

    // Ensure action buttons are enabled
    const saveBtn = document.getElementById("savePatternBtn");
    const cancelBtn = document.getElementById("cancelPatternFormBtn");
    if (saveBtn) saveBtn.disabled = false;
    if (cancelBtn) cancelBtn.disabled = false;

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

    // Revoke Object URLs before clearing
    pendingPatternFiles.forEach((item) => {
      if (item.objectUrl) {
        try {
          URL.revokeObjectURL(item.objectUrl);
        } catch (e) {
          console.warn("Error revoking URL:", e);
        }
      }
    });
    pendingPatternFiles = [];

    updatePatternPreview();
    updateUploadPreview();
    resetUploadSection();

    // Re-enable buttons for next open
    const saveBtn = document.getElementById("savePatternBtn");
    const cancelBtn = document.getElementById("cancelPatternFormBtn");
    if (saveBtn) saveBtn.disabled = false;
    if (cancelBtn) cancelBtn.disabled = false;
  }
}

// Reset upload section to normal state
function resetUploadSection() {
  // Reset upload input
  const modalUploadInput = document.getElementById("modalUploadImageInput");
  if (modalUploadInput) {
    modalUploadInput.value = "";
  }

  // No button needed anymore - removed

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

  // Clear uploaded images and revoke Object URLs
  pendingPatternFiles.forEach((item) => {
    if (item.objectUrl) {
      try {
        URL.revokeObjectURL(item.objectUrl);
      } catch (e) {
        console.warn("Error revoking URL:", e);
      }
    }
  });

  uploadedPatternImages = [];
  pendingPatternFiles = [];
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
        <div class="pattern-preview-item" style="border-color: #059669; background: #ecfdf5;">
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
          isA ? 'style="border-color: #059669; background: #ecfdf5;"' : ""
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
    form.addEventListener("submit", async function (e) {
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

      if (pendingPatternFiles.length === 0) {
        alert("Vui lòng chọn folder pattern trước khi lưu");
        return;
      }

      // Disable form during upload
      const saveBtn = document.getElementById("savePatternBtn");
      const cancelBtn = document.getElementById("cancelPatternFormBtn");
      if (saveBtn) saveBtn.disabled = true;
      if (cancelBtn) cancelBtn.disabled = true;

      // Show upload progress
      const modalUploadStatus = document.getElementById("modalUploadStatus");
      const modalUploadProgress = document.getElementById(
        "modalUploadProgress"
      );
      const modalProgressBar = document.getElementById("modalProgressBar");
      const modalProgressText = document.getElementById("modalProgressText");

      if (modalUploadStatus) {
        modalUploadStatus.style.display = "block";
        modalUploadStatus.textContent = `Đang upload ${pendingPatternFiles.length} ảnh lên server...`;
        modalUploadStatus.style.color = "#666";
      }
      if (modalUploadProgress) modalUploadProgress.style.display = "block";
      if (modalProgressBar) modalProgressBar.style.width = "0%";
      if (modalProgressText)
        modalProgressText.textContent = `0 / ${pendingPatternFiles.length}`;

      // Sanitize folder name - format: /pattern/tên bộ pattern
      const sanitized = sanitizeFolderName(patternName);
      const folderName = `pattern/${sanitized}`;

      // Step 1: Convert all images to WebP in parallel
      if (modalUploadStatus) {
        modalUploadStatus.textContent = `🔄 Đang chuyển đổi ${pendingPatternFiles.length} ảnh sang WebP...`;
        modalUploadStatus.style.color = "#666";
      }

      const filesToConvert = pendingPatternFiles.map((item) => item.file);
      const webpFiles = await convertImagesToWebPBatch(
        filesToConvert,
        0.9,
        (current, total) => {
          const progress = (current / total) * 100;
          if (modalProgressBar) modalProgressBar.style.width = progress + "%";
          if (modalProgressText)
            modalProgressText.textContent = `Chuyển đổi: ${current} / ${total}`;
        }
      );

      // Step 2: Prepare file items for batch upload
      const fileItems = pendingPatternFiles.map((item, index) => ({
        webpFile: webpFiles[index],
        originalName: item.file.name,
        char: item.char,
      }));

      // Step 3: Upload all files in parallel batches (concurrency: 3)
      if (modalUploadStatus) {
        modalUploadStatus.textContent = `📤 Đang upload ${pendingPatternFiles.length} ảnh lên server...`;
      }

      let uploadedUrls = [];
      let successCount = 0;
      let failCount = 0;

      try {
        const uploadResults = await uploadImagesBatch(
          fileItems,
          folderName,
          3, // Upload 3 files concurrently
          (current, total) => {
            const progress = (current / total) * 100;
            if (modalProgressBar) modalProgressBar.style.width = progress + "%";
            if (modalProgressText)
              modalProgressText.textContent = `Upload: ${current} / ${total}`;
          }
        );

        // Transform results to match expected format
        uploadedUrls = uploadResults.map((result) => ({
          char: result.char,
          fileName: result.fileName,
          url: result.url,
        }));

        successCount = uploadResults.filter((item) => item.success).length;
        failCount = uploadResults.filter((item) => !item.success).length;

        // Hide progress
        if (modalUploadProgress) modalUploadProgress.style.display = "none";

        if (successCount === 0) {
          alert("❌ Upload thất bại tất cả ảnh. Vui lòng thử lại.");
          if (saveBtn) saveBtn.disabled = false;
          if (cancelBtn) cancelBtn.disabled = false;
          if (modalUploadStatus) {
            modalUploadStatus.textContent = "❌ Upload thất bại tất cả ảnh.";
            modalUploadStatus.style.color = "#dc3545";
          }
          return;
        }

        if (failCount > 0) {
          if (
            !confirm(
              `⚠️ Upload thành công ${successCount}/${pendingPatternFiles.length} ảnh (${failCount} thất bại). Bạn có muốn tiếp tục lưu pattern không?`
            )
          ) {
            if (saveBtn) saveBtn.disabled = false;
            if (cancelBtn) cancelBtn.disabled = false;
            return;
          }
        }

        // Process and save pattern
        const patternImages = uploadedUrls.map((img) => ({
          char: img.char,
          url: img.url,
        }));

        // Step 4: Create and upload preview image
        let previewImageUrl = null;
        if (typeof mergePatternImages === "function" && patternImages.length > 0) {
          try {
            if (modalUploadStatus) {
              modalUploadStatus.textContent = "🖼️ Đang tạo preview image...";
              modalUploadStatus.style.color = "#666";
            }

            // Create merged preview image
            const previewImageFile = await mergePatternImages(patternImages, 150, 2);
            
            // Upload preview image
            previewImageUrl = await uploadWebPFile(previewImageFile, folderName);
            
            if (previewImageUrl && modalUploadStatus) {
              modalUploadStatus.textContent = "✅ Đã tạo preview image";
              modalUploadStatus.style.color = "#28a745";
            }
          } catch (error) {
            console.warn("Failed to create preview image:", error);
            // Continue without preview image
          }
        }

        // Add to patternSets
        const id = `uploaded_${Date.now()}_${Math.random()
          .toString(36)
          .slice(2, 7)}`;
        patternSets.push({
          id,
          name: patternName,
          source: "uploaded",
          images: patternImages,
          previewImage: previewImageUrl,
        });

        // Add to active list automatically
        activePatternSetIds.add(id);

        // Save to MongoDB via API
        if (typeof savePatternSetToServer === "function") {
          savePatternSetToServer({ 
            name: patternName, 
            images: patternImages,
            previewImage: previewImageUrl 
          }).then((saved) => {
            if (saved && saved.id) {
              // Optionally replace the just-pushed local set with the server-saved ID
              const idx = patternSets.findIndex((s) => s.name === patternName && s.source === "uploaded");
              if (idx >= 0) {
                patternSets[idx].id = saved.id;
                if (saved.previewImage) {
                  patternSets[idx].previewImage = saved.previewImage;
                }
              }
            }
          });
        }

        // Invalidate cache
        invalidateCharMapForSet(id);

        // Revoke Object URLs after successful upload
        pendingPatternFiles.forEach((item) => {
          if (item.objectUrl) {
            try {
              URL.revokeObjectURL(item.objectUrl);
            } catch (e) {
              console.warn("Error revoking URL:", e);
            }
          }
        });

        // Update UI
        if (typeof rebuildSetsList === "function") rebuildSetsList();
        if (typeof rebuildImageGrid === "function") rebuildImageGrid();
        if (typeof rebuildAvailablePatternsList === "function")
          rebuildAvailablePatternsList();

        // Update order list if rotate mode is on
        if (rotateMode) {
          // Update patternSetOrder to match patternSets order (filtered by active sets)
          patternSetOrder = patternSets
            .filter((set) => activePatternSetIds.has(set.id))
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
      } catch (error) {
        console.error("Error during save:", error);
        alert("❌ Có lỗi xảy ra khi lưu pattern: " + error.message);
        if (saveBtn) saveBtn.disabled = false;
        if (cancelBtn) cancelBtn.disabled = false;
        if (modalUploadProgress) modalUploadProgress.style.display = "none";
        if (modalUploadStatus) {
          modalUploadStatus.textContent = "❌ Có lỗi xảy ra khi lưu pattern.";
          modalUploadStatus.style.color = "#dc3545";
        }
      }
    });
  }

  // Handle file input change - automatically load and preview when folder is selected
  if (modalUploadInput) {
    modalUploadInput.addEventListener("change", function () {
      const files = Array.from(this.files || []);
      if (!files.length) {
        return;
      }

      // Filter only image files
      const imageFiles = files.filter((file) => file.type.startsWith("image/"));

      if (imageFiles.length === 0) {
        const modalUploadStatus = document.getElementById("modalUploadStatus");
        if (modalUploadStatus) {
          modalUploadStatus.style.display = "block";
          modalUploadStatus.textContent =
            "⚠️ Không tìm thấy ảnh nào trong thư mục";
          modalUploadStatus.style.color = "#dc3545";
        }
        return;
      }

      // Revoke previous Object URLs
      pendingPatternFiles.forEach((item) => {
        if (item.objectUrl) {
          try {
            URL.revokeObjectURL(item.objectUrl);
          } catch (e) {
            console.warn("Error revoking URL:", e);
          }
        }
      });

      // Clear previous data
      uploadedPatternImages = [];
      pendingPatternFiles = [];

      // Process files: create Object URLs for preview
      const modalUploadStatus = document.getElementById("modalUploadStatus");
      const modalUploadProgress = document.getElementById(
        "modalUploadProgress"
      );

      // Hide progress (not uploading yet)
      if (modalUploadProgress) modalUploadProgress.style.display = "none";

      // Process each file
      imageFiles.forEach((file) => {
        // Extract character from filename
        const name = file.name || "";
        const base = name.replace(/\.[^.]+$/, "");
        const ch = (base[0] || "").toUpperCase();

        // Only process supported characters
        if (!isSupportedChar(ch)) return;

        // Check if character already exists
        if (pendingPatternFiles.some((item) => item.char === ch)) {
          return; // Skip duplicate characters
        }

        // Create Object URL for preview
        const objectUrl = URL.createObjectURL(file);

        const imageData = {
          char: ch,
          fileName: file.name,
          preview: objectUrl,
          url: null, // Will be set after actual upload
        };

        uploadedPatternImages.push(imageData);
        pendingPatternFiles.push({
          char: ch,
          file: file,
          objectUrl: objectUrl,
        });
      });

      if (uploadedPatternImages.length === 0) {
        if (modalUploadStatus) {
          modalUploadStatus.style.display = "block";
          modalUploadStatus.textContent =
            "⚠️ Không tìm thấy ảnh hợp lệ (chỉ hỗ trợ A-Z, 0-9)";
          modalUploadStatus.style.color = "#dc3545";
        }
        return;
      }

      // Show status
      if (modalUploadStatus) {
        modalUploadStatus.style.display = "block";
        modalUploadStatus.textContent = `✅ Đã tải ${uploadedPatternImages.length} ảnh. Ấn "Lưu Pattern" để upload lên server.`;
        modalUploadStatus.style.color = "#28a745";
      }

      // Update upload preview (showing local preview)
      updateUploadPreview();
    });
  }
}
