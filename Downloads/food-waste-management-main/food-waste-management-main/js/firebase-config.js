import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-app.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";
import { getDatabase } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-database.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-auth.js";

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

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);
export const rtdb = getDatabase(app);
export const auth = getAuth(app);
