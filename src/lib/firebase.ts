import { initializeApp } from "firebase/app";
import { GoogleAuthProvider, getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

// Web config is public by design: access is controlled by Firestore rules, not by hiding this.
const app = initializeApp({
  apiKey: "AIzaSyAThjCvn6abiv-iSqLu454x5BHL9kCusqw",
  authDomain: "zaqsa2026-44d9f.firebaseapp.com",
  projectId: "zaqsa2026-44d9f",
  storageBucket: "zaqsa2026-44d9f.firebasestorage.app",
  messagingSenderId: "155232215911",
  appId: "1:155232215911:web:2f511d439a38dd73e5c5c2",
});

export const auth = getAuth(app);
export const db = getFirestore(app);
export const googleProvider = new GoogleAuthProvider();
googleProvider.setCustomParameters({ prompt: "select_account" });

/** The first admin. More admins are added from the Admins page and stored in Firestore. */
export const OWNER_EMAIL = "zyqotech@gmail.com";
