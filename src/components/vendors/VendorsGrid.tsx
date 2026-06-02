"use client";

import { useEffect, useState } from "react";

import VendorCard, { Vendor } from "./VendorCard";
import { apiClient, getApiErrorMessage } from "@/lib/apiClient";

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

export default function VendorsGrid() {
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const fetchVendors = async () => {
      try {
        setLoading(true);
        setError("");

        const response = await apiClient.get<VendorsResponse>(
          `/vendors/customer?page=${page}&limit=${ITEMS_PER_PAGE}`
        );

        setVendors(response.data.data || []);
        setTotalPages(response.data.meta?.totalPage || 1);
      } catch (error) {
        console.error("Failed to fetch vendors:", error);

        setError(
          getApiErrorMessage(
            error,
            "Unable to load vendors. Please try again."
          )
        );
      } finally {
        setLoading(false);
      }
    };

    fetchVendors();
  }, [page]);

  if (loading) {
    return (
      <div className="grid grid-cols-1 gap-10 md:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: ITEMS_PER_PAGE }).map((_, index) => (
          <div
            key={index}
            className="h-105 animate-pulse rounded-4xl bg-gray-100"
          />
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
          No vendors found
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
            Previous
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
            Next
          </button>
        </div>
      )}
    </>
  );
}