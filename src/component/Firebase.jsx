// src/firebase.js
import { initializeApp } from "firebase/app";
import { getDatabase, ref, set, onValue, remove, push } from "firebase/database";

const firebaseConfig = {
  apiKey: "AIzaSyCTzOqJ4Hs_NDVyy-w2qEiM5YrpEbJCYAM",
  authDomain: "gen-lang-client-0058843025.firebaseapp.com",
  projectId: "gen-lang-client-0058843025",
  storageBucket: "gen-lang-client-0058843025.firebasestorage.app",
  messagingSenderId: "941790728610",
  appId: "1:941790728610:web:3b7ad0c50d4d56d01be2fb",
  measurementId: "G-MD5LHV751N"
};


const app = initializeApp(firebaseConfig);
const database = getDatabase(app);

export { database, ref, set, onValue, remove, push };
