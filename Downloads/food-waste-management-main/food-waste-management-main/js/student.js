import { db } from './firebase-config.js';
import { collection, onSnapshot, getDocs } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";

let studentMap = L.map('map').setView([9.273, 76.812], 10);
L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
    attribution: '&copy; OpenStreetMap contributors'
}).addTo(studentMap);

// Create custom icon for buses
const busIcon = L.icon({
    iconUrl: 'https://cdn-icons-png.flaticon.com/512/3448/3448339.png',
    iconSize: [32, 32],
    iconAnchor: [16, 16],
    popupAnchor: [0, -16]
});

// Create custom icon for student
const studentIcon = L.icon({
    iconUrl: 'https://cdn-icons-png.flaticon.com/512/1077/1077114.png',
    iconSize: [28, 28],
    iconAnchor: [14, 14]
});

let studentLat = null;
let studentLng = null;
let studentMarker = null;

// Get student position continuously
navigator.geolocation.watchPosition(pos => {
    studentLat = pos.coords.latitude;
    studentLng = pos.coords.longitude;

    if (studentMarker) {
        studentMarker.setLatLng([studentLat, studentLng]);
    } else {
        studentMarker = L.marker([studentLat, studentLng], { icon: studentIcon }).addTo(studentMap)
            .bindTooltip("Your Location", { permanent: true, direction: "bottom" }).openTooltip();
        studentMap.setView([studentLat, studentLng], 14);
    }

    // Automatically recalculate distance whenever the student or bus moves
    updatePanel();
}, err => {
    console.warn("Could not get student location", err);
}, { enableHighAccuracy: true });

let mapMarkers = {};
let activeData = {};
let allBuses = [];

function calculateDistance(lat1, lon1, lat2, lon2) {
    const R = 6371;
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a =
        Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos(lat1 * Math.PI / 180) *
        Math.cos(lat2 * Math.PI / 180) *
        Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
}

const select = document.getElementById('activeBusSelect');

// Load all registered buses first
async function loadAllBuses() {
    try {
        const querySnapshot = await getDocs(collection(db, "drivers"));
        allBuses = [];
        querySnapshot.forEach((docSnap) => {
            const data = docSnap.data();
            const bNum = data.busNumber || data.Busnumber || docSnap.id;
            const bRoute = data.assignedRouteName || data.assignedRoute || 'Unknown Route';
            
            // Avoid duplicates (normalize for comparison)
            const exists = allBuses.some(b => 
                b.busNumber.toString().toLowerCase().trim() === bNum.toString().toLowerCase().trim()
            );
            
            if (!exists) {
                allBuses.push({
                    id: docSnap.id,
                    busNumber: bNum,
                    route: bRoute,
                    driverName: data.name || data.Name || 'Unknown'
                });
            }

        });
        console.log("Loaded all registered buses:", allBuses);
        renderDropdown();
    } catch (e) {
        console.error("Error loading bus list:", e);
    }
}

function renderDropdown() {
    const previousSelection = select.value || localStorage.getItem('savedStudentSelection');
    select.innerHTML = '<option value="">Select a bus to track...</option>';

    // Create a temporary list of all unique bus IDs (registered + live)
    const displayList = [...allBuses];
    
    // Add live buses that aren't in the registered list
    Object.keys(activeData).forEach(k => {
        const liveBus = activeData[k];
        const match = displayList.find(b => b.busNumber.replace(/[^a-zA-Z0-9-]/g, '') === k);
        if (!match) {
            displayList.push({
                id: k,
                busNumber: liveBus.busNumber || k,
                route: liveBus.route || 'Active Trip',
                driverName: liveBus.driverName || 'Unknown'
            });
        }
    });

    displayList.forEach(bus => {
        const safeKey = bus.busNumber.toString().replace(/[^a-zA-Z0-9-]/g, '');
        const isLive = activeData[safeKey];
        const opt = document.createElement('option');
        opt.value = safeKey;
        opt.innerText = `${bus.busNumber} (${bus.route}) ${isLive ? '● LIVE' : '(Offline)'}`;
        if (isLive) opt.style.color = '#10b981'; // Green for live
        select.appendChild(opt);
    });

    if (previousSelection) {
        select.value = previousSelection;
    }
}


// Watch for live updates
onSnapshot(collection(db, 'live_locations'), (snapshot) => {
    activeData = {};
    snapshot.forEach((docSnap) => {
        activeData[docSnap.id] = docSnap.data();
    });

    // Update markers on map
    Object.keys(activeData).forEach(k => {
        const bus = activeData[k];
        if (mapMarkers[k]) {
            mapMarkers[k].setLatLng([bus.latitude, bus.longitude]);
        } else {
            const m = L.marker([bus.latitude, bus.longitude], { icon: busIcon }).addTo(studentMap)
                .bindTooltip(bus.busNumber, { permanent: true, direction: "top", offset: [0, -16] });
            mapMarkers[k] = m;
        }
    });

    // Remove old markers
    Object.keys(mapMarkers).forEach(k => {
        if (!activeData[k]) {
            studentMap.removeLayer(mapMarkers[k]);
            delete mapMarkers[k];
        }
    });

    renderDropdown();
    updatePanel();
});

let routeLine = null;

select.addEventListener('change', () => {
    localStorage.setItem('savedStudentSelection', select.value);
    updatePanel();

    if (select.value && activeData[select.value] && studentLat) {
        const busObj = activeData[select.value];
        const bounds = L.latLngBounds([
            [studentLat, studentLng],
            [busObj.latitude, busObj.longitude]
        ]);
        studentMap.fitBounds(bounds, { padding: [50, 50], maxZoom: 15 });
    }
});

function updatePanel() {
    const selId = select.value;
    if (!selId || !activeData[selId]) {
        document.getElementById('trackingDetails').style.display = 'none';
        if (routeLine) {
            studentMap.removeLayer(routeLine);
            routeLine = null;
        }
        // If the selected bus is offline, show a message maybe?
        if (selId) {
            // Optional: document.getElementById('trackingDetails').style.display = 'block';
            // but for now, we follow existing UI pattern
        }
        return;
    }

    document.getElementById('trackingDetails').style.display = 'flex';
    const bus = activeData[selId];

    document.getElementById('dispStdDriver').innerText = bus.driverName || 'Unknown';
    document.getElementById('dispStdRoute').innerText = bus.route || 'Unknown';

    if (studentLat && studentLng) {
        const dist = calculateDistance(studentLat, studentLng, bus.latitude, bus.longitude);
        document.getElementById('dispStdDistance').innerText = dist.toFixed(2) + " km";

        // Avg speed estimate (30 km/hr = 2 min per km)
        const etaObj = dist * 2;
        document.getElementById('dispStdEta').innerText = Math.round(etaObj) + " minutes";

        if (routeLine) studentMap.removeLayer(routeLine);
        routeLine = L.polyline([[studentLat, studentLng], [bus.latitude, bus.longitude]], {
            color: '#ef4444',
            weight: 4,
            dashArray: '10, 10'
        }).addTo(studentMap);
    } else {
        document.getElementById('dispStdDistance').innerText = "Grant Location Access";
    }
}

// Initial loads
loadAllBuses();

