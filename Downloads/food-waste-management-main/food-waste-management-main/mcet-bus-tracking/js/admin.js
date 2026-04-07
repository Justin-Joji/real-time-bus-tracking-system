import { database, ref, onValue, remove } from './firebase-config.js';

let adminMap;
let mapMarkers = {};

document.addEventListener('DOMContentLoaded', () => {
    initAdminMap();
    setupTabs();
    listenToFleetData();
});

function initAdminMap() {
    adminMap = L.map('adminMap').setView([9.273183, 76.812384], 11); // MCET Area bounds
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png').addTo(adminMap);
}

function setupTabs() {
    const navItems = document.querySelectorAll('.nav-item');
    const tabContents = document.querySelectorAll('.tab-content');

    navItems.forEach(item => {
        if (!item.hasAttribute('data-tab')) return;

        item.addEventListener('click', (e) => {
            e.preventDefault();

            navItems.forEach(nav => nav.classList.remove('active'));
            item.classList.add('active');

            const targetId = item.getAttribute('data-tab') + 'Tab';
            tabContents.forEach(content => {
                content.style.display = content.id === targetId ? 'block' : 'none';
            });

            if (targetId === 'dashboardTab') {
                // Leaflet map fix for resizing when changing tabs
                setTimeout(() => adminMap.invalidateSize(), 300);
            }
        });
    });
}

function listenToFleetData() {
    try {
        const busesRef = ref(database, 'buses');
        onValue(busesRef, (snapshot) => {
            const data = snapshot.val();
            updateDashboard(data);
        });
    } catch (e) {
        // Mock fallback if Firebase isn't configured for easy preview
        setInterval(() => {
            simulateAdminMock();
        }, 5000);
        simulateAdminMock();
    }
}

function updateDashboard(busesData) {
    const tableBody = document.getElementById('activeBusesTableBody');
    tableBody.innerHTML = '';

    if (!busesData) {
        document.getElementById('activeBusesCount').innerText = '0';
        // Clear all markers
        Object.values(mapMarkers).forEach(m => adminMap.removeLayer(m));
        mapMarkers = {};
        return;
    }

    let count = 0;
    Object.keys(busesData).forEach(busId => {
        const bus = busesData[busId];
        count++;

        // Update Map Marker
        if (mapMarkers[busId]) {
            mapMarkers[busId].setLatLng([bus.latitude, bus.longitude]);
        } else {
            const icon = L.divIcon({
                className: 'bus-marker-icon',
                html: `<div class="bus-marker-inner" style="background:#e74c3c;">B</div>`
            });
            const marker = L.marker([bus.latitude, bus.longitude], { icon }).addTo(adminMap)
                .bindPopup(`<b>${busId}</b><br>Driver: ${bus.driver}<br>Speed: ${bus.speed || 0} km/h`);
            marker.bindTooltip(`<b>${busId}</b>`, { permanent: true, direction: 'right', offset: [15, 0] });
            mapMarkers[busId] = marker;
        }

        // Add to table
        const age = Math.floor((Date.now() - bus.timestamp) / 1000);
        const statusText = age > 30 ? '<span style="color:red">Signal Lost</span>' : '<span style="color:green">Active Ping</span>';

        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td><strong>${busId}</strong></td>
            <td>${bus.driver}</td>
            <td>${age} sec ago - ${statusText}</td>
            <td>${bus.speed || 0} km/h</td>
            <td><button class="action-btn" onclick="removeBus('${busId}')">Force Remove</button></td>
        `;
        tableBody.appendChild(tr);
    });

    document.getElementById('activeBusesCount').innerText = count;

    // Clean up markers that are no longer in DB
    Object.keys(mapMarkers).forEach(busId => {
        if (!busesData[busId]) {
            adminMap.removeLayer(mapMarkers[busId]);
            delete mapMarkers[busId];
        }
    });
}

// Global action exposed for button onClick
window.removeBus = function (busId) {
    if (confirm(`Are you sure you want to stop tracking and remove ${busId} from the system?`)) {
        try {
            const safeBusId = busId.replace(/[^a-zA-Z0-9-]/g, '');
            remove(ref(database, 'buses/' + safeBusId));
        } catch (e) {
            console.log("Mock remove object", busId);
        }
    }
}

function simulateAdminMock() {
    const mockData = {
        "KL-03-AA-1234": {
            latitude: 9.273183,
            longitude: 76.812384,
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
    updateDashboard(mockData);
}
