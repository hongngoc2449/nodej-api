// Upload image functionality

async function uploadImage(file, folderName = "test") {
  if (!file) {
    return null;
  }

  const fileName = file.name;
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
        "Content-Type": file.type,
        "x-amz-acl": "public-read",
      },
      body: file,
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

      const uploadedUrls = [];
      let successCount = 0;
      let failCount = 0;

      // Upload all files
      for (let i = 0; i < imageFiles.length; i++) {
        const file = imageFiles[i];
        try {
          const imageUrl = await uploadImage(file);
          if (imageUrl) {
            uploadedUrls.push({
              fileName: file.name,
              url: imageUrl,
              success: true,
            });
            successCount++;
          } else {
            uploadedUrls.push({
              fileName: file.name,
              url: null,
              success: false,
            });
            failCount++;
          }
        } catch (error) {
          console.error("Upload error for", file.name, ":", error);
          uploadedUrls.push({
            fileName: file.name,
            url: null,
            success: false,
          });
          failCount++;
        }

        // Update progress
        const progress = ((i + 1) / imageFiles.length) * 100;
        progressBar.style.width = progress + "%";
        progressText.textContent = `${i + 1} / ${imageFiles.length}`;
      }

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
