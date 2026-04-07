// Import the functions you need from the SDKs you need
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-app.js";
import { getDatabase, ref, set, onValue, remove, update } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-database.js";

// TODO: Replace with your actual Firebase project configuration
const firebaseConfig = {
    // You need to replace these values with your actual Firebase project settings
    apiKey: "YOUR_API_KEY",
    authDomain: "your-project.firebaseapp.com",
    databaseURL: "https://your-project-default-rtdb.firebaseio.com",
    projectId: "your-project",
    storageBucket: "your-project.appspot.com",
    messagingSenderId: "123456789",
    appId: "1:123456789:web:abcdef"
};

// Initialize Firebase
let app, database;

// Try to initialize, if credentials are dummy it might fail on actual reads, but we will mock if needed
try {
    app = initializeApp(firebaseConfig);
    database = getDatabase(app);
} catch (e) {
    console.error("Firebase initialization failed:", e);
}

export { database, ref, set, onValue, remove, update };
