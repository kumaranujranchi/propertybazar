import { convex } from "./convex.js";
import { requireAuth, getToken } from "./auth.js";

// Watermark SVG (uses the provided favicon.svg content)
const WATERMARK_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">\n  <rect width="100" height="100" rx="20" fill="#e84118"/>\n  <text x="50%" y="50%" dominant-baseline="central" text-anchor="middle" font-family="Poppins, sans-serif" font-weight="800" font-size="60" fill="white">24</text>\n</svg>`;

// Apply an SVG watermark onto an image File and return a new File (WebP)
function applyWatermark(file, svgString, options = {}) {
  const {
    scale = 0.12,
    margin = 12,
    maxWidth = 120,
    opacity = 0.6,
    quality = 0.9,
  } = options;
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = (ev) => {
      const img = new Image();
      img.src = ev.target.result;
      img.onload = () => {
        try {
          const canvas = document.createElement("canvas");
          canvas.width = img.width;
          canvas.height = img.height;
          const ctx = canvas.getContext("2d");
          ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

          const svgDataUrl =
            "data:image/svg+xml;charset=utf-8," + encodeURIComponent(svgString);
          const svgImg = new Image();
          svgImg.onload = () => {
            const intrinsicW = svgImg.naturalWidth || 100;
            const intrinsicH = svgImg.naturalHeight || 100;
            let wmWidth = Math.round(canvas.width * scale);
            if (maxWidth) wmWidth = Math.min(wmWidth, maxWidth);
            const ratio = intrinsicW / intrinsicH || 1;
            const wmHeight = Math.round(wmWidth / ratio);
            const x = canvas.width - wmWidth - margin;
            const y = canvas.height - wmHeight - margin;
            ctx.globalAlpha = opacity;
            ctx.drawImage(svgImg, x, y, wmWidth, wmHeight);
            ctx.globalAlpha = 1;

            canvas.toBlob(
              (blob) => {
                if (!blob)
                  return reject(new Error("Failed to create watermarked blob"));
                const ext = file.name.replace(/\.[^/.]+$/, "") + ".webp";
                const newFile = new File([blob], ext, {
                  type: "image/webp",
                  lastModified: Date.now(),
                });
                resolve(newFile);
              },
              "image/webp",
              quality,
            );
          };
          svgImg.onerror = (e) => {
            // If SVG fails to load, fall back to original file
            resolve(file);
          };
          svgImg.src = svgDataUrl;
        } catch (err) {
          resolve(file);
        }
      };
      img.onerror = () => resolve(file);
    };
    reader.onerror = () =>
      reject(new Error("Failed to read image file for watermarking"));
  });
}

// ========== PHOTO HANDLING ==========
const photoFileInput = document.getElementById("photoFileInput");
const photoUploadArea = document.getElementById("photoUploadArea");
const photoPreviewGrid = document.getElementById("photoPreviewGrid");
const selectedFiles = []; // Stores processed Files (watermarked + compressed)
const originalFiles = []; // Stores original Files for re-cropping
const selectedVideos = []; // Added for video gallery
let selectedBrochureFile = null;
let existingBrochure = null;

if (photoFileInput) {
  const cameraFileInput = document.getElementById("cameraFileInput");

  photoUploadArea.addEventListener("click", (e) => {
    if (
      e.target === photoUploadArea ||
      e.target.classList.contains("photo-upload-icon") ||
      e.target.classList.contains("photo-upload-text") ||
      e.target.classList.contains("photo-upload-sub")
    ) {
      photoFileInput.click();
    }
  });

  if (cameraFileInput) {
    cameraFileInput.addEventListener("change", () => {
      handleFiles([...cameraFileInput.files]);
      cameraFileInput.value = "";
    });
  }

  // Toggle custom input visibility when 'Custom' is selected for bhk
  document.addEventListener('change', (e) => {
    if (!e.target) return;
    if (e.target.classList && e.target.classList.contains('config-bhk')) {
      const sel = e.target;
      const row = sel.closest('.config-row');
      if (!row) return;
      const custom = row.querySelector('.config-custom');
      if (sel.value === 'Custom') custom.style.display = 'block';
      else custom.style.display = 'none';
    }
  });

  // Upload button for floorplans (delegated)
  document.addEventListener('click', (e) => {
    const btn = e.target.closest && e.target.closest('.btn-upload-floorplan');
    if (!btn) return;
    const row = btn.closest('.config-row');
    if (!row) return;
    const input = row.querySelector('input.config-floorplan');
    if (input) input.click();
  });

  // Floorplan image preview (delegated change on file inputs)
  document.addEventListener('change', (e) => {
    if (!e.target.classList.contains('config-floorplan')) return;
    const input = e.target;
    const row = input.closest('.config-row');
    if (!row) return;
    const previews = row.querySelector('.config-floorplan-previews');
    if (!previews) return;
    const max = Number(input.getAttribute('data-max') || 2);
    const files = Array.from(input.files).slice(0, max);
    previews.innerHTML = '';
    files.forEach((file, idx) => {
      const url = URL.createObjectURL(file);
      const thumb = document.createElement('div');
      thumb.className = 'fp-thumb';
      thumb.innerHTML = `<img src="${url}" alt="Floor plan ${idx + 1}"><button type="button" class="fp-remove" title="Remove">✕</button>`;
      thumb.querySelector('.fp-remove').addEventListener('click', () => {
        thumb.remove();
        // Clear the file input so the removed image won't be uploaded
        input.value = '';
      });
      previews.appendChild(thumb);
    });
  });
  photoUploadArea.addEventListener("dragover", (e) => {
    e.preventDefault();
    photoUploadArea.style.borderColor = "var(--primary)";
  });
  photoUploadArea.addEventListener("dragleave", () => {
    photoUploadArea.style.borderColor = "";
  });
  photoUploadArea.addEventListener("drop", (e) => {
    e.preventDefault();
    photoUploadArea.style.borderColor = "";
    handleFiles([...e.dataTransfer.files]);
  });
  photoFileInput.addEventListener("change", () => {
    handleFiles([...photoFileInput.files]);
    photoFileInput.value = "";
  });

  // Video Gallery Listeners
  const videoFileInput = document.getElementById("videoFileInput");
  const videoUploadArea = document.getElementById("videoUploadArea");
  if (videoFileInput && videoUploadArea) {
    videoUploadArea.addEventListener("dragover", (e) => {
      e.preventDefault();
      videoUploadArea.style.borderColor = "var(--primary)";
    });
    videoUploadArea.addEventListener("dragleave", () => {
      videoUploadArea.style.borderColor = "";
    });
    videoUploadArea.addEventListener("drop", (e) => {
      e.preventDefault();
      videoUploadArea.style.borderColor = "";
      handleFiles([...e.dataTransfer.files], "video");
    });
    videoFileInput.addEventListener("change", () => {
      handleFiles([...videoFileInput.files], "video");
      videoFileInput.value = "";
    });
  }

  // Brochure file handlers
  const brochureFileInput = document.getElementById('brochureFileInput');
  const brochureUploadArea = document.getElementById('brochureUploadArea');
  const brochurePreview = document.getElementById('brochurePreview');
  const brochureUploadText = document.getElementById('brochureUploadText');
  const removeBrochureBtn = document.getElementById('removeBrochureBtn');

  if (brochureFileInput) {
    brochureFileInput.addEventListener('change', () => {
      const f = brochureFileInput.files[0];
      if (!f) return;
      if (f.type !== 'application/pdf') {
        window.showToast('Only PDF brochures are allowed.', 'error');
        brochureFileInput.value = '';
        return;
      }
      if (f.size > 10 * 1024 * 1024) {
        window.showToast('Brochure size exceeds 10MB limit.', 'error');
        brochureFileInput.value = '';
        return;
      }
      selectedBrochureFile = f;
      brochureUploadText.textContent = f.name;
      brochurePreview.style.display = 'block';
      brochurePreview.textContent = `${(f.size/1024/1024).toFixed(2)} MB · ${f.name}`;
      if (removeBrochureBtn) removeBrochureBtn.style.display = 'inline-block';
    });
  }

  if (removeBrochureBtn) {
    removeBrochureBtn.addEventListener('click', () => {
      selectedBrochureFile = null;
      existingBrochure = null;
      brochureFileInput.value = '';
      brochureUploadText.textContent = 'No brochure uploaded';
      brochurePreview.style.display = 'none';
      removeBrochureBtn.style.display = 'none';
    });
  }
}

function compressImage(file, maxWidth = 1200, maxHeight = 1200, quality = 0.8) {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = (event) => {
      const img = new Image();
      img.src = event.target.result;
      img.onload = () => {
        let width = img.width;
        let height = img.height;

        if (width > height) {
          if (width > maxWidth) {
            height = Math.round((height *= maxWidth / width));
            width = maxWidth;
          }
        } else {
          if (height > maxHeight) {
            width = Math.round((width *= maxHeight / height));
            height = maxHeight;
          }
        }

        const canvas = document.createElement("canvas");
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext("2d");
        ctx.drawImage(img, 0, 0, width, height);

        canvas.toBlob(
          (blob) => {
            // Create a new File object from the WebP blob
            const newFile = new File(
              [blob],
              file.name.replace(/\.[^/.]+$/, ".webp"),
              {
                type: "image/webp",
                lastModified: Date.now(),
              },
            );
            resolve(newFile);
          },
          "image/webp",
          quality,
        );
      };
    };
  });
}

async function handleFiles(files, type = "photo") {
  const isVideo = type === "video";
  const valid = files.filter((f) =>
    isVideo ? f.type.startsWith("video/") : f.type.startsWith("image/"),
  );

  if (isVideo) {
    if (selectedVideos.length >= 1) {
      window.showToast(
        "Only 1 property video is allowed in the free plan. You can add up to 10 YouTube links.",
        "warning",
      );
      return;
    }
    const file = valid[0];
    if (!file) return;

    if (file.size > 20 * 1024 * 1024) {
      window.showToast(
        "Video size exceeds 20MB limit. Please compress or use a YouTube link.",
        "error",
      );
      return;
    }

    selectedVideos.push(file);
    addPreview(file, selectedVideos.length - 1, "video");
  } else {
    const currentCount = selectedFiles.length;
    const remaining = 20 - currentCount;
    const toProcess = valid.slice(0, remaining);

    const uploadArea = photoUploadArea;
    if (uploadArea) uploadArea.style.opacity = "0.5";

    for (const file of toProcess) {
      const compressedFile = await compressImage(file);
      const watermarkedFile = await applyWatermark(
        compressedFile,
        WATERMARK_SVG,
      );
      selectedFiles.push(watermarkedFile);
      originalFiles.push(file); // Store original for cropping
      addPreview(watermarkedFile, selectedFiles.length - 1, "photo");
    }
    if (uploadArea) uploadArea.style.opacity = "1";
  }
}

let cropper = null;
function openCropModal(index) {
  const modal = document.getElementById("cropModal");
  const cropImageTarget = document.getElementById("cropImageTarget");
  const btnApply = document.getElementById("btnApplyCrop");
  const btnCancel = document.getElementById("btnCancelCrop");
  const originalFile = originalFiles[index];

  if (!originalFile || !modal || !cropImageTarget) return;

  const reader = new FileReader();
  reader.onload = (e) => {
    cropImageTarget.src = e.target.result;
    modal.classList.add("open");

    if (cropper) cropper.destroy();
    cropper = new Cropper(cropImageTarget, {
      aspectRatio: 3 / 2,
      viewMode: 2,
      autoCropArea: 1,
    });
  };
  reader.readAsDataURL(originalFile);

  const closeCropModal = () => {
    modal.classList.remove("open");
    if (cropper) {
      cropper.destroy();
      cropper = null;
    }
  };

  btnCancel.onclick = closeCropModal;

  btnApply.onclick = async () => {
    if (!cropper) return;
    const canvas = cropper.getCroppedCanvas({
      maxWidth: 1600,
      maxHeight: 1600,
    });

    canvas.toBlob(async (blob) => {
      const croppedFile = new File([blob], originalFile.name.replace(/\.[^/.]+$/, "") + "_cropped.webp", {
        type: "image/webp",
      });

      // Show loading toast or something?
      const compressedFile = await compressImage(croppedFile);
      const watermarkedFile = await applyWatermark(compressedFile, WATERMARK_SVG);

      selectedFiles[index] = watermarkedFile;

      // Update preview UI
      const card = photoPreviewGrid.querySelector(`.preview-card[data-index="${index}"]`);
      if (card) {
        const img = card.querySelector("img");
        if (img) img.src = URL.createObjectURL(watermarkedFile);
      }

      closeCropModal();
      window.showToast("Image cropped successfully!", "success");
    }, "image/webp", 0.9);
  };
}

const photoCategories = [
  "Project Image",
  "Amenities",
  "Sample Flat",
  "Location",
  "Room",
  "Kitchen",
  "Bathroom",
  "Living Room",
  "Master Plan",
  "Floor Plan",
];
const videoCategories = [
  "Project Video",
  "3D Visualization",
  "Location Video",
  "Sample Flat",
];

function addPreview(file, index, type = "photo") {
  const isVideo = type === "video";
  const reader = new FileReader();
  reader.onload = (e) => {
    const grid = isVideo
      ? document.getElementById("videoPreviewGrid")
      : photoPreviewGrid;
    const wrap = document.createElement("div");
    wrap.className = "preview-card";
    wrap.style.cssText =
      "position:relative; background:#fff; border-radius:12px; overflow:hidden; border:1px solid var(--border); padding:8px; display:flex; flex-direction:column; gap:8px;";
    wrap.dataset.index = index;

    // Media Element
    if (isVideo) {
      const video = document.createElement("video");
      video.src = e.target.result;
      video.style.cssText =
        "width:100%; height:100px; object-fit:cover; border-radius:6px;";
      wrap.appendChild(video);
    } else {
      const img = document.createElement("img");
      img.src = e.target.result;
      img.style.cssText =
        "width:100%; height:100px; object-fit:cover; border-radius:6px;";
      wrap.appendChild(img);
    }

    // Category Selector
    const select = document.createElement("select");
    select.className = "form-input";
    select.style.cssText =
      "font-size:11px; padding:4px 8px; height:auto; border-radius:6px;";
    const categories = isVideo ? videoCategories : photoCategories;
    categories.forEach((cat) => {
      const opt = document.createElement("option");
      opt.value = cat;
      opt.textContent = cat;
      select.appendChild(opt);
    });
    wrap.appendChild(select);

    // Cover Photo Checkbox (Photos only)
    if (!isVideo) {
      const coverLabel = document.createElement("label");
      coverLabel.className = "cover-selector-label";
      coverLabel.style.cssText =
        "font-size:10px; display:flex; align-items:center; gap:6px; cursor:pointer; padding:6px 8px; background:#f8fafc; border-radius:6px; border:1px solid #e2e8f0; transition:all 0.2s;";

      const radio = document.createElement("input");
      radio.type = "radio";
      radio.name = "coverPhoto";
      radio.className = "cover-radio-input";
      radio.style.margin = "0";
      radio.value = index;

      // Handle custom "isCover" property if provided in a future refactor or current data
      if (
        file.isCover ||
        (index === 0 && !grid.querySelector('input[name="coverPhoto"]:checked'))
      ) {
        radio.checked = true;
        coverLabel.style.borderColor = "var(--primary)";
        coverLabel.style.background = "rgba(232, 65, 24, 0.05)";
      }

      radio.addEventListener("change", () => {
        // Update styling for all labels in this grid
        grid.querySelectorAll(".cover-selector-label").forEach((lbl) => {
          lbl.style.borderColor = "#e2e8f0";
          lbl.style.background = "#f8fafc";
          lbl.querySelector("span").textContent = "Set as Thumbnail";
          lbl.querySelector("span").style.color = "var(--text-muted)";
        });
        if (radio.checked) {
          coverLabel.style.borderColor = "var(--primary)";
          coverLabel.style.background = "rgba(232, 65, 24, 0.05)";
          coverLabel.querySelector("span").textContent = "Main Cover Photo";
          coverLabel.querySelector("span").style.color = "var(--primary)";
        }
      });

      const labelText = document.createElement("span");
      labelText.textContent = radio.checked
        ? "Main Cover Photo"
        : "Set as Thumbnail";
      labelText.style.fontWeight = "600";
      if (radio.checked) labelText.style.color = "var(--primary)";

      coverLabel.appendChild(radio);
      coverLabel.appendChild(labelText);
      wrap.appendChild(coverLabel);
    }

    const removeBtn = document.createElement("div");
    removeBtn.textContent = "✕";
    removeBtn.style.cssText =
      "position:absolute; top:4px; right:4px; background:rgba(232,65,24,0.9); color:#fff; font-size:10px; cursor:pointer; width:18px; height:18px; display:flex; align-items:center; justify-content:center; border-radius:50%; z-index:11;";
    removeBtn.addEventListener("click", () => {
      const arr = isVideo ? selectedVideos : selectedFiles;
      const idx = parseInt(wrap.dataset.index);
      arr.splice(idx, 1);
      if (!isVideo) originalFiles.splice(idx, 1);
      wrap.remove();
      // Re-index remaining cards
      const container = isVideo ? document.getElementById("videoPreviewGrid") : photoPreviewGrid;
      container.querySelectorAll(".preview-card").forEach((c, i) => {
        c.dataset.index = i;
        const radio = c.querySelector('input[type="radio"]');
        if (radio) radio.value = i;
      });
    });
    wrap.appendChild(removeBtn);

    // Crop Button (Photos only)
    if (!isVideo) {
      const cropBtn = document.createElement("div");
      cropBtn.innerHTML = '<i class="fa-solid fa-crop-simple"></i> Crop';
      cropBtn.style.cssText =
        "position:absolute; top:4px; left:4px; background:rgba(0,0,0,0.6); color:#fff; font-size:10px; cursor:pointer; padding:2px 8px; border-radius:4px; display:flex; align-items:center; gap:4px; z-index:11; font-weight:600;";
      cropBtn.onclick = () => openCropModal(parseInt(wrap.dataset.index));
      wrap.appendChild(cropBtn);
    }
    grid.appendChild(wrap);
  };
  reader.readAsDataURL(file);
}

// Function to add existing storage IDs as "files" for preview
// Function to add existing storage IDs as "files" for preview
async function addExistingPhoto(photoObj) {
  const storageId =
    typeof photoObj === "object" ? photoObj.storageId : photoObj;
  const category = photoObj.category || "Project Image";
  const isCover = photoObj.isCover || false;

  try {
    const url = await convex.query("properties:getPhotoUrl", { storageId });
    if (!url) return;

    const wrap = document.createElement("div");
    wrap.className = "preview-card";
    wrap.style.cssText =
      "position:relative; background:#fff; border-radius:12px; overflow:hidden; border:1px solid var(--border); padding:8px; display:flex; flex-direction:column; gap:8px;";
    wrap.dataset.storageId = storageId;

    const img = document.createElement("img");
    img.src = url;
    img.style.cssText =
      "width:100%; height:100px; object-fit:cover; border-radius:6px;";
    wrap.appendChild(img);

    // Category Selector
    const select = document.createElement("select");
    select.className = "form-input";
    select.style.cssText =
      "font-size:11px; padding:4px 8px; height:auto; border-radius:6px;";
    photoCategories.forEach((cat) => {
      const opt = document.createElement("option");
      opt.value = cat;
      opt.textContent = cat;
      if (cat === category) opt.selected = true;
      select.appendChild(opt);
    });
    wrap.appendChild(select);

    // Cover Photo Radio
    const coverLabel = document.createElement("label");
    coverLabel.className = "cover-selector-label";
    coverLabel.style.cssText = `font-size:10px; display:flex; align-items:center; gap:6px; cursor:pointer; padding:6px 8px; border-radius:6px; border:1px solid ${isCover ? "var(--primary)" : "#e2e8f0"}; background: ${isCover ? "rgba(232, 65, 24, 0.05)" : "#f8fafc"}; transition:all 0.2s;`;

    const radio = document.createElement("input");
    radio.type = "radio";
    radio.name = "coverPhoto";
    radio.className = "cover-radio-input";
    radio.style.margin = "0";
    radio.value = "existing-" + storageId;
    if (isCover) radio.checked = true;

    radio.addEventListener("change", () => {
      photoPreviewGrid
        .querySelectorAll(".cover-selector-label")
        .forEach((lbl) => {
          lbl.style.borderColor = "#e2e8f0";
          lbl.style.background = "#f8fafc";
          lbl.querySelector("span").textContent = "Set as Thumbnail";
          lbl.querySelector("span").style.color = "var(--text-muted)";
        });
      if (radio.checked) {
        coverLabel.style.borderColor = "var(--primary)";
        coverLabel.style.background = "rgba(232, 65, 24, 0.05)";
        coverLabel.querySelector("span").textContent = "Main Cover Photo";
        coverLabel.querySelector("span").style.color = "var(--primary)";
      }
    });

    const labelText = document.createElement("span");
    labelText.textContent = isCover ? "Main Cover Photo" : "Set as Thumbnail";
    labelText.style.fontWeight = "600";
    if (isCover) labelText.style.color = "var(--primary)";

    coverLabel.appendChild(radio);
    coverLabel.appendChild(labelText);
    wrap.appendChild(coverLabel);

    const removeBtn = document.createElement("div");
    removeBtn.textContent = "✕";
    removeBtn.style.cssText =
      "position:absolute; top:4px; right:4px; background:rgba(232,65,24,0.9); color:#fff; font-size:10px; cursor:pointer; width:18px; height:18px; display:flex; align-items:center; justify-content:center; border-radius:50%;";
    removeBtn.addEventListener("click", () => wrap.remove());

    wrap.appendChild(removeBtn);
    photoPreviewGrid.appendChild(wrap);
  } catch (e) {
    console.error("Error loading existing photo:", e);
  }
}

// ========== INTERACTIVE FORM LOGIC ==========
function initInteractiveForm() {
  // Poster Type Grid
  const posterTypeGrid = document.getElementById("posterTypeGrid");
  if (posterTypeGrid) {
    const hiddenInput = document.getElementById("posterTypeInput");
    posterTypeGrid.querySelectorAll(".form-type-option").forEach((opt) => {
      opt.addEventListener("click", () => {
        posterTypeGrid
          .querySelectorAll(".form-type-option")
          .forEach((o) => o.classList.remove("active"));
        opt.classList.add("active");
        if (hiddenInput) {
          hiddenInput.value = opt.querySelector(".name").innerText.trim();
        }
      });
    });
  }

  // Segmented Controls (BHK, Status, Room Type)
  document.querySelectorAll(".segmented-control").forEach((control) => {
    const hiddenInput = control.nextElementSibling;
    control.querySelectorAll(".segment-item").forEach((item) => {
      item.addEventListener("click", () => {
        control
          .querySelectorAll(".segment-item")
          .forEach((i) => i.classList.remove("active"));
        item.classList.add("active");
        if (hiddenInput && hiddenInput.type === "hidden") {
          hiddenInput.value = item.dataset.value;
          hiddenInput.dispatchEvent(new Event("change"));
        }

        // Custom BHK Logic
        if (item.dataset.value === "Others" && control.id === "bhkSelector") {
          const customBhk = document.getElementById("fgCustomBhk");
          if (customBhk) customBhk.style.display = "block";
        } else if (control.id === "bhkSelector") {
          const customBhk = document.getElementById("fgCustomBhk");
          if (customBhk) customBhk.style.display = "none";
        }
      });
    });
  });

  // Furnishing Cards
  const furnishingSelector = document.getElementById("furnishingSelector");
  if (furnishingSelector) {
    const hiddenInput = document.getElementById("furnishingStatusSelect");
    furnishingSelector.querySelectorAll(".selection-card").forEach((card) => {
      card.addEventListener("click", () => {
        furnishingSelector
          .querySelectorAll(".selection-card")
          .forEach((c) => c.classList.remove("active"));
        card.classList.add("active");
        if (hiddenInput) {
          hiddenInput.value = card.dataset.value;
          hiddenInput.dispatchEvent(new Event("change"));
        }
      });
    });
  }

  // Facing Grid (Multiple selection possible if we want, but usually one)
  document.querySelectorAll(".facing-grid").forEach((grid) => {
    const hiddenInput = grid.nextElementSibling;
    grid.querySelectorAll(".face-item").forEach((item) => {
      item.addEventListener("click", () => {
        // Toggle active
        item.classList.toggle("active");

        // Update hidden input with comma separated values
        const activeVals = [...grid.querySelectorAll(".face-item.active")].map(
          (i) => i.dataset.value,
        );
        if (hiddenInput) hiddenInput.value = activeVals.join(", ");
      });
    });
  });

  // Amenity Pills
  document.querySelectorAll(".amenity-pill").forEach((pill) => {
    pill.addEventListener("click", () => {
      pill.classList.toggle("active");
    });
  });

  // Visual Category Selector (Step 2)
  const categoryGrid = document.getElementById("categoryVisualSelector");
  if (categoryGrid) {
    const hiddenInput = document.getElementById("propertyCategory");
    categoryGrid.querySelectorAll(".category-visual-item").forEach((item) => {
      item.addEventListener("click", () => {
        categoryGrid
          .querySelectorAll(".category-visual-item")
          .forEach((i) => i.classList.remove("active"));
        item.classList.add("active");
        if (hiddenInput) {
          hiddenInput.value = item.dataset.value;
          hiddenInput.dispatchEvent(new Event("change"));
        }
      });
    });
  }
}

function initGooglePlaces() {
  const input = document.getElementById("googleLocationSearch");
  if (!input || !window.google) return;

  // Sidebar Preview logic
  const mapLinkInput = document.getElementById("googleMapLinkInput");
  if (mapLinkInput) {
    const handleMapInput = () => {
      const url = mapLinkInput.value.trim();
      if (url) updateMapPreview(url);
    };
    mapLinkInput.addEventListener("input", handleMapInput);
    mapLinkInput.addEventListener("paste", () =>
      setTimeout(handleMapInput, 10),
    ); // Small delay for paste
  }

  const autocomplete = new google.maps.places.Autocomplete(input, {
    componentRestrictions: { country: "in" },
    fields: ["address_components", "geometry", "name"],
    types: ["geocode", "establishment"],
  });

  // Listeners for manual fields to update map
  const manualFields = [
    "localityInput",
    "citySelect",
    "stateSelect",
    "pinCodeInput",
  ];
  manualFields.forEach((id) => {
    const el = document.getElementById(id);
    if (el) {
      el.addEventListener("change", () => {
        const locality = document.getElementById("localityInput")?.value;
        const city = document.getElementById("citySelect")?.value;
        if (locality && city) updateMapPreview(`${locality}, ${city}`);
      });
      // Also on blur for text input
      if (el.tagName === "INPUT") {
        el.addEventListener("blur", () => {
          const locality = document.getElementById("localityInput")?.value;
          const city = document.getElementById("citySelect")?.value;
          if (locality && city) updateMapPreview(`${locality}, ${city}`);
        });
      }
    }
  });

  autocomplete.addListener("place_changed", () => {
    const place = autocomplete.getPlace();
    if (!place.geometry) return;

    let state = "",
      city = "",
      pin = "",
      locality = place.name;
    for (const component of place.address_components) {
      const types = component.types;
      if (types.includes("administrative_area_level_1"))
        state = component.long_name;
      if (types.includes("locality")) city = component.long_name;
      if (types.includes("postal_code")) pin = component.long_name;
      if (types.includes("sublocality_level_1")) locality = component.long_name;
    }

    const stateSelect = document.getElementById("stateSelect");
    const citySelect = document.getElementById("citySelect");
    const pinInput = document.querySelector(
      'input[placeholder="6-digit PIN code"]',
    );
    const localityInput = document.querySelector(
      'input[placeholder="e.g. Sector 62, Koramangala"]',
    );

    if (stateSelect) {
      stateSelect.value = state;
      stateSelect.dispatchEvent(new Event("change"));
    }
    if (citySelect) {
      citySelect.value = city;
      citySelect.dispatchEvent(new Event("change"));
    }
    if (pinInput) pinInput.value = pin;
    if (localityInput) localityInput.value = locality;

    // Update Map Preview
    if (place.geometry.location) {
      const lat = place.geometry.location.lat();
      const lng = place.geometry.location.lng();
      updateMapPreview(`${lat},${lng}`);
    }
  });
}

function updateMapPreview(location) {
  const previewCard = document.getElementById("sidebarLocationPreview");
  const iframe = document.getElementById("googleMapIframe");
  const container = document.getElementById("mapPreviewContainer");

  if (!previewCard || !iframe) return;

  let query = location;
  let isUrl = location.includes("http") || location.includes("google.com/maps");
  let isShortUrl =
    location.includes("maps.app.goo.gl") || location.includes("goo.gl/maps");

  // Try to extract useful info from URL
  if (isUrl && !isShortUrl) {
    // 1. Try extracting coordinates from @23.34,85.32 format
    const coordMatch = location.match(/@(-?\d+\.\d+),(-?\d+\.\d+)/);
    if (coordMatch) {
      query = `${coordMatch[1]},${coordMatch[2]}`;
      isUrl = false;
    } else {
      // 2. Try extracting place name from /place/Name+Here/ or /search/Name+Here/
      const placeMatch = location.match(/\/(place|search)\/([^/@?]+)/);
      if (placeMatch) {
        query = decodeURIComponent(placeMatch[2].replace(/\+/g, " "));
        isUrl = false;
      } else {
        // 3. Try extracting from q=lat,lng or q=Name
        const qMatch = location.match(/[?&]q=([^&]+)/);
        if (qMatch) {
          query = decodeURIComponent(qMatch[1].replace(/\+/g, " "));
          isUrl = query.includes("http");
        }
      }
    }
  }

  // FALLBACK: If it's still a URL (short link or unparsed long link), strictly use manual fields for the PREVIEW
  // Passing the URL itself to the iframe 'q' parameter MUST be avoided as it causes "Custom content could not be displayed" error
  if (isUrl || !query || isShortUrl) {
    const locality = document.getElementById("localityInput")?.value;
    const city = document.getElementById("citySelect")?.value;
    const state = document.getElementById("stateSelect")?.value;
    const pin = document.getElementById("pinCodeInput")?.value;

    if (locality && city) {
      query = `${locality}, ${city}${pin ? ", " + pin : ""}`;
    } else if (city) {
      query = `${city}${pin ? ", " + pin : ""}`;
    } else if (pin) {
      query = pin;
    } else if (state && state !== "Select State") {
      query = state;
    } else {
      // No valid plain text address info available.
      // Hiding the iframe to show the placeholder instead of a broken map.
      iframe.src = "";
      container.classList.remove("loaded");
      return;
    }
  }

  // Show the card
  previewCard.style.display = "block";

  // Use the reliable non-API embed URL
  const mapUrl = `https://maps.google.com/maps?q=${encodeURIComponent(query)}&z=14&output=embed`;

  // Only update if source changed to avoid flickering
  if (iframe.src !== mapUrl) {
    container.classList.remove("loaded");
    iframe.src = mapUrl;
    iframe.onload = () => {
      container.classList.add("loaded");
    };
  }
}
window.initGooglePlaces = initGooglePlaces;

// ========== FORM SUBMISSION ==========
document.addEventListener("DOMContentLoaded", async () => {
  initGooglePlaces();
  initInteractiveForm();

  // Detect Edit Mode
  const urlParams = new URLSearchParams(window.location.search);
  const editId = urlParams.get("id");

  // Auth guard - redirect to login if not logged in
  const user = await requireAuth("login.html?redirect=post-property.html");
  if (!user) return;

  // Check free limit - ONLY for new properties
  if (!user.canPostMore && !editId) {
    const submitBtn = document.getElementById("btnSubmitProperty");
    if (submitBtn) {
      // Replace button with Upgrade link
      submitBtn.outerHTML = `
        <a href="pricing.html" class="btn btn-primary btn-lg btn-upgrade" id="btnUpgrade">
          <i class="fa-solid fa-crown"></i> Upgrade to Post More
        </a>
      `;
    }

    // Add a nice info box
    const infoBox = document.createElement("div");
    infoBox.className = "limit-reached-container";
    infoBox.style.marginTop = "24px";
    infoBox.innerHTML = `
      <div class="limit-reached-title" style="color: var(--primary);"><i class="fa-solid fa-circle-exclamation"></i> Listing Limit Reached</div>
      <p class="limit-reached-text">
        You've used your free listing for this 90-day period. <br>
        <b>Upgrade to Premium</b> for only ₹499 to post up to 5 properties and get featured visibility!
      </p>
    `;

    const formActions = document.querySelector("#formStep5 .form-actions");
    if (formActions) {
      formActions.parentElement.insertBefore(infoBox, formActions);
    }
  }

  // Detect Edit Mode (already done above)

  // ========== YOUTUBE LINKS LOGIC ==========
  const addVideoLinkBtn = document.getElementById("addVideoLinkBtn");
  const videoLinksContainer = document.getElementById("videoLinksContainer");

  if (addVideoLinkBtn && videoLinksContainer) {
    addVideoLinkBtn.addEventListener("click", () => {
      const currentLinks =
        videoLinksContainer.querySelectorAll(".video-link-row").length;
      if (currentLinks >= 10) {
        window.showToast("Maximum 10 external video links allowed.", "warning");
        return;
      }

      const newRow = document.createElement("div");
      newRow.className = "video-link-row";
      newRow.style.cssText = "display:flex; gap:10px; margin-bottom:10px";
      newRow.innerHTML = `
        <input type="url" class="form-input video-link-input" placeholder="Paste YouTube/Vimeo link here" style="flex:1">
        <button type="button" class="btn btn-outline btn-sm remove-link-btn" style="padding: 0 15px; color: var(--danger); border-color: var(--danger)" onclick="this.parentElement.remove(); updateRemoveButtons()"><i class="fa-solid fa-trash"></i></button>
      `;
      videoLinksContainer.appendChild(newRow);
      updateRemoveButtons();
    });

    function updateRemoveButtons() {
      const rows = videoLinksContainer.querySelectorAll(".video-link-row");
      rows.forEach((row) => {
        const btn = row.querySelector(".remove-link-btn");
        if (btn) btn.style.display = rows.length > 1 ? "block" : "none";
      });
    }
    window.updateRemoveButtons = updateRemoveButtons;
  }

  const submitBtn = document.getElementById("btnSubmitProperty");
  if (!submitBtn) return;

  if (editId) {
    submitBtn.innerHTML = `<i class="fa-solid fa-floppy-disk"></i> Update Property Details`;
    document.querySelector(".post-hero h1").innerHTML =
      `<i class="fa-solid fa-pen-to-square"></i> Edit Your Property`;
    document.querySelector(".post-hero p").textContent =
      "Update your property details to keep them accurate and attract more buyers.";

    try {
      const prop = await convex.query("properties:getProperty", { id: editId });
      if (prop) {
        // Pre-fill Step 1: Property Types (this is harder due to grid UI)
        // For simplicity, we'll try to find the matching elements
        // Step 1: Types (Transaction & Property)
        document
          .querySelectorAll("#formStep1 .form-type-grid")
          .forEach((grid, gIdx) => {
            let target;
            if (gIdx === 0) target = prop.posterType;
            else if (gIdx === 1) target = prop.transactionType;
            else target = prop.propertyType;

            target = target?.trim()?.toLowerCase();
            if (!target) return;

            grid.querySelectorAll(".form-type-option").forEach((opt) => {
              const optName = opt
                .querySelector(".name")
                ?.innerText?.trim()
                ?.toLowerCase();
              if (optName === target) {
                opt.parentElement
                  .querySelectorAll(".form-type-option")
                  .forEach((el) => el.classList.remove("active"));
                opt.classList.add("active");
              }
            });
          });

        // Step 2: Location
        const stateSelect = document.getElementById("stateSelect");
        const citySelect = document.getElementById("citySelect");
        const manualCityGroup = document.getElementById("manualCityGroup");
        const manualCityInput = document.getElementById("manualCityInput");

        if (stateSelect && prop.location.state) {
          stateSelect.value = prop.location.state;
          stateSelect.dispatchEvent(new Event("change"));

          // Wait for city list to populate (hardcoded in post-property.html script)
          setTimeout(() => {
            if (citySelect) {
              // Try to find the city in the newly populated list
              let cityFound = false;
              for (let i = 0; i < citySelect.options.length; i++) {
                if (citySelect.options[i].value === prop.location.city) {
                  citySelect.selectedIndex = i;
                  cityFound = true;
                  break;
                }
              }

              if (!cityFound && prop.location.city) {
                // If not found, it must be a manual entry
                citySelect.value = "Other";
                citySelect.dispatchEvent(new Event("change"));
                if (manualCityInput) manualCityInput.value = prop.location.city;
              }
            }
          }, 300);
        }

        if (document.getElementById("localityInput"))
          document.getElementById("localityInput").value =
            prop.location.locality || "";
        if (document.getElementById("societyInput"))
          document.getElementById("societyInput").value =
            prop.location.society || "";
        if (document.getElementById("addressInput"))
          document.getElementById("addressInput").value =
            prop.location.fullAddress || "";
        if (document.getElementById("pinCodeInput"))
          document.getElementById("pinCodeInput").value =
            prop.location.pinCode || "";
        if (document.getElementById("landmarkInput"))
          document.getElementById("landmarkInput").value =
            prop.location.landmark || "";
        if (document.getElementById("googleMapLinkInput"))
          document.getElementById("googleMapLinkInput").value =
            prop.location.googleMapLink || "";
        if (document.getElementById("googleLocationSearch"))
          document.getElementById("googleLocationSearch").value =
            prop.location.googleSearch || "";

        // Category pre-fill
        if (prop.details?.category) {
          const catHidden = document.getElementById("propertyCategory");
          if (catHidden) catHidden.value = prop.details.category;
          document
            .querySelectorAll("#categoryVisualSelector .category-visual-item")
            .forEach((item) => {
              if (item.dataset.value === prop.details.category)
                item.classList.add("active");
              else item.classList.remove("active");
            });
        }

        // Distances
        if (document.getElementById("metroDistance"))
          document.getElementById("metroDistance").value =
            prop.location.metroDistance || "";
        if (document.getElementById("schoolDistance"))
          document.getElementById("schoolDistance").value =
            prop.location.schoolDistance || "";
        if (document.getElementById("mallDistance"))
          document.getElementById("mallDistance").value =
            prop.location.mallDistance || "";
        if (document.getElementById("hospitalDistance"))
          document.getElementById("hospitalDistance").value =
            prop.location.hospitalDistance || "";

        // Pre-fill Step 3: Details
        const bhkTypeSelect = document.getElementById("bhkTypeSelect");
        const propertyStatusSelect = document.getElementById(
          "propertyStatusSelect",
        );
        const furnishingStatusSelect = document.getElementById(
          "furnishingStatusSelect",
        );
        const facingSelect = document.getElementById("facingSelect");

        if (bhkTypeSelect && prop.details.bhk) {
          const bhkVal = [
            "1RK",
            "1BHK",
            "2BHK",
            "3BHK",
            "4BHK",
            "4.5BHK",
            "5BHK",
            "6BHK",
          ].includes(prop.details.bhk)
            ? prop.details.bhk
            : "Others";
          bhkTypeSelect.value = bhkVal;
          const bhkItem = document.querySelector(
            `#bhkSelector .segment-item[data-value="${bhkVal}"]`,
          );
          if (bhkItem) {
            document
              .querySelectorAll("#bhkSelector .segment-item")
              .forEach((i) => i.classList.remove("active"));
            bhkItem.classList.add("active");
          }
          if (bhkVal === "Others") {
            if (document.getElementById("fgCustomBhk"))
              document.getElementById("fgCustomBhk").style.display = "block";
            if (document.getElementById("customBhkInput"))
              document.getElementById("customBhkInput").value =
                prop.details.bhk;
          }
        }

        if (propertyStatusSelect && prop.details.status) {
          propertyStatusSelect.value = prop.details.status;
          const statusItem = document.querySelector(
            `#statusSelector .segment-item[data-value="${prop.details.status}"]`,
          );
          if (statusItem) {
            document
              .querySelectorAll("#statusSelector .segment-item")
              .forEach((i) => i.classList.remove("active"));
            statusItem.classList.add("active");
          }
        }

        if (document.getElementById("builtUpAreaInput"))
          document.getElementById("builtUpAreaInput").value =
            prop.details.builtUpArea || "";
        if (document.getElementById("builtUpAreaUnit"))
          document.getElementById("builtUpAreaUnit").value =
            prop.details.builtUpAreaUnit || "Square Foot";
        if (document.getElementById("carpetAreaInput"))
          document.getElementById("carpetAreaInput").value =
            prop.details.carpetArea || "";
        if (document.getElementById("carpetAreaUnit"))
          document.getElementById("carpetAreaUnit").value =
            prop.details.carpetAreaUnit || "Square Foot";
        if (document.getElementById("floorNumberInput"))
          document.getElementById("floorNumberInput").value =
            prop.details.floorNumber !== undefined
              ? prop.details.floorNumber
              : "";
        if (document.getElementById("totalFloorsInput"))
          document.getElementById("totalFloorsInput").value =
            prop.details.totalFloors !== undefined
              ? prop.details.totalFloors
              : "";

        if (furnishingStatusSelect && prop.details.furnishing) {
          furnishingStatusSelect.value = prop.details.furnishing;
          const furnCard = document.querySelector(
            `#furnishingSelector .selection-card[data-value="${prop.details.furnishing}"]`,
          );
          if (furnCard) {
            document
              .querySelectorAll("#furnishingSelector .selection-card")
              .forEach((c) => c.classList.remove("active"));
            furnCard.classList.add("active");
          }
        }

        if (facingSelect) {
          facingSelect.value = prop.details.facing || "";
          document
            .querySelectorAll(".face-item")
            .forEach((fi) => fi.classList.remove("active"));
          if (prop.details.facing) {
            prop.details.facing.split(", ").forEach((f) => {
              const faceItem = document.querySelector(
                `.face-item[data-value="${f}"]`,
              );
              if (faceItem) faceItem.classList.add("active");
            });
          }
        }

        if (document.getElementById("parkingSelect"))
          document.getElementById("parkingSelect").value =
            prop.details.parking || "";
        if (document.getElementById("constructionYearInput"))
          document.getElementById("constructionYearInput").value =
            prop.details.constructionYear || "";
        if (document.getElementById("reraInput"))
          document.getElementById("reraInput").value = prop.details.rera || "";
        if (document.getElementById("descriptionInput"))
          document.getElementById("descriptionInput").value =
            prop.details.description || "";

        // Pre-fill Villa / House Specific
        if (document.getElementById("propertyTitleInput"))
          document.getElementById("propertyTitleInput").value =
            prop.details.propertyTitle || "";
        if (document.getElementById("ownershipTypeSelect"))
          document.getElementById("ownershipTypeSelect").value =
            prop.details.ownershipType || "";
        if (document.getElementById("bathroomsSelect"))
          document.getElementById("bathroomsSelect").value =
            prop.details.bathrooms || "";
        if (document.getElementById("balconiesSelect"))
          document.getElementById("balconiesSelect").value =
            prop.details.balconies !== undefined ? prop.details.balconies : "";

        if (document.getElementById("cbStudyRoom"))
          document.getElementById("cbStudyRoom").checked =
            !!prop.details.studyRoom;
        if (document.getElementById("cbServantRoom"))
          document.getElementById("cbServantRoom").checked =
            !!prop.details.servantRoom;
        if (document.getElementById("cbPoojaRoom"))
          document.getElementById("cbPoojaRoom").checked =
            !!prop.details.poojaRoom;
        if (document.getElementById("cbStoreRoom"))
          document.getElementById("cbStoreRoom").checked =
            !!prop.details.storeRoom;
        if (document.getElementById("cbBasement"))
          document.getElementById("cbBasement").checked =
            !!prop.details.basement;

        if (document.getElementById("floorConfigInput"))
          document.getElementById("floorConfigInput").value =
            prop.details.floorConfig || "";
        if (document.getElementById("plotAreaInput"))
          document.getElementById("plotAreaInput").value =
            prop.details.plotArea || "";
        if (document.getElementById("plotAreaUnit"))
          document.getElementById("plotAreaUnit").value =
            prop.details.plotAreaUnit || "Square Foot";
        if (document.getElementById("plotRateUnit"))
          document.getElementById("plotRateUnit").value =
            prop.details.plotRateUnit ||
            prop.details.plotAreaUnit ||
            "Square Foot";
        if (document.getElementById("plotRateUnit"))
          document
            .getElementById("plotRateUnit")
            .dispatchEvent(new Event("change"));
        if (document.getElementById("superBuiltUpAreaInput"))
          document.getElementById("superBuiltUpAreaInput").value =
            prop.details.superBuiltUpArea || "";
        if (document.getElementById("superBuiltUpAreaUnit"))
          document.getElementById("superBuiltUpAreaUnit").value =
            prop.details.superBuiltUpAreaUnit || "Square Foot";
        if (document.getElementById("openAreaInput"))
          document.getElementById("openAreaInput").value =
            prop.details.openArea || "";
        if (document.getElementById("frontageWidthInput"))
          document.getElementById("frontageWidthInput").value =
            prop.details.frontageWidth || "";
        if (document.getElementById("roadWidthInput"))
          document.getElementById("roadWidthInput").value =
            prop.details.roadWidth || "";
        if (document.getElementById("ageOfPropertySelect"))
          document.getElementById("ageOfPropertySelect").value =
            prop.details.ageOfProperty || "";
        if (document.getElementById("constructionQualitySelect"))
          document.getElementById("constructionQualitySelect").value =
            prop.details.constructionQuality || "";
        if (document.getElementById("flooringTypeInput"))
          document.getElementById("flooringTypeInput").value =
            prop.details.flooringType || "";
        if (document.getElementById("wallFinishInput"))
          document.getElementById("wallFinishInput").value =
            prop.details.wallFinish || "";
        if (document.getElementById("ceilingHeightInput"))
          document.getElementById("ceilingHeightInput").value =
            prop.details.ceilingHeight || "";
        if (document.getElementById("waterSourceSelect"))
          document.getElementById("waterSourceSelect").value =
            prop.details.waterSource || "";
        if (document.getElementById("electricityLoadInput"))
          document.getElementById("electricityLoadInput").value =
            prop.details.electricityLoad || "";
        if (document.getElementById("openParkingSelect"))
          document.getElementById("openParkingSelect").value =
            prop.details.openParking || "";
        if (document.getElementById("cbGarage"))
          document.getElementById("cbGarage").checked = !!prop.details.garage;
        if (document.getElementById("cbEvCharging"))
          document.getElementById("cbEvCharging").checked =
            !!prop.details.evCharging;
        if (document.getElementById("approvalAuthorityInput"))
          document.getElementById("approvalAuthorityInput").value =
            prop.details.approvalAuthority || "";
        if (document.getElementById("propertyTaxStatusSelect"))
          document.getElementById("propertyTaxStatusSelect").value =
            prop.details.propertyTaxStatus || "";
        if (document.getElementById("loanApprovedInput"))
          document.getElementById("loanApprovedInput").value =
            prop.details.loanApproved || "";
        if (document.getElementById("cbOccupancyCert"))
          document.getElementById("cbOccupancyCert").checked =
            !!prop.details.occupancyCertificate;
        if (document.getElementById("cbCompletionCert"))
          document.getElementById("cbCompletionCert").checked =
            !!prop.details.completionCertificate;

        // Pre-fill Commercial
        if (document.getElementById("commercialTypeSelect"))
          document.getElementById("commercialTypeSelect").value =
            prop.details.commercialType || "";
        if (document.getElementById("commercialGradeSelect"))
          document.getElementById("commercialGradeSelect").value =
            prop.details.grade || "";
        if (document.getElementById("commercialOwnershipSelect"))
          document.getElementById("commercialOwnershipSelect").value =
            prop.details.ownershipType || "";
        if (document.getElementById("commercialCeilingHeight"))
          document.getElementById("commercialCeilingHeight").value =
            prop.details.ceilingHeight || "";
        if (document.getElementById("commercialFrontage"))
          document.getElementById("commercialFrontage").value =
            prop.details.frontage || "";
        if (document.getElementById("commercialRoadWidth"))
          document.getElementById("commercialRoadWidth").value =
            prop.details.roadWidth || "";
        if (document.getElementById("commercialSuperArea"))
          document.getElementById("commercialSuperArea").value =
            prop.details.superBuiltUpArea || "";
        if (document.getElementById("commercialSuperAreaUnit"))
          document.getElementById("commercialSuperAreaUnit").value =
            prop.details.superBuiltUpAreaUnit || "Square Foot";
        if (document.getElementById("commercialFurnishing"))
          document.getElementById("commercialFurnishing").value =
            prop.details.furnishing || "";
        if (document.getElementById("commercialWorkstations"))
          document.getElementById("commercialWorkstations").value =
            prop.details.workstations || "";
        if (document.getElementById("commercialCabins"))
          document.getElementById("commercialCabins").value =
            prop.details.cabins || "";
        if (document.getElementById("commercialMeetingRooms"))
          document.getElementById("commercialMeetingRooms").value =
            prop.details.meetingRooms || "";
        if (document.getElementById("commercialWashrooms"))
          document.getElementById("commercialWashrooms").value =
            prop.details.washrooms || "";
        if (document.getElementById("commercialAcType"))
          document.getElementById("commercialAcType").value =
            prop.details.acType || "";
        if (document.getElementById("commercialPowerBackup"))
          document.getElementById("commercialPowerBackup").value =
            prop.details.powerBackupCapacity || "";
        if (document.getElementById("commercialRetailFloor"))
          document.getElementById("commercialRetailFloor").value =
            prop.details.retailFloor || "";
        if (document.getElementById("commercialFootfallZone"))
          document.getElementById("commercialFootfallZone").value =
            prop.details.footfallZone || "";
        if (document.getElementById("commercialMallHighStreet"))
          document.getElementById("commercialMallHighStreet").value =
            prop.details.mallHighStreet || "";

        if (document.getElementById("cbConferenceRoom"))
          document.getElementById("cbConferenceRoom").checked =
            prop.details.conferenceRoom || false;
        if (document.getElementById("cbReceptionArea"))
          document.getElementById("cbReceptionArea").checked =
            prop.details.receptionArea || false;
        if (document.getElementById("cbPantry"))
          document.getElementById("cbPantry").checked =
            prop.details.pantry || false;
        if (document.getElementById("cbServerRoom"))
          document.getElementById("cbServerRoom").checked =
            prop.details.serverRoom || false;
        if (document.getElementById("cbGlassFrontage"))
          document.getElementById("cbGlassFrontage").checked =
            prop.details.glassFrontage || false;
        if (document.getElementById("cbDisplayArea"))
          document.getElementById("cbDisplayArea").checked =
            prop.details.displayArea || false;
        if (document.getElementById("cbFireNoc"))
          document.getElementById("cbFireNoc").checked =
            prop.details.fireNoc || false;
        if (document.getElementById("cbTradeLicense"))
          document.getElementById("cbTradeLicense").checked =
            prop.details.tradeLicense || false;
        if (document.getElementById("cbCommercialApproval"))
          document.getElementById("cbCommercialApproval").checked =
            prop.details.commercialApproval || false;
        if (document.getElementById("cbPollutionClearance"))
          document.getElementById("cbPollutionClearance").checked =
            prop.details.pollutionClearance || false;

        // Commercial Pricing Pre-fill
        if (document.getElementById("commercialRentInput"))
          document.getElementById("commercialRentInput").value =
            prop.pricing.rent || "";
        if (document.getElementById("commercialLeasePeriodInput"))
          document.getElementById("commercialLeasePeriodInput").value =
            prop.pricing.leasePeriod || "";
        if (document.getElementById("commercialLockInPeriodInput"))
          document.getElementById("commercialLockInPeriodInput").value =
            prop.pricing.lockInPeriod || "";
        if (document.getElementById("commercialSecurityDepositInput"))
          document.getElementById("commercialSecurityDepositInput").value =
            prop.pricing.securityDeposit || "";
        if (document.getElementById("commercialCamChargesInput"))
          document.getElementById("commercialCamChargesInput").value =
            prop.pricing.camCharges || "";

        // Pre-fill Warehouse Specific
        if (document.getElementById("warehouseTypeSelect"))
          document.getElementById("warehouseTypeSelect").value =
            prop.details.warehouseType || "";
        if (document.getElementById("industrialZoneInput"))
          document.getElementById("industrialZoneInput").value =
            prop.details.industrialZone || "";
        if (document.getElementById("warehouseTotalLandArea"))
          document.getElementById("warehouseTotalLandArea").value =
            prop.details.totalLandArea || "";
        if (document.getElementById("warehouseCoveredArea"))
          document.getElementById("warehouseCoveredArea").value =
            prop.details.coveredArea || "";
        if (document.getElementById("warehouseOpenYardArea"))
          document.getElementById("warehouseOpenYardArea").value =
            prop.details.openYardArea || "";
        if (document.getElementById("warehouseClearHeight"))
          document.getElementById("warehouseClearHeight").value =
            prop.details.clearHeight || "";
        if (document.getElementById("warehouseSideHeight"))
          document.getElementById("warehouseSideHeight").value =
            prop.details.sideHeight || "";
        if (document.getElementById("warehouseFlooringType"))
          document.getElementById("warehouseFlooringType").value =
            prop.details.industrialFlooringType || "";
        if (document.getElementById("warehouseFloorLoad"))
          document.getElementById("warehouseFloorLoad").value =
            prop.details.floorLoadCapacity || "";
        if (document.getElementById("warehouseDockDoors"))
          document.getElementById("warehouseDockDoors").value =
            prop.details.dockDoors || "";
        if (document.getElementById("warehouseTurningRadius"))
          document.getElementById("warehouseTurningRadius").value =
            prop.details.truckTurningRadius || "";
        if (document.getElementById("warehouseTruckParking"))
          document.getElementById("warehouseTruckParking").value =
            prop.details.truckParking || "";
        if (document.getElementById("warehouseCarParking"))
          document.getElementById("warehouseCarParking").value =
            prop.details.carParking || "";
        if (document.getElementById("warehousePowerLoad"))
          document.getElementById("warehousePowerLoad").value =
            prop.details.powerLoadKva || "";

        if (document.getElementById("cbRampAvailability"))
          document.getElementById("cbRampAvailability").checked =
            prop.details.rampAvailability || false;
        if (document.getElementById("cbTransformer"))
          document.getElementById("cbTransformer").checked =
            prop.details.transformer || false;
        if (document.getElementById("cbBorewell"))
          document.getElementById("cbBorewell").checked =
            prop.details.borewell || false;
        if (document.getElementById("cbDrainage"))
          document.getElementById("cbDrainage").checked =
            prop.details.drainage || false;
        if (document.getElementById("cbSewage"))
          document.getElementById("cbSewage").checked =
            prop.details.sewage || false;
        if (document.getElementById("cbInternetFiber"))
          document.getElementById("cbInternetFiber").checked =
            prop.details.internetFiber || false;
        if (document.getElementById("cbFireHydrant"))
          document.getElementById("cbFireHydrant").checked =
            prop.details.fireHydrant || false;
        if (document.getElementById("cbSprinklerSystem"))
          document.getElementById("cbSprinklerSystem").checked =
            prop.details.sprinklerSystem || false;
        if (document.getElementById("cbWarehouseFireNoc"))
          document.getElementById("cbWarehouseFireNoc").checked =
            prop.details.fireNoc || false;
        if (document.getElementById("cbPollutionControl"))
          document.getElementById("cbPollutionControl").checked =
            prop.details.pollutionNoc || false;
        if (document.getElementById("cbFactoryLicense"))
          document.getElementById("cbFactoryLicense").checked =
            prop.details.factoryLicense || false;
        if (document.getElementById("cbIndustrialApproval"))
          document.getElementById("cbIndustrialApproval").checked =
            prop.details.industrialApproval || false;

        if (document.getElementById("highwayDistance"))
          document.getElementById("highwayDistance").value =
            prop.location.highwayDistance || "";
        if (document.getElementById("railwayYardDistance"))
          document.getElementById("railwayYardDistance").value =
            prop.location.railwayYardDistance || "";
        if (document.getElementById("airportDistance"))
          document.getElementById("airportDistance").value =
            prop.location.airportDistance || "";
        if (document.getElementById("portDistance"))
          document.getElementById("portDistance").value =
            prop.location.portDistance || "";

        if (document.getElementById("commercialRentPerSqFtInput"))
          document.getElementById("commercialRentPerSqFtInput").value =
            prop.pricing.rentPerSqFt || "";
        if (document.getElementById("commercialEscalationInput"))
          document.getElementById("commercialEscalationInput").value =
            prop.pricing.escalationPercent || "";

        // Pre-fill Hospitality Specific
        if (document.getElementById("hospitalityTypeSelect"))
          document.getElementById("hospitalityTypeSelect").value =
            prop.details.hospitalityType || "";
        if (document.getElementById("hospitalityStarRating"))
          document.getElementById("hospitalityStarRating").value =
            prop.details.starRating || "";
        if (document.getElementById("hospitalityOperational"))
          document.getElementById("hospitalityOperational").value =
            prop.details.operationalStatus !== undefined
              ? String(prop.details.operationalStatus)
              : "";
        if (document.getElementById("hospitalityTotalRooms"))
          document.getElementById("hospitalityTotalRooms").value =
            prop.details.totalRooms || "";
        if (document.getElementById("hospitalityRoomTypes"))
          document.getElementById("hospitalityRoomTypes").value =
            prop.details.roomTypes || "";
        if (document.getElementById("hospitalityOccupancyRate"))
          document.getElementById("hospitalityOccupancyRate").value =
            prop.details.occupancyRate || "";
        if (document.getElementById("hospitalityADR"))
          document.getElementById("hospitalityADR").value =
            prop.details.averageDailyRate || "";
        if (document.getElementById("cbHospitalityBanquet"))
          document.getElementById("cbHospitalityBanquet").checked =
            prop.details.banquetHall || false;
        if (document.getElementById("cbHospitalityRestaurant"))
          document.getElementById("cbHospitalityRestaurant").checked =
            prop.details.restaurant || false;
        if (document.getElementById("cbHospitalityBarLicense"))
          document.getElementById("cbHospitalityBarLicense").checked =
            prop.details.barLicenseDetails || false;
        if (document.getElementById("cbHospitalityPool"))
          document.getElementById("cbHospitalityPool").checked =
            prop.details.hospitalityPool || false;
        if (document.getElementById("cbHospitalitySpa"))
          document.getElementById("cbHospitalitySpa").checked =
            prop.details.spa || false;
        if (document.getElementById("cbHospitalityGym"))
          document.getElementById("cbHospitalityGym").checked =
            prop.details.gym || false;
        if (document.getElementById("hospitalityLandArea"))
          document.getElementById("hospitalityLandArea").value =
            prop.details.hospitalityLandArea || "";
        if (document.getElementById("hospitalityLandAreaUnit"))
          document.getElementById("hospitalityLandAreaUnit").value =
            prop.details.hospitalityLandAreaUnit || "Square Foot";
        if (document.getElementById("hospitalityBuiltUpArea"))
          document.getElementById("hospitalityBuiltUpArea").value =
            prop.details.hospitalityBuiltUpArea || "";
        if (document.getElementById("hospitalityBuiltUpAreaUnit"))
          document.getElementById("hospitalityBuiltUpAreaUnit").value =
            prop.details.hospitalityBuiltUpAreaUnit || "Square Foot";
        if (document.getElementById("hospitalityParking"))
          document.getElementById("hospitalityParking").value =
            prop.details.hospitalityParkingCapacity || "";
        if (document.getElementById("cbHospitalityKitchen"))
          document.getElementById("cbHospitalityKitchen").checked =
            prop.details.kitchenSetup || false;
        if (document.getElementById("cbHospitalityLaundry"))
          document.getElementById("cbHospitalityLaundry").checked =
            prop.details.laundrySetup || false;
        if (document.getElementById("hospitalityAnnualRev"))
          document.getElementById("hospitalityAnnualRev").value =
            prop.details.annualRevenue || "";
        if (document.getElementById("hospitalityMonthlyRev"))
          document.getElementById("hospitalityMonthlyRev").value =
            prop.details.monthlyRevenue || "";
        if (document.getElementById("hospitalityEBITDA"))
          document.getElementById("hospitalityEBITDA").value =
            prop.details.ebitda || "";
        if (document.getElementById("hospitalityStaff"))
          document.getElementById("hospitalityStaff").value =
            prop.details.staffStrength || "";
        if (document.getElementById("cbHospitalityHotelLicense"))
          document.getElementById("cbHospitalityHotelLicense").checked =
            prop.details.hotelLicense || false;
        if (document.getElementById("cbHospitalityFSSAI"))
          document.getElementById("cbHospitalityFSSAI").checked =
            prop.details.fssaiLicense || false;
        if (document.getElementById("cbHospitalityTourismReg"))
          document.getElementById("cbHospitalityTourismReg").checked =
            prop.details.tourismRegistration || false;

        // Pre-fill Lodge Specific
        if (document.getElementById("roomTypeSelect")) {
          const val = prop.details.roomType || "Single Bed";
          document.getElementById("roomTypeSelect").value = val;
          document
            .querySelectorAll("#roomTypeSelector .segment-item")
            .forEach((item) => {
              item.classList.toggle(
                "active",
                item.getAttribute("data-value") === val,
              );
            });
        }
        if (document.getElementById("acNonAcSelect"))
          document.getElementById("acNonAcSelect").value =
            prop.details.acNonAc || "AC";
        if (document.getElementById("attachedBathroomSelect"))
          document.getElementById("attachedBathroomSelect").value =
            prop.details.attachedBathroom || "Attached";
        if (document.getElementById("bedTypeSelect"))
          document.getElementById("bedTypeSelect").value =
            prop.details.bedType || "Single";
        if (document.getElementById("roomSizeInput"))
          document.getElementById("roomSizeInput").value =
            prop.details.roomSize || "";
        if (document.getElementById("roomSizeUnit"))
          document.getElementById("roomSizeUnit").value =
            prop.details.roomSizeUnit || "Square Foot";

        // Pre-fill Amenities (Pills)
        if (prop.amenities) {
          document.querySelectorAll(".amenity-pill").forEach((pill) => {
            if (prop.amenities.includes(pill.dataset.value)) {
              pill.classList.add("active");
            }
          });
        }

        // Pre-fill Step 4: Photos (Existing)
        if (prop.photos) {
          prop.photos.forEach((photoObj) => {
            addExistingPhoto(photoObj);
          });
        }

        // Pre-fill Configurations
        if (prop.configurations && Array.isArray(prop.configurations)) {
          const cfgContainer = document.getElementById("configContainer");
          if (cfgContainer) {
            cfgContainer.innerHTML = "";
            prop.configurations.forEach((c) => {
              const row = document.createElement("div");
              row.className = "config-row";
              row.style.cssText =
                "display:flex; gap:8px; align-items:center; flex-wrap:wrap;";
              row.innerHTML = `
                <input type="text" class="form-input config-name" placeholder="Configuration (e.g. 2BHK)" style="flex:1; min-width:120px" value="${(c.name || "").replace(/"/g, "&quot;")}">
                <div style="display:flex; gap:4px; flex:1; min-width:180px;">
                  <input type="number" class="form-input config-area" placeholder="Area" style="flex:1; min-width:60px" value="${c.area || ""}">
                  <select class="form-input config-area-unit" style="min-width:80px; font-size:12px; padding:0 5px;">
                    <option value="Square Foot" ${c.areaUnit === "Square Foot" ? "selected" : ""}>sq ft</option>
                    <option value="Square Yard (Gaj)" ${c.areaUnit === "Square Yard (Gaj)" ? "selected" : ""}>sq yard</option>
                    <option value="Square Meter" ${c.areaUnit === "Square Meter" ? "selected" : ""}>sq m</option>
                    <option value="Acre" ${c.areaUnit === "Acre" ? "selected" : ""}>Acre</option>
                    <option value="Hectare" ${c.areaUnit === "Hectare" ? "selected" : ""}>Hectare</option>
                    <option value="Dismil / Decimal" ${c.areaUnit === "Dismil / Decimal" ? "selected" : ""}>Dismil</option>
                    <option value="Kattha" ${c.areaUnit === "Kattha" ? "selected" : ""}>Kattha</option>
                    <option value="Bigha" ${c.areaUnit === "Bigha" ? "selected" : ""}>Bigha</option>
                    <option value="Kanal" ${c.areaUnit === "Kanal" ? "selected" : ""}>Kanal</option>
                    <option value="Marla" ${c.areaUnit === "Marla" ? "selected" : ""}>Marla</option>
                    <option value="Guntha / Gunta" ${c.areaUnit === "Guntha / Gunta" ? "selected" : ""}>Gunta</option>
                    <option value="Cent" ${c.areaUnit === "Cent" ? "selected" : ""}>Cent</option>
                    <option value="Ground" ${c.areaUnit === "Ground" ? "selected" : ""}>Ground</option>
                    <option value="Ankanam" ${c.areaUnit === "Ankanam" ? "selected" : ""}>Ankanam</option>
                    <option value="Biswa" ${c.areaUnit === "Biswa" ? "selected" : ""}>Biswa</option>
                    <option value="Biswansi" ${c.areaUnit === "Biswansi" ? "selected" : ""}>Biswansi</option>
                    <option value="Lecha" ${c.areaUnit === "Lecha" ? "selected" : ""}>Lecha</option>
                    <option value="Ares" ${c.areaUnit === "Ares" ? "selected" : ""}>Ares</option>
                  </select>
                </div>
                <input type="number" class="form-input config-price" placeholder="Price (₹)" style="flex:1; min-width:100px" value="${c.price || ""}">
                <button type="button" class="btn btn-outline btn-sm remove-config-btn">✕</button>
              `;
              cfgContainer.appendChild(row);
            });
          }
        }

        // Pre-fill Step 5: Pricing & Contact
        const p = prop.pricing || {};
        const setVal = (id, val) => {
          const el = document.getElementById(id);
          if (el) {
            if (el.type === "checkbox") {
              el.checked = !!val;
              el.dispatchEvent(new Event("change"));
            } else {
              el.value = val !== undefined && val !== null ? val : "";
              el.dispatchEvent(new Event("change"));
            }
          }
        };

        setVal("priceOnRequestCheckbox", p.isPriceOnRequest);
        setVal("expectedPriceInput", p.expectedPrice);
        setVal("pricingTypeSelect", p.pricingType);
        setVal("priceTypeSelect", p.priceType);
        setVal("maintenanceChargesInput", p.maintenance);
        setVal("tokenAmountInput", p.tokenAmount);
        setVal("negotiableSelect", p.negotiable === true ? "true" : "false");
        setVal("availabilityDateInput", p.availabilityDate);

        // Commercial Pricing
        setVal("commercialRentInput", p.rent);
        setVal("commercialLeasePeriodInput", p.leasePeriod);
        setVal("commercialLockInPeriodInput", p.lockInPeriod);
        setVal("commercialSecurityDepositInput", p.securityDeposit);
        setVal("commercialCamChargesInput", p.camCharges);
        setVal("commercialRentPerSqFtInput", p.rentPerSqFt);
        setVal("commercialEscalationInput", p.escalationPercent);

        // Hospitality Pricing
        setVal("lodgePriceDayInput", p.pricePerDay);
        setVal("lodgePriceWeekInput", p.pricePerWeek);
        setVal("lodgePriceMonthInput", p.pricePerMonth);
        setVal("lodgeSecurityDepositInput", p.securityDeposit);
        setVal("lodgeElectricitySelect", p.electricityExtra);
        setVal("lodgeGstSelect", p.gstExtra);

        // Land Pricing
        setVal("plotRateSqFtInput", p.plotRatePerSqFt);
        setVal("plotDevChargesInput", p.plotDevCharges);

        const c = prop.contactDesc || {};
        setVal("contactNameInput", c.name);
        setVal("contactMobileInput", c.mobile);
        setVal("contactEmailInput", c.email);
        setVal("contactRoleSelect", c.role);
        setVal("contactTimeSelect", c.contactTime);

        // Pre-fill Custom FAQs
        if (prop.customFAQs && prop.customFAQs.length > 0) {
          const faqContainer = document.getElementById("faqContainer");
          if (faqContainer) {
            faqContainer.innerHTML = ""; // Clear defaults
            prop.customFAQs.forEach((f) => {
              if (window.createFAQRow)
                window.createFAQRow(f.question, f.answer);
            });
          }
        }
      }
    } catch (err) {
      console.error("Error loading property for edit:", err);
      window.showToast("Could not load property data.", "error");
    }
  }

  // ========== AI REWRITE LOGIC ==========
  const descriptionInput = document.getElementById("descriptionInput");
  const btnRewriteAi = document.getElementById("btnRewriteAi");
  const aiSuggestionBox = document.getElementById("aiSuggestionBox");

  if (descriptionInput && btnRewriteAi && aiSuggestionBox) {
    let typingTimer;

    // Detect short descriptions
    descriptionInput.addEventListener("input", () => {
      clearTimeout(typingTimer);
      typingTimer = setTimeout(() => {
        const text = descriptionInput.value.trim();
        // Show suggestion if text is between 10 and 50 characters, or lacks basic punctuation
        if (text.length > 10 && text.length < 50) {
          aiSuggestionBox.style.display = "block";
        } else {
          aiSuggestionBox.style.display = "none";
        }
      }, 1000); // Wait 1s after typing stops
    });

    const handleRewrite = async () => {
      const text = descriptionInput.value.trim();
      if (!text || text.length < 10) {
        window.showToast(
          "Please enter at least 10 characters for AI to rewrite.",
          "warning",
        );
        return;
      }

      const originalHtml = btnRewriteAi.innerHTML;
      btnRewriteAi.innerHTML =
        '<i class="fa-solid fa-spinner fa-spin"></i> Rewriting...';
      btnRewriteAi.disabled = true;

      try {
        const result = await convex.action("ai:rewriteDescription", { text });
        console.log("AI Rewrite Result:", result);

        if (result && result.success) {
          const rewritten = (result.text || "").trim();
          if (!rewritten) {
            window.showToast(
              "AI did not return usable text. Please try again.",
              "error",
            );
            return;
          }

          const sameText =
            rewritten.replace(/\s+/g, " ").trim() ===
            text.replace(/\s+/g, " ").trim();
          descriptionInput.value = rewritten;

          // Manually trigger input event so auto-save and Suggestion Box update
          descriptionInput.dispatchEvent(new Event("input", { bubbles: true }));

          if (sameText) {
            window.showToast(
              "Description already looks good. Add location/amenities to get a stronger rewrite.",
              "info",
            );
          } else if (result.fallback) {
            window.showToast(
              "Description professionally rewritten!",
              "success",
            );
          } else {
            window.showToast(
              "Description professionally rewritten!",
              "success",
            );
          }

          aiSuggestionBox.style.display = "none";
        } else {
          window.showToast(
            result?.error || "Failed to rewrite description.",
            "error",
          );
        }
      } catch (err) {
        console.error("AI Rewrite Error:", err);
        window.showToast(
          "An error occurred while calling the AI service.",
          "error",
        );
      } finally {
        btnRewriteAi.innerHTML = originalHtml;
        btnRewriteAi.disabled = false;
      }
    };

    btnRewriteAi.addEventListener("click", handleRewrite);
    aiSuggestionBox.addEventListener("click", handleRewrite);
  }

  // Configurations UI: Add / Remove rows
  const addConfigBtnEl = document.getElementById("addConfigBtn");
  if (addConfigBtnEl) {
    addConfigBtnEl.addEventListener("click", () => {
      const container = document.getElementById("configContainer");
      if (!container) return;
      const row = document.createElement("div");
      row.className = "config-row";
      row.innerHTML = `
        <div class="config-row-header">
          <select class="form-input config-bhk">
            <option value="1BHK">1 BHK</option>
            <option value="2BHK" selected>2 BHK</option>
            <option value="3BHK">3 BHK</option>
            <option value="4BHK">4 BHK</option>
            <option value="5BHK">5 BHK</option>
            <option value="6BHK">6 BHK</option>
            <option value="Custom">Custom</option>
          </select>
          <input type="text" class="form-input config-custom" placeholder="e.g. Studio, 7.5 BHK, Penthouse" style="display:none; flex:1;">
          <button type="button" class="btn btn-outline btn-sm remove-config-btn" style="margin-left:auto;">✕ Remove</button>
        </div>
        <div class="config-row-fields">
          <div class="config-field">
            <span class="config-field-label">Built-up Area *</span>
            <div class="config-area-group">
              <input type="number" class="form-input config-builtup" placeholder="e.g. 1200">
              <select class="form-input config-builtup-unit">
                <option value="Square Foot">sq ft</option>
                <option value="Square Yard (Gaj)">sq yard</option>
                <option value="Square Meter">sq m</option>
                <option value="Acre">Acre</option>
                <option value="Hectare">Hectare</option>
                <option value="Dismil / Decimal">Dismil</option>
                <option value="Kattha">Kattha</option>
                <option value="Bigha">Bigha</option>
                <option value="Kanal">Kanal</option>
                <option value="Marla">Marla</option>
                <option value="Guntha / Gunta">Gunta</option>
                <option value="Cent">Cent</option>
                <option value="Ground">Ground</option>
                <option value="Ankanam">Ankanam</option>
                <option value="Biswa">Biswa</option>
                <option value="Biswansi">Biswansi</option>
                <option value="Lecha">Lecha</option>
                <option value="Ares">Ares</option>
              </select>
            </div>
          </div>
          <div class="config-field">
            <span class="config-field-label">Carpet Area (optional)</span>
            <div class="config-area-group">
              <input type="number" class="form-input config-carpet" placeholder="e.g. 980">
              <select class="form-input config-carpet-unit">
                <option value="Square Foot">sq ft</option>
                <option value="Square Meter">sq m</option>
              </select>
            </div>
          </div>
          <div class="config-field">
            <span class="config-field-label">Price (optional)</span>
            <input type="number" class="form-input config-price" placeholder="e.g. 45,00,000">
          </div>
        </div>
        <div class="config-floorplan-row">
          <input type="file" accept="image/*" class="config-floorplan" multiple data-max="2" style="display:none">
          <button type="button" class="btn btn-outline btn-sm btn-upload-floorplan">
            <i class="fa-solid fa-image"></i> Upload Floor Plans (max 2)
          </button>
          <div class="config-floorplan-previews"></div>
        </div>
      `;
      container.appendChild(row);
      updateConfigRemoveButtons();
    });
  }

  function updateConfigRemoveButtons() {
    const rows = document.querySelectorAll("#configContainer .config-row");
    rows.forEach((r, idx) => {
      const btn = r.querySelector(".remove-config-btn");
      if (!btn) return;
      btn.style.display = rows.length > 1 ? "inline-block" : "none";
      btn.onclick = () => {
        r.remove();
        updateConfigRemoveButtons();
      };
    });
  }
  // Initialize remove buttons for any existing rows
  updateConfigRemoveButtons();

  // ========== LAND CONFIGURATIONS UI ==========
  const addLandConfigBtnEl = document.getElementById("addLandConfigBtn");
  if (addLandConfigBtnEl) {
    addLandConfigBtnEl.addEventListener("click", () => {
      const container = document.getElementById("landConfigContainer");
      if (!container) return;
      const row = document.createElement("div");
      row.className = "land-config-row";
      row.style.cssText = "background:var(--bg-light); border:1px solid var(--border); padding:15px; border-radius:8px;";
      row.innerHTML = `
        <div style="display:flex; gap:10px; align-items:flex-end; margin-bottom:10px;">
          <div style="flex:1;">
            <label class="form-label" style="font-size:12px; margin-bottom:4px; display:block;">Plot Title / Type (e.g. Corner Plot)</label>
            <input type="text" class="form-input land-config-name" placeholder="Leave blank for auto-format">
          </div>
          <button type="button" class="btn btn-outline btn-sm remove-land-config-btn" style="display:none;">✕ Remove</button>
        </div>
        <div style="display:grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap:15px;">
          <div>
             <label class="form-label" style="font-size:12px; margin-bottom:4px; display:block;">Plot Area *</label>
             <div style="display: flex; gap: 8px;">
                <input type="number" class="form-input land-config-builtup" placeholder="e.g. 1200" style="flex:1;">
                <select class="form-input land-config-builtup-unit" style="width:120px;">
                  <option value="Square Foot">Square Foot</option>
                  <option value="Square Yard (Gaj)">Square Yard (Gaj)</option>
                  <option value="Square Meter">Square Meter</option>
                  <option value="Acre">Acre</option>
                  <option value="Hectare">Hectare</option>
                  <option value="Dismil / Decimal">Dismil / Decimal</option>
                  <option value="Kattha">Kattha</option>
                  <option value="Bigha">Bigha</option>
                  <option value="Kanal">Kanal</option>
                  <option value="Marla">Marla</option>
                  <option value="Guntha / Gunta">Guntha / Gunta</option>
                  <option value="Cent">Cent</option>
                  <option value="Ground">Ground</option>
                  <option value="Ankanam">Ankanam</option>
                  <option value="Biswa">Biswa</option>
                  <option value="Biswansi">Biswansi</option>
                  <option value="Lecha">Lecha</option>
                  <option value="Ares">Ares</option>
                </select>
             </div>
          </div>
          <div>
             <label class="form-label" style="font-size:12px; margin-bottom:4px; display:block;">Expected Price (optional)</label>
             <input type="number" class="form-input land-config-price" placeholder="e.g. 4500000">
          </div>
        </div>
        <div style="display:grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap:15px; margin-top:15px;">
          <div>
             <label class="form-label" style="font-size:12px; margin-bottom:4px; display:block;">Frontage Width (ft)</label>
             <input type="number" class="form-input land-config-frontage" placeholder="e.g. 40">
          </div>
          <div>
             <label class="form-label" style="font-size:12px; margin-bottom:4px; display:block;">Road Width (ft)</label>
             <input type="number" class="form-input land-config-road" placeholder="e.g. 30">
          </div>
          <div>
             <label class="form-label" style="font-size:12px; margin-bottom:4px; display:block;">Facing Direction</label>
             <select class="form-input land-config-facing">
               <option value="">Select</option>
               <option value="East">East</option>
               <option value="West">West</option>
               <option value="North">North</option>
               <option value="South">South</option>
               <option value="North-East">North-East</option>
               <option value="North-West">North-West</option>
               <option value="South-East">South-East</option>
               <option value="South-West">South-West</option>
             </select>
          </div>
        </div>
      `;
      container.appendChild(row);
      updateLandConfigRemoveButtons();
    });
  }

  function updateLandConfigRemoveButtons() {
    const rows = document.querySelectorAll("#landConfigContainer .land-config-row");
    rows.forEach((r, idx) => {
      const btn = r.querySelector(".remove-land-config-btn");
      if (!btn) return;
      btn.style.display = rows.length > 1 ? "inline-block" : "none";
      btn.onclick = () => {
        r.remove();
        updateLandConfigRemoveButtons();
      };
    });
  }
  updateLandConfigRemoveButtons();

  // ========== DRAFT SYSTEM ==========
  function getFormState() {
    const parseNum = (id) => {
      const el = document.getElementById(id);
      if (!el || !el.value) return undefined;
      // Remove everything except numbers and decimal point
      const clean = String(el.value).replace(/[^\d.]/g, "");
      const num = parseFloat(clean);
      return isNaN(num) ? undefined : num;
    };

    const step1Grids = document.querySelectorAll("#formStep1 .form-type-grid");
    const posterType =
      step1Grids[0]?.querySelector(".active .name")?.innerText.trim() ||
      "Owner";
    const transactionType =
      step1Grids[1]?.querySelector(".active .name")?.innerText.trim() || "";
    const propertyType =
      step1Grids[2]?.querySelector(".active .name")?.innerText.trim() || "";

    const location = {
      state: document.getElementById("stateSelect")?.value,
      city:
        document.getElementById("citySelect")?.value === "Other"
          ? document.getElementById("manualCityInput")?.value
          : document.getElementById("citySelect")?.value,
      locality: document.getElementById("localityInput")?.value,
      society: document.getElementById("societyInput")?.value || undefined,
      fullAddress: document.getElementById("addressInput")?.value || undefined,
      pinCode: document.getElementById("pinCodeInput")?.value,
      landmark: document.getElementById("landmarkInput")?.value || undefined,
      googleMapLink:
        document.getElementById("googleMapLinkInput")?.value || undefined,
      metroDistance:
        document.getElementById("metroDistance")?.value || undefined,
      schoolDistance:
        document.getElementById("schoolDistance")?.value || undefined,
      mallDistance: document.getElementById("mallDistance")?.value || undefined,
      hospitalDistance:
        document.getElementById("hospitalDistance")?.value || undefined,
      highwayDistance:
        document.getElementById("highwayDistance")?.value || undefined,
      railwayYardDistance:
        document.getElementById("railwayYardDistance")?.value || undefined,
      airportDistance:
        document.getElementById("airportDistance")?.value || undefined,
      portDistance: document.getElementById("portDistance")?.value || undefined,
      googleSearch:
        document.getElementById("googleLocationSearch")?.value || undefined,
    };

    const details = {
      category: document.getElementById("propertyCategory")?.value,
      bhk:
        document.getElementById("bhkTypeSelect")?.value === "Others"
          ? document.getElementById("customBhkInput")?.value
          : document.getElementById("bhkTypeSelect")?.value,
      status: document.getElementById("propertyStatusSelect")?.value,
      builtUpArea: parseNum("builtUpAreaInput") || 0,
      builtUpAreaUnit:
        document.getElementById("builtUpAreaUnit")?.value || "Square Foot",
      carpetArea: parseNum("carpetAreaInput"),
      carpetAreaUnit:
        document.getElementById("carpetAreaUnit")?.value || "Square Foot",
      floorNumber: parseNum("floorNumberInput"),
      totalFloors: parseNum("totalFloorsInput"),
      furnishing: document.getElementById("furnishingStatusSelect")?.value,
      facing: document.getElementById("facingSelect")?.value || undefined,
      parking: document.getElementById("parkingSelect")?.value || undefined,
      constructionYear: parseNum("constructionYearInput"),
      rera: document.getElementById("reraInput")?.value || undefined,
      description: document.getElementById("descriptionInput")?.value || "",
      propertyTitle:
        document.getElementById("propertyTitleInput")?.value || undefined,
      ownershipType:
        document.getElementById("ownershipTypeSelect")?.value || undefined,
      bathrooms: parseNum("bathroomsSelect"),
      balconies: parseNum("balconiesSelect"),
      studyRoom: document.getElementById("cbStudyRoom")?.checked || false,
      servantRoom: document.getElementById("cbServantRoom")?.checked || false,
      poojaRoom: document.getElementById("cbPoojaRoom")?.checked || false,
      storeRoom: document.getElementById("cbStoreRoom")?.checked || false,
      basement: document.getElementById("cbBasement")?.checked || false,
      floorConfig:
        document.getElementById("floorConfigInput")?.value || undefined,
      plotArea: parseNum("plotAreaInput"),
      plotAreaUnit:
        document.getElementById("plotAreaUnit")?.value || "Square Foot",
      plotRateUnit:
        document.getElementById("plotRateUnit")?.value || "Square Foot",
      superBuiltUpArea: parseNum("superBuiltUpAreaInput"),
      superBuiltUpAreaUnit:
        document.getElementById("superBuiltUpAreaUnit")?.value || "Square Foot",
      openArea: parseNum("openAreaInput"),
      frontageWidth: parseNum("frontageWidthInput"),
      roadWidth: parseNum("roadWidthInput"),
      ageOfProperty:
        document.getElementById("ageOfPropertySelect")?.value || undefined,
      constructionQuality:
        document.getElementById("constructionQualitySelect")?.value ||
        undefined,
      flooringType:
        document.getElementById("flooringTypeInput")?.value || undefined,
      wallFinish:
        document.getElementById("wallFinishInput")?.value || undefined,
      ceilingHeight: parseNum("ceilingHeightInput"),
      waterSource:
        document.getElementById("waterSourceSelect")?.value || undefined,
      electricityLoad:
        document.getElementById("electricityLoadInput")?.value || undefined,
      openParking:
        document.getElementById("openParkingSelect")?.value || undefined,
      garage: document.getElementById("cbGarage")?.checked || false,
      evCharging: document.getElementById("cbEvCharging")?.checked || false,
      approvalAuthority:
        document.getElementById("approvalAuthorityInput")?.value || undefined,
      occupancyCertificate:
        document.getElementById("cbOccupancyCert")?.checked || false,
      completionCertificate:
        document.getElementById("cbCompletionCert")?.checked || false,
      propertyTaxStatus:
        document.getElementById("propertyTaxStatusSelect")?.value || undefined,
      loanApproved:
        document.getElementById("loanApprovedInput")?.value || undefined,
      commercialType:
        document.getElementById("commercialTypeSelect")?.value || undefined,
      grade:
        document.getElementById("commercialGradeSelect")?.value || undefined,
      frontage: parseNum("commercialFrontage"),
      workstations: parseNum("commercialWorkstations"),
      cabins: parseNum("commercialCabins"),
      meetingRooms: parseNum("commercialMeetingRooms"),
      conferenceRoom:
        document.getElementById("cbConferenceRoom")?.checked || false,
      receptionArea:
        document.getElementById("cbReceptionArea")?.checked || false,
      pantry: document.getElementById("cbPantry")?.checked || false,
      washrooms:
        document.getElementById("commercialWashrooms")?.value || undefined,
      serverRoom: document.getElementById("cbServerRoom")?.checked || false,
      acType: document.getElementById("commercialAcType")?.value || undefined,
      powerBackupCapacity:
        document.getElementById("commercialPowerBackup")?.value || undefined,
      retailFloor:
        document.getElementById("commercialRetailFloor")?.value || undefined,
      glassFrontage:
        document.getElementById("cbGlassFrontage")?.checked || false,
      displayArea: document.getElementById("cbDisplayArea")?.checked || false,
      footfallZone:
        document.getElementById("commercialFootfallZone")?.value || undefined,
      mallHighStreet:
        document.getElementById("commercialMallHighStreet")?.value || undefined,
      fireNoc:
        document.getElementById("cbFireNoc")?.checked ||
        document.getElementById("cbWarehouseFireNoc")?.checked ||
        false,
      tradeLicense: document.getElementById("cbTradeLicense")?.checked || false,
      commercialApproval:
        document.getElementById("cbCommercialApproval")?.checked || false,
      pollutionClearance:
        document.getElementById("cbPollutionClearance")?.checked || false,
      warehouseType:
        document.getElementById("warehouseTypeSelect")?.value || undefined,
      industrialZone:
        document.getElementById("industrialZoneInput")?.value || undefined,
      totalLandArea: parseNum("warehouseTotalLandArea"),
      coveredArea: parseNum("warehouseCoveredArea"),
      openYardArea: parseNum("warehouseOpenYardArea"),
      clearHeight: parseNum("warehouseClearHeight"),
      sideHeight: parseNum("warehouseSideHeight"),
      industrialFlooringType:
        document.getElementById("warehouseFlooringType")?.value || undefined,
      floorLoadCapacity:
        document.getElementById("warehouseFloorLoad")?.value || undefined,
      dockDoors: parseNum("warehouseDockDoors"),
      rampAvailability:
        document.getElementById("cbRampAvailability")?.checked || false,
      truckTurningRadius:
        document.getElementById("warehouseTurningRadius")?.value || undefined,
      truckParking: parseNum("warehouseTruckParking"),
      carParking: parseNum("warehouseCarParking"),
      powerLoadKva: parseNum("warehousePowerLoad"),
      transformer: document.getElementById("cbTransformer")?.checked || false,
      borewell: document.getElementById("cbBorewell")?.checked || false,
      drainage: document.getElementById("cbDrainage")?.checked || false,
      sewage: document.getElementById("cbSewage")?.checked || false,
      internetFiber:
        document.getElementById("cbInternetFiber")?.checked || false,
      fireHydrant: document.getElementById("cbFireHydrant")?.checked || false,
      sprinklerSystem:
        document.getElementById("cbSprinklerSystem")?.checked || false,
      pollutionNoc:
        document.getElementById("cbPollutionControl")?.checked || false,
      factoryLicense:
        document.getElementById("cbFactoryLicense")?.checked || false,
      industrialApproval:
        document.getElementById("cbIndustrialApproval")?.checked || false,
      hospitalityType:
        document.getElementById("hospitalityTypeSelect")?.value || undefined,
      starRating: parseNum("hospitalityStarRating"),
      operationalStatus:
        document.getElementById("hospitalityOperational")?.value === "true",
      totalRooms: parseNum("hospitalityTotalRooms"),
      roomTypes:
        document.getElementById("hospitalityRoomTypes")?.value || undefined,
      occupancyRate: parseNum("hospitalityOccupancyRate"),
      averageDailyRate: parseNum("hospitalityADR"),
      banquetHall:
        document.getElementById("cbHospitalityBanquet")?.checked || false,
      restaurant:
        document.getElementById("cbHospitalityRestaurant")?.checked || false,
      barLicenseDetails:
        document.getElementById("cbHospitalityBarLicense")?.checked || false,
      hospitalityPool:
        document.getElementById("cbHospitalityPool")?.checked || false,
      spa: document.getElementById("cbHospitalitySpa")?.checked || false,
      gym: document.getElementById("cbHospitalityGym")?.checked || false,
      hospitalityLandArea: parseNum("hospitalityLandArea"),
      hospitalityLandAreaUnit:
        document.getElementById("hospitalityLandAreaUnit")?.value ||
        "Square Foot",
      hospitalityBuiltUpArea: parseNum("hospitalityBuiltUpArea"),
      hospitalityBuiltUpAreaUnit:
        document.getElementById("hospitalityBuiltUpAreaUnit")?.value ||
        "Square Foot",
      hospitalityParkingCapacity: parseNum("hospitalityParking"),
      kitchenSetup:
        document.getElementById("cbHospitalityKitchen")?.checked || false,
      laundrySetup:
        document.getElementById("cbHospitalityLaundry")?.checked || false,
      annualRevenue: parseNum("hospitalityAnnualRev"),
      monthlyRevenue: parseNum("hospitalityMonthlyRev"),
      ebitda: parseNum("hospitalityEBITDA"),
      staffStrength: parseNum("hospitalityStaff"),
      hotelLicense:
        document.getElementById("cbHospitalityHotelLicense")?.checked || false,
      fssaiLicense:
        document.getElementById("cbHospitalityFSSAI")?.checked || false,
      tourismRegistration:
        document.getElementById("cbHospitalityTourismReg")?.checked || false,
    };

    const amenities = [];
    document.querySelectorAll(".amenity-pill.active").forEach((pill) => {
      amenities.push(pill.dataset.value);
    });

    const pricing = {
      expectedPrice: parseNum("expectedPriceInput"),
      isPriceOnRequest:
        document.getElementById("priceOnRequestCheckbox")?.checked ||
        document.getElementById("priceTypeSelect")?.value ===
          "Price on request",
      pricingType:
        document.getElementById("pricingTypeSelect")?.value || undefined,
      priceType: document.getElementById("priceTypeSelect")?.value || undefined,
      maintenance: parseNum("maintenanceChargesInput"),
      tokenAmount: parseNum("tokenAmountInput"),
      negotiable: document.getElementById("negotiableSelect")?.value === "true",
      availabilityDate:
        document.getElementById("availabilityDateInput")?.value || undefined,
      // Commercial
      rent: parseNum("commercialRentInput"),
      leasePeriod:
        document.getElementById("commercialLeasePeriodInput")?.value ||
        undefined,
      lockInPeriod:
        document.getElementById("commercialLockInPeriodInput")?.value ||
        undefined,
      securityDeposit: parseNum("commercialSecurityDepositInput"),
      camCharges: parseNum("commercialCamChargesInput"),
      rentPerSqFt: parseNum("commercialRentPerSqFtInput"),
      escalationPercent: parseNum("commercialEscalationInput"),
      // Hospitality
      pricePerDay: parseNum("lodgePriceDayInput"),
      pricePerWeek: parseNum("lodgePriceWeekInput"),
      pricePerMonth: parseNum("lodgePriceMonthInput"),
      lodgeSecurityDeposit: parseNum("lodgeSecurityDepositInput"),
      lodgeElectricity:
        document.getElementById("lodgeElectricitySelect")?.value || undefined,
      lodgeGst: document.getElementById("lodgeGstSelect")?.value || undefined,
      // Restore Lodge Detailed Fields
      roomType: document.getElementById("roomTypeSelect")?.value || undefined,
      acNonAc: document.getElementById("acNonAcSelect")?.value || undefined,
      attachedBathroom:
        document.getElementById("attachedBathroomSelect")?.value || undefined,
      bedType: document.getElementById("bedTypeSelect")?.value || undefined,
      roomSize: parseNum("roomSizeInput"),
      roomSizeUnit:
        document.getElementById("roomSizeUnit")?.value || "Square Foot",
      // Land
      plotRatePerSqFt: parseNum("plotRateSqFtInput"),
      plotDevCharges: parseNum("plotDevChargesInput"),
    };

    const contactDesc = {
      name: document.getElementById("contactNameInput")?.value,
      mobile: document.getElementById("contactMobileInput")?.value,
      email: document.getElementById("contactEmailInput")?.value,
      role: document.getElementById("contactRoleSelect")?.value || undefined,
      contactTime:
        document.getElementById("contactTimeSelect")?.value || undefined,
    };

    const externalVideos = [];
    document.querySelectorAll(".video-link-input").forEach((input) => {
      if (input.value.trim()) externalVideos.push(input.value.trim());
    });

    const customFAQs = [];
    document.querySelectorAll(".faq-row").forEach((row) => {
      const q = row.querySelector(".faq-question")?.value.trim();
      const a = row.querySelector(".faq-answer")?.value.trim();
      if (q && a) customFAQs.push({ question: q, answer: a });
    });

    // Collect Configurations (flat types or plot sizes)
    const configurations = [];
    const isLand = /plot|land/i.test(propertyType);

    if (isLand) {
       document.querySelectorAll("#landConfigContainer .land-config-row").forEach((row) => {
         const builtup = row.querySelector('.land-config-builtup')?.value ? Number(row.querySelector('.land-config-builtup').value) : undefined;
         if (!builtup) return; // Area is mandatory
         const builtupUnit = row.querySelector('.land-config-builtup-unit')?.value || 'Square Foot';
         const customName = row.querySelector('.land-config-name')?.value.trim();
         const name = customName ? customName : `${builtup} ${builtupUnit} Plot`;
         const price = row.querySelector('.land-config-price')?.value ? Number(row.querySelector('.land-config-price').value) : undefined;
         const frontageWidth = row.querySelector('.land-config-frontage')?.value ? Number(row.querySelector('.land-config-frontage').value) : undefined;
         const roadWidth = row.querySelector('.land-config-road')?.value ? Number(row.querySelector('.land-config-road').value) : undefined;
         const facing = row.querySelector('.land-config-facing')?.value || undefined;
         
         configurations.push({ name, custom: customName || undefined, builtup, builtupUnit, price, frontageWidth, roadWidth, facing, photos: [] });
       });
       
       // Sync primary plotArea, frontage, roadWidth, facing with first config to pass validation if user left primary hidden field blank
       if (configurations.length > 0) {
         details.plotArea = configurations[0].builtup;
         details.plotAreaUnit = configurations[0].builtupUnit;
         details.frontageWidth = configurations[0].frontageWidth;
         details.roadWidth = configurations[0].roadWidth;
         details.facing = configurations[0].facing;
       }
    } else {
       document.querySelectorAll("#configContainer .config-row").forEach((row) => {
         const bhk = row.querySelector('.config-bhk')?.value || undefined;
         const custom = row.querySelector('.config-custom')?.value.trim();
         const name = custom ? custom : (bhk || row.querySelector('.config-name')?.value.trim());
         const builtup = row.querySelector('.config-builtup')?.value
           ? Number(row.querySelector('.config-builtup').value)
           : undefined;
         const builtupUnit = row.querySelector('.config-builtup-unit')?.value || 'Square Foot';
         const carpet = row.querySelector('.config-carpet')?.value
           ? Number(row.querySelector('.config-carpet').value)
           : undefined;
         const carpetUnit = row.querySelector('.config-carpet-unit')?.value || undefined;
         const price = row.querySelector('.config-price')?.value
           ? Number(row.querySelector('.config-price').value)
           : undefined;
         const configObj = { name, bhk: bhk === 'Custom' ? undefined : bhk, custom: custom || undefined, builtup, builtupUnit, carpet, carpetUnit, price, photos: [] };
         if (name) configurations.push(configObj);
       });
    }

    return {
      posterType,
      transactionType,
      propertyType,
      location,
      details,
      amenities,
      pricing,
      contactDesc,
      externalVideos,
      customFAQs,
      configurations,
    };
  }

  async function saveDraftToCloud(isManual = false) {
    try {
      if (editId) return; // Reinforced: If in edit mode, NEVER save as draft
      const urlParams = new URLSearchParams(window.location.search);
      if (urlParams.get("id")) return;

      const data = getFormState();
      // Allow saving if at least Transaction Type is selected
      if (!data.transactionType) return;

      await convex.mutation("drafts:saveDraft", { token: getToken(), data });
      console.log("Draft saved successfully.");
      if (isManual)
        window.showToast("Progress saved to your Dashboard drafts!", "success");
    } catch (err) {
      console.error("Save failed:", err);
      if (isManual) window.showToast("Failed to save draft.", "error");
    }
  }

  // Explicit Save Button Handler
  async function handleManualSave(btn) {
    const prevText = btn.innerHTML;
    btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Saving...';
    btn.disabled = true;
    await saveDraftToCloud(true);
    btn.innerHTML = prevText;
    btn.disabled = false;
  }

  // Attempt to save when leaving the page
  window.addEventListener("beforeunload", () => {
    saveDraftToCloud(); // Fire and forget on leave
  });

  let autoSaveTimer;
  function triggerAutoSave() {
    clearTimeout(autoSaveTimer);
    autoSaveTimer = setTimeout(saveDraftToCloud, 3000);
  }

  function loadDraft(draft) {
    if (!draft || !draft.data) return;
    const d = draft.data;

    // Step 1: Types
    if (d.transactionType) {
      const items = document.querySelectorAll(
        "#formStep1 .form-type-grid:first-of-type .form-type-item",
      );
      items.forEach((item) => {
        if (item.querySelector(".name").innerText.trim() === d.transactionType)
          item.click();
      });
    }
    if (d.propertyType) {
      const items = document.querySelectorAll(
        "#formStep1 .form-type-grid:last-of-type .form-type-item",
      );
      items.forEach((item) => {
        if (item.querySelector(".name").innerText.trim() === d.propertyType)
          item.click();
      });
    }

    // Step 2: Location
    if (d.location) {
      if (document.getElementById("stateSelect")) {
        document.getElementById("stateSelect").value = d.location.state || "";
        document
          .getElementById("stateSelect")
          .dispatchEvent(new Event("change"));
      }
      if (document.getElementById("citySelect")) {
        document.getElementById("citySelect").value = d.location.city || "";
        document
          .getElementById("citySelect")
          .dispatchEvent(new Event("change"));
      }
      if (document.getElementById("localityInput"))
        document.getElementById("localityInput").value =
          d.location.locality || "";
      if (document.getElementById("societyInput"))
        document.getElementById("societyInput").value =
          d.location.society || "";
      if (document.getElementById("addressInput"))
        document.getElementById("addressInput").value =
          d.location.fullAddress || "";
      if (document.getElementById("pinCodeInput"))
        document.getElementById("pinCodeInput").value =
          d.location.pinCode || "";
      if (document.getElementById("landmarkInput"))
        document.getElementById("landmarkInput").value =
          d.location.landmark || "";
      if (document.getElementById("googleMapLinkInput"))
        document.getElementById("googleMapLinkInput").value =
          d.location.googleMapLink || "";
      if (document.getElementById("googleLocationSearch"))
        document.getElementById("googleLocationSearch").value =
          d.location.googleSearch || "";

      // Category pre-fill for draft
      if (d.details?.category) {
        const catHidden = document.getElementById("propertyCategory");
        if (catHidden) catHidden.value = d.details.category;
        document
          .querySelectorAll("#categoryVisualSelector .category-visual-item")
          .forEach((item) => {
            if (item.dataset.value === d.details.category)
              item.classList.add("active");
            else item.classList.remove("active");
          });
      }
    }

    // Step 3: Details
    if (d.details) {
      // BHK
      const bhkItems = document.querySelectorAll("#bhkSelector .segment-item");
      let foundBhk = false;
      bhkItems.forEach((item) => {
        if (item.dataset.value === d.details.bhk) {
          item.click();
          foundBhk = true;
        }
      });
      if (!foundBhk && d.details.bhk) {
        const otherItem = document.querySelector(
          '#bhkSelector .segment-item[data-value="Others"]',
        );
        if (otherItem) {
          otherItem.click();
          if (document.getElementById("customBhkInput"))
            document.getElementById("customBhkInput").value = d.details.bhk;
        }
      }

      // furnishing
      const furnCards = document.querySelectorAll(
        "#furnishingSelector .selection-card",
      );
      furnCards.forEach((card) => {
        if (card.dataset.value === d.details.furnishing) card.click();
      });

      if (document.getElementById("propertyStatusSelect"))
        document.getElementById("propertyStatusSelect").value =
          d.details.status || "";
      if (document.getElementById("builtUpAreaInput"))
        document.getElementById("builtUpAreaInput").value =
          d.details.builtUpArea || "";
      if (document.getElementById("descriptionInput"))
        document.getElementById("descriptionInput").value =
          d.details.description || "";
    }

    // Amenities
    if (d.amenities) {
      document.querySelectorAll(".amenity-pill").forEach((pill) => {
        if (d.amenities.includes(pill.dataset.value))
          pill.classList.add("active");
      });
    }

    // Step 5: Pricing & Contact
    if (d.pricing) {
      const p = d.pricing;
      const setVal = (id, val) => {
        const el = document.getElementById(id);
        if (el) {
          if (el.type === "checkbox") {
            el.checked = !!val;
            el.dispatchEvent(new Event("change"));
          } else {
            el.value = val !== undefined && val !== null ? val : "";
            el.dispatchEvent(new Event("change"));
          }
        }
      };

      setVal("priceOnRequestCheckbox", p.isPriceOnRequest);
      setVal("expectedPriceInput", p.expectedPrice);
      setVal("pricingTypeSelect", p.pricingType);
      setVal("priceTypeSelect", p.priceType);
      setVal("maintenanceChargesInput", p.maintenance);
      setVal("tokenAmountInput", p.tokenAmount);
      setVal("negotiableSelect", p.negotiable === true ? "true" : "false");
      setVal("availabilityDateInput", p.availabilityDate);

      // Commercial Pricing
      setVal("commercialRentInput", p.rent);
      setVal("commercialLeasePeriodInput", p.leasePeriod);
      setVal("commercialLockInPeriodInput", p.lockInPeriod);
      setVal("commercialSecurityDepositInput", p.securityDeposit);
      setVal("commercialCamChargesInput", p.camCharges);
      setVal("commercialRentPerSqFtInput", p.rentPerSqFt);
      setVal("commercialEscalationInput", p.escalationPercent);

      // Hospitality Pricing
      setVal("lodgePriceDayInput", p.pricePerDay);
      setVal("lodgePriceWeekInput", p.pricePerWeek);
      setVal("lodgePriceMonthInput", p.pricePerMonth);
      setVal("lodgeSecurityDepositInput", p.securityDeposit);
      setVal("lodgeElectricitySelect", p.electricityExtra);
      setVal("lodgeGstSelect", p.gstExtra);

      // Land Pricing
      setVal("plotRateSqFtInput", p.plotRatePerSqFt);
      setVal("plotDevChargesInput", p.plotDevCharges);
    }

    if (d.contactDesc) {
      const c = d.contactDesc;
      const setVal = (id, val) => {
        const el = document.getElementById(id);
        if (el) el.value = val !== undefined ? val : "";
      };
      setVal("contactNameInput", c.name);
      setVal("contactMobileInput", c.mobile);
      setVal("contactEmailInput", c.email);
      setVal("contactRoleSelect", c.role);
      setVal("contactTimeSelect", c.contactTime);
    }

    // Load Configurations (Flat or Land)
    if (d.configurations && d.configurations.length > 0) {
      const isLand = /plot|land/i.test(d.propertyType || '');
      if (isLand) {
        // Find existing row to clear or reuse
        const container = document.getElementById("landConfigContainer");
        if (container) {
           container.innerHTML = ""; // Clear default empty row
           d.configurations.forEach(cfg => {
             const addBtn = document.getElementById("addLandConfigBtn");
             if(addBtn) {
                 addBtn.click(); // Add a row using our standard function
                 const newRow = container.lastElementChild;
                 if(newRow) {
                     const nameInput = newRow.querySelector('.land-config-name');
                     const builtupInput = newRow.querySelector('.land-config-builtup');
                     const builtupUnit = newRow.querySelector('.land-config-builtup-unit');
                     const priceInput = newRow.querySelector('.land-config-price');
                     const frontageInput = newRow.querySelector('.land-config-frontage');
                     const roadInput = newRow.querySelector('.land-config-road');
                     const facingInput = newRow.querySelector('.land-config-facing');
                     
                     if (nameInput) nameInput.value = cfg.custom || '';
                     if (builtupInput) builtupInput.value = cfg.builtup || '';
                     if (builtupUnit) builtupUnit.value = cfg.builtupUnit || 'Square Foot';
                     if (priceInput) priceInput.value = cfg.price || '';
                     if (frontageInput) frontageInput.value = cfg.frontageWidth || '';
                     if (roadInput) roadInput.value = cfg.roadWidth || '';
                     if (facingInput) facingInput.value = cfg.facing || '';
                 }
             }
           });
        }
      } else {
        // Future logic for flat configuration drafting can go here if needed.
        // Usually, apartment configs require image mapping which is complex for simple drafts.
      }
    }

    window.showToast("Progress resumed from your last draft!", "success");
  }

  submitBtn.addEventListener("click", async (e) => {
    e.preventDefault();

    if (!user.canPostMore) {
      window.location.href = "dashboard.html";
      return;
    }

    if (selectedFiles.length === 0) {
      window.showToast(
        "Please upload at least 1 photo before submitting.",
        "error",
      );
      return;
    }

    const prevText = submitBtn.innerText;
    submitBtn.innerText = "⏳ Uploading photos...";
    submitBtn.disabled = true;

    try {
      // 1. Collect Photos and Categories
      const existingPhotos = [];
      document
        .querySelectorAll("#photoPreviewGrid [data-storage-id]")
        .forEach((el) => {
          existingPhotos.push({
            storageId: el.dataset.storageId,
            category: el.querySelector("select").value,
            isCover: el.querySelector('input[type="radio"]')?.checked || false,
          });
        });

      const photoData = [...existingPhotos];
      if (selectedFiles.length > 0) {
        submitBtn.innerText = "⏳ Uploading new photos...";
        const previewCards = document.querySelectorAll(
          "#photoPreviewGrid .preview-card:not([data-storage-id])",
        );
        for (let i = 0; i < selectedFiles.length; i++) {
          const file = selectedFiles[i];
          const card = previewCards[i];
          const uploadUrl = await convex.mutation(
            "files:generateUploadUrl",
            {},
          );
          const resp = await fetch(uploadUrl, {
            method: "POST",
            headers: { "Content-Type": file.type },
            body: file,
          });
          if (!resp.ok) throw new Error("Photo upload failed");
          const { storageId } = await resp.json();
          photoData.push({
            storageId,
            category: card.querySelector("select").value,
            isCover:
              card.querySelector('input[type="radio"]')?.checked || false,
          });
        }
      }

      // 2. Collect and Upload Videos
      const videoData = [];
      if (selectedVideos.length > 0) {
        submitBtn.innerText = "⏳ Uploading videos...";
        const videoCards = document.querySelectorAll(
          "#videoPreviewGrid .preview-card",
        );
        for (let i = 0; i < selectedVideos.length; i++) {
          const file = selectedVideos[i];
          const card = videoCards[i];
          const uploadUrl = await convex.mutation(
            "files:generateUploadUrl",
            {},
          );
          const resp = await fetch(uploadUrl, {
            method: "POST",
            headers: { "Content-Type": file.type },
            body: file,
          });
          if (!resp.ok) throw new Error("Video upload failed");
          const { storageId } = await resp.json();
          videoData.push({
            storageId,
            category: card.querySelector("select").value,
          });
        }
      }
      
      // 3. Upload brochure (if any)
      let brochureData = null;
      if (existingBrochure) {
        brochureData = existingBrochure; // already has storageId
      } else if (selectedBrochureFile) {
        submitBtn.innerText = '⏳ Uploading brochure...';
        const uploadUrl = await convex.mutation("files:generateUploadUrl", {});
        const resp = await fetch(uploadUrl, {
          method: "POST",
          headers: { "Content-Type": selectedBrochureFile.type },
          body: selectedBrochureFile,
        });
        if (!resp.ok) throw new Error('Brochure upload failed');
        const { storageId } = await resp.json();
        brochureData = { storageId, fileName: selectedBrochureFile.name, mimeType: selectedBrochureFile.type };
      }
      
      if (photoData.length === 0) {
        window.showToast("Please upload at least 1 photo.", "error");
        submitBtn.innerText = prevText;
        submitBtn.disabled = false;
        return;
      }

      const formState = getFormState();

      // Upload floorplan images for each configuration (up to 2 per config)
      try {
        const configRows = document.querySelectorAll('#configContainer .config-row');
        for (let ci = 0; ci < configRows.length; ci++) {
          const row = configRows[ci];
          const finput = row.querySelector('input.config-floorplan');
          if (!finput || !finput.files || finput.files.length === 0) continue;
          const max = Number(finput.getAttribute('data-max') || 2);
          for (let k = 0; k < Math.min(finput.files.length, max); k++) {
            const file = finput.files[k];
            if (!file) continue;
            submitBtn.innerText = '⏳ Uploading floor plans...';
            const uploadUrl = await convex.mutation('files:generateUploadUrl', {});
            const resp = await fetch(uploadUrl, { method: 'POST', headers: { 'Content-Type': file.type }, body: file });
            if (!resp.ok) throw new Error('Floorplan upload failed');
            const { storageId } = await resp.json();
            if (!formState.configurations[ci]) formState.configurations[ci] = { photos: [] };
            if (!formState.configurations[ci].photos) formState.configurations[ci].photos = [];
            formState.configurations[ci].photos.push({ storageId, category: 'floorplan' });
          }
        }
      } catch (err) {
        console.error('Floorplan upload failed', err);
        window.showToast('Failed to upload floor plans: ' + (err.message || err), 'error');
        submitBtn.innerText = prevText;
        submitBtn.disabled = false;
        return;
      }

      submitBtn.innerText = editId ? "⏳ Updating..." : "⏳ Posting...";

      // Show full-screen overlay
      const overlay = document.getElementById("submissionOverlay");
      const overlayLoading = document.getElementById("overlayLoading");
      const overlaySuccess = document.getElementById("overlaySuccess");
      const stepUpload = document.getElementById("stepUpload");
      const stepSave = document.getElementById("stepSave");
      const stepDone = document.getElementById("stepDone");

      if (overlay) {
        overlay.style.display = "flex";
        // Step 1 is active by default
      }

      // Advance to step 2 after short delay
      const t1 = setTimeout(() => {
        if (stepSave) {
          stepSave.style.opacity = "1";
          stepSave.querySelector(".step-icon").style.background = "#e84118";
          const spinner = document.createElement("div");
          spinner.style.cssText = "margin-left:auto; width:16px; height:16px; border:2px solid #e2e8f0; border-top-color:#e84118; border-radius:50%; animation:spin 0.8s linear infinite;";
          stepSave.appendChild(spinner);
        }
      }, 3000);

      if (editId) {
        await convex.mutation("properties:updateProperty", {
          token: getToken() || undefined,
          id: editId,
          ...formState,
          photos: photoData,
          videos: videoData,
          brochure: brochureData,
        });
      } else {
        await convex.mutation("properties:createProperty", {
          ...formState,
          photos: photoData,
          videos: videoData,
          brochure: brochureData,
          userId: user._id,
          token: getToken() || undefined,
        });
        // Delete draft after success
        await convex.mutation("drafts:deleteDraft", { token: getToken() });
      }

      clearTimeout(t1);

      // Show step 3 (done) then success screen
      if (stepDone) {
        stepDone.style.opacity = "1";
        stepDone.querySelector(".step-icon").style.background = "#22c55e";
      }

      await new Promise(r => setTimeout(r, 800));

      // Transition to success
      if (overlayLoading) overlayLoading.style.display = "none";
      if (overlaySuccess) {
        overlaySuccess.style.display = "flex";
        overlaySuccess.style.animation = "fadeInUp 0.5s ease";
      }
    } catch (err) {
      // Hide overlay on error
      const overlay = document.getElementById("submissionOverlay");
      if (overlay) overlay.style.display = "none";

      console.error("Failed to post property:", err);
      window.showToast("Error posting property: " + err.message, "error");
    } finally {
      submitBtn.innerText = prevText;
      submitBtn.disabled = false;
    }
  });
  // Auto-save triggers
  document.querySelectorAll("input, select, textarea").forEach((el) => {
    el.addEventListener("change", triggerAutoSave);
    if (el.tagName === "INPUT" || el.tagName === "TEXTAREA") {
      el.addEventListener("input", triggerAutoSave);
    }
  });

  // Auto-save on navigation
  document
    .querySelectorAll(".btn-next, .btn-next-step, .btn-prev-step")
    .forEach((btn) => {
      btn.addEventListener("click", () => saveDraftToCloud());
    });

  // Attach Save Draft button listeners
  document.querySelectorAll(".btn-save-draft").forEach((btn) => {
    btn.addEventListener("click", (e) => {
      e.preventDefault();
      handleManualSave(btn);
    });
  });

  // Check for draft on load
  async function checkExistingDraft() {
    const urlParams = new URLSearchParams(window.location.search);
    const resumeNow = urlParams.get("resume") === "true";

    if (urlParams.get("id")) return; // Don't prompt for draft if editing live property

    try {
      const draft = await convex.query("drafts:getDraft", {
        token: getToken(),
      });
      if (draft) {
        if (resumeNow) {
          // User came from dashboard "Resume Editing" link
          loadDraft(draft);
          return;
        }

        // Show custom redesign modal instead of confirm()
        const modal = document.getElementById("draftResumeModal");
        const btnResume = document.getElementById("btnResumeDraft");
        const btnNew = document.getElementById("btnStartNewListing");

        if (modal && btnResume && btnNew) {
          modal.classList.add("open");

          btnResume.onclick = () => {
            loadDraft(draft);
            modal.classList.remove("open");
            window.showToast("Draft resumed successfully", "success");
          };

          btnNew.onclick = () => {
            modal.classList.remove("open");
            // If they start new, we could potentially delete the old draft,
            // but keeping it is safer for now.
          };
        } else {
          // Fallback if modal HTML is missing
          if (
            confirm(
              "You have a saved draft from a previous session. Would you like to resume?",
            )
          ) {
            loadDraft(draft);
          }
        }
      }
    } catch (err) {
      console.error("Error checking draft:", err);
    }
  }

  checkExistingDraft();

  // Update Rate Label dynamically based on unit selection
  document.addEventListener("change", (e) => {
    if (
      e.target.id === "plotAreaUnit" ||
      e.target.id === "plotRateUnit" ||
      e.target.id === "builtUpAreaUnit" ||
      e.target.id === "commercialSuperAreaUnit"
    ) {
      // Sync Plot Area and Rate units
      if (e.target.id === "plotAreaUnit") {
        const rateUnitSelect = document.getElementById("plotRateUnit");
        if (rateUnitSelect && rateUnitSelect.value !== e.target.value) {
          rateUnitSelect.value = e.target.value;
        }
      } else if (e.target.id === "plotRateUnit") {
        const areaUnitSelect = document.getElementById("plotAreaUnit");
        if (areaUnitSelect && areaUnitSelect.value !== e.target.value) {
          areaUnitSelect.value = e.target.value;
        }
      }

      const label = document.getElementById("ratePerUnitLabel");
      if (label) {
        label.textContent = `Rate Per ${e.target.value} (₹) *`;
      }
    }
  });
});
