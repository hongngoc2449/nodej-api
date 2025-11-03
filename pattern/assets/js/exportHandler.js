// Export image functionality

// Helper function to get actual content bounds (crop transparent padding)
function getImageBounds(img) {
  const canvas = document.createElement("canvas");
  canvas.width = img.naturalWidth;
  canvas.height = img.naturalHeight;
  const ctx = canvas.getContext("2d");
  ctx.drawImage(img, 0, 0);

  const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const data = imageData.data;

  let minX = canvas.width;
  let minY = canvas.height;
  let maxX = 0;
  let maxY = 0;

  // Find bounding box of non-transparent pixels
  for (let y = 0; y < canvas.height; y++) {
    for (let x = 0; x < canvas.width; x++) {
      const alpha = data[(y * canvas.width + x) * 4 + 3];
      if (alpha > 0) {
        minX = Math.min(minX, x);
        minY = Math.min(minY, y);
        maxX = Math.max(maxX, x);
        maxY = Math.max(maxY, y);
      }
    }
  }

  // If no content found, return original dimensions
  if (minX > maxX || minY > maxY) {
    return {
      x: 0,
      y: 0,
      width: img.naturalWidth,
      height: img.naturalHeight,
    };
  }

  return {
    x: minX,
    y: minY,
    width: maxX - minX + 1,
    height: maxY - minY + 1,
  };
}

// Helper function to crop image to content bounds
function cropImageToContent(img, bounds) {
  const canvas = document.createElement("canvas");
  canvas.width = bounds.width;
  canvas.height = bounds.height;
  const ctx = canvas.getContext("2d");

  // Draw only the content area (crop transparent padding)
  ctx.drawImage(
    img,
    bounds.x,
    bounds.y,
    bounds.width,
    bounds.height,
    0,
    0,
    bounds.width,
    bounds.height
  );

  const croppedImg = new Image();
  croppedImg.src = canvas.toDataURL();

  return new Promise((resolve) => {
    croppedImg.onload = () => resolve(croppedImg);
    croppedImg.onerror = () => resolve(img); // Fallback to original if crop fails
  });
}

async function loadImagesForExport(words) {
  // Use original image dimensions but crop transparent padding
  // This ensures characters are drawn close together without gaps
  const imageData = [];
  for (const word of words) {
    const wordImages = [];
    for (const item of word) {
      if (!item.missing && (item.filename || item.url)) {
        const imgPromise = new Promise(async (resolve, reject) => {
          try {
            const img = new Image();
            img.crossOrigin = "anonymous";
            await new Promise((imgResolve, imgReject) => {
              img.onload = imgResolve;
              img.onerror = imgReject;
              img.src = getImageSrc(item);
            });

            // Crop transparent padding
            const bounds = getImageBounds(img);
            const croppedImg = await cropImageToContent(img, bounds);

            resolve({
              image: croppedImg,
              char: item.char,
              width: bounds.width,
              height: bounds.height,
            });
          } catch (err) {
            reject(err);
          }
        });
        wordImages.push(imgPromise);
      } else {
        wordImages.push(
          Promise.resolve({
            image: null,
            char: item.char,
            width: 60,
            height: 60,
            isMissing: true,
          })
        );
      }
    }
    imageData.push(wordImages);
  }
  return Promise.all(imageData.map((word) => Promise.all(word)));
}

function calculateCanvasDimensions(
  loadedWords,
  characterSpacing = 0,
  wordSpacing = 40
) {
  let maxHeight = 0;

  loadedWords.forEach((word) => {
    word.forEach((item) => {
      maxHeight = Math.max(maxHeight, item.height || 60);
    });
  });

  let totalWidth = 0;
  loadedWords.forEach((word, wordIndex) => {
    const wordWidth = word.reduce((sum, item) => sum + (item.width || 60), 0);
    totalWidth += wordWidth;

    // Add character spacing within word (between characters)
    const charCountInWord = word.length;
    if (charCountInWord > 1) {
      totalWidth += characterSpacing * (charCountInWord - 1);
    }

    // Add word spacing between words
    if (wordIndex < loadedWords.length - 1) {
      totalWidth += wordSpacing;
    }
  });

  return { width: totalWidth, height: maxHeight, wordSpacing };
}

function drawPatternsToCanvas(
  ctx,
  loadedWords,
  wordSpacing,
  characterSpacing = 0
) {
  ctx.fillStyle = "#FFFFFF";
  ctx.fillRect(0, 0, ctx.canvas.width, ctx.canvas.height);

  let x = 0;
  loadedWords.forEach((word, wordIndex) => {
    word.forEach((item, charIndex) => {
      if (item.isMissing) {
        ctx.fillStyle = "#FFCCCC";
        ctx.fillRect(x, 0, item.width, item.height);
        ctx.fillStyle = "#CC3333";
        ctx.font = `${item.height * 0.6}px Arial`;
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText(item.char, x + item.width / 2, item.height / 2);
      } else {
        // Draw image with its original dimensions
        ctx.drawImage(item.image, x, 0, item.width, item.height);
      }

      // Move to next character position
      x += item.width;

      // Add character spacing after each character (except the last one in the word)
      if (charIndex < word.length - 1) {
        x += characterSpacing;
      }
    });

    // Add spacing between words
    if (wordIndex < loadedWords.length - 1) {
      x += wordSpacing;
    }
  });

  // Debug: verify final x position matches canvas width
  if (Math.abs(x - ctx.canvas.width) > 1) {
    console.warn(
      `Canvas width mismatch: expected ${ctx.canvas.width}, got ${x}`
    );
  }
}

function downloadCanvasAsImage(canvas, filename) {
  canvas.toBlob((blob) => {
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, "image/png");
}

// Store canvas for download and export data
let exportCanvas = null;
let exportFilename = "";
let exportLoadedWords = null;
let exportWords = null;

function openExportPreviewModal() {
  const modal = document.getElementById("exportPreviewModal");
  if (!modal) return;
  modal.style.display = "flex";
}

function closeExportPreviewModal() {
  const modal = document.getElementById("exportPreviewModal");
  if (!modal) return;
  modal.style.display = "none";
  // Clear canvas and data
  exportCanvas = null;
  exportFilename = "";
  exportLoadedWords = null;
  exportWords = null;

  // Reset spacing to defaults
  const characterSpacingInput = document.getElementById(
    "characterSpacingInput"
  );
  const characterSpacingValue = document.getElementById(
    "characterSpacingValue"
  );
  const wordSpacingInput = document.getElementById("wordSpacingInput");
  const wordSpacingValue = document.getElementById("wordSpacingValue");

  if (characterSpacingInput) characterSpacingInput.value = 0;
  if (characterSpacingValue) characterSpacingValue.textContent = 0;
  if (wordSpacingInput) wordSpacingInput.value = 40;
  if (wordSpacingValue) wordSpacingValue.textContent = 40;
}

async function exportImage() {
  const textInput = document.getElementById("text");
  const getText = () => (textInput ? textInput.value : "");
  const text = getText();
  if (!text || !text.trim()) {
    alert("Vui lòng nhập text trước khi xuất hình ảnh");
    return;
  }

  const result = convertTextToImages(text);
  if (result.length === 0) {
    alert("Không có ký tự nào để xuất");
    return;
  }

  const words = groupIntoWords(result);
  const exportImageBtn = document.getElementById("exportImageBtn");

  // Show loading
  if (exportImageBtn) {
    exportImageBtn.textContent = "⏳ Đang tạo...";
    exportImageBtn.disabled = true;
  }

  try {
    const loadedWords = await loadImagesForExport(words);

    // Store loaded words and words for preview updates
    exportLoadedWords = loadedWords;
    exportWords = words;

    // Get initial spacing values
    const characterSpacing = parseInt(
      document.getElementById("characterSpacingInput")?.value || 0
    );
    const wordSpacing = parseInt(
      document.getElementById("wordSpacingInput")?.value || 40
    );

    const { width, height } = calculateCanvasDimensions(
      loadedWords,
      characterSpacing,
      wordSpacing
    );

    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d");

    drawPatternsToCanvas(ctx, loadedWords, wordSpacing, characterSpacing);

    // Store canvas and filename for download
    exportCanvas = canvas;
    exportFilename = `pattern-${text.trim().replace(/\s+/g, "-")}.png`;

    // Display preview in modal
    updatePreview();

    // Open preview modal
    openExportPreviewModal();
  } catch (error) {
    console.error("Error exporting image:", error);
    alert("Có lỗi xảy ra khi xuất hình ảnh: " + error.message);
  } finally {
    if (exportImageBtn) {
      exportImageBtn.textContent = "📥 Xuất hình ảnh";
      exportImageBtn.disabled = false;
    }
  }
}

function updatePreview() {
  if (!exportLoadedWords || !exportWords) return;

  // Get spacing values from inputs
  const characterSpacingInput = document.getElementById(
    "characterSpacingInput"
  );
  const wordSpacingInput = document.getElementById("wordSpacingInput");

  const characterSpacing = characterSpacingInput
    ? parseInt(characterSpacingInput.value) || 0
    : 0;
  const wordSpacing = wordSpacingInput
    ? parseInt(wordSpacingInput.value) || 40
    : 40;

  // Note: Value displays are updated immediately in event handlers to avoid lag

  // Recalculate canvas dimensions with new spacing
  const { width, height } = calculateCanvasDimensions(
    exportLoadedWords,
    characterSpacing,
    wordSpacing
  );

  // Create new canvas with updated dimensions
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");

  // Clear and redraw with new spacing
  drawPatternsToCanvas(ctx, exportLoadedWords, wordSpacing, characterSpacing);

  // Update preview canvas - ensure it's cleared first
  const previewCanvas = document.getElementById("exportPreviewCanvas");
  if (previewCanvas) {
    // Set new dimensions
    previewCanvas.width = canvas.width;
    previewCanvas.height = canvas.height;

    // Clear and redraw
    const previewCtx = previewCanvas.getContext("2d");
    previewCtx.clearRect(0, 0, previewCanvas.width, previewCanvas.height);
    previewCtx.drawImage(canvas, 0, 0);
  }

  // Update stored canvas for download
  exportCanvas = canvas;
}

function saveExportImage() {
  if (!exportCanvas || !exportFilename) {
    alert("Không có hình ảnh để lưu");
    return;
  }

  downloadCanvasAsImage(exportCanvas, exportFilename);
  closeExportPreviewModal();
}

function initExportHandlers() {
  const closeBtn1 = document.getElementById("closeExportPreviewBtn");
  const closeBtn2 = document.getElementById("cancelExportPreviewBtn");
  const saveBtn = document.getElementById("saveExportBtn");
  const modal = document.getElementById("exportPreviewModal");
  const characterSpacingInput = document.getElementById(
    "characterSpacingInput"
  );
  const wordSpacingInput = document.getElementById("wordSpacingInput");

  if (closeBtn1) {
    closeBtn1.addEventListener("click", closeExportPreviewModal);
  }

  if (closeBtn2) {
    closeBtn2.addEventListener("click", closeExportPreviewModal);
  }

  if (saveBtn) {
    saveBtn.addEventListener("click", saveExportImage);
  }

  // Update value display immediately, but debounce preview rendering
  const updateValueDisplay = () => {
    const characterSpacingInput = document.getElementById(
      "characterSpacingInput"
    );
    const wordSpacingInput = document.getElementById("wordSpacingInput");
    const characterSpacingValue = document.getElementById(
      "characterSpacingValue"
    );
    const wordSpacingValue = document.getElementById("wordSpacingValue");

    if (characterSpacingValue && characterSpacingInput) {
      characterSpacingValue.textContent = characterSpacingInput.value;
    }
    if (wordSpacingValue && wordSpacingInput) {
      wordSpacingValue.textContent = wordSpacingInput.value;
    }
  };

  // Debounce preview update to reduce lag with many characters
  const debouncedUpdatePreview = debounce(updatePreview, 150);

  // Handle character spacing slider changes
  if (characterSpacingInput) {
    characterSpacingInput.addEventListener("input", () => {
      updateValueDisplay();
      debouncedUpdatePreview();
    });
  }

  // Handle word spacing slider changes
  if (wordSpacingInput) {
    wordSpacingInput.addEventListener("input", () => {
      updateValueDisplay();
      debouncedUpdatePreview();
    });
  }

  // Close on overlay click
  if (modal) {
    modal.addEventListener("click", function (e) {
      if (e.target === modal) {
        closeExportPreviewModal();
      }
    });
  }
}
