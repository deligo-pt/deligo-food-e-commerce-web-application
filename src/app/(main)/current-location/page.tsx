import CurrentLocationPage from "@/components/current-location/CurrentLocationPage";

export const metadata = {
  title: "My Current Location | DeliGo",
  description: "Use your current GPS location or add a new delivery address.",
};

export default function CurrentLocationRoute() {
  return <CurrentLocationPage />;
}
