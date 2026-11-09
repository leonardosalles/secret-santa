"use client";

import { getApp, getApps, initializeApp } from "firebase/app";
import {
  collection,
  doc,
  getDoc,
  getDocs,
  getDocsFromServer,
  getFirestore,
  setDoc,
  updateDoc,
} from "firebase/firestore";

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY!,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN!,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID!,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET!,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID!,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID!,
  measurementId: process.env.NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID!,
};
// Initialize Firebase
const app = getApps().length ? getApp() : initializeApp(firebaseConfig);
const databaseId = process.env.NEXT_PUBLIC_FIREBASE_DATABASE_ID?.trim() || "(default)";
export const db = getFirestore(app, databaseId);

export function getFirebaseErrorMessage(error: unknown): string {
  const code = typeof error === "object" && error !== null && "code" in error
    ? String(error.code) : "unknown";
  if (code === "permission-denied") {
    return "O Firebase recusou a leitura. Verifique as regras de acesso do Firestore.";
  }
  if (code === "not-found" || code === "unavailable") {
    return "Não foi possível acessar o Firestore. Verifique a conexão e se o banco configurado existe no projeto Firebase.";
  }
  return "Não foi possível carregar os dados do Firebase. Tente novamente.";
}
export { collection, doc, getDoc, getDocs, getDocsFromServer, setDoc, updateDoc };
