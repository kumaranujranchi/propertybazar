/**
 * City Selector — auto-geolocation on click + searchable city dropdown
 * Included on: index.html, properties.html
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
  return localStorage.getItem(CITY_KEY) || null;
}

function saveCity(city) {
  localStorage.setItem(CITY_KEY, city);
}

function applySelectedCity(city, labelEl) {
  saveCity(city);
  if (labelEl) labelEl.textContent = city;
  // If on properties page, update filter
  if (window.location.pathname.endsWith('properties.html') || window.location.href.includes('properties.html')) {
    const params = new URLSearchParams(window.location.search);
    if (city === 'All India') params.delete('city');
    else params.set('city', city);
    const newUrl = window.location.pathname + (params.toString() ? '?' + params : '');
    window.history.replaceState({}, '', newUrl);
    if (typeof window.renderFilteredProperties === 'function') {
      window.renderFilteredProperties();
    }
  } else {
    if (city === 'All India') {
      window.location.href = 'properties.html';
    } else {
      window.location.href = 'properties.html?city=' + encodeURIComponent(city);
    }
  }
}

function matchCityFromDetected(rawCity) {
  const lower = (rawCity || '').toLowerCase();
  // Direct match first
  const direct = CITIES.find(c => c.name.toLowerCase() === lower);
  if (direct) return direct.name;
  // Partial match
  const partial = CITIES.find(c =>
    lower.includes(c.name.toLowerCase().split(' ')[0]) ||
    c.name.toLowerCase().includes(lower)
  );
  return partial ? partial.name : null;
}

function detectAndSetCity(labelEl, dropdownEl, searchInput) {
  if (!navigator.geolocation) {
    // No geolocation — just open the dropdown
    dropdownEl.classList.add('open');
    return;
  }
  if (labelEl) labelEl.textContent = '⏳ Detecting...';
  navigator.geolocation.getCurrentPosition(
    async (pos) => {
      try {
        const { latitude, longitude } = pos.coords;
        const res = await fetch(
          `https://nominatim.openstreetmap.org/reverse?lat=${latitude}&lon=${longitude}&format=json`,
          { headers: { 'Accept-Language': 'en' } }
        );
        const data = await res.json();
        const rawCity = data.address?.city || data.address?.town || data.address?.state_district || '';
        const matched = matchCityFromDetected(rawCity);
        if (matched) {
          applySelectedCity(matched, labelEl);
          dropdownEl.classList.remove('open');
        } else {
          // City not in list — open dropdown and show what was detected
          if (labelEl) labelEl.textContent = rawCity || 'Select City';
          dropdownEl.classList.add('open');
          if (searchInput) {
            searchInput.value = rawCity;
            searchInput.dispatchEvent(new Event('input'));
          }
        }
      } catch {
        if (labelEl) labelEl.textContent = getSavedCity() || 'All India';
        dropdownEl.classList.add('open');
      }
    },
    () => {
      // Permission denied — open dropdown
      if (labelEl) labelEl.textContent = getSavedCity() || 'All India';
      dropdownEl.classList.add('open');
    },
    { timeout: 8000 }
  );
}

function buildCityDropdown() {
  const navCityEl = document.querySelector('.nav-city');
  if (!navCityEl) return;

  const savedCity = getSavedCity() || 'All India';

  navCityEl.innerHTML = `
    <button class="nav-city-btn" id="citySelectorBtn" aria-label="Select city">
      📍 <span id="citySelectorLabel">${savedCity}</span>
      <span class="city-arrow">▾</span>
    </button>
    <div class="city-dropdown" id="cityDropdown" role="listbox">
      <div class="city-drop-search">
        <input type="text" id="citySearchInput" placeholder="🔍 Search city..." autocomplete="off">
      </div>
      <div class="city-drop-list" id="cityDropList"></div>
      <div class="city-drop-detect" id="cityDetectBtn" title="Use My Current Location">📡</div>
    </div>
  `;

  const btn = document.getElementById('citySelectorBtn');
  const dropdown = document.getElementById('cityDropdown');
  const searchInput = document.getElementById('citySearchInput');
  const listEl = document.getElementById('cityDropList');
  const labelEl = document.getElementById('citySelectorLabel');
  const detectBtn = document.getElementById('cityDetectBtn');

  function renderList(query = '') {
    const filtered = CITIES.filter(c =>
      c.name.toLowerCase().includes(query.toLowerCase())
    );
    listEl.innerHTML = filtered.map(c => `
      <div class="city-drop-item ${c.name === labelEl.textContent ? 'selected' : ''}" data-city="${c.name}" role="option">
        ${c.emoji} ${c.name}
      </div>
    `).join('') || '<div style="padding:12px 16px;color:var(--text-muted);font-size:13px">No city found</div>';

    listEl.querySelectorAll('.city-drop-item').forEach(item => {
      item.addEventListener('click', () => {
        applySelectedCity(item.dataset.city, labelEl);
        dropdown.classList.remove('open');
        btn.classList.remove('open');
      });
    });
  }

  // CLICK on city button: auto-detect location FIRST
  btn.addEventListener('click', (e) => {
    e.stopPropagation();
    const isOpen = dropdown.classList.contains('open');
    if (isOpen) {
      dropdown.classList.remove('open');
      btn.classList.remove('open');
      return;
    }
    // Render list immediately so it's ready
    renderList();
    // Then auto-detect
    detectAndSetCity(labelEl, dropdown, searchInput);
    btn.classList.add('open');
  });

  // Search
  searchInput.addEventListener('input', () => renderList(searchInput.value));
  searchInput.addEventListener('click', e => e.stopPropagation());

  // Manual detect button at bottom
  detectBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    detectAndSetCity(labelEl, dropdown, searchInput);
  });

  // Close on outside click
  document.addEventListener('click', () => {
    dropdown.classList.remove('open');
    btn.classList.remove('open');
  });
  dropdown.addEventListener('click', e => e.stopPropagation());

  // Keyboard ESC
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      dropdown.classList.remove('open');
      btn.classList.remove('open');
    }
  });
}

// Apply city filter on properties page if city param in URL
function syncFromURL() {
  const params = new URLSearchParams(window.location.search);
  const city = params.get('city');
  if (city) saveCity(city);
}

document.addEventListener('DOMContentLoaded', () => {
  syncFromURL();
  buildCityDropdown();
});
