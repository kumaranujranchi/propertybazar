import { convex } from './convex.js';
import { requireAuth, getToken } from './auth.js';

// ========== PHOTO HANDLING ==========
const photoFileInput = document.getElementById('photoFileInput');
const photoUploadArea = document.getElementById('photoUploadArea');
const photoPreviewGrid = document.getElementById('photoPreviewGrid');
const selectedFiles = [];

if (photoFileInput) {
  photoUploadArea.addEventListener('click', (e) => {
    if (e.target === photoUploadArea || e.target.classList.contains('photo-upload-icon') ||
        e.target.classList.contains('photo-upload-text') || e.target.classList.contains('photo-upload-sub')) {
      photoFileInput.click();
    }
  });
  photoUploadArea.addEventListener('dragover', (e) => {
    e.preventDefault();
    photoUploadArea.style.borderColor = 'var(--primary)';
  });
  photoUploadArea.addEventListener('dragleave', () => { photoUploadArea.style.borderColor = ''; });
  photoUploadArea.addEventListener('drop', (e) => {
    e.preventDefault();
    photoUploadArea.style.borderColor = '';
    handleFiles([...e.dataTransfer.files]);
  });
  photoFileInput.addEventListener('change', () => {
    handleFiles([...photoFileInput.files]);
    photoFileInput.value = '';
  });
}

function handleFiles(files) {
  const valid = files.filter(f => f.type.startsWith('image/'));
  const remaining = 20 - selectedFiles.length;
  valid.slice(0, remaining).forEach(file => {
    selectedFiles.push(file);
    addPreview(file, selectedFiles.length - 1);
  });
}

function addPreview(file, index) {
  const reader = new FileReader();
  reader.onload = (e) => {
    const wrap = document.createElement('div');
    wrap.style.cssText = 'position:relative;width:90px;height:90px;border-radius:8px;overflow:hidden;border:1px solid var(--border)';
    wrap.dataset.index = index;
    const img = document.createElement('img');
    img.src = e.target.result;
    img.style.cssText = 'width:100%;height:100%;object-fit:cover';
    const removeBtn = document.createElement('div');
    removeBtn.textContent = '✕';
    removeBtn.style.cssText = 'position:absolute;top:2px;right:4px;background:rgba(0,0,0,0.6);color:#fff;font-size:11px;cursor:pointer;padding:0 4px;border-radius:4px;line-height:18px';
    removeBtn.addEventListener('click', () => {
      const idx = parseInt(wrap.dataset.index);
      selectedFiles.splice(idx, 1);
      wrap.remove();
      [...photoPreviewGrid.querySelectorAll('[data-index]')].forEach((el, i) => el.dataset.index = i);
    });
    wrap.appendChild(img);
    wrap.appendChild(removeBtn);
    photoPreviewGrid.appendChild(wrap);
  };
  reader.readAsDataURL(file);
}

// ========== FORM SUBMISSION ==========
document.addEventListener('DOMContentLoaded', async () => {
  // Auth guard - redirect to login if not logged in
  const user = await requireAuth('login.html?redirect=post-property.html');
  if (!user) return;

  // Check free limit
  if (!user.canPostMore) {
    const submitBtn = document.getElementById('btnSubmitProperty');
    if (submitBtn) {
      submitBtn.textContent = '🔒 Free Limit Reached — Upgrade to Post More';
      submitBtn.style.background = '#6B7280';
      submitBtn.disabled = true;
    }
    const note = document.createElement('p');
    note.style.cssText = 'text-align:center;color:#EF4444;font-size:13px;margin-top:12px;font-weight:600';
    note.textContent = `You've used all ${user.freeLimit} free listings. Upgrade to post more.`;
    document.getElementById('btnSubmitProperty')?.parentElement.appendChild(note);
  }

  const submitBtn = document.getElementById('btnSubmitProperty');
  if (!submitBtn) return;

  submitBtn.addEventListener('click', async (e) => {
    e.preventDefault();

    if (!user.canPostMore) {
      window.location.href = 'dashboard.html';
      return;
    }

    if (selectedFiles.length === 0) {
      alert('⚠️ Please upload at least 1 photo before submitting.');
      return;
    }

    const prevText = submitBtn.innerText;
    submitBtn.innerText = '⏳ Uploading photos...';
    submitBtn.disabled = true;

    try {
      // Upload photos
      const photoStorageIds = [];
      for (const file of selectedFiles) {
        const uploadUrl = await convex.mutation('files:generateUploadUrl', {});
        const resp = await fetch(uploadUrl, {
          method: 'POST',
          headers: { 'Content-Type': file.type },
          body: file,
        });
        if (!resp.ok) throw new Error('Photo upload failed');
        const { storageId } = await resp.json();
        photoStorageIds.push(storageId);
      }

      // Gather form data
      const step1Grids = document.querySelectorAll('#formStep1 .form-type-grid');
      const transactionType = step1Grids[0].querySelector('.active .name').innerText.trim();
      const propertyType = step1Grids[1].querySelector('.active .name').innerText.trim();

      const locInputs = document.querySelectorAll('#formStep2 .form-input');
      const location = {
        state: locInputs[0].value,
        city: locInputs[1].value,
        locality: locInputs[2].value,
        society: locInputs[3].value || undefined,
        fullAddress: locInputs[4].value || undefined,
        pinCode: locInputs[5].value,
        landmark: locInputs[6].value || undefined,
      };

      const detInputs = document.querySelectorAll('#formStep3 .form-input');
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
        description: detInputs[10].value || '',
      };

      const amenities = [];
      document.querySelectorAll('#formStep3 input[type="checkbox"]').forEach(cb => {
        if (cb.checked) amenities.push(cb.parentElement.innerText.trim());
      });

      const priceInputs = document.querySelectorAll('#formStep5 .form-input');
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

      submitBtn.innerText = '⏳ Posting property...';

      await convex.mutation('properties:createProperty', {
        transactionType, propertyType, location, details,
        amenities, photos: photoStorageIds, pricing, contactDesc,
        userId: user._id,       // link to logged-in user
        token: getToken(),      // pass session token for server-side verification
      });

      alert('🎉 Property posted successfully! Your listing will go live within 30 minutes.');
      window.location.href = 'dashboard.html';

    } catch (err) {
      console.error('Failed to post property:', err);
      alert('❌ Error posting property: ' + err.message);
    } finally {
      submitBtn.innerText = prevText;
      submitBtn.disabled = false;
    }
  });
});
