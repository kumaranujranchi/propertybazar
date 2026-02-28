import { convex } from "./convex.js";
import { requireAuth, getToken } from "./auth.js";

// ========== PHOTO HANDLING ==========
const photoFileInput = document.getElementById("photoFileInput");
const photoUploadArea = document.getElementById("photoUploadArea");
const photoPreviewGrid = document.getElementById("photoPreviewGrid");
const selectedFiles = [];
const selectedVideos = []; // Added for video gallery

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
      handleFiles([...e.dataTransfer.files], 'video');
    });
    videoFileInput.addEventListener("change", () => {
      handleFiles([...videoFileInput.files], 'video');
      videoFileInput.value = "";
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

async function handleFiles(files, type = 'photo') {
  const isVideo = type === 'video';
  const valid = files.filter((f) => isVideo ? f.type.startsWith("video/") : f.type.startsWith("image/"));
  
  if (isVideo) {
    if (selectedVideos.length >= 1) {
      window.showToast("Only 1 property video is allowed in the free plan. You can add up to 10 YouTube links.", "warning");
      return;
    }
    const file = valid[0];
    if (!file) return;
    
    if (file.size > 20 * 1024 * 1024) {
      window.showToast("Video size exceeds 20MB limit. Please compress or use a YouTube link.", "error");
      return;
    }
    
    selectedVideos.push(file);
    addPreview(file, selectedVideos.length - 1, 'video');
  } else {
    const currentCount = selectedFiles.length;
    const remaining = 20 - currentCount;
    const toProcess = valid.slice(0, remaining);

    const uploadArea = photoUploadArea;
    if (uploadArea) uploadArea.style.opacity = "0.5";

    for (const file of toProcess) {
      const compressedFile = await compressImage(file);
      selectedFiles.push(compressedFile);
      addPreview(compressedFile, selectedFiles.length - 1, 'photo');
    }
    if (uploadArea) uploadArea.style.opacity = "1";
  }
}

const photoCategories = ["Project Image", "Amenities", "Sample Flat", "Location", "Room", "Kitchen", "Bathroom", "Living Room", "Master Plan", "Floor Plan"];
const videoCategories = ["Project Video", "3D Visualization", "Location Video", "Sample Flat"];

function addPreview(file, index, type = 'photo') {
  const isVideo = type === 'video';
  const reader = new FileReader();
  reader.onload = (e) => {
    const grid = isVideo ? document.getElementById("videoPreviewGrid") : photoPreviewGrid;
    const wrap = document.createElement("div");
    wrap.className = "preview-card";
    wrap.style.cssText = "position:relative; background:#fff; border-radius:12px; overflow:hidden; border:1px solid var(--border); padding:8px; display:flex; flex-direction:column; gap:8px;";
    wrap.dataset.index = index;
    
    // Media Element
    if (isVideo) {
      const video = document.createElement("video");
      video.src = e.target.result;
      video.style.cssText = "width:100%; height:100px; object-fit:cover; border-radius:6px;";
      wrap.appendChild(video);
    } else {
      const img = document.createElement("img");
      img.src = e.target.result;
      img.style.cssText = "width:100%; height:100px; object-fit:cover; border-radius:6px;";
      wrap.appendChild(img);
    }

    // Category Selector
    const select = document.createElement("select");
    select.className = "form-input";
    select.style.cssText = "font-size:11px; padding:4px 8px; height:auto; border-radius:6px;";
    const categories = isVideo ? videoCategories : photoCategories;
    categories.forEach(cat => {
      const opt = document.createElement("option");
      opt.value = cat;
      opt.textContent = cat;
      select.appendChild(opt);
    });
    wrap.appendChild(select);

    // Cover Photo Checkbox (Photos only)
    if (!isVideo) {
      const coverLabel = document.createElement("label");
      coverLabel.style.cssText = "font-size:10px; display:flex; align-items:center; gap:4px; cursor:pointer;";
      const radio = document.createElement("input");
      radio.type = "radio";
      radio.name = "coverPhoto";
      radio.value = index;
      if (index === 0) radio.checked = true;
      coverLabel.appendChild(radio);
      coverLabel.appendChild(document.createTextNode("Set as Cover"));
      wrap.appendChild(coverLabel);
    }

    const removeBtn = document.createElement("div");
    removeBtn.textContent = "✕";
    removeBtn.style.cssText = "position:absolute; top:4px; right:4px; background:rgba(232,65,24,0.9); color:#fff; font-size:10px; cursor:pointer; width:18px; height:18px; display:flex; align-items:center; justify-content:center; border-radius:50%;";
    removeBtn.addEventListener("click", () => {
      const arr = isVideo ? selectedVideos : selectedFiles;
      const idx = parseInt(wrap.dataset.index);
      arr.splice(idx, 1);
      wrap.remove();
      [...grid.querySelectorAll(".preview-card")].forEach((el, i) => el.dataset.index = i);
    });
    
    wrap.appendChild(removeBtn);
    grid.appendChild(wrap);
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

// ========== INTERACTIVE FORM LOGIC ==========
function initInteractiveForm() {
  // Segmented Controls (BHK, Status, Room Type)
  document.querySelectorAll('.segmented-control').forEach(control => {
    const hiddenInput = control.nextElementSibling;
    control.querySelectorAll('.segment-item').forEach(item => {
      item.addEventListener('click', () => {
        control.querySelectorAll('.segment-item').forEach(i => i.classList.remove('active'));
        item.classList.add('active');
        if (hiddenInput && hiddenInput.type === 'hidden') {
          hiddenInput.value = item.dataset.value;
          hiddenInput.dispatchEvent(new Event('change'));
        }
        
        // Custom BHK Logic
        if (item.dataset.value === 'Others' && control.id === 'bhkSelector') {
          const customBhk = document.getElementById('fgCustomBhk');
          if (customBhk) customBhk.style.display = 'block';
        } else if (control.id === 'bhkSelector') {
          const customBhk = document.getElementById('fgCustomBhk');
          if (customBhk) customBhk.style.display = 'none';
        }
      });
    });
  });

  // Furnishing Cards
  const furnishingSelector = document.getElementById('furnishingSelector');
  if (furnishingSelector) {
    const hiddenInput = document.getElementById('furnishingStatusSelect');
    furnishingSelector.querySelectorAll('.selection-card').forEach(card => {
      card.addEventListener('click', () => {
        furnishingSelector.querySelectorAll('.selection-card').forEach(c => c.classList.remove('active'));
        card.classList.add('active');
        if (hiddenInput) {
          hiddenInput.value = card.dataset.value;
          hiddenInput.dispatchEvent(new Event('change'));
        }
      });
    });
  }

  // Facing Grid (Multiple selection possible if we want, but usually one)
  document.querySelectorAll('.facing-grid').forEach(grid => {
    const hiddenInput = grid.nextElementSibling;
    grid.querySelectorAll('.face-item').forEach(item => {
      item.addEventListener('click', () => {
        // Toggle active
        item.classList.toggle('active');
        
        // Update hidden input with comma separated values
        const activeVals = [...grid.querySelectorAll('.face-item.active')].map(i => i.dataset.value);
        if (hiddenInput) hiddenInput.value = activeVals.join(', ');
      });
    });
  });

  // Amenity Pills
  document.querySelectorAll('.amenity-pill').forEach(pill => {
    pill.addEventListener('click', () => {
      pill.classList.toggle('active');
    });
  });
}

function initGooglePlaces() {
  const input = document.getElementById('googleLocationSearch');
  if (!input || !window.google) return;

  // Sidebar Preview logic
  const mapLinkInput = document.getElementById('googleMapLinkInput');
  if (mapLinkInput) {
    const handleMapInput = () => {
      const url = mapLinkInput.value.trim();
      if (url) updateMapPreview(url);
    };
    mapLinkInput.addEventListener('input', handleMapInput);
    mapLinkInput.addEventListener('paste', () => setTimeout(handleMapInput, 10)); // Small delay for paste
  }

  const autocomplete = new google.maps.places.Autocomplete(input, {
    componentRestrictions: { country: "in" },
    fields: ["address_components", "geometry", "name"],
    types: ["geocode", "establishment"]
  });

  // Listeners for manual fields to update map
  const manualFields = ['localityInput', 'citySelect', 'stateSelect'];
  manualFields.forEach(id => {
    const el = document.getElementById(id);
    if (el) {
      el.addEventListener('change', () => {
        const locality = document.getElementById('localityInput')?.value;
        const city = document.getElementById('citySelect')?.value;
        if (locality && city) updateMapPreview(`${locality}, ${city}`);
      });
      // Also on blur for text input
      if (el.tagName === 'INPUT') {
        el.addEventListener('blur', () => {
          const locality = document.getElementById('localityInput')?.value;
          const city = document.getElementById('citySelect')?.value;
          if (locality && city) updateMapPreview(`${locality}, ${city}`);
        });
      }
    }
  });

  autocomplete.addListener("place_changed", () => {
    const place = autocomplete.getPlace();
    if (!place.geometry) return;

    let state = "", city = "", pin = "", locality = place.name;
    for (const component of place.address_components) {
      const types = component.types;
      if (types.includes("administrative_area_level_1")) state = component.long_name;
      if (types.includes("locality")) city = component.long_name;
      if (types.includes("postal_code")) pin = component.long_name;
      if (types.includes("sublocality_level_1")) locality = component.long_name;
    }

    const stateSelect = document.getElementById('stateSelect');
    const citySelect = document.getElementById('citySelect');
    const pinInput = document.querySelector('input[placeholder="6-digit PIN code"]');
    const localityInput = document.querySelector('input[placeholder="e.g. Sector 62, Koramangala"]');

    if (stateSelect) {
      stateSelect.value = state;
      stateSelect.dispatchEvent(new Event('change'));
    }
    if (citySelect) {
      citySelect.value = city;
      citySelect.dispatchEvent(new Event('change'));
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
  const previewCard = document.getElementById('sidebarLocationPreview');
  const iframe = document.getElementById('googleMapIframe');
  const container = document.getElementById('mapPreviewContainer');
  
  if (!previewCard || !iframe) return;

  let query = location;
  let isUrl = location.includes("http") || location.includes("google.com/maps");
  let isShortUrl = location.includes("maps.app.goo.gl") || location.includes("goo.gl/maps");
  
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
         query = decodeURIComponent(placeMatch[2].replace(/\+/g, ' '));
         isUrl = false;
      } else {
        // 3. Try extracting from q=lat,lng or q=Name
        const qMatch = location.match(/[?&]q=([^&]+)/);
        if (qMatch) {
           query = decodeURIComponent(qMatch[1].replace(/\+/g, ' '));
           isUrl = query.includes("http");
        }
      }
    }
  }

  // FALLBACK: If it's still a URL (short link or unparsed long link), use manual fields for the PREVIEW
  // We don't pass the URL itself to the iframe 'q' parameter because it causes "Custom content could not be displayed" error
  if (isUrl || !query || isShortUrl) {
     const locality = document.getElementById('localityInput')?.value;
     const city = document.getElementById('citySelect')?.value;
     const pin = document.getElementById('pinCodeInput')?.value;
     
     if (locality && city) {
        query = `${locality}, ${city}${pin ? ", " + pin : ""}`;
        isUrl = false;
     } else if (city) {
        query = `${city}${pin ? ", " + pin : ""}`;
        isUrl = false;
     } else if (pin) {
        query = pin;
        isUrl = false;
     } else {
        // Only if we have NO manual info and it's a URL, we try the URL (last resort, likely shows error)
        if (!query) {
          iframe.src = "";
          container.classList.remove('loaded');
          return;
        }
     }
  }

  // Show the card
  previewCard.style.display = 'block';

  // Use the reliable non-API embed URL
  const mapUrl = `https://maps.google.com/maps?q=${encodeURIComponent(query)}&z=14&output=embed`;

  // Only update if source changed to avoid flickering
  if (iframe.src !== mapUrl) {
    container.classList.remove('loaded');
    iframe.src = mapUrl;
    iframe.onload = () => {
      container.classList.add('loaded');
    };
  }
}
window.initGooglePlaces = initGooglePlaces;

// ========== FORM SUBMISSION ==========
document.addEventListener("DOMContentLoaded", async () => {
  initGooglePlaces();
  initInteractiveForm();

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

  // ========== YOUTUBE LINKS LOGIC ==========
  const addVideoLinkBtn = document.getElementById('addVideoLinkBtn');
  const videoLinksContainer = document.getElementById('videoLinksContainer');
  
  if (addVideoLinkBtn && videoLinksContainer) {
    addVideoLinkBtn.addEventListener('click', () => {
      const currentLinks = videoLinksContainer.querySelectorAll('.video-link-row').length;
      if (currentLinks >= 10) {
        window.showToast("Maximum 10 external video links allowed.", "warning");
        return;
      }

      const newRow = document.createElement('div');
      newRow.className = 'video-link-row';
      newRow.style.cssText = 'display:flex; gap:10px; margin-bottom:10px';
      newRow.innerHTML = `
        <input type="url" class="form-input video-link-input" placeholder="Paste YouTube/Vimeo link here" style="flex:1">
        <button type="button" class="btn btn-outline btn-sm remove-link-btn" style="padding: 0 15px; color: var(--danger); border-color: var(--danger)" onclick="this.parentElement.remove(); updateRemoveButtons()"><i class="fa-solid fa-trash"></i></button>
      `;
      videoLinksContainer.appendChild(newRow);
      updateRemoveButtons();
    });

    function updateRemoveButtons() {
      const rows = videoLinksContainer.querySelectorAll('.video-link-row');
      rows.forEach(row => {
        const btn = row.querySelector('.remove-link-btn');
        if (btn) btn.style.display = rows.length > 1 ? 'block' : 'none';
      });
    }
    window.updateRemoveButtons = updateRemoveButtons;
  }

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
        const stateSelect = document.getElementById('stateSelect');
        const citySelect = document.getElementById('citySelect');
        if (stateSelect) {
          stateSelect.value = prop.location.state;
          stateSelect.dispatchEvent(new Event('change'));
          setTimeout(() => {
            if (citySelect) citySelect.value = prop.location.city;
            const localityInput = document.getElementById('localityInput');
            const societyInput = document.getElementById('societyInput');
            const addressInput = document.getElementById('addressInput');
            const pinCodeInput = document.getElementById('pinCodeInput');
            const landmarkInput = document.getElementById('landmarkInput');
            const mapLinkInput = document.getElementById('googleMapLinkInput');

            if (localityInput) localityInput.value = prop.location.locality;
            if (societyInput) societyInput.value = prop.location.society || '';
            if (addressInput) addressInput.value = prop.location.fullAddress || '';
            if (pinCodeInput) pinCodeInput.value = prop.location.pinCode;
            if (landmarkInput) landmarkInput.value = prop.location.landmark || '';
            if (mapLinkInput) {
              mapLinkInput.value = prop.location.googleMapLink || '';
              if (prop.location.googleMapLink) updateMapPreview(prop.location.googleMapLink);
            } else if (prop.location.googleSearch) {
              updateMapPreview(prop.location.googleSearch);
            }

            if (document.getElementById('metroDistance')) document.getElementById('metroDistance').value = prop.location.metroDistance || '';
            if (document.getElementById('schoolDistance')) document.getElementById('schoolDistance').value = prop.location.schoolDistance || '';
            if (document.getElementById('mallDistance')) document.getElementById('mallDistance').value = prop.location.mallDistance || '';
            if (document.getElementById('hospitalDistance')) document.getElementById('hospitalDistance').value = prop.location.hospitalDistance || '';
          }, 500);
        }

        // Pre-fill Step 3: Details
        const bhkTypeSelect = document.getElementById('bhkTypeSelect');
        const propertyStatusSelect = document.getElementById('propertyStatusSelect');
        const furnishingStatusSelect = document.getElementById('furnishingStatusSelect');
        const facingSelect = document.getElementById('facingSelect');

        if (bhkTypeSelect) {
          // Handle BHK Segmented Control
          const bhkVal = ['1RK','1BHK','2BHK','3BHK','4BHK','4.5BHK','5BHK','6BHK'].includes(prop.details.bhk) ? prop.details.bhk : 'Others';
          bhkTypeSelect.value = bhkVal;
          const bhkItem = document.querySelector(`#bhkSelector .segment-item[data-value="${bhkVal}"]`);
          if (bhkItem) {
             document.querySelectorAll('#bhkSelector .segment-item').forEach(i => i.classList.remove('active'));
             bhkItem.classList.add('active');
          }
          if (bhkVal === 'Others') {
            document.getElementById('fgCustomBhk').style.display = 'block';
            document.getElementById('customBhkInput').value = prop.details.bhk;
          }
        }

        if (propertyStatusSelect) {
          propertyStatusSelect.value = prop.details.status;
          const statusItem = document.querySelector(`#statusSelector .segment-item[data-value="${prop.details.status}"]`);
          if (statusItem) {
             document.querySelectorAll('#statusSelector .segment-item').forEach(i => i.classList.remove('active'));
             statusItem.classList.add('active');
          }
        }

        if (document.getElementById('builtUpAreaInput')) document.getElementById('builtUpAreaInput').value = prop.details.builtUpArea;
        if (document.getElementById('carpetAreaInput')) document.getElementById('carpetAreaInput').value = prop.details.carpetArea || '';
        if (document.getElementById('floorNumberInput')) document.getElementById('floorNumberInput').value = prop.details.floorNumber || '';
        if (document.getElementById('totalFloorsInput')) document.getElementById('totalFloorsInput').value = prop.details.totalFloors || '';

        if (furnishingStatusSelect) {
          furnishingStatusSelect.value = prop.details.furnishing;
          const furnCard = document.querySelector(`#furnishingSelector .selection-card[data-value="${prop.details.furnishing}"]`);
          if (furnCard) {
             document.querySelectorAll('#furnishingSelector .selection-card').forEach(c => c.classList.remove('active'));
             furnCard.classList.add('active');
          }
        }

        if (facingSelect) {
          facingSelect.value = prop.details.facing || '';
          if (prop.details.facing) {
            prop.details.facing.split(', ').forEach(f => {
              const faceItem = document.querySelector(`.face-item[data-value="${f}"]`);
              if (faceItem) faceItem.classList.add('active');
            });
          }
        }

        if (document.getElementById('parkingSelect')) document.getElementById('parkingSelect').value = prop.details.parking || '';
        if (document.getElementById('constructionYearInput')) document.getElementById('constructionYearInput').value = prop.details.constructionYear || '';
        if (document.getElementById('reraInput')) document.getElementById('reraInput').value = prop.details.rera || '';
        if (document.getElementById('descriptionInput')) document.getElementById('descriptionInput').value = prop.details.description || '';

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
      // 1. Collect Photos and Categories
      const existingPhotos = [];
      document.querySelectorAll('#photoPreviewGrid [data-storage-id]').forEach(el => {
        existingPhotos.push({
          storageId: el.dataset.storageId,
          category: el.querySelector('select').value,
          isCover: el.querySelector('input[type="radio"]')?.checked || false
        });
      });

      const photoData = [...existingPhotos];
      if (selectedFiles.length > 0) {
        submitBtn.innerText = "⏳ Uploading new photos...";
        const previewCards = document.querySelectorAll('#photoPreviewGrid .preview-card:not([data-storage-id])');
        for (let i = 0; i < selectedFiles.length; i++) {
          const file = selectedFiles[i];
          const card = previewCards[i];
          const uploadUrl = await convex.mutation("files:generateUploadUrl", {});
          const resp = await fetch(uploadUrl, {
            method: "POST",
            headers: { "Content-Type": file.type },
            body: file,
          });
          if (!resp.ok) throw new Error("Photo upload failed");
          const { storageId } = await resp.json();
          photoData.push({
            storageId,
            category: card.querySelector('select').value,
            isCover: card.querySelector('input[type="radio"]')?.checked || false
          });
        }
      }

      // 2. Collect and Upload Videos
      const videoData = [];
      if (selectedVideos.length > 0) {
        submitBtn.innerText = "⏳ Uploading videos...";
        const videoCards = document.querySelectorAll('#videoPreviewGrid .preview-card');
        for (let i = 0; i < selectedVideos.length; i++) {
          const file = selectedVideos[i];
          const card = videoCards[i];
          const uploadUrl = await convex.mutation("files:generateUploadUrl", {});
          const resp = await fetch(uploadUrl, {
            method: "POST",
            headers: { "Content-Type": file.type },
            body: file,
          });
          if (!resp.ok) throw new Error("Video upload failed");
          const { storageId } = await resp.json();
          videoData.push({
            storageId,
            category: card.querySelector('select').value
          });
        }
      }
      
      if (photoData.length === 0) {
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

      const googleLoc = document.getElementById('googleLocationSearch').value;

      const location = {
        state: document.getElementById('stateSelect').value,
        city: document.getElementById('citySelect').value,
        locality: document.getElementById('localityInput').value,
        society: document.getElementById('societyInput').value || undefined,
        fullAddress: document.getElementById('addressInput').value || undefined,
        pinCode: document.getElementById('pinCodeInput').value,
        landmark: document.getElementById('landmarkInput').value || undefined,
        googleMapLink: document.getElementById('googleMapLinkInput').value || undefined,
        metroDistance: document.getElementById('metroDistance')?.value || undefined,
        schoolDistance: document.getElementById('schoolDistance')?.value || undefined,
        mallDistance: document.getElementById('mallDistance')?.value || undefined,
        hospitalDistance: document.getElementById('hospitalDistance')?.value || undefined,
        googleSearch: googleLoc || undefined
      };

      const bhkType = document.getElementById('bhkTypeSelect').value;
      const bhk = bhkType === 'Others' ? document.getElementById('customBhkInput').value : bhkType;

      const details = {
        bhk: bhk,
        status: document.getElementById('propertyStatusSelect').value,
        builtUpArea: Number(document.getElementById('builtUpAreaInput').value) || 0,
        carpetArea: Number(document.getElementById('carpetAreaInput').value) || undefined,
        floorNumber: Number(document.getElementById('floorNumberInput').value) || undefined,
        totalFloors: Number(document.getElementById('totalFloorsInput').value) || undefined,
        furnishing: document.getElementById('furnishingStatusSelect').value,
        facing: document.getElementById('facingSelect').value || undefined,
        parking: document.getElementById('parkingSelect').value || undefined, 
        constructionYear: Number(document.getElementById('constructionYearInput').value) || undefined,
        rera: document.getElementById('reraInput').value || undefined,
        description: document.getElementById('descriptionInput').value || "",
      };

      // Collect Amenities from Pills
      const amenities = [];
      document.querySelectorAll('.amenity-pill.active').forEach(pill => {
        amenities.push(pill.dataset.value);
      });

      const pricing = {
        expectedPrice: Number(document.getElementById('expectedPriceInput').value) || 0,
        pricingType: document.getElementById('pricingTypeSelect').value,
        priceType: document.getElementById('priceTypeSelect').value || undefined,
        maintenance: Number(document.getElementById('maintenanceChargesInput').value) || undefined,
        tokenAmount: Number(document.getElementById('tokenAmountInput').value) || undefined,
      };

      const contactDesc = {
        name: document.getElementById('contactNameInput').value,
        mobile: document.getElementById('contactMobileInput').value,
        email: document.getElementById('contactEmailInput').value,
        role: document.getElementById('contactRoleSelect').value || undefined,
        contactTime: document.getElementById('contactTimeSelect').value || undefined,
      };

      const externalVideos = [];
      document.querySelectorAll('.video-link-input').forEach(input => {
        if (input.value.trim()) externalVideos.push(input.value.trim());
      });

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
          photos: photoData,
          videos: videoData,
          externalVideos: externalVideos,
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
          photos: photoData,
          videos: videoData,
          externalVideos: externalVideos,
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
