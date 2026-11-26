import { getApp, getApps, initializeApp, type FirebaseApp } from "firebase/app";
import { getAnalytics, isSupported, type Analytics } from "firebase/analytics";
import { getAuth, GoogleAuthProvider, type Auth } from "firebase/auth";
import { getFirestore, type Firestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
  measurementId: process.env.NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID,
};

export const firebaseApp: FirebaseApp | null = firebaseConfig.apiKey
  ? getApps().length > 0
    ? getApp()
    : initializeApp(firebaseConfig)
  : null;

export const firebaseAuth: Auth | null = firebaseApp
  ? getAuth(firebaseApp)
  : null;

export const firebaseDb: Firestore | null = firebaseApp
  ? getFirestore(firebaseApp)
  : null;

export const googleProvider = new GoogleAuthProvider();

let analyticsPromise: Promise<Analytics | null> | null = null;

/**
 * Initializes Firebase Analytics in supported browser environments.
 */
export function initFirebaseAnalytics(): Promise<Analytics | null> {
  if (typeof window === "undefined" || !firebaseApp) {
    return Promise.resolve(null);
  }
  if (!analyticsPromise) {
    analyticsPromise = isSupported()
      .then((supported) => (supported ? getAnalytics(firebaseApp) : null))
      .catch(() => null);
  }
  return analyticsPromise;
}
