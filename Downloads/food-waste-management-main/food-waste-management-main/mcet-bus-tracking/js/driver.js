import { database, ref, set, remove } from './firebase-config.js';

let watchId = null;
let updateCount = 0;
let lastLat = null;
let lastLng = null;
let lastTime = null;

const setupSection = document.getElementById('setupSection');
const activeSection = document.getElementById('activeSection');
const btnStart = document.getElementById('startTrackingBtn');
const btnStop = document.getElementById('stopTrackingBtn');
const busIdInput = document.getElementById('busId');
const driverNameInput = document.getElementById('driverName');

let trackingInterval = null;

btnStart.addEventListener('click', () => {
    const busId = busIdInput.value.trim();
    const driverName = driverNameInput.value.trim();

    if (!busId || !driverName) {
        alert("Please enter both Route/Bus Details and Driver Name.");
        return;
    }

    if (!navigator.geolocation) {
        alert("Geolocation is not supported by your browser.");
        return;
    }

    // Switch UI
    setupSection.style.display = 'none';
    activeSection.style.display = 'block';

    startBroadcasting(busId, driverName);
});

btnStop.addEventListener('click', () => {
    stopBroadcasting();
});

function startBroadcasting(busId, driverName) {
    const options = {
        enableHighAccuracy: true,
        timeout: 5000,
        maximumAge: 0
    };

    // Firebase reference path
    let busRef;
    try {
        busRef = ref(database, 'buses/' + busId.replace(/[^a-zA-Z0-9-]/g, ''));
    } catch (e) { }

    function fetchAndSendLocation() {
        navigator.geolocation.getCurrentPosition(
            (position) => {
                const currentTime = Date.now();
                const lat = position.coords.latitude;
                const lng = position.coords.longitude;
                let speed = 0;

                // Calculate speed if not provided by device
                if (position.coords.speed !== null && position.coords.speed > 0) {
                    speed = Math.floor(position.coords.speed * 3.6); // Convert m/s to km/h
                } else if (lastLat !== null) {
                    const distance = getDistanceFromLatLonInKm(lastLat, lastLng, lat, lng);
                    const timeDiffSeconds = (currentTime - lastTime) / 1000;
                    if (timeDiffSeconds > 0) {
                        speed = Math.floor((distance / timeDiffSeconds) * 3600);
                    }
                }

                // Update stats
                lastLat = lat;
                lastLng = lng;
                lastTime = currentTime;
                updateCount++;

                document.getElementById('updatesCount').innerText = updateCount;
                document.getElementById('currentSpeed').innerText = `${speed} km/h`;

                // Push to Firebase Realtime Database
                const locationData = {
                    latitude: lat,
                    longitude: lng,
                    driver: driverName,
                    speed: speed,
                    timestamp: currentTime,
                    busNumber: busId
                };

                try {
                    if (busRef) {
                        set(busRef, locationData);
                    }
                } catch (e) {
                    console.log("Mock broadcast update:", locationData);
                }
            },
            (error) => {
                console.error("Error getting location:", error);
                if (error.code === 1) {
                    alert("Please enable location permissions to share your live location.");
                    stopBroadcasting();
                }
            },
            options
        );
    }

    // Call immediately, then repeat every 3 seconds
    fetchAndSendLocation();
    trackingInterval = setInterval(fetchAndSendLocation, 3000);
}

function stopBroadcasting() {
    if (watchId !== null) {
        navigator.geolocation.clearWatch(watchId);
        watchId = null;
    }
    if (trackingInterval !== null) {
        clearInterval(trackingInterval);
        trackingInterval = null;
    }

    // Remove from DB when stopped
    const busId = busIdInput.value.trim();
    if (busId) {
        try {
            const safeBusId = busId.replace(/[^a-zA-Z0-9-]/g, '');
            const busRef = ref(database, 'buses/' + safeBusId);
            remove(busRef);
        } catch (e) { }
    }

    setupSection.style.display = 'block';
    activeSection.style.display = 'none';
    updateCount = 0;
}

// Distance calculation formula using Haversine
function getDistanceFromLatLonInKm(lat1, lon1, lat2, lon2) {
    var R = 6371; // Radius of the earth in km
    var dLat = deg2rad(lat2 - lat1);
    var dLon = deg2rad(lon2 - lon1);
    var a =
        Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos(deg2rad(lat1)) * Math.cos(deg2rad(lat2)) *
        Math.sin(dLon / 2) * Math.sin(dLon / 2);
    var c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    var d = R * c;
    return d;
}

function deg2rad(deg) {
    return deg * (Math.PI / 180)
}
