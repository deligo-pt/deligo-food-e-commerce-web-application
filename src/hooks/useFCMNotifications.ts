"use client";

import { useEffect, useRef } from "react";
import type { MessagePayload } from "firebase/messaging";
import { toast } from "sonner";
import { usePathname } from "next/navigation";
import { getFirebaseMessaging } from "../lib/firebase";
import { requestFCMToken, syncFCMToken } from "../lib/fcmToken";
import { getAccessToken } from "../lib/authCookies";

const NOTIFICATION_SOUND_SRC = "/audio/notification-sound.mp3";

function playNotificationSound() {
  try {
    const audio = new Audio(NOTIFICATION_SOUND_SRC);
    audio.volume = 0.8;
    audio.play().catch(() => {

    });
  } catch {
    // Safari or restricted environments
  }
}


export function useFCMNotifications() {
  const unsubscribeRef = useRef<(() => void) | null>(null);
  const pathname = usePathname();

  useEffect(() => {
    if (typeof window === "undefined") return;

    // Re-check auth on every navigation (login/logout flows navigate), reading
    // the cookie directly — no separate state/effect to keep in sync.
    if (!getAccessToken()) {
      if (unsubscribeRef.current) {
        console.log("[FCM] User unauthenticated. Tearing down notifications...");
        unsubscribeRef.current();
        unsubscribeRef.current = null;
      }
      return;
    }

    let cancelled = false;

    async function init() {
      try {
        console.log("[FCM] Initialising messaging service worker...");
        if (!("serviceWorker" in navigator)) return;
        await navigator.serviceWorker.register("/firebase-messaging-sw.js", {
          scope: "/",
        });

        if (cancelled) return;
        const token = await requestFCMToken();
        if (!token || cancelled) return;
        await syncFCMToken(token);

        if (cancelled) return;
        const messaging = await getFirebaseMessaging();
        if (!messaging || cancelled) return;

        const { onMessage } = await import("firebase/messaging");
        unsubscribeRef.current = onMessage(messaging, (payload: MessagePayload) => {
          const title = payload.notification?.title || payload.data?.title;
          const body = payload.notification?.body || payload.data?.body;
          const { orderId, channelId } = payload.data ?? {};

          playNotificationSound();
          window.dispatchEvent(
            new CustomEvent("notificationsUpdated", { detail: { source: "fcm" } })
          );
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

        navigator.serviceWorker.addEventListener("message", (event) => {
          console.log("[FCM DIAGNOSTIC] Message event received from Service Worker:", event.data);
          if (
            event.data?.type === "PLAY_NOTIFICATION_SOUND" ||
            event.data?.type === "NOTIFICATION_RECEIVED"
          ) {
            console.log("[FCM] Message from background service worker:", event.data);
            playNotificationSound();
            window.dispatchEvent(
              new CustomEvent("notificationsUpdated", { detail: { source: "fcm" } })
            );
          }
        });

      } catch (error) {
        const err = error as { name?: string; message?: string } | undefined;
        if (
          err?.name === "AbortError" ||
          err?.message?.includes("push service error")
        ) {
          console.warn(
            "[FCM] Service worker or push registration aborted. This usually happens when " +
            "Google push service is blocked by the browser (like Brave/Opera settings) or network."
          );
        } else {
          console.error("[FCM] Error initializing notifications:", error);
        }
      }
    }

    init();

    return () => {
      cancelled = true;
    };
  }, [pathname]);
}
