"use client";

import {
  ArrowLeft,
  Share2,
  MapPin,
  Clock3,
  UtensilsCrossed,
  Phone,
  Mail,
  FileText,
  Copy,
  Check,
  MessageCircle,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { getApiErrorMessage } from "@/lib/apiClient";
import { useVendor } from "@/hooks/queries/useVendors";
import { useTranslation } from "@/hooks/useTranslation";
import { loadGoogleMapsScript } from "@/lib/googleMapsLoader";
import { Button } from "@/components/ui/button";

interface VendorDetailsModalProps {
  isOpen: boolean;
  onClose: () => void;
  vendorId: string | null;
}

interface VendorData {
  name: {
    firstName: string;
    lastName: string;
  };
  businessDetails: {
    businessName: string;
    businessType: string;
    businessLicenseNumber: string;
    NIF: string;
    totalBranches: number;
    openingHours: string;
    closingHours: string;
    closingDays: string[];
    isStoreOpen: boolean;
    storeClosedAt: string | null;
    deliveryZoneId: string;
    preparationTimeMinutes: number;
    restaurantCuisineType: string[] | string;
  };
  businessLocation: {
    street: string;
    city: string;
    state: string;
    country: string;
    postalCode: string;
    latitude: number;
    longitude: number;
  };
  _id: string;
  userId: string;
  email: string;
  contactNumber: string;
}

export default function VendorDetailsModal({
  isOpen,
  onClose,
  vendorId,
}: VendorDetailsModalProps) {
  const { t } = useTranslation();
  const [shareMenuOpen, setShareMenuOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const shareRef = useRef<HTMLDivElement>(null);
  const mapContainerRef = useRef<HTMLDivElement | null>(null);
  const [mapLoadFailed, setMapLoadFailed] = useState(false);

  // Shared, cached vendor query (customer vs. open endpoint handled inside the
  // hook). placeholderData keeps the open modal populated during a lang switch.
  const {
    data: vendorData = null,
    isLoading: loading,
    error: vendorErrorObj,
  } = useVendor<VendorData>(vendorId ?? undefined, { enabled: isOpen });
  const error = vendorErrorObj
    ? getApiErrorMessage(vendorErrorObj, "Failed to load vendor details")
    : null;

  // Close share dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (shareRef.current && !shareRef.current.contains(e.target as Node)) {
        setShareMenuOpen(false);
      }
    };
    if (shareMenuOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [shareMenuOpen]);

  // Close modal on Escape key press
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
      }
    };
    if (isOpen) {
      window.addEventListener("keydown", handleKeyDown);
    }
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  const lat = vendorData?.businessLocation?.latitude;
  const lng = vendorData?.businessLocation?.longitude;
  const hasCoords = typeof lat === "number" && typeof lng === "number";

  // Render the vendor location with the Maps JavaScript API (the same API the
  // order-tracking map uses) rather than a Static Maps image, which needs a
  // separately-authorized API. The map is (re)built each time the modal opens
  // with valid coordinates.
  useEffect(() => {
    if (!isOpen || !hasCoords) return;
    let cancelled = false;

    loadGoogleMapsScript()
      .then(() => {
        if (cancelled) return;
        const container = mapContainerRef.current;
        if (
          !container ||
          !window.google?.maps ||
          typeof lat !== "number" ||
          typeof lng !== "number"
        ) {
          return;
        }

        const position = { lat, lng };
        const map = new window.google.maps.Map(container, {
          center: position,
          zoom: 15,
          disableDefaultUI: true,
          zoomControl: true,
          clickableIcons: false,
          gestureHandling: "cooperative",
        });
        new window.google.maps.Marker({ position, map });
        setMapLoadFailed(false);
      })
      .catch(() => {
        if (!cancelled) setMapLoadFailed(true);
      });

    return () => {
      cancelled = true;
    };
  }, [isOpen, hasCoords, lat, lng]);

  if (!isOpen) return null;

  const fullAddress = vendorData?.businessLocation
    ? `${vendorData.businessLocation.street}, ${vendorData.businessLocation.city} ${vendorData.businessLocation.postalCode}, ${vendorData.businessLocation.country}`
    : "";

  const shareUrl = typeof window !== "undefined" ? window.location.href : "";
  const shareTitle = vendorData?.businessDetails?.businessName
    ? `${vendorData.businessDetails.businessName} – DeliGo`
    : "DeliGo Vendor";
  const shareText = fullAddress
    ? `Check out ${shareTitle} at ${fullAddress}`
    : `Check out ${shareTitle} on DeliGo!`;

  const handleShareClick = async () => {
    // Use native Web Share API on supporting devices (mobile)
    if (typeof navigator !== "undefined" && navigator.share) {
      try {
        await navigator.share({
          title: shareTitle,
          text: shareText,
          url: shareUrl,
        });
      } catch {
        // User cancelled – do nothing
      }
      return;
    }
    // Fallback: toggle dropdown on desktop
    setShareMenuOpen((prev) => !prev);
  };

  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Ignore
    }
    setShareMenuOpen(false);
  };

  const handleShareWhatsApp = () => {
    window.open(
      `https://wa.me/?text=${encodeURIComponent(`${shareText}\n${shareUrl}`)}`,
      "_blank",
      "noopener,noreferrer",
    );
    setShareMenuOpen(false);
  };

  const handleShareEmail = () => {
    window.open(
      `mailto:?subject=${encodeURIComponent(shareTitle)}&body=${encodeURIComponent(`${shareText}\n${shareUrl}`)}`,
      "_self",
    );
    setShareMenuOpen(false);
  };

  return (
    <div
      onClick={onClose}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-2 sm:p-4"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-250 max-h-[95vh] overflow-y-auto rounded-xl bg-card border shadow-xl dark:shadow-none"
      >
        {/* Header */}
        <div className="sticky top-0 z-10 flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-border bg-card px-4 py-4 sm:px-6 md:px-8 sm:py-4 md:py-6">
          <div className="flex items-center gap-3 sm:gap-4">
            <Button
              size="icon"
              variant="ghost"
              onClick={onClose}
              aria-label={t("close")}
              className="rounded-full"
            >
              <ArrowLeft size={20} />
            </Button>

            <div>
              <h1 className="text-xl font-semibold text-gray-900 dark:text-white">
                {vendorData?.businessDetails?.businessName || t("vendor")}
              </h1>
              <p className="text-xs sm:text-sm text-gray-500 dark:text-neutral-400">
                {t("pleaseContactVendor")}
              </p>
            </div>
          </div>

          {/* Share button + dropdown */}
          <div className="relative self-end sm:self-auto" ref={shareRef}>
            <Button
              size="icon"
              variant="ghost"
              onClick={handleShareClick}
              title={t("share")}
              aria-label={t("share")}
              className="rounded-full text-primary hover:bg-primary/5 dark:hover:bg-pink-950/20"
            >
              <Share2 size={18} />
            </Button>

            {/* Copied toast */}
            {copied && (
              <div className="absolute right-0 top-12 z-50 flex items-center gap-2 whitespace-nowrap rounded-xl bg-gray-900 px-4 py-2 text-sm text-white shadow-lg animate-fade-in">
                <Check size={14} className="text-green-400" />
                {t("linkCopied")}
              </div>
            )}

            {/* Share dropdown */}
            {shareMenuOpen && !copied && (
              <div className="absolute right-0 top-12 z-50 min-w-47.5 overflow-hidden rounded-2xl border border-border bg-card shadow-xl dark:shadow-none">
                <p className="border-b border-border px-4 py-2.5 text-xs font-semibold uppercase tracking-wider text-gray-400 dark:text-neutral-500">
                  {t("shareVia")}
                </p>

                {/* Copy Link */}
                <button
                  onClick={handleCopyLink}
                  className="focus-ring flex w-full items-center gap-3 px-4 py-3 text-sm text-gray-700 dark:text-neutral-300 transition hover:bg-primary/5 dark:hover:bg-pink-950/20 hover:text-primary dark:hover:text-pink-400"
                >
                  <span className="flex h-8 w-8 items-center justify-center rounded-full bg-gray-100 dark:bg-neutral-800">
                    <Copy size={15} />
                  </span>
                  {t("copyLink")}
                </button>

                {/* WhatsApp */}
                <button
                  onClick={handleShareWhatsApp}
                  className="focus-ring flex w-full items-center gap-3 px-4 py-3 text-sm text-gray-700 dark:text-neutral-300 transition hover:bg-green-50 dark:hover:bg-green-950/20 hover:text-green-600 dark:hover:text-green-400"
                >
                  <span className="flex h-8 w-8 items-center justify-center rounded-full bg-green-100 dark:bg-green-950/40">
                    <MessageCircle size={15} className="text-green-600" />
                  </span>
                  WhatsApp
                </button>

                {/* Email */}
                <button
                  onClick={handleShareEmail}
                  className="focus-ring flex w-full items-center gap-3 px-4 py-3 text-sm text-gray-700 dark:text-neutral-300 transition hover:bg-primary/5 dark:hover:bg-pink-950/20 hover:text-primary dark:hover:text-pink-400"
                >
                  <span className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10 dark:bg-pink-950/40">
                    <Mail size={15} className="text-primary" />
                  </span>
                  {t("email")}
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Content */}
        <div className="grid grid-cols-1 gap-6 p-4 sm:gap-8 sm:p-6 md:p-8 lg:grid-cols-2">
          {/* Left Column */}
          <div className="space-y-4 sm:space-y-4 md:space-y-6">
            {/* Map */}
            <div className="relative overflow-hidden rounded-xl shadow-md">
              {loading ? (
                <div className="h-48 sm:h-60 w-full animate-pulse bg-gray-200 dark:bg-neutral-800" />
              ) : error || mapLoadFailed ? (
                <div className="flex h-48 sm:h-60 w-full items-center justify-center bg-gray-100 dark:bg-neutral-800 text-gray-500 dark:text-neutral-400">
                  <p>{t("mapUnavailable")}</p>
                </div>
              ) : hasCoords ? (
                <div ref={mapContainerRef} className="h-48 sm:h-60 w-full" />
              ) : (
                <div className="flex h-48 sm:h-60 w-full items-center justify-center bg-gray-100 dark:bg-neutral-800 text-gray-500 dark:text-neutral-400">
                  <p>{t("locationNotAvailable")}</p>
                </div>
              )}

              <div className="absolute left-3 top-3 sm:left-4 sm:top-4 flex items-center gap-1.5 sm:gap-2 rounded-full bg-white/95 dark:bg-neutral-900/95 px-2 py-1 sm:px-3 sm:py-1.5 shadow-sm border">
                <MapPin size={14} className="fill-primary text-primary" />
                <span className="text-xs font-medium text-gray-900 dark:text-white">
                  {vendorData?.businessDetails?.businessName || t("vendor")}
                </span>
              </div>
            </div>

            {/* Status Cards */}
            <div className="grid grid-cols-2 gap-3 sm:gap-4">
              <div className="flex items-center gap-3 sm:gap-4 rounded-xl border border-border bg-gray-50 dark:bg-neutral-900/50 p-3 sm:p-4">
                <div className="rounded-full bg-green-100 dark:bg-green-950/40 p-2 sm:p-3">
                  <Clock3 size={20} className="text-green-600 dark:text-green-400" />
                </div>
                <div>
                  <p className="text-xs sm:text-sm font-bold text-green-600 dark:text-green-400">
                    {vendorData?.businessDetails?.isStoreOpen
                      ? t("openNow")
                      : t("closedNow")}
                  </p>
                  <p className="text-xs text-gray-500 dark:text-neutral-400">
                    {vendorData?.businessDetails?.openingHours &&
                    vendorData?.businessDetails?.closingHours
                      ? `${vendorData.businessDetails.openingHours} – ${vendorData.businessDetails.closingHours}`
                      : t("hoursNotSet")}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-3 sm:gap-4 rounded-xl border border-border bg-gray-50 dark:bg-neutral-900/50 p-3 sm:p-4">
                <div className="rounded-full bg-primary/10 dark:bg-pink-950/40 p-2 sm:p-3">
                  <UtensilsCrossed size={20} className="text-primary dark:text-pink-400" />
                </div>
                <div>
                  <p className="text-xs sm:text-sm font-bold text-primary dark:text-pink-400">
                    {t("preparationTime")}
                  </p>
                  <p className="text-xs text-gray-500 dark:text-neutral-400">
                    {vendorData?.businessDetails?.preparationTimeMinutes ?? "—"}{" "}
                    {t("minutes")}
                  </p>
                </div>
              </div>
            </div>

            {/* Address */}
            <div className="rounded-xl border-l-4 border-primary bg-gray-100 dark:bg-neutral-900 border dark:border-neutral-800 p-4 sm:p-6">
              <div className="flex gap-3 sm:gap-4">
                <MapPin size={20} className="mt-1 text-primary dark:text-pink-400 shrink-0" />
                <div>
                  <h3 className="mb-1 text-xs sm:text-sm text-gray-500 dark:text-neutral-400">
                    {t("address")}
                  </h3>
                  <p className="text-sm text-gray-900 dark:text-neutral-100 wrap-break-words">
                    {fullAddress || t("addressNotProvided")}
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Right Column */}
          <div className="space-y-4 sm:space-y-6">
            <div>
              <h2 className="mb-4 text-xl font-semibold text-primary dark:text-pink-400">
                {t("contactInformation")}
              </h2>
              <div className="space-y-3">
                {/* Phone */}
                <div className="flex items-center gap-3 sm:gap-4 rounded-xl border border-border bg-gray-50 dark:bg-neutral-900/50 p-3 sm:p-4">
                  <div className="flex h-8 w-8 sm:h-10 sm:w-10 items-center justify-center rounded-full bg-primary/10 dark:bg-pink-950/40">
                    <Phone size={18} className="text-primary dark:text-pink-400" />
                  </div>
                  <div>
                    <p className="text-xs text-gray-500 dark:text-neutral-400">
                      {t("phone")}
                    </p>
                    <p className="text-sm sm:text-base font-bold text-gray-900 dark:text-white break-all">
                      {vendorData?.contactNumber || t("notProvided")}
                    </p>
                  </div>
                </div>

                {/* Email */}
                <div className="flex items-center gap-3 sm:gap-4 rounded-xl border border-border bg-gray-50 dark:bg-neutral-900/50 p-3 sm:p-4">
                  <div className="flex h-8 w-8 sm:h-10 sm:w-10 items-center justify-center rounded-full bg-primary/10 dark:bg-pink-950/40">
                    <Mail size={18} className="text-primary dark:text-pink-400" />
                  </div>
                  <div>
                    <p className="text-xs text-gray-500 dark:text-neutral-400">
                      {t("email")}
                    </p>
                    <p className="text-sm sm:text-base font-bold text-gray-900 dark:text-white break-all">
                      {vendorData?.email || t("notProvided")}
                    </p>
                  </div>
                </div>

                {/* NIF */}
                <div className="flex items-center gap-3 sm:gap-4 rounded-xl border border-border bg-gray-50 dark:bg-neutral-900/50 p-3 sm:p-4">
                  <div className="flex h-8 w-8 sm:h-10 sm:w-10 items-center justify-center rounded-full bg-primary/10 dark:bg-pink-950/40">
                    <FileText size={18} className="text-primary dark:text-pink-400" />
                  </div>
                  <div>
                    <p className="text-xs text-gray-500 dark:text-neutral-400">
                      {t("nifNumber")}
                    </p>
                    <p className="text-sm sm:text-base font-bold text-gray-900 dark:text-white">
                      {vendorData?.businessDetails?.NIF || t("notProvided")}
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* Other Details */}
            <div className="border-t border-border pt-4 sm:pt-4">
              <h2 className="mb-4 text-xl font-semibold text-primary dark:text-pink-400">
                {t("otherDetails")}
              </h2>
              <div className="space-y-3 sm:space-y-4">
                <div>
                  <p className="mb-1 text-xs sm:text-sm text-gray-500 dark:text-neutral-400">
                    {t("legalEntityName")}
                  </p>
                  <p className="font-bold text-gray-900 dark:text-white wrap-break-words">
                    {vendorData?.businessDetails?.businessName ||
                      t("notProvided")}
                  </p>
                </div>
                <div className="rounded-lg bg-gray-100 dark:bg-neutral-800 p-3 sm:p-4 border italic leading-relaxed text-gray-500 dark:text-neutral-400 text-sm sm:text-base">
                  {t("euComplianceNotice")}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Loading / Error overlay */}
        {loading && (
          <div className="absolute inset-0 flex items-center justify-center bg-white/60 dark:bg-neutral-950/60 backdrop-blur-sm rounded-xl">
            <div className="rounded-lg bg-card border p-4 shadow-lg text-sm sm:text-base text-gray-950 dark:text-white">
              {t("loadingVendorDetails")}
            </div>
          </div>
        )}
        {error && !loading && (
          <div className="mx-4 sm:mx-8 mb-4 rounded-lg bg-red-50 dark:bg-red-950/20 border dark:border-red-900/30 p-3 text-center text-xs sm:text-sm text-red-600 dark:text-red-400">
            {t("errorLoadingVendorDetails")}
          </div>
        )}
      </div>
    </div>
  );
}
