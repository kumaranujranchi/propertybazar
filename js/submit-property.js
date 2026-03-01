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
  const manualFields = ['localityInput', 'citySelect', 'stateSelect', 'pinCodeInput'];
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

  // FALLBACK: If it's still a URL (short link or unparsed long link), strictly use manual fields for the PREVIEW
  // Passing the URL itself to the iframe 'q' parameter MUST be avoided as it causes "Custom content could not be displayed" error
  if (isUrl || !query || isShortUrl) {
     const locality = document.getElementById('localityInput')?.value;
     const city = document.getElementById('citySelect')?.value;
     const state = document.getElementById('stateSelect')?.value;
     const pin = document.getElementById('pinCodeInput')?.value;
     
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
        container.classList.remove('loaded');
        return;
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

        // Pre-fill Villa
        if (document.getElementById('propertyTitleInput')) document.getElementById('propertyTitleInput').value = prop.details.propertyTitle || '';
        if (document.getElementById('ownershipTypeSelect')) document.getElementById('ownershipTypeSelect').value = prop.details.ownershipType || '';
        if (document.getElementById('bathroomsSelect')) document.getElementById('bathroomsSelect').value = prop.details.bathrooms || '';
        if (document.getElementById('balconiesSelect')) document.getElementById('balconiesSelect').value = prop.details.balconies || '';
        if (document.getElementById('cbStudyRoom')) document.getElementById('cbStudyRoom').checked = prop.details.studyRoom || false;
        if (document.getElementById('cbServantRoom')) document.getElementById('cbServantRoom').checked = prop.details.servantRoom || false;
        if (document.getElementById('cbPoojaRoom')) document.getElementById('cbPoojaRoom').checked = prop.details.poojaRoom || false;
        if (document.getElementById('cbStoreRoom')) document.getElementById('cbStoreRoom').checked = prop.details.storeRoom || false;
        if (document.getElementById('cbBasement')) document.getElementById('cbBasement').checked = prop.details.basement || false;
        if (document.getElementById('floorConfigInput')) document.getElementById('floorConfigInput').value = prop.details.floorConfig || '';
        if (document.getElementById('plotAreaInput')) document.getElementById('plotAreaInput').value = prop.details.plotArea || '';
        if (document.getElementById('superBuiltUpAreaInput')) document.getElementById('superBuiltUpAreaInput').value = prop.details.superBuiltUpArea || '';
        if (document.getElementById('openAreaInput')) document.getElementById('openAreaInput').value = prop.details.openArea || '';
        if (document.getElementById('frontageWidthInput')) document.getElementById('frontageWidthInput').value = prop.details.frontageWidth || '';
        if (document.getElementById('roadWidthInput')) document.getElementById('roadWidthInput').value = prop.details.roadWidth || '';
        if (document.getElementById('ageOfPropertySelect')) document.getElementById('ageOfPropertySelect').value = prop.details.ageOfProperty || '';
        if (document.getElementById('constructionQualitySelect')) document.getElementById('constructionQualitySelect').value = prop.details.constructionQuality || '';
        if (document.getElementById('flooringTypeInput')) document.getElementById('flooringTypeInput').value = prop.details.flooringType || '';
        if (document.getElementById('wallFinishInput')) document.getElementById('wallFinishInput').value = prop.details.wallFinish || '';
        if (document.getElementById('ceilingHeightInput')) document.getElementById('ceilingHeightInput').value = prop.details.ceilingHeight || '';
        if (document.getElementById('waterSourceSelect')) document.getElementById('waterSourceSelect').value = prop.details.waterSource || '';
        if (document.getElementById('electricityLoadInput')) document.getElementById('electricityLoadInput').value = prop.details.electricityLoad || '';
        if (document.getElementById('openParkingSelect')) document.getElementById('openParkingSelect').value = prop.details.openParking || '';
        if (document.getElementById('cbGarage')) document.getElementById('cbGarage').checked = prop.details.garage || false;
        if (document.getElementById('cbEvCharging')) document.getElementById('cbEvCharging').checked = prop.details.evCharging || false;
        if (document.getElementById('approvalAuthorityInput')) document.getElementById('approvalAuthorityInput').value = prop.details.approvalAuthority || '';
        if (document.getElementById('propertyTaxStatusSelect')) document.getElementById('propertyTaxStatusSelect').value = prop.details.propertyTaxStatus || '';
        if (document.getElementById('loanApprovedInput')) document.getElementById('loanApprovedInput').value = prop.details.loanApproved || '';
        if (document.getElementById('cbOccupancyCert')) document.getElementById('cbOccupancyCert').checked = prop.details.occupancyCertificate || false;
        if (document.getElementById('cbCompletionCert')) document.getElementById('cbCompletionCert').checked = prop.details.completionCertificate || false;

        // Pre-fill Commercial
        if (document.getElementById('commercialTypeSelect')) document.getElementById('commercialTypeSelect').value = prop.details.commercialType || '';
        if (document.getElementById('commercialGradeSelect')) document.getElementById('commercialGradeSelect').value = prop.details.grade || '';
        if (document.getElementById('commercialOwnershipSelect')) document.getElementById('commercialOwnershipSelect').value = prop.details.ownershipType || '';
        if (document.getElementById('commercialCeilingHeight')) document.getElementById('commercialCeilingHeight').value = prop.details.ceilingHeight || '';
        if (document.getElementById('commercialFrontage')) document.getElementById('commercialFrontage').value = prop.details.frontage || '';
        if (document.getElementById('commercialRoadWidth')) document.getElementById('commercialRoadWidth').value = prop.details.roadWidth || '';
        if (document.getElementById('commercialSuperArea')) document.getElementById('commercialSuperArea').value = prop.details.superBuiltUpArea || '';
        if (document.getElementById('commercialFurnishing')) document.getElementById('commercialFurnishing').value = prop.details.furnishing || '';
        if (document.getElementById('commercialWorkstations')) document.getElementById('commercialWorkstations').value = prop.details.workstations || '';
        if (document.getElementById('commercialCabins')) document.getElementById('commercialCabins').value = prop.details.cabins || '';
        if (document.getElementById('commercialMeetingRooms')) document.getElementById('commercialMeetingRooms').value = prop.details.meetingRooms || '';
        if (document.getElementById('commercialWashrooms')) document.getElementById('commercialWashrooms').value = prop.details.washrooms || '';
        if (document.getElementById('commercialAcType')) document.getElementById('commercialAcType').value = prop.details.acType || '';
        if (document.getElementById('commercialPowerBackup')) document.getElementById('commercialPowerBackup').value = prop.details.powerBackupCapacity || '';
        if (document.getElementById('commercialRetailFloor')) document.getElementById('commercialRetailFloor').value = prop.details.retailFloor || '';
        if (document.getElementById('commercialFootfallZone')) document.getElementById('commercialFootfallZone').value = prop.details.footfallZone || '';
        if (document.getElementById('commercialMallHighStreet')) document.getElementById('commercialMallHighStreet').value = prop.details.mallHighStreet || '';
        
        if (document.getElementById('cbConferenceRoom')) document.getElementById('cbConferenceRoom').checked = prop.details.conferenceRoom || false;
        if (document.getElementById('cbReceptionArea')) document.getElementById('cbReceptionArea').checked = prop.details.receptionArea || false;
        if (document.getElementById('cbPantry')) document.getElementById('cbPantry').checked = prop.details.pantry || false;
        if (document.getElementById('cbServerRoom')) document.getElementById('cbServerRoom').checked = prop.details.serverRoom || false;
        if (document.getElementById('cbGlassFrontage')) document.getElementById('cbGlassFrontage').checked = prop.details.glassFrontage || false;
        if (document.getElementById('cbDisplayArea')) document.getElementById('cbDisplayArea').checked = prop.details.displayArea || false;
        if (document.getElementById('cbFireNoc')) document.getElementById('cbFireNoc').checked = prop.details.fireNoc || false;
        if (document.getElementById('cbTradeLicense')) document.getElementById('cbTradeLicense').checked = prop.details.tradeLicense || false;
        if (document.getElementById('cbCommercialApproval')) document.getElementById('cbCommercialApproval').checked = prop.details.commercialApproval || false;
        if (document.getElementById('cbPollutionClearance')) document.getElementById('cbPollutionClearance').checked = prop.details.pollutionClearance || false;

        // Commercial Pricing Pre-fill
        if (document.getElementById('commercialRentInput')) document.getElementById('commercialRentInput').value = prop.pricing.rent || '';
        if (document.getElementById('commercialLeasePeriodInput')) document.getElementById('commercialLeasePeriodInput').value = prop.pricing.leasePeriod || '';
        if (document.getElementById('commercialLockInPeriodInput')) document.getElementById('commercialLockInPeriodInput').value = prop.pricing.lockInPeriod || '';
        if (document.getElementById('commercialSecurityDepositInput')) document.getElementById('commercialSecurityDepositInput').value = prop.pricing.securityDeposit || '';
        if (document.getElementById('commercialCamChargesInput')) document.getElementById('commercialCamChargesInput').value = prop.pricing.camCharges || '';

        // Pre-fill Warehouse Specific
        if (document.getElementById('warehouseTypeSelect')) document.getElementById('warehouseTypeSelect').value = prop.details.warehouseType || '';
        if (document.getElementById('industrialZoneInput')) document.getElementById('industrialZoneInput').value = prop.details.industrialZone || '';
        if (document.getElementById('warehouseTotalLandArea')) document.getElementById('warehouseTotalLandArea').value = prop.details.totalLandArea || '';
        if (document.getElementById('warehouseCoveredArea')) document.getElementById('warehouseCoveredArea').value = prop.details.coveredArea || '';
        if (document.getElementById('warehouseOpenYardArea')) document.getElementById('warehouseOpenYardArea').value = prop.details.openYardArea || '';
        if (document.getElementById('warehouseClearHeight')) document.getElementById('warehouseClearHeight').value = prop.details.clearHeight || '';
        if (document.getElementById('warehouseSideHeight')) document.getElementById('warehouseSideHeight').value = prop.details.sideHeight || '';
        if (document.getElementById('warehouseFlooringType')) document.getElementById('warehouseFlooringType').value = prop.details.industrialFlooringType || '';
        if (document.getElementById('warehouseFloorLoad')) document.getElementById('warehouseFloorLoad').value = prop.details.floorLoadCapacity || '';
        if (document.getElementById('warehouseDockDoors')) document.getElementById('warehouseDockDoors').value = prop.details.dockDoors || '';
        if (document.getElementById('warehouseTurningRadius')) document.getElementById('warehouseTurningRadius').value = prop.details.truckTurningRadius || '';
        if (document.getElementById('warehouseTruckParking')) document.getElementById('warehouseTruckParking').value = prop.details.truckParking || '';
        if (document.getElementById('warehouseCarParking')) document.getElementById('warehouseCarParking').value = prop.details.carParking || '';
        if (document.getElementById('warehousePowerLoad')) document.getElementById('warehousePowerLoad').value = prop.details.powerLoadKva || '';
        
        if (document.getElementById('cbRampAvailability')) document.getElementById('cbRampAvailability').checked = prop.details.rampAvailability || false;
        if (document.getElementById('cbTransformer')) document.getElementById('cbTransformer').checked = prop.details.transformer || false;
        if (document.getElementById('cbBorewell')) document.getElementById('cbBorewell').checked = prop.details.borewell || false;
        if (document.getElementById('cbDrainage')) document.getElementById('cbDrainage').checked = prop.details.drainage || false;
        if (document.getElementById('cbSewage')) document.getElementById('cbSewage').checked = prop.details.sewage || false;
        if (document.getElementById('cbInternetFiber')) document.getElementById('cbInternetFiber').checked = prop.details.internetFiber || false;
        if (document.getElementById('cbFireHydrant')) document.getElementById('cbFireHydrant').checked = prop.details.fireHydrant || false;
        if (document.getElementById('cbSprinklerSystem')) document.getElementById('cbSprinklerSystem').checked = prop.details.sprinklerSystem || false;
        if (document.getElementById('cbWarehouseFireNoc')) document.getElementById('cbWarehouseFireNoc').checked = prop.details.fireNoc || false;
        if (document.getElementById('cbPollutionControl')) document.getElementById('cbPollutionControl').checked = prop.details.pollutionNoc || false;
        if (document.getElementById('cbFactoryLicense')) document.getElementById('cbFactoryLicense').checked = prop.details.factoryLicense || false;
        if (document.getElementById('cbIndustrialApproval')) document.getElementById('cbIndustrialApproval').checked = prop.details.industrialApproval || false;

        if (document.getElementById('highwayDistance')) document.getElementById('highwayDistance').value = prop.location.highwayDistance || '';
        if (document.getElementById('railwayYardDistance')) document.getElementById('railwayYardDistance').value = prop.location.railwayYardDistance || '';
        if (document.getElementById('airportDistance')) document.getElementById('airportDistance').value = prop.location.airportDistance || '';
        if (document.getElementById('portDistance')) document.getElementById('portDistance').value = prop.location.portDistance || '';

        if (document.getElementById('commercialRentPerSqFtInput')) document.getElementById('commercialRentPerSqFtInput').value = prop.pricing.rentPerSqFt || '';
        if (document.getElementById('commercialEscalationInput')) document.getElementById('commercialEscalationInput').value = prop.pricing.escalationPercent || '';

        // Pre-fill Hospitality Specific
        if (document.getElementById('hospitalityTypeSelect')) document.getElementById('hospitalityTypeSelect').value = prop.details.hospitalityType || '';
        if (document.getElementById('hospitalityStarRating')) document.getElementById('hospitalityStarRating').value = prop.details.starRating || '';
        if (document.getElementById('hospitalityOperational')) document.getElementById('hospitalityOperational').value = prop.details.operationalStatus !== undefined ? String(prop.details.operationalStatus) : '';
        if (document.getElementById('hospitalityTotalRooms')) document.getElementById('hospitalityTotalRooms').value = prop.details.totalRooms || '';
        if (document.getElementById('hospitalityRoomTypes')) document.getElementById('hospitalityRoomTypes').value = prop.details.roomTypes || '';
        if (document.getElementById('hospitalityOccupancyRate')) document.getElementById('hospitalityOccupancyRate').value = prop.details.occupancyRate || '';
        if (document.getElementById('hospitalityADR')) document.getElementById('hospitalityADR').value = prop.details.averageDailyRate || '';
        if (document.getElementById('cbHospitalityBanquet')) document.getElementById('cbHospitalityBanquet').checked = prop.details.banquetHall || false;
        if (document.getElementById('cbHospitalityRestaurant')) document.getElementById('cbHospitalityRestaurant').checked = prop.details.restaurant || false;
        if (document.getElementById('cbHospitalityBarLicense')) document.getElementById('cbHospitalityBarLicense').checked = prop.details.barLicenseDetails || false;
        if (document.getElementById('cbHospitalityPool')) document.getElementById('cbHospitalityPool').checked = prop.details.hospitalityPool || false;
        if (document.getElementById('cbHospitalitySpa')) document.getElementById('cbHospitalitySpa').checked = prop.details.spa || false;
        if (document.getElementById('cbHospitalityGym')) document.getElementById('cbHospitalityGym').checked = prop.details.gym || false;
        if (document.getElementById('hospitalityLandArea')) document.getElementById('hospitalityLandArea').value = prop.details.hospitalityLandArea || '';
        if (document.getElementById('hospitalityBuiltUpArea')) document.getElementById('hospitalityBuiltUpArea').value = prop.details.hospitalityBuiltUpArea || '';
        if (document.getElementById('hospitalityParking')) document.getElementById('hospitalityParking').value = prop.details.hospitalityParkingCapacity || '';
        if (document.getElementById('cbHospitalityKitchen')) document.getElementById('cbHospitalityKitchen').checked = prop.details.kitchenSetup || false;
        if (document.getElementById('cbHospitalityLaundry')) document.getElementById('cbHospitalityLaundry').checked = prop.details.laundrySetup || false;
        if (document.getElementById('hospitalityAnnualRev')) document.getElementById('hospitalityAnnualRev').value = prop.details.annualRevenue || '';
        if (document.getElementById('hospitalityMonthlyRev')) document.getElementById('hospitalityMonthlyRev').value = prop.details.monthlyRevenue || '';
        if (document.getElementById('hospitalityEBITDA')) document.getElementById('hospitalityEBITDA').value = prop.details.ebitda || '';
        if (document.getElementById('hospitalityStaff')) document.getElementById('hospitalityStaff').value = prop.details.staffStrength || '';
        if (document.getElementById('cbHospitalityHotelLicense')) document.getElementById('cbHospitalityHotelLicense').checked = prop.details.hotelLicense || false;
        if (document.getElementById('cbHospitalityFSSAI')) document.getElementById('cbHospitalityFSSAI').checked = prop.details.fssaiLicense || false;
        if (document.getElementById('cbHospitalityTourismReg')) document.getElementById('cbHospitalityTourismReg').checked = prop.details.tourismRegistration || false;

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
          priceInputs[1].value = prop.pricing.pricingType || '';
          priceInputs[2].value = prop.pricing.priceType || '';
          priceInputs[3].value = prop.pricing.maintenance || '';
          priceInputs[4].value = prop.pricing.tokenAmount || '';
          if (document.getElementById('negotiableSelect')) document.getElementById('negotiableSelect').value = prop.pricing.negotiable === true ? 'true' : 'false';
          if (document.getElementById('availabilityDateInput')) document.getElementById('availabilityDateInput').value = prop.pricing.availabilityDate || '';
          if (document.getElementById('contactNameInput')) document.getElementById('contactNameInput').value = prop.contactDesc.name;
          if (document.getElementById('contactMobileInput')) document.getElementById('contactMobileInput').value = prop.contactDesc.mobile;
          if (document.getElementById('contactEmailInput')) document.getElementById('contactEmailInput').value = prop.contactDesc.email;
          if (document.getElementById('contactRoleSelect')) document.getElementById('contactRoleSelect').value = prop.contactDesc.role || '';
          if (document.getElementById('contactTimeSelect')) document.getElementById('contactTimeSelect').value = prop.contactDesc.contactTime || '';
        }
      }
    } catch (err) {
      console.error("Error loading property for edit:", err);
      window.showToast("Could not load property data.", "error");
    }
  }

  // ========== AI REWRITE LOGIC ==========
  const descriptionInput = document.getElementById('descriptionInput');
  const btnRewriteAi = document.getElementById('btnRewriteAi');
  const aiSuggestionBox = document.getElementById('aiSuggestionBox');

  if (descriptionInput && btnRewriteAi && aiSuggestionBox) {
    let typingTimer;

    // Detect short descriptions
    descriptionInput.addEventListener('input', () => {
      clearTimeout(typingTimer);
      typingTimer = setTimeout(() => {
        const text = descriptionInput.value.trim();
        // Show suggestion if text is between 10 and 50 characters, or lacks basic punctuation
        if (text.length > 10 && text.length < 50) {
          aiSuggestionBox.style.display = 'block';
        } else {
          aiSuggestionBox.style.display = 'none';
        }
      }, 1000); // Wait 1s after typing stops
    });

    const handleRewrite = async () => {
      const text = descriptionInput.value.trim();
      if (!text || text.length < 10) {
        window.showToast("Please enter at least 10 characters for AI to rewrite.", "warning");
        return;
      }

      const originalHtml = btnRewriteAi.innerHTML;
      btnRewriteAi.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Rewriting...';
      btnRewriteAi.disabled = true;

      try {
        const result = await convex.action("ai:rewriteDescription", { text });
        if (result && result.success) {
          descriptionInput.value = result.text;
          window.showToast("Description professionally rewritten!", "success");
          aiSuggestionBox.style.display = 'none';
        } else {
          window.showToast(result?.error || "Failed to rewrite description.", "error");
        }
      } catch (err) {
        console.error("AI Rewrite Error:", err);
        window.showToast("An error occurred while calling the AI service.", "error");
      } finally {
        btnRewriteAi.innerHTML = originalHtml;
        btnRewriteAi.disabled = false;
      }
    };

    btnRewriteAi.addEventListener('click', handleRewrite);
    aiSuggestionBox.addEventListener('click', handleRewrite);
  }

  // ========== DRAFT SYSTEM ==========
  function getFormState() {
    const step1Grids = document.querySelectorAll("#formStep1 .form-type-grid");
    const transactionType = step1Grids[0]?.querySelector(".active .name")?.innerText.trim() || "";
    const propertyType = step1Grids[1]?.querySelector(".active .name")?.innerText.trim() || "";

    const location = {
      state: document.getElementById('stateSelect')?.value,
      city: document.getElementById('citySelect')?.value,
      locality: document.getElementById('localityInput')?.value,
      society: document.getElementById('societyInput')?.value || undefined,
      fullAddress: document.getElementById('addressInput')?.value || undefined,
      pinCode: document.getElementById('pinCodeInput')?.value,
      landmark: document.getElementById('landmarkInput')?.value || undefined,
      googleMapLink: document.getElementById('googleMapLinkInput')?.value || undefined,
      metroDistance: document.getElementById('metroDistance')?.value || undefined,
      schoolDistance: document.getElementById('schoolDistance')?.value || undefined,
      mallDistance: document.getElementById('mallDistance')?.value || undefined,
      hospitalDistance: document.getElementById('hospitalDistance')?.value || undefined,
      highwayDistance: document.getElementById('highwayDistance')?.value || undefined,
      railwayYardDistance: document.getElementById('railwayYardDistance')?.value || undefined,
      airportDistance: document.getElementById('airportDistance')?.value || undefined,
      portDistance: document.getElementById('portDistance')?.value || undefined,
      googleSearch: document.getElementById('googleLocationSearch')?.value || undefined
    };

    const details = {
      bhk: document.getElementById('bhkTypeSelect')?.value === 'Others' ? document.getElementById('customBhkInput')?.value : document.getElementById('bhkTypeSelect')?.value,
      status: document.getElementById('propertyStatusSelect')?.value,
      builtUpArea: Number(document.getElementById('builtUpAreaInput')?.value) || 0,
      carpetArea: Number(document.getElementById('carpetAreaInput')?.value) || undefined,
      floorNumber: Number(document.getElementById('floorNumberInput')?.value) || undefined,
      totalFloors: Number(document.getElementById('totalFloorsInput')?.value) || undefined,
      furnishing: document.getElementById('furnishingStatusSelect')?.value,
      facing: document.getElementById('facingSelect')?.value || undefined,
      parking: document.getElementById('parkingSelect')?.value || undefined,
      constructionYear: Number(document.getElementById('constructionYearInput')?.value) || undefined,
      rera: document.getElementById('reraInput')?.value || undefined,
      description: document.getElementById('descriptionInput')?.value || "",
      propertyTitle: document.getElementById('propertyTitleInput')?.value || undefined,
      ownershipType: document.getElementById('ownershipTypeSelect')?.value || undefined,
      bathrooms: document.getElementById('bathroomsSelect')?.value ? Number(document.getElementById('bathroomsSelect').value.replace('+', '')) : undefined,
      balconies: document.getElementById('balconiesSelect')?.value ? Number(document.getElementById('balconiesSelect').value.replace('+', '')) : undefined,
      studyRoom: document.getElementById('cbStudyRoom')?.checked || false,
      servantRoom: document.getElementById('cbServantRoom')?.checked || false,
      poojaRoom: document.getElementById('cbPoojaRoom')?.checked || false,
      storeRoom: document.getElementById('cbStoreRoom')?.checked || false,
      basement: document.getElementById('cbBasement')?.checked || false,
      floorConfig: document.getElementById('floorConfigInput')?.value || undefined,
      plotArea: Number(document.getElementById('plotAreaInput')?.value) || undefined,
      superBuiltUpArea: Number(document.getElementById('superBuiltUpAreaInput')?.value) || undefined,
      openArea: Number(document.getElementById('openAreaInput')?.value) || undefined,
      frontageWidth: Number(document.getElementById('frontageWidthInput')?.value) || undefined,
      roadWidth: Number(document.getElementById('roadWidthInput')?.value) || undefined,
      ageOfProperty: document.getElementById('ageOfPropertySelect')?.value || undefined,
      constructionQuality: document.getElementById('constructionQualitySelect')?.value || undefined,
      flooringType: document.getElementById('flooringTypeInput')?.value || undefined,
      wallFinish: document.getElementById('wallFinishInput')?.value || undefined,
      ceilingHeight: Number(document.getElementById('ceilingHeightInput')?.value) || undefined,
      waterSource: document.getElementById('waterSourceSelect')?.value || undefined,
      electricityLoad: document.getElementById('electricityLoadInput')?.value || undefined,
      openParking: document.getElementById('openParkingSelect')?.value || undefined,
      garage: document.getElementById('cbGarage')?.checked || false,
      evCharging: document.getElementById('cbEvCharging')?.checked || false,
      approvalAuthority: document.getElementById('approvalAuthorityInput')?.value || undefined,
      occupancyCertificate: document.getElementById('cbOccupancyCert')?.checked || false,
      completionCertificate: document.getElementById('cbCompletionCert')?.checked || false,
      propertyTaxStatus: document.getElementById('propertyTaxStatusSelect')?.value || undefined,
      loanApproved: document.getElementById('loanApprovedInput')?.value || undefined,
      commercialType: document.getElementById('commercialTypeSelect')?.value || undefined,
      grade: document.getElementById('commercialGradeSelect')?.value || undefined,
      frontage: Number(document.getElementById('commercialFrontage')?.value) || undefined,
      workstations: Number(document.getElementById('commercialWorkstations')?.value) || undefined,
      cabins: Number(document.getElementById('commercialCabins')?.value) || undefined,
      meetingRooms: Number(document.getElementById('commercialMeetingRooms')?.value) || undefined,
      conferenceRoom: document.getElementById('cbConferenceRoom')?.checked || false,
      receptionArea: document.getElementById('cbReceptionArea')?.checked || false,
      pantry: document.getElementById('cbPantry')?.checked || false,
      washrooms: document.getElementById('commercialWashrooms')?.value || undefined,
      serverRoom: document.getElementById('cbServerRoom')?.checked || false,
      acType: document.getElementById('commercialAcType')?.value || undefined,
      powerBackupCapacity: document.getElementById('commercialPowerBackup')?.value || undefined,
      retailFloor: document.getElementById('commercialRetailFloor')?.value || undefined,
      glassFrontage: document.getElementById('cbGlassFrontage')?.checked || false,
      displayArea: document.getElementById('cbDisplayArea')?.checked || false,
      footfallZone: document.getElementById('commercialFootfallZone')?.value || undefined,
      mallHighStreet: document.getElementById('commercialMallHighStreet')?.value || undefined,
      fireNoc: document.getElementById('cbFireNoc')?.checked || document.getElementById('cbWarehouseFireNoc')?.checked || false,
      tradeLicense: document.getElementById('cbTradeLicense')?.checked || false,
      commercialApproval: document.getElementById('cbCommercialApproval')?.checked || false,
      pollutionClearance: document.getElementById('cbPollutionClearance')?.checked || false,
      warehouseType: document.getElementById('warehouseTypeSelect')?.value || undefined,
      industrialZone: document.getElementById('industrialZoneInput')?.value || undefined,
      totalLandArea: Number(document.getElementById('warehouseTotalLandArea')?.value) || undefined,
      coveredArea: Number(document.getElementById('warehouseCoveredArea')?.value) || undefined,
      openYardArea: Number(document.getElementById('warehouseOpenYardArea')?.value) || undefined,
      clearHeight: Number(document.getElementById('warehouseClearHeight')?.value) || undefined,
      sideHeight: Number(document.getElementById('warehouseSideHeight')?.value) || undefined,
      industrialFlooringType: document.getElementById('warehouseFlooringType')?.value || undefined,
      floorLoadCapacity: document.getElementById('warehouseFloorLoad')?.value || undefined,
      dockDoors: Number(document.getElementById('warehouseDockDoors')?.value) || undefined,
      rampAvailability: document.getElementById('cbRampAvailability')?.checked || false,
      truckTurningRadius: document.getElementById('warehouseTurningRadius')?.value || undefined,
      truckParking: Number(document.getElementById('warehouseTruckParking')?.value) || undefined,
      carParking: Number(document.getElementById('warehouseCarParking')?.value) || undefined,
      powerLoadKva: Number(document.getElementById('warehousePowerLoad')?.value) || undefined,
      transformer: document.getElementById('cbTransformer')?.checked || false,
      borewell: document.getElementById('cbBorewell')?.checked || false,
      drainage: document.getElementById('cbDrainage')?.checked || false,
      sewage: document.getElementById('cbSewage')?.checked || false,
      internetFiber: document.getElementById('cbInternetFiber')?.checked || false,
      fireHydrant: document.getElementById('cbFireHydrant')?.checked || false,
      sprinklerSystem: document.getElementById('cbSprinklerSystem')?.checked || false,
      pollutionNoc: document.getElementById('cbPollutionControl')?.checked || false,
      factoryLicense: document.getElementById('cbFactoryLicense')?.checked || false,
      industrialApproval: document.getElementById('cbIndustrialApproval')?.checked || false,
      hospitalityType: document.getElementById('hospitalityTypeSelect')?.value || undefined,
      starRating: Number(document.getElementById('hospitalityStarRating')?.value) || undefined,
      operationalStatus: document.getElementById('hospitalityOperational')?.value === 'true',
      totalRooms: Number(document.getElementById('hospitalityTotalRooms')?.value) || undefined,
      roomTypes: document.getElementById('hospitalityRoomTypes')?.value || undefined,
      occupancyRate: Number(document.getElementById('hospitalityOccupancyRate')?.value) || undefined,
      averageDailyRate: Number(document.getElementById('hospitalityADR')?.value) || undefined,
      banquetHall: document.getElementById('cbHospitalityBanquet')?.checked || false,
      restaurant: document.getElementById('cbHospitalityRestaurant')?.checked || false,
      barLicenseDetails: document.getElementById('cbHospitalityBarLicense')?.checked || false,
      hospitalityPool: document.getElementById('cbHospitalityPool')?.checked || false,
      spa: document.getElementById('cbHospitalitySpa')?.checked || false,
      gym: document.getElementById('cbHospitalityGym')?.checked || false,
      hospitalityLandArea: Number(document.getElementById('hospitalityLandArea')?.value) || undefined,
      hospitalityBuiltUpArea: Number(document.getElementById('hospitalityBuiltUpArea')?.value) || undefined,
      hospitalityParkingCapacity: Number(document.getElementById('hospitalityParking')?.value) || undefined,
      kitchenSetup: document.getElementById('cbHospitalityKitchen')?.checked || false,
      laundrySetup: document.getElementById('cbHospitalityLaundry')?.checked || false,
      annualRevenue: Number(document.getElementById('hospitalityAnnualRev')?.value) || undefined,
      monthlyRevenue: Number(document.getElementById('hospitalityMonthlyRev')?.value) || undefined,
      ebitda: Number(document.getElementById('hospitalityEBITDA')?.value) || undefined,
      staffStrength: Number(document.getElementById('hospitalityStaff')?.value) || undefined,
      hotelLicense: document.getElementById('cbHospitalityHotelLicense')?.checked || false,
      fssaiLicense: document.getElementById('cbHospitalityFSSAI')?.checked || false,
      tourismRegistration: document.getElementById('cbHospitalityTourismReg')?.checked || false,
    };

    const amenities = [];
    document.querySelectorAll('.amenity-pill.active').forEach(pill => {
      amenities.push(pill.dataset.value);
    });

    const pricing = {
      expectedPrice: Number(document.getElementById('expectedPriceInput')?.value) || 0,
      pricingType: document.getElementById('pricingTypeSelect')?.value,
      priceType: document.getElementById('priceTypeSelect')?.value || undefined,
      maintenance: Number(document.getElementById('maintenanceChargesInput')?.value) || undefined,
      tokenAmount: Number(document.getElementById('tokenAmountInput')?.value) || undefined,
      negotiable: document.getElementById('negotiableSelect')?.value === 'true',
      availabilityDate: document.getElementById('availabilityDateInput')?.value || undefined,
      rent: Number(document.getElementById('commercialRentInput')?.value) || undefined,
      leasePeriod: document.getElementById('commercialLeasePeriodInput')?.value || undefined,
      lockInPeriod: document.getElementById('commercialLockInPeriodInput')?.value || undefined,
      securityDeposit: Number(document.getElementById('commercialSecurityDepositInput')?.value) || undefined,
      camCharges: Number(document.getElementById('commercialCamChargesInput')?.value) || undefined,
      rentPerSqFt: Number(document.getElementById('commercialRentPerSqFtInput')?.value) || undefined,
      escalationPercent: Number(document.getElementById('commercialEscalationInput')?.value) || undefined,
    };

    const contactDesc = {
      name: document.getElementById('contactNameInput')?.value,
      mobile: document.getElementById('contactMobileInput')?.value,
      email: document.getElementById('contactEmailInput')?.value,
      role: document.getElementById('contactRoleSelect')?.value || undefined,
      contactTime: document.getElementById('contactTimeSelect')?.value || undefined,
    };

    const externalVideos = [];
    document.querySelectorAll('.video-link-input').forEach(input => {
      if (input.value.trim()) externalVideos.push(input.value.trim());
    });

    return { transactionType, propertyType, location, details, amenities, pricing, contactDesc, externalVideos };
  }

  async function saveDraftToCloud(isManual = false) {
    try {
      const urlParams = new URLSearchParams(window.location.search);
      if (urlParams.get('id')) return; 
      
      const data = getFormState();
      // Allow saving if at least Transaction Type is selected
      if (!data.transactionType) return;

      await convex.mutation("drafts:saveDraft", { token: getToken(), data });
      console.log("Draft saved successfully.");
      if (isManual) window.showToast("Progress saved to your Dashboard drafts!", "success");
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
  window.addEventListener('beforeunload', () => {
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
      const items = document.querySelectorAll('#formStep1 .form-type-grid:first-of-type .form-type-item');
      items.forEach(item => {
        if (item.querySelector('.name').innerText.trim() === d.transactionType) item.click();
      });
    }
    if (d.propertyType) {
      const items = document.querySelectorAll('#formStep1 .form-type-grid:last-of-type .form-type-item');
      items.forEach(item => {
        if (item.querySelector('.name').innerText.trim() === d.propertyType) item.click();
      });
    }

    // Step 2: Location
    if (d.location) {
      if (document.getElementById('stateSelect')) {
        document.getElementById('stateSelect').value = d.location.state || '';
        document.getElementById('stateSelect').dispatchEvent(new Event('change'));
      }
      if (document.getElementById('citySelect')) {
        document.getElementById('citySelect').value = d.location.city || '';
        document.getElementById('citySelect').dispatchEvent(new Event('change'));
      }
      if (document.getElementById('localityInput')) document.getElementById('localityInput').value = d.location.locality || '';
      if (document.getElementById('societyInput')) document.getElementById('societyInput').value = d.location.society || '';
      if (document.getElementById('addressInput')) document.getElementById('addressInput').value = d.location.fullAddress || '';
      if (document.getElementById('pinCodeInput')) document.getElementById('pinCodeInput').value = d.location.pinCode || '';
      if (document.getElementById('landmarkInput')) document.getElementById('landmarkInput').value = d.location.landmark || '';
      if (document.getElementById('googleMapLinkInput')) document.getElementById('googleMapLinkInput').value = d.location.googleMapLink || '';
      if (document.getElementById('googleLocationSearch')) document.getElementById('googleLocationSearch').value = d.location.googleSearch || '';
    }

    // Step 3: Details
    if (d.details) {
      // BHK
      const bhkItems = document.querySelectorAll('#bhkSelector .segment-item');
      let foundBhk = false;
      bhkItems.forEach(item => {
        if (item.dataset.value === d.details.bhk) {
          item.click();
          foundBhk = true;
        }
      });
      if (!foundBhk && d.details.bhk) {
        const otherItem = document.querySelector('#bhkSelector .segment-item[data-value="Others"]');
        if (otherItem) {
          otherItem.click();
          if (document.getElementById('customBhkInput')) document.getElementById('customBhkInput').value = d.details.bhk;
        }
      }

      // furnishing
      const furnCards = document.querySelectorAll('#furnishingSelector .selection-card');
      furnCards.forEach(card => {
        if (card.dataset.value === d.details.furnishing) card.click();
      });

      if (document.getElementById('propertyStatusSelect')) document.getElementById('propertyStatusSelect').value = d.details.status || '';
      if (document.getElementById('builtUpAreaInput')) document.getElementById('builtUpAreaInput').value = d.details.builtUpArea || '';
      if (document.getElementById('descriptionInput')) document.getElementById('descriptionInput').value = d.details.description || '';
      // ... (Rest of the fields would go here, but these are the main ones)
    }

    // Amenities
    if (d.amenities) {
      document.querySelectorAll('.amenity-pill').forEach(pill => {
        if (d.amenities.includes(pill.dataset.value)) pill.classList.add('active');
      });
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

      const formState = getFormState();

      submitBtn.innerText = editId ? "⏳ Updating property..." : "⏳ Posting property...";

      if (editId) {
        await convex.mutation("properties:updateProperty", {
          token: getToken(),
          id: editId,
          ...formState,
          photos: photoData,
          videos: videoData,
        });
        window.showToast("Property updated successfully!", "success");
      } else {
        await convex.mutation("properties:createProperty", {
          ...formState,
          photos: photoData,
          videos: videoData,
          userId: user._id,
          token: getToken(),
        });
        // Delete draft after success
        await convex.mutation("drafts:deleteDraft", { token: getToken() });
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
  // Auto-save triggers
  document.querySelectorAll('input, select, textarea').forEach(el => {
    el.addEventListener('change', triggerAutoSave);
    if (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA') {
      el.addEventListener('input', triggerAutoSave);
    }
  });

  document.querySelectorAll('.btn-next').forEach(btn => {
    btn.addEventListener('click', saveDraftToCloud);
  });

  // Attach Save Draft button listeners
  document.querySelectorAll('.btn-save-draft').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.preventDefault();
      handleManualSave(btn);
    });
  });

  // Check for draft on load
  async function checkExistingDraft() {
    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.get('id')) return; // Don't prompt for draft if editing

    try {
      const draft = await convex.query("drafts:getDraft", { token: getToken() });
      if (draft) {
        // Simple confirmation (could be a prettier modal)
        if (confirm("You have a saved draft from a previous session. Would you like to resume?")) {
          loadDraft(draft);
        }
      }
    } catch (err) { console.error("Error checking draft:", err); }
  }

  checkExistingDraft();
});
