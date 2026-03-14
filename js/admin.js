import { convex } from './convex.js';

let allProperties = [];
let allUsers = [];

document.addEventListener('DOMContentLoaded', async () => {
  // 1. Auth Check (Basic for now, backend enforces it anyway)
  await checkAdminAuth();

  // 2. Initialize Navigation
  initAdminNav();
  initMobileSidebar();

  // 3. Fetch Data
  await loadDashboardData();

  // 4. Set up filters
  document.getElementById('filterPropStatus').addEventListener('change', renderPropertiesTable);
  document.getElementById('propSearch').addEventListener('input', renderPropertiesTable);
  document.getElementById('activeSearch')?.addEventListener('input', renderActiveListings);
  document.getElementById('userSearch').addEventListener('input', renderUsersTable);
    const bannerForm = document.getElementById('bannerForm');
    if (bannerForm) {
      bannerForm.addEventListener('submit', handleBannerUpload);
      initCropTool();
    }

  // Logout
  document.getElementById('logoutBtn').addEventListener('click', async () => {
    const { logout } = await import('./auth.js');
    await logout();
    window.location.href = "login.html";
  });
});

// ========== DRAG-TO-CROP TOOL ==========
function initCropTool() {
  const fileInput = document.getElementById('bannerFile');
  const cropImg    = document.getElementById('cropImg');
  const cropCanvas = document.getElementById('cropCanvas');
  const cropFrame  = document.getElementById('cropFrame');
  const shadeTop   = document.getElementById('cropShadeTop');
  const shadeBot   = document.getElementById('cropShadeBot');
  const resultPos  = document.getElementById('cropResultPos');
  const wrapper    = document.getElementById('cropToolWrapper');

  // Banner aspect ratio: 1200 wide x 450 tall
  const BANNER_RATIO = 450 / 1200;

  // State for dragging the frame
  let isDragging = false;
  let dragStartY = 0;
  let frameTopPx = 0; // top of the crop frame relative to the canvas
  let canvasH = 0;
  let frameH = 0;

  function updateCropUI(topPx) {
    // Clamp so the frame never goes outside the image
    topPx = Math.max(0, Math.min(topPx, canvasH - frameH));
    frameTopPx = topPx;

    cropFrame.style.top = `${topPx}px`;
    cropFrame.style.height = `${frameH}px`;
    shadeTop.style.height = `${topPx}px`;
    shadeBot.style.top = `${topPx + frameH}px`;

    // Store: what fraction of the full image height is cut from the top?
    // This is zoom-independent because it's relative to the image itself, not the container.
    const cropFrac = canvasH > 0 ? topPx / canvasH : 0;
    resultPos.value = (cropFrac * 100).toFixed(4);
  }

  function recalcFrame() {
    canvasH = cropCanvas.offsetHeight;
    const canvasW = cropCanvas.offsetWidth;
    frameH = Math.round(canvasW * BANNER_RATIO);

    if (frameH > canvasH) {
      // Image is narrower than frame ratio – show full image
      frameH = canvasH;
    }
    updateCropUI(frameTopPx);
  }

  // Load image into crop canvas
  fileInput?.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      cropImg.src = ev.target.result;
      cropImg.onload = () => {
        wrapper.style.display = 'block';
        frameTopPx = 0;
        requestAnimationFrame(() => {
          recalcFrame();
          // Start frame at center
          updateCropUI((canvasH - frameH) / 2);
        });
      };
    };
    reader.readAsDataURL(file);
  });

  // Pointer drag events
  cropCanvas.addEventListener('pointerdown', (e) => {
    isDragging = true;
    dragStartY = e.clientY;
    cropCanvas.setPointerCapture(e.pointerId);
    cropCanvas.style.cursor = 'grabbing';
  });

  cropCanvas.addEventListener('pointermove', (e) => {
    if (!isDragging) return;
    const delta = e.clientY - dragStartY;
    dragStartY = e.clientY;
    // Dragging down == moving frame down (showing lower part of image)
    updateCropUI(frameTopPx + delta);
  });

  const stopDrag = () => { isDragging = false; cropCanvas.style.cursor = 'grab'; };
  cropCanvas.addEventListener('pointerup', stopDrag);
  cropCanvas.addEventListener('pointercancel', stopDrag);

  // Update frame on resize
  window.addEventListener('resize', recalcFrame);
}

async function handleBannerUpload(e) {
  e.preventDefault();
  const city = document.getElementById('bannerCity').value.trim();
  const type = document.getElementById('bannerType').value;
  const fileInput = document.getElementById('bannerFile');
  const file = fileInput.files[0];
  const bgPos = document.getElementById('bannerBgPos')?.value || '50';

  if (!city || !type || !file) {
    window.showToast("All fields are required", "error");
    return;
  }

  const submitBtn = e.target.querySelector('button[type="submit"]');
  const originalText = submitBtn.textContent;
  submitBtn.disabled = true;
  submitBtn.textContent = "Uploading...";

  try {
    // 1. Get upload URL
    const uploadUrl = await convex.mutation("banners:generateUploadUrl");

    // 2. Post file to storage
    const result = await fetch(uploadUrl, {
      method: "POST",
      headers: { "Content-Type": file.type },
      body: file,
    });
    const { storageId } = await result.json();

    // 3. Save banner metadata
    await convex.mutation("banners:saveBanner", { 
      city, 
      type, 
      storageId, 
      bgPosition: parseFloat(bgPos)
    });

    window.showToast("Banner uploaded successfully!");
    e.target.reset();
    await loadBanners();
  } catch (err) {
    console.error("Banner upload failed", err);
    window.showToast("Banner upload failed", "error");
  } finally {
    submitBtn.disabled = false;
    submitBtn.textContent = originalText;
  }
}

async function loadBanners() {
  const tbody = document.getElementById('bannersTable');
  if (!tbody) return;

  try {
    const banners = await convex.query("banners:listBanners");
    if (banners.length === 0) {
      tbody.innerHTML = '<tr><td colspan="5" class="empty-state">No banners found.</td></tr>';
      return;
    }

    tbody.innerHTML = banners.map(b => `
      <tr>
        <td><img src="${b.url}" style="width:100px; height:40px; object-fit:cover; border-radius:4px;"></td>
        <td>${b.city}</td>
        <td><span class="badge ${b.type === 'buy' ? 'badge-sale' : 'badge-rent'}">${b.type.toUpperCase()}</span></td>
        <td style="font-size:12px; color:var(--text-muted);">${new Date(b.lastUpdated).toLocaleString()}</td>
        <td>
          <div class="action-btns">
            <button class="act-btn reject" onclick="deleteBanner('${b._id}')"><i class="fa-solid fa-trash"></i></button>
          </div>
        </td>
      </tr>
    `).join('');
  } catch (err) {
    console.error("Failed to load banners", err);
  }
}

window.deleteBanner = async (bannerId) => {
  if (!confirm("Are you sure you want to delete this banner?")) return;
  try {
    await convex.mutation("banners:deleteBanner", { bannerId });
    window.showToast("Banner deleted");
    await loadBanners();
  } catch (err) {
    console.error("Delete failed", err);
    window.showToast("Failed to delete banner", "error");
  }
};

async function checkAdminAuth() {
  const token = localStorage.getItem("pb_session");
  if (!token) {
    window.location.href = "login.html?redirect=admin";
    return;
  }
  
  try {
    // We try to call a simple admin query to verify token/access
    const stats = await convex.query("admin:getDashboardStats", { token });
    document.getElementById('adminApp').style.display = 'flex';
  } catch (err) {
    console.error("Admin Auth Failed", err);
    const msg = err.message || "";
    if (msg.includes("Unauthorized") || msg.includes("Administrative access")) {
      alert("⚠️ Unauthorized Access: You do not have permission to view the Admin Panel.");
    } else {
      alert("Your session has expired or you are not logged in. Please login first.");
    }
    window.location.href = "index.html";
  }
}

function initAdminNav() {
  const items = document.querySelectorAll('.admin-nav-item');
  const sections = document.querySelectorAll('.admin-section');
  const pageTitle = document.getElementById('pageTitle');

  items.forEach(item => {
    item.addEventListener('click', () => {
      items.forEach(i => i.classList.remove('active'));
      item.classList.add('active');
      pageTitle.innerText = item.innerText.trim();
      
      const target = item.dataset.target;
      sections.forEach(sec => sec.classList.remove('active'));
      document.getElementById(`section-${target}`).classList.add('active');

      if (target === 'banners') loadBanners();

      // Close sidebar on mobile after navigation
      if (window.innerWidth <= 1024) {
        document.querySelector('.admin-sidebar').classList.remove('open');
        document.getElementById('sidebarOverlay').classList.remove('active');
      }
    });
  });
}

function initMobileSidebar() {
  const hamburger = document.getElementById('adminHamburger');
  const overlay = document.getElementById('sidebarOverlay');
  const sidebar = document.querySelector('.admin-sidebar');

  if (hamburger && overlay && sidebar) {
    hamburger.addEventListener('click', () => {
      sidebar.classList.toggle('open');
      overlay.classList.toggle('active');
    });

    overlay.addEventListener('click', () => {
      sidebar.classList.remove('open');
      overlay.classList.remove('active');
    });
  }
}

async function loadDashboardData() {
  const token = localStorage.getItem("pb_session");
  try {
    // 1. Stats
    const stats = await convex.query("admin:getDashboardStats", { token });
    document.getElementById('statTotalProps').textContent = stats.totalProperties;
    document.getElementById('statPendingProps').textContent = stats.pendingApprovals;
    document.getElementById('statUsers').textContent = stats.totalUsers;
    document.getElementById('statLeads').textContent = stats.totalLeads;

    // Update header with actual user info from stats
    if (stats.currentUser) {
      const name = stats.currentUser.name || 'Admin';
      const email = stats.currentUser.email || '';
      document.getElementById('adminName').textContent = name;
      document.getElementById('adminEmail').textContent = email;
      document.getElementById('adminAvatar').textContent = name.charAt(0).toUpperCase();
      const emailField = document.getElementById('settingsEmail');
      if (emailField) emailField.value = email;
    }

    // 2. Properties
    allProperties = await convex.query("admin:getAllProperties", { token });
    renderPropertiesTable();
    renderRecentProperties(allProperties.filter(p => p.approvalStatus === 'pending' || !p.approvalStatus).slice(0, 5));
    // 4. Active Listings
    renderActiveListings();

    // 3. Users
    allUsers = await convex.query("admin:getAllUsers", { token });
    renderUsersTable();

    // 4. Banners (initial load if on banner tab)
    if (document.getElementById('section-banners').classList.contains('active')) {
      loadBanners();
    }

  } catch (err) {
    console.error("Failed to load dashboard data", err);
    if(window.showToast) window.showToast("Failed to load data. See console.", "error");
  }
}

function renderActiveListings() {
  const tbody = document.getElementById('activeListingsTable');
  if (!tbody) return;
  const searchStr = (document.getElementById('activeSearch')?.value || '').toLowerCase();

  const active = allProperties.filter(p => (p.approvalStatus || '').toLowerCase() === 'active');
  const filtered = active.filter(p => {
    if (!searchStr) return true;
    const titleStr = `${p.details?.bhk || ''} ${p.propertyType}`.toLowerCase();
    const locStr = `${p.location?.locality || ''} ${p.location?.city || ''}`.toLowerCase();
    return titleStr.includes(searchStr) || locStr.includes(searchStr) || (p._id || '').toLowerCase().includes(searchStr);
  });

  if (filtered.length === 0) {
    tbody.innerHTML = '<tr><td colspan="5" style="text-align:center; padding: 20px;">No active listings found.</td></tr>';
    return;
  }

  tbody.innerHTML = filtered.map(p => {
    const photoSrc = (() => {
      if (!p.photos || p.photos.length === 0) return 'images/property-1.webp';
      const first = p.photos[0];
      const url = typeof first === 'object' ? first.url : first;
      if (!url || (typeof url === 'string' && !url.startsWith('http') && !url.startsWith('/'))) return 'images/property-1.webp';
      return url;
    })();

    return `
    <tr>
      <td class="td-prop">
        <img src="${photoSrc}" alt="Property" onerror="this.src='images/placeholder.jpg'" style="width:56px;height:44px;border-radius:6px;object-fit:cover;">
        <div>
          <div class="td-prop-title">${p.details?.bhk || ''} ${p.propertyType}</div>
          <div class="td-prop-loc">${p.location?.locality || ''}, ${p.location?.city || ''}</div>
        </div>
      </td>
      <td>
        <div style="font-size:14px;font-weight:600;">${p.contactDesc?.name || 'Unknown'}</div>
        <div style="font-size:12px;color:#6b7280;font-family:monospace;">${p.contactDesc?.mobile || ''}</div>
      </td>
      <td style="font-weight: 600;">₹${p.pricing?.expectedPrice?.toLocaleString('en-IN') || 'N/A'}</td>
      <td style="font-size:13px;color:#6b7280;">${new Date(p._creationTime).toLocaleDateString()}</td>
      <td>
        <div class="action-btns">
          <button class="act-btn" title="Deactivate Listing" onclick="updatePropertyStatus('${p._id}', 'rejected')"><i class="fa-solid fa-ban"></i></button>
          <button class="act-btn view" title="View on Site" onclick="window.open('property-detail.html?id=${p._id}', '_blank')"><i class="fa-solid fa-eye"></i></button>
        </div>
      </td>
    </tr>
  `}).join('');
}

function renderRecentProperties(recentProps) {
  const tbody = document.getElementById('recentPropertiesTable');
  if (recentProps.length === 0) {
    tbody.innerHTML = '<tr><td colspan="6" style="text-align:center; padding: 20px;">No pending properties.</td></tr>';
    return;
  }
  
  tbody.innerHTML = recentProps.map(p => `
    <tr>
      <td class="td-prop">
        <img src="${p.photos && p.photos.length ? (typeof p.photos[0] === 'object' ? p.photos[0].url : p.photos[0]) : 'images/placeholder.jpg'}" alt="Property" onerror="this.src='images/placeholder.jpg'">
        <div>
          <div class="td-prop-title">${p.details?.bhk || ''} ${p.propertyType}</div>
          <div class="td-prop-loc">${p.location?.locality}, ${p.location?.city}</div>
        </div>
      </td>
      <td><span class="badge badge-sale">${p.transactionType?.toUpperCase()}</span></td>
      <td style="font-weight: 600;">₹${p.pricing?.expectedPrice?.toLocaleString('en-IN') || 'N/A'}</td>
      <td>${new Date(p._creationTime).toLocaleDateString()}</td>
      <td><span class="status-badge s-pending">Pending</span></td>
      <td>
        <div class="action-btns">
          <button class="act-btn approve" title="Approve & Make Live" onclick="updatePropertyStatus('${p._id}', 'active')"><i class="fa-solid fa-check"></i></button>
          <button class="act-btn view" title="View on Site" onclick="window.open('property-detail.html?id=${p._id}', '_blank')"><i class="fa-solid fa-eye"></i></button>
        </div>
      </td>
    </tr>
  `).join('');
}

function renderPropertiesTable() {
  const tbody = document.getElementById('allPropertiesTable');
  const statusFilter = document.getElementById('filterPropStatus').value;
  const searchStr = document.getElementById('propSearch').value.toLowerCase();

  let filtered = allProperties.filter(p => {
    // Status Logic: If status is empty, treat as pending
    const status = p.approvalStatus || 'pending';
    if (statusFilter !== 'all' && status !== statusFilter) return false;
    
    // Search Logic
    if (searchStr) {
      const titleStr = `${p.details?.bhk || ''} ${p.propertyType}`.toLowerCase();
      const locStr = `${p.location?.locality} ${p.location?.city}`.toLowerCase();
      return titleStr.includes(searchStr) || locStr.includes(searchStr) || p._id.toLowerCase().includes(searchStr);
    }
    return true;
  });

  if (filtered.length === 0) {
    tbody.innerHTML = '<tr><td colspan="6" style="text-align:center; padding: 20px;">No properties found.</td></tr>';
    return;
  }

  tbody.innerHTML = filtered.map(p => {
    const status = p.approvalStatus || 'pending';
    let statusClass = 's-pending', statusLabel = 'Pending';
    if (status === 'active') { statusClass = 's-active'; statusLabel = '🟢 Live'; }
    if (status === 'rejected') { statusClass = 's-rejected'; statusLabel = 'Rejected'; }

    const photoSrc = (() => {
      if (!p.photos || p.photos.length === 0) return 'images/property-1.webp';
      const first = p.photos[0];
      const url = typeof first === 'object' ? first.url : first;
      if (!url || (typeof url === 'string' && !url.startsWith('http') && !url.startsWith('/'))) {
        return 'images/property-1.webp';
      }
      return url;
    })();

    return `
    <tr>
      <td class="td-prop">
        <img src="${photoSrc}" alt="Property" onerror="this.src='images/placeholder.jpg'" style="width:56px;height:44px;border-radius:6px;object-fit:cover;">
        <div>
          <div class="td-prop-title">${p.details?.bhk || ''} ${p.propertyType}</div>
          <div class="td-prop-loc">${p.location?.locality}, ${p.location?.city}</div>
        </div>
      </td>
      <td>
        <div style="font-size:14px;font-weight:600;">${p.contactDesc?.name || 'Unknown'}</div>
        <div style="font-size:12px;color:#6b7280;font-family:monospace;">${p.contactDesc?.mobile || ''}</div>
      </td>
      <td style="font-weight: 600;">₹${p.pricing?.expectedPrice?.toLocaleString('en-IN') || 'N/A'}</td>
      <td><span class="status-badge ${statusClass}">${statusLabel}</span></td>
      <td style="font-size:13px;color:#6b7280;">${new Date(p._creationTime).toLocaleDateString()}</td>
      <td>
        <div class="action-btns">
          ${status !== 'active' ? `<button class="act-btn approve" title="Approve - Make Live" onclick="updatePropertyStatus('${p._id}', 'active')"><i class="fa-solid fa-check"></i></button>` : ''}
          ${status === 'active' ? `<button class="act-btn" title="Disable - Remove from Site" onclick="updatePropertyStatus('${p._id}', 'rejected')" style="color:#f59e0b;" onmouseover="this.style.color='#d97706';this.style.borderColor='#d97706';" onmouseout="this.style.color='#f59e0b';this.style.borderColor='#e0e3e9';"><i class="fa-solid fa-circle-pause"></i></button>` : ''}
          <button class="act-btn view" title="View on Site" onclick="window.open('property-detail.html?id=${p._id}', '_blank')"><i class="fa-solid fa-arrow-up-right-from-square"></i></button>
          <button class="act-btn reject" title="Delete Permanently" onclick="deletePropertyAdmin('${p._id}')"><i class="fa-solid fa-trash"></i></button>
        </div>
      </td>
    </tr>
  `}).join('');
}


function renderUsersTable() {
  const tbody = document.getElementById('usersTable');
  const searchStr = document.getElementById('userSearch').value.toLowerCase();

  let filtered = allUsers.filter(u => {
    if (searchStr) {
      return (u.name || '').toLowerCase().includes(searchStr) || 
             (u.email || '').toLowerCase().includes(searchStr) || 
             (u.mobile || '').includes(searchStr);
    }
    return true;
  });

  if (filtered.length === 0) {
    tbody.innerHTML = '<tr><td colspan="6" style="text-align:center; padding: 20px;">No users found.</td></tr>';
    return;
  }

  tbody.innerHTML = filtered.map(u => {
    
    // Calculate number of listings this user has (if we pre-fetched or joined, but for MVP we will estimate or leave blank)
    const listingCount = allProperties.filter(p => p.userId === u._id).length;
    
    return `
    <tr>
      <td class="td-property">
        <div style="width: 40px; height: 40px; border-radius: 50%; background: var(--border); display: flex; align-items:center; justify-content:center; font-weight: bold; color: var(--text-muted);">${(u.name || "?").substring(0,1).toUpperCase()}</div>
        <div class="td-prop-info">
          <div class="td-prop-title">${u.name || 'No Name'}</div>
        </div>
      </td>
      <td>
        <div class="td-prop-info">
          <div class="td-prop-loc" style="font-family: monospace;">${u.email}</div>
          <div class="td-prop-loc" style="font-family: monospace;">${u.mobile || 'No Mobile'}</div>
        </div>
      </td>
      <td><span class="badge badge-primary">${u.subscriptionTier || 'free'}</span></td>
      <td>${new Date(u._creationTime).toLocaleDateString()}</td>
      <td style="font-weight: 600;">${listingCount}</td>
      <td><span class="status-badge status-active">Active</span></td>
    </tr>
  `}).join('');
}


// Admin Actions global expose
window.updatePropertyStatus = async (id, status) => {
  if (!confirm(`Are you sure you want to mark this property as ${status}?`)) return;
  const token = localStorage.getItem("pb_session");
  try {
    await convex.mutation("admin:updatePropertyStatus", { token, propertyId: id, status: status });
    if(window.showToast) window.showToast(`Property marked as ${status}`);
    await loadDashboardData(); // Refresh UI
  } catch (err) {
    console.error(err);
    if(window.showToast) window.showToast("Failed to update status", "error");
  }
};

window.deletePropertyAdmin = async (id) => {
  const pass = prompt("Type 'DELETE' to confirm deletion of this property permanently.");
  if (pass !== 'DELETE') return;
  
  const token = localStorage.getItem("pb_session");
  try {
    await convex.mutation("admin:deleteProperty", { token, propertyId: id });
    if(window.showToast) window.showToast("Property deleted successfully");
    await loadDashboardData();
  } catch (err) {
    console.error(err);
    if(window.showToast) window.showToast("Failed to delete property", "error");
  }
};
