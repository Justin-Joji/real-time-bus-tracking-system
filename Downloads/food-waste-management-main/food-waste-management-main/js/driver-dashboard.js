import { db } from './firebase-config.js';
import { doc, getDoc, setDoc, deleteDoc } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";

const drId = localStorage.getItem('driverAuth_id');
const drName = localStorage.getItem('driverAuth_name');
const busNumber = localStorage.getItem('driverAuth_busNumber');
const routeId = localStorage.getItem('driverAuth_routeId');
const routeName = localStorage.getItem('driverAuth_routeName');

document.getElementById('dispDriverName').innerText = drName;
document.getElementById('dispBusNumber').innerText = busNumber;
document.getElementById('dispRoute').innerText = routeName;

let trackingInterval = null;

// Fetch route stops just to display
if (routeId) {
    getDoc(doc(db, "routes", routeId)).then(snap => {
        if (snap.exists()) {
            const stops = snap.data().stops || [];
            document.getElementById('dispStops').innerText = "Stops: " + stops.join(" → ");
        }
    });
}

const startBtn = document.getElementById('startTripBtn');
const endBtn = document.getElementById('endTripBtn');
const indicator = document.getElementById('statusIndicator');

function fetchAndSendLocation() {
    if (!navigator.geolocation) return;

    navigator.geolocation.getCurrentPosition((position) => {
        const lat = position.coords.latitude;
        const lng = position.coords.longitude;
        const locData = {
            latitude: lat,
            longitude: lng,
            driverName: drName,
            busNumber: busNumber,
            route: routeName,
            lastUpdated: Date.now()
        };
        const safeKey = busNumber.replace(/[^a-zA-Z0-9-]/g, '');
        // Push continuously to Firestore
        setDoc(doc(db, 'live_locations', safeKey), locData).catch(e => console.error("Firestore Write Error", e));
    }, (err) => {
        console.error("GPS Error", err);
    }, { enableHighAccuracy: true, timeout: 5000, maximumAge: 0 });
}

startBtn.addEventListener('click', () => {
    if (!navigator.geolocation) return alert("GPS not supported by your browser");

    fetchAndSendLocation();
    trackingInterval = setInterval(fetchAndSendLocation, 3500); // Send every 3.5 seconds

    indicator.className = 'status-badge status-online';
    indicator.innerText = 'ONLINE - Tracking Active';
    startBtn.style.display = 'none';
    endBtn.style.display = 'block';
    localStorage.setItem('driverIsTracking', 'true');
});

endBtn.addEventListener('click', async () => {
    if (trackingInterval) clearInterval(trackingInterval);

    const safeKey = busNumber.replace(/[^a-zA-Z0-9-]/g, '');
    try {
        await deleteDoc(doc(db, 'live_locations', safeKey));
    } catch (e) {
        console.error("Error ending trip:", e);
    }

    indicator.className = 'status-badge status-offline';
    indicator.innerText = 'OFFLINE - Location Not Sharing';
    startBtn.style.display = 'block';
    endBtn.style.display = 'none';
    localStorage.setItem('driverIsTracking', 'false');
});

// Auto resume tracking if refreshed
if (localStorage.getItem('driverIsTracking') === 'true') {
    startBtn.click();
}

