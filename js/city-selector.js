/**
 * City Selector — interactive dropdown with geolocation auto-detect
 * Usage: include this script on any page that has a .nav-city element
 */

const CITIES = [
  { name: 'All India', emoji: '🇮🇳' },
  { name: 'Delhi NCR', emoji: '🏛️' },
  { name: 'Mumbai', emoji: '🌊' },
  { name: 'Bangalore', emoji: '🌿' },
  { name: 'Hyderabad', emoji: '💎' },
  { name: 'Pune', emoji: '🎓' },
  { name: 'Chennai', emoji: '🌴' },
  { name: 'Kolkata', emoji: '🌺' },
  { name: 'Ahmedabad', emoji: '🦁' },
  { name: 'Jaipur', emoji: '🏯' },
  { name: 'Lucknow', emoji: '🕌' },
  { name: 'Patna', emoji: '🏞️' },
  { name: 'Bhopal', emoji: '🌊' },
  { name: 'Indore', emoji: '🏙️' },
  { name: 'Surat', emoji: '💰' },
  { name: 'Noida', emoji: '🏢' },
  { name: 'Gurgaon', emoji: '🏙️' },
  { name: 'Chandigarh', emoji: '🌳' },
  { name: 'Bhubaneswar', emoji: '🛕' },
  { name: 'Kochi', emoji: '⛵' },
  { name: 'Coimbatore', emoji: '🏭' },
  { name: 'Varanasi', emoji: '🕯️' },
  { name: 'Nagpur', emoji: '🍊' },
];

const CITY_KEY = 'pb_selected_city';

function getSavedCity() {
  return localStorage.getItem(CITY_KEY) || 'All India';
}

function saveCity(city) {
  localStorage.setItem(CITY_KEY, city);
}

function goToCity(city) {
  saveCity(city);
  // If on properties page, filter in-place
  if (window.location.pathname.includes('properties.html')) {
    const params = new URLSearchParams(window.location.search);
    if (city === 'All India') params.delete('city');
    else params.set('city', city);
    const newUrl = window.location.pathname + (params.toString() ? '?' + params : '');
    window.history.replaceState({}, '', newUrl);
    // Trigger re-filter if function available
    if (typeof window.renderFilteredProperties === 'function') window.renderFilteredProperties();
  } else {
    // Navigate to properties page with city filter
    if (city === 'All India') {
      window.location.href = 'properties.html';
    } else {
      window.location.href = `properties.html?city=${encodeURIComponent(city)}`;
    }
  }
}

function autoDetectCity(btn) {
  if (!navigator.geolocation) { alert('Geolocation is not supported by your browser.'); return; }
  btn.textContent = '⏳ Detecting...';
  navigator.geolocation.getCurrentPosition(async (pos) => {
    try {
      const { latitude, longitude } = pos.coords;
      const res = await fetch(`https://nominatim.openstreetmap.org/reverse?lat=${latitude}&lon=${longitude}&format=json`);
      const data = await res.json();
      const detectedCity = data.address?.city || data.address?.town || data.address?.county || 'All India';
      // Try to match with our city list
      const match = CITIES.find(c => c.name.toLowerCase().includes(detectedCity.toLowerCase()));
      const city = match ? match.name : detectedCity;
      goToCity(city);
    } catch {
      btn.innerHTML = '📍 Detect Location';
      alert('Could not detect city. Please select manually.');
    }
  }, () => {
    btn.innerHTML = '📍 Detect Location';
    alert('Location access denied. Please select city manually.');
  });
}

function buildCityDropdown() {
  const navCityEl = document.querySelector('.nav-city');
  if (!navCityEl) return;

  const currentCity = getSavedCity();

  // Build HTML
  navCityEl.innerHTML = `
    <button class="nav-city-btn" id="citySelectorBtn">
      📍 <span id="citySelectorLabel">${currentCity}</span> <span class="city-arrow">▾</span>
    </button>
    <div class="city-dropdown" id="cityDropdown">
      <div class="city-drop-detect" id="cityDetectBtn">📡 Detect My Location</div>
      <div class="city-drop-search"><input type="text" id="citySearchInput" placeholder="Search city..."></div>
      <div class="city-drop-list" id="cityDropList"></div>
    </div>
  `;

  const btn = document.getElementById('citySelectorBtn');
  const dropdown = document.getElementById('cityDropdown');
  const searchInput = document.getElementById('citySearchInput');
  const listEl = document.getElementById('cityDropList');

  function renderCityList(query = '') {
    const filtered = CITIES.filter(c => c.name.toLowerCase().includes(query.toLowerCase()));
    listEl.innerHTML = filtered.map(c => `
      <div class="city-drop-item ${c.name === currentCity ? 'selected' : ''}" data-city="${c.name}">
        <span>${c.emoji}</span> ${c.name}
      </div>
    `).join('');
    listEl.querySelectorAll('.city-drop-item').forEach(item => {
      item.addEventListener('click', () => {
        goToCity(item.dataset.city);
        dropdown.classList.remove('open');
        btn.classList.remove('open');
        document.getElementById('citySelectorLabel').textContent = item.dataset.city;
      });
    });
  }

  // Toggle dropdown
  btn.addEventListener('click', (e) => {
    e.stopPropagation();
    const isOpen = dropdown.classList.toggle('open');
    btn.classList.toggle('open', isOpen);
    if (isOpen) {
      renderCityList();
      setTimeout(() => searchInput.focus(), 100);
    }
  });

  // Search filter
  searchInput.addEventListener('input', () => renderCityList(searchInput.value));

  // Detect location
  document.getElementById('cityDetectBtn').addEventListener('click', (e) => {
    e.stopPropagation();
    autoDetectCity(document.getElementById('cityDetectBtn'));
  });

  // Close on outside click
  document.addEventListener('click', () => {
    dropdown.classList.remove('open');
    btn.classList.remove('open');
  });
  dropdown.addEventListener('click', (e) => e.stopPropagation());
}

// Also update properties.html city filter from URL param
function applyCityFilter() {
  if (!window.location.pathname.includes('properties.html')) return;
  const params = new URLSearchParams(window.location.search);
  const city = params.get('city');
  if (city) saveCity(city);
}

document.addEventListener('DOMContentLoaded', () => {
  applyCityFilter();
  buildCityDropdown();
});
