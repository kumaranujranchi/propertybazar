import { convex } from './convex.js';

let allProperties = [];
let allUsers = [];

document.addEventListener('DOMContentLoaded', async () => {
  // 1. Auth Check (Basic for now, backend enforces it anyway)
  await checkAdminAuth();

  // 2. Initialize Navigation
  initAdminNav();

  // 3. Fetch Data
  await loadDashboardData();

  // 4. Set up filters
  document.getElementById('filterPropStatus').addEventListener('change', renderPropertiesTable);
  document.getElementById('propSearch').addEventListener('input', renderPropertiesTable);
  document.getElementById('userSearch').addEventListener('input', renderUsersTable);
  
  // Logout
  document.getElementById('logoutBtn').addEventListener('click', () => {
    localStorage.removeItem("pb_token");
    window.location.href = "login.html";
  });
});

async function checkAdminAuth() {
  const token = localStorage.getItem("pb_token");
  if (!token) {
    window.location.href = "login.html?redirect=admin";
    return;
  }
  
  try {
    // We try to call a simple admin query to verify token/access
    await convex.query("admin:getDashboardStats", {});
    document.getElementById('adminApp').style.display = 'flex';
  } catch (err) {
    console.error("Admin Auth Failed", err);
    alert("You do not have administrative access.");
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
    });
  });
}

async function loadDashboardData() {
  try {
    // 1. Stats
    const stats = await convex.query("admin:getDashboardStats", {});
    document.getElementById('statTotalProps').textContent = stats.totalProperties;
    document.getElementById('statPendingProps').textContent = stats.pendingApprovals;
    document.getElementById('statUsers').textContent = stats.totalUsers;
    document.getElementById('statLeads').textContent = stats.totalLeads;

    // 2. Properties
    allProperties = await convex.query("admin:getAllProperties", {});
    renderPropertiesTable();
    renderRecentProperties(allProperties.filter(p => p.approvalStatus === 'pending' || !p.approvalStatus).slice(0, 5));

    // 3. Users
    allUsers = await convex.query("admin:getAllUsers", {});
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
      <td class="td-property">
        <img src="${p.photos && p.photos.length ? 'https://happy-leopard-557.convex.cloud/api/storage/' + p.photos[0] : 'images/placeholder.jpg'}" alt="Prop">
        <div class="td-prop-info">
          <div class="td-prop-title">${p.details?.bhk || ''} ${p.propertyType}</div>
          <div class="td-prop-loc">${p.location?.locality}, ${p.location?.city}</div>
        </div>
      </td>
      <td><span class="badge ${p.transactionType === 'rent' ? 'badge-warning' : 'badge-primary'}">${p.transactionType.toUpperCase()}</span></td>
      <td style="font-weight: 600;">₹${p.pricing?.expectedPrice?.toLocaleString('en-IN') || 'N/A'}</td>
      <td>${new Date(p._creationTime).toLocaleDateString()}</td>
      <td><span class="status-badge status-pending">Pending</span></td>
      <td>
        <div class="td-actions">
          <button class="action-btn approve" title="Approve" onclick="updatePropertyStatus('${p._id}', 'active')"><i class="fa-solid fa-check"></i></button>
          <button class="action-btn view" title="View Details" onclick="window.open('property-detail.html?id=${p._id}', '_blank')"><i class="fa-solid fa-eye"></i></button>
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
    let statusClass = 'status-pending';
    let statusLabel = 'Pending';
    if (status === 'active') { statusClass = 'status-active'; statusLabel = 'Active'; }
    if (status === 'rejected') { statusClass = 'status-rejected'; statusLabel = 'Rejected'; }

    return `
    <tr>
      <td style="font-family: monospace; font-size: 12px; color: var(--text-light);">${p._id.substring(0,8)}...</td>
      <td class="td-property">
        <img src="${p.photos && p.photos.length ? 'https://happy-leopard-557.convex.cloud/api/storage/' + p.photos[0] : 'images/placeholder.jpg'}" alt="Prop">
        <div class="td-prop-info">
          <div class="td-prop-title">${p.details?.bhk || ''} ${p.propertyType}</div>
          <div class="td-prop-loc">${p.location?.locality}, ${p.location?.city}</div>
        </div>
      </td>
      <td>
        <div class="td-prop-info">
          <div class="td-prop-title">${p.contactDesc?.name || 'Unknown'}</div>
          <div class="td-prop-loc" style="font-family: monospace;">${p.contactDesc?.mobile || 'No Phone'}</div>
        </div>
      </td>
      <td style="font-weight: 600;">₹${p.pricing?.expectedPrice?.toLocaleString('en-IN') || 'N/A'}</td>
      <td><span class="status-badge ${statusClass}">${statusLabel}</span></td>
      <td>
        <div class="td-actions">
          ${status !== 'active' ? `<button class="action-btn approve" title="Approve" onclick="updatePropertyStatus('${p._id}', 'active')"><i class="fa-solid fa-check"></i></button>` : ''}
          ${status !== 'rejected' ? `<button class="action-btn reject" title="Reject" onclick="updatePropertyStatus('${p._id}', 'rejected')"><i class="fa-solid fa-xmark"></i></button>` : ''}
          <button class="action-btn view" title="View Property" onclick="window.open('property-detail.html?id=${p._id}', '_blank')"><i class="fa-solid fa-arrow-up-right-from-square"></i></button>
          <button class="action-btn reject" title="Delete Property" onclick="deletePropertyAdmin('${p._id}')"><i class="fa-solid fa-trash"></i></button>
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
  try {
    await convex.mutation("admin:updatePropertyStatus", { propertyId: id, status: status });
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
  
  try {
    await convex.mutation("admin:deleteProperty", { propertyId: id });
    if(window.showToast) window.showToast("Property deleted successfully");
    await loadDashboardData();
  } catch (err) {
    console.error(err);
    if(window.showToast) window.showToast("Failed to delete property", "error");
  }
};
