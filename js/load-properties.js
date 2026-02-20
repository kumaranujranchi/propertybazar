import { convex } from './convex.js';

document.addEventListener('DOMContentLoaded', async () => {
    try {
        const convexProps = await convex.query("properties:getProperties", {});
        const formatted = convexProps.map(p => ({
            id: p._id,
            type: p.transactionType.includes('Rent') ? 'rent' : 'buy',
            propType: p.propertyType,
            bhk: parseInt(p.details.bhk) || 0,
            price: p.pricing.expectedPrice,
            priceDisplay: '₹' + p.pricing.expectedPrice.toLocaleString('en-IN') + (p.transactionType.includes('Rent') ? '/mo' : ''),
            title: `${p.details.bhk || ''} BHK ${p.propertyType} in ${p.location.locality}`,
            location: `${p.location.locality}, ${p.location.city}`,
            city: p.location.city,
            area: p.details.builtUpArea,
            areaDisplay: `${p.details.builtUpArea} sq.ft`,
            image: p.photos && p.photos.length > 0 ? p.photos[0] : 'images/property-1.jpg',
            status: p.details.status === 'Ready to Move' ? 'ready' : 'under-construction',
            verified: true,
            featured: false,
            newLaunch: p.details.status === 'New Launch',
            rera: p.contactDesc ? p.contactDesc.rera : null,
            amenities: p.amenities || [],
            possession: p.details.status,
            floor: p.details.floorNumber ? `${p.details.floorNumber}th of ${p.details.totalFloors || ''}` : '',
            facing: p.details.facing || '',
            parking: p.details.parking && p.details.parking !== 'None' ? 1 : 0, 
            description: p.details.description,
            price_per_sqft: p.details.builtUpArea > 0 ? Math.round(p.pricing.expectedPrice / p.details.builtUpArea) : 0,
        }));
        
        // Ensure window.properties exists
        window.properties = [...formatted, ...(window.properties || [])];
        
        if (typeof window.renderFilteredProperties === 'function') {
            window.renderFilteredProperties();
        }
    } catch(err) {
        console.error("Error fetching convex properties:", err);
    }
});
