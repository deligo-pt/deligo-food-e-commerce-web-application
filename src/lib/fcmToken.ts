import { getToken } from "firebase/messaging";
import { getFirebaseMessaging } from "./firebase";
import { apiClient } from "./apiClient";

const VAPID_KEY = process.env.NEXT_PUBLIC_FIREBASE_VAPID_KEY;
const FCM_TOKEN_STORAGE_KEY = "deligo-fcm-token";

/**
 * Requests notification permission, retrieves the FCM token, and
 * returns it. Returns null if the browser doesn't support it, the
 * user denies permission, or the VAPID key is not configured.
 */
export async function requestFCMToken(): Promise<string | null> {
  console.log("[FCM] requestFCMToken() called");

  // Guard: VAPID key must be set and not be the placeholder value
  if (!VAPID_KEY || VAPID_KEY === "YOUR_VAPID_KEY_HERE") {
    console.warn(
      "[FCM] ❌ VAPID key is missing or still a placeholder.\n" +
        "  → Set NEXT_PUBLIC_FIREBASE_VAPID_KEY in .env\n" +
        "  → Firebase Console → Project Settings → Cloud Messaging → Web Push certificates",
    );
    return null;
  }
  console.log("[FCM] ✅ VAPID key found:", VAPID_KEY.slice(0, 20) + "...");

  if (!("serviceWorker" in navigator)) {
    console.warn("[FCM] ❌ Service workers not supported in this browser.");
    return null;
  }

  try {
    const messaging = await getFirebaseMessaging();
    if (!messaging) {
      console.warn("[FCM] ❌ Firebase Messaging not supported in this browser.");
      return null;
    }
    console.log("[FCM] ✅ Firebase Messaging instance ready");

    const permission = await Notification.requestPermission();
    console.log("[FCM] Notification permission:", permission);
    if (permission !== "granted") {
      console.warn("[FCM] ❌ Notification permission denied by user.");
      return null;
    }

    // Explicitly register the service worker and pass it to getToken.
    // This is REQUIRED — without it, Firebase cannot find the SW in Next.js
    // / Turbopack environments and throws AbortError.
    console.log("[FCM] Registering service worker...");
    const serviceWorkerRegistration = await navigator.serviceWorker.register(
      "/firebase-messaging-sw.js",
      { scope: "/" },
    );
    // Wait until the SW is active (handles the "installing" → "activated" transition)
    await navigator.serviceWorker.ready;
    console.log("[FCM] ✅ Service worker registered:", serviceWorkerRegistration.scope);

    console.log("[FCM] Calling getToken() with VAPID key + SW registration...");
    const token = await getToken(messaging, {
      vapidKey: VAPID_KEY,
      serviceWorkerRegistration,
    });

    if (token) {
      console.log("[FCM] ✅ FCM Token obtained:", token);
    } else {
      console.warn("[FCM] ❌ getToken() returned empty — check VAPID key and service worker.");
    }

    return token || null;
  } catch (error) {
    // AbortError typically means the push service rejected the subscription
    if (error instanceof Error && error.name === "AbortError") {
      console.warn(
        "[FCM] ❌ AbortError — Push subscription failed. Possible causes:\n" +
          "  1. VAPID key doesn't match Firebase project Sender ID (703860914762)\n" +
          "  2. Stale push subscription — open DevTools → Application → Storage → Clear site data\n" +
          "  3. Running on HTTP in production (push requires HTTPS)",
      );
    } else {
      console.error("[FCM] ❌ Unexpected error in getToken():", error);
    }
    return null;
  }
}

/**
 * Syncs the given FCM token to the backend.
 * Only posts when the token has changed (cached in localStorage).
 */
export async function syncFCMToken(fcmToken: string): Promise<void> {
  try {
    const cached = localStorage.getItem(FCM_TOKEN_STORAGE_KEY);
    if (cached === fcmToken) return; // no change — skip the request

    const deviceId = localStorage.getItem("deligo-device-id") || "unknown";

    await apiClient.post("/auth/update-fcm-token", {
      token: fcmToken,
      deviceId,
    });

    localStorage.setItem(FCM_TOKEN_STORAGE_KEY, fcmToken);
  } catch (error) {
    console.error("[FCM] Failed to sync token:", error);
  }
}

/** Clears the locally cached FCM token (call on logout). */
export function clearCachedFCMToken() {
  localStorage.removeItem(FCM_TOKEN_STORAGE_KEY);
}
