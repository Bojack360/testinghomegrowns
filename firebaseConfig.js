// firebaseConfig.js

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { getStorage } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-storage.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";

const firebaseConfig = {
  apiKey: "AIzaSyD901YIMHMnJXHqkuEwx-BvaaJKkvrhP04",
  authDomain: "homegrowns-80e44.firebaseapp.com",
  projectId: "homegrowns-80e44",
  storageBucket: "homegrowns-80e44.firebasestorage.app",
  messagingSenderId: "595940628215",
  appId: "1:595940628215:web:7202a8ebee5939ff07a5f2"
};

const app = initializeApp(firebaseConfig);

export const db = getFirestore(app);
export const storage = getStorage(app);
export const auth = getAuth(app);