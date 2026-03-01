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
  document.getElementById('userSearch').addEventListener('input', renderUsersTable);
  
  // Logout
  document.getElementById('logoutBtn').addEventListener('click', () => {
    localStorage.removeItem("pb_session");
    window.location.href = "login.html";
  });
});

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

    // 3. Users
    allUsers = await convex.query("admin:getAllUsers", { token });
    renderUsersTable();

  } catch (err) {
    console.error("Failed to load dashboard data", err);
    if(window.showToast) window.showToast("Failed to load data. See console.", "error");
  }
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

    const photoSrc = p.photos && p.photos.length ? p.photos[0] : 'images/placeholder.jpg';

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
