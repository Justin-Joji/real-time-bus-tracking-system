import { db } from './firebase-config.js';
import { doc, getDoc } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";

document.getElementById('driverLoginBtn').addEventListener('click', async () => {
    const id = document.getElementById('loginDriverId').value.trim();
    const pass = document.getElementById('loginDriverPass').value;

    if (!id || !pass) return alert("Enter all fields.");

    try {
        const docRef = doc(db, "drivers", id);
        const docSnap = await getDoc(docRef);

        if (docSnap.exists()) {
            const data = docSnap.data();
            if (data.password === pass) {
                if (data.status === 'pending') {
                    alert("Your account is pending admin approval.");
                    return;
                }
                localStorage.setItem('driverAuth_id', id);
                localStorage.setItem('driverAuth_name', data.name);
                localStorage.setItem('driverAuth_busNumber', data.busNumber);
                localStorage.setItem('driverAuth_routeId', data.assignedRoute || '');
                localStorage.setItem('driverAuth_routeName', data.assignedRouteName || 'Unknown');
                window.location.href = 'driver-dashboard.html';
            } else {
                alert("Incorrect password.");
            }
        } else {
            alert("No driver found with that ID.");
        }
    } catch (e) {
        alert("Error logging in: " + e.message);
    }
});
