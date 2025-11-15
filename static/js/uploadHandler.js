// Upload image functionality

/**
 * Convert image file to WebP format
 * @param {File} file - Original image file
 * @param {number} quality - WebP quality (0-1), default 0.9
 * @returns {Promise<File>} - WebP file or original file if conversion fails
 */
async function convertImageToWebP(file, quality = 0.9) {
  // If already WebP, return as is
  if (file.type === "image/webp") {
    return file;
  }

  // If not an image, return as is
  if (!file.type.startsWith("image/")) {
    return file;
  }

  try {
    // Create image element
    const img = new Image();
    const objectUrl = URL.createObjectURL(file);
    
    await new Promise((resolve, reject) => {
      img.onload = resolve;
      img.onerror = reject;
      img.src = objectUrl;
    });

    // Create canvas
    const canvas = document.createElement("canvas");
    canvas.width = img.naturalWidth;
    canvas.height = img.naturalHeight;
    
    // Draw image to canvas
    const ctx = canvas.getContext("2d");
    ctx.drawImage(img, 0, 0);
    
    // Convert to WebP blob
    const webpBlob = await new Promise((resolve, reject) => {
      canvas.toBlob(
        (blob) => {
          if (blob) {
            resolve(blob);
          } else {
            reject(new Error("Failed to convert to WebP"));
          }
        },
        "image/webp",
        quality
      );
    });

    // Clean up object URL
    URL.revokeObjectURL(objectUrl);

    // Create new File object with .webp extension
    const originalName = file.name.replace(/\.[^.]+$/, ""); // Remove original extension
    const webpFileName = `${originalName}.webp`;
    const webpFile = new File([webpBlob], webpFileName, {
      type: "image/webp",
      lastModified: Date.now(),
    });

    return webpFile;
  } catch (error) {
    console.warn("⚠️ Failed to convert to WebP, using original file:", error);
    // Return original file if conversion fails
    return file;
  }
}

/**
 * Convert multiple images to WebP in parallel
 * @param {File[]} files - Array of image files
 * @param {number} quality - WebP quality (0-1), default 0.9
 * @param {Function} onProgress - Progress callback (current, total)
 * @returns {Promise<File[]>} - Array of WebP files
 */
async function convertImagesToWebPBatch(files, quality = 0.9, onProgress = null) {
  // Convert all images in parallel
  const conversionPromises = files.map((file, index) => 
    convertImageToWebP(file, quality).then((webpFile) => {
      if (onProgress) {
        onProgress(index + 1, files.length);
      }
      return { original: file, webp: webpFile, index };
    })
  );

  const results = await Promise.all(conversionPromises);
  
  // Sort by original index to maintain order
  results.sort((a, b) => a.index - b.index);
  
  return results.map(r => r.webp);
}

async function uploadImage(file, folderName = "test") {
  if (!file) {
    return null;
  }

  // Convert to WebP before upload
  const webpFile = await convertImageToWebP(file);
  const fileName = webpFile.name;
  const folder = folderName || "test";

  try {
    // Get upload URL with timeout
    const controller1 = new AbortController();
    const timeoutId1 = setTimeout(() => controller1.abort(), 10000);

    const res = await fetch(
      `https://qr.stability.ltd/upfileocean?fileName=${encodeURIComponent(fileName)}&folder=${encodeURIComponent(folder)}`,
      { signal: controller1.signal }
    );
    clearTimeout(timeoutId1);

    if (!res.ok) {
      throw new Error(`Failed to get upload URL: ${res.status}`);
    }

    const data = await res.json();

    // Upload file with timeout
    const controller2 = new AbortController();
    const timeoutId2 = setTimeout(() => controller2.abort(), 30000);

    const putRes = await fetch(data.url, {
      method: "PUT",
      headers: {
        "Content-Type": "image/webp",
        "x-amz-acl": "public-read",
      },
      body: webpFile,
      signal: controller2.signal,
    });
    clearTimeout(timeoutId2);

    if (putRes.ok) {
      const fileUrl = data.url.split("?")[0];
      return fileUrl;
    } else {
      console.error("❌ Upload failed with status:", putRes.status);
      return null;
    }
  } catch (err) {
    if (err.name === "AbortError") {
      console.error("❌ Upload timeout");
    } else {
      console.error("❌ Upload error:", err);
    }
    return null;
  }
}

/**
 * Upload a single WebP file (without conversion)
 * @param {File} webpFile - WebP file to upload
 * @param {string} folderName - Folder name
 * @returns {Promise<string|null>} - Uploaded file URL or null
 */
async function uploadWebPFile(webpFile, folderName = "test") {
  if (!webpFile) {
    return null;
  }

  const fileName = webpFile.name;
  const folder = folderName || "test";

  try {
    // Get upload URL with timeout
    const controller1 = new AbortController();
    const timeoutId1 = setTimeout(() => controller1.abort(), 10000);

    const res = await fetch(
      `https://qr.stability.ltd/upfileocean?fileName=${encodeURIComponent(fileName)}&folder=${encodeURIComponent(folder)}`,
      { signal: controller1.signal }
    );
    clearTimeout(timeoutId1);

    if (!res.ok) {
      throw new Error(`Failed to get upload URL: ${res.status}`);
    }

    const data = await res.json();

    // Upload file with timeout
    const controller2 = new AbortController();
    const timeoutId2 = setTimeout(() => controller2.abort(), 30000);

    const putRes = await fetch(data.url, {
      method: "PUT",
      headers: {
        "Content-Type": "image/webp",
        "x-amz-acl": "public-read",
      },
      body: webpFile,
      signal: controller2.signal,
    });
    clearTimeout(timeoutId2);

    if (putRes.ok) {
      const fileUrl = data.url.split("?")[0];
      return fileUrl;
    } else {
      console.error("❌ Upload failed with status:", putRes.status);
      return null;
    }
  } catch (err) {
    if (err.name === "AbortError") {
      console.error("❌ Upload timeout");
    } else {
      console.error("❌ Upload error:", err);
    }
    return null;
  }
}

/**
 * Upload multiple files with concurrency limit
 * @param {Array<{file: File, originalName: string, char?: string}>} fileItems - Array of file items
 * @param {string} folderName - Folder name
 * @param {number} concurrency - Max concurrent uploads (default: 3)
 * @param {Function} onProgress - Progress callback (current, total)
 * @returns {Promise<Array<{char?: string, fileName: string, url: string|null, success: boolean}>>}
 */
async function uploadImagesBatch(fileItems, folderName = "test", concurrency = 3, onProgress = null) {
  const results = [];
  const total = fileItems.length;
  let completed = 0;

  // Process in batches
  for (let i = 0; i < fileItems.length; i += concurrency) {
    const batch = fileItems.slice(i, i + concurrency);
    
    // Upload batch in parallel
    const batchPromises = batch.map(async (item) => {
      try {
        const url = await uploadWebPFile(item.webpFile, folderName);
        completed++;
        if (onProgress) {
          onProgress(completed, total);
        }
        return {
          char: item.char,
          fileName: item.originalName,
          url: url,
          success: !!url,
        };
      } catch (error) {
        completed++;
        if (onProgress) {
          onProgress(completed, total);
        }
        console.error("Upload error for", item.originalName, ":", error);
        return {
          char: item.char,
          fileName: item.originalName,
          url: null,
          success: false,
        };
      }
    });

    const batchResults = await Promise.all(batchPromises);
    results.push(...batchResults);
  }

  return results;
}

/**
 * Merge multiple pattern images into a single preview image
 * @param {Array<{url: string, char: string}>} images - Array of image objects with URL and char
 * @param {number} targetHeight - Target height in pixels (default: 150)
 * @param {number} spacing - Spacing between images in pixels (default: 2)
 * @returns {Promise<File>} - Merged image as WebP File
 */
async function mergePatternImages(images, targetHeight = 150, spacing = 2) {
  if (!images || images.length === 0) {
    throw new Error("No images to merge");
  }

  // Load all images
  const loadedImages = await Promise.all(
    images.map((img) => {
      return new Promise((resolve, reject) => {
        const image = new Image();
        image.crossOrigin = "anonymous";
        image.onload = () => resolve({ image, char: img.char });
        image.onerror = reject;
        image.src = img.url;
      });
    })
  );

  // Calculate dimensions
  const imageCount = loadedImages.length;
  const totalSpacing = spacing * (imageCount - 1);
  let totalWidth = 0;
  const imageHeights = [];

  // Calculate width for each image maintaining aspect ratio
  loadedImages.forEach(({ image }) => {
    const aspectRatio = image.naturalWidth / image.naturalHeight;
    const width = targetHeight * aspectRatio;
    totalWidth += width;
    imageHeights.push({ width, height: targetHeight });
  });

  // Create canvas
  const canvas = document.createElement("canvas");
  canvas.width = totalWidth + totalSpacing;
  canvas.height = targetHeight;
  const ctx = canvas.getContext("2d");

  // Fill white background
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  // Draw images side by side
  let currentX = 0;
  loadedImages.forEach(({ image }, index) => {
    const { width, height } = imageHeights[index];
    ctx.drawImage(image, currentX, 0, width, height);
    currentX += width + spacing;
  });

  // Convert to WebP blob
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (blob) {
          const fileName = `pattern-preview-${Date.now()}.webp`;
          const file = new File([blob], fileName, {
            type: "image/webp",
            lastModified: Date.now(),
          });
          resolve(file);
        } else {
          reject(new Error("Failed to create preview image"));
        }
      },
      "image/webp",
      0.9
    );
  });
}

function initUploadHandlers() {
  const uploadImageBtn = document.getElementById("uploadImageBtn");
  const uploadImageInput = document.getElementById("uploadImageInput");
  const uploadStatus = document.getElementById("uploadStatus");
  const uploadResult = document.getElementById("uploadResult");
  const uploadProgress = document.getElementById("uploadProgress");
  const progressBar = document.getElementById("progressBar");
  const progressText = document.getElementById("progressText");
  const uploadedImagesList = document.getElementById("uploadedImagesList");
  const copyAllUrlsBtn = document.getElementById("copyAllUrlsBtn");

  // Handle upload button click
  if (uploadImageBtn && uploadImageInput) {
    uploadImageBtn.addEventListener("click", async function () {
      const files = Array.from(uploadImageInput.files || []);
      if (!files.length) {
        alert("Vui lòng chọn thư mục chứa ảnh trước khi upload");
        return;
      }

      // Filter only image files
      const imageFiles = files.filter((file) => file.type.startsWith("image/"));

      if (imageFiles.length === 0) {
        alert("Không tìm thấy ảnh nào trong thư mục");
        return;
      }

      // Show loading
      uploadImageBtn.disabled = true;
      uploadImageBtn.textContent = `⏳ Đang upload ${imageFiles.length} ảnh...`;
      uploadStatus.style.display = "block";
      uploadStatus.textContent = `Đang upload ${imageFiles.length} ảnh...`;
      uploadStatus.style.color = "#666";
      uploadResult.style.display = "none";
      uploadProgress.style.display = "block";
      progressBar.style.width = "0%";
      progressText.textContent = `0 / ${imageFiles.length}`;

      // Step 1: Convert all images to WebP in parallel
      uploadStatus.textContent = `🔄 Đang chuyển đổi ${imageFiles.length} ảnh sang WebP...`;
      uploadStatus.style.color = "#666";
      
      const webpFiles = await convertImagesToWebPBatch(
        imageFiles,
        0.9,
        (current, total) => {
          const progress = (current / total) * 100;
          progressBar.style.width = progress + "%";
          progressText.textContent = `Chuyển đổi: ${current} / ${total}`;
        }
      );

      // Step 2: Prepare file items for batch upload
      const fileItems = imageFiles.map((file, index) => ({
        webpFile: webpFiles[index],
        originalName: file.name,
      }));

      // Step 3: Upload all files in parallel batches (concurrency: 3)
      uploadStatus.textContent = `📤 Đang upload ${imageFiles.length} ảnh lên server...`;
      const uploadedUrls = await uploadImagesBatch(
        fileItems,
        "test",
        3, // Upload 3 files concurrently
        (current, total) => {
          const progress = (current / total) * 100;
          progressBar.style.width = progress + "%";
          progressText.textContent = `Upload: ${current} / ${total}`;
        }
      );

      const successCount = uploadedUrls.filter((item) => item.success).length;
      const failCount = uploadedUrls.filter((item) => !item.success).length;

      // Hide progress, show results
      uploadProgress.style.display = "none";

      if (successCount > 0) {
        uploadStatus.textContent = `✅ Upload thành công ${successCount}/${
          imageFiles.length
        } ảnh${failCount > 0 ? ` (${failCount} thất bại)` : ""}`;
        uploadStatus.style.color = "#28a745";

        // Display uploaded images list
        uploadedImagesList.innerHTML = uploadedUrls
          .map(
            (item) => `
            <div style="margin-bottom: 10px; padding: 10px; background: ${
              item.success ? "#f0f9ff" : "#fee"
            }; border-radius: 8px; border: 1px solid ${
              item.success ? "#bfdbfe" : "#fcc"
            };">
              <div style="font-weight: 600; margin-bottom: 5px; color: #333;">${
                item.fileName
              }</div>
              ${
                item.success
                  ? `<input type="text" value="${item.url}" readonly style="width: 100%; padding: 6px; border: 1px solid #bfdbfe; border-radius: 6px; font-size: 12px; background: white;" />
                     <button class="copy-single-url" data-url="${item.url}" style="margin-top: 5px; padding: 4px 8px; background: #059669; color: white; border: none; border-radius: 4px; cursor: pointer; font-size: 11px;">📋 Copy</button>`
                  : `<div style="color: #c33; font-size: 12px;">❌ Upload thất bại</div>`
              }
            </div>
          `
          )
          .join("");

        // Attach copy buttons for individual URLs
        uploadedImagesList
          .querySelectorAll(".copy-single-url")
          .forEach((btn) => {
            btn.addEventListener("click", function () {
              const url = this.dataset.url;
              navigator.clipboard.writeText(url).then(() => {
                const originalText = this.textContent;
                this.textContent = "✅ Đã copy!";
                setTimeout(() => {
                  this.textContent = originalText;
                }, 2000);
              });
            });
          });

        uploadResult.style.display = "block";
      } else {
        uploadStatus.textContent = "❌ Upload thất bại tất cả ảnh.";
        uploadStatus.style.color = "#dc3545";
        uploadResult.style.display = "none";
      }

      // Reset button
      uploadImageBtn.disabled = false;
      uploadImageBtn.textContent = "📤 Upload toàn bộ ảnh";
    });
  }

  // Handle copy all URLs button
  if (copyAllUrlsBtn) {
    copyAllUrlsBtn.addEventListener("click", function () {
      const urlInputs =
        uploadedImagesList.querySelectorAll('input[type="text"]');
      if (urlInputs.length === 0) {
        alert("Không có URL nào để copy");
        return;
      }

      const allUrls = Array.from(urlInputs)
        .map((input) => input.value)
        .join("\n");

      navigator.clipboard.writeText(allUrls).then(() => {
        const originalText = copyAllUrlsBtn.textContent;
        copyAllUrlsBtn.textContent = "✅ Đã copy tất cả!";
        setTimeout(() => {
          copyAllUrlsBtn.textContent = originalText;
        }, 2000);
      });
    });
  }
}
