"use client";

import { useEffect, useRef } from "react";
import { onMessage, type MessagePayload } from "firebase/messaging";
import { toast } from "sonner";
import { getFirebaseMessaging } from "../lib/firebase";
import { requestFCMToken, syncFCMToken } from "../lib/fcmToken";
import { getAccessToken } from "../lib/authCookies";

// Path to the notification sound in /public/audio/
const NOTIFICATION_SOUND_SRC = "/audio/notification-sound.mp3";

function playNotificationSound() {
  try {
    const audio = new Audio(NOTIFICATION_SOUND_SRC);
    audio.volume = 0.8;
    audio.play().catch(() => {
      // Browser may block autoplay — silently ignore
    });
  } catch {
    // Safari or restricted environments
  }
}

/**
 * Registers the Firebase Cloud Messaging service worker, requests
 * notification permission, syncs the FCM token to the backend, and
 * listens for foreground push messages — playing a sound and showing
 * an in-app toast for each one.
 *
 * Mount this hook once at the root layout level. It is a no-op when
 * the user is not logged in or the browser does not support FCM.
 */
export function useFCMNotifications() {
  const unsubscribeRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    // Only run in a real browser environment
    if (typeof window === "undefined") return;

    // Only initialise when the user is authenticated
    const accessToken = getAccessToken();
    if (!accessToken) return;

    let cancelled = false;

    async function init() {
      try {
        // 1. Register the service worker
        if (!("serviceWorker" in navigator)) return;
        const registration = await navigator.serviceWorker.register(
          "/firebase-messaging-sw.js",
          { scope: "/" }
        );

        if (cancelled) return;

        // 2. Request permission + get token
        const token = await requestFCMToken();
        if (!token || cancelled) return;

        // 3. Sync token to the backend
        await syncFCMToken(token);

        if (cancelled) return;

        // 4. Listen for foreground messages
        const messaging = await getFirebaseMessaging();
        if (!messaging || cancelled) return;

        unsubscribeRef.current = onMessage(messaging, (payload: MessagePayload) => {
          const { title, body, orderId, channelId } = payload.data ?? {};

          // Play sound
          playNotificationSound();

          // Build navigation URL
          const url =
            channelId === "order_notification" && orderId
              ? `/orders/${orderId}`
              : "/";

          // Show in-app toast
          toast(title || "New Notification", {
            description: body || "You have a new notification.",
            duration: 6000,
            action: {
              label: "View",
              onClick: () => {
                window.location.href = url;
              },
            },
          });
        });

        // 5. Handle sound requests from the background service worker
        navigator.serviceWorker.addEventListener("message", (event) => {
          if (event.data?.type === "PLAY_NOTIFICATION_SOUND") {
            playNotificationSound();
          }
        });

        console.log("[FCM] Notifications initialised successfully.");
      } catch (error) {
        console.error("[FCM] Initialisation error:", error);
      }
    }

    init();

    return () => {
      cancelled = true;
      unsubscribeRef.current?.();
      unsubscribeRef.current = null;
    };
  }, []); // Run once on mount — access token check inside prevents unauthenticated calls
}
