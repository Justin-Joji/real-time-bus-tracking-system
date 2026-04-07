// FIREBASE INITIALIZATION
const firebaseConfig = {
    apiKey: "AIzaSyALiPY92gZgbXLyMeOVkEiw4aZ-WUwRckE",
    authDomain: "tybot-c3ce5.firebaseapp.com",
    databaseURL: "https://tybot-c3ce5-default-rtdb.asia-southeast1.firebasedatabase.app",
    projectId: "tybot-c3ce5",
    storageBucket: "tybot-c3ce5.firebasestorage.app",
    messagingSenderId: "748570538888",
    appId: "1:748570538888:web:b964dbef2b14a59df7c03d",
    measurementId: "G-5FCS3SYSZG"
};
firebase.initializeApp(firebaseConfig);
const db = firebase.database();
const fs = firebase.firestore();

// UI FUNCTIONS
function showPage(id) {
    document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
    document.getElementById(id).classList.add('active');
}

function togglePassword(inputId = "driverPassword") {
    const input = document.getElementById(inputId);
    if (input) input.type = input.type === "password" ? "text" : "password";
}

let locationInterval = null;
let locationWatchId = null;

function logout() {
    localStorage.clear();
    if (locationInterval) clearInterval(locationInterval);
    if (locationWatchId) navigator.geolocation.clearWatch(locationWatchId);
    showPage('home');
    location.reload();
}

window.addEventListener('DOMContentLoaded', () => {
    const userType = localStorage.getItem("userType");
    if (userType === "driver") {
        busNumber = localStorage.getItem("busNumber");
        if (busNumber) {
            getLiveLocation();
        }
    } else if (userType === "student") {
        const trackBus = localStorage.getItem("trackBus");
        if (trackBus) {
            selectedStopLat = parseFloat(localStorage.getItem("selectedStopLat")) || null;
            selectedStopLon = parseFloat(localStorage.getItem("selectedStopLon")) || null;
            document.getElementById("etaLocation").innerText = localStorage.getItem("etaLocation") || "College";

            db.ref("busLocations/" + trackBus).on("value", updateStatus);
            showPage("arrivalStatus");
        }
    }
});

/* GLOBAL VARIABLES */
let busNumber = null;
let stopList = [];
let selectedStopLat = null;
let selectedStopLon = null;
let lastLat = null;
let lastLon = null;
let lastTime = null;
let speed = 40;

/* LOAD STOPS ON PAGE LOAD */
fs.collection("stops").get().then(snapshot => {
    snapshot.forEach(doc => {
        const data = doc.data();
        if (data.Busstop && data.Latitude && data.longitude) {
            stopList.push({
                name: data.Busstop,
                lat: Number(data.Latitude),
                lon: Number(data.longitude)
            });
        }
    });
}).catch(err => console.log("Error loading stops: ", err));

/* LOAD BUSES FOR STUDENTS */
fs.collection("drivers").get().then(snapshot => {
    const busSelect = document.getElementById("studentBus");
    const buses = new Set();
    snapshot.forEach(doc => {
        const data = doc.data();
        if (data.Busnumber) {
            buses.add(data.Busnumber);
        }
    });

    buses.forEach(b => {
        const opt = document.createElement("option");
        opt.value = b;
        opt.innerText = "Bus: " + b;
        busSelect.appendChild(opt);
    });
}).catch(err => console.log("Error loading buses: ", err));

/* DRIVER LOGIC (FIRESTORE) */
function driverRegister() {
    const id = document.getElementById("regDriverId").value.trim();
    const name = document.getElementById("regDriverName").value.trim();
    const busNum = document.getElementById("regBusNumber").value.trim();
    const pass = document.getElementById("regDriverPassword").value;

    if (!id || !name || !busNum || !pass) {
        alert("Please fill all fields.");
        return;
    }

    // Directly set the document. Often .get() followed by .set() falls into permission traps
    // if the user doesn't have read access to the entire collection before auth.
    fs.collection("drivers").doc(id).set({
        Name: name,
        Busnumber: busNum,
        Password: pass
    }).then(() => {
        alert("Registration successful! Please login.");
        showPage("driverLogin");
    }).catch(err => {
        console.error(err);
        alert("Error registering driver. " + err.message);
    });
}

function driverLogin() {
    const id = document.getElementById("driverId").value.trim();
    const pass = document.getElementById("driverPassword").value;

    if (!id || !pass) {
        alert("Please enter both ID and Password.");
        return;
    }

    fs.collection("drivers").doc(id).get().then(doc => {
        if (!doc.exists) {
            alert("Authentication Failed: Driver not found. Check your Driver ID.");
            return;
        }
        const data = doc.data();
        if (data.Password === pass) {
            busNumber = data.Busnumber || data.busNumber || id; // Fallback in case busNumber missing
            localStorage.setItem("busNumber", busNumber);
            showPage("locationPermission");
        } else {
            alert("Authentication Failed: Incorrect Password.");
        }
    }).catch(err => {
        console.error(err);
        alert("Error connecting to server.");
    });
}

/* STUDENT LOGIC (FIRESTORE) */
function studentRegister() {
    const id = document.getElementById("regStudentId").value.trim();
    const name = document.getElementById("regStudentName").value.trim();
    const pass = document.getElementById("regStudentPassword").value;

    if (!id || !name || !pass) {
        alert("Please fill all fields.");
        return;
    }

    // Direct write to avoid permission errors when unauthenticated.
    fs.collection("students").doc(id).set({
        Name: name,
        Password: pass
    }).then(() => {
        alert("Student Registration successful! Please login.");
        showPage("studentLogin");
    }).catch(err => {
        console.error(err);
        alert("Error registering student. " + err.message);
    });
}

function studentLogin() {
    const id = document.getElementById("studentRegNo").value.trim();
    const pass = document.getElementById("studentPassword").value;
    const trackBus = document.getElementById("studentBus").value;

    if (!id || !pass) {
        alert("Please enter Register Number and Password.");
        return;
    }

    if (trackBus === "none" || trackBus === "Select Bus to Track") {
        alert("Please select a Bus to track.");
        return;
    }

    fs.collection("students").doc(id).get().then(doc => {
        if (!doc.exists) {
            alert("Authentication Failed: Student not found. Please register.");
            return;
        }
        const data = doc.data();
        if (data.Password === pass) {
            // Login successful
            // Assume College is the destination or map to the last stop
            const stop = stopList.find(s => s.name.toLowerCase() === "college") || stopList[stopList.length - 1];
            if (stop) {
                selectedStopLat = stop.lat;
                selectedStopLon = stop.lon;
                document.getElementById("etaLocation").innerText = stop.name;
            } else {
                selectedStopLat = 9.273183;
                selectedStopLon = 76.812384;
                document.getElementById("etaLocation").innerText = "College";
            }

            localStorage.setItem("userType", "student");
            localStorage.setItem("trackBus", trackBus);
            localStorage.setItem("selectedStopLat", selectedStopLat);
            localStorage.setItem("selectedStopLon", selectedStopLon);
            localStorage.setItem("etaLocation", document.getElementById("etaLocation").innerText);

            // Track the selected bus
            db.ref("busLocations/" + trackBus).on("value", updateStatus);
            showPage("arrivalStatus");
        } else {
            alert("Authentication Failed: Incorrect Password.");
        }
    }).catch(err => {
        console.error(err);
        alert("Error connecting to server.");
    });
}

/* LOCATION PERMISSION HANDLING */
function denyLocation() {
    showPage("driverDashboard");
}

function getLocation() {
    if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(pos => {
            sendLocation(pos);
            localStorage.setItem("userType", "driver");
            showPage('driverDashboard');
        }, err => alert("Location permission denied."));
    } else {
        alert("Geolocation is not supported by this browser.");
    }
}

function getLiveLocation() {
    if (navigator.geolocation) {
        const options = { enableHighAccuracy: true, timeout: 5000, maximumAge: 0 };

        if (locationWatchId) navigator.geolocation.clearWatch(locationWatchId);
        if (locationInterval) clearInterval(locationInterval);

        function fetchAndSend() {
            navigator.geolocation.getCurrentPosition(sendLocation, err => {
                console.log("Error getting position", err);
            }, options);
        }

        fetchAndSend();
        locationInterval = setInterval(fetchAndSend, 3000); // Force locations every 3 sec

        locationWatchId = navigator.geolocation.watchPosition(sendLocation, err => {
            console.log("Error watching position", err);
        }, options);

        localStorage.setItem("userType", "driver");
        showPage('driverDashboard');
    } else {
        alert("Geolocation is not supported by this browser.");
    }
}

/* SEND LOCATION TO FIREBASE */
function sendLocation(pos) {
    if (!busNumber) return; // safety

    const lat = pos.coords.latitude;
    const lon = pos.coords.longitude;
    const time = Date.now();

    if (lastLat !== null) {
        const dist = getDistance(lastLat, lastLon, lat, lon);
        const timeDiff = (time - lastTime) / 3600000; // in hours
        speed = (timeDiff > 0) ? (dist / timeDiff) : 40;
        if (speed <= 0 || speed > 120) speed = 40; // cap unrealistic speeds
    }
    lastLat = lat;
    lastLon = lon;
    lastTime = time;

    db.ref("busLocations/" + busNumber).set({
        latitude: lat,
        longitude: lon,
        speed: speed,
        time: time
    });

    // Allow the driver to also see their own relative stats
    // We mock the driver's current status if they haven't picked a destination
    const currentRouteStop = detectStop(lat, lon);
    document.getElementById("driverCurrent").innerText = currentRouteStop;
    document.getElementById("driverNext").innerText = getNextStop(currentRouteStop);
    document.getElementById("driverDistance").innerText = "Tracking...";
    document.getElementById("driverEta").innerText = "-- min";
}

/* UPDATE STUDENT STATUS */
function updateStatus(snapshot) {
    const data = snapshot.val();
    if (!data) return;

    const lat = data.latitude;
    const lon = data.longitude;
    const currentObjSpeed = data.speed > 0 ? data.speed : 40;

    const current = detectStop(lat, lon);
    const next = getNextStop(current);
    const distance = getDistance(lat, lon, selectedStopLat, selectedStopLon);

    const eta = (currentObjSpeed > 0) ? (distance / currentObjSpeed) * 60 : 1;

    document.getElementById("studentDistance").innerText = distance.toFixed(2) + " km";

    let displayEta = Math.round(eta);
    if (displayEta < 1 && distance < 0.1) displayEta = 0; // arrived

    document.getElementById("etaCircle").innerHTML = `${displayEta}<br><span>MINUTES</span>`;
    document.getElementById("studentCurrent").innerText = current;
    document.getElementById("studentNext").innerText = next;
}

/* UTILITY: FIND NEAREST STOP */
function detectStop(lat, lon) {
    if (stopList.length === 0) return "Unknown";
    let min = 999;
    let nearest = "Unknown";
    stopList.forEach(s => {
        const d = getDistance(lat, lon, s.lat, s.lon);
        if (d < min) {
            min = d;
            nearest = s.name;
        }
    });
    return nearest;
}

/* UTILITY: GET NEXT STOP */
function getNextStop(current) {
    if (stopList.length === 0) return "Unknown";
    for (let i = 0; i < stopList.length; i++) {
        if (stopList[i].name === current) {
            return i < stopList.length - 1 ? stopList[i + 1].name : stopList[i].name; // Loop logic or last
        }
    }
    return stopList[stopList.length - 1].name;
}

/* UTILITY: HAVERSINE DISTANCE FORMULA */
function getDistance(lat1, lon1, lat2, lon2) {
    const R = 6371; // Radius of the earth in km
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a =
        Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
        Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c; // Distance in km
}
