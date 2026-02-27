document.addEventListener('DOMContentLoaded', () => {
    const cityModal = document.getElementById('cityModal');
    const citySelectorBtn = document.getElementById('citySelectorBtn');
    const closeCityModal = document.getElementById('closeCityModal');
    const citySearchInput = document.getElementById('citySearchInput');
    const allCitiesList = document.getElementById('allCitiesList');
    const currentCityText = document.getElementById('currentCityText');
    const popularCityItems = document.querySelectorAll('.city-popular-item');

    // Popular Cities Data (Extended)
    const allCities = [
        'Ahmedabad', 'Bangalore', 'Gurgaon', 'Hyderabad', 'Mumbai', 'New Delhi', 'Noida', 'Pune',
        'Bhopal', 'Bhubaneswar', 'Chandigarh', 'Chennai', 'Coimbatore', 'Faridabad',
        'Gandhinagar', 'Ghaziabad', 'Goa', 'Greater Noida', 'Indore', 'Jaipur',
        'Kochi', 'Kolkata', 'Lucknow', 'Nagpur', 'Nashik', 'Navi Mumbai',
        'Palghar', 'Patna', 'Ranchi', 'Surat', 'Thane', 'Vadodara', 'Visakhapatnam'
    ].sort();

    // Init Modal
    function initCityModal() {
        populateAllCities(allCities);
        
        // Load saved city
        const savedCity = localStorage.getItem('selectedCity') || 'Select City';
        if (currentCityText) currentCityText.textContent = savedCity;
        
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
        if (currentCityText) currentCityText.textContent = city;
        cityModal.classList.remove('open');
        document.body.style.overflow = '';
        
        // Optional: Trigger a custom event or refresh data if needed
        window.dispatchEvent(new CustomEvent('cityChanged', { detail: { city } }));
        
        // If on properties page, update filter
        if (window.location.pathname.includes('properties.html')) {
            const url = new URL(window.location.href);
            url.searchParams.set('city', city);
            window.history.pushState({}, '', url);
            if (typeof window.renderFilteredProperties === 'function') {
                window.renderFilteredProperties();
            }
        }
    }

    initCityModal();
});
