import { convex } from './convex.js';

// Helper: build property-type-aware title
function buildTitle(p) {
  const loc = p.location?.locality || p.location?.city || '';
  const type = p.propertyType || '';
  const isLand = /plot|land/i.test(type);
  const isCommercial = /commercial|shop|office|warehouse/i.test(type);
  const bhk = p.details?.bhk;

  if (isLand) return `${type} in ${loc}`;
  if (isCommercial) return `${type} in ${loc}`;
  if (bhk && bhk !== '0' && bhk !== 'N/A') return `${bhk} BHK ${type} in ${loc}`;
  return `${type} in ${loc}`;
}

// Helper: specs chips for card
function buildSpecs(p) {
  const type = p.propertyType || '';
  const isLand = /plot|land/i.test(type);
  const isCommercial = /commercial|shop|office|warehouse/i.test(type);
  const bhk = p.details?.bhk;
  const area = p.details?.builtUpArea;

  const specs = [];

  if (!isLand && !isCommercial && bhk && bhk !== '0' && bhk !== 'N/A') {
    specs.push({ icon: '🛏️', label: `${bhk} BHK` });
  }

  if (area && area > 0) {
    specs.push({ icon: '📐', label: `${area} sq.ft` });
  }

  specs.push({ icon: '🏠', label: type });
  return specs;
}

document.addEventListener('DOMContentLoaded', async () => {
  try {
    const convexProps = await convex.query("properties:getProperties", {});
    const formatted = convexProps.map(p => {
      const title = buildTitle(p);
      const specs = buildSpecs(p);
      const area = p.details?.builtUpArea || 0;
      const price = p.pricing?.expectedPrice || 0;

      return {
        id: p._id,
        convexId: p._id,
        type: (p.transactionType || '').toLowerCase().includes('rent') ? 'rent' : 'buy',
        propType: p.propertyType,
        bhk: parseInt(p.details?.bhk) || 0,
        price,
        priceDisplay: '₹' + price.toLocaleString('en-IN') + ((p.transactionType || '').toLowerCase().includes('rent') ? '/mo' : ''),
        title,
        specs,   // property-type-aware specs
        location: `${p.location?.locality || ''}, ${p.location?.city || ''}`,
        city: p.location?.city || '',
        area,
        areaDisplay: area > 0 ? `${area} sq.ft` : '',
        image: p.photos && p.photos.length > 0 ? p.photos[0] : 'images/property-1.jpg',
        status: p.details?.status === 'Ready to Move' ? 'ready' : 'under-construction',
        verified: p.verified || false,
        featured: p.featured || false,
        newLaunch: p.details?.status === 'New Launch',
        rera: p.contactDesc?.rera || null,
        amenities: p.amenities || [],
        possession: p.details?.status || '',
        floor: p.details?.floorNumber ? `${p.details.floorNumber}th of ${p.details?.totalFloors || ''}` : '',
        facing: p.details?.facing || '',
        parking: p.details?.parking && p.details.parking !== 'None' ? 1 : 0,
        description: p.details?.description || '',
        price_per_sqft: area > 0 ? Math.round(price / area) : 0,
        // Preserve raw Convex data for detail page
        _raw: p,
      };
    });

    window.properties = [...formatted, ...(window.properties || [])];

    if (typeof window.renderFilteredProperties === 'function') {
      window.renderFilteredProperties();
    }

    // Homepage sliders
    renderHomepageSliders(formatted);
  } catch(err) {
    console.error("Error fetching convex properties:", err);
  }
});

function renderHomepageSliders(props) {
  const featuredSlider = document.getElementById('featuredSlider');
  const newLaunchSlider = document.getElementById('newLaunchSlider');

  if (featuredSlider) {
    // Take first 5 for featured
    const featured = props.slice(0, 5);
    featuredSlider.innerHTML = featured.map(p => buildPropertyCardHTML(p)).join('');
  }

  if (newLaunchSlider) {
    const newLaunches = props.filter(p => p.newLaunch).slice(0, 5);
    if (newLaunches.length > 0) {
      newLaunchSlider.innerHTML = newLaunches.map(p => {
        const detailUrl = `property-detail.html?id=${p.id}`;
        return `
          <div class="project-card" style="min-width: 300px; flex-shrink: 0; cursor: pointer" onclick="window.location.href='${detailUrl}'">
            <div class="project-img">
              <img src="${p.image}" alt="${p.title}" loading="lazy" />
              ${p.rera ? `<div class="project-rera">RERA Registered</div>` : ''}
              <div class="project-tag">
                <span class="badge badge-primary">NEW LAUNCH</span>
              </div>
            </div>
            <div class="project-body">
              <div class="project-name">${p.title}</div>
              <div class="project-location">📍 ${p.location}</div>
              <div class="project-price">${p.priceDisplay} Onwards</div>
              <div class="project-config">
                ${p.propType} · ${p.areaDisplay}
              </div>
            </div>
          </div>
        `;
      }).join('');
    } else {
        // If no new launches, maybe show some recent ones or hide
        newLaunchSlider.closest('section')?.style.setProperty('display', 'none');
    }
  }

  // Re-init sliders/animations if needed
  if (typeof window.initSliders === 'function') window.initSliders();
  if (typeof window.initAnimations === 'function') window.initAnimations();
}

function buildPropertyCardHTML(p) {
  const detailUrl = `property-detail.html?id=${p.id}`;
  return `
  <div class="property-card" onclick="window.location.href='${detailUrl}'">
    <div class="prop-img-wrap">
      <img src="${p.image}" alt="${p.title}" loading="lazy">
      <div class="prop-type-badge">
        <span class="badge ${p.type === 'rent' ? 'badge-warning' : 'badge-primary'}" style="background: var(--primary); color: #fff; padding: 4px 8px; border-radius: 4px; font-size: 11px; font-weight: 700">${p.type === 'rent' ? 'RENT' : 'BUY'}</span>
      </div>
      ${p.verified ? '<div class="prop-verified" style="background: rgba(16,185,129,0.9); color: #fff; padding: 4px 8px; border-radius: 4px; font-size: 11px; font-weight: 600"><i class="fa-solid fa-circle-check"></i> Verified</div>' : ''}
    </div>
    <div class="prop-body">
      <div class="prop-price">${p.priceDisplay} <span class="prop-per" style="font-size: 11px; color: var(--text-muted); font-weight: 400">· ₹${p.price_per_sqft?.toLocaleString('en-IN')}/sqft</span></div>
      <div class="prop-title" style="font-size: 15px; font-weight: 700; color: var(--dark); margin: 6px 0; white-space: nowrap; overflow: hidden; text-overflow: ellipsis">${p.title}</div>
      <div class="prop-location" style="color: var(--text-muted); font-size: 13px; margin-bottom: 12px"><i class="fa-solid fa-location-dot"></i> ${p.location}</div>
      <div class="prop-specs" style="display: flex; gap: 12px; margin-bottom: 16px; font-size: 12px; color: var(--text-muted)">
        ${p.specs.map(s => `<div class="prop-spec">${s.icon} ${s.label}</div>`).join('')}
      </div>
      <div class="prop-footer" style="display: flex; justify-content: space-between; align-items: center; border-top: 1px solid var(--border); padding-top: 12px">
        <div class="badge ${p.status === 'ready' ? 'badge-success' : 'badge-warning'}" style="font-size: 10px">${p.status === 'ready' ? '✅ Ready' : '🏗️ Under Const.'}</div>
        <div style="font-size: 12px; font-weight: 700; color: var(--primary)">View Details →</div>
      </div>
    </div>
  </div>`;
}
