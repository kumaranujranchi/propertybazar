// ========== MAIN.JS — Core site functionality ==========

document.addEventListener('DOMContentLoaded', () => {
  initNav();
  initSearchTabs();
  initCityAutocomplete();
  initSliders();
  initTestimonialsSlider();
  initAnimations();
  initEMICalc();
  initWishlist();
  initFilterPanel();
  initViewToggle();
  initTypingEffect();
});

// ========== STICKY NAV ==========
function initNav() {
  const header = document.querySelector('.header');
  const hamburger = document.querySelector('.hamburger');
  const mobileMenu = document.querySelector('.mobile-menu');

  if (header) {
    window.addEventListener('scroll', () => {
      header.classList.toggle('scrolled', window.scrollY > 30);
    });
  }

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

// ========== SEARCH TABS ==========
function initSearchTabs() {
  const tabs = document.querySelectorAll('.search-tab');
  tabs.forEach(tab => {
    tab.addEventListener('click', () => {
      tabs.forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
    });
  });

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

  if (activeFilters.types.length) filtered = filtered.filter(p => activeFilters.types.includes(p.propType));
  if (activeFilters.bhks.length) filtered = filtered.filter(p => activeFilters.bhks.includes(p.bhk));
  if (activeFilters.statuses.length) filtered = filtered.filter(p => activeFilters.statuses.includes(p.status));

  // City filter from URL param (set by city-selector.js)
  const urlParams = new URLSearchParams(window.location.search);
  const cityParam = urlParams.get('city');
  if (cityParam && cityParam !== 'All India') {
    filtered = filtered.filter(p =>
      (p.city || '').toLowerCase().includes(cityParam.toLowerCase()) ||
      (p.location || '').toLowerCase().includes(cityParam.toLowerCase())
    );
  }

  const sort = document.querySelector('.sort-select')?.value;
  if (sort === 'price-asc') filtered.sort((a, b) => a.price - b.price);
  else if (sort === 'price-desc') filtered.sort((a, b) => b.price - a.price);
  else if (sort === 'area-desc') filtered.sort((a, b) => b.area - a.area);

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
          <button class="prop-btn prop-btn-call" onclick="event.stopPropagation()">📞 Call</button>
          <button class="prop-btn prop-btn-msg" onclick="event.stopPropagation()">💬 Chat</button>
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

  function goToStep(n) {
    steps.forEach((s, i) => s.style.display = i === n ? 'block' : 'none');
    stepNums.forEach((num, i) => {
      num.classList.toggle('active', i === n);
      num.classList.toggle('completed', i < n);
      num.classList.toggle('pending', i > n);
      if (i < n) num.textContent = '✓';
      else num.textContent = i + 1;
    });
    stepLabels.forEach((lbl, i) => lbl.classList.toggle('pending', i > n));
    stepLines.forEach((line, i) => line.classList.toggle('completed', i < n));
    currentStep = n;
  }

  function validateStep(index) {
    const stepEl = steps[index];
    if (!stepEl) return true;
    
    // Find all visible inputs that have a label with a '*' indicating required
    const formGroups = stepEl.querySelectorAll('.form-group');
    let isValid = true;
    let firstInvalid = null;

    formGroups.forEach(group => {
      // Only validate if the group is visible (handles dynamic plot/flat fields)
      if (group.style.display === 'none') return;
      
      const label = group.querySelector('.form-label');
      if (label && label.innerText.includes('*')) {
        const input = group.querySelector('input, select, textarea');
        if (input) {
          if (!input.value.trim()) {
            isValid = false;
            input.style.borderColor = '#ef4444'; // Red border
            input.style.backgroundColor = '#fef2f2';
            
            // Remove error styling on input
            input.addEventListener('input', function removeError() {
               input.style.borderColor = '';
               input.style.backgroundColor = '';
               input.removeEventListener('input', removeError);
            });

            if (!firstInvalid) firstInvalid = input;
          }
        }
      }
    });

    if (!isValid && firstInvalid) {
      firstInvalid.scrollIntoView({ behavior: 'smooth', block: 'center' });
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
