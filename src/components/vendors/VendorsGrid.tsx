"use client";

import { useEffect, useState } from "react";

import VendorCard, { Vendor } from "./VendorCard";
import { apiClient, getApiErrorMessage } from "@/lib/apiClient";
import { useTranslation } from "@/hooks/useTranslation";
import { useLocationStore } from "@/stores/locationStore";

const ITEMS_PER_PAGE = 10;

type VendorsResponse = {
  success: boolean;
  message: string;
  meta: {
    page: number;
    limit: number;
    total: number;
    totalPage: number;
  };
  data: Vendor[];
};

function VendorCardSkeleton() {
  return (
    <article className="group cursor-pointer overflow-hidden rounded-4xl border-2 border-transparent bg-white shadow-[0_10px_40px_rgba(0,0,0,0.06)] transition-all">
      <div className="relative aspect-16/10 overflow-hidden">
        <div className="h-full w-full animate-pulse bg-gray-200" />
        <div className="absolute left-5 top-5">
          <div className="h-9 w-16 animate-pulse rounded-2xl bg-white/95 shadow-lg backdrop-blur-md" />
        </div>
      </div>

      <div className="p-8">
        <div className="mb-2 flex items-center justify-between gap-4">
          <div className="h-7 w-48 animate-pulse rounded-lg bg-gray-200" />
          <div className="h-5 w-5 animate-pulse rounded-full bg-gray-200" />
        </div>
        <div className="mb-6 h-6 w-32 animate-pulse rounded-lg bg-gray-200" />
        <div className="flex items-center gap-6 border-t border-[#edeeef] pt-6">
          <div className="flex items-center gap-2">
            <div className="h-5 w-5 animate-pulse rounded-full bg-gray-200" />
            <div className="h-5 w-24 animate-pulse rounded-full bg-gray-200" />
          </div>
          <div className="flex items-center gap-2">
            <div className="h-5 w-5 animate-pulse rounded-full bg-gray-200" />
            <div className="h-5 w-24 animate-pulse rounded-full bg-gray-200" />
          </div>
        </div>
      </div>
    </article>
  );
}

export default function VendorsGrid() {
  const { t } = useTranslation();
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const { coords: geoCoords, permissionStatus } = useLocationStore();

  useEffect(() => {
    if (permissionStatus === "loading") return;

    const fetchVendors = async () => {
      try {
        setLoading(true);
        setError("");

        let url = `/vendors/customer?page=${page}&limit=${ITEMS_PER_PAGE}`;
        let params: Record<string, string | number> = {};

        if (geoCoords) {
          url = "/vendors/nearby/open";
          params = {
            page,
            limit: ITEMS_PER_PAGE,
            latitude: geoCoords.latitude,
            longitude: geoCoords.longitude,
          };
        }

        const response = await apiClient.get<VendorsResponse>(url, { params });

        setVendors(response.data.data || []);
        setTotalPages(response.data.meta?.totalPage || 1);
      } catch (error) {
        console.error("Failed to fetch vendors:", error);

        setError(
          getApiErrorMessage(
            error,
            "Unable to load vendors. Please try again.",
          ),
        );
      } finally {
        setLoading(false);
      }
    };

    fetchVendors();
  }, [page, geoCoords, permissionStatus]);
  if (loading) {
    return (
      <div className="grid grid-cols-1 gap-10 md:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: ITEMS_PER_PAGE }).map((_, index) => (
          <VendorCardSkeleton key={index} />
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-3xl border border-red-200 bg-red-50 p-6 text-center text-red-600">
        {error}
      </div>
    );
  }

  if (!vendors.length) {
    return (
      <div className="rounded-3xl border border-gray-200 bg-white p-10 text-center">
        <h3 className="text-xl font-semibold text-gray-700">
          {t("noVendorsFound")}
        </h3>
      </div>
    );
  }

  return (
    <>
      <div className="grid grid-cols-1 gap-10 md:grid-cols-2 lg:grid-cols-3">
        {vendors.map((vendor) => (
          <VendorCard key={vendor.id} vendor={vendor} />
        ))}
      </div>

      {totalPages > 1 && (
        <div className="mt-16 flex flex-wrap items-center justify-center gap-3">
          <button
            onClick={() => setPage((prev) => prev - 1)}
            disabled={page === 1}
            className="rounded-xl border border-gray-200 px-5 py-2.5 font-medium transition disabled:cursor-not-allowed disabled:opacity-50"
          >
            {t("previous")}
          </button>

          {Array.from({ length: totalPages }).map((_, index) => {
            const pageNumber = index + 1;

            return (
              <button
                key={pageNumber}
                onClick={() => setPage(pageNumber)}
                className={`h-11 w-11 rounded-xl font-semibold transition-all ${
                  page === pageNumber
                    ? "bg-[#b0004a] text-white"
                    : "border border-gray-200 bg-white hover:border-[#b0004a]"
                }`}
              >
                {pageNumber}
              </button>
            );
          })}

          <button
            onClick={() => setPage((prev) => prev + 1)}
            disabled={page === totalPages}
            className="rounded-xl border border-gray-200 px-5 py-2.5 font-medium transition disabled:cursor-not-allowed disabled:opacity-50"
          >
            {t("next")}
          </button>
        </div>
      )}
    </>
  );
}