/* eslint-disable @typescript-eslint/no-unused-vars */
let isLoading = false;
let loadedPromise: Promise<void> | null = null;

export function loadGoogleMapsScript(): Promise<void> {
  if (typeof window === "undefined") return Promise.resolve();
  if (window.google?.maps) return Promise.resolve();
  if (loadedPromise) return loadedPromise;

  isLoading = true;
  loadedPromise = new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.src = `https://maps.googleapis.com/maps/api/js?key=${process.env.NEXT_PUBLIC_GOOGLE_MAPS_LOCATION_API_KEY}&libraries=places`;
    script.async = true;
    script.defer = true;
    script.onload = () => {
      isLoading = false;
      resolve();
    };
    script.onerror = (err) => {
      isLoading = false;
      loadedPromise = null;
      reject(err);
    };
    document.head.appendChild(script);
  });

  return loadedPromise;
}