import { initializeApp, getApps, getApp } from 'firebase/app';
import { getDatabase } from 'firebase/database';

export const firebaseConfig = {
  apiKey: "AIzaSyAI0QeQ2QOYhp0wC9hOikgyJvJSFHxSbhU",
  authDomain: "nulisyoks.firebaseapp.com",
  databaseURL: "https://nulisyoks-default-rtdb.asia-southeast1.firebasedatabase.app",
  projectId: "nulisyoks",
  storageBucket: "nulisyoks.firebasestorage.app",
  messagingSenderId: "280501043604",
  appId: "1:280501043604:web:eaf410c8416f53030fcf81",
};

// Initialize Firebase safely
const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();
export const db = getDatabase(app);
