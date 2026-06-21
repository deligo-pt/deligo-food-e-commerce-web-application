import { getToken } from "firebase/messaging";
import { getFirebaseMessaging } from "./firebase";
import { apiClient } from "./apiClient";

const VAPID_KEY = process.env.NEXT_PUBLIC_FIREBASE_VAPID_KEY;
const FCM_TOKEN_STORAGE_KEY = "deligo-fcm-token";

export async function requestFCMToken(): Promise<string | null> {
  if (!VAPID_KEY || VAPID_KEY === "YOUR_VAPID_KEY_HERE") {
    return null;
  }

  if (!("serviceWorker" in navigator)) {
    return null;
  }

  try {
    const messaging = await getFirebaseMessaging();
    if (!messaging) {
      return null;
    }

    const permission = await Notification.requestPermission();
    if (permission !== "granted") {
      return null;
    }

    const serviceWorkerRegistration = await navigator.serviceWorker.register(
      "/firebase-messaging-sw.js",
      { scope: "/" },
    );
    await navigator.serviceWorker.ready;

    const token = await getToken(messaging, {
      vapidKey: VAPID_KEY,
      serviceWorkerRegistration,
    });

    return token || null;
  } catch (error) {
    console.error(error);
    return null;
  }
}

export async function syncFCMToken(fcmToken: string): Promise<void> {
  try {
    const deviceId = localStorage.getItem("deligo-device-id") || "unknown";

    await apiClient.post("/auth/update-fcm-token", {
      token: fcmToken,
      deviceId,
    });

    localStorage.setItem(FCM_TOKEN_STORAGE_KEY, fcmToken);
  } catch (error) {
    console.error(error);
  }
}

export function clearCachedFCMToken() {
  localStorage.removeItem(FCM_TOKEN_STORAGE_KEY);
}
