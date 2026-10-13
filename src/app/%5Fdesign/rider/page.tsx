"use client";

import { useEffect, useState } from "react";
import OrderMap from "@/components/orders/TrackOrder/OrderMap/OrderMap";
import { Button } from "@/components/ui/button";

/**
 * `/_design/rider`: the DeliGo rider on the tracking map, for sign-off
 * (13 Oct 2026).
 *
 * This is the real `OrderMap` with the real stylesheet, on a made-up trip
 * across Lisbon, so the rider can be watched without an order that has reached
 * "Picked Up". It starts as PICKED_UP and turns to ON_THE_WAY a moment later,
 * as a live order does; with no rider GPS the map paces the rider along the
 * route by itself (about 30 seconds here). "Replay" starts the trip again.
 * Nothing here talks to the backend.
 */

const PICKUP = { lat: 38.7139, lng: -9.1394 };
const DELIVERY = { lat: 38.7223, lng: -9.1493 };

export default function RiderPreviewPage() {
  // Remounts the map so each run starts from the restaurant.
  const [run, setRun] = useState(0);

  return (
    <main className="mx-auto max-w-4xl space-y-6 p-6">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div className="space-y-1">
          <h1 className="text-2xl font-bold text-foreground">Tracking map: the rider</h1>
          <p className="text-sm text-muted-foreground">
            Preview only. The rider leaves the restaurant, follows the route and turns with the
            road. Zoom or drag the map to look closer.
          </p>
        </div>
        <Button type="button" size="sm" onClick={() => setRun((r) => r + 1)}>
          Replay
        </Button>
      </header>
      <Trip key={run} />
    </main>
  );
}

function Trip() {
  const [status, setStatus] = useState("PICKED_UP");

  useEffect(() => {
    const id = setTimeout(() => setStatus("ON_THE_WAY"), 3500);
    return () => clearTimeout(id);
  }, []);

  return (
    <section className="space-y-3">
      <p className="text-sm font-semibold text-foreground">
        Status: {status === "PICKED_UP" ? "Picked Up" : "On the way"}
      </p>
      <OrderMap
        orderStatus={status}
        pickupLatitude={PICKUP.lat}
        pickupLongitude={PICKUP.lng}
        pickupAddress="Restaurant"
        deliveryLatitude={DELIVERY.lat}
        deliveryLongitude={DELIVERY.lng}
        deliveryAddress="Customer"
        etaMinutes={0.5}
      />
    </section>
  );
}
