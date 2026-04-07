import { db } from './firebase-config.js';
import { doc, getDoc, setDoc } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";

document.getElementById('showRegisterBtn').addEventListener('click', (e) => {
    e.preventDefault();
    document.getElementById('loginSection').style.display = 'none';
    document.getElementById('registerSection').style.display = 'block';
});

document.getElementById('showLoginBtn').addEventListener('click', (e) => {
    e.preventDefault();
    document.getElementById('registerSection').style.display = 'none';
    document.getElementById('loginSection').style.display = 'block';
});

document.getElementById('studentLoginBtn').addEventListener('click', async () => {
    const id = document.getElementById('loginStudentId').value.trim();
    const pass = document.getElementById('loginStudentPass').value;

    if (!id || !pass) return alert("Enter all fields.");

    // Quick feedback
    const btn = document.getElementById('studentLoginBtn');
    btn.innerText = "Connecting...";

    try {
        const docRef = doc(db, "students", id);
        const docSnap = await getDoc(docRef);

        if (docSnap.exists()) {
            const data = docSnap.data();
            if (data.password === pass) {
                localStorage.setItem('studentAuth_id', id);
                localStorage.setItem('studentAuth_name', data.name);
                window.location.href = 'student-tracking.html';
            } else {
                alert("Incorrect password.");
                btn.innerText = "Login to Track";
            }
        } else {
            alert("Student not found. Please register first.");
            btn.innerText = "Login to Track";
        }
    } catch (e) {
        alert("Error logging in: " + e.message);
        btn.innerText = "Login to Track";
    }
});

document.getElementById('studentRegisterBtn').addEventListener('click', async () => {
    const id = document.getElementById('regStudentId').value.trim();
    const name = document.getElementById('regStudentName').value.trim();
    const pass = document.getElementById('regStudentPass').value;

    if (!id || !name || !pass) return alert("Enter all fields.");

    const btn = document.getElementById('studentRegisterBtn');
    btn.innerText = "Registering...";

    try {
        const docRef = doc(db, "students", id);
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
            alert("Student ID already registered. Please login.");
            btn.innerText = "Register Account";
        } else {
            await setDoc(docRef, {
                name: name,
                password: pass
            });
            alert("Registration successful! Please login.");
            document.getElementById('showLoginBtn').click();
            btn.innerText = "Register Account";
        }
    } catch (e) {
        alert("Error registering: " + e.message);
        btn.innerText = "Register Account";
    }
});
