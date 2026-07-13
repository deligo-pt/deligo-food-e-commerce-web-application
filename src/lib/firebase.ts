import type { FirebaseApp } from "firebase/app";
import type { Messaging } from "firebase/messaging";

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

// The Firebase SDK is loaded lazily via dynamic import so it stays OUT of the
// initial/shared client bundle. It only downloads when a signed-in user
// actually initialises notifications (getFirebaseMessaging / requestFCMToken).
let appPromise: Promise<FirebaseApp> | null = null;

async function getFirebaseApp(): Promise<FirebaseApp> {
  if (!appPromise) {
    appPromise = import("firebase/app").then(
      ({ initializeApp, getApps, getApp }) =>
        getApps().length > 0 ? getApp() : initializeApp(firebaseConfig),
    );
  }
  return appPromise;
}

/**
 * Returns the Firebase Messaging instance, or null when the browser
 * does not support it (e.g. Safari without permission, non-HTTPS, etc.)
 */
export async function getFirebaseMessaging(): Promise<Messaging | null> {
  const { getMessaging, isSupported } = await import("firebase/messaging");
  const supported = await isSupported();
  if (!supported) return null;
  const app = await getFirebaseApp();
  return getMessaging(app);
}
