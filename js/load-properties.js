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
        verified: true,
        featured: false,
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
  } catch(err) {
    console.error("Error fetching convex properties:", err);
  }
});
