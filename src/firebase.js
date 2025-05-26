import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getAnalytics } from "firebase/analytics";

const firebaseConfig = {
    apiKey: "AIzaSyBSn_6rt5FJmHunGFYnH4fOvAUAWxZSkK4",
    authDomain: "daily-voice-recorder.firebaseapp.com",
    projectId: "daily-voice-recorder",
    storageBucket: "daily-voice-recorder.firebasestorage.app",
    messagingSenderId: "269236863743",
    appId: "1:269236863743:web:1ff77c6298c46d86f582ca",
    measurementId: "G-KVKF2WWPL0"
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);
// eslint-disable-next-line no-unused-vars
export const analytics = getAnalytics(app);