import { convex } from './convex.js';

document.addEventListener('DOMContentLoaded', async () => {
    const cityModal = document.getElementById('cityModal');
    const citySelectorBtn = document.getElementById('citySelectorBtn');
    const closeCityModal = document.getElementById('closeCityModal');
    const citySearchInput = document.getElementById('citySearchInput');
    const allCitiesList = document.getElementById('allCitiesList');
    const currentCityText = document.getElementById('currentCityText');
    const popularCityItems = document.querySelectorAll('.city-popular-item');

    let allCities = [
        'Ahmedabad', 'Bangalore', 'Gurgaon', 'Hyderabad', 'Mumbai', 'New Delhi', 'Noida', 'Pune',
        'Bhopal', 'Bhubaneswar', 'Chandigarh', 'Chennai', 'Coimbatore', 'Faridabad',
        'Gandhinagar', 'Ghaziabad', 'Goa', 'Greater Noida', 'Indore', 'Jaipur',
        'Kochi', 'Kolkata', 'Lucknow', 'Nagpur', 'Nashik', 'Navi Mumbai',
        'Palghar', 'Patna', 'Ranchi', 'Surat', 'Thane', 'Vadodara', 'Visakhapatnam'
    ].sort();

    // Fetch dynamic cities from Convex
    async function fetchDynamicCities() {
        try {
            const dynamicCities = await convex.query("properties:getUniqueCities");
            if (dynamicCities && dynamicCities.length > 0) {
                allCities = dynamicCities;
            }
        } catch (err) {
            console.error("Error fetching dynamic cities:", err);
        }
        populateAllCities(allCities);
    }

    // Init Modal
    async function initCityModal() {
        await fetchDynamicCities();
        
        // Load saved city
        const savedCity = localStorage.getItem('selectedCity') || 'Select City';
        if (currentCityText) currentCityText.textContent = savedCity;
        
        // Dispatch event on init so banners/filters pick it up
        if (savedCity && savedCity !== 'Select City') {
            window.dispatchEvent(new CustomEvent('cityChanged', { detail: { city: savedCity } }));
        }
        
        // Open Modal
        if (citySelectorBtn) {
            citySelectorBtn.addEventListener('click', () => {
                cityModal.classList.add('open');
                document.body.style.overflow = 'hidden';
            });
        }

        // Close Modal
        if (closeCityModal) {
            closeCityModal.addEventListener('click', () => {
                cityModal.classList.remove('open');
                document.body.style.overflow = '';
            });
        }

        // Close on outer click
        cityModal.addEventListener('click', (e) => {
            if (e.target === cityModal) {
                cityModal.classList.remove('open');
                document.body.style.overflow = '';
            }
        });

        // Search Filter
        citySearchInput.addEventListener('input', (e) => {
            const term = e.target.value.toLowerCase();
            const filtered = allCities.filter(city => city.toLowerCase().includes(term));
            populateAllCities(filtered);
        });

        // Popular City Selection
        popularCityItems.forEach(item => {
            item.addEventListener('click', () => {
                const city = item.dataset.city;
                selectCity(city);
            });
        });

            // Use my current location button
            const useLocationBtn = document.getElementById('useLocationBtn');
            if (useLocationBtn) {
                useLocationBtn.addEventListener('click', async () => {
                    useLocationBtn.disabled = true;
                    useLocationBtn.textContent = 'Detecting...';
                    try {
                        if (!('geolocation' in navigator)) throw new Error('Geolocation not supported');
                        navigator.geolocation.getCurrentPosition(async (pos) => {
                            try {
                                const { latitude, longitude } = pos.coords;
                                const url = `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${latitude}&lon=${longitude}`;
                                const res = await fetch(url, { headers: { 'Accept': 'application/json' } });
                                if (!res.ok) throw new Error('Reverse geocode failed');
                                const data = await res.json();
                                const addr = data.address || {};
                                const city = addr.city || addr.town || addr.village || addr.hamlet || addr.county || addr.state;
                                if (city) {
                                    // selectCity will mark manual selection and close modal
                                    selectCity(city);
                                } else {
                                    alert('Could not detect city from your location.');
                                }
                            } catch (e) {
                                console.error(e);
                                alert('Failed to detect location. Please try again.');
                            } finally {
                                useLocationBtn.disabled = false;
                                useLocationBtn.textContent = 'Use my current location';
                            }
                        }, (err) => {
                            console.warn('Geolocation error', err);
                            alert('Location permission denied or unavailable.');
                            useLocationBtn.disabled = false;
                            useLocationBtn.textContent = 'Use my current location';
                        }, { timeout: 10000 });
                    } catch (err) {
                        console.warn(err);
                        alert('Geolocation not supported in your browser.');
                        useLocationBtn.disabled = false;
                        useLocationBtn.textContent = 'Use my current location';
                    }
                });
            }
    }

    function populateAllCities(citiesToRender) {
        if (!allCitiesList) return;
        allCitiesList.innerHTML = '';
        citiesToRender.forEach(city => {
            const cityDiv = document.createElement('div');
            cityDiv.className = 'city-item';
            cityDiv.textContent = city;
            cityDiv.addEventListener('click', () => selectCity(city));
            allCitiesList.appendChild(cityDiv);
        });
    }

    function selectCity(city) {
        localStorage.setItem('selectedCity', city);
        // Mark that the user manually selected a city so automatic geolocation
        // doesn't override their choice.
        localStorage.setItem('cityManuallySelected', '1');
        if (currentCityText) currentCityText.textContent = city;
        cityModal.classList.remove('open');
        document.body.style.overflow = '';
        
        // Optional: Trigger a custom event or refresh data if needed
        window.dispatchEvent(new CustomEvent('cityChanged', { detail: { city } }));
        
        // If on properties page, reload with new city parameter
        if (window.location.pathname.includes('properties.html') || window.location.href.includes('properties.html')) {
            const urlParams = new URLSearchParams(window.location.search);
            urlParams.set('city', city);
            // Updating window.location.search directly is more robust for forcing a reload
            window.location.search = urlParams.toString();
        }
    }

    initCityModal();
});
