import { db } from './firebase-config.js';
import { doc, getDoc, setDoc } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";

document.getElementById('driverRegBtn').addEventListener('click', async () => {
    const id = document.getElementById('regDriverId').value.trim();
    const name = document.getElementById('regDriverName').value.trim();
    const busNumber = document.getElementById('regBusNumber').value.trim();
    const pass = document.getElementById('regDriverPass').value;

    if (!id || !name || !busNumber || !pass) return alert("Enter all fields.");

    try {
        const docRef = doc(db, "drivers", id);
        const docSnap = await getDoc(docRef);

        if (docSnap.exists()) {
            alert("A driver is already registered with this ID.");
        } else {
            await setDoc(docRef, {
                name: name,
                busNumber: busNumber,
                password: pass,
                status: 'pending'
            });
            alert("Registration successful! Please wait for Admin approval to login.");
            window.location.href = 'driver-login.html';
        }
    } catch (e) {
        alert("Error registering: " + e.message);
    }
});
