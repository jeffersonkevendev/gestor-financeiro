import { initializeApp } from "firebase/app";
import { getAuth, GoogleAuthProvider } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyCE_ncAB6zBi9vfRGeJxJ6hNBDRpNwIBw0",
  authDomain: "gestor-financeiro-97d6b.firebaseapp.com",
  projectId: "gestor-financeiro-97d6b",
  storageBucket: "gestor-financeiro-97d6b.firebasestorage.app",
  messagingSenderId: "812288411912",
  appId: "1:812288411912:web:aeed45c12d8bd7524904bd",
};

export const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();
export const db = getFirestore(app);
