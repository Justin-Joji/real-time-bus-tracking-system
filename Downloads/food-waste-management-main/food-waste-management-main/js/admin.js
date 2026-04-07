import { db } from './firebase-config.js';
import { collection, onSnapshot, doc, setDoc, deleteDoc, updateDoc } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";

// Tabs logic
document.querySelectorAll('.nav-link').forEach(link => {
    link.addEventListener('click', (e) => {
        if (link.getAttribute('data-tab')) {
            e.preventDefault();
            document.querySelectorAll('.nav-link').forEach(l => l.classList.remove('active'));
            link.classList.add('active');
            document.querySelectorAll('.tab-content').forEach(t => t.style.display = 'none');
            document.getElementById('tab-' + link.getAttribute('data-tab')).style.display = 'block';
            if (link.getAttribute('data-tab') === 'dashboard') {
                setTimeout(() => adminMap.invalidateSize(), 300);
            }
        }
    });
});

// Map logic
let adminMap = L.map('map').setView([9.273, 76.812], 11);
L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
    attribution: '&copy; OpenStreetMap contributors'
}).addTo(adminMap);
let mapMarkers = {};

let globalRouteOptions = '<option value="">Select Route</option>';

// Reactive Routes Loading
onSnapshot(collection(db, "routes"), (snapshot) => {
    const routeSelect = document.getElementById('assignRouteSelect');
    const tableBody = document.getElementById('routeTableBody');
    if (!tableBody || !routeSelect) return;

    tableBody.innerHTML = '';
    routeSelect.innerHTML = '<option value="">Select Route</option>';
    globalRouteOptions = '<option value="">Select Route</option>';

    snapshot.forEach((docSnap) => {
        const data = docSnap.data();
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td>${docSnap.id}</td>
            <td>${data.routeName}</td>
            <td>${data.start}</td>
            <td>${(data.stops || []).join(', ')}</td>
            <td><button class="btn" style="background:var(--danger); padding:0.5rem;" onclick="deleteRoute('${docSnap.id}')">Delete</button></td>
        `;
        tableBody.appendChild(tr);

        const opt = document.createElement('option');
        opt.value = docSnap.id;
        opt.innerText = data.routeName;
        routeSelect.appendChild(opt);

        globalRouteOptions += `<option value="${docSnap.id}">${data.routeName}</option>`;
    });

    document.querySelectorAll('.pending-route-select, .active-route-select').forEach(sel => {
        const currentVal = sel.value;
        sel.innerHTML = globalRouteOptions;
        sel.value = currentVal;
    });
}, (err) => console.error("Error fetching routes:", err));

// Reactive Drivers Loading
onSnapshot(collection(db, "drivers"), (snapshot) => {
    const tableBody = document.getElementById('driverTableBody');
    const pendingTableBody = document.getElementById('pendingDriverTableBody');
    if (!tableBody) return;

    tableBody.innerHTML = '';
    if (pendingTableBody) pendingTableBody.innerHTML = '';

    let count = 0;
    snapshot.forEach((docSnap) => {
        const data = docSnap.data();
        const status = data.status || 'active';
        const tr = document.createElement('tr');

        if (status === 'pending') {
            tr.innerHTML = `
                <td>${docSnap.id}</td>
                <td>${data.name}</td>
                <td>${data.busNumber}</td>
                <td>
                    <select id="route-${docSnap.id}" class="pending-route-select" style="padding: 0.3rem; border-radius: 4px; background: var(--surface); color: var(--text); border: 1px solid var(--border); width: 100%;">
                        ${typeof globalRouteOptions !== 'undefined' ? globalRouteOptions : '<option value="">Select Route</option>'}
                    </select>
                </td>
                <td>
                    <button class="btn" style="background:var(--success); padding:0.5rem; margin-right:5px;" onclick="acceptDriver('${docSnap.id}')">Accept</button>
                    <button class="btn" style="background:var(--danger); padding:0.5rem;" onclick="deleteDriver('${docSnap.id}')">Reject</button>
                </td>
            `;
            if (pendingTableBody) pendingTableBody.appendChild(tr);
        } else {
            count++;
            let currentRouteId = data.assignedRoute || '';
            let optionsHtml = typeof globalRouteOptions !== 'undefined' ? globalRouteOptions : '<option value="">Select Route</option>';
            if (currentRouteId.trim() !== '') {
                optionsHtml = optionsHtml.replace(`value="${currentRouteId}"`, `value="${currentRouteId}" selected`);
            }

            tr.innerHTML = `
                <td>${docSnap.id}</td>
                <td>${data.name}</td>
                <td>${data.busNumber}</td>
                <td>
                    <select class="active-route-select" onchange="updateDriverRoute('${docSnap.id}', this.value, this.options[this.selectedIndex].text, this, '${currentRouteId}')" style="padding: 0.3rem; border-radius: 4px; background: var(--surface); color: var(--text); border: 1px solid var(--border); width: 100%;">
                        ${optionsHtml}
                    </select>
                </td>
                <td><button class="btn" style="background:var(--danger); padding:0.5rem;" onclick="deleteDriver('${docSnap.id}')">Delete</button></td>
            `;
            tableBody.appendChild(tr);
        }
    });
    document.getElementById('totalDrivers').innerText = count;
    document.getElementById('totalBuses').innerText = count;
}, (err) => console.error("Error fetching drivers:", err));

// Map tracking wrapper using Firestore
onSnapshot(collection(db, 'live_locations'), (snapshot) => {
    const data = {};
    snapshot.forEach((docSnap) => {
        data[docSnap.id] = docSnap.data();
    });

    const liveTripsEl = document.getElementById('liveTrips');
    if (liveTripsEl) liveTripsEl.innerText = Object.keys(data).length;

    // Remove old markers
    Object.keys(mapMarkers).forEach(k => {
        if (!data[k]) {
            adminMap.removeLayer(mapMarkers[k]);
            delete mapMarkers[k];
        }
    });

    // Add/Update markers
    Object.keys(data).forEach(busId => {
        const bus = data[busId];
        if (mapMarkers[busId]) {
            mapMarkers[busId].setLatLng([bus.latitude, bus.longitude]);
        } else {
            const m = L.marker([bus.latitude, bus.longitude]).addTo(adminMap)
                .bindTooltip(`${bus.busNumber || busId}: ${bus.driverName || ''}`, { permanent: true, direction: 'right' });
            mapMarkers[busId] = m;
        }
    });
}, (err) => console.error("Error watching live locations:", err));

function showDriverModal() {
    document.getElementById('addDriverSection').style.display = 'block';
}
window.showDriverModal = showDriverModal;

document.getElementById('saveRouteBtn').addEventListener('click', async () => {
    const id = document.getElementById('routeId').value.trim();
    const name = document.getElementById('routeName').value.trim();
    const stopsStr = document.getElementById('routeStops').value.trim();
    const stopsArr = stopsStr.split(',').map(s => s.trim()).filter(s => s);

    if (!id || !name) return alert("Fill ID and Name");

    try {
        await setDoc(doc(db, "routes", id), {
            routeName: name,
            start: "Musaliar College",
            stops: stopsArr
        });
        alert("Route saved!");
        // Clear fields
        document.getElementById('routeId').value = '';
        document.getElementById('routeName').value = '';
        document.getElementById('routeStops').value = '';
    } catch (e) {
        alert("Error saving route: " + e.message);
    }
});

document.getElementById('saveDriverBtn').addEventListener('click', async () => {
    const id = document.getElementById('addDriverId').value.trim();
    const name = document.getElementById('addDriverName').value.trim();
    const pass = document.getElementById('addDriverPass').value.trim();
    const bus = document.getElementById('addBusNumber').value.trim();
    const routeSelect = document.getElementById('assignRouteSelect');
    const routeId = routeSelect.value;
    const routeName = routeId ? routeSelect.options[routeSelect.selectedIndex].text : '';

    if (!id || !name || !pass || !bus) return alert("Fill all fields");

    try {
        await setDoc(doc(db, "drivers", id), {
            name,
            password: pass,
            busNumber: bus,
            assignedRoute: routeId,
            assignedRouteName: routeName,
            status: 'active'
        });
        alert("Driver saved!");
        document.getElementById('addDriverSection').style.display = 'none';
        // Clear fields
        document.getElementById('addDriverId').value = '';
        document.getElementById('addDriverName').value = '';
        document.getElementById('addDriverPass').value = '';
        document.getElementById('addBusNumber').value = '';
        routeSelect.value = '';
    } catch (e) {
        alert("Error saving driver: " + e.message);
    }
});

window.deleteDriver = async (id) => {
    if (confirm("Delete driver?")) {
        try {
            await deleteDoc(doc(db, "drivers", id));
        } catch (e) {
            alert("Error deleting driver: " + e.message);
        }
    }
}

window.acceptDriver = async (id) => {
    const routeSelect = document.getElementById('route-' + id);
    let assignedRoute = '';
    let assignedRouteName = '';

    if (routeSelect && routeSelect.value !== '') {
        assignedRoute = routeSelect.value;
        assignedRouteName = routeSelect.options[routeSelect.selectedIndex].text;
    }

    if (!assignedRoute) {
        if (!confirm("No route selected. Approve driver without assigning a route?")) return;
    } else {
        if (!confirm(`Approve driver and assign to ${assignedRouteName}?`)) return;
    }

    try {
        await updateDoc(doc(db, "drivers", id), {
            status: 'active',
            assignedRoute: assignedRoute,
            assignedRouteName: assignedRouteName
        });
    } catch (e) {
        alert("Error approving driver: " + e.message);
    }
}
window.deleteRoute = async (id) => {
    if (confirm("Delete route?")) {
        try {
            await deleteDoc(doc(db, "routes", id));
        } catch (e) {
            alert("Error deleting route: " + e.message);
        }
    }
}

window.updateDriverRoute = async (id, routeId, routeName, selectElement, oldRouteId) => {
    let rName = routeId ? routeName : 'None';
    if (confirm(`Change assigned route to ${rName}?`)) {
        try {
            await updateDoc(doc(db, "drivers", id), {
                assignedRoute: routeId,
                assignedRouteName: routeId ? routeName : ''
            });
        } catch (e) {
            alert("Error updating route: " + e.message);
            selectElement.value = oldRouteId; // revert on error
        }
    } else {
        selectElement.value = oldRouteId; // revert if cancelled
    }
}

