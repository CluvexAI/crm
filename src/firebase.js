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
  appId: "1:919607412267:web:07f5240682c45467b08c6e",
  measurementId: "G-YSWXVF87RX"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
export const analytics = typeof window !== 'undefined' ? getAnalytics(app) : null;
export default app;
