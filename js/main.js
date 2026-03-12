// ========== MAIN.JS — Core site functionality ==========

document.addEventListener('DOMContentLoaded', () => {
  // *** AUTH: Update nav login button on every page ***
  import('./auth.js').then(({ initNavAuth }) => {
    initNavAuth();
  }).catch(() => {}); // Silently fail if not applicable
  initNav();
  initSearchTabs();
  initCityAutocomplete();
  initGeoCity();
  initTopCitiesTabs();
  initSliders();
  initTestimonialsSlider();
  initFAQAccordion();
  initAnimations();
  initEMICalc();
  initWishlist();
  initFilterPanel();
  initViewToggle();
  // initTypingEffect(); // Disabled - using static title instead
});

// ========== STICKY NAV ==========
function initNav() {
  const header = document.querySelector('.header');
  const hamburger = document.querySelector('.hamburger');
  const mobileMenu = document.querySelector('.mobile-menu');
  const navLinks = document.querySelectorAll('.nav-links .nav-link');

  // Ensure header nav links include selected city when available
  const selCity = localStorage.getItem('selectedCity');
  if (selCity && selCity !== 'Select City') {
    navLinks.forEach(link => {
      try {
        const u = new URL(link.href, window.location.origin);
        u.searchParams.set('city', selCity);
        link.href = u.toString();
      } catch (e) { /* ignore */ }
    });
  }

  if (header) {
    window.addEventListener('scroll', () => {
      header.classList.toggle('scrolled', window.scrollY > 30);
    });
  }

  // Header dynamic filtering on properties page
  navLinks.forEach(link => {
    link.addEventListener('click', (e) => {
      const url = new URL(link.href, window.location.origin);
      const type = url.searchParams.get('type');
      
      if (type && window.location.pathname.includes('properties.html')) {
        e.preventDefault();
        
        // Update URL without reload
        const newUrl = new URL(window.location.href);
        newUrl.searchParams.set('type', type);
        // Preserve selected city in header when navigating via menu
        const selCity = localStorage.getItem('selectedCity');
        if (selCity && selCity !== 'Select City') newUrl.searchParams.set('city', selCity);
        window.history.pushState({}, '', newUrl);

        // Update search tabs
        const tabs = document.querySelectorAll('.search-tab');
        tabs.forEach(t => {
          t.classList.toggle('active', t.dataset.type === type);
        });

        // Update header active state
        navLinks.forEach(l => l.classList.remove('active'));
        link.classList.add('active');

        // Trigger filter
        if (typeof window.renderFilteredProperties === 'function') {
          window.renderFilteredProperties();
        }
      }
    });
  });

  if (hamburger && mobileMenu) {
    hamburger.addEventListener('click', () => {
      mobileMenu.classList.toggle('open');
      const spans = hamburger.querySelectorAll('span');
      hamburger.classList.toggle('active');
      if (hamburger.classList.contains('active')) {
        spans[0].style.transform = 'rotate(45deg) translate(5px, 5px)';
        spans[1].style.opacity = '0';
        spans[2].style.transform = 'rotate(-45deg) translate(5px, -5px)';
      } else {
        spans.forEach(s => { s.style.transform = ''; s.style.opacity = ''; });
      }
    });
    document.addEventListener('click', (e) => {
      if (!hamburger.contains(e.target) && !mobileMenu.contains(e.target)) {
        mobileMenu.classList.remove('open');
        hamburger.classList.remove('active');
        hamburger.querySelectorAll('span').forEach(s => { s.style.transform = ''; s.style.opacity = ''; });
      }
    });
  }
}

// ========== FAQ ACCORDION & SEARCH ==========
function initFAQAccordion() {
  const list = document.getElementById('faqList');
  if (!list) return;

  // Toggle behaviour: allow only one open at a time
  list.addEventListener('click', (e) => {
    const btn = e.target.closest('.faq-q');
    if (!btn) return;
    const item = btn.closest('.faq-item');
    const open = item.classList.contains('open');
    // close all
    list.querySelectorAll('.faq-item.open').forEach(i => i.classList.remove('open'));
    if (!open) item.classList.add('open');
  });

  // Keyboard accessibility
  list.querySelectorAll('.faq-q').forEach(btn => {
    btn.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); btn.click(); }
    });
  });

  // Search
  const search = document.getElementById('faqSearch');
  if (search) {
    search.addEventListener('input', () => {
      const q = search.value.trim().toLowerCase();
      list.querySelectorAll('.faq-item').forEach(item => {
        const text = (item.querySelector('.faq-q').textContent + ' ' + item.querySelector('.faq-a').textContent).toLowerCase();
        item.style.display = q && !text.includes(q) ? 'none' : '';
      });
    });
  }
}

// ========== TOP CITIES TABS & RENDER ==========
function initTopCitiesTabs() {
  const tabs = document.querySelectorAll('.city-tab');
  const grid = document.querySelector('.cities-grid');
  if (!tabs || !grid) return;

  const CITY_DATA = {
    'Bangalore': {
      cols: [
        { title: 'Flats in Bangalore', items: ['Whitefield','Sarjapur Road','Electronic City','Koramangala','HSR Layout','Marathahalli','Hebbal','Kanakapura Road','Bellandur','Varthur'] },
        { title: 'House for Sale in Bangalore', items: ['Whitefield','HSR Layout','JP Nagar','Koramangala','Sarjapur Road','Hebbal','Yelahanka','Electronic City','Marathahalli','Bellandur'] },
        { title: 'Property in Bangalore', items: ['Whitefield','Sarjapur Road','Electronic City','Yelahanka','HSR Layout','Koramangala','Marathahalli','Hebbal','JP Nagar','Bellandur'] },
        { title: 'Plots in Bangalore', items: ['Whitefield','Sarjapur Road','Yelahanka','Electronic City','HSR Layout','Kanakapura Road','Marathahalli','JP Nagar','Sarjapur','Bellandur'] }
      ]
    },
    'Mumbai': {
      cols: [
        { title: 'Flats in Mumbai', items: ['Bandra','Andheri','Powai','Juhu','Lower Parel','Dadar','Breach Candy','Kurla','Goregaon','Malad'] },
        { title: 'House for Sale in Mumbai', items: ['Bandra','Juhu','Powai','Breach Candy','Dadar','Andheri','Kurla','Goregaon','Malad','Borivali'] },
        { title: 'Property in Mumbai', items: ['Bandra','Andheri','Powai','Lower Parel','Dadar','Kurla','Chembur','Vikhroli','Goregaon','Malad'] },
        { title: 'Plots in Mumbai', items: ['Vasai','Navi Mumbai (Panvel)','Kalyan','Dombivli','Kharghar','Kopar Khairane','Ghansoli','Uran','Ulwe','Taloja'] }
      ]
    },
    'Hyderabad': {
      cols: [
        { title: 'Flats in Hyderabad', items: ['Gachibowli','Hitech City','Kondapur','Madhapur','Kukatpally','Miyapur','Banjara Hills','Jubilee Hills','Secunderabad','LB Nagar'] },
        { title: 'House for Sale in Hyderabad', items: ['Banjara Hills','Jubilee Hills','Gachibowli','Kondapur','Madhapur','Kukatpally','Miyapur','Kismatpur','Narsingi','Manikonda'] },
        { title: 'Property in Hyderabad', items: ['Gachibowli','Hitech City','Kondapur','Madhapur','Kukatpally','Banjara Hills','Jubilee Hills','Secunderabad','Kompally','Narayanguda'] },
        { title: 'Plots in Hyderabad', items: ['Narsingi','Moinabad','Kukatpally','Shamshabad','Patancheru','Medchal','Ghatkesar','Keesara','Balanagar','Uppal'] }
      ]
    },
    'Thane': {
      cols: [
        { title: 'Flats in Thane', items: ['Ghodbunder Road','Wagle Estate','Majiwada','Vartak Nagar','Thane West','Kalwa','Kopri','Naupada','Manpada','Balkum'] },
        { title: 'House for Sale in Thane', items: ['Ghodbunder Road','Majiwada','Thane West','Kalwa','Balkum','Wagle Estate','Manpada','Kolshet','Vartak Nagar','Dhokali'] },
        { title: 'Property in Thane', items: ['Ghodbunder Road','Majiwada','Thane West','Wagle Estate','Vartak Nagar','Kalwa','Kopri','Manpada','Balkum','Kolshet'] },
        { title: 'Plots in Thane', items: ['Ghodbunder Road','Kolshet','Mumbra','Dombivli','Rabale','Turbhe','Kalwa','Badlapur','Ambernath','Ulhasnagar'] }
      ]
    },
    'Pune': {
      cols: [
        { title: 'Flats in Pune', items: ['Kothrud','Baner','Viman Nagar','Wakad','Hinjewadi','Kalyani Nagar','Hingne','Sadashiv Peth','Shivaji Nagar','Kharadi'] },
        { title: 'House for Sale in Pune', items: ['Kothrud','Baner','Viman Nagar','Kalyani Nagar','Kharadi','Wakad','Hinjewadi','Hadapsar','Aundh','Bibvewadi'] },
        { title: 'Property in Pune', items: ['Kothrud','Baner','Viman Nagar','Wakad','Kalyani Nagar','Kharadi','Hinjewadi','Hadapsar','Pimpri','Chinchwad'] },
        { title: 'Plots in Pune', items: ['Wakad','Hinjewadi','Talegaon','Lonavala','Paud Road','NIBM','Pashan','Katraj','Wagholi','Shirur'] }
      ]
    },
    'New Delhi': {
      cols: [
        { title: 'Flats in Delhi', items: ['Connaught Place','South Extension','Karol Bagh','Saket','Rohini','Dwarka','Vasant Kunj','Janakpuri','Laxmi Nagar','Patel Nagar'] },
        { title: 'House for Sale in Delhi', items: ['South Delhi (Saket)','Vasant Kunj','Rohini','Dwarka','Chanakyapuri','Model Town','Karol Bagh','Narela','Najafgarh','Pitampura'] },
        { title: 'Property in Delhi', items: ['Connaught Place','Saket','Vasant Kunj','Karol Bagh','Janakpuri','Dwarka','Rohini','Laxmi Nagar','Patel Nagar','Mayur Vihar'] },
        { title: 'Plots in Delhi', items: ['Narela','Mundka','Bawana','Najafgarh','Badli','Faridabad outskirts','Gurugram outskirts','Kapashera','Ghitorni','Uttam Nagar'] }
      ]
    },
    'Chennai': {
      cols: [
        { title: 'Flats in Chennai', items: ['Velachery','OMR','Anna Nagar','Adyar','T Nagar','Tambaram','Porur','Nungambakkam','Besant Nagar','Chromepet'] },
        { title: 'House for Sale in Chennai', items: ['Velachery','Adyar','Anna Nagar','Tambaram','Nungambakkam','Porur','Besant Nagar','Sholinganallur','Medavakkam','OMR'] },
        { title: 'Property in Chennai', items: ['Velachery','OMR','Anna Nagar','Adyar','T Nagar','Porur','Tambaram','Nungambakkam','Besant Nagar','Chromepet'] },
        { title: 'Plots in Chennai', items: ['OMR outskirts','Thiruporur','Siruseri','Poonamallee','Kovilambakkam','Mahabalipuram road','Guduvanchery','Perungalathur','Ponmar','Vadapalani outskirts'] }
      ]
    },
    'Ahmedabad': {
      cols: [
        { title: 'Flats in Ahmedabad', items: ['SG Highway','Satellite','Thaltej','Bopal','Bodakdev','Maninagar','Naranpura','Ambawadi','Gota','Vastral'] },
        { title: 'House for Sale in Ahmedabad', items: ['Bodakdev','Bopal','SG Highway','Satellite','Thaltej','Maninagar','Naranpura','Ambawadi','Gota','Vastral'] },
        { title: 'Property in Ahmedabad', items: ['SG Highway','Satellite','Bopal','Thaltej','Bodakdev','Maninagar','Naranpura','Ambawadi','Vastral','Gota'] },
        { title: 'Plots in Ahmedabad', items: ['Gandhinagar outskirts','Dholka','Sanand','Kalol','Bavla','Kadi','Narol','Ambli','Ognaj','Jhala'] }
      ]
    },
    'Kolkata': {
      cols: [
        { title: 'Flats in Kolkata', items: ['Salt Lake','Park Street','New Town','Behala','Garia','Dumdum','Rajarhat','Ballygunge','Tollygunge','Alipore'] },
        { title: 'House for Sale in Kolkata', items: ['Alipore','Ballygunge','Salt Lake','New Town','Park Street','Rajarhat','Tollygunge','Garia','Kankurgachi','Howrah'] },
        { title: 'Property in Kolkata', items: ['Salt Lake','New Town','Park Street','Ballygunge','Behala','Garia','Dumdum','Rajarhat','Tollygunge','Alipore'] },
        { title: 'Plots in Kolkata', items: ['New Town outskirts','Howrah outskirts','Barasat','Basirhat','Bidhannagar periphery','Joka outskirts','Raigunj','Barrackpore','Palta','Uluberia'] }
      ]
    },
    'Gurgaon': {
      cols: [
        { title: 'Flats in Gurgaon', items: ['Sector 52','MG Road','Sohna Road','DLF Phase 1','Golf Course Road','Udyog Vihar','Sushant Lok','Sector 14','Palam Vihar','Sector 56'] },
        { title: 'House for Sale in Gurgaon', items: ['DLF Phases','Sohna Road','MG Road','Sector 14','Palam Vihar','Galleria','Udyog Vihar','Sushant Lok','Golf Course Road','Sector 47'] },
        { title: 'Property in Gurgaon', items: ['MG Road','Sohna Road','DLF Phases','Udyog Vihar','Sector 52','Galleria','Sushant Lok','Palam Vihar','Sector 56','Sector 14'] },
        { title: 'Plots in Gurgaon', items: ['Sohna outskirts','Pataudi Road','Manesar','Wazirabad','Gurgaon-Faridabad border','Daultabad','Rai','Panchgaon','Sector 83 area','Matanhail'] }
      ]
    },
    'Noida': {
      cols: [
        { title: 'Flats in Noida', items: ['Sector 18','Sector 62','Sector 50','Sector 76','Sector 78','Sector 137','Sector 93','Sector 121','Sector 44','Sector 150'] },
        { title: 'House for Sale in Noida', items: ['Sector 50','Sector 44','Sector 18','Sector 62','Sector 137','Sector 93','Sector 121','Sector 78','Sector 150','Greater Noida'] },
        { title: 'Property in Noida', items: ['Sector 18','Sector 62','Noida Expressway','Sector 50','Sector 44','Sector 137','Sector 78','Sector 121','Sector 150','Greater Noida'] },
        { title: 'Plots in Noida', items: ['Greater Noida','Dadri','Gautam Budh Nagar periphery','Yamuna Expressway area','Jaroda','Noida Extension','Dadri outskirts','Dankaur','Bisrakh','Bhangel'] }
      ]
    },
    'Navi Mumbai': {
      cols: [
        { title: 'Flats in Navi Mumbai', items: ['Vashi','Nerul','Belapur','Kharghar','Panvel','CBD Belapur','Airoli','Seawoods','Kamothe','Turbhe'] },
        { title: 'House for Sale in Navi Mumbai', items: ['Vashi','Kharghar','Panvel','Nerul','CBD Belapur','Airoli','Seawoods','Kamothe','Turbhe','Gaimukh'] },
        { title: 'Property in Navi Mumbai', items: ['Vashi','Nerul','Belapur','Kharghar','Panvel','Airoli','Seawoods','Kamothe','Turbhe','CBD Belapur'] },
        { title: 'Plots in Navi Mumbai', items: ['Panvel outskirts','Kharghar outskirts','Taloja','Kalamboli','Uran','Ulve','Gavan','Kharkopar','Nerul periphery','Seawoods periphery'] }
      ]
    }
  };

  function encodeLocality(s) { return encodeURIComponent(s); }

  function renderCityGrid(city) {
    const data = CITY_DATA[city] || CITY_DATA['Bangalore'];
    const html = data.cols.map(col => {
      const items = col.items.map(it => `<li><a href="properties.html?city=${encodeLocality(city)}&locality=${encodeLocality(it)}">${col.title.includes(city) ? it : it}</a></li>`).join('\n');
      return `
        <div class="city-column">
          <h5>${col.title}</h5>
          <ul>
            ${items}
          </ul>
        </div>`;
    }).join('\n');
    grid.innerHTML = html;
  }

  tabs.forEach(tab => {
    tab.addEventListener('click', () => {
      tabs.forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
      const city = tab.dataset.city || tab.textContent.trim();
      renderCityGrid(city);
    });
    tab.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); tab.click(); }
    });
  });

  // Ensure default city is rendered
  const active = document.querySelector('.city-tab.active');
  if (active) renderCityGrid(active.dataset.city || active.textContent.trim());
}

// ========= GEOLOCATION / CITY ==========
function initGeoCity() {
  // ask for location on load and set city if possible
  if (!('geolocation' in navigator)) return;

  // Do not override a manual city selection.
  const manual = localStorage.getItem('cityManuallySelected');
  const saved = localStorage.getItem('selectedCity');
  if (manual || (saved && saved !== 'Select City')) return;

  // Delay slightly to avoid prompt on page load blocking other scripts
  setTimeout(() => {
    navigator.geolocation.getCurrentPosition(async (pos) => {
      try {
        const { latitude, longitude } = pos.coords;
        // Use Nominatim reverse geocoding (open, low-rate). If you have a paid
        // geocoding service (Google, Mapbox) replace this endpoint.
        const url = `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${latitude}&lon=${longitude}`;
        const res = await fetch(url, { headers: { 'Accept': 'application/json' } });
        if (!res.ok) return;
        const data = await res.json();
        const addr = data.address || {};
        const city = addr.city || addr.town || addr.village || addr.hamlet || addr.county || addr.state;
        if (city) {
          // Only set the city automatically; do NOT mark it as manually selected.
          setCity(city);
        }
      } catch (e) {
        console.warn('Reverse geocode failed', e);
      }
    }, (err) => {
      // User denied or unavailable — silently ignore
      console.info('Geolocation not granted or failed', err && err.message);
    }, { maximumAge: 60 * 60 * 1000, timeout: 8000 });
  }, 900);
}

function setCity(city) {
  if (!city) return;
  try {
    localStorage.setItem('selectedCity', city);
    const currentCityText = document.getElementById('currentCityText');
    if (currentCityText) currentCityText.textContent = city;

    // Notify other components
    window.dispatchEvent(new CustomEvent('cityChanged', { detail: { city } }));

    // If on properties page, update URL and re-render
    if (window.location.pathname.includes('properties.html')) {
      const url = new URL(window.location.href);
      url.searchParams.set('city', city);
      window.history.pushState({}, '', url);
      if (typeof window.renderFilteredProperties === 'function') window.renderFilteredProperties();
    }
  } catch (e) { console.warn('setCity failed', e); }
}

// Update header nav links when city changes
window.addEventListener('cityChanged', (e) => {
  const city = e.detail?.city || localStorage.getItem('selectedCity');
  if (!city) return;
  document.querySelectorAll('.nav-links .nav-link').forEach(link => {
    try {
      const u = new URL(link.href, window.location.origin);
      u.searchParams.set('city', city);
      link.href = u.toString();
    } catch (err) { }
  });
});

// ========== SEARCH TABS ==========
function initSearchTabs() {
  const tabs = document.querySelectorAll('.search-tab');
  const mobileSelector = document.getElementById('mobileTypeSelector');
  const urlParams = new URLSearchParams(window.location.search);
  const urlType = urlParams.get('type');

  // Sync tabs with URL parameter on load
  if (urlType) {
    tabs.forEach(t => {
      t.classList.toggle('active', t.dataset.type === urlType);
    });
    // Also update header active state
    const navLinks = document.querySelectorAll('.nav-links .nav-link');
    navLinks.forEach(link => {
      const linkUrl = new URL(link.href, window.location.origin);
      if (linkUrl.searchParams.get('type') === urlType) {
        navLinks.forEach(nl => nl.classList.remove('active'));
        link.classList.add('active');
      }
    });
  }

  tabs.forEach(tab => {
    tab.addEventListener('click', () => {
      tabs.forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
      if (mobileSelector) mobileSelector.value = tab.dataset.type;
      
      // Update header links state to match tabs
      const type = tab.dataset.type;
      const navLinks = document.querySelectorAll('.nav-links .nav-link');
      navLinks.forEach(link => {
        const linkUrl = new URL(link.href, window.location.origin);
        link.classList.toggle('active', linkUrl.searchParams.get('type') === type);
      });

      // Update URL if on properties page
      if (window.location.pathname.includes('properties.html')) {
        const newUrl = new URL(window.location.href);
        newUrl.searchParams.set('type', type);
        const selCity = localStorage.getItem('selectedCity');
        if (selCity && selCity !== 'Select City') newUrl.searchParams.set('city', selCity);
        window.history.pushState({}, '', newUrl);
        if (typeof window.renderFilteredProperties === 'function') {
          window.renderFilteredProperties();
        }
      }
    });
  });

  if (mobileSelector) {
    mobileSelector.addEventListener('change', () => {
      const val = mobileSelector.value;
      tabs.forEach(t => {
        t.classList.toggle('active', t.dataset.type === val);
      });
    });
  }

  const searchForm = document.querySelector('.search-form');
  if (searchForm) {
    searchForm.addEventListener('submit', (e) => {
      e.preventDefault();
      const loc = document.querySelector('#hero-location')?.value?.trim();
      const type = document.querySelector('.search-tab.active')?.dataset?.type || 'buy';
      window.location.href = `properties.html?type=${type}&location=${encodeURIComponent(loc || '')}`;
    });
  }
}

// ========== CITY AUTOCOMPLETE ==========
function initCityAutocomplete() {
  const cityList = ['Mumbai','Delhi NCR','Bangalore','Hyderabad','Chennai','Pune','Kolkata','Noida','Gurgaon','Ahmedabad','Jaipur','Lucknow','Patna','Chandigarh','Bhopal'];
  const input = document.getElementById('hero-location');
  if (!input) return;
  const dropdown = document.createElement('div');
  dropdown.className = 'autocomplete-dropdown';
  dropdown.style.cssText = 'position:absolute;background:#fff;border:1px solid #E5E7EB;border-radius:8px;box-shadow:0 8px 24px rgba(0,0,0,0.12);width:100%;z-index:100;top:calc(100% + 4px);left:0;overflow:hidden;display:none;';
  input.parentElement.style.position = 'relative';
  input.parentElement.appendChild(dropdown);

  input.addEventListener('input', () => {
    const val = input.value.toLowerCase();
    if (!val) { dropdown.style.display = 'none'; return; }
    const matches = cityList.filter(c => c.toLowerCase().includes(val));
    dropdown.innerHTML = matches.map(c =>
      `<div style="padding:10px 16px;cursor:pointer;font-size:14px;color:#2D2D2D;transition:background 0.2s;" onmouseover="this.style.background='#F7F8FA'" onmouseout="this.style.background='#fff'" onclick="document.getElementById('hero-location').value='${c}';this.parentElement.style.display='none'">📍 ${c}</div>`
    ).join('');
    dropdown.style.display = matches.length ? 'block' : 'none';
  });

  document.addEventListener('click', (e) => {
    if (!input.contains(e.target)) dropdown.style.display = 'none';
  });
}

// ========== HORIZONTAL CARD SLIDERS ==========
function initSliders() {
  document.querySelectorAll('.cards-slider-wrap').forEach(wrap => {
    const slider = wrap.querySelector('.cards-slider');
    const prev = wrap.querySelector('.slider-prev');
    const next = wrap.querySelector('.slider-next');
    if (!slider) return;
    const scrollAmt = 324;
    if (prev) prev.addEventListener('click', () => slider.scrollBy({ left: -scrollAmt, behavior: 'smooth' }));
    if (next) next.addEventListener('click', () => slider.scrollBy({ left: scrollAmt, behavior: 'smooth' }));
  });
}

// ========== TESTIMONIALS SLIDER ==========
function initTestimonialsSlider() {
  const slider = document.querySelector('.testimonials-slider');
  const prev = document.querySelector('.test-prev');
  const next = document.querySelector('.test-next');
  if (!slider) return;
  if (prev) prev.addEventListener('click', () => slider.scrollBy({ left: -380, behavior: 'smooth' }));
  if (next) next.addEventListener('click', () => slider.scrollBy({ left: 380, behavior: 'smooth' }));
}

// ========== SCROLL REVEAL ANIMATIONS ==========
function initAnimations() {
  const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        entry.target.style.opacity = '1';
        entry.target.style.transform = 'translateY(0)';
        observer.unobserve(entry.target);
      }
    });
  }, { threshold: 0.1 });

  document.querySelectorAll('.property-card, .city-card, .prop-type-card, .project-card, .testimonial-card, .team-card').forEach(el => {
    el.style.opacity = '0';
    el.style.transform = 'translateY(20px)';
    el.style.transition = 'opacity 0.5s ease, transform 0.5s ease';
    observer.observe(el);
  });
}

// ========== EMI CALCULATOR ==========
function initEMICalc() {
  const loanInput = document.getElementById('emi-loan');
  const rateInput = document.getElementById('emi-rate');
  const tenureInput = document.getElementById('emi-tenure');
  const loanVal = document.getElementById('emi-loan-val');
  const rateVal = document.getElementById('emi-rate-val');
  const tenureVal = document.getElementById('emi-tenure-val');
  const emiResult = document.getElementById('emi-result');
  if (!loanInput) return;

  function calcEMI() {
    const P = parseFloat(loanInput.value);
    const r = parseFloat(rateInput.value) / 12 / 100;
    const n = parseFloat(tenureInput.value) * 12;
    const emi = P * r * Math.pow(1 + r, n) / (Math.pow(1 + r, n) - 1);
    if (emiResult) emiResult.textContent = '₹' + Math.round(emi).toLocaleString('en-IN') + '/mo';
    if (loanVal) loanVal.textContent = '₹' + (P / 100000).toFixed(0) + 'L';
    if (rateVal) rateVal.textContent = parseFloat(rateInput.value).toFixed(1) + '%';
    if (tenureVal) tenureVal.textContent = parseFloat(tenureInput.value) + ' yrs';
  }

  [loanInput, rateInput, tenureInput].forEach(el => el.addEventListener('input', calcEMI));
  calcEMI();
}

// ========== WISHLIST ==========
function initWishlist() {
  document.querySelectorAll('.prop-wishlist').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      btn.classList.toggle('wishlisted');
      btn.textContent = btn.classList.contains('wishlisted') ? '❤️' : '🤍';
    });
  });
}

// ========== FILTER PANEL (Properties page) ==========
function initFilterPanel() {
  const chips = document.querySelectorAll('.filter-chip');
  chips.forEach(chip => {
    chip.addEventListener('click', () => {
      const group = chip.closest('.filter-chips');
      if (group && group.dataset.single !== undefined) {
        group.querySelectorAll('.filter-chip').forEach(c => c.classList.remove('active'));
      }
      chip.classList.toggle('active');
      filterProperties();
    });
  });

  const sortSelect = document.querySelector('.sort-select');
  if (sortSelect) sortSelect.addEventListener('change', renderFilteredProperties);

  const filterClear = document.querySelector('.filter-clear');
  if (filterClear) filterClear.addEventListener('click', () => {
    chips.forEach(c => c.classList.remove('active'));
    document.querySelectorAll('.filter-checkbox input').forEach(cb => cb.checked = false);
    renderFilteredProperties();
  });
}

let activeFilters = { types: [], bhks: [], statuses: [], cities: [], maxPrice: Infinity };

function filterProperties() {
  activeFilters.types = [...document.querySelectorAll('.filter-chips[data-type="propType"] .filter-chip.active')].map(c => c.dataset.val);
  activeFilters.bhks = [...document.querySelectorAll('.filter-chips[data-type="bhk"] .filter-chip.active')].map(c => parseInt(c.dataset.val));
  activeFilters.statuses = [...document.querySelectorAll('.filter-chips[data-type="status"] .filter-chip.active')].map(c => c.dataset.val);
  renderFilteredProperties();
}

function renderFilteredProperties() {
  const grid = document.querySelector('.listings-grid');
  if (!grid || typeof window.properties === 'undefined') return;

  const tab = document.querySelector('.search-tab.active')?.dataset?.type || 'buy';
  let filtered = window.properties.filter(p => p.type === tab || tab === 'all');

  if (activeFilters.types.length) {
    filtered = filtered.filter(p => {
      const typeStr = (p.propType || '').toLowerCase();
      return activeFilters.types.some(t => {
        const filterStr = t.toLowerCase();
        if (filterStr === 'villa') return typeStr.includes('villa');
        if (filterStr === 'plot') return typeStr.includes('plot') || typeStr.includes('land');
        if (filterStr === 'pg') return typeStr.includes('pg');
        return typeStr.includes(filterStr);
      });
    });
  }
  if (activeFilters.bhks.length) filtered = filtered.filter(p => activeFilters.bhks.includes(p.bhk));
  if (activeFilters.statuses.length) filtered = filtered.filter(p => activeFilters.statuses.includes(p.status));

  // City/Location filter from URL param
  const urlParams = new URLSearchParams(window.location.search);
  const searchLoc = urlParams.get('location') || urlParams.get('city');
  if (searchLoc && searchLoc !== 'All India') {
    filtered = filtered.filter(p =>
      (p.city || '').toLowerCase().includes(searchLoc.toLowerCase()) ||
      (p.location || '').toLowerCase().includes(searchLoc.toLowerCase()) ||
      (p.title || '').toLowerCase().includes(searchLoc.toLowerCase()) // Also search title for projects
    );
  }

  const sort = document.querySelector('.sort-select')?.value || 'relevance';
  if (sort === 'relevance') filtered.sort((a, b) => (b.qualityScore || 0) - (a.qualityScore || 0));
  else if (sort === 'price-asc') filtered.sort((a, b) => a.price - b.price);
  else if (sort === 'price-desc') filtered.sort((a, b) => b.price - a.price);
  else if (sort === 'area-desc') filtered.sort((a, b) => b.area - a.area);
  else if (sort === 'newest') filtered.sort((a, b) => (b.id > a.id ? 1 : -1)); // Simple newest first logic

  const count = document.querySelector('.listings-count h2');
  if (count) count.textContent = `${filtered.length} Properties Found`;

  grid.innerHTML = filtered.length
    ? filtered.map(p => buildPropertyCardHTML(p)).join('')
    : '<div style="grid-column:1/-1;text-align:center;padding:60px 20px;color:#6B7280">No properties found matching your filters. Try adjusting your criteria.</div>';

  initWishlist();
  initAnimations();
}

function buildPropertyCardHTML(p) {
  const detailUrl = `property-detail.html?id=${p.id}`;
  const callUrl = `${detailUrl}&msg=call`;
  return `
  <div class="property-card" onclick="handlePropertyListingClick(event, '${detailUrl}')">
    <div class="prop-img-wrap">
      <img src="${p.image}" alt="${p.title}" loading="lazy">
      <div class="prop-type-badge">
        <span class="badge ${p.type === 'rent' ? 'badge-warning' : 'badge-primary'}">${p.type === 'rent' ? 'RENT' : 'BUY'}</span>
      </div>
      ${p.verified ? '<div class="prop-verified">✓ Verified</div>' : ''}
      <div class="prop-wishlist">🤍</div>
    </div>
    <div class="prop-body">
      <div class="prop-price">${p.priceDisplay} <span class="prop-per">· ₹${p.price_per_sqft?.toLocaleString('en-IN')}/sqft</span></div>
      <div class="prop-title">${p.title}</div>
      <div class="prop-location">📍 ${p.location}</div>
      <div class="prop-specs">
        ${p.specs
          ? p.specs.map(s => `<div class="prop-spec">${s.icon} ${s.label}</div>`).join('')
          : `
            ${p.bhk ? `<div class="prop-spec">🛏️ ${p.bhk} BHK</div>` : ''}
            ${p.areaDisplay ? `<div class="prop-spec">📐 ${p.areaDisplay}</div>` : ''}
            <div class="prop-spec">🏢 ${p.propType}</div>
            ${p.parking ? `<div class="prop-spec">🚗 ${p.parking} Parking</div>` : ''}
          `
        }
      </div>

      <div class="prop-footer">
        <div class="badge ${p.status === 'ready' ? 'badge-success' : 'badge-warning'}">${p.status === 'ready' ? '✅ Ready to Move' : '🏗️ Under Construction'}</div>
        <div class="prop-contact-btns">
          <button class="prop-btn prop-btn-call" onclick="event.stopPropagation(); window.location.href='${callUrl}'"><i class="fa-solid fa-phone"></i> Call</button>
        </div>
      </div>
    </div>
  </div>`;
}

window.handlePropertyListingClick = (event, url) => {
  if (sessionStorage.getItem('pb_agreed_disclaimer')) {
    window.location.href = url;
  } else if (typeof window.showDisclaimer === 'function') {
    window.showDisclaimer(url);
  } else {
    // Fallback if modal script not present (e.g. on other pages)
    window.location.href = url;
  }
};

// ========== VIEW TOGGLE (Grid / List) ==========
function initViewToggle() {
  const gridBtn = document.getElementById('view-grid');
  const listBtn = document.getElementById('view-list');
  const grid = document.querySelector('.listings-grid');
  if (!gridBtn || !listBtn || !grid) return;

  gridBtn.addEventListener('click', () => {
    grid.classList.remove('list-view');
    gridBtn.classList.add('active'); listBtn.classList.remove('active');
  });
  listBtn.addEventListener('click', () => {
    grid.classList.add('list-view');
    listBtn.classList.add('active'); gridBtn.classList.remove('active');
  });
}

// ========== POST PROPERTY STEP NAVIGATION ==========
function initPostSteps() {
  let currentStep = 0;
  const steps = document.querySelectorAll('.form-step');
  const stepNums = document.querySelectorAll('.step-num');
  const stepLabels = document.querySelectorAll('.step-label');
  const stepLines = document.querySelectorAll('.step-line');

  const progressLine = document.querySelector('.post-progress-fill');
  const stepText = document.querySelector('.step-counter-text');

  function goToStep(n) {
    steps.forEach((s, i) => (s.style.display = i === n ? 'block' : 'none'));

    // Update new Progress Indicator
    if (progressLine) {
      const percent = ((n + 1) / steps.length) * 100;
      progressLine.style.width = percent + '%';
    }
    if (stepText) {
      stepText.textContent = `Step ${n + 1} of ${steps.length}`;
    }

    // Preserve legacy indicators for compatibility if they exist
    if (stepNums.length) {
      stepNums.forEach((num, i) => {
        num.classList.toggle('active', i === n);
        num.classList.toggle('completed', i < n);
        num.classList.toggle('pending', i > n);
        if (i < n) num.textContent = '✓';
        else num.textContent = i + 1;
      });
    }
    if (stepLabels.length) {
      stepLabels.forEach((lbl, i) => lbl.classList.toggle('pending', i > n));
    }
    if (stepLines.length) {
      stepLines.forEach((line, i) => line.classList.toggle('completed', i < n));
    }

    currentStep = n;

    // SCROLL TO TOP - App-style feel
    window.scrollTo({ top: 0, behavior: 'smooth' });
    // Ensure property-type specific UX runs after step change (hides plot-only fields)
    try {
      if (window.applyPropertyTypeUX) setTimeout(window.applyPropertyTypeUX, 30);
    } catch (e) { /* ignore */ }
  }

  function validateStep(index) {
    const stepEl = steps[index];
    if (!stepEl) return true;
    
    // Find all visible inputs that have a label with a '*' indicating required
    const formGroups = stepEl.querySelectorAll('.form-group');
    let isValid = true;
    let firstInvalid = null;
    const invalidList = [];

    // Helper: apply visual error on an input
    function markInputError(input, reason) {
      try {
        input.style.borderColor = '#ef4444'; // Red border
        input.style.backgroundColor = '#fef2f2';
        input.setAttribute('data-error', reason || 'Required');
        // Remove error styling on input change
        const removeError = () => {
          input.style.borderColor = '';
          input.style.backgroundColor = '';
          input.removeAttribute('data-error');
          input.removeEventListener('input', removeError);
        };
        input.addEventListener('input', removeError);
      } catch (e) { /* ignore styling errors */ }
    }

    formGroups.forEach(group => {
      // Only validate if the group is visible (handles dynamic plot/flat fields)
      if (group.style.display === 'none') return;

      const label = group.querySelector('.form-label');
      if (label && label.innerText.includes('*')) {
        const input = group.querySelector('input, select, textarea');
        if (input) {
          const val = (input.value || '').toString().trim();
          // Empty check
          if (!val) {
            isValid = false;
            markInputError(input, 'Required');
            invalidList.push({ label: label.innerText.replace('*','').trim(), reason: 'Required', el: input });
            if (!firstInvalid) firstInvalid = input;
            return;
          }

          // Minimum length heuristics for common fields
          const id = input.id || '';
          let minLen = 1;
          if (id === 'descriptionInput' || (label && /Description/i.test(label.innerText))) minLen = 20;
          else if (/pin|pincode|pin code/i.test(label.innerText) || /pin/i.test(id)) minLen = 6;
          else if (/name/i.test(label.innerText) || /name/i.test(id)) minLen = 2;

          if (val.length < minLen) {
            isValid = false;
            const reason = val.length === 0 ? 'Required' : `Too short (min ${minLen})`;
            markInputError(input, reason);
            invalidList.push({ label: label.innerText.replace('*','').trim(), reason, el: input });
            if (!firstInvalid) firstInvalid = input;
          }
        }
      }
    });

    // If invalid, show a concise summary at top of the step
    const existingSummary = stepEl.querySelector('.step-validation-summary');
    if (existingSummary) existingSummary.remove();
    if (!isValid && invalidList.length) {
      const summary = document.createElement('div');
      summary.className = 'step-validation-summary';
      summary.style = 'background:#fff7f6; border:1px solid #ffdddd; color:#b91c1c; padding:10px 12px; border-radius:8px; margin-bottom:12px; font-size:13px;';
      summary.innerHTML = `<strong>Fix these required fields:</strong><ul style="margin:8px 0 0 18px; padding:0; font-size:13px;">${invalidList.map(it => `<li>${it.label} — <span style=\"font-weight:700\">${it.reason}</span></li>`).join('')}</ul>`;
      stepEl.insertBefore(summary, stepEl.firstChild);
      if (firstInvalid) firstInvalid.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }

    return isValid;
  }

  document.querySelectorAll('.btn-next-step').forEach(btn => {
    btn.addEventListener('click', () => { 
      if (validateStep(currentStep) && currentStep < steps.length - 1) {
        goToStep(currentStep + 1); 
      }
    });
  });
  document.querySelectorAll('.btn-prev-step').forEach(btn => {
    btn.addEventListener('click', () => { if (currentStep > 0) goToStep(currentStep - 1); });
  });

  document.querySelectorAll('.form-type-option').forEach(opt => {
    opt.addEventListener('click', () => {
      opt.closest('.form-type-grid').querySelectorAll('.form-type-option').forEach(o => o.classList.remove('active'));
      opt.classList.add('active');
      
      // Update propertyCategory hidden input if this is the property type grid
      const gridTitle = opt.closest('div').querySelector('.filter-group-title')?.innerText;
      if (gridTitle === 'Property Type') {
        const catHidden = document.getElementById('propertyCategory');
        if (catHidden) {
          catHidden.value = opt.querySelector('.name').innerText;
          catHidden.dispatchEvent(new Event('change'));
        }
      }
    });
  });

  if (steps.length) goToStep(0);
}

// Call for post property page
if (document.querySelector('.form-step')) initPostSteps();

// ========== COUNTER ANIMATION ==========
function animateCounter(el, target, suffix = '') {
  let count = 0;
  const step = target / 60;
  const timer = setInterval(() => {
    count += step;
    if (count >= target) { count = target; clearInterval(timer); }
    el.textContent = Math.floor(count).toLocaleString('en-IN') + suffix;
  }, 16);
}

const statsObserver = new IntersectionObserver((entries) => {
  entries.forEach(entry => {
    if (entry.isIntersecting) {
      const el = entry.target;
      const target = parseFloat(el.dataset.target);
      const suffix = el.dataset.suffix || '';
      animateCounter(el, target, suffix);
      statsObserver.unobserve(el);
    }
  });
}, { threshold: 0.5 });

document.querySelectorAll('[data-target]').forEach(el => statsObserver.observe(el));

window.renderFilteredProperties = renderFilteredProperties;

// ========== TYPING EFFECT ==========
function initTypingEffect() {
  const textEl = document.getElementById('typing-text');
  if (!textEl) return;

  const sentences = [
    'Find Your Perfect <span>Dream Home</span> in India',
    'Discover Exclusive <span>Office Spaces</span> in Top Cities',
    'Invest in Premium <span>Plots of Land</span> Today',
    'Experience Luxury in <span>Exclusive Villas</span>',
    'Build Your Business in <span>Strategic Retail Shops</span>'
  ];
  
  let sentenceIndex = 0;
  let charIndex = 0;
  let isDeleting = false;
  let typeSpeed = 80; // Faster for full sentences

  function type() {
    const currentFullText = sentences[sentenceIndex];
    const totalChars = currentFullText.replace(/<[^>]*>/g, '').length;
    
    // Determine the visible text
    let visibleText = '';
    let rawIndex = 0;
    let visibleCount = 0;
    
    while (visibleCount < charIndex && rawIndex < currentFullText.length) {
      if (currentFullText[rawIndex] === '<') {
        const tagEnd = currentFullText.indexOf('>', rawIndex);
        visibleText += currentFullText.substring(rawIndex, tagEnd + 1);
        rawIndex = tagEnd + 1;
      } else {
        visibleText += currentFullText[rawIndex];
        rawIndex++;
        visibleCount++;
      }
    }

    textEl.innerHTML = visibleText;

    if (isDeleting) {
      charIndex--;
      typeSpeed = 40;
    } else {
      charIndex++;
      typeSpeed = 80;
    }

    // Fix: Transition to deleting only AFTER rendering the full text
    if (!isDeleting && charIndex > totalChars) {
      isDeleting = true;
      typeSpeed = 3000; // Pause at end
    } else if (isDeleting && charIndex < 0) {
      isDeleting = false;
      charIndex = 0;
      sentenceIndex = (sentenceIndex + 1) % sentences.length;
      typeSpeed = 500;
    }

    setTimeout(type, typeSpeed);
  }

  type();
}

// ========== GLOBAL TOAST NOTIFICATIONS ==========
window.showToast = function(message, type = 'success') {
  // Use a dedicated container for warning (centered) so other toasts remain top-right
  const containerSelector = type === 'warning' ? '.toast-container.warning' : '.toast-container';
  let container = document.querySelector(containerSelector);
  if (!container) {
    container = document.createElement('div');
    container.className = 'toast-container' + (type === 'warning' ? ' warning bottom centered' : '');
    document.body.appendChild(container);
  }

  const toast = document.createElement('div');
  toast.className = `toast-notification ${type}`;
  
  let icon, titleText;
  if (type === 'success') {
    icon = '<i class="fa-solid fa-circle-check"></i>';
    titleText = 'Success';
  } else if (type === 'error') {
    icon = '<i class="fa-solid fa-circle-exclamation"></i>';
    titleText = 'Error';
  } else if (type === 'warning') {
    icon = '<i class="fa-solid fa-triangle-exclamation"></i>';
    titleText = 'Notice';
  } else {
    icon = '<i class="fa-solid fa-circle-info"></i>';
    titleText = '';
  }

  // Add an optional action button for warnings (user can acknowledge)
  const actionHtml = type === 'warning' ? `<button class="toast-action">Got it</button>` : '';
  toast.innerHTML = `
    <div class="toast-icon">${icon}</div>
    <div class="toast-content">
      <div class="toast-title">${titleText}</div>
      <div class="toast-message">${message}</div>
    </div>
    ${actionHtml}
    <div class="toast-close"><i class="fa-solid fa-xmark"></i></div>
  `;

  container.appendChild(toast);

  // Trigger animation after next repaint
  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      toast.classList.add('show');
    });
  });

  const closeBtn = toast.querySelector('.toast-close');
  const removeToast = () => {
    toast.classList.remove('show');
    // Wait for the slide out animation to finish before removing
    setTimeout(() => {
      toast.remove();
      if (document.querySelectorAll('.toast-notification').length === 0) {
         container.remove();
      }
    }, 450);
  };

  closeBtn.addEventListener('click', removeToast);
  
  // Auto-remove timeout: longer for warnings so users can read/act
  const autoRemoveMs = type === 'warning' ? 8000 : 4500;
  const autoRemoveTimer = setTimeout(removeToast, autoRemoveMs);

  // If the toast has an action button (e.g., 'Got it') wire it to dismiss
  const actionBtn = toast.querySelector('.toast-action');
  if (actionBtn) {
    actionBtn.addEventListener('click', () => {
      clearTimeout(autoRemoveTimer);
      removeToast();
    });
  }
};

// ==========================================================================
// 8. INAUGURAL OFFER POP-UP
// ==========================================================================
function initInauguralPopup() {
  // Check if we already showed it this session
  if (sessionStorage.getItem('inauguralPopupShown')) {
    return;
  }

  // Create overlay
  const overlay = document.createElement('div');
  overlay.className = 'inaugural-modal-overlay';
  overlay.innerHTML = `
    <div class="inaugural-modal">
      <button class="inaugural-modal-close" aria-label="Close">&times;</button>
      <div class="inaugural-icon-wrap">
        <i class="fa-solid fa-gift"></i>
      </div>
      <h3 class="inaugural-title">Special Offer</h3>
      <p class="inaugural-text">
        As an inaugural offer, you can post any number of properties for 30 days free of charge.
      </p>
      <button class="btn btn-primary" style="width: 100%; justify-content: center;" onclick="window.location.href='post-property.html'">Post Property Now</button>
    </div>
  `;

  document.body.appendChild(overlay);

  // Show it with a slight delay so it transitions nicely
  setTimeout(() => {
    overlay.classList.add('open');
    sessionStorage.setItem('inauguralPopupShown', 'true');
  }, 1000); // 1.0 second delay after page load

  // Close logic
  const closeBtn = overlay.querySelector('.inaugural-modal-close');
  const closeModal = () => {
    overlay.classList.remove('open');
    setTimeout(() => overlay.remove(), 400); // Wait for transition
  };

  closeBtn.addEventListener('click', closeModal);
  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) closeModal();
  });
}

// Ensure initInauguralPopup runs after DOM is loaded. 
// Note: Since main.js often loads deferred or at EOF, DOM might already be loaded.
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initInauguralPopup);
} else {
  initInauguralPopup();
}
