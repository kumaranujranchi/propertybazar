import { convex } from "./convex.js";
import { requireAuth, getToken } from "./auth.js";

// ========== PHOTO HANDLING ==========
const photoFileInput = document.getElementById("photoFileInput");
const photoUploadArea = document.getElementById("photoUploadArea");
const photoPreviewGrid = document.getElementById("photoPreviewGrid");
const selectedFiles = [];

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

async function handleFiles(files) {
  const valid = files.filter((f) => f.type.startsWith("image/"));
  const remaining = 20 - selectedFiles.length;
  const toProcess = valid.slice(0, remaining);

  // Show loading indicator on area (optional but good UX)
  if (photoUploadArea) photoUploadArea.style.opacity = "0.5";

  for (const file of toProcess) {
    const compressedFile = await compressImage(file);
    selectedFiles.push(compressedFile);
    addPreview(compressedFile, selectedFiles.length - 1);
  }

  if (photoUploadArea) photoUploadArea.style.opacity = "1";
}

function addPreview(file, index) {
  const reader = new FileReader();
  reader.onload = (e) => {
    const wrap = document.createElement("div");
    wrap.style.cssText =
      "position:relative;width:90px;height:90px;border-radius:8px;overflow:hidden;border:1px solid var(--border)";
    wrap.dataset.index = index;
    const img = document.createElement("img");
    img.src = e.target.result;
    img.style.cssText = "width:100%;height:100%;object-fit:cover";
    const removeBtn = document.createElement("div");
    removeBtn.textContent = "✕";
    removeBtn.style.cssText =
      "position:absolute;top:2px;right:4px;background:rgba(0,0,0,0.6);color:#fff;font-size:11px;cursor:pointer;padding:0 4px;border-radius:4px;line-height:18px";
    removeBtn.addEventListener("click", () => {
      const idx = parseInt(wrap.dataset.index);
      selectedFiles.splice(idx, 1);
      wrap.remove();
      [...photoPreviewGrid.querySelectorAll("[data-index]")].forEach(
        (el, i) => (el.dataset.index = i),
      );
    });
    wrap.appendChild(img);
    wrap.appendChild(removeBtn);
    photoPreviewGrid.appendChild(wrap);
  };
  reader.readAsDataURL(file);
}

// Function to add existing storage IDs as "files" for preview
async function addExistingPhoto(storageId) {
  try {
    const url = await convex.query("properties:getPhotoUrl", { storageId });
    if (!url) return;
    
    // We store the storageId differently so we don't re-upload it
    const wrap = document.createElement("div");
    wrap.style.cssText = "position:relative;width:90px;height:90px;border-radius:8px;overflow:hidden;border:1px solid var(--border)";
    wrap.dataset.storageId = storageId;
    
    const img = document.createElement("img");
    img.src = url;
    img.style.cssText = "width:100%;height:100%;object-fit:cover";
    
    const removeBtn = document.createElement("div");
    removeBtn.textContent = "✕";
    removeBtn.style.cssText = "position:absolute;top:2px;right:4px;background:rgba(0,0,0,0.6);color:#fff;font-size:11px;cursor:pointer;padding:0 4px;border-radius:4px;line-height:18px";
    removeBtn.addEventListener("click", () => wrap.remove());
    
    wrap.appendChild(img);
    wrap.appendChild(removeBtn);
    photoPreviewGrid.appendChild(wrap);
  } catch (e) {
    console.error("Error loading existing photo:", e);
  }
}

// ========== FORM SUBMISSION ==========
document.addEventListener("DOMContentLoaded", async () => {
  // Auth guard - redirect to login if not logged in
  const user = await requireAuth("login.html?redirect=post-property.html");
  if (!user) return;

  // Check free limit
  if (!user.canPostMore) {
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

  // Detect Edit Mode
  const urlParams = new URLSearchParams(window.location.search);
  const editId = urlParams.get('id');
  const submitBtn = document.getElementById("btnSubmitProperty");
  if (!submitBtn) return;

  if (editId) {
    submitBtn.innerHTML = `<i class="fa-solid fa-floppy-disk"></i> Update Property Details`;
    document.querySelector('.post-hero h1').innerHTML = `<i class="fa-solid fa-pen-to-square"></i> Edit Your Property`;
    document.querySelector('.post-hero p').textContent = "Update your property details to keep them accurate and attract more buyers.";
    
    try {
      const prop = await convex.query('properties:getProperty', { id: editId });
      if (prop) {
        // Pre-fill Step 1: Property Types (this is harder due to grid UI)
        // For simplicity, we'll try to find the matching elements
        document.querySelectorAll('#formStep1 .form-type-grid').forEach((grid, gIdx) => {
          const target = gIdx === 0 ? prop.transactionType : prop.propertyType;
          grid.querySelectorAll('.form-type-option').forEach(opt => {
            if (opt.querySelector('.name').innerText.trim() === target) {
              opt.parentElement.querySelectorAll('.form-type-option').forEach(el => el.classList.remove('active'));
              opt.classList.add('active');
            }
          });
        });

        // Pre-fill Step 2: Location
        const locInputs = document.querySelectorAll("#formStep2 .form-input");
        if (locInputs[0]) {
          locInputs[0].value = prop.location.state;
          locInputs[0].dispatchEvent(new Event('change')); // Trigger city population
          setTimeout(() => {
            locInputs[1].value = prop.location.city;
            locInputs[2].value = prop.location.locality;
            locInputs[3].value = prop.location.society || '';
            locInputs[4].value = prop.location.fullAddress || '';
            locInputs[5].value = prop.location.pinCode;
            locInputs[6].value = prop.location.landmark || '';
            if (locInputs[7]) locInputs[7].value = prop.location.metroDistance || '';
            if (locInputs[8]) locInputs[8].value = prop.location.schoolDistance || '';
            if (locInputs[9]) locInputs[9].value = prop.location.mallDistance || '';
            if (locInputs[10]) locInputs[10].value = prop.location.hospitalDistance || '';
          }, 500);
        }

        // Pre-fill Step 3: Details
        const detInputs = document.querySelectorAll("#formStep3 .form-input");
        if (detInputs[0]) {
          detInputs[0].value = prop.details.bhk;
          detInputs[1].value = prop.details.status;
          detInputs[2].value = prop.details.builtUpArea;
          detInputs[3].value = prop.details.carpetArea || '';
          detInputs[4].value = prop.details.floorNumber || '';
          detInputs[5].value = prop.details.totalFloors || '';
          detInputs[6].value = prop.details.furnishing || '';
          detInputs[7].value = prop.details.facing || '';
          detInputs[8].value = prop.details.parking || '';
          detInputs[9].value = prop.details.constructionYear || '';
          detInputs[10].value = prop.details.description || '';
        }

        // Pre-fill Amenities
        const amenityCheckboxes = document.querySelectorAll('#formStep3 input[type="checkbox"]');
        amenityCheckboxes.forEach(cb => {
          if (prop.amenities.includes(cb.parentElement.innerText.trim())) {
            cb.checked = true;
          }
        });

        // Pre-fill Step 4: Photos (Existing)
        for (const sid of prop.photos || []) {
          addExistingPhoto(sid);
        }

        // Pre-fill Step 5: Pricing & Contact
        const priceInputs = document.querySelectorAll("#formStep5 .form-input");
        if (priceInputs[0]) {
          priceInputs[0].value = prop.pricing.expectedPrice;
          priceInputs[1].value = prop.pricing.priceType || '';
          priceInputs[2].value = prop.pricing.maintenance || '';
          priceInputs[3].value = prop.pricing.tokenAmount || '';
          priceInputs[4].value = prop.contactDesc.name;
          priceInputs[5].value = prop.contactDesc.mobile;
          priceInputs[6].value = prop.contactDesc.email;
          priceInputs[7].value = prop.contactDesc.role || '';
          priceInputs[8].value = prop.contactDesc.rera || '';
          priceInputs[9].value = prop.contactDesc.contactTime || '';
        }
      }
    } catch (err) {
      console.error("Error loading property:", err);
      window.showToast("Failed to load property data for editing", "error");
    }
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
      // 1. Collect Photos
      const existingPhotos = [];
      document.querySelectorAll('#photoPreviewGrid [data-storage-id]').forEach(el => {
        existingPhotos.push(el.dataset.storageId);
      });

      const newPhotoStorageIds = [];
      if (selectedFiles.length > 0) {
        submitBtn.innerText = "⏳ Uploading new photos...";
        for (const file of selectedFiles) {
          const uploadUrl = await convex.mutation("files:generateUploadUrl", {});
          const resp = await fetch(uploadUrl, {
            method: "POST",
            headers: { "Content-Type": file.type },
            body: file,
          });
          if (!resp.ok) throw new Error("Photo upload failed");
          const { storageId } = await resp.json();
          newPhotoStorageIds.push(storageId);
        }
      }
      
      const photoStorageIds = [...existingPhotos, ...newPhotoStorageIds];

      if (photoStorageIds.length === 0) {
        window.showToast("Please upload at least 1 photo.", "error");
        submitBtn.innerText = prevText;
        submitBtn.disabled = false;
        return;
      }

      // Gather form data
      const step1Grids = document.querySelectorAll(
        "#formStep1 .form-type-grid",
      );
      const transactionType = step1Grids[0]
        .querySelector(".active .name")
        .innerText.trim();
      const propertyType = step1Grids[1]
        .querySelector(".active .name")
        .innerText.trim();

      const locInputs = document.querySelectorAll("#formStep2 .form-input");
      const location = {
        state: locInputs[0].value,
        city: locInputs[1].value,
        locality: locInputs[2].value,
        society: locInputs[3].value || undefined,
        fullAddress: locInputs[4].value || undefined,
        pinCode: locInputs[5].value,
        landmark: locInputs[6].value || undefined,
        metroDistance: locInputs[7]?.value || undefined,
        schoolDistance: locInputs[8]?.value || undefined,
        mallDistance: locInputs[9]?.value || undefined,
        hospitalDistance: locInputs[10]?.value || undefined,
      };

      const detInputs = document.querySelectorAll("#formStep3 .form-input");
      const details = {
        bhk: detInputs[0].value,
        status: detInputs[1].value,
        builtUpArea: Number(detInputs[2].value) || 0,
        carpetArea: Number(detInputs[3].value) || undefined,
        floorNumber: Number(detInputs[4].value) || undefined,
        totalFloors: Number(detInputs[5].value) || undefined,
        furnishing: detInputs[6].value || undefined,
        facing: detInputs[7].value || undefined,
        parking: detInputs[8].value || undefined,
        constructionYear: Number(detInputs[9].value) || undefined,
        description: detInputs[10].value || "",
      };

      const amenities = [];
      document
        .querySelectorAll('#formStep3 input[type="checkbox"]')
        .forEach((cb) => {
          if (cb.checked) amenities.push(cb.parentElement.innerText.trim());
        });

      const priceInputs = document.querySelectorAll("#formStep5 .form-input");
      const pricing = {
        expectedPrice: Number(priceInputs[0].value) || 0,
        priceType: priceInputs[1].value || undefined,
        maintenance: Number(priceInputs[2].value) || undefined,
        tokenAmount: Number(priceInputs[3].value) || undefined,
      };

      const contactDesc = {
        name: priceInputs[4].value,
        mobile: priceInputs[5].value,
        email: priceInputs[6].value,
        role: priceInputs[7].value || undefined,
        rera: priceInputs[8].value || undefined,
        contactTime: priceInputs[9].value || undefined,
      };

      submitBtn.innerText = editId ? "⏳ Updating property..." : "⏳ Posting property...";

      if (editId) {
        await convex.mutation("properties:updateProperty", {
          token: getToken(),
          id: editId,
          transactionType,
          propertyType,
          location,
          details,
          amenities,
          photos: photoStorageIds,
          pricing,
          contactDesc,
        });
        window.showToast("Property updated successfully!", "success");
      } else {
        await convex.mutation("properties:createProperty", {
          transactionType,
          propertyType,
          location,
          details,
          amenities,
          photos: photoStorageIds,
          pricing,
          contactDesc,
          userId: user._id,
          token: getToken(),
        });
        window.showToast("Property posted successfully!", "success");
      }
      window.location.href = "dashboard.html";
    } catch (err) {
      console.error("Failed to post property:", err);
      window.showToast("Error posting property: " + err.message, "error");
    } finally {
      submitBtn.innerText = prevText;
      submitBtn.disabled = false;
    }
  });
});
