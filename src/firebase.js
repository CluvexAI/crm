// Import the functions you need from the SDKs you need
import { initializeApp } from "firebase/app";
import { getAnalytics } from "firebase/analytics";

// Your web app's Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyDMrr6i1UBKJpjlpi1k9LdZoH9YZZlP9Io",
  authDomain: "zsm-crm.firebaseapp.com",
  projectId: "zsm-crm",
  storageBucket: "zsm-crm.firebasestorage.app",
  messagingSenderId: "919607412267",
  appId: "1:919607412267:web:308e883834ea0670b08c6e",
  measurementId: "G-R1ME6MJJTB"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

let analytics;
// Wrapping analytics in a try-catch to prevent crashes if users have ad-blockers
try {
  analytics = getAnalytics(app);
} catch (error) {
  console.warn("Firebase Analytics could not be initialized:", error);
}

export { app, analytics };
