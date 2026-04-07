import { database, ref, onValue } from './firebase-config.js';

// Configuration
const MCET_COORDS = [9.273183, 76.812384]; // Approximate coords for Malayalapuzha (MCET)
let map, userMarker, busMarker;
let activeBuses = {};

// Initialize Map
function initMap() {
    map = L.map('map').setView(MCET_COORDS, 13);

    // Add OpenStreetMap tiles
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© OpenStreetMap contributors',
        maxZoom: 19
    }).addTo(map);

    // Add marker for College
    const collegeIcon = L.divIcon({
        className: 'bus-marker-icon',
        html: `<div class="bus-marker-inner" style="background:#2ecc71; width:40px; height:40px;">M</div>`,
        iconSize: [40, 40],
        iconAnchor: [20, 20]
    });
    L.marker(MCET_COORDS, { icon: collegeIcon }).addTo(map).bindPopup("<b>MCET Campus</b>");

    // Try to get user's location
    if ("geolocation" in navigator) {
        navigator.geolocation.getCurrentPosition((position) => {
            const userCoords = [position.coords.latitude, position.coords.longitude];

            const userIcon = L.divIcon({
                className: 'bus-marker-icon',
                html: `<div class="bus-marker-inner" style="background:#3498db; width:20px; height:20px; border:2px solid white;"></div>`,
                iconSize: [20, 20]
            });

            userMarker = L.marker(userCoords, { icon: userIcon }).addTo(map).bindPopup("You are here");
        });
    }

    listenToFirebaseBuses();
}

function listenToFirebaseBuses() {
    // Connect to 'buses' node in Firebase
    try {
        const busesRef = ref(database, 'buses');
        onValue(busesRef, (snapshot) => {
            const data = snapshot.val();
            updateBusesOnMap(data);
        });
    } catch (e) {
        console.warn("Using mock data since Firebase is not fully configured yet.");
        simulateMockBusData();
    }
}

// Function to update map when bus location changes
function updateBusesOnMap(busesData) {
    const busSelect = document.getElementById('busSelect');
    const trackingDetails = document.getElementById('trackingDetails');
    const selectedBusId = busSelect.value;

    if (!busesData) {
        busSelect.innerHTML = '<option value="">No active buses found right now</option>';
        return;
    }

    // Update Dropdown options if needed
    let newOptions = '<option value="">Select a Bus to Track</option>';

    Object.keys(busesData).forEach(busId => {
        const bus = busesData[busId];
        newOptions += `<option value="${busId}">Route: ${busId} (${bus.driver})</option>`;

        // Marker Management
        createOrUpdateBusMarker(busId, bus);
    });

    if (busSelect.innerHTML !== newOptions) {
        const prevVal = busSelect.value;
        busSelect.innerHTML = newOptions;
        if (busesData[prevVal]) busSelect.value = prevVal; // restore selection
    }

    // Handle Active Bus Tracking Info
    if (selectedBusId && busesData[selectedBusId]) {
        trackingDetails.style.display = 'block';

        const activeBus = busesData[selectedBusId];
        document.getElementById('busSpeed').innerText = activeBus.speed ? activeBus.speed + ' km/h' : 'Loading...';

        const timeDiff = Math.floor((Date.now() - activeBus.timestamp) / 1000);
        document.getElementById('lastUpdated').innerText = timeDiff < 10 ? 'Just now' : `${timeDiff} sec ago`;

        // Pan map smoothly to active bus
        map.flyTo([activeBus.latitude, activeBus.longitude], 15, { animate: true, duration: 1.5 });
    } else {
        trackingDetails.style.display = 'none';
    }

    // Clean up markers for buses that went offline
    Object.keys(activeBuses).forEach(markerId => {
        if (!busesData[markerId]) {
            map.removeLayer(activeBuses[markerId]);
            delete activeBuses[markerId];
        }
    });
}

function createOrUpdateBusMarker(busId, busInfo) {
    if (activeBuses[busId]) {
        // Move existing marker smoothly
        const newLatLng = new L.LatLng(busInfo.latitude, busInfo.longitude);
        activeBuses[busId].setLatLng(newLatLng);
    } else {
        // Create new marker
        const icon = L.divIcon({
            className: 'bus-marker-icon',
            html: `<div class="bus-marker-inner" style="background:var(--primary);">B</div>`,
            iconSize: [30, 30],
            iconAnchor: [15, 15]
        });

        const marker = L.marker([busInfo.latitude, busInfo.longitude], { icon: icon }).addTo(map);
        marker.bindPopup(`<b>${busId}</b><br>Driver: ${busInfo.driver}`);
        marker.bindTooltip(`<b>${busId}</b>`, { permanent: true, direction: 'right', offset: [15, 0] });
        activeBuses[busId] = marker;
    }
}

// Attach Event Listeners
document.getElementById('busSelect').addEventListener('change', (e) => {
    const selectedBus = e.target.value;
    if (selectedBus && activeBuses[selectedBus]) {
        const marker = activeBuses[selectedBus];
        map.flyTo(marker.getLatLng(), 16);
    }
});

// Mock simulation for demo when API keys are empty
function simulateMockBusData() {
    let mockLat = 9.273183;
    let mockLng = 76.812384;

    // Simulate updating every 3 seconds
    setInterval(() => {
        mockLat -= 0.0002; // Move bus slightly down
        mockLng -= 0.0001;

        const mockData = {
            "KL-03-AA-1234": {
                latitude: mockLat,
                longitude: mockLng,
                driver: "Ramesh (Kollam Route)",
                timestamp: Date.now(),
                speed: 45
            },
            "KL-03-AB-5678": {
                latitude: 9.3000,
                longitude: 76.7500,
                driver: "Suresh (Adoor Route)",
                timestamp: Date.now() - 5000,
                speed: 30
            }
        };
        updateBusesOnMap(mockData);
    }, 3000);
}

// Initialize on load
document.addEventListener('DOMContentLoaded', initMap);
