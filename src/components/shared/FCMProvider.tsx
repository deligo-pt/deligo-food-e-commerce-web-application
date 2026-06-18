"use client";

import { useFCMNotifications } from "@/hooks/useFCMNotifications";

/**
 * Thin client component that mounts the FCM hook.
 * Renders nothing — purely side-effect driven.
 */
export default function FCMProvider() {
  useFCMNotifications();
  return null;
}
